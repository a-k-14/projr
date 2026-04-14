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
  loadMore: () => Promise<void>;
  add: (data: CreateTransactionInput) => Promise<Transaction>;
  update: (id: string, data: Partial<CreateTransactionInput>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setFilters: (filters: TransactionFilters) => void;
  transactionsVersion: number;
}

export const useTransactionsStore = create<TransactionsStore>((set, get) => ({
  transactions: [],
  filters: { limit: PAGE_SIZE, offset: 0 },
  isLoaded: false,
  hasMore: true,
  transactionsVersion: 0,

  load: async (filters) => {
    const f = { ...get().filters, ...filters, limit: PAGE_SIZE, offset: 0 };
    const txs = await transactionsService.getTransactions(f);
    set({ transactions: txs, filters: f, isLoaded: true, hasMore: txs.length === PAGE_SIZE });
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
    set((state) => ({ 
      transactions: [tx, ...state.transactions],
      transactionsVersion: state.transactionsVersion + 1 
    }));
    return tx;
  },

  update: async (id, data) => {
    const updated = await transactionsService.updateTransaction(id, data);
    set((state) => ({
      transactions: state.transactions.map((t) => (t.id === id ? updated : t)),
      transactionsVersion: state.transactionsVersion + 1,
    }));
  },

  remove: async (id) => {
    const existing = get().transactions.find((t) => t.id === id);
    await transactionsService.deleteTransaction(id);
    if (existing?.transferPairId) {
      set((state) => ({
        transactions: state.transactions.filter(
          (t) => t.transferPairId !== existing.transferPairId
        ),
        transactionsVersion: state.transactionsVersion + 1,
      }));
    } else {
      set((state) => ({ 
        transactions: state.transactions.filter((t) => t.id !== id),
        transactionsVersion: state.transactionsVersion + 1,
      }));
    }
  },

  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),
}));
