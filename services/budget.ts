import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '../db/client';
import { budget, transactions } from '../db/schema';
import type { Budget, BudgetWithSpent, CreateBudgetInput } from '../types';
import { generateId } from '../lib/ids';
import { todayUTC } from '../lib/dateUtils';
import { getCategoryById } from './categories';

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

export async function getBudgetList(): Promise<Budget[]> {
  const rows = await db.select().from(budget);
  return rows.map(rowToBudget);
}

export async function getBudgetWithSpent(selectedMonthIso: string = todayUTC()): Promise<BudgetWithSpent[]> {
  const budgetList = await getBudgetList();
  const result: BudgetWithSpent[] = [];
  const selectedMonthKey = getMonthKey(selectedMonthIso);
  const { from, to } = getMonthRange(selectedMonthIso);

  for (const b of budgetList) {
    const budgetMonthKey = getMonthKey(b.startDate);
    const isActive = b.repeat ? budgetMonthKey <= selectedMonthKey : budgetMonthKey === selectedMonthKey;
    if (!isActive) continue;

    const category = await getCategoryById(b.categoryId);

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
  const id = generateId();
  const now = todayUTC();
  const row = { id, ...data, repeat: data.repeat ? 1 : 0, createdAt: now };
  await db.insert(budget).values(row);
  return rowToBudget(row);
}

export async function updateBudget(id: string, data: Partial<Budget>): Promise<Budget> {
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
