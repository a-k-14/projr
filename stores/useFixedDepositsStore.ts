import { create } from 'zustand';
import type { CloseDepositInput, CreateDepositInput, Deposit, DepositStatus } from '../types';
import * as depositsService from '../services/fixedDeposits';
import { getFixedDepositSummary } from '../lib/fixed-deposits';
import { useTransactionsStore } from './useTransactionsStore';
import { useAccountsStore } from './useAccountsStore';

async function refreshLinkedStores() {
  // Creating/closing/deleting a deposit also writes/removes a linked
  // type='deposit' transaction and shifts the source-account balance.
  await Promise.all([
    useTransactionsStore.getState().load().catch(() => undefined),
    useAccountsStore.getState().load().catch(() => undefined),
  ]);
}

interface DepositsStore {
  deposits: Deposit[];
  isLoaded: boolean;
  totalInvested: number;
  totalMaturityValue: number;
  totalInterest: number;
  activeMaturityValue: number;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  add: (data: CreateDepositInput) => Promise<Deposit>;
  update: (id: string, data: Partial<CreateDepositInput> & { status?: DepositStatus }) => Promise<void>;
  close: (id: string, data?: CloseDepositInput) => Promise<void>;
  reopen: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function deriveSummary(deposits: Deposit[]) {
  return getFixedDepositSummary(deposits);
}

export const useFixedDepositsStore = create<DepositsStore>((set, get) => ({
  deposits: [],
  isLoaded: false,
  totalInvested: 0,
  totalMaturityValue: 0,
  totalInterest: 0,
  activeMaturityValue: 0,

  load: async () => {
    const list = await depositsService.getDeposits();
    const summary = deriveSummary(list);
    set({
      deposits: list,
      isLoaded: true,
      totalInvested: summary.totalInvested,
      totalMaturityValue: summary.totalMaturityValue,
      totalInterest: summary.totalInterest,
      activeMaturityValue: summary.activeMaturityValue,
    });
  },

  refresh: async () => {
    await get().load();
  },

  add: async (data) => {
    const created = await depositsService.createDeposit(data);
    await get().load();
    await refreshLinkedStores();
    return created;
  },

  update: async (id, data) => {
    await depositsService.updateDeposit(id, data);
    await get().load();
    await refreshLinkedStores();
  },

  close: async (id, data) => {
    await depositsService.closeDeposit(id, data);
    await get().load();
    await refreshLinkedStores();
  },

  reopen: async (id) => {
    await depositsService.reopenDeposit(id);
    await get().load();
    await refreshLinkedStores();
  },

  remove: async (id) => {
    await depositsService.deleteDeposit(id);
    await get().load();
    await refreshLinkedStores();
  },
}));
