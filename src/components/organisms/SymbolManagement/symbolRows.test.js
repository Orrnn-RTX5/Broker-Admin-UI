import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mergeLpSymbols } from '../../../utils/lpSymbols.js';
import {
  STATUS_FILTERS,
  buildSymbolRows,
  categoryFilterOptions,
  cloneBaseSymbols,
  configuredSymbolNames,
  filterSymbolRows,
  groupSymbolOptions,
  lpSymbolOptions,
  streamingState,
  symbolCountSummary,
} from './symbolRows.js';

const configured = [
  { symbol: 'EURUSD', category: 'Forex', symbolType: 'base', parentSymbol: '', enabled: true, digits: 5 },
  { symbol: 'EURUSDpro', category: 'Forex', symbolType: 'derived', parentSymbol: 'EURUSD', enabled: false },
  { symbol: 'XAUUSD', category: 'Metals', symbolType: 'base', parentSymbol: '', enabled: false },
];
const entries = mergeLpSymbols(
  ['EURUSD', 'XAUUSD', 'US30', 'BTCUSD', 'GBPUSD'],
  configured,
);

test('buildSymbolRows keeps configured rows and appends unconfigured LP symbols', () => {
  const rows = buildSymbolRows(configured, entries);
  assert.deepEqual(rows.map((row) => [row.symbol, row.configured]), [
    ['EURUSD', true],
    ['EURUSDpro', true],
    ['XAUUSD', true],
    ['BTCUSD', false],
    ['GBPUSD', false],
    ['US30', false],
  ]);
  assert.equal(rows[0].digits, 5, 'configured rows are unchanged');
  const us30 = rows.find((row) => row.symbol === 'US30');
  assert.equal(us30.enabled, false);
  assert.equal(us30.symbolType, '');
  assert.ok(us30.category, 'unconfigured rows carry the inferred category');
});

test('buildSymbolRows never duplicates a configured symbol listed by the LP in another case', () => {
  const rows = buildSymbolRows([{ symbol: 'eurusd', enabled: true }], [{ symbol: 'EURUSD', configured: false, category: 'Forex' }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].configured, true);
});

test('filterSymbolRows covers search, category, type and every status filter', () => {
  const rows = buildSymbolRows(configured, entries);
  const names = (filters) => filterSymbolRows(rows, filters).map((row) => row.symbol);
  assert.deepEqual(STATUS_FILTERS.map((option) => option.value), ['', 'enabled', 'disabled', 'configured', 'not_configured']);
  assert.deepEqual(names({ search: 'us3' }), ['US30']);
  assert.deepEqual(names({ status: 'enabled' }), ['EURUSD']);
  assert.deepEqual(names({ status: 'disabled' }), ['EURUSDpro', 'XAUUSD']);
  assert.deepEqual(names({ status: 'configured' }), ['EURUSD', 'EURUSDpro', 'XAUUSD']);
  assert.deepEqual(names({ status: 'not_configured' }), ['BTCUSD', 'GBPUSD', 'US30']);
  assert.deepEqual(names({ type: 'derived' }), ['EURUSDpro']);
  assert.deepEqual(names({ type: 'base' }), ['EURUSD', 'XAUUSD'], 'unconfigured symbols have no type');
  const gbpCategory = rows.find((row) => row.symbol === 'GBPUSD').category;
  assert.ok(names({ category: gbpCategory }).includes('GBPUSD'));
  assert.equal(names({}).length, rows.length);
});

test('categoryFilterOptions includes inferred categories of unconfigured rows', () => {
  const rows = [
    { symbol: 'EURUSD', category: 'Forex', configured: true },
    { symbol: 'US30', category: 'Indices', configured: false },
    { symbol: 'X', category: '', configured: false },
  ];
  assert.deepEqual(categoryFilterOptions([{ name: 'Forex' }, { name: 'Metals' }], rows), ['Forex', 'Metals', 'Indices']);
});

