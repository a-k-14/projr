import { create } from 'zustand';

interface BudgetDraftStore {
  categoryId: string;
  calculatorValue: string;
  calculatorOpen: boolean;
  setCategoryId: (id: string) => void;
  setCalculatorValue: (value: string) => void;
  setCalculatorOpen: (open: boolean) => void;
  reset: () => void;
}

export const useBudgetDraftStore = create<BudgetDraftStore>((set) => ({
  categoryId: '',
  calculatorValue: '',
  calculatorOpen: false,
  setCategoryId: (categoryId) => set({ categoryId }),
  setCalculatorValue: (calculatorValue) => set({ calculatorValue }),
  setCalculatorOpen: (calculatorOpen) => set({ calculatorOpen }),
  reset: () => set({ categoryId: '', calculatorValue: '', calculatorOpen: false }),
}));
