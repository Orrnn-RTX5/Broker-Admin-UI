import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeArrayResponse, normalizePagedResponse, getApiErrorMessage } from './apiShapes.js';

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

test('normalizePagedResponse returns raw array rows with unknown total when already within the page size', () => {
  const rows = [{ id: 1 }, { id: 2 }];
  const page = normalizePagedResponse(rows, { page: 1, limit: 100 });

  assert.equal(page.rows, rows);
  assert.equal(page.total, undefined);
  assert.equal(page.hasKnownTotal, false);
  assert.equal(page.hasNextPage, false);
  assert.equal(page.pageStart, 1);
  assert.equal(page.pageEnd, 2);
});

test('normalizePagedResponse accepts common wrapper shapes', () => {
  assert.deepEqual(normalizePagedResponse({ answer: [{ id: 1 }] }).rows, [{ id: 1 }]);
  assert.deepEqual(normalizePagedResponse({ data: [{ id: 2 }] }).rows, [{ id: 2 }]);
  assert.deepEqual(normalizePagedResponse({ items: [{ id: 3 }] }).rows, [{ id: 3 }]);
});

test('normalizePagedResponse reads totals from common metadata locations', () => {
  assert.equal(normalizePagedResponse({ data: [], total: 41 }).total, 41);
  assert.equal(normalizePagedResponse({ data: [], totalCount: '42' }).total, 42);
  assert.equal(normalizePagedResponse({ data: [], count: 43 }).total, 43);
  assert.equal(normalizePagedResponse({ data: [], meta: { total: 44 } }).total, 44);
  assert.equal(normalizePagedResponse({ data: [], pagination: { total: 45 } }).total, 45);
});

test('normalizePagedResponse slices legacy full-array responses before mapping work', () => {
  const rows = Array.from({ length: 250 }, (_, index) => ({ id: index + 1 }));
  const page = normalizePagedResponse({ answer: rows }, { page: 2, limit: 100 });

  assert.equal(page.clientPaged, true);
  assert.equal(page.hasKnownTotal, true);
  assert.equal(page.total, 250);
  assert.equal(page.rows.length, 100);
  assert.equal(page.rows[0].id, 101);
  assert.equal(page.pageStart, 101);
  assert.equal(page.pageEnd, 200);
  assert.equal(page.hasNextPage, true);
});

test('normalizePagedResponse slices oversized rows even when metadata total exists', () => {
  const rows = Array.from({ length: 250 }, (_, index) => ({ id: index + 1 }));
  const page = normalizePagedResponse({ data: rows, total: 250 }, { page: 2, limit: 100 });

  assert.equal(page.clientPaged, true);
  assert.equal(page.hasKnownTotal, true);
  assert.equal(page.total, 250);
  assert.equal(page.rows.length, 100);
  assert.equal(page.rows[0].id, 101);
});

test('normalizePagedResponse filters legacy full-array responses before slicing', () => {
  const rows = Array.from({ length: 120 }, (_, index) => ({
    id: index + 1,
    status: index % 2 === 0 ? 'active' : 'disabled',
  }));
  const page = normalizePagedResponse(
    { rows },
    { page: 1, limit: 50, filterFn: (row) => row.status === 'active' }
  );

  assert.equal(page.total, 60);
  assert.equal(page.rows.length, 50);
  assert.equal(page.rows.every((row) => row.status === 'active'), true);
});

test('normalizePagedResponse keeps total unknown for page-shaped responses without metadata', () => {
  const rows = Array.from({ length: 100 }, (_, index) => ({ id: index + 1 }));
  const page = normalizePagedResponse({ data: rows }, { page: 3, limit: 100 });

  assert.equal(page.hasKnownTotal, false);
  assert.equal(page.total, undefined);
  assert.equal(page.hasNextPage, true);
  assert.equal(page.pageStart, 201);
  assert.equal(page.pageEnd, 300);
});

test('getApiErrorMessage extracts meaningful backend errors', () => {
  assert.equal(getApiErrorMessage({ response: { data: { message: 'Forbidden' } } }), 'Forbidden');
  assert.equal(getApiErrorMessage({ response: { data: { error: { message: 'Bad contract' } } } }), 'Bad contract');
  assert.equal(getApiErrorMessage({ message: 'Network down' }), 'Network down');
});
