import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedInstruments } from './allowedInstruments.js';
import { symbolManagementStatus } from './symbolManagementStatus.js';

test('Enabled excludes catalogue symbols awaiting setup despite the enabled default', () => {
  const catalogue = ['AUDUSD', 'BTCUSD', 'ETHUSD', 'EURUSD', 'GBPUSD', 'SOLUSD', 'USDCHF', 'USDJPY', 'XAGUSD', 'XAUUSD'];
  const enabled = ['BTCUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'XAGUSD', 'XAUUSD'];
  const rows = allowedInstruments(catalogue, enabled.map(symbol => ({ symbol, enabled: true }))).data
    .map(row => ({ ...row, enabled: row.enabled ?? true }));
  assert.deepEqual(rows.filter(row => symbolManagementStatus(row) === 'Enabled').map(row => row.symbol), enabled);
  assert.deepEqual(rows.filter(row => symbolManagementStatus(row) === 'Setup required').map(row => row.symbol), ['AUDUSD', 'ETHUSD', 'SOLUSD', 'USDCHF']);
  assert.equal(rows.filter(row => symbolManagementStatus(row) === 'Disabled').length, 0);
});

test('configured disabled symbols and setup-required symbols retain distinct statuses', () => {
  const row = { enabled: false, configurationStatus: 'Configured' };
  assert.equal(symbolManagementStatus(row), 'Disabled');
  assert.equal(symbolManagementStatus({ ...row, enabled: true }), 'Enabled');
  assert.equal(symbolManagementStatus({ ...row, configurationStatus: 'Setup required' }), 'Setup required');
});
