import { useState } from 'react';
import { FIXED_DEPOSITS, getFixedDepositSummary, type FixedDeposit } from '../lib/fixed-deposits';

/**
 * Placeholder store for fixed deposits — currently backed by a static seed list
 * in `lib/fixed-deposits`. Mirrors the shape of other domain stores so the
 * deposits screen can swap to a real Drizzle-backed store later without churn.
 */
export function useFixedDepositsStore() {
  const [deposits] = useState<FixedDeposit[]>(FIXED_DEPOSITS);
  const summary = getFixedDepositSummary(deposits);

  return {
    deposits,
    totalInvested: summary.totalInvested,
    totalMaturityValue: summary.totalMaturityValue,
    totalInterest: summary.totalInterest,
    refresh: async () => {
      /* placeholder — swap when deposits move to SQLite */
    },
  };
}
