import { asc, eq, or, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { accounts, transactions } from '../db/schema';
import type { Account, CreateAccountInput } from '../types';
import { generateId } from '../lib/ids';
import { todayUTC } from '../lib/dateUtils';

function rowToAccount(row: typeof accounts.$inferSelect): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Account['type'],
    balance: row.balance,
    currency: row.currency,
    color: row.color,
    icon: row.icon,
    accountNumber: row.accountNumber ?? undefined,
    initialBalance: row.initialBalance,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
  };
}

export async function getAccounts(): Promise<Account[]> {
  const rows = await db.select().from(accounts).orderBy(asc(accounts.sortOrder), asc(accounts.createdAt));
  return rows.map(rowToAccount);
}

export async function getAccountById(id: string): Promise<Account | null> {
  const rows = await db.select().from(accounts).where(eq(accounts.id, id));
  return rows[0] ? rowToAccount(rows[0]) : null;
}

export async function createAccount(data: CreateAccountInput): Promise<Account> {
  const id = generateId();
  const now = todayUTC();
  const [maxRow] = await db.select({ maxSortOrder: sql<number | null>`max(${accounts.sortOrder})` }).from(accounts);
  const row = {
    id,
    name: data.name,
    type: data.type,
    balance: data.balance,
    currency: data.currency ?? 'INR',
    color: data.color,
    icon: data.icon,
    accountNumber: data.accountNumber ?? null,
    initialBalance: data.initialBalance,
    sortOrder: (maxRow?.maxSortOrder ?? -1) + 1,
    createdAt: now,
  };
  await db.insert(accounts).values(row);
  return rowToAccount(row);
}

export async function updateAccount(id: string, data: Partial<Account>): Promise<Account> {
  await db.transaction(async (tx) => {
    const rows = await tx.select().from(accounts).where(eq(accounts.id, id));
    const existing = rows[0];
    if (!existing) throw new Error('Account not found');

    const updateData: Partial<typeof accounts.$inferInsert> = { ...(data as Partial<typeof accounts.$inferInsert>) };

    if (data.initialBalance !== undefined) {
      const delta = data.initialBalance - existing.initialBalance;
      updateData.initialBalance = data.initialBalance;
      updateData.balance = existing.balance + delta;
    } else if (data.balance !== undefined) {
      throw new Error('Direct balance updates are not supported.');
    }

    await tx.update(accounts).set(updateData).where(eq(accounts.id, id));
  });
  return (await getAccountById(id))!;
}

export async function updateAccountBalance(id: string, delta: number): Promise<void> {
  const account = await getAccountById(id);
  if (!account) return;
  await db
    .update(accounts)
    .set({ balance: account.balance + delta })
    .where(eq(accounts.id, id));
}

export async function setAccountOrder(accountIds: string[]): Promise<void> {
  await Promise.all(
    accountIds.map((id, sortOrder) =>
      db.update(accounts).set({ sortOrder }).where(eq(accounts.id, id)),
    ),
  );
}

export async function deleteAccount(id: string): Promise<void> {
  const linked = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(or(eq(transactions.accountId, id), eq(transactions.linkedAccountId, id)))
    .limit(1);

  if (linked.length) {
    throw new Error('Cannot delete account with transactions.');
  }

  await db.delete(accounts).where(eq(accounts.id, id));
}
