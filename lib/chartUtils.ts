import { toLocalDayStartISO, toLocalDayEndISO, toLocalDateKey } from './dateUtils';

export type TimeBucket = { from: string; to: string; label: string; key: string };

const DAY_ABBREVS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;
const MONTH_ABBREVS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Parse a YYYY-MM-DD string as noon local time to avoid DST edge cases. */
function parseDateNoon(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

/** Format a Date as YYYY-MM-DD */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Return Sunday-based weekday number (0 = Sun … 6 = Sat) but adjusted to Monday-first: 0 = Mon … 6 = Sun */
function mondayDayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function getTimeBuckets(period: string, fromDate: string, toDate: string): TimeBucket[] {
  const from = parseDateNoon(toLocalDateKey(fromDate));
  const to = parseDateNoon(toLocalDateKey(toDate));
  const daySpan = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

  // 1. Force daily buckets for today or week period
  if (period === 'today' || period === 'week' || (period === 'custom' && daySpan <= 14)) {
    const buckets: TimeBucket[] = [];
    const cur = parseDateNoon(toDateKey(from));
    while (cur <= to) {
      const key = toDateKey(cur);
      buckets.push({
        from: toLocalDayStartISO(cur),
        to: toLocalDayEndISO(cur),
        label: DAY_ABBREVS[cur.getDay()],
        key,
      });
      cur.setDate(cur.getDate() + 1);
    }
    return buckets;
  }

  // 2. Force weekly buckets for month period
  if (period === 'month' || (period === 'custom' && daySpan <= 90)) {
    const buckets: TimeBucket[] = [];
    const weekStart = parseDateNoon(toDateKey(from));
    weekStart.setDate(weekStart.getDate() - mondayDayIndex(weekStart));
    let weekNum = 1;
    const cur = weekStart;
    while (cur <= to) {
      const bucketFrom = parseDateNoon(toDateKey(cur));
      const bucketTo = new Date(cur);
      bucketTo.setDate(bucketTo.getDate() + 6);
      const effectiveFrom = bucketFrom < from ? from : bucketFrom;
      const effectiveTo = bucketTo > to ? to : bucketTo;
      const key = `W${weekNum}-${toDateKey(bucketFrom)}`;
      buckets.push({
        from: toLocalDayStartISO(effectiveFrom),
        to: toLocalDayEndISO(effectiveTo),
        label: `W${weekNum}`,
        key,
      });
      weekNum++;
      cur.setDate(cur.getDate() + 7);
    }
    return buckets;
  }

  // 3. Force monthly buckets for year period or large custom spans
  const buckets: TimeBucket[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1, 12, 0, 0);
  while (cur.getFullYear() < to.getFullYear() || cur.getMonth() <= to.getMonth()) {
    const monthStart = new Date(cur.getFullYear(), cur.getMonth(), 1, 12, 0, 0);
    const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 12, 0, 0);
    const effectiveFrom = monthStart < from ? from : monthStart;
    const effectiveTo = monthEnd > to ? to : monthEnd;
    const key = `${cur.getFullYear()}-${(cur.getMonth() + 1).toString().padStart(2, '0')}`;
    buckets.push({
      from: toLocalDayStartISO(effectiveFrom),
      to: toLocalDayEndISO(effectiveTo),
      label: MONTH_ABBREVS[cur.getMonth()],
      key,
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  return buckets;
}
