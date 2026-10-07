import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MARKET_WATCH_VIEW_CACHE_KEY,
  extractMarketTicks,
  extractStreamedSymbols,
  formatMarketPrice,
  formatMarketSpread,
  getMarketPriceDirection,
  getSymbolFriendlyDescription,
  isMarketQuoteFresh,
  mapFeedStatusRows,
  marketTickReceivedTime,
  readMarketWatchViewCache,
  resolveSymbolQuote,
  seedMarketTickHistory,
  writeMarketWatchViewCache,
} from './marketWatch.js';

test('quote freshness uses the server quote time rather than snapshot arrival', () => {
  const now = 1700000100000;
  assert.equal(marketTickReceivedTime({ quote_time_ms: 1700000000000 }, now), 1700000000000);
  assert.equal(marketTickReceivedTime({ time_ms: now - 500 }, now), now - 500);
  assert.equal(marketTickReceivedTime({ quote_time_unix: 1700000000 }, now), 1700000000000);
  assert.equal(marketTickReceivedTime({ age_ms: 10000 }, now), now - 10000);
  assert.equal(marketTickReceivedTime({}, now), now);
  assert.equal(marketTickReceivedTime({ quote_time_ms: null, age_ms: null }, now), now);
  assert.equal(isMarketQuoteFresh({ live: true, lastUpdate: marketTickReceivedTime({ quote_time_ms: now - 60000 }, now) }, true, now), false);
});

test('startup prices remain empty until a real quote arrives', () => {
  for (const name of ['AUDUSD', 'ADAUSD', 'BTCUSD', 'UNKNOWN']) {
    const quote = resolveSymbolQuote(name);
    assert.equal(quote.bid, null);
    assert.equal(quote.ask, null);
    assert.equal(formatMarketPrice(quote.bid), '—');
    assert.equal(formatMarketPrice(quote.ask), '—');
  }
});

test('partial quotes never acquire an invented opposite price', () => {
  const row = { bid: '0.27070', ask: 0, live: true, lastUpdate: 1000 };
  assert.deepEqual(resolveSymbolQuote('ADAUSD', row), { ...row, symbol: 'ADAUSD', ask: null });
  assert.equal(resolveSymbolQuote('EURUSD', { bid: NaN, ask: 1.1 }).bid, null);
  assert.equal(resolveSymbolQuote('EURUSD', { bid: 1.09, ask: 1.1 }).ask, 1.1);
});

test('price direction follows each field independently and remains neutral without a prior live price', () => {
  assert.equal(getMarketPriceDirection(1.101, null), null);
  assert.equal(getMarketPriceDirection(1.101, 1.100), 'up');
  assert.equal(getMarketPriceDirection(1.201, 1.202), 'down');
  assert.equal(getMarketPriceDirection(1.101, 1.101, 'up'), 'up');
  assert.equal(getMarketPriceDirection(1.201, 1.201, 'down'), 'down');
  assert.equal(getMarketPriceDirection(1.101, 1.101), null);
  assert.equal(getMarketPriceDirection('invalid', 1.1, 'up'), null);

  const bidDir = getMarketPriceDirection(1.101, 1.100);
  const askDir = getMarketPriceDirection(1.200, 1.201);
  assert.equal(bidDir, 'up');
  assert.equal(askDir, 'down');

  // The last move still matters when a later quote returns to the frame's start price.
  const firstMove = getMarketPriceDirection(1.101, 1.100);
  assert.equal(getMarketPriceDirection(1.100, 1.101, firstMove), 'down');
});

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

test('spread displays the five-decimal price difference across forex, yen and crypto quotes', () => {
  assert.equal(formatMarketSpread('0.98884', '0.98906'), '0.00022');
  assert.equal(formatMarketSpread(109.948, 109.957), '0.00900');
  assert.equal(formatMarketSpread('83789.72000', '83839.73000'), '50.01000');
  assert.equal(formatMarketSpread(1.12, 1.12), '0.00000');
  assert.equal(formatMarketSpread(1.12022, 1.12), '0.00022');
});

