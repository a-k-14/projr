import { desc, eq, and } from 'drizzle-orm';
import { db } from '../db/client';
import { assets, auditLogs } from '../db/schema';
import { generateId } from '../lib/ids';
import { nowUTC } from '../lib/dateUtils';
import type { Asset, CreateAssetInput } from '../types';
import { logAction } from './audit';

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
  await logAction(db, 'create', 'assets', id, null, rowToAsset(row));
  return rowToAsset(row);
}

export async function updateAsset(id: string, data: Partial<CreateAssetInput>): Promise<Asset> {
  const existingRows = await db.select().from(assets).where(eq(assets.id, id));
  if (!existingRows[0]) throw new Error('Asset not found');
  const before = rowToAsset(existingRows[0]);

  const patch: Record<string, any> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.icon !== undefined) patch.icon = data.icon;
  if (data.value !== undefined) patch.value = data.value;
  if (data.note !== undefined) patch.note = data.note ?? null;

  await db.update(assets).set(patch).where(eq(assets.id, id));
  const rows = await db.select().from(assets).where(eq(assets.id, id));
  await logAction(db, 'update', 'assets', id, before, rowToAsset(rows[0]));
  return rowToAsset(rows[0]);
}

export async function deleteAsset(id: string): Promise<void> {
  const existingRows = await db.select().from(assets).where(eq(assets.id, id));
  if (existingRows[0]) {
    const before = rowToAsset(existingRows[0]);
    await db.transaction(async (tx) => {
      await tx.delete(auditLogs).where(and(eq(auditLogs.recordId, id), eq(auditLogs.tableName, 'assets')));
      await logAction(tx, 'delete', 'assets', id, before, null);
      await tx.delete(assets).where(eq(assets.id, id));
    });
  }
}

