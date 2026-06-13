import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema.ts';

const sqlite = new Database(':memory:');
sqlite.pragma('foreign_keys = ON');
const db = drizzle(sqlite, { schema });

// Patch sync transaction to async for compatibility in testing
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

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///tmp/reni-test/',
  getInfoAsync: jest.fn(async () => ({ exists: true })),
  makeDirectoryAsync: jest.fn(async () => undefined),
  copyAsync: jest.fn(async () => undefined),
  deleteAsync: jest.fn(async () => undefined),
}));

import { createTransaction, updateTransaction, deleteTransaction } from '../services/transactions.ts';
import { getAuditLogs, clearAuditLogs, pruneAuditLogs } from '../services/audit.ts';

beforeEach(() => {
  sqlite.exec(`
    DROP TABLE IF EXISTS audit_logs;
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
  `);
});

describe('Audit logs integration', () => {
  it('should write a create log when a transaction is created', async () => {
    const tx = await createTransaction({
      type: 'in',
      amount: 500,
      accountId: 'acc1',
      date: '2024-01-02T12:00:00.000Z'
    });

    const logs = await getAuditLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('create');
    expect(logs[0].tableName).toBe('transactions');
    expect(logs[0].recordId).toBe(tx.id);
    expect(logs[0].payloadBefore).toBeNull();
    
    const payloadAfter = JSON.parse(logs[0].payloadAfter || '{}');
    expect(payloadAfter.id).toBe(tx.id);
    expect(payloadAfter.amount).toBe(500);
  });

  it('should write an update log when a transaction is modified', async () => {
    const tx = await createTransaction({
      type: 'out',
      amount: 200,
      accountId: 'acc1',
      date: '2024-01-02T12:00:00.000Z'
    });

    await new Promise(resolve => setTimeout(resolve, 2));
    await updateTransaction(tx.id, { amount: 350, payee: 'Food Court' });

    const logs = await getAuditLogs();
    // 1 create log + 1 update log = 2 logs
    expect(logs).toHaveLength(2);
    
    // Sort order of getAuditLogs is timestamp DESC, so index 0 is the update log
    const updateLog = logs[0];
    expect(updateLog.action).toBe('update');
    expect(updateLog.tableName).toBe('transactions');
    expect(updateLog.recordId).toBe(tx.id);

    const payloadBefore = JSON.parse(updateLog.payloadBefore || '{}');
    const payloadAfter = JSON.parse(updateLog.payloadAfter || '{}');

    expect(payloadBefore.amount).toBe(200);
    expect(payloadBefore.payee).toBeUndefined();
    
    expect(payloadAfter.amount).toBe(350);
    expect(payloadAfter.payee).toBe('Food Court');
  });

  it('should write a delete log when a transaction is deleted', async () => {
    const tx = await createTransaction({
      type: 'out',
      amount: 100,
      accountId: 'acc1',
      date: '2024-01-02T12:00:00.000Z'
    });

    await new Promise(resolve => setTimeout(resolve, 2));
    await deleteTransaction(tx.id);

    const logs = await getAuditLogs();
    // Only the delete log remains as earlier logs are cleared cascade-style
    expect(logs).toHaveLength(1);

    const deleteLog = logs[0];
    expect(deleteLog.action).toBe('delete');
    expect(deleteLog.payloadAfter).toBeNull();

    const payloadBefore = JSON.parse(deleteLog.payloadBefore || '{}');
    expect(payloadBefore.id).toBe(tx.id);
    expect(payloadBefore.amount).toBe(100);
  });

  it('should support clearing all change history logs', async () => {
    await createTransaction({
      type: 'in',
      amount: 100,
      accountId: 'acc1',
      date: '2024-01-02T12:00:00.000Z'
    });

    let logs = await getAuditLogs();
    expect(logs).toHaveLength(1);

    await clearAuditLogs();
    logs = await getAuditLogs();
    expect(logs).toHaveLength(0);
  });

  it('should support pruning old change logs', async () => {
    // We insert a log directly into SQLite with a timestamp in the past
    sqlite.exec(`
      INSERT INTO audit_logs (id, action, table_name, record_id, timestamp)
      VALUES ('past_log', 'create', 'transactions', 'tx1', '2020-01-01T00:00:00.000Z');
      
      INSERT INTO audit_logs (id, action, table_name, record_id, timestamp)
      VALUES ('recent_log', 'create', 'transactions', 'tx2', '${new Date().toISOString()}');
    `);

    let logs = await getAuditLogs();
    expect(logs).toHaveLength(2);

    await pruneAuditLogs(90); // 90 days retention

    logs = await getAuditLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe('recent_log');
  });
});
