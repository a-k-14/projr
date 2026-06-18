import { getAccountBalanceTrend } from '../services/analytics';
import { toLocalDayStartISO, toLocalDayEndISO } from './dateUtils';

export const trendCache = new Map<string, { version: number, data: { date: string; val: number }[] }>();

export async function prefetchAccountTrend(accountId: string, version: number) {
  const cached = trendCache.get(accountId);
  if (cached && cached.version === version) return;
  
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 29);
  const fromStr = toLocalDayStartISO(thirtyDaysAgo);
  const toStr = toLocalDayEndISO(today);
  try {
    const trend = await getAccountBalanceTrend(accountId, fromStr, toStr);
    const mapped = trend.map(t => ({ date: t.date, val: t.balance }));
    trendCache.set(accountId, { version, data: mapped });
  } catch (err) {
    console.error('Failed to prefetch trend for account', accountId, err);
  }
}
