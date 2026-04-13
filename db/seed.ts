import { toUTCMidnight } from '../lib/dateUtils';
import { db } from './client';
import { accounts, categories, tags, transactions, loans, budget, settings } from './schema';
import * as accountsService from '../services/accounts';
import * as categoriesService from '../services/categories';
import * as tagsService from '../services/tags';
import * as transactionsService from '../services/transactions';
import * as loansService from '../services/loans';

function daysAgo(n: number): string {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return toUTCMidnight(date);
}

async function clearDemoData(): Promise<void> {
  await db.delete(transactions);
  await db.delete(loans);
  await db.delete(budget);
  await db.delete(tags);
  await db.delete(categories);
  await db.delete(settings);
  await db.delete(accounts);
}

export async function seedDatabase(): Promise<void> {
  const existing = await accountsService.getAccounts();
  const sampleNames = ['SBI Savings Account', 'Cash', 'HDFC Credit Card'];
  const looksLikeStarterData =
    existing.length === sampleNames.length &&
    existing.every((account) => sampleNames.includes(account.name));

  if (existing.length > 0 && !looksLikeStarterData) return;
  if (looksLikeStarterData) {
    await clearDemoData();
  }

  // Accounts
  const sbi = await accountsService.createAccount({
    name: 'SBI Savings Account',
    type: 'savings',
    balance: 0,
    initialBalance: 0,
    color: '#1B4332',
    icon: 'briefcase',
  });
  const cash = await accountsService.createAccount({
    name: 'Cash',
    type: 'cash',
    balance: 0,
    initialBalance: 0,
    color: '#B45309',
    icon: 'dollar-sign',
  });
  const hdfc = await accountsService.createAccount({
    name: 'HDFC Credit Card',
    type: 'credit',
    balance: 0,
    initialBalance: 0,
    color: '#DC2626',
    icon: 'credit-card',
  });

  // Categories
  const food = await categoriesService.createCategory({
    name: 'Food',
    icon: 'coffee',
    color: '#F59E0B',
    type: 'out',
  });
  const transport = await categoriesService.createCategory({
    name: 'Transport',
    icon: 'truck',
    color: '#3B82F6',
    type: 'out',
  });
  const shopping = await categoriesService.createCategory({
    name: 'Shopping',
    icon: 'shopping-cart',
    color: '#8B5CF6',
    type: 'out',
  });
  const bills = await categoriesService.createCategory({
    name: 'Bills',
    icon: 'archive',
    color: '#EF4444',
    type: 'out',
  });
  const incomeParent = await categoriesService.createCategory({
    name: 'Income',
    icon: 'trending-up',
    color: '#10B981',
    type: 'in',
  });

  const groceries = await categoriesService.createCategory({
    name: 'Groceries',
    icon: 'shopping-cart',
    color: '#F59E0B',
    type: 'out',
    parentId: food.id,
  });
  const restaurants = await categoriesService.createCategory({
    name: 'Restaurants',
    icon: 'coffee',
    color: '#F59E0B',
    type: 'out',
    parentId: food.id,
  });
  const cab = await categoriesService.createCategory({
    name: 'Cab',
    icon: 'truck',
    color: '#3B82F6',
    type: 'out',
    parentId: transport.id,
  });
  const online = await categoriesService.createCategory({
    name: 'Online',
    icon: 'globe',
    color: '#8B5CF6',
    type: 'out',
    parentId: shopping.id,
  });
  const electricity = await categoriesService.createCategory({
    name: 'Electricity',
    icon: 'zap',
    color: '#EF4444',
    type: 'out',
    parentId: bills.id,
  });
  const salary = await categoriesService.createCategory({
    name: 'Base Pay',
    icon: 'briefcase',
    color: '#10B981',
    type: 'in',
    parentId: incomeParent.id,
  });

  // Tags
  const officeTag = await tagsService.createTag({ name: 'Office', color: '#3B82F6' });
  const paytmTag = await tagsService.createTag({ name: 'Paytm', color: '#6366F1' });
  await tagsService.createTag({ name: 'Personal', color: '#8B5CF6' });

  // Transactions — balance is updated by createTransaction
  await transactionsService.createTransaction({
    type: 'in',
    amount: 13268050,
    accountId: sbi.id,
    categoryId: salary.id,
    date: daysAgo(0),
    note: 'Salary credit',
  });
  await transactionsService.createTransaction({
    type: 'out',
    amount: 2340000.5,
    accountId: sbi.id,
    categoryId: groceries.id,
    date: daysAgo(0),
    note: 'Groceries',
  });
  await transactionsService.createTransaction({
    type: 'out',
    amount: 459900.25,
    accountId: hdfc.id,
    categoryId: online.id,
    date: daysAgo(0),
    note: 'Amazon order',
  });
  await transactionsService.createTransaction({
    type: 'out',
    amount: 380000,
    accountId: cash.id,
    categoryId: cab.id,
    date: daysAgo(0),
    note: 'Uber ride',
    tags: [officeTag.id, paytmTag.id],
  });

  await transactionsService.createTransaction({
    type: 'in',
    amount: 8500000,
    accountId: sbi.id,
    categoryId: salary.id,
    date: daysAgo(7),
    note: 'March salary',
  });
  await transactionsService.createTransaction({
    type: 'out',
    amount: 234000,
    accountId: sbi.id,
    categoryId: groceries.id,
    date: daysAgo(1),
    note: 'Groceries',
  });
  await transactionsService.createTransaction({
    type: 'out',
    amount: 38000,
    accountId: cash.id,
    categoryId: cab.id,
    date: daysAgo(2),
    note: 'Uber ride',
    tags: [officeTag.id, paytmTag.id],
  });
  await transactionsService.createTransaction({
    type: 'out',
    amount: 459900,
    accountId: hdfc.id,
    categoryId: online.id,
    date: daysAgo(2),
    note: 'Amazon order',
  });
  await transactionsService.createTransaction({
    type: 'out',
    amount: 180000,
    accountId: sbi.id,
    categoryId: electricity.id,
    date: daysAgo(11),
    note: 'Electricity bill',
  });
  await transactionsService.createTransaction({
    type: 'in',
    amount: 1500000,
    accountId: cash.id,
    categoryId: incomeParent.id,
    date: daysAgo(14),
    note: 'Cash withdrawal',
  });
  await transactionsService.createTransaction({
    type: 'out',
    amount: 65000,
    accountId: cash.id,
    categoryId: restaurants.id,
    date: daysAgo(5),
    note: 'Lunch',
  });
  await transactionsService.createTransaction({
    type: 'out',
    amount: 1250000.75,
    accountId: sbi.id,
    categoryId: electricity.id,
    date: daysAgo(4),
    note: 'Electricity bill',
  });
  await transactionsService.createTransaction({
    type: 'out',
    amount: 275000,
    accountId: hdfc.id,
    categoryId: online.id,
    date: daysAgo(9),
    note: 'Subscription renewal',
  });
  await transactionsService.createTransaction({
    type: 'out',
    amount: 100000,
    accountId: cash.id,
    categoryId: restaurants.id,
    date: daysAgo(3),
    note: 'Dinner',
  });

  // Loans
  await loansService.createLoan({
    personName: 'Ravi Kumar',
    direction: 'lent',
    accountId: cash.id,
    givenAmount: 10000000,
    note: 'For bike repair',
    date: daysAgo(13),
  });
  const meenaLoan = await loansService.createLoan({
    personName: 'Meena',
    direction: 'lent',
    accountId: sbi.id,
    givenAmount: 5000000,
    note: 'Emergency',
    date: daysAgo(50),
  });
  await loansService.recordLoanPayment(meenaLoan.id, 2000000, daysAgo(20));

  const priyaLoan = await loansService.createLoan({
    personName: 'Priya',
    direction: 'borrowed',
    accountId: cash.id,
    givenAmount: 20000000,
    note: 'Emergency medical',
    date: daysAgo(85),
  });
  await loansService.recordLoanPayment(priyaLoan.id, 8000000, daysAgo(45));
}
