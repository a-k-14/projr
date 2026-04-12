import { create } from 'zustand';
import type { Account, CreateAccountInput } from '../types';
import * as accountsService from '../services/accounts';
import { countByAccount } from '../services/transactions';
import { useUIStore } from './useUIStore';

interface AccountsStore {
  accounts: Account[];
  isLoaded: boolean;
  load: () => Promise<void>;
  add: (data: CreateAccountInput) => Promise<Account>;
  update: (id: string, data: Partial<Account>) => Promise<void>;
  setOrder: (ids: string[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  getById: (id: string) => Account | undefined;
}

export const useAccountsStore = create<AccountsStore>((set, get) => ({
  accounts: [],
  isLoaded: false,

  load: async () => {
    const accounts = await accountsService.getAccounts();
    set({ accounts, isLoaded: true });
  },

  refresh: async () => {
    const accounts = await accountsService.getAccounts();
    set({ accounts });
  },

  add: async (data) => {
    const account = await accountsService.createAccount(data);
    set((state) => ({ accounts: [...state.accounts, account] }));
    return account;
  },

  update: async (id, data) => {
    const updated = await accountsService.updateAccount(id, data);
    set((state) => ({
      accounts: state.accounts.map((a) => (a.id === id ? updated : a)),
    }));
  },

  setOrder: async (ids) => {
    await accountsService.setAccountOrder(ids);
    const accounts = await accountsService.getAccounts();
    set({ accounts });
  },

  remove: async (id) => {
    const count = await countByAccount(id);
    if (count > 0) {
      throw new Error(
        `This account has ${count} transaction${count === 1 ? '' : 's'} and cannot be deleted.`
      );
    }
    await accountsService.deleteAccount(id);
    // Clear the default account setting if it pointed to the deleted account
    const { settings, updateSettings } = useUIStore.getState();
    if (settings.defaultAccountId === id) {
      await updateSettings({ defaultAccountId: '' });
    }
    set((state) => ({ accounts: state.accounts.filter((a) => a.id !== id) }));
  },

  getById: (id) => get().accounts.find((a) => a.id === id),
}));
