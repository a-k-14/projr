import { db } from '../db/client';
import { settings } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { Settings } from '../types';

const DEFAULTS: Settings = {
  defaultAccountId: '',
  currency: 'INR',
  currencySymbol: '₹',
  theme: 'auto',
  yearStart: 3,
  cloudBackupEnabled: false,
};

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(settings);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    defaultAccountId: map['defaultAccountId'] ?? DEFAULTS.defaultAccountId,
    currency: map['currency'] ?? DEFAULTS.currency,
    currencySymbol: map['currencySymbol'] ?? DEFAULTS.currencySymbol,
    theme: (map['theme'] as Settings['theme']) ?? DEFAULTS.theme,
    yearStart: map['yearStart'] ? parseInt(map['yearStart']) : DEFAULTS.yearStart,
    cloudBackupEnabled: map['cloudBackupEnabled'] === 'true',
    supabaseUserId: map['supabaseUserId'],
  };
}

export async function updateSettings(data: Partial<Settings>): Promise<Settings> {
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    await db
      .insert(settings)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({ target: settings.key, set: { value: String(value) } });
  }
  return getSettings();
}
