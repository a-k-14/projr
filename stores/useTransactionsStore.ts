import { create } from 'zustand';
import type { Transaction, CreateTransactionInput, TransactionFilters } from '../types';
import * as transactionsService from '../services/transactions';
import { TRANSACTIONS_PAGE_SIZE as PAGE_SIZE } from '../lib/layoutTokens';

interface TransactionsStore {
  transactions: Transaction[];
  filters: TransactionFilters;
  isLoaded: boolean;
  hasMore: boolean;
  load: (filters?: TransactionFilters) => Promise<void>;
  reset: () => void;
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

  load: async (filters) => {
    const f = { ...get().filters, ...filters, limit: PAGE_SIZE, offset: 0 };
    const txs = await transactionsService.getTransactions(f);
    set({ transactions: txs, filters: f, isLoaded: true, hasMore: txs.length === PAGE_SIZE });
  },

  reset: () => {
    set({
      transactions: [],
      filters: { limit: PAGE_SIZE, offset: 0 },
      isLoaded: false,
      hasMore: true,
    });
  },

  loadMore: async () => {
    const { filters, transactions, hasMore } = get();
    if (!hasMore) return;
    const newOffset = (filters.offset ?? 0) + PAGE_SIZE;
    const more = await transactionsService.getTransactions({ ...filters, offset: newOffset });
    set({
      transactions: [...transactions, ...more],
      filters: { ...filters, offset: newOffset },
      hasMore: more.length === PAGE_SIZE,
    });
  },

  add: async (data) => {
    const tx = await transactionsService.createTransaction(data);
    if (get().isLoaded) {
      await get().load(get().filters);
    } else {
      set((state) => ({ transactions: [tx, ...state.transactions] }));
    }
    return tx;
  },

  update: async (id, data) => {
    const updated = await transactionsService.updateTransaction(id, data);
    if (!updated) return;
    set((state) => ({
      transactions: patchTransaction(state.transactions, id, updated),
    }));
  },

  remove: async (id) => {
    await transactionsService.deleteTransaction(id);
    if (get().isLoaded) {
      await get().load(get().filters);
    } else {
      set((state) => ({ transactions: state.transactions.filter((t) => t.id !== id) }));
    }
  },

  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),
}));

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
