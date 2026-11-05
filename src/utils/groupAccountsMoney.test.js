import test from 'node:test';
import assert from 'node:assert/strict';
import { money } from './groupAccountsMoney.js';

test('money returns dash for null, undefined, empty string, and non-finite values', () => {
  assert.equal(money(null), '—');
  assert.equal(money(undefined), '—');
  assert.equal(money(''), '—');
  assert.equal(money(NaN), '—');
  assert.equal(money(Infinity), '—');
});

test('money formats finite numbers with 2 decimal places', () => {
  assert.equal(money(1234.5), (1234.5).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  assert.equal(money(0), (0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  assert.equal(money(-50.25), (-50.25).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
});
