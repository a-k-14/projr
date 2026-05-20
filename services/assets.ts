import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { assets } from '../db/schema';
import { generateId } from '../lib/ids';
import { nowUTC } from '../lib/dateUtils';
import type { Asset, CreateAssetInput } from '../types';

function rowToAsset(row: typeof assets.$inferSelect): Asset {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    value: row.value,
    note: row.note ?? undefined,
    createdAt: row.createdAt,
  };
}

export async function getAssets(): Promise<Asset[]> {
  const rows = await db.select().from(assets).orderBy(desc(assets.createdAt));
  return rows.map(rowToAsset);
}

export async function createAsset(data: CreateAssetInput): Promise<Asset> {
  const id = generateId();
  const now = nowUTC();
  const row = {
    id,
    name: data.name,
    icon: data.icon,
    value: data.value,
    note: data.note ?? null,
    createdAt: now,
  };
  await db.insert(assets).values(row);
  return rowToAsset(row);
}

export async function updateAsset(id: string, data: Partial<CreateAssetInput>): Promise<Asset> {
  const patch: Record<string, any> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.icon !== undefined) patch.icon = data.icon;
  if (data.value !== undefined) patch.value = data.value;
  if (data.note !== undefined) patch.note = data.note ?? null;

  await db.update(assets).set(patch).where(eq(assets.id, id));
  const rows = await db.select().from(assets).where(eq(assets.id, id));
  return rowToAsset(rows[0]);
}

export async function deleteAsset(id: string): Promise<void> {
  await db.delete(assets).where(eq(assets.id, id));
}
