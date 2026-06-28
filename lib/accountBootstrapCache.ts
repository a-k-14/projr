/**
 * Cache for account details pre-warm data.
 * Keeps initial transactions and balance trends in-memory so they are ready
 * the instant the user taps into any account detail screen.
 */

import type { Transaction } from '../types';

export interface AccountPrefetchedData {
  todayTransactions: Transaction[];
  recentTransactions: Transaction[];
  trendPoints: { date: string; val: number }[];
  rangeFrom: string;
  rangeTo: string;
}

const _accountCache = new Map<string, AccountPrefetchedData>();

export function setAccountBootstrapCache(accountId: string, data: AccountPrefetchedData): void {
  _accountCache.set(accountId, data);
}

export function getAccountBootstrapCache(accountId: string): AccountPrefetchedData | undefined {
  return _accountCache.get(accountId);
}

export function clearAccountBootstrapCache(accountId: string): void {
  _accountCache.delete(accountId);
}