test('spread requires both available quote prices and never substitutes a missing side with zero', () => {
  for (const value of [null, undefined, '', 'NaN', Infinity, 0, -1]) {
    assert.equal(formatMarketSpread(value, 1.12), '—');
    assert.equal(formatMarketSpread(1.12, value), '—');
  }
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

test('Market Watch lists exactly the symbols the feed is streaming', () => {
  const status = {
    available_symbols: ['GBPUSD', 'XAUUSD', 'BTCUSD', 'EURUSD'],
    symbols: [
      { symbol: 'BTCUSD', has_data: true, fresh: true },
      { symbol: 'EURUSD', has_data: false, silent: true },
      { symbol: 'gbpusd', has_data: true, fresh: true },
      { symbol: 'XAUUSD', has_data: true, stale: true },
    ],
  };
  // EURUSD is configured but SuperAdmin does not stream it, so it is not listed.
  assert.deepEqual([...extractStreamedSymbols(status)].sort(), ['BTCUSD', 'GBPUSD', 'XAUUSD']);
});

test('Market Watch falls back to the configured stream list before the first tick', () => {
  const status = {
    available_symbols: ['XAUUSD', 'BTCUSD'],
    symbols: [{ symbol: 'XAUUSD', has_data: false }, { symbol: 'BTCUSD', has_data: false }],
  };
  assert.deepEqual([...extractStreamedSymbols(status)].sort(), ['BTCUSD', 'XAUUSD']);
  assert.equal(extractStreamedSymbols({}).size, 0);
  assert.equal(extractStreamedSymbols(null).size, 0);
});

// Shape returned by the real bridge GET /ws/feed/status (no `symbols` key).
const bridgeStatusPayload = () => ({
  connected: true,
  tenant: 'broker-a',
  available_symbols: ['BTCUSD', 'EURUSD', 'GBPUSD', 'XAUUSD'],
  symbol_status: [
    { symbol: 'BTCUSD', has_data: true, fresh: true, stale: false, tradable: true, last_tick_ms: 1727000000000, bid: 63000.5, ask: 63010.5 },
    { symbol: 'EURUSD', has_data: false, fresh: false, stale: false, tradable: true, last_tick_ms: null },
    { symbol: 'gbpusd', has_data: true, fresh: false, stale: true, tradable: true, last_tick_ms: 1726999000000 },
    { symbol: 'XAUUSD', has_data: true, fresh: true, stale: false, tradable: false, last_tick_ms: 1727000000500 },
  ],
});

test('Market Watch reads the bridge symbol_status rows', () => {
  const payload = bridgeStatusPayload();
  assert.deepEqual([...extractStreamedSymbols(payload)].sort(), ['BTCUSD', 'GBPUSD', 'XAUUSD']);

  const rows = mapFeedStatusRows(payload);
  assert.deepEqual([...rows.keys()].sort(), ['BTCUSD', 'EURUSD', 'GBPUSD', 'XAUUSD']);
  assert.equal(rows.get('BTCUSD').bid, 63000.5);
  assert.equal(rows.get('GBPUSD').stale, true);
});

test('Market Watch falls back to available_symbols when no bridge symbol has data yet', () => {
  const payload = bridgeStatusPayload();
  payload.symbol_status = payload.symbol_status.map((row) => ({ ...row, has_data: false }));
  assert.deepEqual([...extractStreamedSymbols(payload)].sort(), ['BTCUSD', 'EURUSD', 'GBPUSD', 'XAUUSD']);
});

test('Market Watch prefers symbol_status over the legacy symbols rows', () => {
  const payload = {
    symbol_status: [{ symbol: 'XAUUSD', has_data: true }],
    symbols: [{ symbol: 'EURUSD', has_data: true }],
  };
  assert.deepEqual([...extractStreamedSymbols(payload)], ['XAUUSD']);
  assert.deepEqual([...mapFeedStatusRows(payload).keys()], ['XAUUSD']);
  assert.deepEqual([...mapFeedStatusRows({ symbols: [{ symbol: 'eurusd', bid: 1.1 }] }).keys()], ['EURUSD']);
  assert.equal(mapFeedStatusRows(null).size, 0);
});
