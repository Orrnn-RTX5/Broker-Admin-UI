import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedInstruments } from './allowedInstruments.js';

test('all ten allowed symbols remain visible, with six configurations and four awaiting setup', () => {
  const scope = ['EURUSD','GBPUSD','USDJPY','USDCHF','AUDUSD','BTCUSD','ETHUSD','SOLUSD','XAUUSD','XAGUSD'];
  const configured = ['BTCUSD','EURUSD','GBPUSD','USDJPY','XAGUSD','XAUUSD','EURJPY','GBPJPY'].map(symbol => ({symbol, enabled: true, contractSize: 100}));
  const result = allowedInstruments(scope, configured);
  assert.equal(result.total, 10);
  assert.equal(result.data.filter(row => row.configuration).length, 6);
  assert.deepEqual(result.data.filter(row => !row.configuration).map(row => row.symbol), ['AUDUSD','ETHUSD','SOLUSD','USDCHF']);
  assert.ok(result.data.filter(row => !row.configuration).every(row => row.configurationStatus === 'Setup required' && row.tradingMode === 'Unavailable - setup required' && row.contractSize === undefined));
});

test('disabled configured instruments, categories, search and pagination retain correct status', () => {
  const scope = ['EURUSD','ETHUSD','BTCUSD'];
  const configs = [{symbol:'BTCUSD', enabled:false, category:'Digital Assets'}];
  const result = allowedInstruments(scope, configs, {limit:1, page:2});
  assert.equal(result.total, 3);
  assert.equal(result.data[0].symbol, 'ETHUSD');
  const disabled = allowedInstruments(scope, configs, {search:'Digital Assets'}).data[0];
  assert.equal(disabled.configurationStatus,'Configured');
  assert.equal(disabled.tradingMode,'Disabled');
  assert.equal(allowedInstruments(scope, configs, {search:'Setup required'}).total,2);
  assert.deepEqual(allowedInstruments([], configs).data, []);
});
