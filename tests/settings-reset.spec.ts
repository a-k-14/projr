import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema.ts';
import type { Account, BudgetWithSpent, Category, LoanWithSummary, Transaction } from '../types/index.ts';

const sqlite = new Database(':memory:');
sqlite.pragma('foreign_keys = ON');
const db = drizzle(sqlite, { schema });

// @ts-ignore - patching sync transaction to async for service compatibility.
db.transaction = async (cb: any) => cb(db);

jest.mock('../db/client', () => ({
  db,
  sqlite,
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID(),
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///tmp/reni-test/',
  getInfoAsync: jest.fn(async () => ({ exists: true })),
  makeDirectoryAsync: jest.fn(async () => undefined),
  copyAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
}));

import * as FileSystem from 'expo-file-system/legacy';
import { clearLocalData } from '../services/settings.ts';
import { resetInMemoryStores, resetLocalAppData } from '../services/localReset.ts';
import { useAccountsStore } from '../stores/useAccountsStore.ts';
import { useBudgetDraftStore } from '../stores/useBudgetDraftStore.ts';
import { useBudgetStore } from '../stores/useBudgetStore.ts';
import { useCategoriesStore } from '../stores/useCategoriesStore.ts';
import { useLoansStore } from '../stores/useLoansStore.ts';
import { useTransactionDraftStore } from '../stores/useTransactionDraftStore.ts';
import { useTransactionsStore } from '../stores/useTransactionsStore.ts';
import { useUIStore } from '../stores/useUIStore.ts';

beforeEach(() => {
  sqlite.exec(`
    DROP TABLE IF EXISTS transactions;
    DROP TABLE IF EXISTS loans;
    DROP TABLE IF EXISTS budget;
    DROP TABLE IF EXISTS tags;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS accounts;
    DROP TABLE IF EXISTS settings;

    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'INR',
      color TEXT NOT NULL DEFAULT '#1B4332',
      icon TEXT NOT NULL DEFAULT 'wallet',
      account_number TEXT,
      initial_balance REAL NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      icon TEXT NOT NULL DEFAULT 'tag',
      color TEXT NOT NULL DEFAULT '#6B7280',
      type TEXT NOT NULL DEFAULT 'both'
    );

    CREATE TABLE tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6B7280'
    );

    CREATE TABLE loans (
      id TEXT PRIMARY KEY,
      person_name TEXT NOT NULL,
      direction TEXT NOT NULL,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
      given_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      note TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE budget (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      amount REAL NOT NULL,
      period TEXT NOT NULL DEFAULT 'month',
      start_date TEXT NOT NULL,
      repeat INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
      split_group_id TEXT,
      linked_account_id TEXT,
      loan_id TEXT,
      category_id TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      payee TEXT,
      note TEXT,
      receipt_image_uris TEXT,
      date TEXT NOT NULL,
      transfer_pair_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT INTO accounts (id, name, type, balance, created_at) VALUES ('acc1', 'Savings', 'savings', 1000, '2026-04-20T00:00:00.000Z');
    INSERT INTO categories (id, name, icon, color, type) VALUES ('cat1', 'Food', 'tag', '#123456', 'out');
    INSERT INTO tags (id, name, color) VALUES ('tag1', 'Work', '#654321');
    INSERT INTO loans (id, person_name, direction, account_id, given_amount, date, created_at) VALUES ('loan1', 'Asha', 'lent', 'acc1', 300, '2026-04-20T00:00:00.000Z', '2026-04-20T00:00:00.000Z');
    INSERT INTO budget (id, category_id, amount, start_date, created_at) VALUES ('budget1', 'cat1', 500, '2026-04-01T00:00:00.000Z', '2026-04-20T00:00:00.000Z');
    INSERT INTO transactions (id, type, amount, account_id, category_id, tags, date, created_at) VALUES ('tx1', 'out', 50, 'acc1', 'cat1', '["tag1"]', '2026-04-20T00:00:00.000Z', '2026-04-20T00:00:00.000Z');
    INSERT INTO settings (key, value) VALUES ('defaultAccountId', 'acc1');
    INSERT INTO settings (key, value) VALUES ('biometricLock', 'true');
  `);
});

