import { eq, and, gte, lte, desc, like, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { accounts, categories, transactions } from '../db/schema';
import type {
  Transaction,
  CreateTransactionInput,
  TransactionFilters,
} from '../types';
import { generateId } from '../lib/ids';
import { nowUTC } from '../lib/dateUtils';

type TransactionExecutor = Pick<typeof db, 'select' | 'update'>;

function rowToTransaction(row: typeof transactions.$inferSelect): Transaction {
  return {
    id: row.id,
    type: row.type as Transaction['type'],
    amount: row.amount,
    accountId: row.accountId,
    splitGroupId: row.splitGroupId ?? undefined,
    linkedAccountId: row.linkedAccountId ?? undefined,
    loanId: row.loanId ?? undefined,
    categoryId: row.categoryId ?? undefined,
    payee: row.payee ?? undefined,
    tags: JSON.parse(row.tags),
    note: row.note ?? undefined,
    date: row.date,
    transferPairId: row.transferPairId ?? undefined,
    createdAt: row.createdAt,
  };
}

async function getAccountBalance(executor: TransactionExecutor, accountId: string): Promise<number> {
  const rows = await executor
    .select({ balance: accounts.balance })
    .from(accounts)
    .where(eq(accounts.id, accountId));
  if (!rows[0]) throw new Error('Account not found');
  return rows[0].balance;
}

async function applyAccountBalanceDelta(
  executor: TransactionExecutor,
  accountId: string,
  delta: number,
): Promise<void> {
  if (!delta) return;
  const currentBalance = await getAccountBalance(executor, accountId);
  await executor
    .update(accounts)
    .set({ balance: currentBalance + delta })
    .where(eq(accounts.id, accountId));
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
      splitGroupId: null,
      linkedAccountId: data.linkedAccountId ?? null,
      loanId: null,
      categoryId: null,
      payee: data.payee ?? null,
      tags: '[]',
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
      splitGroupId: null,
      linkedAccountId: data.accountId,
      loanId: null,
      categoryId: null,
      payee: data.payee ?? null,
      tags: '[]',
      note: data.note ?? null,
      date: data.date,
      transferPairId,
      createdAt: now,
    };

    await db.transaction(async (tx) => {
      await tx.insert(transactions).values([outRow, inRow]);
      await applyAccountBalanceDelta(tx, data.accountId, -data.amount);
      await applyAccountBalanceDelta(tx, data.linkedAccountId!, data.amount);
    });
    return rowToTransaction(outRow);
  }

  const id = generateId();
  const row = {
    id,
    type: data.type,
    amount: data.amount,
    accountId: data.accountId,
    splitGroupId: data.splitGroupId ?? null,
    linkedAccountId: data.linkedAccountId ?? null,
    loanId: data.loanId ?? null,
    categoryId: data.categoryId ?? null,
    payee: data.payee ?? null,
    tags: JSON.stringify(data.tags ?? []),
    note: data.note ?? null,
    date: data.date,
    transferPairId: null,
    createdAt: now,
  };

  await db.transaction(async (tx) => {
    await tx.insert(transactions).values(row);
    if (data.type === 'in') await applyAccountBalanceDelta(tx, data.accountId, data.amount);
    else if (data.type === 'out') await applyAccountBalanceDelta(tx, data.accountId, -data.amount);
  });

  return rowToTransaction(row);
}

export async function updateTransaction(
  id: string,
  data: Partial<CreateTransactionInput>
): Promise<Transaction> {
  const existing = await getTransactionById(id);
  if (!existing) throw new Error('Transaction not found');

  const updateData: Record<string, any> = {};
  if (data.type !== undefined) updateData.type = data.type;
  if (data.amount !== undefined) updateData.amount = data.amount;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.payee !== undefined) updateData.payee = data.payee;
  if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
  if (data.note !== undefined) updateData.note = data.note;
  if (data.date !== undefined) updateData.date = data.date;
  if (data.accountId !== undefined) updateData.accountId = data.accountId;
  if (data.splitGroupId !== undefined) updateData.splitGroupId = data.splitGroupId;

  let updatedRow: typeof transactions.$inferSelect | undefined;
  await db.transaction(async (tx) => {
    if (existing.type === 'in') await applyAccountBalanceDelta(tx, existing.accountId, -existing.amount);
    else if (existing.type === 'out') await applyAccountBalanceDelta(tx, existing.accountId, existing.amount);

    await tx.update(transactions).set(updateData).where(eq(transactions.id, id));

    const rows = await tx.select().from(transactions).where(eq(transactions.id, id));
    updatedRow = rows[0];
    if (!updatedRow) throw new Error('Updated transaction not found');

    if (updatedRow.type === 'in') await applyAccountBalanceDelta(tx, updatedRow.accountId, updatedRow.amount);
    else if (updatedRow.type === 'out') await applyAccountBalanceDelta(tx, updatedRow.accountId, -updatedRow.amount);
  });

  return rowToTransaction(updatedRow!);
}

