import { create } from 'zustand';
import type { Transaction, CreateTransactionInput, TransactionFilters } from '../types';
import * as transactionsService from '../services/transactions';
import { TRANSACTIONS_PAGE_SIZE as PAGE_SIZE } from '../lib/layoutTokens';
import { getTransactionBalanceDelta } from '../lib/transactionImpact';
import { useAccountsStore } from './useAccountsStore';
import { useLoansStore } from './useLoansStore';

interface TransactionsStore {
  transactions: Transaction[];
  filters: TransactionFilters;
  isLoaded: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  mutationVersion: number;
  lastAddedTx: Transaction | null;
  load: (filters?: TransactionFilters) => Promise<void>;
  reset: () => void;
  trimToFirstPage: () => void;
  loadMore: () => Promise<void>;
  add: (data: CreateTransactionInput) => Promise<Transaction>;
  update: (id: string, data: Partial<CreateTransactionInput>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setFilters: (filters: TransactionFilters) => void;
}

export const useTransactionsStore = create<TransactionsStore>((set, get) => ({
  transactions: [],
  filters: { limit: PAGE_SIZE, offset: 0 },
  isLoaded: false,
  hasMore: true,
  isLoadingMore: false,
  mutationVersion: 0,
  lastAddedTx: null,

  load: async (filters) => {
    const f = { ...get().filters, ...filters, limit: PAGE_SIZE, offset: 0 };
    const txs = await transactionsService.getTransactions(f);
    set({ transactions: txs, filters: f, isLoaded: true, hasMore: txs.length === PAGE_SIZE, isLoadingMore: false });
  },

  reset: () => {
    set({
      transactions: [],
      filters: { limit: PAGE_SIZE, offset: 0 },
      isLoaded: false,
      hasMore: true,
      isLoadingMore: false,
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
    const tx = await transactionsService.createTransaction(data);
    // Prepend in-place — don't reload from offset=0; that would discard prior
    // pages the user has already loaded via infinite scroll.
    set((state) => ({
      transactions: insertTransaction(state.transactions, tx),
      mutationVersion: state.mutationVersion + 1,
      lastAddedTx: tx,
    }));
    // Optimistic balance delta — skip transfers (two-leg; net NW neutral, refreshAccounts handles it)
    if (!tx.transferPairId) {
      const delta = getTransactionBalanceDelta(tx);
      useAccountsStore.getState().applyBalanceDelta(tx.accountId, delta);
    }
    return tx;
  },

  update: async (id, data) => {
    // Find old transaction before update to reverse its impact
    const originalTx = get().transactions.find((t) => t.id === id);
    const updated = await transactionsService.updateTransaction(id, data);
    if (!updated) return;
    set((state) => ({
      transactions: patchTransaction(state.transactions, id, updated),
      mutationVersion: state.mutationVersion + 1,
    }));

    // Optimistic balance delta updates
    if (originalTx && !originalTx.transferPairId) {
      const oldDelta = getTransactionBalanceDelta(originalTx);
      useAccountsStore.getState().applyBalanceDelta(originalTx.accountId, -oldDelta);
    }
    if (!updated.transferPairId) {
      const newDelta = getTransactionBalanceDelta(updated);
      useAccountsStore.getState().applyBalanceDelta(updated.accountId, newDelta);
    }

    // Refresh loans store conditionally
    if (updated.loanId || originalTx?.loanId) {
      useLoansStore.getState().load().catch(() => {});
    }
  },

  remove: async (id) => {
    // Find old transaction before deletion to reverse its impact
    let originalTx = get().transactions.find((t) => t.id === id);
    if (!originalTx) {
      originalTx = await transactionsService.getTransactionById(id) || undefined;
    }
    await transactionsService.deleteTransaction(id);
    set((state) => ({
      transactions: state.transactions.filter((t) => t.id !== id),
      mutationVersion: state.mutationVersion + 1,
    }));

    // Optimistic balance delta reversal
    if (originalTx && !originalTx.transferPairId) {
      const oldDelta = getTransactionBalanceDelta(originalTx);
      useAccountsStore.getState().applyBalanceDelta(originalTx.accountId, -oldDelta);
    }

    // Refresh loans store conditionally
    if (originalTx?.loanId) {
      useLoansStore.getState().load().catch(() => {});
    }
  },

  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),
}));

function insertTransaction(items: Transaction[], tx: Transaction): Transaction[] {
  // Maintain (date desc, createdAt desc) ordering — same comparator as service queries.
  const next = [...items, tx];
  return next.sort((a, b) => {
    const dateDelta = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateDelta !== 0) return dateDelta;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function patchTransaction(items: Transaction[], id: string, updated: Transaction) {
  const existing = items.find((item) => item.id === id);
  if (!existing) return items;

  const next = items.map((item) => (item.id === id ? updated : item));
  if (existing.date === updated.date && existing.createdAt === updated.createdAt) {
    return next;
  }

  return next.sort((a, b) => {
    const dateDelta = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateDelta !== 0) return dateDelta;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
