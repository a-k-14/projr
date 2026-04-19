import { toUTCMidnight } from '../lib/dateUtils';
import * as accountsService from '../services/accounts';
import * as categoriesService from '../services/categories';
import * as loansService from '../services/loans';
import * as tagsService from '../services/tags';
import * as transactionsService from '../services/transactions';
import { db } from './client';
import { accounts, budget, categories, loans, settings, tags, transactions } from './schema';

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
  // We check for these names specifically to avoid re-seeding if the user has already customized their accounts.
  const sampleNames = ['Cash', 'Credit Card', 'Wallet', 'Savings Account'];
  const looksLikeStarterData =
    existing.length > 0 &&
    existing.every((account) => sampleNames.includes(account.name));

  // If there's data and it doesn't look like our starter data, don't touch it.
  if (existing.length > 0 && !looksLikeStarterData) return;

  // If it's already seeded starter data, or if it's empty, we clear and re-seed (or fresh seed).
  await clearDemoData();

  // 1. Accounts
  const cash = await accountsService.createAccount({
    name: 'Cash',
    type: 'cash',
    balance: 0,
    initialBalance: 0,
    color: '#0F766E',
    icon: 'dollar-sign',
  });
  const creditCard = await accountsService.createAccount({
    name: 'Credit Card',
    type: 'credit',
    balance: 0,
    initialBalance: 0,
    color: '#CC3B2D',
    icon: 'credit-card',
  });
  const wallet = await accountsService.createAccount({
    name: 'Wallet',
    type: 'wallet',
    balance: 0,
    initialBalance: 0,
    color: '#B45309',
    icon: 'smartphone',
  });
  const savings = await accountsService.createAccount({
    name: 'Savings Account',
    type: 'savings',
    balance: 0,
    initialBalance: 0,
    color: '#2563EB',
    icon: 'briefcase',
  });

  // 2. Categories
  // --- INCOME (Parent & Sub) ---
  const incomeParent = await categoriesService.createCategory({
    name: 'Income',
    icon: 'plus-circle',
    color: '#10B981',
    type: 'in',
  });
  const incomeHeads = ['Salary', 'Dividend', 'Interest', 'Professional Fee', 'Gift', 'Miscellaneous'];
  for (const name of incomeHeads) {
    await categoriesService.createCategory({
      name,
      icon: name === 'Salary' ? 'dollar-sign' : name === 'Dividend' ? 'trending-up' : 'grid',
      color: '#10B981',
      type: 'in',
      parentId: incomeParent.id,
    });
  }

  // --- FOOD (Parent & Sub) ---
  const foodParent = await categoriesService.createCategory({
    name: 'Food',
    icon: 'coffee',
    color: '#F59E0B',
    type: 'out',
  });
  const foodHeads = ['Groceries', 'Restaurants', 'Snacks', 'Drinks'];
  for (const name of foodHeads) {
    await categoriesService.createCategory({
      name,
      icon: name === 'Groceries' ? 'shopping-cart' : 'coffee',
      color: '#F59E0B',
      type: 'out',
      parentId: foodParent.id,
    });
  }

  // --- TRANSPORTATION (Parent & Sub) ---
  const transParent = await categoriesService.createCategory({
    name: 'Transportation',
    icon: 'map',
    color: '#3B82F6',
    type: 'out',
  });
  const transHeads = ['Auto', 'Flight', 'Cab', 'Train', 'Metro'];
  for (const name of transHeads) {
    await categoriesService.createCategory({
      name,
      icon: name === 'Flight' ? 'navigation' : 'map-pin',
      color: '#3B82F6',
      type: 'out',
      parentId: transParent.id,
    });
  }

  // --- AUTOMOBILE (Parent & Sub) ---
  const autoParent = await categoriesService.createCategory({
    name: 'Automobile',
    icon: 'tool',
    color: '#6366F1',
    type: 'out',
  });
  const autoHeads = ['Fuel', 'Parking', 'Repairs'];
  for (const name of autoHeads) {
    await categoriesService.createCategory({
      name,
      icon: name === 'Fuel' ? 'zap' : 'tool',
      color: '#6366F1',
      type: 'out',
      parentId: autoParent.id,
    });
  }

  // --- ENTERTAINMENT (Parent & Sub) ---
  const entParent = await categoriesService.createCategory({
    name: 'Entertainment',
    icon: 'music',
    color: '#8B5CF6',
    type: 'out',
  });
  const entHeads = ['Movies', 'Concerts', 'Party', 'Events', 'Streaming'];
  for (const name of entHeads) {
    await categoriesService.createCategory({
      name,
      icon: name === 'Movies' ? 'film' : 'music',
      color: '#8B5CF6',
      type: 'out',
      parentId: entParent.id,
    });
  }

  // --- OFFICE (Parent & Sub) ---
  const officeParent = await categoriesService.createCategory({
    name: 'Office',
    icon: 'briefcase',
    color: '#0F766E',
    type: 'out',
  });
  const officeHeads = ['Stationery', 'Software Subscriptions', 'Hardware', 'Reimbursements'];
  for (const name of officeHeads) {
    await categoriesService.createCategory({
      name,
      icon: 'briefcase',
      color: '#0F766E',
      type: 'out',
      parentId: officeParent.id,
    });
  }

  // --- UTILITIES (Parent & Sub) ---
  const utilParent = await categoriesService.createCategory({
    name: 'Utilities',
    icon: 'zap',
    color: '#F97316',
    type: 'out',
  });
  const utilHeads = ['Electricity', 'Water', 'Internet', 'Phone', 'Gas'];
  for (const name of utilHeads) {
    await categoriesService.createCategory({
      name,
      icon: 'zap',
      color: '#F97316',
      type: 'out',
      parentId: utilParent.id,
    });
  }

  // --- PERSONAL (Parent & Sub) ---
  const personalParent = await categoriesService.createCategory({
    name: 'Personal',
    icon: 'user',
    color: '#EC4899',
    type: 'out',
  });
  const personalHeads = ['Personal Care', 'Grooming', 'Wellness'];
  for (const name of personalHeads) {
    await categoriesService.createCategory({
      name,
      icon: 'user',
      color: '#EC4899',
      type: 'out',
      parentId: personalParent.id,
    });
  }

  // --- OTHERS (Parent & Sub) ---
  const otherParent = await categoriesService.createCategory({
    name: 'Others',
    icon: 'grid',
    color: '#64748B',
    type: 'out',
  });
  await categoriesService.createCategory({
    name: 'Miscellaneous',
    icon: 'grid',
    color: '#64748B',
    type: 'out',
    parentId: otherParent.id,
  });

  // 3. Tags
  const personalTag = await tagsService.createTag({ name: 'Personal', color: '#EC4899' });
  const workTag = await tagsService.createTag({ name: 'Work', color: '#0F766E' });

  // 4. Sample Transactions
  // Find a few subcategories to use
  const allCats = await categoriesService.getCategories();
  const salaryCat = allCats.find((c) => c.name === 'Salary' && c.type === 'in');
  const groceryCat = allCats.find((c) => c.name === 'Groceries');
  const moviesCat = allCats.find((c) => c.name === 'Movies');
  const fuelCat = allCats.find((c) => c.name === 'Fuel');

  if (salaryCat && savings) {
    await transactionsService.createTransaction({
      type: 'in',
      amount: 4500000,
      accountId: savings.id,
      categoryId: salaryCat.id,
      date: daysAgo(0),
      note: 'Initial Salary credit',
    });
  }

  if (groceryCat && cash) {
    await transactionsService.createTransaction({
      type: 'out',
      amount: 150000,
      accountId: cash.id,
      categoryId: groceryCat.id,
      date: daysAgo(1),
      note: 'Weekly groceries',
      tags: [personalTag.id],
    });
  }

  if (fuelCat && creditCard) {
    await transactionsService.createTransaction({
      type: 'out',
      amount: 320000,
      accountId: creditCard.id,
      categoryId: fuelCat.id,
      date: daysAgo(2),
      note: 'Petrol refill',
    });
  }

  // 5. Sample Loan
  await loansService.createLoan({
    personName: 'Rahul',
    direction: 'lent',
    accountId: cash.id,
    givenAmount: 500000,
    note: 'Emergency help',
    date: daysAgo(5),
  });
}

