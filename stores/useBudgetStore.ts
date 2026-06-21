import { create } from 'zustand';
import type { BudgetWithSpent, CreateBudgetInput } from '../types';
import * as budgetService from '../services/budget';

interface BudgetStore {
  budgets: BudgetWithSpent[];
  isLoaded: boolean;
  load: (selectedMonthIso?: string) => Promise<void>;
  reset: () => void;
  add: (data: CreateBudgetInput, selectedMonthIso?: string) => Promise<void>;
  update: (id: string, data: Partial<BudgetWithSpent>, selectedMonthIso?: string) => Promise<void>;
  remove: (id: string, selectedMonthIso?: string) => Promise<void>;
}

export const useBudgetStore = create<BudgetStore>((set, get) => ({
  budgets: [],
  isLoaded: false,

  load: async (selectedMonthIso) => {
    const budgets = await budgetService.getBudgetWithSpent(selectedMonthIso);
    set({ budgets, isLoaded: true });
  },

  reset: () => {
    set({ budgets: [], isLoaded: false });
  },

  add: async (data, selectedMonthIso) => {
    await budgetService.createBudget(data);
    await get().load(selectedMonthIso);
  },

  update: async (id, data, selectedMonthIso) => {
    await budgetService.updateBudget(id, data as any);
    await get().load(selectedMonthIso);
  },

  remove: async (id, selectedMonthIso) => {
    await budgetService.deleteBudget(id);
    await get().load(selectedMonthIso);
  },
}));