describe('local reset', () => {
  it('clears local data and suppresses starter data reseeding', async () => {
    await clearLocalData();

    for (const table of ['transactions', 'loans', 'budget', 'tags', 'categories', 'accounts']) {
      const row = sqlite.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
      expect(row.count).toBe(0);
    }

    const settingsRows = sqlite.prepare('SELECT key, value FROM settings').all();
    expect(settingsRows).toEqual([{ key: 'starterDataSeedState', value: 'suppressed' }]);
  });

  it('removes local receipt files during a full app reset', async () => {
    await resetLocalAppData();

    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///tmp/reni-test/receipts', { idempotent: true });
  });

  it('resets all in-memory stores, including transaction drafts', () => {
    const account: Account = {
      id: 'acc1',
      name: 'Savings',
      type: 'savings',
      balance: 1000,
      currency: 'INR',
      color: '#123456',
      icon: 'wallet',
      initialBalance: 1000,
      sortOrder: 0,
      createdAt: '2026-04-20T00:00:00.000Z',
    };
    const category: Category = { id: 'cat1', name: 'Food', icon: 'tag', color: '#123456', type: 'out' };
    const transaction: Transaction = {
      id: 'tx1',
      type: 'out',
      amount: 50,
      accountId: 'acc1',
      categoryId: 'cat1',
      tags: ['tag1'],
      date: '2026-04-20T00:00:00.000Z',
      createdAt: '2026-04-20T00:00:00.000Z',
    };
    const loan: LoanWithSummary = {
      id: 'loan1',
      personName: 'Asha',
      direction: 'lent',
      accountId: 'acc1',
      givenAmount: 300,
      status: 'open',
      tags: [],
      date: '2026-04-20T00:00:00.000Z',
      createdAt: '2026-04-20T00:00:00.000Z',
      settledAmount: 0,
      pendingAmount: 300,
      repaidPercent: 0,
      transactions: [],
    };
    const budget: BudgetWithSpent = {
      id: 'budget1',
      categoryId: 'cat1',
      amount: 500,
      period: 'month',
      startDate: '2026-04-01T00:00:00.000Z',
      repeat: true,
      createdAt: '2026-04-20T00:00:00.000Z',
      spent: 50,
      remaining: 450,
      percent: 10,
      categoryName: 'Food',
      categoryIcon: 'tag',
      categoryColor: '#123456',
    };

    useTransactionsStore.setState({ transactions: [transaction], isLoaded: true, hasMore: false });
    useTransactionDraftStore.setState({
      accountId: 'acc1',
      categoryId: 'cat1',
      tagIds: ['tag1'],
      splitRows: [{ id: 'row1', categoryId: 'cat1', amountStr: '50' }],
    });
    useAccountsStore.setState({ accounts: [account], isLoaded: true });
    useCategoriesStore.setState({ categories: [category], tags: [{ id: 'tag1', name: 'Work', color: '#654321' }], isLoaded: true });
    useLoansStore.setState({ loans: [loan], filters: { status: 'open' }, isLoaded: true });
    useBudgetStore.setState({ budgets: [budget], isLoaded: true });
    useBudgetDraftStore.setState({ categoryId: 'cat1' });
    useUIStore.setState({
      settings: {
        defaultAccountId: 'acc1',
        currency: 'USD',
        currencySymbol: '$',
        showCurrencySymbol: true,
        theme: 'dark',
        yearStart: 3,
        cloudBackupEnabled: true,
        biometricLock: true,
        homeAccountViewMode: 'list',
      },
      isLoaded: true,
      loadError: 'previous',
    });

    resetInMemoryStores();

    expect(useTransactionsStore.getState()).toMatchObject({ transactions: [], isLoaded: false, hasMore: true });
    expect(useTransactionDraftStore.getState()).toMatchObject({
      accountId: '',
      categoryId: '',
      tagIds: [],
      splitRows: [],
    });
    expect(useAccountsStore.getState()).toMatchObject({ accounts: [], isLoaded: false });
    expect(useCategoriesStore.getState()).toMatchObject({ categories: [], tags: [], isLoaded: false });
    expect(useLoansStore.getState()).toMatchObject({ loans: [], filters: {}, isLoaded: false });
    expect(useBudgetStore.getState()).toMatchObject({ budgets: [], isLoaded: false });
    expect(useBudgetDraftStore.getState()).toMatchObject({ categoryId: '' });
    expect(useUIStore.getState()).toMatchObject({ isLoaded: false, loadError: null });
    expect(useUIStore.getState().settings).toMatchObject({
      defaultAccountId: '',
      currency: 'INR',
      currencySymbol: '₹',
      showCurrencySymbol: false,
      theme: 'light',
      biometricLock: false,
    });
  });
});
