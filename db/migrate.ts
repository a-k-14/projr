import { sqlite } from './client';

async function hasColumn(table: string, column: string): Promise<boolean> {
  const rows = await sqlite.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((row) => row.name === column);
}

async function ensureColumn(table: string, column: string, definition: string): Promise<boolean> {
  if (await hasColumn(table, column)) return false;
  await sqlite.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  return true;
}

async function hasForeignKey(table: string, fromColumn: string, referencedTable: string): Promise<boolean> {
  const rows = await sqlite.getAllAsync<{ from: string; table: string }>(
    `PRAGMA foreign_key_list(${table})`
  );
  return rows.some((row) => row.from === fromColumn && row.table === referencedTable);
}

async function dropLegacySplitDataColumn() {
  if (!(await hasColumn('transactions', 'split_data'))) return;

  await sqlite.execAsync(`
    BEGIN TRANSACTION;

    ALTER TABLE transactions RENAME TO transactions_legacy;

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
      date TEXT NOT NULL,
      transfer_pair_id TEXT,
      created_at TEXT NOT NULL
    );

    INSERT INTO transactions (
      id,
      type,
      amount,
      account_id,
      split_group_id,
      linked_account_id,
      loan_id,
      category_id,
      tags,
      payee,
      note,
      date,
      transfer_pair_id,
      created_at
    )
    SELECT
      id,
      type,
      amount,
      account_id,
      split_group_id,
      linked_account_id,
      loan_id,
      category_id,
      tags,
      payee,
      note,
      date,
      transfer_pair_id,
      created_at
    FROM transactions_legacy;

    DROP TABLE transactions_legacy;

    COMMIT;
  `);
}

async function rebuildTablesWithForeignKeys() {
  const needsTransactionsFk = !(await hasForeignKey('transactions', 'account_id', 'accounts'));
  const needsLoansFk = !(await hasForeignKey('loans', 'account_id', 'accounts'));
  const needsBudgetFk = !(await hasForeignKey('budget', 'category_id', 'categories'));

  if (!needsTransactionsFk && !needsLoansFk && !needsBudgetFk) {
    return;
  }

  await sqlite.execAsync(`PRAGMA foreign_keys = OFF;`);

  try {
    await sqlite.execAsync(`
      BEGIN TRANSACTION;

      DELETE FROM transactions
      WHERE account_id NOT IN (SELECT id FROM accounts);

      DELETE FROM loans
      WHERE account_id NOT IN (SELECT id FROM accounts);

      DELETE FROM budget
      WHERE category_id NOT IN (SELECT id FROM categories);

      ALTER TABLE transactions RENAME TO transactions_legacy_fk;
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
        date TEXT NOT NULL,
        transfer_pair_id TEXT,
        created_at TEXT NOT NULL
      );
      INSERT INTO transactions (
        id,
        type,
        amount,
        account_id,
        split_group_id,
        linked_account_id,
        loan_id,
        category_id,
        tags,
        payee,
        note,
        date,
        transfer_pair_id,
        created_at
      )
      SELECT
        id,
        type,
        amount,
        account_id,
        split_group_id,
        linked_account_id,
        loan_id,
        category_id,
        tags,
        payee,
        note,
        date,
        transfer_pair_id,
        created_at
      FROM transactions_legacy_fk;
      DROP TABLE transactions_legacy_fk;

      ALTER TABLE loans RENAME TO loans_legacy_fk;
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
      INSERT INTO loans (
        id,
        person_name,
        direction,
        account_id,
        given_amount,
        status,
        note,
        tags,
        date,
        created_at
      )
      SELECT
        id,
        person_name,
        direction,
        account_id,
        given_amount,
        status,
        note,
        tags,
        date,
        created_at
      FROM loans_legacy_fk;
      DROP TABLE loans_legacy_fk;

      ALTER TABLE budget RENAME TO budget_legacy_fk;
      CREATE TABLE budget (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
        amount REAL NOT NULL,
        period TEXT NOT NULL DEFAULT 'month',
        start_date TEXT NOT NULL,
        repeat INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      INSERT INTO budget (
        id,
        category_id,
        amount,
        period,
        start_date,
        repeat,
        created_at
      )
      SELECT
        id,
        category_id,
        amount,
        period,
        start_date,
        repeat,
        created_at
      FROM budget_legacy_fk;
      DROP TABLE budget_legacy_fk;

      COMMIT;
    `);
  } catch (error) {
    await sqlite.execAsync(`ROLLBACK;`).catch(() => undefined);
    throw error;
  } finally {
    await sqlite.execAsync(`PRAGMA foreign_keys = ON;`);
  }
}

async function normalizeAccountNumbersToLast4() {
  const rows = await sqlite.getAllAsync<{ id: string; account_number: string | null }>(
    `SELECT id, account_number FROM accounts`
  );

  for (const row of rows) {
    const value = row.account_number?.trim();
    if (!value) continue;

    const normalized = value.replace(/\s+/g, '').slice(-4);
    if (normalized && normalized !== value) {
      await sqlite.runAsync(`UPDATE accounts SET account_number = ? WHERE id = ?`, normalized, row.id);
    }
  }
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
      account_number TEXT,
      initial_balance REAL NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS loans (
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

    CREATE TABLE IF NOT EXISTS budget (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      amount REAL NOT NULL,
      period TEXT NOT NULL DEFAULT 'month',
      start_date TEXT NOT NULL,
      repeat INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
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
      date TEXT NOT NULL,
      transfer_pair_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  await ensureColumn('transactions', 'split_group_id', 'TEXT');
  await ensureColumn('transactions', 'payee', 'TEXT');
  await ensureColumn('accounts', 'account_number', 'TEXT');
  await ensureColumn('accounts', 'initial_balance', 'REAL');
  await ensureColumn('budget', 'repeat', 'INTEGER NOT NULL DEFAULT 1');
  await dropLegacySplitDataColumn();
  await rebuildTablesWithForeignKeys();
  await normalizeAccountNumbersToLast4();
  await sqlite.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_loan ON transactions(loan_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_split_group ON transactions(split_group_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_transfer_pair ON transactions(transfer_pair_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON transactions(account_id, date);
    CREATE INDEX IF NOT EXISTS idx_budget_category_start ON budget(category_id, start_date);
    CREATE INDEX IF NOT EXISTS idx_loans_account_status_date ON loans(account_id, status, date);
    CREATE INDEX IF NOT EXISTS idx_categories_parent_type ON categories(parent_id, type);
  `);
  const addedSortOrder = await ensureColumn('accounts', 'sort_order', 'INTEGER NOT NULL DEFAULT 0');

  if (addedSortOrder) {
    const rows = await sqlite.getAllAsync<{ id: string }>(`SELECT id FROM accounts ORDER BY created_at ASC`);
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      await sqlite.execAsync(`UPDATE accounts SET sort_order = ${index} WHERE id = '${row.id}';`);
    }
  }
}
