import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  balance: real('balance').notNull().default(0),
  currency: text('currency').notNull().default('INR'),
  color: text('color').notNull().default('#1B4332'),
  icon: text('icon').notNull().default('wallet'),
  accountNumber: text('account_number'),
  initialBalance: real('initial_balance').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  parentId: text('parent_id'),
  icon: text('icon').notNull().default('tag'),
  color: text('color').notNull().default('#6B7280'),
  type: text('type').notNull().default('both'),
});

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6B7280'),
});

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  amount: real('amount').notNull(),
  accountId: text('account_id').notNull().references(() => accounts.id),
  linkedAccountId: text('linked_account_id'),
  loanId: text('loan_id'),
  categoryId: text('category_id'),
  payee: text('payee'),
  tags: text('tags').notNull().default('[]'),
  splitData: text('split_data').notNull().default('[]'),
  note: text('note'),
  date: text('date').notNull(),
  transferPairId: text('transfer_pair_id'),
  createdAt: text('created_at').notNull(),
});

export const loans = sqliteTable('loans', {
  id: text('id').primaryKey(),
  personName: text('person_name').notNull(),
  direction: text('direction').notNull(),
  accountId: text('account_id').notNull().references(() => accounts.id),
  givenAmount: real('given_amount').notNull(),
  status: text('status').notNull().default('open'),
  note: text('note'),
  tags: text('tags').notNull().default('[]'),
  date: text('date').notNull(),
  createdAt: text('created_at').notNull(),
});

export const budget = sqliteTable('budget', {
  id: text('id').primaryKey(),
  categoryId: text('category_id')
    .notNull()
    .references(() => categories.id),
  amount: real('amount').notNull(),
  period: text('period').notNull(), // 'month' | 'year'
  startDate: text('start_date').notNull(),
  createdAt: text('created_at').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
