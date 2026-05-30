import { create } from 'zustand';
import type { BudgetWithSpent, CreateBudgetInput } from '../types';
import * as budgetService from '../services/budget';
import { useGlobalNotice } from './useGlobalNotice';

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
    // Optimistic: drop the budget from the in-memory list so the card vanishes
    // and the detail screen's auto-pop fires in the same paint. DB delete +
    // month reconcile run in the background; on failure we restore + notice.
    const snapshot = get().budgets;
    set({ budgets: snapshot.filter((b) => b.id !== id) });
    try {
      await budgetService.deleteBudget(id);
      get().load(selectedMonthIso).catch(() => undefined);
    } catch (error) {
      set({ budgets: snapshot });
      useGlobalNotice.getState().show('Error in deleting the budget. Please try again.');
      throw error;
    }
  },
}));
