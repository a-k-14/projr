import { sqlite } from '../db/client';

export interface DatabaseStats {
  pageSize: number;
  pageCount: number;
  sizeBytes: number;
  sizeFormatted: string;
  tableCounts: Record<string, number>;
}

export async function getDatabaseStats(): Promise<DatabaseStats> {
  const pageSizeRow = await sqlite.getFirstAsync<{ page_size: number }>('PRAGMA page_size');
  const pageCountRow = await sqlite.getFirstAsync<{ page_count: number }>('PRAGMA page_count');
  
  const pageSize = pageSizeRow?.page_size ?? 0;
  const pageCount = pageCountRow?.page_count ?? 0;
  const sizeBytes = pageSize * pageCount;
  
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const tables = ['accounts', 'categories', 'transactions', 'loans', 'budget', 'tags'];
  const tableCounts: Record<string, number> = {};
  
  for (const table of tables) {
    const row = await sqlite.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`);
    tableCounts[table] = row?.count ?? 0;
  }

  return {
    pageSize,
    pageCount,
    sizeBytes,
    sizeFormatted: formatSize(sizeBytes),
    tableCounts,
  };
}

export async function verifyDatabaseIntegrity(): Promise<{ ok: boolean; message: string }> {
  try {
    const rows = await sqlite.getAllAsync<{ integrity_check: string }>('PRAGMA integrity_check');
    const result = rows[0]?.integrity_check ?? 'unknown';
    return {
      ok: result === 'ok',
      message: result,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
