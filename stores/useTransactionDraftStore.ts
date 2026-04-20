import { create } from 'zustand';

interface TransactionDraftStore {
  accountId: string;
  categoryId: string;
  tagIds: string[];
  splitRows: SplitDraftRow[];
  setAccountId: (accountId: string) => void;
  setCategoryId: (categoryId: string) => void;
  setTagIds: (tagIds: string[]) => void;
  setSplitRows: (rows: SplitDraftRow[]) => void;
  updateSplitRow: (id: string, patch: Partial<SplitDraftRow>) => void;
  clearSplitRows: () => void;
  reset: () => void;
}

export interface SplitDraftRow {
  id: string;
  categoryId: string;
  amountStr: string;
}

export const useTransactionDraftStore = create<TransactionDraftStore>((set) => ({
  accountId: '',
  categoryId: '',
  tagIds: [],
  splitRows: [],
  setAccountId: (accountId) => set({ accountId }),
  setCategoryId: (categoryId) => set({ categoryId }),
  setTagIds: (tagIds) => set({ tagIds }),
  setSplitRows: (splitRows) => set({ splitRows }),
  updateSplitRow: (id, patch) =>
    set((state) => ({
      splitRows: state.splitRows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    })),
  clearSplitRows: () => set({ splitRows: [] }),
  reset: () =>
    set({
      accountId: '',
      categoryId: '',
      tagIds: [],
      splitRows: [],
    }),
}));
