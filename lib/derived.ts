import type {
  Account,
  CashflowSummary,
  DailySpending,
  DailyCashflow,
  Loan,
  LoanWithSummary,
  PeriodType,
  Transaction,
} from '../types';

export function getTotalBalance(accounts: Account[]): number {
  return accounts.reduce((sum, a) => sum + a.balance, 0);
}

export function getLoanSummary(loans: LoanWithSummary[]): {
  youLent: number;
  youOwe: number;
  net: number;
} {
  let youLent = 0;
  let youOwe = 0;
  for (const loan of loans) {
    if (loan.status !== 'open') continue;
    if (loan.direction === 'lent') youLent += loan.pendingAmount;
    else youOwe += loan.pendingAmount;
  }
  return { youLent, youOwe, net: youLent - youOwe };
}

export function getLoanOutstanding(
  loan: Loan,
  settledAmount: number
): { given: number; settled: number; pending: number; percent: number } {
  const pending = Math.max(0, loan.givenAmount - settledAmount);
  const percent =
    loan.givenAmount > 0 ? Math.round((settledAmount / loan.givenAmount) * 100) : 0;
  return { given: loan.givenAmount, settled: settledAmount, pending, percent };
}

export function getCashflowFromList(transactions: Transaction[]): CashflowSummary {
  let inTotal = 0;
  let outTotal = 0;
  for (const t of transactions) {
    if (t.type === 'in') inTotal += t.amount;
    else if (t.type === 'out') outTotal += t.amount;
  }
  return { in: inTotal, out: outTotal, net: inTotal - outTotal };
}

export function groupTransactionsByDate(
  transactions: Transaction[]
): { dateKey: string; items: Transaction[] }[] {
  const map = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const key = t.date.split('T')[0];
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dateKey, items]) => ({ dateKey, items }));
}

export function formatCurrency(amount: number, symbol: string = '₹'): string {
  const abs = Math.abs(amount);
  const hasFraction = Math.abs(abs - Math.round(abs)) > 0.000001;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(abs);
  return `${symbol}${formatted}`;
}

/** Formats a numeric string with Indian-style commas (##,##,###) */
export function formatIndianNumberStr(val: string): string {
  if (!val) return '';
  const parts = val.split('.');
  const intPart = parts[0].replace(/,/g, '');
  const decPart = parts.length > 1 ? '.' + parts[1] : '';

  const lastThree = intPart.substring(intPart.length - 3);
  const other = intPart.substring(0, intPart.length - 3);
  const formattedInt = other !== ''
    ? other.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
    : lastThree;
  return formattedInt + decPart;
}

/** Strips commas from a formatted numeric string */
export function parseFormattedNumber(val: string): string {
  return val.replace(/,/g, '');
}

export interface SpendingChartPoint {
  label: string;
  amount: number;
}

function toDateKey(isoDate: string): string {
  return isoDate.split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date: Date, yearStart: number): Date {
  const month = date.getMonth();
  const year = month >= yearStart ? date.getFullYear() : date.getFullYear() - 1;
  return new Date(year, yearStart, 1);
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-IN', { month: 'short' });
}

function weekLabel(index: number): string {
  return `W${index + 1}`;
}

function getDaysBetween(from: string, to: string): number {
  const start = new Date(from);
  const end = new Date(to);
  const diff = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export interface CashflowChartPoint {
  label: string;
  in: number;
  out: number;
  net: number;
}

export function buildCashflowChartData(
  period: PeriodType,
  entries: DailyCashflow[],
  from: string,
  to: string,
  yearStart: number = 3
): CashflowChartPoint[] {
  const dailyMap = new Map(entries.map((entry) => [toDateKey(entry.date), { in: entry.in, out: entry.out }]));

  const getDayValues = (key: string) => dailyMap.get(key) ?? { in: 0, out: 0 };

  if (period === 'week') {
    const start = new Date(from);
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(start, index);
      const key = toDateKey(date.toISOString());
      const vals = getDayValues(key);
      return {
        label: date
          .toLocaleDateString('en-IN', { weekday: 'short' })
          .charAt(0)
          .toUpperCase(),
        ...vals,
        net: vals.in - vals.out,
      };
    });
  }

  if (period === 'month') {
    const start = startOfMonth(new Date(from));
    const inBuckets = Array.from({ length: 5 }, () => 0);
    const outBuckets = Array.from({ length: 5 }, () => 0);

    for (let offset = 0; offset < 35; offset += 1) {
      const date = addDays(start, offset);
      if (date > new Date(to)) break;
      const bucketIndex = Math.min(4, Math.floor(date.getDate() / 7));
      const vals = getDayValues(toDateKey(date.toISOString()));
      inBuckets[bucketIndex] += vals.in;
      outBuckets[bucketIndex] += vals.out;
    }
    return inBuckets.map((inVal, index) => ({
      label: weekLabel(index),
      in: inVal,
      out: outBuckets[index],
      net: inVal - outBuckets[index],
    }));
  }

  if (period === 'year') {
    const start = startOfYear(new Date(from), yearStart);
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
      let inVal = 0;
      let outVal = 0;
      const monthStart = startOfMonth(date);
      for (let day = 0; day < 32; day += 1) {
        const current = addDays(monthStart, day);
        if (current.getMonth() !== monthStart.getMonth()) break;
        const vals = getDayValues(toDateKey(current.toISOString()));
        inVal += vals.in;
        outVal += vals.out;
      }
      return {
        label: monthLabel(date),
        in: inVal,
        out: outVal,
        net: inVal - outVal,
      };
    });
  }

  const totalDays = getDaysBetween(from, to) + 1;
  const start = new Date(from);

  if (totalDays <= 14) {
    return Array.from({ length: totalDays }, (_, index) => {
      const date = addDays(start, index);
      const vals = getDayValues(toDateKey(date.toISOString()));
      return {
        label: date
          .toLocaleDateString('en-IN', { weekday: 'short' })
          .charAt(0)
          .toUpperCase(),
        ...vals,
        net: vals.in - vals.out,
      };
    });
  }

  // Generic bucketing for custom range based on totalDays
  const bucketsCount = totalDays <= 60 ? Math.min(5, Math.ceil(totalDays / 7)) : 12;
  const step = totalDays <= 60 ? 7 : 30; // Not exact for months but fallback

  return Array.from({ length: bucketsCount }, (_, index) => {
    let inVal = 0;
    let outVal = 0;
    const bucketStart = addDays(start, index * step);

    for (let i = 0; i < step; i++) {
      const current = addDays(bucketStart, i);
      if (current > new Date(to)) break;
      const vals = getDayValues(toDateKey(current.toISOString()));
      inVal += vals.in;
      outVal += vals.out;
    }

    return {
      label: totalDays <= 60 ? weekLabel(index) : monthLabel(bucketStart),
      in: inVal,
      out: outVal,
      net: inVal - outVal,
    };
  });
}

