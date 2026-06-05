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
import { useGlobalNotice } from '../stores/useGlobalNotice.ts';

const DATE = '2024-01-02T12:00:00.000Z';

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

const balanceOf = (id: string) => useAccountsStore.getState().getById(id)!.balance;
const txs = () => useTransactionsStore.getState().transactions;
const dbCount = () => (sqlite.prepare('SELECT COUNT(*) c FROM transactions').get() as any).c;
const dbRow = (id: string) => sqlite.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as any;

beforeEach(() => {
  sqlite.exec(`
    DROP TABLE IF EXISTS transactions;
    DROP TABLE IF EXISTS accounts;

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
      created_at TEXT NOT NULL
    );

    INSERT INTO accounts (id, name, type, balance, created_at) VALUES ('acc1', 'Saving', 'savings', 1000, '2024-01-01T00:00:00.000Z');
    INSERT INTO accounts (id, name, type, balance, created_at) VALUES ('acc2', 'Wallet', 'wallet', 500, '2024-01-01T00:00:00.000Z');
  `);

  // Seed the in-memory account store to mirror the DB (balances are kept in sync via
  // applyBalanceDelta on the optimistic paths, never re-read from the DB there).
  useAccountsStore.setState({
    accounts: [makeAccount('acc1', 'Saving', 1000), makeAccount('acc2', 'Wallet', 500)],
    isLoaded: true,
  });

  useTransactionsStore.setState({
    transactions: [],
    mutationVersion: 0,
    lastAddedTx: null,
    lastRemovedTx: null,
    pendingWrites: 0,
  });

  useGlobalNotice.setState({ message: null, tone: 'info' });
});

