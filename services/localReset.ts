import { clearLocalData } from './settings';
import { useAccountsStore } from '../stores/useAccountsStore';
import { useBudgetDraftStore } from '../stores/useBudgetDraftStore';
import { useBudgetStore } from '../stores/useBudgetStore';
import { useCategoriesStore } from '../stores/useCategoriesStore';
import { useLoansStore } from '../stores/useLoansStore';
import { useTransactionDraftStore } from '../stores/useTransactionDraftStore';
import { useTransactionsStore } from '../stores/useTransactionsStore';
import { useUIStore } from '../stores/useUIStore';
import { deleteAllReceipts } from './receiptStorage';

export function resetInMemoryStores(): void {
  useTransactionsStore.getState().reset();
  useTransactionDraftStore.getState().reset();
  useAccountsStore.getState().reset();
  useCategoriesStore.getState().reset();
  useLoansStore.getState().reset();
  useBudgetStore.getState().reset();
  useBudgetDraftStore.getState().reset();
  useUIStore.getState().reset();
}

export async function resetLocalAppData(): Promise<void> {
  await clearLocalData();
  await deleteAllReceipts();
  resetInMemoryStores();
}
