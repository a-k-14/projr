import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { loans } from '../db/schema';
import type { Loan, LoanWithSummary, CreateLoanInput, LoanFilters } from '../types';
import { generateId } from '../lib/ids';
import { todayUTC } from '../lib/dateUtils';
import { getLoanOutstanding } from '../lib/derived';
import { getTransactions, createTransaction } from './transactions';

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
  const settledAmount = loanTransactions.reduce((sum, t) => sum + t.amount, 0);
  const { pending, percent } = getLoanOutstanding(loan, settledAmount);
  return {
    ...loan,
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

  const label =
    data.direction === 'lent'
      ? `Lent to ${data.personName}`
      : `Borrowed from ${data.personName}`;
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

export async function recordLoanPayment(
  loanId: string,
  amount: number,
  date: string
): Promise<void> {
  const loan = await getLoanById(loanId);
  if (!loan) throw new Error('Loan not found');
  const label =
    loan.direction === 'lent'
      ? `Payment from ${loan.personName}`
      : `Payment to ${loan.personName}`;
  await createTransaction({
    type: 'loan',
    amount,
    accountId: loan.accountId,
    loanId,
    note: label,
    date,
  });
}
