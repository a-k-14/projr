import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { deposits } from '../db/schema';
import type { Deposit, CreateDepositInput, DepositFilters, DepositStatus } from '../types';
import { generateId } from '../lib/ids';
import { todayUTC } from '../lib/dateUtils';

function rowToDeposit(row: typeof deposits.$inferSelect): Deposit {
  return {
    id: row.id,
    name: row.name,
    bankName: row.bankName ?? undefined,
    accountId: row.accountId,
    principalAmount: row.principalAmount,
    interestRate: row.interestRate ?? undefined,
    tenureMonths: row.tenureMonths ?? undefined,
    startDate: row.startDate,
    maturityDate: row.maturityDate ?? undefined,
    maturityValue: row.maturityValue ?? undefined,
    status: row.status as DepositStatus,
    note: row.note ?? undefined,
    createdAt: row.createdAt,
  };
}

export async function getDeposits(filters: DepositFilters = {}): Promise<Deposit[]> {
  const conditions = [];
  if (filters.accountId) conditions.push(eq(deposits.accountId, filters.accountId));
  if (filters.status) conditions.push(eq(deposits.status, filters.status));

  const rows = conditions.length > 0
    ? await db.select().from(deposits).where(and(...conditions)).orderBy(desc(deposits.startDate), desc(deposits.createdAt))
    : await db.select().from(deposits).orderBy(desc(deposits.startDate), desc(deposits.createdAt));

  return rows.map(rowToDeposit);
}

export async function getDepositById(id: string): Promise<Deposit | null> {
  const rows = await db.select().from(deposits).where(eq(deposits.id, id));
  if (!rows[0]) return null;
  return rowToDeposit(rows[0]);
}

export async function createDeposit(data: CreateDepositInput): Promise<Deposit> {
  const id = generateId();
  const now = todayUTC();
  const row = {
    id,
    name: data.name,
    bankName: data.bankName ?? null,
    accountId: data.accountId,
    principalAmount: data.principalAmount,
    interestRate: data.interestRate ?? null,
    tenureMonths: data.tenureMonths ?? null,
    startDate: data.startDate,
    maturityDate: data.maturityDate ?? null,
    maturityValue: data.maturityValue ?? null,
    status: 'active' as const,
    note: data.note ?? null,
    createdAt: now,
  };
  await db.insert(deposits).values(row);
  return rowToDeposit(row);
}

export async function updateDeposit(id: string, data: Partial<CreateDepositInput> & { status?: DepositStatus }): Promise<Deposit> {
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.bankName !== undefined) patch.bankName = data.bankName ?? null;
  if (data.accountId !== undefined) patch.accountId = data.accountId;
  if (data.principalAmount !== undefined) patch.principalAmount = data.principalAmount;
  if (data.interestRate !== undefined) patch.interestRate = data.interestRate ?? null;
  if (data.tenureMonths !== undefined) patch.tenureMonths = data.tenureMonths ?? null;
  if (data.startDate !== undefined) patch.startDate = data.startDate;
  if (data.maturityDate !== undefined) patch.maturityDate = data.maturityDate ?? null;
  if (data.maturityValue !== undefined) patch.maturityValue = data.maturityValue ?? null;
  if (data.note !== undefined) patch.note = data.note ?? null;
  if (data.status !== undefined) patch.status = data.status;

  await db.update(deposits).set(patch as any).where(eq(deposits.id, id));
  const rows = await db.select().from(deposits).where(eq(deposits.id, id));
  return rowToDeposit(rows[0]);
}

export async function deleteDeposit(id: string): Promise<void> {
  await db.delete(deposits).where(eq(deposits.id, id));
}
