import { create } from 'zustand';
import type { Transaction, CreateTransactionInput, TransactionFilters } from '../types';
import * as transactionsService from '../services/transactions';
import { TRANSACTIONS_PAGE_SIZE as PAGE_SIZE } from '../lib/layoutTokens';
import { getTransactionBalanceDelta } from '../lib/transactionImpact';
import { useAccountsStore } from './useAccountsStore';
import { useLoansStore } from './useLoansStore';
import { generateId } from '../lib/ids';
import { nowUTC } from '../lib/dateUtils';

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
    // Pre-await optimistic patch: applied SYNCHRONOUSLY so callers that fire-and-forget
    // this (e.g. the add-transaction modal) can navigate immediately and have stores
    // already reflect the new transaction by the time the next screen paints. The DB
    // write happens in the background; on success we swap the synthetic id for the
    // real one, on failure we revert state and rethrow.
    //
    // Loans/deposits skip optimistic patching — their service layer does async category
    // derivation and cross-store side effects (loans/deposits stores) that are tricky
    // to mirror exactly. Those flows already use a cheap mounted-screen rerender.
    const canOptimistic =
      data.type === 'in' || data.type === 'out' || data.type === 'transfer';
    if (!canOptimistic) {
      const tx = await transactionsService.createTransaction(data);
      set((state) => ({
        transactions: insertTransaction(state.transactions, tx),
        mutationVersion: state.mutationVersion + 1,
        lastAddedTx: tx,
      }));
      return tx;
    }

    const syntheticId = generateId();
    const transferPairId = data.type === 'transfer' ? generateId() : undefined;
    const synthetic: Transaction = {
      id: syntheticId,
      // Transfers are surfaced as the 'out' leg in the activity list (same as the service).
      type: data.type === 'transfer' ? 'out' : data.type,
      amount: data.amount,
      accountId: data.accountId,
      splitGroupId: undefined,
      linkedAccountId: data.linkedAccountId,
      loanId: undefined,
      loanTransactionType: undefined,
      depositId: undefined,
      depositTransactionType: undefined,
      categoryId: data.categoryId,
      payee: data.payee,
      tags: data.tags ?? [],
      note: data.note,
      receiptImageUris: data.receiptImageUris ?? [],
      date: data.date,
      transferPairId,
      createdAt: nowUTC(),
    };

    set((state) => ({
      transactions: insertTransaction(state.transactions, synthetic),
      mutationVersion: state.mutationVersion + 1,
      lastAddedTx: synthetic,
    }));
    const applyAccountDeltas = (sign: 1 | -1) => {
      const accounts = useAccountsStore.getState();
      if (data.type === 'transfer' && data.linkedAccountId) {
        accounts.applyBalanceDelta(data.accountId, -data.amount * sign);
        accounts.applyBalanceDelta(data.linkedAccountId, data.amount * sign);
      } else {
        accounts.applyBalanceDelta(data.accountId, getTransactionBalanceDelta(synthetic) * sign);
      }
    };
    applyAccountDeltas(1);

    try {
      const realTx = await transactionsService.createTransaction(data);
      // Reconcile: swap the synthetic row for the persisted one (real id, persisted
      // receipt URIs, server-derived categoryId etc.).
      set((state) => ({
        transactions: state.transactions.map((t) => (t.id === syntheticId ? realTx : t)),
        lastAddedTx: realTx,
      }));
      return realTx;
    } catch (error) {
      set((state) => ({
        transactions: state.transactions.filter((t) => t.id !== syntheticId),
        mutationVersion: state.mutationVersion + 1,
      }));
      applyAccountDeltas(-1);
      throw error;
    }
  },

  update: async (id, data) => {
    const originalTx = get().transactions.find((t) => t.id === id);
    // Pre-await optimistic patch for plain in/out edits. Skip transfers (two-leg
    // accounting handled by updateTransferTransaction) and anything loan/deposit-linked
    // (cross-store side effects).
    const canOptimistic =
      !!originalTx &&
      !originalTx.transferPairId &&
      !originalTx.loanId &&
      !originalTx.depositId &&
      !originalTx.splitGroupId &&
      (originalTx.type === 'in' || originalTx.type === 'out') &&
      (data.type === undefined || data.type === 'in' || data.type === 'out');

    if (!canOptimistic) {
      const updated = await transactionsService.updateTransaction(id, data);
      if (!updated) return;
      set((state) => ({
        transactions: patchTransaction(state.transactions, id, updated),
        mutationVersion: state.mutationVersion + 1,
      }));
      if (originalTx && !originalTx.transferPairId) {
        const oldDelta = getTransactionBalanceDelta(originalTx);
        useAccountsStore.getState().applyBalanceDelta(originalTx.accountId, -oldDelta);
      }
      if (!updated.transferPairId) {
        const newDelta = getTransactionBalanceDelta(updated);
        useAccountsStore.getState().applyBalanceDelta(updated.accountId, newDelta);
      }
      if (updated.loanId || originalTx?.loanId) {
        useLoansStore.getState().load().catch(() => {});
      }
      return;
    }

    const optimistic: Transaction = {
      ...originalTx!,
      type: (data.type ?? originalTx!.type) as Transaction['type'],
      amount: data.amount ?? originalTx!.amount,
      accountId: data.accountId ?? originalTx!.accountId,
      categoryId: data.categoryId !== undefined ? data.categoryId : originalTx!.categoryId,
      payee: data.payee !== undefined ? data.payee : originalTx!.payee,
      tags: data.tags !== undefined ? data.tags : originalTx!.tags,
      note: data.note !== undefined ? data.note : originalTx!.note,
      receiptImageUris:
        data.receiptImageUris !== undefined
          ? (data.receiptImageUris ?? [])
          : originalTx!.receiptImageUris,
      date: data.date ?? originalTx!.date,
    };
    set((state) => ({
      transactions: patchTransaction(state.transactions, id, optimistic),
      mutationVersion: state.mutationVersion + 1,
    }));
    const oldDelta = getTransactionBalanceDelta(originalTx!);
    const newDelta = getTransactionBalanceDelta(optimistic);
    const accounts = useAccountsStore.getState();
    accounts.applyBalanceDelta(originalTx!.accountId, -oldDelta);
    accounts.applyBalanceDelta(optimistic.accountId, newDelta);

    try {
      const updated = await transactionsService.updateTransaction(id, data);
      if (updated) {
        set((state) => ({
          transactions: patchTransaction(state.transactions, id, updated),
        }));
      }
    } catch (error) {
      // Revert: restore original row and reverse the delta swap.
      set((state) => ({
        transactions: patchTransaction(state.transactions, id, originalTx!),
        mutationVersion: state.mutationVersion + 1,
      }));
      accounts.applyBalanceDelta(optimistic.accountId, -newDelta);
      accounts.applyBalanceDelta(originalTx!.accountId, oldDelta);
      throw error;
    }
  },

  remove: async (id) => {
    let originalTx = get().transactions.find((t) => t.id === id);
    if (!originalTx) {
      originalTx = await transactionsService.getTransactionById(id) || undefined;
    }
    // Pre-await optimistic patch for plain in/out deletes. Skip the complex paths
    // (transfer pairs, split groups, loan/deposit cascades) where the service does
    // multi-row cleanup we can't safely mirror sync.
    const canOptimistic =
      !!originalTx &&
      !originalTx.transferPairId &&
      !originalTx.splitGroupId &&
      !originalTx.loanId &&
      !originalTx.depositId &&
      (originalTx.type === 'in' || originalTx.type === 'out');

    if (!canOptimistic) {
      await transactionsService.deleteTransaction(id);
      set((state) => ({
        transactions: state.transactions.filter((t) => t.id !== id),
        mutationVersion: state.mutationVersion + 1,
      }));
      if (originalTx && !originalTx.transferPairId) {
        const oldDelta = getTransactionBalanceDelta(originalTx);
        useAccountsStore.getState().applyBalanceDelta(originalTx.accountId, -oldDelta);
      }
      if (originalTx?.loanId) {
        useLoansStore.getState().load().catch(() => {});
      }
      return;
    }

    const snapshot = originalTx!;
    set((state) => ({
      transactions: state.transactions.filter((t) => t.id !== id),
      mutationVersion: state.mutationVersion + 1,
    }));
    const oldDelta = getTransactionBalanceDelta(snapshot);
    const accounts = useAccountsStore.getState();
    accounts.applyBalanceDelta(snapshot.accountId, -oldDelta);

    try {
      await transactionsService.deleteTransaction(id);
    } catch (error) {
      // Revert: put the row back and re-apply its delta.
      set((state) => ({
        transactions: insertTransaction(state.transactions, snapshot),
        mutationVersion: state.mutationVersion + 1,
      }));
      accounts.applyBalanceDelta(snapshot.accountId, oldDelta);
      throw error;
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
