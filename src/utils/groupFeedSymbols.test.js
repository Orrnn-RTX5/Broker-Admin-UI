import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findGroupFeedSymbol, normalizeGroupFeedSymbols } from './groupFeedSymbols.js';

test('group picker uses only selected-feed catalogue rows and never invents assignments', () => {
  const eligible = normalizeGroupFeedSymbols({ symbols: [
    { symbol: ' xauusd ' }, { symbol: 'EURUSD' }, { symbol: 'XAUUSD' }, { symbol: '' },
  ] });
  assert.deepEqual(eligible.map((entry) => entry.symbol), ['EURUSD', 'XAUUSD']);
  assert.equal(findGroupFeedSymbol(eligible, 'xauusd')?.symbol, 'XAUUSD');
  assert.equal(findGroupFeedSymbol(eligible, 'GBPUSD'), null);
  assert.deepEqual(normalizeGroupFeedSymbols({ symbols: [] }), []);
});
