import { asc } from 'drizzle-orm';
import { db, sqlite } from '../db/client';
import { persons } from '../db/schema';
import { generateId } from '../lib/ids';
import { nowUTC } from '../lib/dateUtils';

export function normalizePerson(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export async function getPersons(): Promise<string[]> {
  const rows = await db
    .select({ name: persons.name })
    .from(persons)
    .orderBy(asc(persons.name));
  return rows.map((r) => r.name);
}

/**
 * Finds an existing person by case-insensitive name match, or inserts a new one.
 * Returns the canonical (stored) name.
 */
export async function upsertPerson(raw: string): Promise<string> {
  const normalized = normalizePerson(raw);
  if (!normalized) throw new Error('Person name cannot be empty');

  const existing = await sqlite.getFirstAsync<{ name: string }>(
    `SELECT name FROM persons WHERE name = ? COLLATE NOCASE LIMIT 1`,
    [normalized],
  );
  if (existing) return existing.name;

  const id = generateId();
  await db.insert(persons).values({ id, name: normalized, createdAt: nowUTC() });
  return normalized;
}
