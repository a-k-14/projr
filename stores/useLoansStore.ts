import { create } from 'zustand';
import type { LoanWithSummary, CreateLoanInput, LoanFilters } from '../types';
import * as loansService from '../services/loans';
import { useTransactionsStore } from './useTransactionsStore';

interface LoansStore {
  loans: LoanWithSummary[];
  filters: LoanFilters;
  isLoaded: boolean;
  load: (filters?: LoanFilters) => Promise<void>;
  reset: () => void;
  add: (data: CreateLoanInput) => Promise<void>;
  addPrincipal: (loanId: string, amount: number, accountId: string, date: string, note?: string) => Promise<void>;
  update: (id: string, data: Partial<LoanWithSummary>) => Promise<void>;
  updateOrigin: (id: string, data: Partial<CreateLoanInput>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setFilters: (filters: LoanFilters) => void;
  getById: (id: string) => LoanWithSummary | undefined;
}

export const useLoansStore = create<LoansStore>((set, get) => ({
  loans: [],
  filters: {},
  isLoaded: false,

  load: async (filters) => {
    const f = { ...get().filters, ...filters };
    const loans = await loansService.getLoans(f);

    let needsRefetch = false;
    for (const loan of loans) {
      if (loan.pendingAmount <= 0 && loan.status === 'open') {
        await loansService.updateLoan(loan.id, { status: 'closed' });
        needsRefetch = true;
      }
    }

    if (needsRefetch) {
      const finalLoans = await loansService.getLoans(f);
      set({ loans: finalLoans, filters: f, isLoaded: true });
    } else {
      set({ loans, filters: f, isLoaded: true });
    }
  },

  reset: () => {
    set({ loans: [], filters: {}, isLoaded: false });
  },

  add: async (data) => {
    await loansService.createLoan(data);
    await get().load(get().filters);
    await useTransactionsStore.getState().load();
  },

  addPrincipal: async (loanId, amount, accountId, date, note) => {
    await loansService.addLoanPrincipal(loanId, amount, accountId, date, note);
    await get().load(get().filters);
    await useTransactionsStore.getState().load();
  },

  update: async (id, data) => {
    await loansService.updateLoan(id, data);
    await get().load(get().filters);
    await useTransactionsStore.getState().load();
  },

  updateOrigin: async (id, data) => {
    await loansService.updateLoanOrigin(id, data);
    await get().load(get().filters);
    await useTransactionsStore.getState().load();
  },

  remove: async (id) => {
    await loansService.deleteLoanCascade(id);
    await get().load(get().filters);
    await useTransactionsStore.getState().load();
  },

  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),

  getById: (id) => get().loans.find((l) => l.id === id),
}));
