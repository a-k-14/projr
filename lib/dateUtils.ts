import type { PeriodType } from '../types';

export function toUTCMidnight(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function todayUTC(): string {
  return toUTCMidnight(new Date());
}

export function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateShort(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function getRelativeDateLabel(isoDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(isoDate);
  date.setHours(0, 0, 0, 0);
  const diff = today.getTime() - date.getTime();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return `${formatDate(isoDate)} · Today`;
  if (days === 1) return `${formatDate(isoDate)} · Yesterday`;
  return formatDate(isoDate);
}

export function getDateRange(
  period: PeriodType,
  yearStart: number = 3,
  customFrom?: string,
  customTo?: string
): { from: string; to: string } {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const todayEnd = now.toISOString();

  const todayStart = toUTCMidnight(new Date());

  if (period === 'custom') {
    return { from: customFrom ?? todayStart, to: customTo ?? todayEnd };
  }

  if (period === 'week') {
    const day = new Date().getDay();
    const monday = new Date();
    monday.setDate(new Date().getDate() - ((day + 6) % 7));
    return { from: toUTCMidnight(monday), to: todayEnd };
  }

  if (period === 'month') {
    const from = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    return { from: toUTCMidnight(from), to: todayEnd };
  }

  if (period === 'year') {
    const month = new Date().getMonth();
    const year = month >= yearStart ? new Date().getFullYear() : new Date().getFullYear() - 1;
    const from = new Date(year, yearStart, 1);
    return { from: toUTCMidnight(from), to: todayEnd };
  }

  return { from: todayStart, to: todayEnd };
}

export function getDayLabel(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-IN', { weekday: 'short' }).charAt(0).toUpperCase();
}

export function isSameDay(a: string, b: string): boolean {
  return a.split('T')[0] === b.split('T')[0];
}
