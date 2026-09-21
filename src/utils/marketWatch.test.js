import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MARKET_WATCH_VIEW_CACHE_KEY,
  extractMarketTicks,
  formatMarketPrice,
  getSymbolFriendlyDescription,
  isMarketQuoteFresh,
  readMarketWatchViewCache,
  seedMarketTickHistory,
  writeMarketWatchViewCache,
} from './marketWatch.js';

test('accepts manager feed single ticks, envelopes, arrays, and JSON lines', () => {
  const tick = { symbol: 'EURUSD', bid: 1.12, ask: 1.13 };
  for (const payload of [tick, [tick], { ticks: [tick] }, { data: [tick] }, { quotes: [tick] }, { symbols: [tick] }]) {
    assert.deepEqual(extractMarketTicks(JSON.stringify(payload)), [tick]);
  }
  assert.deepEqual(extractMarketTicks(`${JSON.stringify(tick)}\nheartbeat\n${JSON.stringify({ type: 'status' })}`), [tick]);
  assert.deepEqual(extractMarketTicks('{"symbol":"","bid":1}'), []);
});

test('unavailable prices never render as a real zero or NaN quote', () => {
  for (const value of [null, undefined, '', 'NaN', Infinity, 0, -1]) assert.equal(formatMarketPrice(value), '—');
  assert.equal(formatMarketPrice('1.12345'), '1.12345');
});

test('cached, disconnected, and old quotes are never labelled fresh', () => {
  const quote = { live: true, lastUpdate: 1000 };
  assert.equal(isMarketQuoteFresh(quote, true, 2000), true);
  assert.equal(isMarketQuoteFresh(quote, false, 2000), false);
  assert.equal(isMarketQuoteFresh({ ...quote, live: false }, true, 2000), false);
  assert.equal(isMarketQuoteFresh(quote, true, 31000), false);
  assert.equal(isMarketQuoteFresh(undefined, true, 2000), false);
});

test('getSymbolFriendlyDescription maps symbols to friendly descriptive asset names', () => {
  assert.equal(getSymbolFriendlyDescription('AAL.GB'), 'Anglo American PLC (London Stock Exchange)');
  assert.equal(getSymbolFriendlyDescription('AAF.GB'), 'Airtel Africa PLC (London Stock Exchange)');
  assert.equal(getSymbolFriendlyDescription('EURUSD'), 'Euro vs US Dollar');
  assert.equal(getSymbolFriendlyDescription('XAUUSD'), 'Gold (Troy Ounce) vs US Dollar');
  assert.equal(getSymbolFriendlyDescription('BTCUSD'), 'Bitcoin vs US Dollar');
  assert.equal(getSymbolFriendlyDescription('1U1D.DE'), '1U1D · Deutsche Börse XETRA Equity');
  assert.equal(getSymbolFriendlyDescription('UNKNOWN_SYM'), 'UNKNOWN_SYM · Financial Contract');
  assert.equal(getSymbolFriendlyDescription(''), '');
});

test('ticks open immediately with the selected symbol cached quote', () => {
  const cachedQuote = {
    symbol: 'EURUSD',
    bid: '1.12345',
    ask: '1.12355',
    lastUpdate: 1700000000000,
    live: false,
  };

  assert.deepEqual(seedMarketTickHistory('EURUSD', cachedQuote, []), [cachedQuote]);
  assert.deepEqual(
    seedMarketTickHistory('EURUSD', cachedQuote, [cachedQuote]),
    [cachedQuote],
    'the same cached tick is not duplicated'
  );
});

test('market watch restores selected Ticks state without waiting for the network', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const history = [{
    symbol: 'XAUUSD',
    bid: '2400.10000',
    ask: '2400.30000',
    lastUpdate: 1700000000000,
  }];

  assert.equal(writeMarketWatchViewCache({ selected: 'xauusd', tab: 'Ticks', history }, storage), true);
  assert.ok(values.has(MARKET_WATCH_VIEW_CACHE_KEY));
  assert.deepEqual(readMarketWatchViewCache(storage), {
    selected: 'XAUUSD',
    tab: 'Ticks',
    history,
  });
});

test('market watch view cache is isolated by broker', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  writeMarketWatchViewCache({ selected: 'EURUSD', tab: 'Ticks', history: [] }, storage, 'broker-a');
  writeMarketWatchViewCache({ selected: 'XAUUSD', tab: 'Details', history: [] }, storage, 'broker-b');

  assert.equal(readMarketWatchViewCache(storage, 'broker-a').selected, 'EURUSD');
  assert.equal(readMarketWatchViewCache(storage, 'broker-b').selected, 'XAUUSD');
});
