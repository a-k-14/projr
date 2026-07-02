import { db } from '../db/client';
import { auditLogs } from '../db/schema';
import { generateId } from '../lib/ids';
import { nowUTC } from '../lib/dateUtils';
import { desc, lt, gt } from 'drizzle-orm';

type WriteExecutor = Pick<typeof db, 'insert'>;

export interface AuditLog {
  id: string;
  action: 'create' | 'update' | 'delete';
  tableName: string;
  recordId: string;
  payloadBefore?: string | null;
  payloadAfter?: string | null;
  timestamp: string;
}

function hasSubstantiveChanges(tableName: string, before: any, after: any): boolean {
  if (!before || !after) return true;

  if (tableName === 'transactions') {
    const normalizeTags = (tags: any): string => {
      if (!tags) return '[]';
      if (typeof tags === 'string') {
        try {
          const arr = JSON.parse(tags);
          return JSON.stringify(Array.isArray(arr) ? [...arr].sort() : arr);
        } catch {
          return tags;
        }
      }
      if (Array.isArray(tags)) {
        return JSON.stringify([...tags].sort());
      }
      return JSON.stringify(tags);
    };

    const normalizeReceipts = (uris: any): string => {
      if (!uris) return '[]';
      if (typeof uris === 'string') {
        try {
          const arr = JSON.parse(uris);
          return JSON.stringify(Array.isArray(arr) ? [...arr].sort() : arr);
        } catch {
          return uris;
        }
      }
      if (Array.isArray(uris)) {
        return JSON.stringify([...uris].sort());
      }
      return JSON.stringify(uris);
    };

    const beforePayee = (before.payee || '').trim();
    const afterPayee = (after.payee || '').trim();
    const beforeNote = (before.note || '').trim();
    const afterNote = (after.note || '').trim();

    return (
      before.type !== after.type ||
      before.amount !== after.amount ||
      before.accountId !== after.accountId ||
      before.linkedAccountId !== after.linkedAccountId ||
      before.categoryId !== after.categoryId ||
      beforePayee !== afterPayee ||
      beforeNote !== afterNote ||
      before.date !== after.date ||
      before.loanId !== after.loanId ||
      before.loanTransactionType !== after.loanTransactionType ||
      before.depositId !== after.depositId ||
      before.depositTransactionType !== after.depositTransactionType ||
      before.excludeFromTotals !== after.excludeFromTotals ||
      normalizeTags(before.tags) !== normalizeTags(after.tags) ||
      normalizeReceipts(before.receiptImageUris) !== normalizeReceipts(after.receiptImageUris)
    );
  }

  if (tableName === 'deposits') {
    const beforeNote = (before.note || '').trim();
    const afterNote = (after.note || '').trim();
    return (
      before.name !== after.name ||
      before.bankName !== after.bankName ||
      before.principalAmount !== after.principalAmount ||
      before.interestRate !== after.interestRate ||
      before.tenureMonths !== after.tenureMonths ||
      before.tenureUnit !== after.tenureUnit ||
      before.startDate !== after.startDate ||
      before.maturityDate !== after.maturityDate ||
      before.maturityValue !== after.maturityValue ||
      before.status !== after.status ||
      beforeNote !== afterNote
    );
  }

  if (tableName === 'loans') {
    const beforeNote = (before.note || '').trim();
    const afterNote = (after.note || '').trim();
    const normalizeTags = (tags: any): string => {
      if (!tags) return '[]';
      if (typeof tags === 'string') {
        try {
          const arr = JSON.parse(tags);
          return JSON.stringify(Array.isArray(arr) ? [...arr].sort() : arr);
        } catch {
          return tags;
        }
      }
      if (Array.isArray(tags)) {
        return JSON.stringify([...tags].sort());
      }
      return JSON.stringify(tags);
    };

    return (
      before.personName !== after.personName ||
      before.direction !== after.direction ||
      before.accountId !== after.accountId ||
      before.givenAmount !== after.givenAmount ||
      before.status !== after.status ||
      beforeNote !== afterNote ||
      normalizeTags(before.tags) !== normalizeTags(after.tags)
    );
  }

  if (tableName === 'assets') {
    const beforeNote = (before.note || '').trim();
    const afterNote = (after.note || '').trim();
    return (
      before.name !== after.name ||
      before.icon !== after.icon ||
      before.value !== after.value ||
      beforeNote !== afterNote
    );
  }

  return true;
}

/**
 * Inserts an audit log record into the database.
 * Run inside the same db transaction as the target change to ensure data consistency.
 */
export async function logAction(
  tx: WriteExecutor,
  action: 'create' | 'update' | 'delete',
  tableName: string,
  recordId: string,
  before: any | null,
  after: any | null
): Promise<void> {
  if (action === 'update' && !hasSubstantiveChanges(tableName, before, after)) {
    return;
  }

  const logId = generateId();
  const timestamp = nowUTC();
  
  await tx.insert(auditLogs).values({
    id: logId,
    action,
    tableName,
    recordId,
    payloadBefore: before ? JSON.stringify(before) : null,
    payloadAfter: after ? JSON.stringify(after) : null,
    timestamp,
  });
}

/**
 * Retrieves paginated audit logs sorted chronologically (latest first).
 * Optionally filters logs to the last N days via daysLimit.
 */
export async function getAuditLogs(
  limit = 50,
  offset = 0,
  daysLimit?: number
): Promise<AuditLog[]> {
  let baseQuery = db.select().from(auditLogs);

  if (daysLimit !== undefined) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysLimit);
    const cutoffStr = cutoffDate.toISOString();
    baseQuery = baseQuery.where(gt(auditLogs.timestamp, cutoffStr)) as any;
  }

  const rows = await baseQuery
    .orderBy(desc(auditLogs.timestamp))
    .limit(limit)
    .offset(offset);

  return rows.map((row) => ({
    id: row.id,
    action: row.action as AuditLog['action'],
    tableName: row.tableName,
    recordId: row.recordId,
    payloadBefore: row.payloadBefore,
    payloadAfter: row.payloadAfter,
    timestamp: row.timestamp,
  }));
}

/**
 * Clears all change history logs.
 */
export async function clearAuditLogs(): Promise<void> {
  await db.delete(auditLogs);
}

/**
 * Prunes logs older than retentionDays.
 */
export async function pruneAuditLogs(retentionDays = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffStr = cutoffDate.toISOString();

  await db.delete(auditLogs).where(lt(auditLogs.timestamp, cutoffStr));
  // In Expo SQLite + Drizzle, delete() returns raw result or empty array depending on client.
  // We return a simple success status.
  return 1;
}
