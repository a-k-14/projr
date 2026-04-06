import { create } from 'zustand';
import type { BudgetWithSpent, CreateBudgetInput } from '../types';
import * as budgetsService from '../services/budgets';

interface BudgetsStore {
  budgets: BudgetWithSpent[];
  isLoaded: boolean;
  load: (yearStart?: number) => Promise<void>;
  add: (data: CreateBudgetInput, yearStart?: number) => Promise<void>;
  update: (id: string, data: Partial<BudgetWithSpent>, yearStart?: number) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useBudgetsStore = create<BudgetsStore>((set, get) => ({
  budgets: [],
  isLoaded: false,

  load: async (yearStart = 3) => {
    const budgets = await budgetsService.getBudgetsWithSpent(yearStart);
    set({ budgets, isLoaded: true });
  },

  add: async (data, yearStart = 3) => {
    await budgetsService.createBudget(data);
    await get().load(yearStart);
  },

  update: async (id, data, yearStart = 3) => {
    await budgetsService.updateBudget(id, data as any);
    await get().load(yearStart);
  },

  remove: async (id) => {
    await budgetsService.deleteBudget(id);
    set((state) => ({ budgets: state.budgets.filter((b) => b.id !== id) }));
  },
}));
