import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import type { Settings } from '../types';
import { sqlite } from '../db/client';

const DB_NAME = 'finance.db';
const DB_DIR = `${FileSystem.documentDirectory}SQLite/`;
const DB_PATH = `${DB_DIR}${DB_NAME}`;
const BACKUP_PREFIX = 'reni-backup-';

function backupFileName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${BACKUP_PREFIX}${date}-${time}.db`;
}

function prepareDbForBackup(): void {
  // Flush WAL into the main db file so the copy is complete and up-to-date.
  // VACUUM also compacts free pages left behind by deletions/updates.
  sqlite.execSync('PRAGMA wal_checkpoint(TRUNCATE)');
  sqlite.execSync('VACUUM');
}

async function readDbAsBase64(): Promise<string> {
  return FileSystem.readAsStringAsync(DB_PATH, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

async function writeToSAF(folderUri: string, fileName: string, base64: string): Promise<void> {
  const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
    folderUri,
    fileName,
    'application/octet-stream'
  );
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

async function pruneOldBackups(folderUri: string, keepCount: number): Promise<void> {
  try {
    const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(folderUri);
    const backups = files
      .filter((uri) => {
        const name = decodeURIComponent(uri.split('%3A').pop() ?? uri.split('/').pop() ?? '');
        return name.startsWith(BACKUP_PREFIX) && name.endsWith('.db');
      })
      .sort();
    const toDelete = backups.slice(0, Math.max(0, backups.length - keepCount));
    await Promise.all(toDelete.map((uri) => FileSystem.StorageAccessFramework.deleteAsync(uri).catch(() => undefined)));
  } catch {
    // non-fatal
  }
}

export async function pickBackupFolder(): Promise<string | null> {
  const result = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!result.granted) return null;
  return result.directoryUri;
}

export async function exportBackup(): Promise<boolean> {
  const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissions.granted) return false;

  prepareDbForBackup();
  const base64 = await readDbAsBase64();
  await writeToSAF(permissions.directoryUri, backupFileName(), base64);
  return true;
}

export async function runAutoBackup(folderUri: string, keepCount: number): Promise<void> {
  prepareDbForBackup();
  const base64 = await readDbAsBase64();
  await writeToSAF(folderUri, backupFileName(), base64);
  await pruneOldBackups(folderUri, keepCount);
}

export function isAutoBackupDue(settings: Pick<Settings, 'autoBackupEnabled' | 'autoBackupFolderUri' | 'autoBackupFrequencyDays' | 'lastAutoBackupAt'>): boolean {
  if (!settings.autoBackupEnabled || !settings.autoBackupFolderUri) return false;
  if (!settings.lastAutoBackupAt) return true;

  // Parse last auto backup date as a local date string (YYYY-MM-DD)
  const lastDate = new Date(settings.lastAutoBackupAt);
  const lastYear = lastDate.getFullYear();
  const lastMonth = lastDate.getMonth();
  const lastDay = lastDate.getDate();
  const lastDateStr = `${lastYear}-${String(lastMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Get today's local date string
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();
  const todayStr = `${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;

  if (lastDateStr === todayStr) {
    return false;
  }

  // Calculate difference in calendar days
  const lastMidnight = new Date(lastYear, lastMonth, lastDay).getTime();
  const todayMidnight = new Date(todayYear, todayMonth, todayDay).getTime();
  const diffDays = Math.round((todayMidnight - lastMidnight) / (24 * 60 * 60 * 1000));

  return diffDays >= settings.autoBackupFrequencyDays;
}

export async function importBackup(): Promise<boolean> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/octet-stream', '*/*'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) return false;

  const picked = result.assets[0];
  if (!picked.name.endsWith('.db') && !picked.uri) {
    throw new Error('Please select a valid .db backup file');
  }

  const dirInfo = await FileSystem.getInfoAsync(DB_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(DB_DIR, { intermediates: true });
  }

  try {
    sqlite.closeSync();
  } catch (e) {
    // Ignore if already closed
  }

  try {
    await SQLite.deleteDatabaseAsync(DB_NAME);
  } catch (e) {
    // Ignore if delete fails
  }

  try {
    const base64 = await FileSystem.readAsStringAsync(picked.uri, { encoding: FileSystem.EncodingType.Base64 });
    await FileSystem.writeAsStringAsync(DB_PATH, base64, { encoding: FileSystem.EncodingType.Base64 });
  } catch (err: any) {
    throw new Error(`Failed to read/write backup file: ${err.message}`);
  }

  // Remove stale WAL/SHM sidecars left by the previous database. Without this,
  // SQLite can replay the old write-ahead frames over the freshly restored file
  // on next open, corrupting the restored data.
  await FileSystem.deleteAsync(`${DB_PATH}-wal`, { idempotent: true }).catch(() => undefined);
  await FileSystem.deleteAsync(`${DB_PATH}-shm`, { idempotent: true }).catch(() => undefined);
  return true;
}
