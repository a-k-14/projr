import type { CashflowSummary, Transaction } from '../types';
import { getCashflowFromList } from './derived';

export type ActivityDrilldownLike = {
  subKey: string;
} | null;

export function getActivityDrilldownTransactions(
  filteredTransactions: Transaction[],
  categoryDrilldown: ActivityDrilldownLike,
): Transaction[] {
  if (!categoryDrilldown) return filteredTransactions;
  return filteredTransactions.filter((tx) => {
    if (!tx.categoryId) {
      if (categoryDrilldown.subKey === 'type:transfer') return !!tx.transferPairId || tx.type === 'transfer';
      if (categoryDrilldown.subKey === 'type:loan') return tx.type === 'loan';
      return categoryDrilldown.subKey === `type:${tx.type}`;
    }
    return tx.categoryId === categoryDrilldown.subKey;
  });
}

export function getActivityDisplayedCashflow(
  filteredTransactions: Transaction[],
  categoryDrilldown: ActivityDrilldownLike,
  includeTransfers = false,
): CashflowSummary {
  return getCashflowFromList(getActivityDrilldownTransactions(filteredTransactions, categoryDrilldown), includeTransfers);
}
