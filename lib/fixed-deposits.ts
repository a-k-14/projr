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

export const FIXED_DEPOSITS: FixedDeposit[] = [];

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
