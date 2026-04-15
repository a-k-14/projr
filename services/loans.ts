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
  const settlementImpact = getLoanSettlementImpact(loan.direction);
  const settledAmount = loanTransactions.reduce((sum, t) => {
    return getTransactionCashflowImpact(t) === settlementImpact ? sum + t.amount : sum;
  }, 0);
  const { pending, percent } = getLoanOutstanding(loan, settledAmount);
  return {
    ...loan,
    settledAmount,
    pendingAmount: pending,
    repaidPercent: percent,
    transactions: loanTransactions,
  };
}

async function getOriginTransaction(loan: Loan) {
  const loanTransactions = await getTransactions({ loanId: loan.id });
  return (
    loanTransactions.find((tx) => getTransactionCashflowImpact(tx) === getLoanOriginImpact(loan.direction)) ?? null
  );
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

  const label =
    getLoanOriginLabel(data.direction, data.personName);
  await createTransaction({
    type: 'loan',
    amount: data.givenAmount,
    accountId: data.accountId,
    loanId: id,
    note: label,
    date: data.date,
  });

  return rowToLoan(row);
}

export async function updateLoan(id: string, data: Partial<Loan>): Promise<Loan> {
  await db.update(loans).set(data as any).where(eq(loans.id, id));
  const rows = await db.select().from(loans).where(eq(loans.id, id));
  return rowToLoan(rows[0]);
}

export async function updateLoanOrigin(
  id: string,
  data: Partial<CreateLoanInput>
): Promise<Loan> {
  const existing = await getLoanById(id);
  if (!existing) throw new Error('Loan not found');

  const next: Loan = {
    ...existing,
    personName: data.personName ?? existing.personName,
    direction: data.direction ?? existing.direction,
    accountId: data.accountId ?? existing.accountId,
    givenAmount: data.givenAmount ?? existing.givenAmount,
    note: data.note ?? existing.note,
    tags: data.tags ?? existing.tags,
    date: data.date ?? existing.date,
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

  const loanTransactions = await getTransactions({ loanId: id });
  for (const tx of loanTransactions) {
    const impact = getTransactionCashflowImpact(tx);
    if (impact === getLoanOriginImpact(existing.direction)) {
      await updateTransaction(tx.id, {
        type: 'loan',
        amount: next.givenAmount,
        accountId: next.accountId,
        date: next.date,
        note: getLoanOriginLabel(next.direction, next.personName),
      });
    } else if (impact === getLoanSettlementImpact(existing.direction)) {
      await updateTransaction(tx.id, {
        type: 'loan',
        note: getLoanSettlementLabel(next.direction, next.personName),
      });
    }
  }

  const rows = await db.select().from(loans).where(eq(loans.id, id));
  return rowToLoan(rows[0]);
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
