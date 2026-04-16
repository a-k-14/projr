import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '../db/client';
import { transactions } from '../db/schema';
import { getTransactionCashflowImpact } from '../lib/derived';
import type { CashflowSummary, DailySpending, CategoryBreakdown, DailyCashflow } from '../types';
import { getCategories } from './categories';

export async function getCashflowSummary(
  accountId: string | 'all',
  fromDate: string,
  toDate: string
): Promise<CashflowSummary> {
  const snapshot = await getCashflowSnapshot(accountId, fromDate, toDate);
  return snapshot.summary;
}

export async function getCashflowSnapshot(
  accountId: string | 'all',
  fromDate: string,
  toDate: string
): Promise<{ summary: CashflowSummary; daily: DailyCashflow[] }> {
  const conditions: ReturnType<typeof eq>[] = [
    gte(transactions.date, fromDate),
    lte(transactions.date, toDate),
  ];
  if (accountId !== 'all') conditions.push(eq(transactions.accountId, accountId));

  const rows = await db.select().from(transactions).where(and(...conditions));

  let inTotal = 0,
    outTotal = 0;
  const byDate: Record<string, { in: number; out: number }> = {};
  for (const row of rows) {
    const dateKey = row.date.split('T')[0];
    if (!byDate[dateKey]) byDate[dateKey] = { in: 0, out: 0 };
    const impact = getTransactionCashflowImpact(row);
    if (impact === 'in') {
      inTotal += row.amount;
      byDate[dateKey].in += row.amount;
    } else if (impact === 'out') {
      outTotal += row.amount;
      byDate[dateKey].out += row.amount;
    }
  }
  return {
    summary: { in: inTotal, out: outTotal, net: inTotal - outTotal },
    daily: Object.entries(byDate)
      .map(([date, totals]) => ({ date, ...totals }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
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
  const snapshot = await getCashflowSnapshot(accountId, fromDate, toDate);
  return snapshot.daily;
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
