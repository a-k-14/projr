import { create } from 'zustand';
import type { LoanWithSummary, CreateLoanInput, LoanFilters } from '../types';
import * as loansService from '../services/loans';
import { usePersonsStore } from './usePersonsStore';
import { useTransactionsStore } from './useTransactionsStore';
import { useGlobalNotice } from './useGlobalNotice';

interface LoansStore {
  loans: LoanWithSummary[];
  filters: LoanFilters;
  isLoaded: boolean;
  load: (filters?: LoanFilters) => Promise<void>;
  reset: () => void;
  add: (data: CreateLoanInput) => Promise<void>;
  addPrincipal: (loanId: string, amount: number, accountId: string, date: string, note?: string) => Promise<void>;
  update: (id: string, data: Partial<LoanWithSummary>) => Promise<void>;
  updateOrigin: (id: string, data: Partial<CreateLoanInput>, originTransactionId?: string) => Promise<void>;
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
    // Loan list + hero are now up to date; reload the (invisible-from-here)
    // transaction list and persons cache in the background so callers can
    // navigate back to the loans screen without waiting on them.
    useTransactionsStore.getState().load().catch(() => undefined);
    usePersonsStore.getState().load().catch(() => undefined);
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

  updateOrigin: async (id, data, originTransactionId) => {
    await loansService.updateLoanOrigin(id, data, originTransactionId);
    await get().load(get().filters);
    await useTransactionsStore.getState().load();
    if (data.personName) usePersonsStore.getState().load().catch(() => undefined);
  },

  remove: async (id) => {
    // Optimistic: drop the loan from the in-memory list immediately so the card
    // disappears and the hero (derived from `loans`) updates in the same paint
    // as the navigation back to the loans screen. The cascade delete + tx-store
    // reconcile run in the background; on failure we restore and surface a notice.
    const snapshot = get().loans;
    set({ loans: snapshot.filter((l) => l.id !== id) });
    try {
      await loansService.deleteLoanCascade(id);
      useTransactionsStore.getState().load().catch(() => undefined);
    } catch (error) {
      set({ loans: snapshot });
      useGlobalNotice.getState().show('Error in deleting the loan. Please try again.');
      throw error;
    }
  },

  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),

  getById: (id) => get().loans.find((l) => l.id === id),
}));
