import { test } from 'node:test';
import assert from 'node:assert/strict';

import { invalidateLpSymbols, loadLpSymbols, mergeLpSymbols } from './lpSymbols.js';

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

test('loadLpSymbols rejects only when both sources fail', async () => {
  invalidateLpSymbols();
  const services = {
    getInstrumentCatalogue: async () => { throw new Error('catalogue down'); },
    getConfiguredInstruments: async () => { throw new Error('instruments down'); },
  };
  await assert.rejects(loadLpSymbols(services, { now: 5000 }), /catalogue down/);
  invalidateLpSymbols();
});
