import { create } from 'zustand';

interface BudgetDraftStore {
  categoryId: string;
  setCategoryId: (id: string) => void;
  reset: () => void;
}

export const useBudgetDraftStore = create<BudgetDraftStore>((set) => ({
  categoryId: '',
  setCategoryId: (categoryId) => set({ categoryId }),
  reset: () => set({ categoryId: '' }),
}));
