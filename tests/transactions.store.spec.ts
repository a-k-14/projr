import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema.ts';

// In-memory DB wired the same way as transactions.service.spec.ts — the store calls
// the real service layer, which writes through this drizzle/better-sqlite3 instance.
const sqlite = new Database(':memory:');
sqlite.pragma('foreign_keys = ON');
const db = drizzle(sqlite, { schema });

// @ts-ignore - patch the sync drizzle transaction to async for test compatibility
db.transaction = async (cb: any) => {
  return await cb(db);
};

jest.mock('../db/client', () => ({ db, sqlite }));

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

import type { Account } from '../types';
import * as transactionsService from '../services/transactions.ts';
import { useTransactionsStore } from '../stores/useTransactionsStore.ts';
import { useAccountsStore } from '../stores/useAccountsStore.ts';

const DATE = new Date().toISOString();

const makeAccount = (id: string, name: string, balance: number): Account => ({
  id,
  name,
  type: 'savings',
  balance,
  currency: 'INR',
  color: '#1B4332',
  icon: 'wallet',
  initialBalance: balance,
  sortOrder: 0,
  createdAt: '2024-01-01T00:00:00.000Z',
});

const txs = () => useTransactionsStore.getState().transactions;
const balanceOf = (id: string) => useAccountsStore.getState().getById(id)!.balance;
const dbRow = (id: string) => sqlite.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as any;

beforeEach(() => {
  sqlite.exec(`
    DROP TABLE IF EXISTS transactions;
    DROP TABLE IF EXISTS accounts;
    DROP TABLE IF EXISTS audit_logs;

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

    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
      split_group_id TEXT,
      linked_account_id TEXT,
      loan_id TEXT,
      loan_transaction_type TEXT,
      deposit_id TEXT,
      deposit_transaction_type TEXT,
      category_id TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      payee TEXT,
      note TEXT,
      receipt_image_uris TEXT,
      date TEXT NOT NULL,
      transfer_pair_id TEXT,
      exclude_from_totals INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      payload_before TEXT,
      payload_after TEXT,
      timestamp TEXT NOT NULL
    );

    INSERT INTO accounts (id, name, type, balance, created_at) VALUES ('acc1', 'Saving', 'savings', 1000, '2024-01-01T00:00:00.000Z');
    INSERT INTO accounts (id, name, type, balance, created_at) VALUES ('acc2', 'Wallet', 'wallet', 500, '2024-01-01T00:00:00.000Z');
  `);

  useAccountsStore.setState({
    accounts: [makeAccount('acc1', 'Saving', 1000), makeAccount('acc2', 'Wallet', 500)],
    isLoaded: true,
  });

  useTransactionsStore.setState({
    transactions: [],
    mutationVersion: 0,
    pendingWrites: 0,
  });

});

describe('useTransactionsStore — actions', () => {
  it('adds a transaction successfully, increments mutationVersion, and refreshes dependent stores', async () => {
    const startVersion = useTransactionsStore.getState().mutationVersion;
    const real = await useTransactionsStore.getState().add({
      type: 'in',
      amount: 500,
      accountId: 'acc1',
      date: DATE,
    });

    expect(useTransactionsStore.getState().mutationVersion).toBe(startVersion + 1);
    expect(dbRow(real.id)).toBeTruthy();
    expect(txs()).toHaveLength(1);
    expect(txs()[0].id).toBe(real.id);
    expect(balanceOf('acc1')).toBe(1500);
  });

  it('does not mutate in-memory state when an add fails', async () => {
    await expect(
      useTransactionsStore.getState().add({
        type: 'in',
        amount: 100,
        accountId: 'missing',
        date: DATE,
      }),
    ).rejects.toThrow();

    expect(txs()).toHaveLength(0);
    expect(balanceOf('acc1')).toBe(1000);
    expect(useTransactionsStore.getState().mutationVersion).toBe(0);
    expect(useTransactionsStore.getState().pendingWrites).toBe(0);
  });

  it('refreshes both transfer legs and account balances after commit', async () => {
    await useTransactionsStore.getState().add({
      type: 'transfer',
      amount: 300,
      accountId: 'acc1',
      linkedAccountId: 'acc2',
      date: DATE,
    });

    expect(txs()).toHaveLength(2);
    expect(new Set(txs().map((tx) => tx.transferPairId)).size).toBe(1);
    expect(balanceOf('acc1')).toBe(700);
    expect(balanceOf('acc2')).toBe(800);
  });

  it('updates a transaction successfully, increments mutationVersion, and refreshes dependent stores', async () => {
    const real = await useTransactionsStore.getState().add({
      type: 'out',
      amount: 200,
      accountId: 'acc1',
      date: DATE,
    });
    const midVersion = useTransactionsStore.getState().mutationVersion;

    await useTransactionsStore.getState().update(real.id, { amount: 350, payee: 'Coffee' });

    expect(useTransactionsStore.getState().mutationVersion).toBe(midVersion + 1);
    expect(dbRow(real.id).amount).toBe(350);
    expect(dbRow(real.id).payee).toBe('Coffee');
    expect(txs()[0].amount).toBe(350);
    expect(balanceOf('acc1')).toBe(650);
  });

  it('keeps persisted and in-memory state unchanged when an update fails', async () => {
    const real = await useTransactionsStore.getState().add({
      type: 'out',
      amount: 200,
      accountId: 'acc1',
      date: DATE,
    });
    const version = useTransactionsStore.getState().mutationVersion;

    await expect(
      useTransactionsStore.getState().update(real.id, { accountId: 'missing' }),
    ).rejects.toThrow();

    expect(dbRow(real.id).account_id).toBe('acc1');
    expect(txs()[0].accountId).toBe('acc1');
    expect(balanceOf('acc1')).toBe(800);
    expect(useTransactionsStore.getState().mutationVersion).toBe(version);
    expect(useTransactionsStore.getState().pendingWrites).toBe(0);
  });

  it('removes a transaction successfully, increments mutationVersion, and refreshes dependent stores', async () => {
    const real = await useTransactionsStore.getState().add({
      type: 'out',
      amount: 200,
      accountId: 'acc1',
      date: DATE,
    });
    const midVersion = useTransactionsStore.getState().mutationVersion;

    await useTransactionsStore.getState().remove(real.id);

    expect(useTransactionsStore.getState().mutationVersion).toBe(midVersion + 1);
    expect(dbRow(real.id)).toBeUndefined();
    expect(txs()).toHaveLength(0);
    expect(balanceOf('acc1')).toBe(1000);
  });

  it('keeps persisted and in-memory state unchanged when a delete fails', async () => {
    const real = await useTransactionsStore.getState().add({
      type: 'out',
      amount: 200,
      accountId: 'acc1',
      date: DATE,
    });
    const version = useTransactionsStore.getState().mutationVersion;
    const spy = jest
      .spyOn(transactionsService, 'deleteTransaction')
      .mockRejectedValueOnce(new Error('delete failed'));

    await expect(useTransactionsStore.getState().remove(real.id)).rejects.toThrow('delete failed');
    spy.mockRestore();

    expect(dbRow(real.id)).toBeTruthy();
    expect(txs()).toHaveLength(1);
    expect(balanceOf('acc1')).toBe(800);
    expect(useTransactionsStore.getState().mutationVersion).toBe(version);
    expect(useTransactionsStore.getState().pendingWrites).toBe(0);
  });
});
