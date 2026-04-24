import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { loans } from '../db/schema';
import type { Loan, LoanWithSummary, CreateLoanInput, LoanFilters } from '../types';
import { generateId } from '../lib/ids';
import { todayUTC } from '../lib/dateUtils';
import {
  getLoanOriginImpact,
  getLoanOriginLabel,
  getLoanOutstanding,
  getLoanSettlementImpact,
  getLoanSettlementLabel,
  getLoanTransactionUserNote,
  mergeLoanTransactionNote,
  getTransactionCashflowImpact,
} from '../lib/derived';
import { getTransactions, createTransaction, updateTransaction, deleteTransaction } from './transactions';

function rowToLoan(row: typeof loans.$inferSelect): Loan {
  return {
    id: row.id,
    personName: row.personName,
    direction: row.direction as Loan['direction'],
    accountId: row.accountId,
    givenAmount: row.givenAmount,
    status: row.status as Loan['status'],
    note: row.note ?? undefined,
    tags: JSON.parse(row.tags),
    date: row.date,
    createdAt: row.createdAt,
  };
}

async function enrichLoan(loan: Loan): Promise<LoanWithSummary> {
  const loanTransactions = await getTransactions({ loanId: loan.id });
  const originImpact = getLoanOriginImpact(loan.direction);
  const settlementImpact = getLoanSettlementImpact(loan.direction);
  const givenAmount = loanTransactions.reduce((sum, t) => {
    return getTransactionCashflowImpact(t) === originImpact ? sum + t.amount : sum;
  }, 0);
  const settledAmount = loanTransactions.reduce((sum, t) => {
    return getTransactionCashflowImpact(t) === settlementImpact ? sum + t.amount : sum;
  }, 0);
  const { pending, percent } = getLoanOutstanding({ ...loan, givenAmount }, settledAmount);
  return {
    ...loan,
    givenAmount,
    settledAmount,
    pendingAmount: pending,
    repaidPercent: percent,
    transactions: loanTransactions,
  };
}

export async function getLoans(filters: LoanFilters = {}): Promise<LoanWithSummary[]> {
  const conditions = [];
  if (filters.accountId) conditions.push(eq(loans.accountId, filters.accountId));
  if (filters.status) conditions.push(eq(loans.status, filters.status));

  const rows = conditions.length > 0
    ? await db.select().from(loans).where(and(...conditions)).orderBy(desc(loans.date), desc(loans.createdAt))
    : await db.select().from(loans).orderBy(desc(loans.date), desc(loans.createdAt));

  const loanList = rows.map(rowToLoan);
  return Promise.all(loanList.map(enrichLoan));
}

export async function getLoanById(id: string): Promise<LoanWithSummary | null> {
  const rows = await db.select().from(loans).where(eq(loans.id, id));
  if (!rows[0]) return null;
  return enrichLoan(rowToLoan(rows[0]));
}

export async function createLoan(data: CreateLoanInput): Promise<Loan> {
  const id = generateId();
  const now = todayUTC();
  const row = {
    id,
    personName: data.personName,
    direction: data.direction,
    accountId: data.accountId,
    givenAmount: data.givenAmount,
    status: 'open' as const,
    note: data.note ?? null,
    tags: JSON.stringify(data.tags ?? []),
    date: data.date,
    createdAt: now,
  };
  await db.insert(loans).values(row);

  try {
    const label = getLoanOriginLabel(data.direction, data.personName);
    await createTransaction({
      type: 'loan',
      amount: data.givenAmount,
      accountId: data.accountId,
      loanId: id,
      note: mergeLoanTransactionNote(label, data.note),
      date: data.date,
    });
  } catch (error) {
    await db.delete(loans).where(eq(loans.id, id));
    throw error;
  }

  return rowToLoan(row);
}

export async function updateLoan(id: string, data: Partial<Loan>): Promise<Loan> {
  await db.update(loans).set(data as any).where(eq(loans.id, id));
  const rows = await db.select().from(loans).where(eq(loans.id, id));
  return rowToLoan(rows[0]);
}

