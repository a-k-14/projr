import { create } from 'zustand';
import type { LoanWithSummary, CreateLoanInput, LoanFilters } from '../types';
import * as loansService from '../services/loans';

interface LoansStore {
  loans: LoanWithSummary[];
  filters: LoanFilters;
  isLoaded: boolean;
  load: (filters?: LoanFilters) => Promise<void>;
  add: (data: CreateLoanInput) => Promise<void>;
  update: (id: string, data: Partial<LoanWithSummary>) => Promise<void>;
  recordPayment: (loanId: string, amount: number, date: string) => Promise<void>;
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
    set({ loans, filters: f, isLoaded: true });
  },

  add: async (data) => {
    await loansService.createLoan(data);
    await get().load(get().filters);
  },

  update: async (id, data) => {
    await loansService.updateLoan(id, data);
    await get().load(get().filters);
  },

  recordPayment: async (loanId, amount, date) => {
    await loansService.recordLoanPayment(loanId, amount, date);
    await get().load(get().filters);
  },

  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),

  getById: (id) => get().loans.find((l) => l.id === id),
}));