/** Legacy support for spending chart while we migrate usage */
export function buildSpendingChartData(
  period: PeriodType,
  entries: DailySpending[],
  from: string,
  to: string,
  yearStart: number = 3
): SpendingChartPoint[] {
  const dailyMap = new Map(entries.map((entry) => [toDateKey(entry.date), entry.amount]));

  if (period === 'week') {
    const start = new Date(from);
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(start, index);
      const key = toDateKey(date.toISOString());
      return {
        label: date
          .toLocaleDateString('en-IN', { weekday: 'short' })
          .charAt(0)
          .toUpperCase(),
        amount: dailyMap.get(key) ?? 0,
      };
    });
  }

  if (period === 'month') {
    const start = startOfMonth(new Date(from));
    const buckets = Array.from({ length: 5 }, () => 0);
    for (let offset = 0; offset < 35; offset += 1) {
      const date = addDays(start, offset);
      if (date > new Date(to)) break;
      const bucketIndex = Math.min(4, Math.floor(date.getDate() / 7));
      buckets[bucketIndex] += dailyMap.get(toDateKey(date.toISOString())) ?? 0;
    }
    return buckets.map((amount, index) => ({
      label: weekLabel(index),
      amount,
    }));
  }

  if (period === 'year') {
    const start = startOfYear(new Date(from), yearStart);
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
      let amount = 0;
      const monthStart = startOfMonth(date);
      for (let day = 0; day < 32; day += 1) {
        const current = addDays(monthStart, day);
        if (current.getMonth() !== monthStart.getMonth()) break;
        amount += dailyMap.get(toDateKey(current.toISOString())) ?? 0;
      }
      return {
        label: monthLabel(date),
        amount,
      };
    });
  }

  const totalDays = getDaysBetween(from, to) + 1;
  if (totalDays <= 14) {
    const start = new Date(from);
    return Array.from({ length: totalDays }, (_, index) => {
      const date = addDays(start, index);
      return {
        label: date
          .toLocaleDateString('en-IN', { weekday: 'short' })
          .charAt(0)
          .toUpperCase(),
        amount: dailyMap.get(toDateKey(date.toISOString())) ?? 0,
      };
    });
  }

  if (totalDays <= 60) {
    const start = new Date(from);
    const weeks = Math.min(5, Math.ceil(totalDays / 7));
    return Array.from({ length: weeks }, (_, index) => {
      const bucketStart = addDays(start, index * 7);
      const bucketEnd = addDays(bucketStart, 6);
      let amount = 0;
      for (let day = 0; day < 7; day += 1) {
        const current = addDays(bucketStart, day);
        if (current > new Date(to) || current > bucketEnd) break;
        amount += dailyMap.get(toDateKey(current.toISOString())) ?? 0;
      }
      return {
        label: weekLabel(index),
        amount,
      };
    });
  }

  const start = startOfMonth(new Date(from));
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    let amount = 0;
    const monthStart = startOfMonth(date);
    for (let day = 0; day < 32; day += 1) {
      const current = addDays(monthStart, day);
      if (current.getMonth() !== monthStart.getMonth()) break;
      if (current > new Date(to)) break;
      amount += dailyMap.get(toDateKey(current.toISOString())) ?? 0;
    }
    return {
      label: monthLabel(date),
      amount,
    };
  });
}
