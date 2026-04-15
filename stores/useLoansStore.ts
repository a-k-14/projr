import { create } from 'zustand';
import type { LoanWithSummary, CreateLoanInput, LoanFilters } from '../types';
import * as loansService from '../services/loans';
import { useTransactionsStore } from './useTransactionsStore';

interface LoansStore {
  loans: LoanWithSummary[];
  filters: LoanFilters;
  isLoaded: boolean;
  load: (filters?: LoanFilters) => Promise<void>;
  add: (data: CreateLoanInput) => Promise<void>;
  update: (id: string, data: Partial<LoanWithSummary>) => Promise<void>;
  updateOrigin: (id: string, data: Partial<CreateLoanInput>) => Promise<void>;
  recordPayment: (loanId: string, amount: number, date: string) => Promise<void>;
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
    set({ loans, filters: f, isLoaded: true });
  },

  add: async (data) => {
    await loansService.createLoan(data);
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

  recordPayment: async (loanId, amount, date) => {
    await loansService.recordLoanPayment(loanId, amount, date);
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
