import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { categories } from '../db/schema';
import type { Category } from '../types';
import { generateId } from '../lib/ids';

function rowToCategory(row: typeof categories.$inferSelect): Category {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parentId ?? undefined,
    icon: row.icon,
    color: row.color,
    type: row.type as Category['type'],
  };
}

export async function getCategories(): Promise<Category[]> {
  const rows = await db.select().from(categories);
  return rows.map(rowToCategory);
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const rows = await db.select().from(categories).where(eq(categories.id, id));
  return rows[0] ? rowToCategory(rows[0]) : null;
}

export async function createCategory(data: Omit<Category, 'id'>): Promise<Category> {
  if (data.parentId) {
    const parent = await getCategoryById(data.parentId);
    if (!parent) throw new Error('Parent category not found.');
  }
  const id = generateId();
  const row = {
    id,
    name: data.name,
    parentId: data.parentId ?? null,
    icon: data.icon,
    color: data.color,
    type: data.type,
  };
  await db.insert(categories).values(row);
  return { id, ...data };
}

export async function updateCategory(id: string, data: Partial<Category>): Promise<Category> {
  const existing = await getCategoryById(id);
  if (!existing) throw new Error('Category not found.');
  if (data.parentId) {
    if (data.parentId === id) throw new Error('A category cannot be its own parent.');
    const parent = await getCategoryById(data.parentId);
    if (!parent) throw new Error('Parent category not found.');
  }
  await db.update(categories).set(data as any).where(eq(categories.id, id));
  return (await getCategoryById(id))!;
}

export async function deleteCategory(id: string): Promise<void> {
  const existing = await getCategoryById(id);
  if (!existing) throw new Error('Category not found.');
  await db.delete(categories).where(eq(categories.id, id));
}

export function getCategoryDisplayName(category: Category, allCategories: Category[]): string {
  if (category.parentId) {
    const parent = allCategories.find((c) => c.id === category.parentId);
    return parent ? `${parent.name} › ${category.name}` : category.name;
  }
  return category.name;
}
