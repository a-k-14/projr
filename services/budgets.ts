import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '../db/client';
import { budgets, transactions } from '../db/schema';
import type { Budget, BudgetWithSpent, CreateBudgetInput } from '../types';
import { generateId } from '../lib/ids';
import { todayUTC, getDateRange } from '../lib/dateUtils';
import { getCategoryById } from './categories';

function rowToBudget(row: typeof budgets.$inferSelect): Budget {
  return {
    id: row.id,
    categoryId: row.categoryId,
    amount: row.amount,
    period: row.period as Budget['period'],
    startDate: row.startDate,
    createdAt: row.createdAt,
  };
}

export async function getBudgets(): Promise<Budget[]> {
  const rows = await db.select().from(budgets);
  return rows.map(rowToBudget);
}

export async function getBudgetsWithSpent(yearStart: number = 3): Promise<BudgetWithSpent[]> {
  const budgetList = await getBudgets();
  const result: BudgetWithSpent[] = [];

  for (const budget of budgetList) {
    const category = await getCategoryById(budget.categoryId);
    const { from, to } = getDateRange(
      budget.period === 'month' ? 'month' : 'year',
      yearStart
    );

    const rows = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.type, 'out'),
          eq(transactions.categoryId, budget.categoryId),
          gte(transactions.date, from),
          lte(transactions.date, to)
        )
      );

    const spent = rows.reduce((sum, r) => sum + r.amount, 0);
    const remaining = Math.max(0, budget.amount - spent);
    const percent = budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0;

    result.push({
      ...budget,
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
  const id = generateId();
  const now = todayUTC();
  const row = { id, ...data, createdAt: now };
  await db.insert(budgets).values(row);
  return rowToBudget(row);
}

export async function updateBudget(id: string, data: Partial<Omit<Budget, 'id' | 'createdAt'>>): Promise<Budget> {
  await db.update(budgets).set(data).where(eq(budgets.id, id));
  const rows = await db.select().from(budgets).where(eq(budgets.id, id));
  return rowToBudget(rows[0]);
}

export async function deleteBudget(id: string): Promise<void> {
  await db.delete(budgets).where(eq(budgets.id, id));
}
