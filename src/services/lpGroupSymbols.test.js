import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRoutingGroupSymbols } from './lpGroupSymbols.js';

const group = (name, symbols, overrides = {}) => ({
  group: name,
  unrestricted: false,
  blocked: [],
  symbols: symbols.map(symbol => ({ symbol, trade_allowed: true })),
  ...overrides,
});

test('loads the union of included groups, deduplicates, and removes blocked or trading-off symbols', async () => {
  const records = {
    Alpha: group('Alpha', ['EURUSD', 'XAUUSD', 'BTCUSD'], {
      blocked: ['BTCUSD'],
      symbols: [
        { symbol: 'EURUSD', trade_allowed: true },
        { symbol: 'XAUUSD', trade_allowed: false },
        { symbol: 'BTCUSD', trade_allowed: true },
      ],
    }),
    Beta: group('Beta', ['EURUSD', 'GBPUSD']),
  };
  const calls = [];
  const result = await loadRoutingGroupSymbols(
    { include: ['Alpha', 'Beta', 'Alpha'], exclude: [] },
    async name => { calls.push(name); return records[name]; },
  );
  assert.deepEqual(calls, ['Alpha', 'Beta']);
  assert.deepEqual(result.groups, ['Alpha', 'Beta']);
  assert.deepEqual(result.symbols, ['EURUSD', 'GBPUSD']);
  assert.equal(result.message, '');
});

test('excluded groups are never fetched or included', async () => {
  const calls = [];
  const result = await loadRoutingGroupSymbols(
    { include: ['Alpha', 'Beta'], exclude: ['Beta'] },
    async name => { calls.push(name); return group(name, ['EURUSD']); },
  );
  assert.deepEqual(calls, ['Alpha']);
  assert.deepEqual(result.groups, ['Alpha']);
  assert.deepEqual(result.symbols, ['EURUSD']);
});

test('no included group and unrestricted or empty groups do not auto-populate a broad scope', async () => {
  let fetched = false;
  const none = await loadRoutingGroupSymbols({ include: [], exclude: [] }, async () => { fetched = true; });
  assert.equal(fetched, false);
  assert.deepEqual(none.symbols, []);
  assert.match(none.message, /included group/);

  const unrestricted = await loadRoutingGroupSymbols(
    { include: ['Alpha', 'Beta'] },
    async name => name === 'Alpha' ? group(name, ['EURUSD']) : group(name, [], { unrestricted: true }),
  );
  assert.deepEqual(unrestricted.symbols, []);
  assert.match(unrestricted.message, /explicit symbol list/);

  const empty = await loadRoutingGroupSymbols({ include: ['Alpha'] }, async name => group(name, []));
  assert.deepEqual(empty.symbols, []);
  assert.match(empty.message, /No trading-enabled symbols/);
});

test('failed or malformed group responses reject the entire load without returning a partial list', async () => {
  const selector = { include: ['Good', 'Bad'] };
  await assert.rejects(
    loadRoutingGroupSymbols(selector, async name => {
      if (name === 'Bad') throw new Error('Group unavailable');
      return group(name, ['EURUSD']);
    }),
    /Group unavailable/,
  );
  for (const malformed of [
    null,
    { group: 'Other', unrestricted: false, symbols: [], blocked: [] },
    { group: 'Bad', unrestricted: false, symbols: null, blocked: [] },
    group('Bad', ['GBPUSD'], { symbols: [{ symbol: '', trade_allowed: true }] }),
    group('Bad', ['GBPUSD'], { symbols: [{ symbol: 'GBPUSD', trade_allowed: 'true' }] }),
  ]) {
    await assert.rejects(
      loadRoutingGroupSymbols(selector, async name => name === 'Good' ? group(name, ['EURUSD']) : malformed),
      /group symbol list/i,
    );
  }
});
