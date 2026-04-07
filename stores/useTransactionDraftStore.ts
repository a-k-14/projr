import { create } from 'zustand';

interface TransactionDraftStore {
  accountId: string;
  categoryId: string;
  tagIds: string[];
  setAccountId: (accountId: string) => void;
  setCategoryId: (categoryId: string) => void;
  setTagIds: (tagIds: string[]) => void;
}

export const useTransactionDraftStore = create<TransactionDraftStore>((set) => ({
  accountId: '',
  categoryId: '',
  tagIds: [],
  setAccountId: (accountId) => set({ accountId }),
  setCategoryId: (categoryId) => set({ categoryId }),
  setTagIds: (tagIds) => set({ tagIds }),
}));
