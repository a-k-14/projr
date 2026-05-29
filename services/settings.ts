import { db } from '../db/client';
import { accounts, budget, categories, loans, settings, tags, transactions, deposits, persons, assets } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { Settings } from '../types';

const STARTER_DATA_SEED_STATE_KEY = 'starterDataSeedState';
type StarterDataSeedState = 'seeded' | 'suppressed';

export const DEFAULT_SETTINGS: Settings = {
  defaultAccountId: '',
  lastUsedAccountId: '',
  currency: 'INR',
  currencySymbol: '₹',
  showCurrencySymbol: false,
  theme: 'light',
  yearStart: 0,
  cloudBackupEnabled: false,
  biometricLock: false,
  homeAccountViewMode: 'swipe',
  homeExcludedAccountIds: [],
  autoBackupEnabled: false,
  autoBackupFolderUri: '',
  autoBackupFrequencyDays: 1,
  lastAutoBackupAt: '',
  autoBackupKeepCount: 7,
  lastManualBackupAt: '',
  lastAutoBackupError: '',
  hideAmounts: false,
  lastRestoreAt: '',
};

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(settings);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const homeExcludedAccountIds = parseStringArraySetting(
    map['homeExcludedAccountIds'],
    DEFAULT_SETTINGS.homeExcludedAccountIds,
  );

  return {
    defaultAccountId: map['defaultAccountId'] ?? DEFAULT_SETTINGS.defaultAccountId,
    lastUsedAccountId: map['lastUsedAccountId'] ?? DEFAULT_SETTINGS.lastUsedAccountId,
    currency: map['currency'] ?? DEFAULT_SETTINGS.currency,
    currencySymbol: map['currencySymbol'] ?? DEFAULT_SETTINGS.currencySymbol,
    showCurrencySymbol: map['showCurrencySymbol'] === 'true' || (map['showCurrencySymbol'] === undefined && DEFAULT_SETTINGS.showCurrencySymbol),
    theme: (map['theme'] as Settings['theme']) ?? DEFAULT_SETTINGS.theme,
    yearStart: map['yearStart'] ? parseInt(map['yearStart']) : DEFAULT_SETTINGS.yearStart,
    cloudBackupEnabled: map['cloudBackupEnabled'] === 'true',
    biometricLock: map['biometricLock'] === 'true',
    homeAccountViewMode: map['homeAccountViewMode'] === 'list' ? 'list' : 'swipe',
    homeExcludedAccountIds,
    supabaseUserId: map['supabaseUserId'],
    autoBackupEnabled: map['autoBackupEnabled'] === 'true',
    autoBackupFolderUri: map['autoBackupFolderUri'] ?? '',
    autoBackupFrequencyDays: map['autoBackupFrequencyDays'] ? parseInt(map['autoBackupFrequencyDays']) : DEFAULT_SETTINGS.autoBackupFrequencyDays,
    lastAutoBackupAt: map['lastAutoBackupAt'] ?? '',
    autoBackupKeepCount: map['autoBackupKeepCount'] ? parseInt(map['autoBackupKeepCount']) : DEFAULT_SETTINGS.autoBackupKeepCount,
    lastManualBackupAt: map['lastManualBackupAt'] ?? '',
    lastAutoBackupError: map['lastAutoBackupError'] ?? '',
    hideAmounts: map['hideAmounts'] === 'true' || (map['hideAmounts'] === undefined && DEFAULT_SETTINGS.hideAmounts),
    lastRestoreAt: map['lastRestoreAt'] ?? '',
  };
}

export async function updateSettings(data: Partial<Settings>): Promise<void> {
  const updates = Object.entries(data).filter(([, value]) => value !== undefined);
  if (updates.length === 0) return;

  await Promise.all(
    updates.map(([key, value]) =>
      db
        .insert(settings)
        .values({ key, value: serializeSettingValue(value) })
        .onConflictDoUpdate({ target: settings.key, set: { value: serializeSettingValue(value) } }),
    ),
  );
}

function parseStringArraySetting(value: string | undefined, fallback: string[]) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : fallback;
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
}

function serializeSettingValue(value: Settings[keyof Settings]) {
  return Array.isArray(value) ? JSON.stringify(value) : String(value);
}

async function setInternalSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function shouldAutoSeedStarterData(): Promise<boolean> {
  const rows = await db.select().from(settings).where(eq(settings.key, STARTER_DATA_SEED_STATE_KEY));
  return rows[0]?.value === undefined;
}

export async function markStarterDataSeeded(): Promise<void> {
  await setInternalSetting(STARTER_DATA_SEED_STATE_KEY, 'seeded');
}

export async function clearLocalData(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(transactions);
    await tx.delete(loans);
    await tx.delete(deposits);
    await tx.delete(budget);
    await tx.delete(tags);
    await tx.delete(persons);
    await tx.delete(assets);
    // Categories and Accounts have foreign key relationships, 
    // but transactions/loans/budget/deposits refer to them. We cleared those first.
    await tx.delete(categories);
    await tx.delete(accounts);
    await tx.delete(settings);
    await tx
      .insert(settings)
      .values({ key: STARTER_DATA_SEED_STATE_KEY, value: 'suppressed' satisfies StarterDataSeedState });
  });
}
