import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '../db/client';
import { budget, transactions } from '../db/schema';
import type { Budget, BudgetWithSpent, CreateBudgetInput } from '../types';
import { generateId } from '../lib/ids';
import { todayUTC, getDateRange } from '../lib/dateUtils';
import { getCategoryById } from './categories';

function rowToBudget(row: typeof budget.$inferSelect): Budget {
  return {
    id: row.id,
    categoryId: row.categoryId,
    amount: row.amount,
    period: row.period as Budget['period'],
    startDate: row.startDate,
    createdAt: row.createdAt,
  };
}

export async function getBudgetList(): Promise<Budget[]> {
  const rows = await db.select().from(budget);
  return rows.map(rowToBudget);
}

export async function getBudgetWithSpent(yearStart: number = 3): Promise<BudgetWithSpent[]> {
  const budgetList = await getBudgetList();
  const result: BudgetWithSpent[] = [];

  for (const b of budgetList) {
    const category = await getCategoryById(b.categoryId);
    const { from, to } = getDateRange(
      b.period === 'month' ? 'month' : 'year',
      yearStart
    );

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

    const spent = rows.reduce((sum, r) => {
      const splits = (() => {
        try {
          const parsed = JSON.parse((r as any).splitData ?? '[]');
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })();

      if (splits.length > 0) {
        return (
          sum +
          splits.reduce((splitSum: number, split: any) => {
            if (split.categoryId !== b.categoryId) return splitSum;
            return splitSum + Number(split.amount || 0);
          }, 0)
        );
      }

      if (r.categoryId !== b.categoryId) return sum;
      return sum + r.amount;
    }, 0);
    const remaining = Math.max(0, b.amount - spent);
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
  const id = generateId();
  const now = todayUTC();
  const row = { id, ...data, createdAt: now };
  await db.insert(budget).values(row);
  return rowToBudget(row);
}

export async function updateBudget(id: string, data: Partial<Budget>): Promise<Budget> {
  await db.update(budget).set(data as any).where(eq(budget.id, id));
  const rows = await db.select().from(budget).where(eq(budget.id, id));
  return rowToBudget(rows[0]);
}

export async function deleteBudget(id: string): Promise<void> {
  await db.delete(budget).where(eq(budget.id, id));
}
