export function isEmojiIcon(icon?: string | null): boolean {
  return !!icon && !/^[a-z-]+$/i.test(icon);
}

export function formatDateFull(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
}

export function formatWeekdayShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short',
  });
}
