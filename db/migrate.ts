import { sqlite } from './client';

async function hasColumn(table: string, column: string): Promise<boolean> {
  const rows = await sqlite.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((row) => row.name === column);
}

async function ensureColumn(table: string, column: string, definition: string): Promise<void> {
  if (await hasColumn(table, column)) return;
  await sqlite.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
}

export async function runMigrations() {
  await sqlite.execAsync(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'INR',
      color TEXT NOT NULL DEFAULT '#1B4332',
      icon TEXT NOT NULL DEFAULT 'wallet',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      icon TEXT NOT NULL DEFAULT 'tag',
      color TEXT NOT NULL DEFAULT '#6B7280',
      type TEXT NOT NULL DEFAULT 'both'
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6B7280'
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      account_id TEXT NOT NULL,
      linked_account_id TEXT,
      loan_id TEXT,
      category_id TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      split_data TEXT NOT NULL DEFAULT '[]',
      payee TEXT,
      note TEXT,
      date TEXT NOT NULL,
      transfer_pair_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_loan ON transactions(loan_id);

    CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY,
      person_name TEXT NOT NULL,
      direction TEXT NOT NULL,
      account_id TEXT NOT NULL,
      given_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      note TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS budget (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      amount REAL NOT NULL,
      period TEXT NOT NULL DEFAULT 'month',
      start_date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  await ensureColumn('transactions', 'split_data', "TEXT NOT NULL DEFAULT '[]'");
  await ensureColumn('transactions', 'payee', 'TEXT');
  await ensureColumn('accounts', 'account_number', 'TEXT');
  await ensureColumn('accounts', 'initial_balance', 'REAL');
}
