import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema.ts';

const sqlite = new Database(':memory:');
sqlite.pragma('foreign_keys = ON');
const db = drizzle(sqlite, { schema });

// mock transaction to execute instantly
// @ts-ignore
db.transaction = async (cb: any) => {
  return await cb(db);
};

jest.mock('../db/client', () => {
  return {
    db,
    sqlite
  };
});

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID()
}));

import { createAccount, updateAccount } from '../services/accounts.ts';
import { createTag, updateTag } from '../services/tags.ts';

beforeEach(() => {
  sqlite.exec(`
    DROP TABLE IF EXISTS accounts;
    DROP TABLE IF EXISTS tags;
    
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

    CREATE TABLE tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL
    );
  `);
});

describe('uniqueness logical validations', () => {
  describe('accounts name uniqueness', () => {
    it('blocks duplicate account names on creation, case-insensitive', async () => {
      await createAccount({
        name: 'HDFC Savings',
        type: 'savings',
        balance: 1000,
        initialBalance: 1000,
        color: '#ff0000',
        icon: 'bank'
      });

      // Same name
      await expect(
        createAccount({
          name: 'HDFC Savings',
          type: 'savings',
          balance: 2000,
          initialBalance: 2000,
          color: '#00ff00',
          icon: 'wallet'
        })
      ).rejects.toThrow('An account with this name already exists.');

      // Same name, lowercase
      await expect(
        createAccount({
          name: 'hdfc savings',
          type: 'savings',
          balance: 2000,
          initialBalance: 2000,
          color: '#00ff00',
          icon: 'wallet'
        })
      ).rejects.toThrow('An account with this name already exists.');

      // Same name, spaces different
      await expect(
        createAccount({
          name: 'HDFC   Savings',
          type: 'savings',
          balance: 2000,
          initialBalance: 2000,
          color: '#00ff00',
          icon: 'wallet'
        })
      ).rejects.toThrow('An account with this name already exists.');
    });

    it('blocks duplicate account names on update', async () => {
      await createAccount({
        name: 'Wallet A',
        type: 'wallet',
        balance: 100,
        initialBalance: 100,
        color: '#ff0000',
        icon: 'wallet'
      });

      const a2 = await createAccount({
        name: 'Wallet B',
        type: 'wallet',
        balance: 200,
        initialBalance: 200,
        color: '#00ff00',
        icon: 'wallet'
      });

      // Update a2 to Wallet A (duplicate)
      await expect(
        updateAccount(a2.id, { name: 'wallet a' })
      ).rejects.toThrow('An account with this name already exists.');

      // Updating a2 to Wallet B (itself) is allowed
      await updateAccount(a2.id, { name: 'Wallet B' });
      await updateAccount(a2.id, { name: 'wallet b' });
    });
  });

  describe('tags name uniqueness', () => {
    it('blocks duplicate tag names on creation, case-insensitive', async () => {
      await createTag({
        name: 'Salary',
        color: '#ff0000'
      });

      // Same name
      await expect(
        createTag({
          name: 'Salary',
          color: '#00ff00'
        })
      ).rejects.toThrow('A tag with this name already exists.');

      // Same name, lowercase
      await expect(
        createTag({
          name: 'salary',
          color: '#00ff00'
        })
      ).rejects.toThrow('A tag with this name already exists.');

      // Same name, spaces
      await expect(
        createTag({
          name: 'Sal  ary',
          color: '#00ff00'
        })
      ).rejects.toThrow('A tag with this name already exists.');
    });

    it('blocks duplicate tag names on update', async () => {
      await createTag({ name: 'Tax', color: '#ff0000' });
      const t2 = await createTag({ name: 'Rent', color: '#00ff00' });

      // Update t2 to Tax (duplicate)
      await expect(
        updateTag(t2.id, { name: 'tax' })
      ).rejects.toThrow('A tag with this name already exists.');

      // Updating t2 to Rent (itself) is allowed
      await updateTag(t2.id, { name: 'Rent' });
      await updateTag(t2.id, { name: 'rent' });
    });
  });
});