describe('useTransactionsStore — optimistic add', () => {
  it('inserts an in transaction synchronously, then reconciles to the persisted row', async () => {
    const promise = useTransactionsStore.getState().add({
      type: 'in',
      amount: 500,
      accountId: 'acc1',
      date: DATE,
    });

    // Synchronous (pre-await) optimistic state — visible before the DB write resolves.
    expect(txs()).toHaveLength(1);
    expect(txs()[0].amount).toBe(500);
    expect(balanceOf('acc1')).toBe(1500);

    const real = await promise;

    // Reconciled: the synthetic row now carries the persisted id and exists in the DB.
    expect(txs()).toHaveLength(1);
    expect(txs()[0].id).toBe(real.id);
    expect(dbRow(real.id)).toBeTruthy();
    expect(balanceOf('acc1')).toBe(1500);
  });

  it('reconcile swaps the optimistic row for the normalized persisted row', async () => {
    const promise = useTransactionsStore.getState().add({
      type: 'out',
      amount: 50,
      accountId: 'acc1',
      payee: '  Coffee  ',
      note: '  hi  ',
      date: DATE,
    });

    // Optimistic row shows the raw (untrimmed) text.
    expect(txs()[0].payee).toBe('  Coffee  ');

    await promise;

    // After reconcile it matches DB truth (service trims via normalizeText).
    expect(txs()[0].payee).toBe('Coffee');
    expect(txs()[0].note).toBe('hi');
  });

  it('inserts BOTH transfer legs synchronously and reconciles both to persisted ids', async () => {
    const promise = useTransactionsStore.getState().add({
      type: 'transfer',
      amount: 300,
      accountId: 'acc1',
      linkedAccountId: 'acc2',
      date: DATE,
    });

    // Pre-await: both legs must be present immediately (regression guard — the 'in'
    // leg used to be missing until a full reload).
    const mid = txs();
    expect(mid).toHaveLength(2);
    const midOut = mid.find((t) => t.type === 'out')!;
    const midIn = mid.find((t) => t.type === 'in')!;
    expect(midOut.accountId).toBe('acc1');
    expect(midOut.linkedAccountId).toBe('acc2');
    expect(midIn.accountId).toBe('acc2');
    expect(midIn.linkedAccountId).toBe('acc1');
    expect(midOut.transferPairId).toBeTruthy();
    expect(midOut.transferPairId).toBe(midIn.transferPairId);

    // Both account balances move optimistically.
    expect(balanceOf('acc1')).toBe(700);
    expect(balanceOf('acc2')).toBe(800);

    await promise;

    // Post-reconcile: both legs carry real, persisted ids + the same persisted pair id.
    const after = txs();
    expect(after).toHaveLength(2);
    for (const leg of after) {
      expect(dbRow(leg.id)).toBeTruthy();
    }
    const pairIds = new Set(after.map((t) => t.transferPairId));
    expect(pairIds.size).toBe(1);
    const dbPairs = sqlite.prepare('SELECT DISTINCT transfer_pair_id FROM transactions').all() as any[];
    expect(dbPairs).toHaveLength(1);
    expect([...pairIds][0]).toBe(dbPairs[0].transfer_pair_id);
    expect(balanceOf('acc1')).toBe(700);
    expect(balanceOf('acc2')).toBe(800);
  });

  it('rolls back an in transaction when the DB write fails', async () => {
    // 'ghost' violates the account_id foreign key → createTransaction throws.
    await expect(
      useTransactionsStore.getState().add({ type: 'in', amount: 100, accountId: 'ghost', date: DATE }),
    ).rejects.toThrow();

    expect(txs()).toHaveLength(0);
    expect(dbCount()).toBe(0);
    expect(useGlobalNotice.getState().message).toBeTruthy();
  });

  it('rolls back BOTH transfer legs and balances when the DB write fails', async () => {
    // Same source + destination → assertValidTransferAccounts throws after the
    // optimistic two-leg insert has already run.
    await expect(
      useTransactionsStore.getState().add({
        type: 'transfer',
        amount: 300,
        accountId: 'acc1',
        linkedAccountId: 'acc1',
        date: DATE,
      }),
    ).rejects.toThrow();

    expect(txs()).toHaveLength(0);
    expect(dbCount()).toBe(0);
    expect(balanceOf('acc1')).toBe(1000);
    expect(useGlobalNotice.getState().message).toBeTruthy();
  });

  it('reverses BOTH account balances when a real two-account transfer fails at the DB', async () => {
    // The same-source/dest test above can't verify the destination balance was
    // restored (acc1 ends up net-zero either way). This test mocks the service to
    // reject AFTER the optimistic two-leg insert + two-account delta apply, then
    // asserts BOTH balances are restored to their seeded values.
    const spy = jest
      .spyOn(transactionsService, 'createTransaction')
      .mockRejectedValueOnce(new Error('boom'));

    await expect(
      useTransactionsStore.getState().add({
        type: 'transfer',
        amount: 300,
        accountId: 'acc1',
        linkedAccountId: 'acc2',
        date: DATE,
      }),
    ).rejects.toThrow('boom');
    spy.mockRestore();

    expect(txs()).toHaveLength(0);
    expect(dbCount()).toBe(0);
    expect(balanceOf('acc1')).toBe(1000);
    expect(balanceOf('acc2')).toBe(500);
    expect(useGlobalNotice.getState().message).toBeTruthy();
  });
});

describe('useTransactionsStore — optimistic update', () => {
  it('patches an in/out edit synchronously and swaps the balance delta', async () => {
    const real = await useTransactionsStore.getState().add({
      type: 'out',
      amount: 200,
      accountId: 'acc1',
      date: DATE,
    });
    expect(balanceOf('acc1')).toBe(800);

    const promise = useTransactionsStore.getState().update(real.id, { amount: 350 });

    // Optimistic patch is applied before the DB write resolves.
    expect(txs()[0].amount).toBe(350);
    expect(balanceOf('acc1')).toBe(650);

    await promise;

    expect(dbRow(real.id).amount).toBe(350);
    expect(balanceOf('acc1')).toBe(650);
  });

  it('reverts an in/out edit when the DB write fails', async () => {
    const real = await useTransactionsStore.getState().add({
      type: 'out',
      amount: 200,
      accountId: 'acc1',
      date: DATE,
    });

    // Moving the row to a non-existent account fails the FK on the re-apply.
    await expect(
      useTransactionsStore.getState().update(real.id, { accountId: 'ghost' }),
    ).rejects.toThrow();

    // Optimistic state restored to the original row + balance.
    expect(txs()[0].accountId).toBe('acc1');
    expect(txs()[0].amount).toBe(200);
    expect(balanceOf('acc1')).toBe(800);
    expect(useGlobalNotice.getState().message).toBeTruthy();
  });
});

