import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMarketCatalogue, marketGroupCounts, inferMarketCategory } from './marketCatalogue.js';

test('exchange stocks, extended currencies, crypto, indices and bonds classify without ticks', () => {
  for (const [symbol, category] of Object.entries({
    'SPX.GB': 'Stocks', 'SAN.FR': 'Stocks', 'AAPL.US-24': 'Stocks', 'NVDA.US-PERP': 'Stocks',
    'BT.A.GB': 'Stocks', USDINR: 'Forex', USDAED: 'Forex', USDKRW: 'Forex',
    HYPEUSD: 'Crypto', BTCAUD: 'Crypto', 'BTC-PERP': 'Crypto', PAXGUSD: 'Crypto',
    'EUSTX50-F': 'Indices', US2000: 'Indices', 'CRUDE-F': 'Commodities',
    COPPER: 'Commodities', 'US_TBOND-F': 'Bonds', 'EUBUND-F': 'Bonds',
    UNKNOWNUSD: 'Others', 'UNKNOWN.xyz': 'Others',
  })) assert.equal(inferMarketCategory(symbol), category, symbol);
});

test('assigned symbols populate categories without price ticks', () => {
  const rows = buildMarketCatalogue(['BTCUSD', 'ETHUSD', 'EURUSD', 'GBPUSD', 'SOLUSD', 'USDJPY', 'XAUUSD'], []);
  assert.equal(rows.length, 7);
  assert.deepEqual(marketGroupCounts(rows), { Metals: 1, Forex: 3, Indices: 0, Crypto: 3, Commodities: 0, Others: 0 });
});

test('explicit categories override inference and custom categories remain visible', () => {
  const rows = buildMarketCatalogue({symbols: [{symbol: 'BTCUSD', category: 'Digital Assets'}, {symbol: 'EURUSD'}, {symbol: 'XAUUSD'}]}, {instruments: [{symbol: 'EURUSD', category: 'Majors'}, {symbol: 'XAUUSD', category: 'metals'}, {symbol: 'HIDDEN', category: 'Stocks'}]});
  assert.deepEqual(marketGroupCounts(rows), {Metals: 1, Forex: 0, Indices: 0, Crypto: 0, Commodities: 0, Others: 0, 'Digital Assets': 1, Majors: 1});
  assert.equal(rows.length, 3);
});

test('deduplicates names, retains unknowns, and does not guess forex from six letters', () => {
  const rows = buildMarketCatalogue([' btcusd ', 'BTCUSD', 'ABCDEF', 'USOIL', 'EURUSD.pro', '', null], []);
  assert.equal(rows.length, 4);
  assert.equal(rows.find(row => row.symbol === 'ABCDEF').category, 'Others');
  assert.equal(rows.find(row => row.symbol === 'USOIL').category, 'Commodities');
  assert.equal(rows.find(row => row.symbol === 'EURUSD.PRO').category, 'Forex');
});

test('empty scoped catalogue cannot expose configured or cached symbols', () => {
  assert.deepEqual(buildMarketCatalogue([], [{symbol: 'BTCUSD'}]), []);
});

test('arbitrary category names count safely', () => {
  const counts = marketGroupCounts([{category: '__proto__'}, {category: 'constructor'}]);
  assert.equal(counts.__proto__, 1);
  assert.equal(counts.constructor, 1);
});
