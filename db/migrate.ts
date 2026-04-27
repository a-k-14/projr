import { sqlite } from './client';

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
      receipt_image_uris TEXT,
      date TEXT NOT NULL,
      transfer_pair_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

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

  try {
    const tableInfo = await sqlite.getAllAsync<{ name: string }>('PRAGMA table_info(transactions);');
    const hasReceiptCol = tableInfo.some((col) => col.name === 'receipt_image_uris');
    if (!hasReceiptCol) {
      await sqlite.execAsync('ALTER TABLE transactions ADD COLUMN receipt_image_uris TEXT;');
    }
  } catch (err) {
    console.warn('Migration patch error:', err);
  }

  // Migrate any stored Ionicons icon names to Feather equivalents
  try {
    const iconMap: Record<string, string> = {
      'cart-outline': 'shopping-cart',
      'bag-outline': 'shopping-bag',
      'pricetag-outline': 'tag',
      'gift-outline': 'gift',
      'cube-outline': 'box',
      'archive-outline': 'archive',
      'cafe-outline': 'coffee',
      'restaurant-outline': 'feather',
      'thermometer-outline': 'thermometer',
      'star-outline': 'star',
      'home-outline': 'home',
      'flash-outline': 'zap',
      'water-outline': 'droplet',
      'wifi-outline': 'wifi',
      'call-outline': 'phone',
      'tv-outline': 'tv',
      'construct-outline': 'tool',
      'settings-outline': 'settings',
      'car-outline': 'truck',
      'navigate-outline': 'navigation',
      'location-outline': 'map-pin',
      'map-outline': 'map',
      'boat-outline': 'anchor',
      'card-outline': 'credit-card',
      'cash-outline': 'dollar-sign',
      'briefcase-outline': 'briefcase',
      'trending-up-outline': 'trending-up',
      'trending-down-outline': 'trending-down',
      'bar-chart-outline': 'bar-chart-2',
      'pie-chart-outline': 'pie-chart',
      'heart-outline': 'heart',
      'pulse-outline': 'activity',
      'shield-outline': 'shield',
      'add-circle-outline': 'plus-circle',
      'person-outline': 'user',
      'musical-notes-outline': 'music',
      'film-outline': 'film',
      'camera-outline': 'camera',
      'headset-outline': 'headphones',
      'book-outline': 'book',
      'library-outline': 'book-open',
      'globe-outline': 'globe',
      'desktop-outline': 'monitor',
      'phone-portrait-outline': 'smartphone',
      'compass-outline': 'compass',
      'umbrella-outline': 'umbrella',
      'sunny-outline': 'sun',
      'cloud-outline': 'cloud',
      'flag-outline': 'wind',
      'create-outline': 'edit',
      'clipboard-outline': 'clipboard',
      'trophy-outline': 'award',
      'file-tray-full-outline': 'archive',
      'file-tray-outline': 'inbox',
      'layers-outline': 'layers',
      'grid-outline': 'grid',
      'ellipsis-horizontal-outline': 'more-horizontal',
      'ellipsis-horizontal': 'more-horizontal',
    };
    for (const [ionIcon, featherIcon] of Object.entries(iconMap)) {
      await sqlite.runAsync(
        `UPDATE categories SET icon = ? WHERE icon = ?`,
        [featherIcon, ionIcon]
      );
      await sqlite.runAsync(
        `UPDATE accounts SET icon = ? WHERE icon = ?`,
        [featherIcon, ionIcon]
      );
    }
  } catch (err) {
    console.warn('Icon migration patch error:', err);
  }
}