export async function updateTransferTransaction(
  id: string,
  data: Pick<CreateTransactionInput, 'amount' | 'accountId' | 'linkedAccountId' | 'date' | 'note' | 'payee'>
): Promise<Transaction> {
  const existing = await getTransactionById(id);
  if (!existing?.transferPairId) throw new Error('Transfer transaction not found');
  if (!data.linkedAccountId) throw new Error('Transfer destination account is required');

  const pair = await db
    .select()
    .from(transactions)
    .where(eq(transactions.transferPairId, existing.transferPairId));

  const outRow = pair.find((row) => row.type === 'out');
  const inRow = pair.find((row) => row.type === 'in');
  if (!outRow || !inRow) throw new Error('Transfer pair is incomplete');

  let updatedRow: typeof transactions.$inferSelect | undefined;
  await db.transaction(async (tx) => {
    await applyAccountBalanceDelta(tx, outRow.accountId, outRow.amount);
    await applyAccountBalanceDelta(tx, inRow.accountId, -inRow.amount);

    await tx
      .update(transactions)
      .set({
        type: 'out',
        amount: data.amount,
        accountId: data.accountId,
        splitGroupId: null,
        linkedAccountId: data.linkedAccountId,
        loanId: null,
        categoryId: null,
        payee: data.payee ?? null,
        tags: '[]',
        note: data.note ?? null,
        date: data.date,
      })
      .where(eq(transactions.id, outRow.id));

    await tx
      .update(transactions)
      .set({
        type: 'in',
        amount: data.amount,
        accountId: data.linkedAccountId,
        splitGroupId: null,
        linkedAccountId: data.accountId,
        loanId: null,
        categoryId: null,
        payee: data.payee ?? null,
        tags: '[]',
        note: data.note ?? null,
        date: data.date,
      })
      .where(eq(transactions.id, inRow.id));

    await applyAccountBalanceDelta(tx, data.accountId, -data.amount);
    await applyAccountBalanceDelta(tx, data.linkedAccountId!, data.amount);

    const rows = await tx.select().from(transactions).where(eq(transactions.id, id));
    updatedRow = rows[0];
  });

  if (!updatedRow) throw new Error('Updated transfer transaction not found');
  return rowToTransaction(updatedRow);
}

export async function getTransactionsBySplitGroup(splitGroupId: string): Promise<Transaction[]> {
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.splitGroupId, splitGroupId))
    .orderBy(desc(transactions.date), desc(transactions.createdAt));
  return rows.map(rowToTransaction);
}

type SplitGroupItemInput = {
  categoryId: string;
  amount: number;
};

type SplitGroupInput = {
  type: 'in' | 'out';
  accountId: string;
  payee?: string;
  note?: string;
  tags?: string[];
  date: string;
  items: SplitGroupItemInput[];
};

async function normalizeSplitGroupItems(
  type: 'in' | 'out',
  items: SplitGroupItemInput[],
): Promise<SplitGroupItemInput[]> {
  const normalized = items
    .map((item) => ({
      categoryId: item.categoryId,
      amount: Number(item.amount),
    }))
    .filter((item) => item.categoryId && Number.isFinite(item.amount) && item.amount > 0);

  if (normalized.length === 0) {
    throw new Error('Add at least one valid split line item.');
  }

  const categoryIds = Array.from(new Set(normalized.map((item) => item.categoryId)));
  const categoryRows = await db
    .select({ id: categories.id, type: categories.type })
    .from(categories)
    .where(inArray(categories.id, categoryIds));

  if (categoryRows.length !== categoryIds.length) {
    throw new Error('One or more split categories could not be found.');
  }

  const typeById = new Map(categoryRows.map((row) => [row.id, row.type]));
  for (const item of normalized) {
    const categoryType = typeById.get(item.categoryId);
    if (!categoryType || (categoryType !== type && categoryType !== 'both')) {
      throw new Error(`Split items must use valid ${type} categories.`);
    }
  }

  return normalized;
}

