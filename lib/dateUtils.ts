import type { PeriodType } from '../types';

export function toUTCMidnight(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function todayUTC(): string {
  return toUTCMidnight(new Date());
}

export function nowUTC(): string {
  return new Date().toISOString();
}

export function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  const day = d.getDate().toString().padStart(2, '0');
  const month = d.toLocaleDateString('en-IN', { month: 'short' });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export function formatDateTime(isoDate: string): string {
  const d = new Date(isoDate);
  const date = formatDate(isoDate);
  const time = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${date} · ${time}`;
}

export function formatDateTime12(isoDate: string): string {
  const d = new Date(isoDate);
  const date = formatDate(isoDate);
  const time = d.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${date} · ${time.toLowerCase()}`;
}

export function formatDateShort(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function getRelativeDateLabel(isoDate: string): { date: string; label?: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(isoDate);
  date.setHours(0, 0, 0, 0);
  const diff = today.getTime() - date.getTime();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));

  const formattedDate = formatDate(isoDate);

  if (days === 0) return { date: formattedDate, label: 'Today' };
  if (days === 1) return { date: formattedDate, label: 'Yesterday' };
  if (days === -1) return { date: formattedDate, label: 'Tomorrow' };

  return { date: formattedDate };
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

/**
 * Compute the {from, to} date range for a navigable period + offset.
 * offset 0 = current period, -1 = previous, etc.
 */
export function getNavigableDateRange(
  period: 'day' | 'week' | 'month' | 'year',
  offset: number,
  yearStart: number = 3,
): { from: string; to: string } {
  const now = new Date();

  if (period === 'day') {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    const from = toUTCMidnight(d);
    const to = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString();
    return { from, to };
  }

  if (period === 'week') {
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + offset * 7);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const endOfSunday = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 23, 59, 59, 999);
    // Cap "to" at today for the current week
    const to = offset === 0
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()
      : endOfSunday.toISOString();
    return { from: monday.toISOString(), to };
  }

  if (period === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const to = offset === 0
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()
      : new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate(), 23, 59, 59, 999).toISOString();
    return { from: toUTCMidnight(d), to };
  }

  // year (fiscal)
  const currentMonth = now.getMonth();
  const currentFYStart = currentMonth >= yearStart ? now.getFullYear() : now.getFullYear() - 1;
  const targetFYStart = currentFYStart + offset;
  const from = new Date(targetFYStart, yearStart, 1);
  const lastDayOfFY = new Date(targetFYStart + 1, yearStart, 0);
  const to = offset === 0
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()
    : new Date(lastDayOfFY.getFullYear(), lastDayOfFY.getMonth(), lastDayOfFY.getDate(), 23, 59, 59, 999).toISOString();
  return { from: toUTCMidnight(from), to };
}

/**
 * Human-readable label for a period + its date range.
 * e.g. "Apr 2026", "7 – 12 Apr", "12 Apr 2026", "Apr 2025 – Mar 2026"
 */
export function getPeriodNavLabel(
  period: 'day' | 'week' | 'month' | 'year' | 'custom',
  from: string,
  to: string,
): string {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (period === 'day') {
    return formatDate(from);
  }
  if (period === 'week') {
    return `${formatDateShort(from)} – ${formatDateShort(to)}`;
  }
  if (period === 'month') {
    return fromDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  }
  if (period === 'year') {
    const fromMon = fromDate.toLocaleDateString('en-IN', { month: 'short' });
    const toMon = toDate.toLocaleDateString('en-IN', { month: 'short' });
    return `${fromMon} ${fromDate.getFullYear()} – ${toMon} ${toDate.getFullYear()}`;
  }
  // custom
  return `${formatDateShort(from)} – ${formatDateShort(to)}`;
}

export function getDayLabel(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-IN', { weekday: 'short' }).charAt(0).toUpperCase();
}

export function isSameDay(a: string, b: string): boolean {
  return a.split('T')[0] === b.split('T')[0];
}
