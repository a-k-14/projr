import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { deposits, auditLogs } from '../db/schema';
import type { CloseDepositInput, Deposit, CreateDepositInput, DepositFilters, DepositStatus } from '../types';
import { generateId } from '../lib/ids';
import { nowUTC, addMonthsSafe } from '../lib/dateUtils';
import { createTransaction, deleteTransaction, getTransactions, updateTransaction } from './transactions';
import { logAction } from './audit';

function rowToDeposit(row: typeof deposits.$inferSelect): Deposit {
  return {
    id: row.id,
    name: row.name,
    bankName: row.bankName ?? undefined,
    accountId: row.accountId,
    principalAmount: row.principalAmount,
    interestRate: row.interestRate ?? undefined,
    tenureMonths: row.tenureMonths ?? undefined,
    tenureUnit: (row.tenureUnit as 'months' | 'days') ?? 'months',
    startDate: row.startDate,
    maturityDate: row.maturityDate ?? undefined,
    maturityValue: row.maturityValue ?? undefined,
    status: row.status as DepositStatus,
    note: row.note ?? undefined,
    createdAt: row.createdAt,
  };
}

async function findLinkedTx(depositId: string, kind: 'new' | 'closed') {
  const linked = await getTransactions({ depositId });
  return linked.find((tx) => tx.depositTransactionType === kind);
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

/**
 * Creates a deposit + a paired `type='deposit'` transaction
 * (depositTransactionType='new') that debits the source account.
 * Mirrors the loan creation pattern.
 */
export async function createDeposit(data: CreateDepositInput): Promise<Deposit> {
  const id = generateId();
  const now = nowUTC();
  const row = {
    id,
    name: data.name,
    bankName: data.bankName ?? null,
    accountId: data.accountId,
    principalAmount: data.principalAmount,
    interestRate: data.interestRate ?? null,
    tenureMonths: data.tenureMonths ?? null,
    tenureUnit: data.tenureUnit ?? 'months',
    startDate: data.startDate,
    maturityDate: data.maturityDate ?? null,
    maturityValue: data.maturityValue ?? null,
    status: 'active' as const,
    note: data.note ?? null,
    createdAt: now,
  };
  await db.insert(deposits).values(row);
  await logAction(db, 'create', 'deposits', id, null, rowToDeposit(row));

  try {
    await createTransaction({
      type: 'deposit',
      amount: data.principalAmount,
      accountId: data.accountId,
      depositId: id,
      depositTransactionType: 'new',
      note: data.note ?? undefined,
      date: data.startDate,
    });
  } catch (error) {
    await db.delete(deposits).where(eq(deposits.id, id));
    throw error;
  }

  return rowToDeposit(row);
}

/**
 * Updates the deposit row and mirrors changes to the linked 'new' transaction
 * (amount, account, date, note). Auto-recomputes maturityDate/maturityValue
 * if startDate / tenureMonths / interestRate / principalAmount changed and the
 * caller didn't pass them explicitly.
 */
export async function updateDeposit(
  id: string,
  data: Partial<CreateDepositInput> & { status?: DepositStatus },
): Promise<Deposit> {
  const existing = await getDepositById(id);
  if (!existing) throw new Error('Deposit not found');

  const nextStartDate = data.startDate ?? existing.startDate;
  const nextTenureMonths = data.tenureMonths !== undefined ? data.tenureMonths : existing.tenureMonths;
  const nextTenureUnit = data.tenureUnit !== undefined ? data.tenureUnit : existing.tenureUnit;
  const nextInterestRate = data.interestRate !== undefined ? data.interestRate : existing.interestRate;
  const nextPrincipal = data.principalAmount ?? existing.principalAmount;

  const inputsChanged =
    data.startDate !== undefined ||
    data.tenureMonths !== undefined ||
    data.tenureUnit !== undefined ||
    data.interestRate !== undefined ||
    data.principalAmount !== undefined;

  let computedMaturityDate: string | null | undefined = undefined;
  let computedMaturityValue: number | null | undefined = undefined;
  if (inputsChanged && data.maturityDate === undefined) {
    if (nextTenureMonths) {
      const start = new Date(nextStartDate);
      const end = nextTenureUnit === 'days'
        ? new Date(start.getTime() + nextTenureMonths * 86400000)
        : addMonthsSafe(start, nextTenureMonths);
      computedMaturityDate = end.toISOString();
    } else {
      computedMaturityDate = null;
    }
  }
  if (inputsChanged && data.maturityValue === undefined) {
    if (nextTenureMonths && nextInterestRate) {
      const quartersElapsed = nextTenureUnit === 'days' ? nextTenureMonths / 90 : nextTenureMonths / 3;
      const ratePerQuarter = (nextInterestRate / 100) / 4;
      computedMaturityValue = nextPrincipal * Math.pow(1 + ratePerQuarter, quartersElapsed);
    } else {
      computedMaturityValue = null;
    }
  }

  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.bankName !== undefined) patch.bankName = data.bankName ?? null;
  if (data.accountId !== undefined) patch.accountId = data.accountId;
  if (data.principalAmount !== undefined) patch.principalAmount = data.principalAmount;
  if (data.interestRate !== undefined) patch.interestRate = data.interestRate ?? null;
  if (data.tenureMonths !== undefined) patch.tenureMonths = data.tenureMonths ?? null;
  if (data.tenureUnit !== undefined) patch.tenureUnit = data.tenureUnit ?? 'months';
  if (data.startDate !== undefined) patch.startDate = data.startDate;
  if (data.maturityDate !== undefined) patch.maturityDate = data.maturityDate ?? null;
  else if (computedMaturityDate !== undefined) patch.maturityDate = computedMaturityDate;
  if (data.maturityValue !== undefined) patch.maturityValue = data.maturityValue ?? null;
  else if (computedMaturityValue !== undefined) patch.maturityValue = computedMaturityValue;
  if (data.note !== undefined) patch.note = data.note ?? null;
  if (data.status !== undefined) patch.status = data.status;

  await db.update(deposits).set(patch as any).where(eq(deposits.id, id));
  const rows = await db.select().from(deposits).where(eq(deposits.id, id));
  await logAction(db, 'update', 'deposits', id, existing, rowToDeposit(rows[0]));

  // Mirror amount/account/date/note onto the 'new' transaction so the
  // Activity row and account balance stay in sync.
  const linkedNewTx = await findLinkedTx(id, 'new');
  if (linkedNewTx) {
    const txPatch: Record<string, unknown> = {};
    if (data.principalAmount !== undefined) txPatch.amount = data.principalAmount;
    if (data.accountId !== undefined) txPatch.accountId = data.accountId;
    if (data.startDate !== undefined) txPatch.date = data.startDate;
    if (data.note !== undefined) txPatch.note = data.note ?? undefined;
    await updateTransaction(linkedNewTx.id, txPatch as any);
  }

  return rowToDeposit(rows[0]);
}

