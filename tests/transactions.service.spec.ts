import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema.ts';

const sqlite = new Database(':memory:');
sqlite.pragma('foreign_keys = ON');
const db = drizzle(sqlite, { schema });

const originalTransaction = db.transaction.bind(db);
// @ts-ignore - patching sync transaction to async for test compatibility
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

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///tmp/reni-test/',
  getInfoAsync: jest.fn(async () => ({ exists: true })),
  makeDirectoryAsync: jest.fn(async () => undefined),
  copyAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
}));

import * as FileSystem from 'expo-file-system/legacy';
import { createTransaction, getTransactions, updateTransaction } from '../services/transactions.ts';

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
});

describe('transactions database integration', () => {
    it('creates an IN transaction and correctly increments account balance', async () => {
        const tx = await createTransaction({
            type: 'in',
            amount: 500,
            accountId: 'acc1',
            date: '2024-01-02T12:00:00.000Z'
        });
        
        expect(tx).toBeDefined();
        expect(tx.amount).toBe(500);

        const rows = sqlite.prepare("SELECT balance FROM accounts WHERE id = 'acc1'").all();
        expect((rows[0] as any).balance).toBe(1500); // 1000 + 500
    });

    it('creates an OUT transaction and correctly decrements account balance', async () => {
        const tx = await createTransaction({
            type: 'out',
            amount: 200,
            accountId: 'acc1',
            date: '2024-01-02T12:00:00.000Z'
        });

        expect(tx).toBeDefined();
        
        const rows = sqlite.prepare("SELECT balance FROM accounts WHERE id = 'acc1'").all();
        expect((rows[0] as any).balance).toBe(800); // 1000 - 200
    });

    it('creates a TRANSFER transaction and balances cleanly', async () => {
        const tx = await createTransaction({
            type: 'transfer',
            amount: 300,
            accountId: 'acc1',
            linkedAccountId: 'acc2',
            date: '2024-01-02T12:00:00.000Z'
        });

        // Sender account (-300)
        let row = sqlite.prepare("SELECT balance FROM accounts WHERE id = 'acc1'").get();
        expect((row as any).balance).toBe(700);

        // Receiver account (+300)
        row = sqlite.prepare("SELECT balance FROM accounts WHERE id = 'acc2'").get();
        expect((row as any).balance).toBe(800);
        
        // Also verify the returned transaction models are created properly under the hood
        const list = await getTransactions();
        expect(list.length).toBe(2);
        expect(list.some(t => t.type === 'out')).toBeTruthy();
        expect(list.some(t => t.type === 'in')).toBeTruthy();
    });
    
    it('rolls back and applies correctly on UPDATE transaction', async () => {
        const tx = await createTransaction({
            type: 'out',
            amount: 200,
            accountId: 'acc1',
            date: '2024-01-02T12:00:00.000Z'
        });
        let row = sqlite.prepare("SELECT balance FROM accounts WHERE id = 'acc1'").get();
        expect((row as any).balance).toBe(800); // 1000 - 200

        await updateTransaction(tx.id, { amount: 350 });

        row = sqlite.prepare("SELECT balance FROM accounts WHERE id = 'acc1'").get();
        // Should rollback +200, then apply -350 = 650
        expect((row as any).balance).toBe(650);
    });

    it('copies and stores receipt image paths for transactions', async () => {
        const tx = await createTransaction({
            type: 'out',
            amount: 200,
            accountId: 'acc1',
            receiptImageUris: ['file:///tmp/source-receipt.jpg', 'file:///tmp/second-receipt.jpg'],
            date: '2024-01-02T12:00:00.000Z'
        });

        const receiptImageUris = tx.receiptImageUris ?? [];
        expect(receiptImageUris).toHaveLength(2);
        expect(receiptImageUris[0]).toContain(`/receipts/${tx.id}/receipt-`);
        expect(FileSystem.copyAsync).toHaveBeenCalledWith(
            expect.objectContaining({
                from: 'file:///tmp/source-receipt.jpg',
                to: receiptImageUris[0],
            })
        );

        const row = sqlite.prepare('SELECT receipt_image_uris FROM transactions WHERE id = ?').get(tx.id) as any;
        expect(JSON.parse(row.receipt_image_uris)).toEqual(receiptImageUris);
    });
});
