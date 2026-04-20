import * as FileSystem from 'expo-file-system/legacy';
import { generateId } from '../lib/ids';

const RECEIPTS_DIR_NAME = 'receipts';

export function getReceiptsDirectory(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error('Local document storage is unavailable.');
  }
  return `${FileSystem.documentDirectory}${RECEIPTS_DIR_NAME}`;
}

function getReceiptOwnerDirectory(ownerId: string): string {
  return `${getReceiptsDirectory()}/${ownerId}`;
}

function getImageExtension(uri: string): string {
  const withoutQuery = uri.split('?')[0] ?? uri;
  const match = withoutQuery.match(/\.([a-zA-Z0-9]{2,5})$/);
  const ext = match?.[1]?.toLowerCase();
  if (!ext) return 'jpg';
  if (['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext)) return ext;
  return 'jpg';
}

function isOwnedReceiptUri(uri: string, ownerId: string): boolean {
  return uri.startsWith(`${getReceiptOwnerDirectory(ownerId)}/`);
}

async function ensureDirectory(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
  }
}

export async function persistReceiptImagesForOwner(ownerId: string, sourceUris?: string[] | null): Promise<string[]> {
  if (!sourceUris?.length) return [];

  const ownerDir = getReceiptOwnerDirectory(ownerId);
  await ensureDirectory(getReceiptsDirectory());
  await ensureDirectory(ownerDir);

  const persisted: string[] = [];
  for (const sourceUri of sourceUris) {
    if (isOwnedReceiptUri(sourceUri, ownerId)) {
      persisted.push(sourceUri);
      continue;
    }

    const destination = `${ownerDir}/receipt-${Date.now()}-${generateId()}.${getImageExtension(sourceUri)}`;
    await FileSystem.copyAsync({ from: sourceUri, to: destination });
    persisted.push(destination);
  }
  return persisted;
}

export async function deleteReceiptImage(uri?: string | null): Promise<void> {
  if (!uri) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}

export async function deleteReceiptOwnerDirectory(ownerId: string): Promise<void> {
  await FileSystem.deleteAsync(getReceiptOwnerDirectory(ownerId), { idempotent: true }).catch(() => undefined);
}

export async function deleteAllReceipts(): Promise<void> {
  await FileSystem.deleteAsync(getReceiptsDirectory(), { idempotent: true }).catch(() => undefined);
}