/**
 * Marks a deposit closed (covers both matured and closed states) and creates
 * a paired `type='deposit'` transaction (depositTransactionType='closed') that
 * credits the source account with the maturityValue (or principal if no
 * maturity value is set).
 */
export async function closeDeposit(id: string, data: CloseDepositInput = {}): Promise<Deposit> {
  const existing = await getDepositById(id);
  if (!existing) throw new Error('Deposit not found');

  const principalAmount = data.principalAmount ?? existing.principalAmount;
  const interestAmount = data.interestAmount ?? 0;
  const accountId = data.accountId ?? existing.accountId;
  const date = data.date ?? nowUTC();
  const note = data.note;

  // Already-closed state is unreachable from the UI (the Close button is hidden
  // for status !== 'active'). Caller can call reopenDeposit first if they want
  // to re-close with new values.
  if (existing.status === 'closed') return existing;

  // Transaction 1: return of principal capital
  await createTransaction({
    type: 'deposit',
    amount: principalAmount,
    accountId,
    depositId: id,
    depositTransactionType: 'closed',
    date,
    note,
  });

  // Transaction 2: interest income (only if interest > 0)
  if (interestAmount > 0) {
    await createTransaction({
      type: 'in',
      amount: interestAmount,
      accountId,
      categoryId: '__sys_interest_on_deposit__',
      depositId: id,
      date,
      note: note ? `${note} (interest)` : `Interest on ${existing.name}`,
    });
  }

  // Store the total maturity value (principal + interest) on the deposit record
  await db.update(deposits)
    .set({ status: 'closed', maturityValue: principalAmount + interestAmount })
    .where(eq(deposits.id, id));
  const rows = await db.select().from(deposits).where(eq(deposits.id, id));
  await logAction(db, 'update', 'deposits', id, existing, rowToDeposit(rows[0]));
  return rowToDeposit(rows[0]);
}

/**
 * Reverses closeDeposit: removes the 'closed' transaction (refunds the credit
 * via the regular delete flow) and flips status back to 'active'.
 */
export async function reopenDeposit(id: string): Promise<Deposit> {
  const existing = await getDepositById(id);
  if (!existing) throw new Error('Deposit not found');
  if (existing.status !== 'closed') return existing;
  // Delete all deposit-linked transactions (close + interest income)
  const linked = await getTransactions({ depositId: id });
  for (const tx of linked) {
    if (tx.depositTransactionType === 'closed' || tx.type === 'in') {
      await deleteTransaction(tx.id, { skipDepositCascade: true });
    }
  }
  await db.update(deposits).set({ status: 'active' }).where(eq(deposits.id, id));
  const rows = await db.select().from(deposits).where(eq(deposits.id, id));
  await logAction(db, 'update', 'deposits', id, existing, rowToDeposit(rows[0]));
  return rowToDeposit(rows[0]);
}

/**
 * Cascades: removes both linked transactions (new + closed if present), each
 * via deleteTransaction so balances auto-unwind, then drops the deposit row.
 */
export async function deleteDeposit(id: string): Promise<void> {
  const existing = await getDepositById(id);
  const linked = await getTransactions({ depositId: id });
  for (const tx of linked) {
    await deleteTransaction(tx.id, { skipDepositCascade: true });
  }
  await db.transaction(async (tx) => {
    await tx.delete(auditLogs).where(and(eq(auditLogs.recordId, id), eq(auditLogs.tableName, 'deposits')));
    await tx.delete(deposits).where(eq(deposits.id, id));
    if (existing) {
      await logAction(tx, 'delete', 'deposits', id, existing, null);
    }
  });
}
