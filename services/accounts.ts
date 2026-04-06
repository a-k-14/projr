import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { accounts } from '../db/schema';
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
    createdAt: row.createdAt,
  };
}

export async function getAccounts(): Promise<Account[]> {
  const rows = await db.select().from(accounts).orderBy(accounts.createdAt);
  return rows.map(rowToAccount);
}

export async function getAccountById(id: string): Promise<Account | null> {
  const rows = await db.select().from(accounts).where(eq(accounts.id, id));
  return rows[0] ? rowToAccount(rows[0]) : null;
}

export async function createAccount(data: CreateAccountInput): Promise<Account> {
  const id = generateId();
  const now = todayUTC();
  const row = {
    id,
    name: data.name,
    type: data.type,
    balance: data.balance,
    currency: data.currency ?? 'INR',
    color: data.color,
    icon: data.icon,
    createdAt: now,
  };
  await db.insert(accounts).values(row);
  return rowToAccount(row);
}

export async function updateAccount(id: string, data: Partial<Account>): Promise<Account> {
  await db.update(accounts).set(data as any).where(eq(accounts.id, id));
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

export async function deleteAccount(id: string): Promise<void> {
  await db.delete(accounts).where(eq(accounts.id, id));
}
