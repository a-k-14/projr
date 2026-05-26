import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '../db/client';
import { transactions, accounts as accountsTable } from '../db/schema';
import { getTransactionCashflowImpact } from '../lib/derived';
import { toLocalDateKey, toLocalDayEndISO } from '../lib/dateUtils';
import type { CashflowSummary, CategoryBreakdown, DailyCashflow } from '../types';
import { getCategories } from './categories';
import type { TimeBucket, BucketType } from '../lib/chartUtils';

function safeLocalDateKey(value: string | null | undefined): string {
  if (!value) return '';
  try {
    return toLocalDateKey(value);
  } catch {
    return value.split?.('T')?.[0] ?? value;
  }
}

async function getTransactionsInRange(
  accountId: string | 'all',
  fromDate: string,
  toDate: string,
) {
  const conditions: ReturnType<typeof eq>[] = [
    gte(transactions.date, fromDate),
    lte(transactions.date, toDate),
  ];
  if (accountId !== 'all') conditions.push(eq(transactions.accountId, accountId));
  return db.select().from(transactions).where(and(...conditions));
}

export async function getCashflowSummary(
  accountId: string | 'all',
  fromDate: string,
  toDate: string
): Promise<CashflowSummary> {
  const snapshot = await getCashflowSnapshot(accountId, fromDate, toDate);
  return snapshot.summary;
}

/**
 * Fetch a full (unpaginated) cashflow summary for an account+date range.
 * Unlike getCashflowSnapshot, this accepts includeTransfers/includeLoans flags
 * to match the activity screen's cashflow mode setting.
 */
export async function getActivityPeriodCashflow(
  accountId: string | 'all',
  fromDate: string,
  toDate: string,
  options: { includeTransfers?: boolean; includeLoans?: boolean; includeDeposits?: boolean } = {}
): Promise<CashflowSummary> {
  const rows = await getTransactionsInRange(accountId, fromDate, toDate);
  let inTotal = 0, outTotal = 0;
  const includeTransfers = options.includeTransfers ?? false;
  const includeLoans = options.includeLoans ?? false;
  const includeDeposits = options.includeDeposits ?? (includeTransfers || includeLoans);
  for (const row of rows) {
    const impact = getTransactionCashflowImpact(row, {
      includeTransfers,
      includeLoans,
      includeDeposits,
    });
    if (impact === 'in') inTotal += row.amount;
    else if (impact === 'out') outTotal += row.amount;
  }
  return { in: inTotal, out: outTotal, net: inTotal - outTotal };
}

