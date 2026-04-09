import { create } from 'zustand';

interface TransactionDraftStore {
  accountId: string;
  categoryId: string;
  tagIds: string[];
  calculatorValue: string;
  calculatorOpen: boolean;
  setAccountId: (accountId: string) => void;
  setCategoryId: (categoryId: string) => void;
  setTagIds: (tagIds: string[]) => void;
  setCalculatorValue: (value: string) => void;
  setCalculatorOpen: (open: boolean) => void;
}

export const useTransactionDraftStore = create<TransactionDraftStore>((set) => ({
  accountId: '',
  categoryId: '',
  tagIds: [],
  calculatorValue: '',
  calculatorOpen: false,
  setAccountId: (accountId) => set({ accountId }),
  setCategoryId: (categoryId) => set({ categoryId }),
  setTagIds: (tagIds) => set({ tagIds }),
  setCalculatorValue: (calculatorValue) => set({ calculatorValue }),
  setCalculatorOpen: (calculatorOpen) => set({ calculatorOpen }),
}));
