import { db } from '../db/client';
import { settings } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { Settings } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  defaultAccountId: '',
  lastUsedAccountId: '',
  currency: 'INR',
  currencySymbol: '₹',
  showCurrencySymbol: false,
  theme: 'light',
  yearStart: 3,
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
