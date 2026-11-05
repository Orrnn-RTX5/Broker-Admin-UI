import test from 'node:test';
import assert from 'node:assert/strict';
import { formatAccountAmount } from './accountAmountDisplay.js';

test('amount display removes floating point artifacts and retains zero and negatives', () => {
  assert.equal(formatAccountAmount(209944.02000000002, 'USD'), '209,944.02');
  assert.equal(formatAccountAmount('10000', 'USD'), '10,000.00');
  assert.equal(formatAccountAmount(0, 'USD'), '0.00');
  assert.equal(formatAccountAmount(-1234.5, 'USD'), '-1,234.50');
});

test('account precision overrides currency defaults, including zero digits', () => {
  assert.equal(formatAccountAmount(1234.567, 'JPY'), '1,235');
  assert.equal(formatAccountAmount(1234.567, 'KWD'), '1,234.567');
  assert.equal(formatAccountAmount(1234.567, 'USD', '3'), '1,234.567');
  assert.equal(formatAccountAmount(1234.567, 'USD', 0), '1,235');
  assert.equal(formatAccountAmount(1234.567, 'USD', -1), '1,234.57');
  assert.equal(formatAccountAmount(1234.567, 'USD', 100), '1,234.57');
});

test('missing and invalid amounts remain unknown rather than looking like a zero balance', () => {
  for (const amount of [null, undefined, '', ' ', NaN, Infinity, 'invalid']) assert.equal(formatAccountAmount(amount, 'USD'), '—');
  assert.equal(formatAccountAmount(12.34, ''), '12.34');
});
test('cold-account row renders dash for null equity through table mapping steps', () => {
  const row = { login: 1, balance: 100, equity: null, metricsAvailable: false, metricsUnavailableReason: 'METRICS_CACHE_MISS' };
  const pickDefined = (source, keys, fallback = '') => {
    for (const key of keys) {
      const value = source?.[key];
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return fallback;
  };
  const mappedEquity = pickDefined(row, ['equity', 'Equity']);
  assert.equal(mappedEquity, '');
  assert.equal(formatAccountAmount(mappedEquity, 'USD'), '—');
  assert.equal(formatAccountAmount(null), '—');
  assert.equal(formatAccountAmount(''), '—');
});
