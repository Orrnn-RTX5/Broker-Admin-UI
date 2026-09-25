import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  NOT_CONFIGURED_LABEL,
  appendSymbolToList,
  buildLpSymbolOptions,
  excludeSymbols,
  getUnconfiguredSymbolRows,
  mergeUnconfiguredSymbolPage,
} from './lpSymbolLists.js';

const entries = [
  { symbol: 'BTCUSD', configured: false, category: 'Crypto' },
  { symbol: 'EURUSD', configured: true, category: 'Forex' },
  { symbol: 'US30', configured: false, category: '' },
  { symbol: 'XAUUSD', configured: false, category: 'Metals' },
];

const pagedOf = (rows, { total, page = 1, limit = 2 } = {}) => ({
  rows,
  total,
  hasKnownTotal: Number.isFinite(total),
  page,
  limit,
  clientPaged: false,
});

test('buildLpSymbolOptions labels unconfigured LP symbols', () => {
  assert.deepEqual(buildLpSymbolOptions(entries).map((o) => [o.value, o.label, o.configured]), [
    ['BTCUSD', 'not configured · Crypto', false],
    ['EURUSD', 'Forex', true],
    ['US30', 'not configured', false],
    ['XAUUSD', 'not configured · Metals', false],
  ]);
  assert.deepEqual(buildLpSymbolOptions(null), []);
});

test('excludeSymbols drops names already present, ignoring case', () => {
  assert.deepEqual(excludeSymbols(['BTCUSD', 'EURUSD', 'XAUUSD'], ['eurusd']), ['BTCUSD', 'XAUUSD']);
  assert.deepEqual(excludeSymbols(['BTCUSD'], undefined), ['BTCUSD']);
});

test('appendSymbolToList keeps the comma list format and skips duplicates', () => {
  assert.equal(appendSymbolToList('', 'EURUSD'), 'EURUSD');
  assert.equal(appendSymbolToList('forex\\*,EURUSD', 'XAUUSD'), 'forex\\*, EURUSD, XAUUSD');
  assert.equal(appendSymbolToList('EURUSD, XAUUSD', 'eurusd'), 'EURUSD, XAUUSD');
  assert.equal(appendSymbolToList('EURUSD', '  '), 'EURUSD');
});

test('getUnconfiguredSymbolRows returns empty-spec rows marked not configured', () => {
  const rows = getUnconfiguredSymbolRows(entries);
  assert.deepEqual(rows.map((r) => r.symbol), ['BTCUSD', 'US30', 'XAUUSD']);
  assert.equal(rows[0].execution, NOT_CONFIGURED_LABEL);
  assert.equal(rows[0].digits, '');
  assert.equal(rows[0].id, 'lp:BTCUSD');
  assert.deepEqual(getUnconfiguredSymbolRows(entries, 'metal').map((r) => r.symbol), ['XAUUSD']);
  assert.deepEqual(getUnconfiguredSymbolRows(entries, 'not conf').length, 3);
});

test('mergeUnconfiguredSymbolPage appends LP symbols after the configured pages', () => {
  const extra = getUnconfiguredSymbolRows(entries); // BTCUSD, US30, XAUUSD
  // 3 configured instruments, page size 2 -> pages: [C1,C2] [C3,BTCUSD] [US30,XAUUSD]
  const p1 = mergeUnconfiguredSymbolPage({ paged: pagedOf([{ symbol: 'C1' }, { symbol: 'C2' }], { total: 3 }), unconfiguredRows: extra, page: 1, pageSize: 2 });
  assert.deepEqual(p1.rows.map((r) => r.symbol), ['C1', 'C2']);
  assert.equal(p1.total, 6);
  assert.equal(p1.totalPages, 3);
  assert.equal(p1.hasNextPage, true);

  const p2 = mergeUnconfiguredSymbolPage({ paged: pagedOf([{ symbol: 'C3' }], { total: 3, page: 2 }), unconfiguredRows: extra, page: 2, pageSize: 2 });
  assert.deepEqual(p2.rows.map((r) => r.symbol), ['C3', 'BTCUSD']);
  assert.equal(p2.pageStart, 3);
  assert.equal(p2.pageEnd, 4);

  const p3 = mergeUnconfiguredSymbolPage({ paged: pagedOf([], { total: 3, page: 3 }), unconfiguredRows: extra, page: 3, pageSize: 2 });
  assert.deepEqual(p3.rows.map((r) => r.symbol), ['US30', 'XAUUSD']);
  assert.equal(p3.hasNextPage, false);
});

test('mergeUnconfiguredSymbolPage handles no configured instruments and duplicates', () => {
  const extra = getUnconfiguredSymbolRows(entries);
  const only = mergeUnconfiguredSymbolPage({ paged: pagedOf([], { total: 0 }), unconfiguredRows: extra, page: 1, pageSize: 10 });
  assert.deepEqual(only.rows.map((r) => r.symbol), ['BTCUSD', 'US30', 'XAUUSD']);
  assert.equal(only.total, 3);

  // A configured row the LP list still reports as unconfigured is not listed twice.
  const dup = mergeUnconfiguredSymbolPage({ paged: pagedOf([{ symbol: 'btcusd' }], { total: 1 }), unconfiguredRows: extra, page: 1, pageSize: 10 });
  assert.deepEqual(dup.rows.map((r) => r.symbol), ['btcusd', 'US30', 'XAUUSD']);
});

test('mergeUnconfiguredSymbolPage without a server total', () => {
  const extra = getUnconfiguredSymbolRows(entries);
  // A full page with unknown total: configured end not reached yet, unchanged.
  const full = pagedOf([{ symbol: 'C1' }, { symbol: 'C2' }]);
  assert.deepEqual(mergeUnconfiguredSymbolPage({ paged: full, unconfiguredRows: extra, page: 1, pageSize: 2 }).rows.map((r) => r.symbol), ['C1', 'C2']);
  // A short page is the last configured page.
  const short = mergeUnconfiguredSymbolPage({ paged: pagedOf([{ symbol: 'C1' }]), unconfiguredRows: extra, page: 1, pageSize: 3 });
  assert.deepEqual(short.rows.map((r) => r.symbol), ['C1', 'BTCUSD', 'US30']);
  assert.equal(short.total, 4);
  // An empty later page uses the fallback configured count.
  const later = mergeUnconfiguredSymbolPage({ paged: pagedOf([]), unconfiguredRows: extra, page: 2, pageSize: 2, fallbackConfiguredTotal: 2 });
  assert.deepEqual(later.rows.map((r) => r.symbol), ['BTCUSD', 'US30']);
});
