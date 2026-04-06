import type { Account, Loan, LoanWithSummary, Transaction, CashflowSummary } from '../types';

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
  const formatted = new Intl.NumberFormat('en-IN').format(abs);
  return `${symbol}${formatted}`;
}
