import { db } from '../db/client';
import { settings } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { ReniWidgetConfig } from './widgetTypes';
import { DEFAULT_WIDGET_CONFIG } from './widgetTypes';

function configKey(widgetId: number) {
  return `widget_config_${widgetId}`;
}

export async function saveWidgetConfig(widgetId: number, config: ReniWidgetConfig): Promise<void> {
  const key = configKey(widgetId);
  const value = JSON.stringify(config);
  const existing = await db.select().from(settings).where(eq(settings.key, key));
  if (existing.length > 0) {
    await db.update(settings).set({ value }).where(eq(settings.key, key));
  } else {
    await db.insert(settings).values({ key, value });
  }
}

export async function loadWidgetConfig(widgetId: number): Promise<ReniWidgetConfig> {
  const key = configKey(widgetId);
  const rows = await db.select().from(settings).where(eq(settings.key, key));
  if (!rows[0]) return { ...DEFAULT_WIDGET_CONFIG };
  try {
    return { ...DEFAULT_WIDGET_CONFIG, ...JSON.parse(rows[0].value) };
  } catch {
    return { ...DEFAULT_WIDGET_CONFIG };
  }
}

export async function deleteWidgetConfig(widgetId: number): Promise<void> {
  await db.delete(settings).where(eq(settings.key, configKey(widgetId)));
}
