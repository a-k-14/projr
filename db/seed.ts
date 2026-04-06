import { toUTCMidnight } from '../lib/dateUtils';
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

export async function seedDatabase(): Promise<void> {
  const existing = await accountsService.getAccounts();
  if (existing.length > 0) return;

  // Accounts
  const sbi = await accountsService.createAccount({
    name: 'SBI Savings Account',
    type: 'savings',
    balance: 0,
    color: '#1B4332',
    icon: 'business',
  });
  const cash = await accountsService.createAccount({
    name: 'Cash',
    type: 'cash',
    balance: 0,
    color: '#B45309',
    icon: 'cash',
  });
  const hdfc = await accountsService.createAccount({
    name: 'HDFC Credit Card',
    type: 'credit',
    balance: 0,
    color: '#DC2626',
    icon: 'card',
  });

  // Categories
  const food = await categoriesService.createCategory({
    name: 'Food',
    icon: 'restaurant',
    color: '#F59E0B',
    type: 'out',
  });
  const transport = await categoriesService.createCategory({
    name: 'Transport',
    icon: 'car',
    color: '#3B82F6',
    type: 'out',
  });
  const shopping = await categoriesService.createCategory({
    name: 'Shopping',
    icon: 'bag',
    color: '#8B5CF6',
    type: 'out',
  });
  const bills = await categoriesService.createCategory({
    name: 'Bills',
    icon: 'receipt',
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
    icon: 'cart',
    color: '#F59E0B',
    type: 'out',
    parentId: food.id,
  });
  const restaurants = await categoriesService.createCategory({
    name: 'Restaurants',
    icon: 'restaurant',
    color: '#F59E0B',
    type: 'out',
    parentId: food.id,
  });
  const cab = await categoriesService.createCategory({
    name: 'Cab',
    icon: 'car',
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
    icon: 'flash',
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
    amount: 85000,
    accountId: sbi.id,
    categoryId: salary.id,
    date: daysAgo(7),
    note: 'March salary',
  });
  await transactionsService.createTransaction({
    type: 'out',
    amount: 2340,
    accountId: sbi.id,
    categoryId: groceries.id,
    date: daysAgo(1),
    note: 'Groceries',
  });
  await transactionsService.createTransaction({
    type: 'out',
    amount: 380,
    accountId: cash.id,
    categoryId: cab.id,
    date: daysAgo(2),
    note: 'Uber ride',
    tags: [officeTag.id, paytmTag.id],
  });
  await transactionsService.createTransaction({
    type: 'out',
    amount: 4599,
    accountId: hdfc.id,
    categoryId: online.id,
    date: daysAgo(2),
    note: 'Amazon order',
  });
  await transactionsService.createTransaction({
    type: 'out',
    amount: 1800,
    accountId: sbi.id,
    categoryId: electricity.id,
    date: daysAgo(11),
    note: 'Electricity bill',
  });
  await transactionsService.createTransaction({
    type: 'in',
    amount: 15000,
    accountId: cash.id,
    categoryId: incomeParent.id,
    date: daysAgo(14),
    note: 'Cash withdrawal',
  });
  await transactionsService.createTransaction({
    type: 'out',
    amount: 650,
    accountId: cash.id,
    categoryId: restaurants.id,
    date: daysAgo(5),
    note: 'Lunch',
  });

  // Loans
  await loansService.createLoan({
    personName: 'Ravi Kumar',
    direction: 'lent',
    accountId: cash.id,
    givenAmount: 10000,
    note: 'For bike repair',
    date: daysAgo(13),
  });
  const meenaLoan = await loansService.createLoan({
    personName: 'Meena',
    direction: 'lent',
    accountId: sbi.id,
    givenAmount: 5000,
    note: 'Emergency',
    date: daysAgo(50),
  });
  await loansService.recordLoanPayment(meenaLoan.id, 2000, daysAgo(20));

  const priyaLoan = await loansService.createLoan({
    personName: 'Priya',
    direction: 'borrowed',
    accountId: cash.id,
    givenAmount: 20000,
    note: 'Emergency medical',
    date: daysAgo(85),
  });
  await loansService.recordLoanPayment(priyaLoan.id, 8000, daysAgo(45));
}
