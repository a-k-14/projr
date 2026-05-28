import type { PeriodType } from '../types';

export const APP_LOCALE = 'en-IN';

export function toLocalDayStartISO(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : new Date(value);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0
  ).toISOString();
}

export function toUTCMidnight(date: Date): string {
  return toLocalDayStartISO(date);
}

export function todayUTC(): string {
  return toUTCMidnight(new Date());
}

export function nowUTC(): string {
  return new Date().toISOString();
}

export function toLocalDayEndISO(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : new Date(value);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999
  ).toISOString();
}

/** Returns YYYY-MM-DD for a given ISO string in the user's local timezone */
export function toLocalDateKey(isoDate: string): string {
  const d = new Date(isoDate);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Null-safe wrapper around toLocalDateKey with a fallback for malformed dates.
 * Use this when the date field might be null/undefined (e.g. tx.date from DB rows).
 */
export function safeLocalDateKey(value: string | null | undefined): string {
  if (!value) return '';
  try {
    return toLocalDateKey(value);
  } catch {
    return value.split?.('T')?.[0] ?? value;
  }
}

export function toLocalMonthStartISO(year: number, month: number): string {
  return new Date(year, month, 1, 0, 0, 0, 0).toISOString();
}

export function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  const day = d.getDate().toString().padStart(2, '0');
  const month = d.toLocaleDateString(APP_LOCALE, { month: 'short' });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export function formatDateTime(isoDate: string): string {
  const d = new Date(isoDate);
  const date = formatDate(isoDate);
  const time = d.toLocaleTimeString(APP_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${date} · ${time}`;
}

export function formatDateTime12(isoDate: string): string {
  const d = new Date(isoDate);
  const date = formatDate(isoDate);
  const time = d.toLocaleTimeString(APP_LOCALE, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${date} · ${time.toLowerCase()}`;
}

export function formatDateShort(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString(APP_LOCALE, { day: 'numeric', month: 'short' });
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

  const weekday = date.toLocaleDateString(APP_LOCALE, { weekday: 'short' });
  return { date: formattedDate, label: weekday };
}

export function getDateRange(
  period: PeriodType,
  yearStart: number = 3,
  customFrom?: string,
  customTo?: string
): { from: string; to: string } {
  if (period === 'custom') {
    return { 
      from: customFrom ?? toLocalDayStartISO(new Date()), 
      to: customTo ?? toLocalDayEndISO(new Date()) 
    };
  }

  if (period === 'week') {
    const day = new Date().getDay();
    const monday = new Date();
    monday.setDate(new Date().getDate() - ((day + 6) % 7));
    return { 
      from: toLocalDayStartISO(monday), 
      to: toLocalDayEndISO(new Date()) 
    };
  }

  if (period === 'month') {
    const from = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    return { 
      from: toLocalDayStartISO(from), 
      to: toLocalDayEndISO(new Date()) 
    };
  }

  if (period === 'year') {
    const month = new Date().getMonth();
    const year = month >= yearStart ? new Date().getFullYear() : new Date().getFullYear() - 1;
    const from = new Date(year, yearStart, 1);
    return { 
      from: toLocalDayStartISO(from), 
      to: toLocalDayEndISO(new Date()) 
    };
  }

  // default to today
  return { 
    from: toLocalDayStartISO(new Date()), 
    to: toLocalDayEndISO(new Date()) 
  };
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
    
    // Local start of day
    const fromDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    // Local end of day
    const toDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    
    return { from: fromDate.toISOString(), to: toDate.toISOString() };
  }

  if (period === 'week') {
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + offset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    return { 
      from: toLocalDayStartISO(monday), 
      to: offset === 0 // current week
        ? toLocalDayEndISO(now)
        : toLocalDayEndISO(sunday)
    };
  }

  if (period === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const lastDay = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    return { 
      from: toLocalDayStartISO(from), 
      to: offset === 0 
        ? toLocalDayEndISO(now) 
        : toLocalDayEndISO(lastDay) 
    };
  }

  // year (fiscal)
  const currentMonth = now.getMonth();
  const currentFYStart = currentMonth >= yearStart ? now.getFullYear() : now.getFullYear() - 1;
  const targetFYStart = currentFYStart + offset;
  const from = new Date(targetFYStart, yearStart, 1);
  const lastDayOfFY = new Date(targetFYStart + 1, yearStart, 0);
  
  return { 
    from: toLocalDayStartISO(from), 
    to: offset === 0 
      ? toLocalDayEndISO(now) 
      : toLocalDayEndISO(lastDayOfFY) 
  };
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
    return fromDate.toLocaleDateString(APP_LOCALE, { month: 'short', year: 'numeric' });
  }
  if (period === 'year') {
    const fromMon = fromDate.toLocaleDateString(APP_LOCALE, { month: 'short' });
    const toMon = toDate.toLocaleDateString(APP_LOCALE, { month: 'short' });
    return `${fromMon} ${fromDate.getFullYear()} – ${toMon} ${toDate.getFullYear()}`;
  }
  // custom
  if (from.split('T')[0] === to.split('T')[0]) {
    return fromDate.toLocaleDateString(APP_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return `${formatDateShort(from)} – ${formatDateShort(to)}`;
}

export function getDayLabel(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(APP_LOCALE, { weekday: 'short' });
}

export function isSameDay(a: string, b: string): boolean {
  return toLocalDateKey(a) === toLocalDateKey(b);
}

/** Whole days from today until `targetISO`. Negative when the target is in the past. */
export function getDaysUntil(targetISO: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const target = new Date(targetISO);
  target.setHours(0, 0, 0, 0);
  
  const diff = target.getTime() - today.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

/**
 * Safely adds months to a Date object without overflowing past the target month's end.
 * e.g., Jan 31 + 1 month = Feb 28 (or Feb 29 on leap years) instead of Mar 3.
 */
export function addMonthsSafe(date: Date, months: number): Date {
  const result = new Date(date);
  const expectedMonth = (result.getMonth() + months) % 12;
  const targetMonth = expectedMonth < 0 ? expectedMonth + 12 : expectedMonth;
  
  result.setMonth(result.getMonth() + months);
  
  if (result.getMonth() !== targetMonth) {
    result.setDate(0);
  }
  return result;
}
