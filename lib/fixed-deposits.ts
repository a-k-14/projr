import type { Deposit } from '../types';

/**
 * Time-prorated current value of a single deposit. For active deposits we
 * accrue interest linearly between startDate and maturityDate (linear is a
 * good-enough approximation for display; exact quarterly compounding only
 * matters at maturity). For closed deposits we use the realised value.
 */
export function getDepositAccruedValue(deposit: Deposit, now: Date = new Date()): number {
  const principal = deposit.principalAmount;
  const final = deposit.maturityValue ?? principal;
  if (final <= principal) return principal;
  if (!deposit.maturityDate) return principal;

  const start = new Date(deposit.startDate).getTime();
  const end = new Date(deposit.maturityDate).getTime();
  const today = now.getTime();
  if (end <= start) return final;
  if (today <= start) return principal;
  if (today >= end) return final;
  const fraction = (today - start) / (end - start);
  return principal + (final - principal) * fraction;
}

export function getFixedDepositSummary(deposits: Deposit[]) {
  const totalInvested = deposits.reduce((sum, d) => sum + d.principalAmount, 0);
  const totalMaturityValue = deposits.reduce(
    (sum, d) => sum + (d.maturityValue ?? d.principalAmount),
    0,
  );
  // For net-worth purposes: prorated value of active deposits today.
  const activeMaturityValue = deposits
    .filter((d) => d.status === 'active')
    .reduce((sum, d) => sum + getDepositAccruedValue(d), 0);

  const activeInvestedValue = deposits
    .filter((d) => d.status === 'active')
    .reduce((sum, d) => sum + d.principalAmount, 0);

  return {
    deposits,
    totalInvested,
    totalMaturityValue,
    activeMaturityValue,
    activeInvestedValue,
    totalInterest: totalMaturityValue - totalInvested,
  };
}
