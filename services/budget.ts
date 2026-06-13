import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { budget, transactions } from '../db/schema';
import type { Budget, BudgetWithSpent, CreateBudgetInput, Transaction } from '../types';
import { generateId } from '../lib/ids';
import { todayUTC, toLocalMonthStartISO, nowUTC } from '../lib/dateUtils';
import { getCategories } from './categories';
import { rowToTransaction } from './transactions';

function rowToBudget(row: typeof budget.$inferSelect): Budget {
  return {
    id: row.id,
    categoryId: row.categoryId,
    subCategoryIds: row.subCategoryIds ? JSON.parse(row.subCategoryIds) : null,
    amount: row.amount,
    period: 'month',
    startDate: row.startDate,
    repeat: !!row.repeat,
    createdAt: row.createdAt,
  };
}

function getMonthKey(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthRange(iso: string) {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = date.getMonth();
  const from = toLocalMonthStartISO(year, month);
  const to = new Date(year, month + 1, 0, 23, 59, 59, 999).toISOString();
  return { from, to };
}

function isBudgetActiveInMonth(entry: Budget, selectedMonthKey: string) {
  const budgetMonthKey = getMonthKey(entry.startDate);
  return entry.repeat ? budgetMonthKey <= selectedMonthKey : budgetMonthKey === selectedMonthKey;
}

function assertNoBudgetConflict(
  budgetList: Budget[],
  candidate: Pick<Budget, 'categoryId' | 'startDate' | 'repeat'>,
  excludeId?: string,
) {
  const candidateMonthKey = getMonthKey(candidate.startDate);

  for (const existing of budgetList) {
    if (existing.id === excludeId) continue;
    if (existing.categoryId !== candidate.categoryId) continue;

    const existingMonthKey = getMonthKey(existing.startDate);

    if (candidate.repeat) {
      if (existing.repeat) {
        throw new Error('A recurring budget already exists for this category.');
      }
      if (existingMonthKey >= candidateMonthKey) {
        throw new Error('A budget already exists for this category in a month covered by this recurring budget.');
      }
      continue;
    }

    if (existing.repeat) {
      if (existingMonthKey <= candidateMonthKey) {
        throw new Error('A recurring budget already covers this category for the selected month.');
      }
      continue;
    }

    if (existingMonthKey === candidateMonthKey) {
      throw new Error('A budget already exists for this category in the selected month.');
    }
  }
}

async function assertBudgetableCategory(categoryId: string) {
  const categories = await getCategories();
  const category = categories.find((entry) => entry.id === categoryId);
  if (!category) throw new Error('Category not found.');
  if (category.type !== 'out') {
    throw new Error('Budgets can only be created for expense categories.');
  }
}

export async function getBudgetList(): Promise<Budget[]> {
  const rows = await db.select().from(budget);
  return rows.map(rowToBudget);
}

export async function getBudgetMarkedMonthsForYear(year: number): Promise<string[]> {
  const budgetList = await getBudgetList();
  const marked = new Set<string>();

  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const monthIso = toLocalMonthStartISO(year, monthIndex);
    const selectedMonthKey = getMonthKey(monthIso);
    const hasBudget = budgetList.some((b) => {
      const budgetMonthKey = getMonthKey(b.startDate);
      return b.repeat ? budgetMonthKey <= selectedMonthKey : budgetMonthKey === selectedMonthKey;
    });
    if (hasBudget) marked.add(monthIso);
  }

  return Array.from(marked);
}

export async function getBudgetWithSpent(selectedMonthIso: string = todayUTC()): Promise<BudgetWithSpent[]> {
  const budgetList = await getBudgetList();
  const selectedMonthKey = getMonthKey(selectedMonthIso);
  const { from, to } = getMonthRange(selectedMonthIso);
  const activeBudgets = budgetList.filter((entry) => isBudgetActiveInMonth(entry, selectedMonthKey));
  const allCategories = await getCategories();
  const categoriesById = new Map(allCategories.map((category) => [category.id, category]));
  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.type, 'out'),
        gte(transactions.date, from),
        lte(transactions.date, to)
      )
    );
  const spentByCategory = new Map<string, number>();

  rows.forEach((row) => {
    if (row.categoryId) {
      spentByCategory.set(row.categoryId, (spentByCategory.get(row.categoryId) ?? 0) + row.amount);
    }
  });

  const result: BudgetWithSpent[] = [];

  for (const b of activeBudgets) {
    const category = categoriesById.get(b.categoryId);
    
    // Determine all category IDs covered by this budget
    let coveredIds: string[] = [];
    if (b.subCategoryIds && b.subCategoryIds.length > 0) {
      coveredIds = b.subCategoryIds;
    } else {
      const children = allCategories.filter((c) => c.parentId === b.categoryId);
      coveredIds = [b.categoryId, ...children.map((c) => c.id)];
    }

    let spent = 0;
    coveredIds.forEach((cid) => {
      spent += spentByCategory.get(cid) ?? 0;
    });

    const remaining = b.amount - spent;
    const percent = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;

    result.push({
      ...b,
      spent,
      remaining,
      percent,
      categoryName: category?.name ?? 'Unknown',
      categoryIcon: category?.icon ?? 'tag',
      categoryColor: category?.color ?? '#6B7280',
    });
  }
  return result;
}

