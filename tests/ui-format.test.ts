import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDateFull, formatMonthYear, formatWeekdayShort } from '../lib/ui-format.ts';

test('ui date formatters return a fallback for invalid ISO values', () => {
  assert.equal(formatDateFull('not-a-date'), 'Invalid Date');
  assert.equal(formatMonthYear('not-a-date'), 'Invalid Date');
  assert.equal(formatWeekdayShort('not-a-date'), 'Invalid Date');
});

test('ui date formatters still format valid ISO values', () => {
  const iso = '2026-04-16T10:30:00.000Z';

  assert.match(formatDateFull(iso), /\d{1,2}\s\w{3}\s\d{4}/);
  assert.match(formatMonthYear(iso), /\w{3}\s\d{4}/);
  assert.ok(formatWeekdayShort(iso).length >= 3);
});
