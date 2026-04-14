import { eq, and, gte, lte, desc, like } from 'drizzle-orm';
import { db } from '../db/client';
import { transactions } from '../db/schema';
import type {
  Transaction,
  TransactionSplit,
  CreateTransactionInput,
  TransactionFilters,
} from '../types';
import { generateId } from '../lib/ids';
import { nowUTC } from '../lib/dateUtils';
import { updateAccountBalance } from './accounts';

function parseSplits(raw: string | null | undefined): TransactionSplit[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => ({
        categoryId: String(item?.categoryId ?? ''),
        amount: Number(item?.amount ?? 0),
      }))
      .filter((item) => item.categoryId && item.amount > 0);
  } catch {
    return [];
  }
}

function serializeSplits(splits?: TransactionSplit[]): string {
  if (!splits || splits.length === 0) return '[]';
  return JSON.stringify(
    splits
      .map((item) => ({
        categoryId: item.categoryId,
        amount: Number(item.amount),
      }))
      .filter((item) => item.categoryId && item.amount > 0)
  );
}

function rowToTransaction(row: typeof transactions.$inferSelect): Transaction {
  return {
    id: row.id,
    type: row.type as Transaction['type'],
    amount: row.amount,
    accountId: row.accountId,
    linkedAccountId: row.linkedAccountId ?? undefined,
    loanId: row.loanId ?? undefined,
    categoryId: row.categoryId ?? undefined,
    payee: row.payee ?? undefined,
    tags: JSON.parse(row.tags),
    splits: parseSplits(row.splitData),
    note: row.note ?? undefined,
    date: row.date,
    transferPairId: row.transferPairId ?? undefined,
    createdAt: row.createdAt,
  };
}

export async function getTransactions(filters: TransactionFilters = {}): Promise<Transaction[]> {
  const conditions: ReturnType<typeof eq>[] = [];

  if (filters.accountId) conditions.push(eq(transactions.accountId, filters.accountId));
  if (filters.type) conditions.push(eq(transactions.type, filters.type));
  if (filters.categoryId) conditions.push(eq(transactions.categoryId, filters.categoryId));
  if (filters.loanId) conditions.push(eq(transactions.loanId, filters.loanId));
  if (filters.fromDate) conditions.push(gte(transactions.date, filters.fromDate));
  if (filters.toDate) conditions.push(lte(transactions.date, filters.toDate));
  if (filters.search) conditions.push(like(transactions.note, `%${filters.search}%`));

  let query = db
    .select()
    .from(transactions)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .$dynamic();

  if (filters.limit) query = query.limit(filters.limit);
  if (filters.offset) query = query.offset(filters.offset);

  const rows = await query;
  return rows.map(rowToTransaction);
}

export async function getTransactionById(id: string): Promise<Transaction | null> {
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id));
  return rows[0] ? rowToTransaction(rows[0]) : null;
}

export async function createTransaction(data: CreateTransactionInput): Promise<Transaction> {
  const now = nowUTC();

  if (data.type === 'transfer') {
    const transferPairId = generateId();
    const outId = generateId();
    const inId = generateId();

    const outRow = {
      id: outId,
      type: 'out' as const,
      amount: data.amount,
      accountId: data.accountId,
      linkedAccountId: data.linkedAccountId ?? null,
      loanId: null,
      categoryId: null,
      payee: data.payee ?? null,
      tags: '[]',
      splitData: '[]',
      note: data.note ?? null,
      date: data.date,
      transferPairId,
      createdAt: now,
    };
    const inRow = {
      id: inId,
      type: 'in' as const,
      amount: data.amount,
      accountId: data.linkedAccountId!,
      linkedAccountId: data.accountId,
      loanId: null,
      categoryId: null,
      payee: data.payee ?? null,
      tags: '[]',
      splitData: '[]',
      note: data.note ?? null,
      date: data.date,
      transferPairId,
      createdAt: now,
    };

    await db.insert(transactions).values([outRow, inRow]);
    await updateAccountBalance(data.accountId, -data.amount);
    await updateAccountBalance(data.linkedAccountId!, data.amount);
    return rowToTransaction(outRow);
  }

  const id = generateId();
  const row = {
    id,
    type: data.type,
    amount: data.amount,
    accountId: data.accountId,
    linkedAccountId: data.linkedAccountId ?? null,
    loanId: data.loanId ?? null,
    categoryId: data.categoryId ?? null,
    payee: data.payee ?? null,
    tags: JSON.stringify(data.tags ?? []),
    splitData: serializeSplits(data.splits),
    note: data.note ?? null,
    date: data.date,
    transferPairId: null,
    createdAt: now,
  };

  await db.insert(transactions).values(row);

  if (data.type === 'in') await updateAccountBalance(data.accountId, data.amount);
  else if (data.type === 'out') await updateAccountBalance(data.accountId, -data.amount);

  return rowToTransaction(row);
}

export async function updateTransaction(
  id: string,
  data: Partial<CreateTransactionInput>
): Promise<Transaction> {
  const existing = await getTransactionById(id);
  if (!existing) throw new Error('Transaction not found');

  // Reverse old balance effect
  if (existing.type === 'in') await updateAccountBalance(existing.accountId, -existing.amount);
  else if (existing.type === 'out') await updateAccountBalance(existing.accountId, existing.amount);

  const updateData: Record<string, any> = {};
  if (data.type !== undefined) updateData.type = data.type;
  if (data.amount !== undefined) updateData.amount = data.amount;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.payee !== undefined) updateData.payee = data.payee;
  if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
  if (data.splits !== undefined) updateData.splitData = serializeSplits(data.splits);
  if (data.note !== undefined) updateData.note = data.note;
  if (data.date !== undefined) updateData.date = data.date;
  if (data.accountId !== undefined) updateData.accountId = data.accountId;

  await db.update(transactions).set(updateData).where(eq(transactions.id, id));

  const updated = await getTransactionById(id);

  // Apply new balance effect
  if (updated!.type === 'in') await updateAccountBalance(updated!.accountId, updated!.amount);
  else if (updated!.type === 'out') await updateAccountBalance(updated!.accountId, -updated!.amount);

  return updated!;
}

export async function countByAccount(accountId: string): Promise<number> {
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.accountId, accountId));
  return rows.length;
}

export async function countByCategory(categoryId: string): Promise<number> {
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.categoryId, categoryId));
  return rows.length;
}

export async function countByTag(tagId: string): Promise<number> {
  const rows = await db.select().from(transactions);
  let count = 0;
  for (const row of rows) {
    try {
      const tags: string[] = JSON.parse(row.tags);
      if (tags.includes(tagId)) count++;
    } catch {
      // ignore malformed json
    }
  }
  return count;
}

export async function deleteTransaction(id: string): Promise<void> {
  const existing = await getTransactionById(id);
  if (!existing) return;

  if (existing.transferPairId) {
    const pair = await db
      .select()
      .from(transactions)
      .where(eq(transactions.transferPairId, existing.transferPairId));

    for (const t of pair) {
      if (t.type === 'in') await updateAccountBalance(t.accountId, -t.amount);
      else if (t.type === 'out') await updateAccountBalance(t.accountId, t.amount);
    }

    await db
      .delete(transactions)
      .where(eq(transactions.transferPairId, existing.transferPairId));
    return;
  }

  if (existing.type === 'in') await updateAccountBalance(existing.accountId, -existing.amount);
  else if (existing.type === 'out') await updateAccountBalance(existing.accountId, existing.amount);

  await db.delete(transactions).where(eq(transactions.id, id));
}