test('symbolCountSummary reports configured and not configured counts', () => {
  assert.equal(symbolCountSummary(buildSymbolRows(configured, entries)), '3 configured · 3 not configured');
  assert.equal(symbolCountSummary([]), '0 configured · 0 not configured');
});

test('dynamic feed rows stay pending until instrument specifications arrive', () => {
  const rows = buildSymbolRows([], [{ symbol: 'EURUSD', configured: false, category: 'Forex', detailsPending: true }]);
  assert.equal(rows[0].detailsPending, true);
  assert.equal(symbolCountSummary(rows), '1 live symbols');
  assert.deepEqual(filterSymbolRows(rows, { status: 'not_configured' }), []);
});

test('streamingState is unknown until the feed inventory is known', () => {
  assert.equal(streamingState('EURUSD', null), 'unknown');
  assert.equal(streamingState('eurusd', ['EURUSD']), 'live');
  assert.equal(streamingState('US30', new Set(['EURUSD'])), 'no_data');
  assert.equal(streamingState('US30', []), 'no_data');
});

test('clone base symbols are configured, non-derived instruments only', () => {
  assert.deepEqual(cloneBaseSymbols(entries), ['EURUSD', 'XAUUSD']);
  assert.deepEqual(configuredSymbolNames(entries), ['EURUSD', 'EURUSDPRO', 'XAUUSD']);
});

test('lpSymbolOptions offers every LP symbol with a configured flag', () => {
  const options = lpSymbolOptions(entries);
  assert.equal(options.length, entries.length);
  const eurusd = options.find((option) => option.symbol === 'EURUSD');
  assert.equal(eurusd.configured, true);
  assert.equal(eurusd.enabled, true);
  assert.equal(eurusd.digits, 5);
  const us30 = options.find((option) => option.symbol === 'US30');
  assert.equal(us30.configured, false);
  assert.equal(us30.enabled, false);
});

test('groupSymbolOptions splits configured and not configured, legacy options count as configured', () => {
  assert.deepEqual(groupSymbolOptions(lpSymbolOptions(entries)), {
    configured: ['EURUSD', 'EURUSDPRO', 'XAUUSD'],
    unconfigured: ['BTCUSD', 'GBPUSD', 'US30'],
  });
  assert.deepEqual(groupSymbolOptions(['A', { symbol: 'B' }, { symbol: 'C', configured: false }, null]), {
    configured: ['A', 'B'],
    unconfigured: ['C'],
  });
});

test('cloneSourceOptions lists every LP symbol, splitting ready from configure-first', async () => {
  const { cloneSourceOptions } = await import('./symbolRows.js');
  const entries = [
    { symbol: 'EURUSD', configured: true, instrument: { symbolType: 'base' } },
    { symbol: 'EURUSDPRO', configured: true, instrument: { symbolType: 'derived', parentSymbol: 'EURUSD' } },
    { symbol: 'AUDCAD', configured: false, instrument: null },
  ];
  assert.deepEqual(cloneSourceOptions(entries), { ready: ['EURUSD'], needsConfig: ['AUDCAD'] });
});

test('cloneDefaultsFromSource starts the clone at the source specs and category', async () => {
  const { cloneDefaultsFromSource } = await import('./symbolRows.js');
  assert.deepEqual(
    cloneDefaultsFromSource(
      { symbol: 'BTCUSD', category: 'crypto', contractSize: 1, min_volume: 0.01, max_volume: 50, volume_step: 0.01 },
      ['Crypto', 'Forex'],
    ),
    { contractSize: 1, minVolume: 0.01, maxVolume: 50, volumeStep: 0.01, category: 'Crypto' },
  );
  // Unknown category → none; missing specs are left to the form defaults.
  assert.deepEqual(cloneDefaultsFromSource({ category: 'Exotics' }, ['Forex']), { category: '' });
  assert.deepEqual(cloneDefaultsFromSource(null, ['Forex']), {});
});
