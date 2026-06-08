import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeArrayResponse, getApiErrorMessage } from './apiShapes.js';

test('normalizeArrayResponse returns raw arrays unchanged', () => {
  const rows = [{ id: 1 }];

  assert.equal(normalizeArrayResponse(rows), rows);
});

test('normalizeArrayResponse accepts common wrapper shapes', () => {
  assert.deepEqual(normalizeArrayResponse({ users: [{ id: 1 }] }), [{ id: 1 }]);
  assert.deepEqual(normalizeArrayResponse({ accounts: [{ login: 2 }] }), [{ login: 2 }]);
  assert.deepEqual(normalizeArrayResponse({ instruments: [{ symbol: 'EURUSD' }] }), [{ symbol: 'EURUSD' }]);
  assert.deepEqual(normalizeArrayResponse({ answer: [{ name: 'demo' }] }, ['answer']), [{ name: 'demo' }]);
});

test('normalizeArrayResponse returns an empty list for unsupported shapes', () => {
  assert.deepEqual(normalizeArrayResponse({ ok: true }), []);
  assert.deepEqual(normalizeArrayResponse(null), []);
});

test('getApiErrorMessage extracts meaningful backend errors', () => {
  assert.equal(getApiErrorMessage({ response: { data: { message: 'Forbidden' } } }), 'Forbidden');
  assert.equal(getApiErrorMessage({ response: { data: { error: { message: 'Bad contract' } } } }), 'Bad contract');
  assert.equal(getApiErrorMessage({ message: 'Network down' }), 'Network down');
});
