import test from 'node:test';
import assert from 'node:assert/strict';
import { formatOrderNumber, formatOrderTime } from './orderDisplay.js';

test('order prices remove floating point tails while preserving instrument precision', () => {
  assert.equal(formatOrderNumber(4151.660000000001), '4151.66');
  assert.equal(formatOrderNumber(1.3215299999999999), '1.32153');
  assert.equal(formatOrderNumber(1.12465, 5), '1.12465');
  assert.equal(formatOrderNumber(4181.49, 3), '4181.490');
  assert.equal(formatOrderNumber(1234.567, 0), '1235');
  assert.equal(formatOrderNumber(0.00000001), '0.00000001');
  assert.equal(formatOrderNumber('1.1234567890123456', 16), '1.1234567890123456');
});

test('volume precision and missing values are handled without changing source numbers', () => {
  assert.equal(formatOrderNumber(1, undefined, 2), '1.00');
  assert.equal(formatOrderNumber(0.001, undefined, 2), '0.001');
  assert.equal(formatOrderNumber(0.65, 3, 2), '0.650');
  assert.equal(formatOrderNumber(0), '0');
  for (const value of [null, undefined, '', 'invalid', Infinity]) assert.equal(formatOrderNumber(value), '—');
  const raw = 4151.660000000001;
  formatOrderNumber(raw);
  assert.equal(raw, 4151.660000000001);
});

test('order times display consistent local dates and include seconds', () => {
  const time = new Date(2026, 9, 5, 13, 44, 22).getTime();
  assert.equal(formatOrderTime(time), '2026.10.05 13:44:22');
  assert.equal(formatOrderTime(null, 'Saved timestamp'), 'Saved timestamp');
  assert.equal(formatOrderTime(NaN), '—');
});
