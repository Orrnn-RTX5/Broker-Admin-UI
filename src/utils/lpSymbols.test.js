import { test } from 'node:test';
import assert from 'node:assert/strict';

import { groupDisabledSymbols, groupSelectableSymbols, invalidateLpSymbols, loadLpSymbols, mergeLpSymbols } from './lpSymbols.js';

test('mergeLpSymbols unions the LP catalogue with configured instruments', () => {
  const merged = mergeLpSymbols(
    [{ symbol: 'eurusd' }, { symbol: 'US30' }, 'XAUUSD', { symbol: 'EURUSD' }],
    [{ symbol: 'EURUSD', category: 'Forex', digits: 5 }, { symbol: 'CUSTOM1', category: 'Custom' }],
  );
  assert.deepEqual(merged.map((e) => [e.symbol, e.configured, e.fromLp]), [
    ['CUSTOM1', true, false],
    ['EURUSD', true, true],
    ['US30', false, true],
    ['XAUUSD', false, true],
  ]);
  const eurusd = merged.find((e) => e.symbol === 'EURUSD');
  assert.equal(eurusd.category, 'Forex');
  assert.equal(eurusd.instrument.digits, 5);
  assert.equal(merged.find((e) => e.symbol === 'US30').instrument, null);
});

test('loadLpSymbols keeps working when one source fails and caches results', async () => {
  invalidateLpSymbols();
  let calls = 0;
  const services = {
    getInstrumentCatalogue: async () => { calls += 1; throw new Error('catalogue down'); },
    getConfiguredInstruments: async () => ({ instruments: [{ symbol: 'EURUSD' }] }),
  };
  const first = await loadLpSymbols(services, { now: 1000 });
  assert.deepEqual(first.map((e) => e.symbol), ['EURUSD']);
  await loadLpSymbols(services, { now: 2000 });
  assert.equal(calls, 1, 'second call within the TTL is served from cache');
  await loadLpSymbols(services, { now: 2000, force: true });
  assert.equal(calls, 2);
});

test('mergeLpSymbols preserves fetched category metadata and configured overrides', () => {
  const rows = mergeLpSymbols([
    { symbol: 'EURUSD', category: 'Broker/Forex' },
    { symbol: 'GBPUSD', category: '', Category: 'Forex/Majors' },
    { symbol: 'BTCUSD', path: 'Digital Assets/Coins' },
    { symbol: 'ETHUSD', Path: 'Crypto/Spot' },
    { symbol: 'CUSTOM', category: 'Catalogue only' },
    'USDJPY',
  ], [{ symbol: 'EURUSD', category: 'Configured/Forex' }, { symbol: 'CUSTOM', category: ' ' }]);
  const categories = Object.fromEntries(rows.map(row => [row.symbol, row.category]));
  assert.deepEqual(categories, {
    BTCUSD: 'Digital Assets/Coins', CUSTOM: 'Catalogue only', ETHUSD: 'Crypto/Spot',
    EURUSD: 'Configured/Forex', GBPUSD: 'Forex/Majors', USDJPY: 'Forex',
  });
});

test('loadLpSymbols rejects only when both sources fail', async () => {
  invalidateLpSymbols();
  const services = {
    getInstrumentCatalogue: async () => { throw new Error('catalogue down'); },
    getConfiguredInstruments: async () => { throw new Error('instruments down'); },
  };
  await assert.rejects(loadLpSymbols(services, { now: 5000 }), /catalogue down/);
  invalidateLpSymbols();
});

test('group picker offers only configured enabled instruments', () => {
  const rows = mergeLpSymbols(
    [{ symbol: 'EURUSD' }, { symbol: 'EURUSD.PRO' }, { symbol: 'GBPUSD' }, { symbol: 'XAUUSD' }],
    [
      { symbol: 'EURUSD', enabled: true },
      { symbol: 'EURUSD.PRO', enabled: false },
      { symbol: 'XAUUSD', enabled: true },
      { symbol: 'CUSTOM1', enabled: true },
    ],
  );
  // Unconfigured LP catalogue entries are still merged, but must not be pickable.
  assert.deepEqual(rows.map(entry => entry.symbol), ['CUSTOM1', 'EURUSD', 'EURUSD.PRO', 'GBPUSD', 'XAUUSD']);
  assert.deepEqual(groupSelectableSymbols(rows).map(entry => entry.symbol), ['CUSTOM1', 'EURUSD', 'XAUUSD']);
  assert.deepEqual(groupDisabledSymbols(rows), ['EURUSD.PRO']);
});

test('mergeLpSymbols carries the catalogue in_scope flag (G2); old catalogues count as in scope', () => {
  const merged = mergeLpSymbols(
    [
      { symbol: 'AAA1', source: 'receiver_catalog', in_scope: false, has_instrument: false, enabled: false },
      { symbol: 'BBB2', in_scope: true, has_instrument: true, enabled: true },
      'CCC3',
      { symbol: 'DDD4' },
    ],
    [{ symbol: 'BBB2', enabled: true }, { symbol: 'EEE5', enabled: true }],
  );
  assert.deepEqual(merged.map((e) => [e.symbol, e.inScope]), [
    ['AAA1', false],
    ['BBB2', true],
    ['CCC3', true],
    ['DDD4', true],
    ['EEE5', true],
  ]);
});