export async function updateLoanOrigin(
  id: string,
  data: Partial<CreateLoanInput>,
  originTransactionId?: string
): Promise<Loan> {
  const existing = await getLoanById(id);
  if (!existing) throw new Error('Loan not found');

  const loanTransactions = await getTransactions({ loanId: id });
  const originImpact = getLoanOriginImpact(existing.direction);
  const originTransactions = loanTransactions.filter(
    (tx) => getTransactionCashflowImpact(tx) === originImpact
  );
  const primaryOriginTransaction = originTransactions.findLast(() => true);
  const originTransaction =
    (originTransactionId
      ? originTransactions.find((tx) => tx.id === originTransactionId)
      : undefined) ??
    originTransactions.find((tx) =>
      tx.date === existing.date && Math.abs(tx.amount - existing.givenAmount) < 0.000001
    ) ??
    primaryOriginTransaction;
  const isPrimaryOriginEdit = !!originTransaction && originTransaction.id === primaryOriginTransaction?.id;
  const nextOriginAmount = data.givenAmount ?? originTransaction?.amount ?? existing.givenAmount;
  const originDelta = originTransaction ? nextOriginAmount - originTransaction.amount : 0;
  const nextGivenAmount = data.givenAmount !== undefined ? existing.givenAmount + originDelta : existing.givenAmount;
  const next: Loan = {
    ...existing,
    personName: data.personName ?? existing.personName,
    direction: data.direction ?? existing.direction,
    accountId: isPrimaryOriginEdit ? data.accountId ?? existing.accountId : existing.accountId,
    givenAmount: nextGivenAmount,
    note: isPrimaryOriginEdit ? data.note ?? existing.note : existing.note,
    tags: data.tags ?? existing.tags,
    date: isPrimaryOriginEdit ? data.date ?? existing.date : existing.date,
  };

  await db.update(loans).set({
    personName: next.personName,
    direction: next.direction,
    accountId: next.accountId,
    givenAmount: next.givenAmount,
    note: next.note ?? null,
    tags: JSON.stringify(next.tags),
    date: next.date,
  }).where(eq(loans.id, id));

  const nextOriginLabel = getLoanOriginLabel(next.direction, next.personName);
  const directionChanged = next.direction !== existing.direction || next.personName !== existing.personName;

  for (const tx of originTransactions) {
    const shouldUpdateLabel = directionChanged || tx.id === originTransaction?.id;
    if (!shouldUpdateLabel) continue;
    const userNote =
      tx.id === originTransaction?.id
        ? data.note ?? getLoanTransactionUserNote(tx.note)
        : getLoanTransactionUserNote(tx.note);
    await updateTransaction(tx.id, {
      type: 'loan',
      amount: tx.id === originTransaction?.id ? nextOriginAmount : undefined,
      accountId: tx.id === originTransaction?.id ? data.accountId ?? tx.accountId : undefined,
      date: tx.id === originTransaction?.id ? data.date ?? tx.date : undefined,
      note: mergeLoanTransactionNote(nextOriginLabel, userNote),
    });
  }

  for (const tx of loanTransactions) {
    const impact = getTransactionCashflowImpact(tx);
    if (impact === getLoanSettlementImpact(existing.direction)) {
      const userNote = getLoanTransactionUserNote(tx.note);
      await updateTransaction(tx.id, {
        type: 'loan',
        note: mergeLoanTransactionNote(getLoanSettlementLabel(next.direction, next.personName), userNote),
      });
    }
  }

  const rows = await db.select().from(loans).where(eq(loans.id, id));
  return rowToLoan(rows[0]);
}

export async function addLoanPrincipal(
  loanId: string,
  amount: number,
  accountId: string,
  date: string,
  note?: string
): Promise<void> {
  const loan = await getLoanById(loanId);
  if (!loan) throw new Error('Loan not found');
  const label = getLoanOriginLabel(loan.direction, loan.personName);

  await createTransaction({
    type: 'loan',
    amount,
    accountId,
    loanId,
    note: mergeLoanTransactionNote(label, note),
    date,
  });

  await db
    .update(loans)
    .set({ givenAmount: loan.givenAmount + amount })
    .where(eq(loans.id, loanId));
}

export async function recordLoanPayment(
  loanId: string,
  amount: number,
  date: string
): Promise<void> {
  const loan = await getLoanById(loanId);
  if (!loan) throw new Error('Loan not found');
  const label = getLoanSettlementLabel(loan.direction, loan.personName);
  await createTransaction({
    type: 'loan',
    amount,
    accountId: loan.accountId,
    loanId,
    note: label,
    date,
  });
}

export async function deleteLoanCascade(loanId: string): Promise<void> {
  const loanTransactions = await getTransactions({ loanId });
  for (const tx of loanTransactions) {
    await deleteTransaction(tx.id);
  }
  await db.delete(loans).where(eq(loans.id, loanId));
}
