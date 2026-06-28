/**
 * Bootstrap cache for the Home hero data.
 *
 * Populated during app init (before splash hides) so that HomeAccountPage can
 * consume today's income/expense/cashflow data on its very first render,
 * eliminating the "values appear after load" flash.
 *
 * Module-level so it survives component re-mounts within the same JS session.
 */

import type { Transaction } from '../types';

export interface HomeBootstrapData {
  todayTransactions: Transaction[];
  recentTransactions: Transaction[];
  rangeFrom: string;
  rangeTo: string;
}

let _cache: HomeBootstrapData | null = null;

export function setHomeBootstrapCache(data: HomeBootstrapData): void {
  _cache = data;
}

/** Drains the cache (returns it and clears). Each mount only gets one shot. */
export function drainHomeBootstrapCache(): HomeBootstrapData | null {
  const val = _cache;
  _cache = null;
  return val;
}

export function peekHomeBootstrapCache(): HomeBootstrapData | null {
  return _cache;
}
