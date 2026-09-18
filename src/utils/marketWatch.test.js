import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractMarketTicks, formatMarketPrice, isMarketQuoteFresh } from './marketWatch.js';

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
