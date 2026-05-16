import type { Deposit } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function getDepositReturnAmount(deposit: Deposit): number {
  return Math.max(0, (deposit.maturityValue ?? deposit.principalAmount) - deposit.principalAmount);
}

export function getDepositProgress(deposit: Deposit, now = new Date()) {
  const closed = deposit.status === 'closed';
  if (closed) {
    return { percent: 100, label: 'Closed', isUrgent: false };
  }

  if (!deposit.maturityDate) {
    return { percent: 0, label: 'No maturity date', isUrgent: false };
  }

  const start = new Date(deposit.startDate).getTime();
  const end = new Date(deposit.maturityDate).getTime();
  const current = now.getTime();
  const total = Math.max(1, end - start);
  const percent = Math.max(0, Math.min(100, ((current - start) / total) * 100));
  const daysLeft = Math.ceil((end - current) / DAY_MS);

  if (daysLeft < 0) return { percent: 100, label: 'Matured', isUrgent: true };
  if (daysLeft === 0) return { percent: 100, label: 'Due today', isUrgent: true };
  return {
    percent,
    label: `${daysLeft}d left`,
    isUrgent: daysLeft <= 30,
  };
}
