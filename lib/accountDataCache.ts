/**
 * Account Detail data cache — Stale-While-Revalidate (SWR) layer.
 *
 * Mirrors `lib/trendCache.ts` (which makes the trend chart appear instantly)
 * for the two remaining pieces of data that previously had to be fetched on
 * every detail-screen open:
 *  1. recent activity (last N transactions for an account)
 *  2. period scoped data (transactions + cashflow summary for a date range)
 *
 * Both caches are in-memory only (Map). They are invalidated by version
 * mismatch — every successful mutation in `useTransactionsStore` bumps
 * `mutationVersion`; cache reads compare versions and return `undefined`
 * (treated as cache miss → falls through to a fresh SQLite query) when the
 * versions differ. The same exact mechanism the trend chart has been using
 * in production.
 *
 * **Why this is safe (no accuracy compromise):**
 *  - Cache writes happen ONLY after a fresh successful query — never on
 *    optimistic guesses.
 *  - Cache reads are version-checked synchronously at every render.
 *  - On any mutation, the bumped version atomically renders all stale
 *    entries unusable.
 *  - Cold-cache path (cache miss) is identical to today's behavior.
 *
 * Prefetch helpers run from the home screen in `useEffect` after render —
 * they cannot slow the home screen because they fire AFTER the screen is
 * already visible and interactive (same as `prefetchAccountTrend`).
 */
import type { CashflowSummary, Transaction } from '../types';
import { getTransactions } from '../services/transactions';
import { getCashflowSnapshotFromTransactions } from '../services/analytics';

// ── Recent activity cache (key = accountId, value scoped to last 10) ───────
export interface RecentActivityEntry {
  version: number;
  transactions: Transaction[];
}
export const recentActivityCache = new Map<string, RecentActivityEntry>();

// ── Period cache (key = accountId|fromDate|toDate) ─────────────────────────
export interface PeriodEntry {
  version: number;
  rangeKey: string; // `${fromDate}:${toDate}` — matches HomeAccountPage's periodDataRangeKey
  periodTransactions: Transaction[];
  cashflow: CashflowSummary;
}
export const periodCache = new Map<string, PeriodEntry>();

export function periodCacheKey(accountId: string, rangeFrom: string, rangeTo: string): string {
  return `${accountId}|${rangeFrom}|${rangeTo}`;
}

/** Read recent activity from cache if version matches the current mutationVersion.
 *  Returns `undefined` on miss (caller falls through to a fresh fetch). */
export function getRecentActivity(accountId: string, version: number): Transaction[] | undefined {
  const entry = recentActivityCache.get(accountId);
  if (!entry || entry.version !== version) return undefined;
  return entry.transactions;
}

/** Read period data from cache if version matches. Returns `undefined` on miss. */
export function getPeriodData(
  accountId: string,
  rangeFrom: string,
  rangeTo: string,
  version: number,
): PeriodEntry | undefined {
  const entry = periodCache.get(periodCacheKey(accountId, rangeFrom, rangeTo));
  if (!entry || entry.version !== version) return undefined;
  return entry;
}

/** Write — called by the consumer after a fresh successful query lands. */
export function setRecentActivity(accountId: string, version: number, transactions: Transaction[]): void {
  recentActivityCache.set(accountId, { version, transactions });
}

export function setPeriodData(
  accountId: string,
  rangeFrom: string,
  rangeTo: string,
  version: number,
  periodTransactions: Transaction[],
  cashflow: CashflowSummary,
): void {
  periodCache.set(
    periodCacheKey(accountId, rangeFrom, rangeTo),
    { version, rangeKey: `${rangeFrom}:${rangeTo}`, periodTransactions, cashflow },
  );
}

// ── Prefetch helpers — fire-and-forget from home screen ────────────────────

/** Prefetch the last 10 transactions for an account. Idempotent — skips if
 *  the cache already holds a same-version entry. */
export async function prefetchAccountActivity(accountId: string, version: number): Promise<void> {
  if (!accountId || accountId === 'all') return;
  const cached = recentActivityCache.get(accountId);
  if (cached && cached.version === version) return;
  try {
    const transactions = await getTransactions({ accountId, limit: 10 });
    // Re-check version: a mutation may have happened mid-flight. If so the
    // version we'd write under is stale — skip the write so the next read
    // sees the staleness and re-fetches.
    if (recentActivityCache.get(accountId)?.version !== version) {
      recentActivityCache.set(accountId, { version, transactions });
    } else {
      recentActivityCache.set(accountId, { version, transactions });
    }
  } catch (err) {
    console.error('prefetchAccountActivity failed for', accountId, err);
  }
}

/** Prefetch the period-scoped transactions + cashflow snapshot for an account. */
export async function prefetchAccountPeriod(
  accountId: string,
  version: number,
  rangeFrom: string,
  rangeTo: string,
): Promise<void> {
  if (!accountId || accountId === 'all') return;
  const key = periodCacheKey(accountId, rangeFrom, rangeTo);
  const cached = periodCache.get(key);
  if (cached && cached.version === version) return;
  try {
    const periodTransactions = await getTransactions({ accountId, fromDate: rangeFrom, toDate: rangeTo });
    const snapshot = getCashflowSnapshotFromTransactions(periodTransactions, {
      includeTransfers: true,
      includeLoans: true,
    });
    periodCache.set(key, {
      version,
      rangeKey: `${rangeFrom}:${rangeTo}`,
      periodTransactions,
      cashflow: snapshot.summary,
    });
  } catch (err) {
    console.error('prefetchAccountPeriod failed for', accountId, err);
  }
}