export async function getCashflowSnapshot(
  accountId: string | 'all',
  fromDate: string,
  toDate: string,
  options?: { includeTransfers?: boolean; includeLoans?: boolean; includeDeposits?: boolean }
): Promise<{ summary: CashflowSummary; daily: DailyCashflow[] }> {
  const rows = await getTransactionsInRange(accountId, fromDate, toDate);
  const includeTransfers = options?.includeTransfers ?? false;
  const includeLoans = options?.includeLoans ?? false;
  const includeDeposits = options?.includeDeposits ?? true;

  let inTotal = 0,
    outTotal = 0;
  const byDate: Record<string, { in: number; out: number }> = {};
  for (const row of rows) {
    const dateKey = safeLocalDateKey(row.date);
    if (!dateKey) continue;
    if (!byDate[dateKey]) byDate[dateKey] = { in: 0, out: 0 };
    const impact = getTransactionCashflowImpact(row, { includeTransfers, includeLoans, includeDeposits });
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

export async function getDailyCashflow(
  accountId: string | 'all',
  fromDate: string,
  toDate: string
): Promise<DailyCashflow[]> {
  const snapshot = await getCashflowSnapshot(accountId, fromDate, toDate);
  return snapshot.daily;
}

export async function getBalanceTrend(
  fromDate: string,
  toDate: string,
): Promise<{ date: string; balance: number }[]> {
  // 1. Current total balance across all accounts
  const accountRows = await db.select({ balance: accountsTable.balance }).from(accountsTable);
  const currentBalance = accountRows.reduce((sum, r) => sum + r.balance, 0);

  // 2. All transactions from fromDate to end of today (to reverse back to fromDate)
  const todayEnd = toLocalDayEndISO(new Date());
  const rows = await getTransactionsInRange('all', fromDate, todayEnd);

  if (rows.length === 0 && currentBalance === 0) return [];

  // 3. Build delta map: day -> net cashflow impact
  const deltaByDay = new Map<string, number>();
  for (const row of rows) {
    const dayKey = safeLocalDateKey(row.date);
    if (!dayKey) continue;
    const impact = getTransactionCashflowImpact(row, { includeLoans: true, includeTransfers: false, includeDeposits: true });
    const delta = impact === 'in' ? row.amount : impact === 'out' ? -row.amount : 0;
    if (delta !== 0) {
      deltaByDay.set(dayKey, (deltaByDay.get(dayKey) ?? 0) + delta);
    }
  }

  // 4. Build all days in [fromDate..toDate]
  const fromDateKey = toLocalDateKey(fromDate);
  const toDateKey2 = toLocalDateKey(toDate);
  const days: string[] = [];
  const cur = new Date(
    ...([...fromDateKey.split('-').map(Number)] as [number, number, number]).map((v, i) =>
      i === 1 ? v - 1 : v
    ) as [number, number, number],
    12, 0, 0,
  );
  while (true) {
    const key = `${cur.getFullYear()}-${(cur.getMonth() + 1).toString().padStart(2, '0')}-${cur.getDate().toString().padStart(2, '0')}`;
    days.push(key);
    if (key >= toDateKey2) break;
    cur.setDate(cur.getDate() + 1);
  }

  // 5. endBalance = currentBalance minus all deltas AFTER toDate
  let endBalance = currentBalance;
  for (const [day, delta] of deltaByDay.entries()) {
    if (day > toDateKey2) {
      endBalance -= delta;
    }
  }

  // 6. Walk backwards from end to start
  const result: { date: string; balance: number }[] = new Array(days.length);
  let bal = endBalance;
  for (let i = days.length - 1; i >= 0; i--) {
    result[i] = { date: days[i], balance: bal };
    bal -= deltaByDay.get(days[i]) ?? 0;
  }

  return result;
}

export async function getAccountBalanceTrend(
  accountId: string,
  fromDate: string,
  toDate: string,
): Promise<{ date: string; balance: number }[]> {
  // 1. Current balance of this specific account
  const accountRows = await db.select({ balance: accountsTable.balance })
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
    .limit(1);
  const currentBalance = accountRows[0]?.balance ?? 0;

  // 2. Transactions of this account from fromDate to end of today (to reverse back)
  const todayEnd = toLocalDayEndISO(new Date());
  const rows = await getTransactionsInRange(accountId, fromDate, todayEnd);

  if (rows.length === 0 && currentBalance === 0) return [];

  // 3. Build delta map: day -> net cashflow impact
  const deltaByDay = new Map<string, number>();
  for (const row of rows) {
    const dayKey = safeLocalDateKey(row.date);
    if (!dayKey) continue;
    // For single account, transfers directly alter the balance, so include them!
    const impact = getTransactionCashflowImpact(row, {
      includeLoans: true,
      includeTransfers: true,
      includeDeposits: true,
    });
    const delta = impact === 'in' ? row.amount : impact === 'out' ? -row.amount : 0;
    if (delta !== 0) {
      deltaByDay.set(dayKey, (deltaByDay.get(dayKey) ?? 0) + delta);
    }
  }

  // 4. Build all days in [fromDate..toDate]
  const fromDateKey = toLocalDateKey(fromDate);
  const toDateKey2 = toLocalDateKey(toDate);
  const days: string[] = [];
  const cur = new Date(
    ...([...fromDateKey.split('-').map(Number)] as [number, number, number]).map((v, i) =>
      i === 1 ? v - 1 : v
    ) as [number, number, number],
    12, 0, 0,
  );
  while (true) {
    const key = `${cur.getFullYear()}-${(cur.getMonth() + 1).toString().padStart(2, '0')}-${cur.getDate().toString().padStart(2, '0')}`;
    days.push(key);
    if (key >= toDateKey2) break;
    cur.setDate(cur.getDate() + 1);
  }

  // 5. endBalance = currentBalance minus all deltas AFTER toDate
  let endBalance = currentBalance;
  for (const [day, delta] of deltaByDay.entries()) {
    if (day > toDateKey2) {
      endBalance -= delta;
    }
  }

  // 6. Walk backwards from end to start
  const result: { date: string; balance: number }[] = new Array(days.length);
  let bal = endBalance;
  for (let i = days.length - 1; i >= 0; i--) {
    result[i] = { date: days[i], balance: bal };
    bal -= deltaByDay.get(days[i]) ?? 0;
  }

  return result;
}


export type IncomeExpenseBucket = { label: string; income: number; expense: number; from: string; to: string; type: BucketType };

export async function getIncomeExpenseByBuckets(
  buckets: TimeBucket[],
  fromDate: string,
  toDate: string,
): Promise<IncomeExpenseBucket[]> {
  const rows = await getTransactionsInRange('all', fromDate, toDate);

  return buckets.map((bucket) => {
    const bucketFrom = toLocalDateKey(bucket.from);
    const bucketTo = toLocalDateKey(bucket.to);
    let income = 0;
    let expense = 0;
    for (const row of rows) {
      const dayKey = safeLocalDateKey(row.date);
      if (!dayKey || dayKey < bucketFrom || dayKey > bucketTo) continue;
      const impact = getTransactionCashflowImpact(row, { includeLoans: false, includeTransfers: false, includeDeposits: false });
      if (impact === 'in') income += row.amount;
      else if (impact === 'out') expense += row.amount;
    }
    return { label: bucket.label, income, expense, from: bucket.from, to: bucket.to, type: bucket.type };
  });
}

export async function getCategoryBreakdown(
  accountId: string | 'all',
  fromDate: string,
  toDate: string
): Promise<CategoryBreakdown[]> {
  const rows = await getTransactionsInRange(accountId, fromDate, toDate);
  const allCategories = await getCategories();
  const catMap = Object.fromEntries(allCategories.map((c) => [c.id, c]));

  const byCat: Record<string, number> = {};
  for (const row of rows) {
    if (getTransactionCashflowImpact(row, { includeTransfers: false, includeLoans: false, includeDeposits: false }) !== 'out') continue;
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
