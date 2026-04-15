import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '../db/client';
import { budget, transactions } from '../db/schema';
import type { Budget, BudgetWithSpent, CreateBudgetInput, Transaction } from '../types';
import { generateId } from '../lib/ids';
import { todayUTC } from '../lib/dateUtils';
import { getCategories } from './categories';

function rowToBudget(row: typeof budget.$inferSelect): Budget {
  return {
    id: row.id,
    categoryId: row.categoryId,
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
  const from = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
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
  if (category.parentId === undefined || category.type !== 'out') {
    throw new Error('Budgets can only be created for expense subcategories.');
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
    const monthIso = new Date(year, monthIndex, 1, 0, 0, 0, 0).toISOString();
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
    const splits = (() => {
      try {
        const parsed = JSON.parse((row as any).splitData ?? '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();

    if (splits.length > 0) {
      splits.forEach((split: any) => {
        const splitCategoryId = split.categoryId;
        if (!splitCategoryId) return;
        spentByCategory.set(
          splitCategoryId,
          (spentByCategory.get(splitCategoryId) ?? 0) + Number(split.amount || 0),
        );
      });
      return;
    }

    if (row.categoryId) {
      spentByCategory.set(row.categoryId, (spentByCategory.get(row.categoryId) ?? 0) + row.amount);
    }
  });

  const result: BudgetWithSpent[] = [];

  for (const b of activeBudgets) {
    const category = categoriesById.get(b.categoryId);
    const spent = spentByCategory.get(b.categoryId) ?? 0;
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

export async function createBudget(data: CreateBudgetInput): Promise<Budget> {
  await assertBudgetableCategory(data.categoryId);
  const budgetList = await getBudgetList();
  assertNoBudgetConflict(budgetList, {
    categoryId: data.categoryId,
    startDate: data.startDate,
    repeat: data.repeat,
  });
  const id = generateId();
  const now = todayUTC();
  const row = { id, ...data, repeat: data.repeat ? 1 : 0, createdAt: now };
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
    ...data,
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
): Promise<Array<{ transaction: Transaction; countedAmount: number }>> {
  const { from, to } = getMonthRange(selectedMonthIso);
  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.type, 'out'),
        gte(transactions.date, from),
        lte(transactions.date, to),
      ),
    );

  const entries: Array<{ transaction: Transaction; countedAmount: number }> = [];

  rows.forEach((row) => {
      const tx = {
        id: row.id,
        type: row.type as Transaction['type'],
        amount: row.amount,
        accountId: row.accountId,
        linkedAccountId: row.linkedAccountId ?? undefined,
        loanId: row.loanId ?? undefined,
        categoryId: row.categoryId ?? undefined,
        payee: row.payee ?? undefined,
        tags: (() => {
          try {
            const parsed = JSON.parse(row.tags ?? '[]');
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })(),
        splits: (() => {
          try {
            const parsed = JSON.parse(row.splitData ?? '[]');
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })(),
        note: row.note ?? undefined,
        date: row.date,
        createdAt: row.createdAt,
      } as Transaction;

      const splits = tx.splits ?? [];
      if (splits.length > 0) {
        const matching = splits.find((split) => split.categoryId === categoryId);
        if (matching) {
          entries.push({ transaction: tx, countedAmount: Number(matching.amount || 0) });
        }
        return;
      }

      if (tx.categoryId === categoryId) {
        entries.push({ transaction: tx, countedAmount: tx.amount });
      }
    });

  return entries.sort((a, b) => {
      const byDate = new Date(b.transaction.date).getTime() - new Date(a.transaction.date).getTime();
      if (byDate !== 0) return byDate;
      return new Date(b.transaction.createdAt).getTime() - new Date(a.transaction.createdAt).getTime();
    });
}
