import { create } from 'zustand';
import type { Transaction, CreateTransactionInput, TransactionFilters } from '../types';
import * as transactionsService from '../services/transactions';
import { TRANSACTIONS_PAGE_SIZE as PAGE_SIZE } from '../lib/layoutTokens';
import { getTransactionBalanceDelta } from '../lib/transactionImpact';
import { useAccountsStore } from './useAccountsStore';
import { useGlobalNotice } from './useGlobalNotice';

const SAVE_FAILED_MESSAGE = 'Error in saving the last transaction. Please try again.';
const DELETE_FAILED_MESSAGE = 'Error in deleting the last transaction. Please try again.';
import { generateId } from '../lib/ids';
import { getCurrentMonthToDateRange, nowUTC } from '../lib/dateUtils';

interface TransactionsStore {
  transactions: Transaction[];
  filters: TransactionFilters;
  isLoaded: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  mutationVersion: number;
  lastAddedTx: Transaction | null;
  lastRemovedTx: Transaction | null;
  pendingWrites: number;
  load: (filters?: TransactionFilters) => Promise<void>;
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
  lastAddedTx: null,
  lastRemovedTx: null,
  pendingWrites: 0,

  load: async (filters) => {
    // Wait for any in-flight writes to commit first
    if (get().pendingWrites > 0) {
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

    // Recompute the month cutoff on every load so the cache drifts across midnight
    // (and across month rollovers) without an explicit guard. Spread order: prev
    // filters → fresh dates (override stale) → caller overrides last.
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

  // Bump the mutation version without touching the list. Used by out-of-store
  // writes (splits, transfer edits, deposits/loans) after they've reloaded from
  // the DB, so screens keyed on mutationVersion (account detail trend + recent
  // list, home hero) re-fetch their derived data.
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

    const isTransfer = data.type === 'transfer' && !!data.linkedAccountId;
    const syntheticId = generateId();
    const syntheticInId = isTransfer ? generateId() : undefined;
    const transferPairId = isTransfer ? generateId() : undefined;
    const createdAt = nowUTC();
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
      createdAt,
    };
    // A transfer persists as TWO rows — the 'out' leg above and the 'in' leg on the
    // destination account. The activity list renders both, so insert both synthetically;
    // otherwise the 'in' leg wouldn't appear until the next full reload.
    const syntheticIn: Transaction | undefined = isTransfer
      ? {
          ...synthetic,
          id: syntheticInId!,
          type: 'in',
          accountId: data.linkedAccountId!,
          linkedAccountId: data.accountId,
        }
      : undefined;

    set((state) => {
      let next = insertTransaction(state.transactions, synthetic);
      if (syntheticIn) next = insertTransaction(next, syntheticIn);
      return {
        transactions: next,
        mutationVersion: state.mutationVersion + 1,
        lastAddedTx: synthetic,
      };
    });
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
      // Reconcile: swap the synthetic row(s) for the persisted one(s) — real ids,
      // persisted receipt URIs, server-derived categoryId etc. Transfers need both
      // legs reconciled to their real ids so a later edit/delete (which looks the row
      // up by id in the DB) resolves correctly.
      if (isTransfer && realTx.transferPairId) {
        let realOut = realTx;
        let realIn: Transaction | undefined;
        try {
          const pair = await transactionsService.getTransactionsByTransferPairId(realTx.transferPairId);
          realOut = pair.find((t) => t.type === 'out') ?? realTx;
          realIn = pair.find((t) => t.type === 'in');
        } catch {
          // The transfer DID persist — a failed pair lookup must not masquerade as a
          // save failure. Reconcile what we have; the in-leg's synthetic id self-corrects
          // on the next reload.
        }
        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === syntheticId ? realOut : t.id === syntheticInId ? (realIn ?? t) : t,
          ),
          lastAddedTx: realOut,
          mutationVersion: state.mutationVersion + 1,
        }));
        return realOut;
      }
      set((state) => ({
        transactions: state.transactions.map((t) => (t.id === syntheticId ? realTx : t)),
        lastAddedTx: realTx,
        mutationVersion: state.mutationVersion + 1,
      }));
      return realTx;
    } catch (error) {
      set((state) => ({
        transactions: state.transactions.filter((t) => t.id !== syntheticId && t.id !== syntheticInId),
        mutationVersion: state.mutationVersion + 1,
      }));
      applyAccountDeltas(-1);
      useGlobalNotice.getState().show(SAVE_FAILED_MESSAGE);
      throw error;
    }
    } finally {
      set((state) => ({ pendingWrites: Math.max(0, state.pendingWrites - 1) }));
    }
  },

  update: async (id, data) => {
    set((state) => ({ pendingWrites: state.pendingWrites + 1 }));
    try {
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
      // Note: loan/deposit transaction edits do NOT come through here — they're
      // entity-owned (loansStore.updateSettlement / updateOrigin, depositsStore.update),
      // which apply the tx change and recompute their own summary. store.update() only
      // ever sees plain in/out edits, so there are no entity-store reloads to do.
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
          mutationVersion: state.mutationVersion + 1,
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
      useGlobalNotice.getState().show(SAVE_FAILED_MESSAGE);
      throw error;
    }
    } finally {
      set((state) => ({ pendingWrites: Math.max(0, state.pendingWrites - 1) }));
    }
  },

  remove: async (id) => {
    set((state) => ({ pendingWrites: state.pendingWrites + 1 }));
    try {
      let originalTx = get().transactions.find((t) => t.id === id);
      if (!originalTx) {
        originalTx = await transactionsService.getTransactionById(id) || undefined;
      }

      // Gather every row the DB delete will cascade-remove so the store can drop them
      // all optimistically — a transfer deletes both legs (shared transferPairId) and a
      // split deletes the whole group (shared splitGroupId). Without this the sibling
      // rows linger in the list until a full reload. Plain in/out/loan/deposit deletes
      // resolve to just the tapped row.
      const current = get().transactions;
      let affected: Transaction[];
      if (originalTx?.transferPairId) {
        const pairId = originalTx.transferPairId;
        const group = current.filter((t) => t.transferPairId === pairId);
        affected = group.length > 0 ? group : [originalTx];
      } else if (originalTx?.splitGroupId) {
        const groupId = originalTx.splitGroupId;
        const group = current.filter((t) => t.splitGroupId === groupId);
        affected = group.length > 0 ? group : [originalTx];
      } else if (originalTx) {
        affected = [originalTx];
      } else {
        affected = current.filter((t) => t.id === id);
      }
      const affectedIds = new Set(affected.map((t) => t.id));

      // Only a plain single in/out delete feeds lastRemovedTx (the home screen's
      // instant per-row patch). Cascades clear it so mounted screens fall back to
      // their own mutationVersion-keyed refresh.
      const plainSingle =
        affected.length === 1 &&
        !affected[0].transferPairId &&
        !affected[0].splitGroupId &&
        !affected[0].loanId &&
        !affected[0].depositId &&
        (affected[0].type === 'in' || affected[0].type === 'out')
          ? affected[0]
          : null;

      // Optimistic removal — synchronous so the list updates instantly.
      set((state) => ({
        transactions: state.transactions.filter((t) => !affectedIds.has(t.id)),
        mutationVersion: state.mutationVersion + 1,
        lastRemovedTx: plainSingle,
      }));
      const accounts = useAccountsStore.getState();
      for (const row of affected) {
        const delta = rowBalanceDelta(row);
        if (delta) accounts.applyBalanceDelta(row.accountId, -delta);
      }

      try {
        await transactionsService.deleteTransaction(id);
        set((state) => ({ mutationVersion: state.mutationVersion + 1 }));
        if (originalTx?.loanId) {
          import('./useLoansStore').then(m => m.useLoansStore.getState().load()).catch(() => {});
        }
        // Deposit-linked deletes cascade in the service (deleting a 'new' tx drops the
        // parent deposit row; deleting a 'closed' tx flips status back to 'active').
        // Without this reload the deposits store is stale after either.
        if (originalTx?.depositId) {
          import('./useFixedDepositsStore').then(m => m.useFixedDepositsStore.getState().load()).catch(() => {});
        }
      } catch (error) {
        // Revert: restore every removed row and re-apply its balance delta.
        set((state) => {
          let next = state.transactions;
          for (const row of affected) next = insertTransaction(next, row);
          return { transactions: next, mutationVersion: state.mutationVersion + 1 };
        });
        for (const row of affected) {
          const delta = rowBalanceDelta(row);
          if (delta) accounts.applyBalanceDelta(row.accountId, delta);
        }
        useGlobalNotice.getState().show(DELETE_FAILED_MESSAGE);
        throw error;
      }
    } finally {
      set((state) => ({ pendingWrites: Math.max(0, state.pendingWrites - 1) }));
    }
  },

  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),
}));

// Balance impact of a persisted row, mirroring services/transactions delete logic.
// Transfer legs are stored as concrete in/out rows and DO move account balances, even
// though getTransactionBalanceDelta reports them as neutral (cashflow-wise) — so handle
// them explicitly here.
function rowBalanceDelta(row: Transaction): number {
  if (row.transferPairId) {
    return row.type === 'in' ? row.amount : row.type === 'out' ? -row.amount : 0;
  }
  return getTransactionBalanceDelta(row);
}

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
