import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '../db/client';
import { transactions } from '../db/schema';
import type { CashflowSummary, DailySpending, CategoryBreakdown, DailyCashflow } from '../types';
import { getCategories } from './categories';

export async function getCashflowSummary(
  accountId: string | 'all',
  fromDate: string,
  toDate: string
): Promise<CashflowSummary> {
  const conditions: ReturnType<typeof eq>[] = [
    gte(transactions.date, fromDate),
    lte(transactions.date, toDate),
  ];
  if (accountId !== 'all') conditions.push(eq(transactions.accountId, accountId));

  const rows = await db.select().from(transactions).where(and(...conditions));

  let inTotal = 0,
    outTotal = 0;
  for (const row of rows) {
    if (row.type === 'in') inTotal += row.amount;
    else if (row.type === 'out') outTotal += row.amount;
  }
  return { in: inTotal, out: outTotal, net: inTotal - outTotal };
}

export async function getDailySpending(
  accountId: string | 'all',
  fromDate: string,
  toDate: string
): Promise<DailySpending[]> {
  const conditions: ReturnType<typeof eq>[] = [
    gte(transactions.date, fromDate),
    lte(transactions.date, toDate),
    eq(transactions.type, 'out'),
  ];
  if (accountId !== 'all') conditions.push(eq(transactions.accountId, accountId));

  const rows = await db.select().from(transactions).where(and(...conditions));

  const byDate: Record<string, number> = {};
  for (const row of rows) {
    const dateKey = row.date.split('T')[0];
    byDate[dateKey] = (byDate[dateKey] ?? 0) + row.amount;
  }

  return Object.entries(byDate)
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getDailyCashflow(
  accountId: string | 'all',
  fromDate: string,
  toDate: string
): Promise<DailyCashflow[]> {
  const conditions: ReturnType<typeof eq>[] = [
    gte(transactions.date, fromDate),
    lte(transactions.date, toDate),
  ];
  if (accountId !== 'all') conditions.push(eq(transactions.accountId, accountId));

  const rows = await db.select().from(transactions).where(and(...conditions));

  const byDate: Record<string, { in: number; out: number }> = {};
  for (const row of rows) {
    const dateKey = row.date.split('T')[0];
    if (!byDate[dateKey]) byDate[dateKey] = { in: 0, out: 0 };
    if (row.type === 'in') byDate[dateKey].in += row.amount;
    else if (row.type === 'out') byDate[dateKey].out += row.amount;
  }

  // Ensure all dates in range are represented? (Actually chart builder does that)
  return Object.entries(byDate)
    .map(([date, totals]) => ({ date, ...totals }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getCategoryBreakdown(
  accountId: string | 'all',
  fromDate: string,
  toDate: string
): Promise<CategoryBreakdown[]> {
  const conditions: ReturnType<typeof eq>[] = [
    gte(transactions.date, fromDate),
    lte(transactions.date, toDate),
    eq(transactions.type, 'out'),
  ];
  if (accountId !== 'all') conditions.push(eq(transactions.accountId, accountId));

  const rows = await db.select().from(transactions).where(and(...conditions));
  const allCategories = await getCategories();
  const catMap = Object.fromEntries(allCategories.map((c) => [c.id, c]));

  const byCat: Record<string, number> = {};
  for (const row of rows) {
    const splits = (() => {
      try {
        const parsed = JSON.parse((row as any).splitData ?? '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();

    if (splits.length > 0) {
      for (const split of splits) {
        if (!split?.categoryId || !split?.amount) continue;
        byCat[split.categoryId] = (byCat[split.categoryId] ?? 0) + Number(split.amount);
      }
      continue;
    }

    if (!row.categoryId) continue;
    byCat[row.categoryId] = (byCat[row.categoryId] ?? 0) + row.amount;
  }

  const total = Object.values(byCat).reduce((a, b) => a + b, 0);
  return Object.entries(byCat)
    .map(([categoryId, catTotal]) => ({
      categoryId,
      categoryName: catMap[categoryId]?.name ?? 'Unknown',
      total: catTotal,
      percent: total > 0 ? Math.round((catTotal / total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}