describe('useTransactionsStore — optimistic remove', () => {
  it('removes an in/out transaction synchronously, reverses balance, deletes the row', async () => {
    const real = await useTransactionsStore.getState().add({
      type: 'out',
      amount: 200,
      accountId: 'acc1',
      date: DATE,
    });
    expect(balanceOf('acc1')).toBe(800);

    const promise = useTransactionsStore.getState().remove(real.id);

    // Optimistic removal happens before the DB delete resolves.
    expect(txs()).toHaveLength(0);
    expect(balanceOf('acc1')).toBe(1000);

    await promise;
    expect(dbRow(real.id)).toBeUndefined();
  });

  it('transfer delete drops BOTH legs from the store and restores both balances', async () => {
    await useTransactionsStore.getState().add({
      type: 'transfer',
      amount: 300,
      accountId: 'acc1',
      linkedAccountId: 'acc2',
      date: DATE,
    });
    expect(txs()).toHaveLength(2);
    expect(balanceOf('acc1')).toBe(700);
    expect(balanceOf('acc2')).toBe(800);

    const outLeg = txs().find((t) => t.type === 'out')!;
    await useTransactionsStore.getState().remove(outLeg.id);

    // DB cascades by transferPairId, and the store now drops the sibling leg too —
    // no reload required.
    expect(dbCount()).toBe(0);
    expect(txs()).toHaveLength(0);
    // Both account balances are restored (transfer legs read neutral via
    // getTransactionBalanceDelta, so rowBalanceDelta handles them explicitly).
    expect(balanceOf('acc1')).toBe(1000);
    expect(balanceOf('acc2')).toBe(500);
  });

  it('split delete drops the whole group from the store and restores balance', async () => {
    // Build a split group out of two plain rows (the test schema has no categories
    // table, so we form the group directly rather than via createSplitTransactionGroup).
    const a = await useTransactionsStore.getState().add({ type: 'out', amount: 100, accountId: 'acc1', date: DATE });
    const b = await useTransactionsStore.getState().add({ type: 'out', amount: 50, accountId: 'acc1', date: DATE });
    expect(balanceOf('acc1')).toBe(850);

    const groupId = 'split-grp-1';
    sqlite.prepare('UPDATE transactions SET split_group_id = ? WHERE id IN (?, ?)').run(groupId, a.id, b.id);
    useTransactionsStore.setState({
      transactions: txs().map((t) => (t.id === a.id || t.id === b.id ? { ...t, splitGroupId: groupId } : t)),
    });

    await useTransactionsStore.getState().remove(a.id);

    expect(dbCount()).toBe(0);
    expect(txs()).toHaveLength(0);
    expect(balanceOf('acc1')).toBe(1000);
  });

  it('reverts a delete (rows + balances) when the DB delete fails', async () => {
    const real = await useTransactionsStore.getState().add({ type: 'out', amount: 200, accountId: 'acc1', date: DATE });
    expect(balanceOf('acc1')).toBe(800);

    const spy = jest
      .spyOn(transactionsService, 'deleteTransaction')
      .mockRejectedValueOnce(new Error('boom'));

    await expect(useTransactionsStore.getState().remove(real.id)).rejects.toThrow('boom');
    spy.mockRestore();

    // Optimistic removal rolled back: row + balance restored, DB untouched, notice shown.
    expect(txs()).toHaveLength(1);
    expect(txs()[0].id).toBe(real.id);
    expect(balanceOf('acc1')).toBe(800);
    expect(dbRow(real.id)).toBeTruthy();
    expect(useGlobalNotice.getState().message).toBeTruthy();
  });
});
