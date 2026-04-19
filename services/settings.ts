import { db } from '../db/client';
import { accounts, budget, categories, loans, settings, tags, transactions } from '../db/schema';
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
};

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(settings);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
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
    supabaseUserId: map['supabaseUserId'],
  };
}

export async function updateSettings(data: Partial<Settings>): Promise<void> {
  const updates = Object.entries(data).filter(([, value]) => value !== undefined);
  if (updates.length === 0) return;

  await Promise.all(
    updates.map(([key, value]) =>
      db
        .insert(settings)
        .values({ key, value: String(value) })
        .onConflictDoUpdate({ target: settings.key, set: { value: String(value) } }),
    ),
  );
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
    await tx.delete(budget);
    await tx.delete(tags);
    // Categories and Accounts have foreign key relationships, 
    // but transactions/loans/budget refer to them. We cleared those first.
    await tx.delete(categories);
    await tx.delete(accounts);
    await tx.delete(settings);
    await tx
      .insert(settings)
      .values({ key: STARTER_DATA_SEED_STATE_KEY, value: 'suppressed' satisfies StarterDataSeedState });
  });
}
