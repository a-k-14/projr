import { create } from 'zustand';
import type { Transaction, CreateTransactionInput, TransactionFilters } from '../types';
import * as transactionsService from '../services/transactions';
import { TRANSACTIONS_PAGE_SIZE as PAGE_SIZE } from '../lib/layoutTokens';
import { getCurrentMonthToDateRange } from '../lib/dateUtils';
import { useAccountsStore } from './useAccountsStore';

interface TransactionsStore {
  transactions: Transaction[];
  filters: TransactionFilters;
  isLoaded: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  mutationVersion: number;
  pendingWrites: number;
  load: (filters?: TransactionFilters, skipPendingCheck?: boolean) => Promise<void>;
  reset: () => void;
  trimToFirstPage: () => void;
  loadMore: () => Promise<void>;
  markMutated: () => void;
  add: (data: CreateTransactionInput) => Promise<Transaction>;
  update: (id: string, data: Partial<CreateTransactionInput>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setFilters: (filters: TransactionFilters) => void;
}

function currentMonthFilter(): Pick<TransactionFilters, 'fromDate' | 'toDate'> {
  const { from, to } = getCurrentMonthToDateRange();
  return { fromDate: from, toDate: to };
}

export const useTransactionsStore = create<TransactionsStore>((set, get) => ({
  transactions: [],
  filters: { ...currentMonthFilter(), limit: PAGE_SIZE, offset: 0 },
  isLoaded: false,
  hasMore: true,
  isLoadingMore: false,
  mutationVersion: 0,
  pendingWrites: 0,

  load: async (filters, skipPendingCheck) => {
    // Wait for any in-flight writes to commit first
    if (!skipPendingCheck && get().pendingWrites > 0) {
      await new Promise<void>((resolve) => {
        let attempts = 0;
        const check = () => {
          attempts++;
          if (get().pendingWrites === 0 || attempts > 50) return resolve();
          setTimeout(check, 40);
        };
        check();
      });
    }

    const f = { ...get().filters, ...currentMonthFilter(), ...filters, limit: PAGE_SIZE, offset: 0 };
    const txs = await transactionsService.getTransactions(f);
    set({ transactions: txs, filters: f, isLoaded: true, hasMore: txs.length === PAGE_SIZE, isLoadingMore: false });
  },

  reset: () => {
    set({
      transactions: [],
      filters: { ...currentMonthFilter(), limit: PAGE_SIZE, offset: 0 },
      isLoaded: false,
      hasMore: true,
      isLoadingMore: false,
      pendingWrites: 0,
    });
  },

  trimToFirstPage: () => {
    set((state) => {
      if (state.transactions.length <= PAGE_SIZE && (state.filters.offset ?? 0) === 0) {
        return state;
      }
      return {
        transactions: state.transactions.slice(0, PAGE_SIZE),
        filters: { ...state.filters, offset: 0, limit: PAGE_SIZE },
        hasMore: state.hasMore || state.transactions.length > PAGE_SIZE,
        isLoadingMore: false,
      };
    });
  },

  markMutated: () => set((state) => ({ mutationVersion: state.mutationVersion + 1 })),

  loadMore: async () => {
    const { filters, hasMore, isLoadingMore } = get();
    if (!hasMore || isLoadingMore) return;
    set({ isLoadingMore: true });
    const newOffset = (filters.offset ?? 0) + PAGE_SIZE;
    try {
      const more = await transactionsService.getTransactions({ ...filters, offset: newOffset });
      set((state) => {
        const ids = new Set(state.transactions.map((tx) => tx.id));
        return {
          transactions: [...state.transactions, ...more.filter((tx) => !ids.has(tx.id))],
          filters: { ...state.filters, offset: newOffset },
          hasMore: more.length === PAGE_SIZE,
          isLoadingMore: false,
        };
      });
    } catch (error) {
      set({ isLoadingMore: false });
      throw error;
    }
  },

  add: async (data) => {
    set((state) => ({ pendingWrites: state.pendingWrites + 1 }));
    try {
      const tx = await transactionsService.createTransaction(data);
      await Promise.all([
        get().load(undefined, true),
        useAccountsStore.getState().refresh(),
      ]);
      // Bump AFTER reloads so screens see fresh store data immediately
      set((state) => ({ mutationVersion: state.mutationVersion + 1 }));
      return tx;
    } finally {
      set((state) => ({ pendingWrites: Math.max(0, state.pendingWrites - 1) }));
    }
  },

  update: async (id, data) => {
    set((state) => ({ pendingWrites: state.pendingWrites + 1 }));
    try {
      await transactionsService.updateTransaction(id, data);
      await Promise.all([
        get().load(undefined, true),
        useAccountsStore.getState().refresh(),
      ]);
      // Bump AFTER reloads so screens see fresh store data immediately
      set((state) => ({ mutationVersion: state.mutationVersion + 1 }));
    } finally {
      set((state) => ({ pendingWrites: Math.max(0, state.pendingWrites - 1) }));
    }
  },

  remove: async (id) => {
    set((state) => ({ pendingWrites: state.pendingWrites + 1 }));
    try {
      const originalTx = await transactionsService.getTransactionById(id);
      await transactionsService.deleteTransaction(id);
      const linkedReloads: Promise<unknown>[] = [];
      if (originalTx?.loanId) {
        linkedReloads.push(import('./useLoansStore').then(m => m.useLoansStore.getState().load()).catch(() => undefined));
      }
      if (originalTx?.depositId) {
        linkedReloads.push(import('./useFixedDepositsStore').then(m => m.useFixedDepositsStore.getState().load()).catch(() => undefined));
      }
      await Promise.all([
        get().load(undefined, true),
        useAccountsStore.getState().refresh(),
        ...linkedReloads,
      ]);
      // Bump AFTER reloads so screens see fresh store data immediately
      set((state) => ({ mutationVersion: state.mutationVersion + 1 }));
    } finally {
      set((state) => ({ pendingWrites: Math.max(0, state.pendingWrites - 1) }));
    }
  },

  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),
}));
