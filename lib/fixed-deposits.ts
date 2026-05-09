export interface FixedDeposit {
  id: string;
  name: string;
  bankName: string;
  principalAmount: number;
  interestRate: number;
  startDate: string;
  maturityDate: string;
  tenureMonths: number;
  maturityValue: number;
  status: 'active' | 'matured' | 'closed';
}

// Placeholder data until fixed deposits move to a real store.
export const FIXED_DEPOSITS: FixedDeposit[] = [
  {
    id: '1',
    name: 'Emergency Fund FD',
    bankName: 'HDFC Bank',
    principalAmount: 100000,
    interestRate: 7.5,
    startDate: '2025-01-15',
    maturityDate: '2026-01-15',
    tenureMonths: 12,
    maturityValue: 107500,
    status: 'active',
  },
  {
    id: '2',
    name: 'Tax Saver FD',
    bankName: 'SBI',
    principalAmount: 150000,
    interestRate: 6.8,
    startDate: '2024-04-01',
    maturityDate: '2029-04-01',
    tenureMonths: 60,
    maturityValue: 210000,
    status: 'active',
  },
];

export function getFixedDepositSummary(deposits = FIXED_DEPOSITS) {
  const totalInvested = deposits.reduce((sum, deposit) => sum + deposit.principalAmount, 0);
  const totalMaturityValue = deposits.reduce((sum, deposit) => sum + deposit.maturityValue, 0);
  const activeMaturityValue = deposits
    .filter((deposit) => deposit.status === 'active')
    .reduce((sum, deposit) => sum + deposit.maturityValue, 0);

  return {
    deposits,
    totalInvested,
    totalMaturityValue,
    activeMaturityValue,
    totalInterest: totalMaturityValue - totalInvested,
  };
}
