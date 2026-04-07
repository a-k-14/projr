import { create } from 'zustand';
import type { BudgetWithSpent, CreateBudgetInput } from '../types';
import * as budgetService from '../services/budget';

interface BudgetStore {
  budgets: BudgetWithSpent[];
  isLoaded: boolean;
  load: (yearStart?: number) => Promise<void>;
  add: (data: CreateBudgetInput, yearStart?: number) => Promise<void>;
  update: (id: string, data: Partial<BudgetWithSpent>, yearStart?: number) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useBudgetStore = create<BudgetStore>((set, get) => ({
  budgets: [],
  isLoaded: false,

  load: async (yearStart = 3) => {
    const budgets = await budgetService.getBudgetWithSpent(yearStart);
    set({ budgets, isLoaded: true });
  },

  add: async (data, yearStart = 3) => {
    await budgetService.createBudget(data);
    await get().load(yearStart);
  },

  update: async (id, data, yearStart = 3) => {
    await budgetService.updateBudget(id, data as any);
    await get().load(yearStart);
  },

  remove: async (id) => {
    await budgetService.deleteBudget(id);
    set((state) => ({ budgets: state.budgets.filter((b) => b.id !== id) }));
  },
}));
