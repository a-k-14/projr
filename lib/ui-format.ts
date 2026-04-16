export function isEmojiIcon(icon?: string | null): boolean {
  return !!icon && !/^[a-z-]+$/i.test(icon);
}

function formatIfValid(
  iso: string,
  options: Intl.DateTimeFormatOptions,
  fallback: string = 'Invalid Date'
): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) {
    return fallback;
  }

  try {
    return value.toLocaleDateString('en-IN', options);
  } catch {
    return fallback;
  }
}

export function formatDateFull(iso: string): string {
  return formatIfValid(iso, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatMonthYear(iso: string): string {
  return formatIfValid(iso, {
    month: 'short',
    year: 'numeric',
  });
}

export function formatWeekdayShort(iso: string): string {
  return formatIfValid(iso, {
    weekday: 'short',
  });
}
