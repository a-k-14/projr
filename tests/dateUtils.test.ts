import test from 'node:test';
import assert from 'node:assert/strict';
import { toLocalDayEndISO, toLocalDayStartISO } from '../lib/dateUtils.ts';

test('toLocalDayStartISO snaps to local midnight', () => {
  const value = new Date(2026, 3, 16, 18, 45, 12, 456);
  const iso = toLocalDayStartISO(value);
  const result = new Date(iso);

  assert.equal(result.getFullYear(), 2026);
  assert.equal(result.getMonth(), 3);
  assert.equal(result.getDate(), 16);
  assert.equal(result.getHours(), 0);
  assert.equal(result.getMinutes(), 0);
  assert.equal(result.getSeconds(), 0);
  assert.equal(result.getMilliseconds(), 0);
});

test('toLocalDayEndISO snaps to local end of day', () => {
  const value = new Date(2026, 3, 16, 6, 12, 30, 1);
  const iso = toLocalDayEndISO(value);
  const result = new Date(iso);

  assert.equal(result.getFullYear(), 2026);
  assert.equal(result.getMonth(), 3);
  assert.equal(result.getDate(), 16);
  assert.equal(result.getHours(), 23);
  assert.equal(result.getMinutes(), 59);
  assert.equal(result.getSeconds(), 59);
  assert.equal(result.getMilliseconds(), 999);
});
