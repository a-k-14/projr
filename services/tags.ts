import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { tags } from '../db/schema';
import type { Tag } from '../types';
import { generateId } from '../lib/ids';

function rowToTag(row: typeof tags.$inferSelect): Tag {
  return { id: row.id, name: row.name, color: row.color };
}

export async function getTags(): Promise<Tag[]> {
  const rows = await db.select().from(tags);
  return rows.map(rowToTag);
}

export async function getTagById(id: string): Promise<Tag | null> {
  const rows = await db.select().from(tags).where(eq(tags.id, id));
  return rows[0] ? rowToTag(rows[0]) : null;
}

export async function createTag(data: Omit<Tag, 'id'>): Promise<Tag> {
  const id = generateId();
  await db.insert(tags).values({ id, ...data });
  return { id, ...data };
}

export async function updateTag(id: string, data: Partial<Tag>): Promise<Tag> {
  await db.update(tags).set(data).where(eq(tags.id, id));
  return (await getTagById(id))!;
}

export async function deleteTag(id: string): Promise<void> {
  await db.delete(tags).where(eq(tags.id, id));
}
