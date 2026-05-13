import * as accountsService from '../services/accounts';
import * as categoriesService from '../services/categories';
import * as tagsService from '../services/tags';
import { db } from './client';
import { transactions } from './schema';

export async function seedDatabase(): Promise<void> {
  const existing = await accountsService.getAccounts();
  if (existing.length > 0) return;

  // 1. Accounts
  await accountsService.createAccount({
    name: 'Cash',
    type: 'cash',
    balance: 0,
    initialBalance: 0,
    color: '#0F766E',
    icon: 'dollar-sign',
  });
  await accountsService.createAccount({
    name: 'Credit Card',
    type: 'credit',
    balance: 0,
    initialBalance: 0,
    color: '#CC3B2D',
    icon: 'credit-card',
  });
  await accountsService.createAccount({
    name: 'Wallet',
    type: 'wallet',
    balance: 0,
    initialBalance: 0,
    color: '#B45309',
    icon: 'smartphone',
  });
  await accountsService.createAccount({
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
  await tagsService.createTag({ name: 'Personal', color: '#EC4899' });
  await tagsService.createTag({ name: 'Work', color: '#0F766E' });

}

export async function seedMassiveTransactions(count: number = 1000): Promise<void> {
  const accountsList = await accountsService.getAccounts();
  const categoriesList = await categoriesService.getCategories();
  const tagsList = await tagsService.getTags();

  if (accountsList.length === 0 || categoriesList.length === 0) {
    throw new Error('Seed accounts and categories first.');
  }

  const expenseCategories = categoriesList.filter(c => c.type === 'out');
  const incomeCategories = categoriesList.filter(c => c.type === 'in');

  const now = new Date();
  const startTime = now.getTime() - (365 * 24 * 60 * 60 * 1000); // 1 year ago

  const newTransactions = [];

  for (let i = 0; i < count; i++) {
    const isIncome = Math.random() > 0.8; // 20% income, 80% expense
    const category = isIncome
      ? incomeCategories[Math.floor(Math.random() * incomeCategories.length)]
      : expenseCategories[Math.floor(Math.random() * expenseCategories.length)];
    
    const account = accountsList[Math.floor(Math.random() * accountsList.length)];
    const amount = isIncome 
      ? Math.floor(Math.random() * 50000) + 1000 
      : Math.floor(Math.random() * 2000) + 10;
    
    const timestamp = new Date(startTime + Math.random() * (now.getTime() - startTime));
    const note = `Test ${isIncome ? 'Income' : 'Expense'} ${i + 1}`;
    
    newTransactions.push({
      id: `test-tx-${Date.now()}-${i}`,
      accountId: account.id,
      categoryId: category.id,
      amount: amount,
      type: isIncome ? 'in' : 'out',
      date: timestamp.toISOString(),
      note: note,
      payee: isIncome ? 'Test Payer' : 'Test Merchant',
      tags: JSON.stringify(tagsList.length > 0 ? [tagsList[Math.floor(Math.random() * tagsList.length)].id] : []),
      createdAt: timestamp.toISOString(),
      updatedAt: timestamp.toISOString(),
    });
  }

  // Insert in batches of 100 for efficiency
  for (let i = 0; i < newTransactions.length; i += 100) {
    const batch = newTransactions.slice(i, i + 100);
    await db.insert(transactions).values(batch);
  }

  // Calculate and update account balances
  const balanceChanges = new Map<string, number>();
  for (const tx of newTransactions) {
    const delta = tx.type === 'in' ? tx.amount : -tx.amount;
    balanceChanges.set(tx.accountId, (balanceChanges.get(tx.accountId) || 0) + delta);
  }

  for (const [accountId, delta] of balanceChanges.entries()) {
    await accountsService.updateAccountBalance(accountId, delta);
  }
}