export async function getBudgetTransactions(
  categoryId: string,
  monthIso: string,
  subCategoryIds?: string[] | null
): Promise<Transaction[]> {
  const { from, to } = getMonthRange(monthIso);
  
  let coveredIds: string[] = [];
  if (subCategoryIds && subCategoryIds.length > 0) {
    coveredIds = subCategoryIds;
  } else {
    const allCategories = await getCategories();
    const children = allCategories.filter((c) => c.parentId === categoryId);
    coveredIds = [categoryId, ...children.map((c) => c.id)];
  }

  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        inArray(transactions.categoryId, coveredIds),
        eq(transactions.type, 'out'),
        gte(transactions.date, from),
        lte(transactions.date, to)
      )
    )
    .orderBy(transactions.date);
  return rows.map(rowToTransaction);
}

export async function createBudget(data: CreateBudgetInput): Promise<Budget> {
  await assertBudgetableCategory(data.categoryId);
  const budgetList = await getBudgetList();
  assertNoBudgetConflict(budgetList, {
    categoryId: data.categoryId,
    startDate: data.startDate,
    repeat: data.repeat,
  });
  const id = generateId();
  const now = nowUTC();
  const row = {
    id,
    categoryId: data.categoryId,
    subCategoryIds: data.subCategoryIds ? JSON.stringify(data.subCategoryIds) : null,
    amount: data.amount,
    period: data.period,
    startDate: data.startDate,
    repeat: data.repeat ? 1 : 0,
    createdAt: now,
  };
  await db.insert(budget).values(row);
  return rowToBudget(row);
}

export async function updateBudget(id: string, data: Partial<Budget>): Promise<Budget> {
  const rowsBefore = await db.select().from(budget).where(eq(budget.id, id));
  if (!rowsBefore[0]) throw new Error('Budget not found');
  const existing = rowToBudget(rowsBefore[0]);
  const next: Budget = {
    ...existing,
    ...data,
    repeat: typeof data.repeat === 'boolean' ? data.repeat : existing.repeat,
  };
  await assertBudgetableCategory(next.categoryId);
  const budgetList = await getBudgetList();
  assertNoBudgetConflict(
    budgetList,
    {
      categoryId: next.categoryId,
      startDate: next.startDate,
      repeat: next.repeat,
    },
    id,
  );
  
  const payload = {
    categoryId: data.categoryId,
    subCategoryIds: data.subCategoryIds !== undefined ? (data.subCategoryIds ? JSON.stringify(data.subCategoryIds) : null) : undefined,
    amount: data.amount,
    period: data.period,
    startDate: data.startDate,
    repeat: typeof data.repeat === 'boolean' ? (data.repeat ? 1 : 0) : undefined,
  };
  await db.update(budget).set(payload as any).where(eq(budget.id, id));
  const rows = await db.select().from(budget).where(eq(budget.id, id));
  return rowToBudget(rows[0]);
}

export async function deleteBudget(id: string): Promise<void> {
  await db.delete(budget).where(eq(budget.id, id));
}

export async function getBudgetTransactionEntries(
  categoryId: string,
  selectedMonthIso: string,
  subCategoryIds?: string[] | null
): Promise<Array<{ transaction: Transaction; countedAmount: number }>> {
  const { from, to } = getMonthRange(selectedMonthIso);
  
  let coveredIds: string[] = [];
  if (subCategoryIds && subCategoryIds.length > 0) {
    coveredIds = subCategoryIds;
  } else {
    const allCategories = await getCategories();
    const children = allCategories.filter((c) => c.parentId === categoryId);
    coveredIds = [categoryId, ...children.map((c) => c.id)];
  }

  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        inArray(transactions.categoryId, coveredIds),
        eq(transactions.type, 'out'),
        gte(transactions.date, from),
        lte(transactions.date, to),
      ),
    );

  const entries: Array<{ transaction: Transaction; countedAmount: number }> = [];

  rows.forEach((row) => {
    const tx = rowToTransaction(row);
    entries.push({ transaction: tx, countedAmount: tx.amount });
  });

  return entries.sort((a, b) => {
    const byDate = new Date(b.transaction.date).getTime() - new Date(a.transaction.date).getTime();
    if (byDate !== 0) return byDate;
    return new Date(b.transaction.createdAt).getTime() - new Date(a.transaction.createdAt).getTime();
  });
}