export async function createSplitTransactionGroup(data: SplitGroupInput): Promise<Transaction[]> {
  const items = await normalizeSplitGroupItems(data.type, data.items);
  const splitGroupId = generateId();
  const baseCreatedAt = Date.now();
  const rows = items.map((item, index) => {
    const createdAt = new Date(baseCreatedAt + (items.length - index)).toISOString();
    return {
      id: generateId(),
      type: data.type,
      amount: item.amount,
      accountId: data.accountId,
      splitGroupId,
      linkedAccountId: null,
      loanId: null,
      categoryId: item.categoryId,
      payee: data.payee ?? null,
      tags: JSON.stringify(data.tags ?? []),
      note: data.note ?? null,
      date: data.date,
      transferPairId: null,
      createdAt,
    };
  });

  await db.transaction(async (tx) => {
    await tx.insert(transactions).values(rows);
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    await applyAccountBalanceDelta(tx, data.accountId, data.type === 'in' ? total : -total);
  });
  return rows.map(rowToTransaction);
}

export async function updateSplitTransactionGroup(
  splitGroupId: string,
  data: SplitGroupInput
): Promise<Transaction[]> {
  const existing = await getTransactionsBySplitGroup(splitGroupId);
  if (existing.length === 0) throw new Error('Split transaction not found');
  const items = await normalizeSplitGroupItems(data.type, data.items);

  const existingTotal = existing.reduce((sum, tx) => sum + tx.amount, 0);
  const existingAccountId = existing[0].accountId;
  const existingType = existing[0].type;
  const baseCreatedAt = Date.now();

  const rows = items.map((item, index) => {
    const createdAt = new Date(baseCreatedAt + (items.length - index)).toISOString();
    return {
      id: generateId(),
      type: data.type,
      amount: item.amount,
      accountId: data.accountId,
      splitGroupId,
      linkedAccountId: null,
      loanId: null,
      categoryId: item.categoryId,
      payee: data.payee ?? null,
      tags: JSON.stringify(data.tags ?? []),
      note: data.note ?? null,
      date: data.date,
      transferPairId: null,
      createdAt,
    };
  });

  await db.transaction(async (tx) => {
    await applyAccountBalanceDelta(
      tx,
      existingAccountId,
      existingType === 'in' ? -existingTotal : existingTotal,
    );
    await tx.delete(transactions).where(eq(transactions.splitGroupId, splitGroupId));
    await tx.insert(transactions).values(rows);
    const total = items.reduce((sum, item) => sum + item.amount, 0);
    await applyAccountBalanceDelta(tx, data.accountId, data.type === 'in' ? total : -total);
  });
  return rows.map(rowToTransaction);
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

  if (existing.splitGroupId) {
    const group = await getTransactionsBySplitGroup(existing.splitGroupId);
    await db.transaction(async (tx) => {
      for (const item of group) {
        if (item.type === 'in') await applyAccountBalanceDelta(tx, item.accountId, -item.amount);
        else if (item.type === 'out') await applyAccountBalanceDelta(tx, item.accountId, item.amount);
      }
      await tx.delete(transactions).where(eq(transactions.splitGroupId, existing.splitGroupId!));
    });
    return;
  }

  if (existing.transferPairId) {
    const pair = await db
      .select()
      .from(transactions)
      .where(eq(transactions.transferPairId, existing.transferPairId));

    await db.transaction(async (tx) => {
      for (const item of pair) {
        if (item.type === 'in') await applyAccountBalanceDelta(tx, item.accountId, -item.amount);
        else if (item.type === 'out') await applyAccountBalanceDelta(tx, item.accountId, item.amount);
      }

      await tx
        .delete(transactions)
        .where(eq(transactions.transferPairId, existing.transferPairId!));
    });
    return;
  }

  await db.transaction(async (tx) => {
    if (existing.type === 'in') await applyAccountBalanceDelta(tx, existing.accountId, -existing.amount);
    else if (existing.type === 'out') await applyAccountBalanceDelta(tx, existing.accountId, existing.amount);

    await tx.delete(transactions).where(eq(transactions.id, id));
  });
}
