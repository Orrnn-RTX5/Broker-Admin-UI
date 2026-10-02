import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkspaceMetrics, workspacePosition } from './workspaceMetrics.js';

test('broker totals preserve currency and classify demo groups', () => {
  const metrics = buildWorkspaceMetrics([
    { login: 1, Group: 'Broker/real', Currency: 'USD', balance: 10, equity: 12, margin: 2 },
    { login: 2, Group: 'Broker/demo', Currency: 'USD', balance: 20, equity: 25, margin: 3 },
  ], []);
  assert.equal(metrics.equity, 37);
  assert.equal(metrics.balance, 30);
  assert.equal(metrics.margin, 5);
  assert.equal(metrics.real, 1);
  assert.equal(metrics.demo, 1);
});
test('mixed currencies and missing values never produce misleading money totals', () => {
  for (const accounts of [
    [{ Currency: 'USD', equity: 20 }, { Currency: 'EUR', equity: 20 }],
    [{ Currency: 'USD', equity: 20 }, { equity: 20 }],
    [{ Currency: 'USD', equity: 20 }, { Currency: 'USD' }],
    [],
  ]) assert.equal(buildWorkspaceMetrics(accounts, []).equity, null);
});
test('live position schema preserves zeroes and prefers broker lots', () => {
  const row = workspacePosition({ positionTicket: 321, login: 123, action: 0, symbol: 'EURUSD', lots: 0.01, volumeExt: 999999, priceSl: 0, priceTp: 1.25, profit: -1 });
  assert.equal(row.ticket, 321);
  assert.equal(row.side, 'BUY');
  assert.equal(row.lots, 0.01);
  assert.equal(row.sl, 0);
  assert.equal(row.tp, 1.25);
  assert.equal(row.profit, -1);
  assert.equal(workspacePosition({ volumeExt: 100 }).lots, 0.01);
});
test('position exposure counts and directional volumes use actual sides', () => {
  const { symbols } = buildWorkspaceMetrics([], [
    { symbol: 'EURUSD', action: 0, lots: 0.1 },
    { symbol: 'EURUSD', action: 1, lots: 0.25 },
    { symbol: 'XAUUSD', action: 'BUY', lots: 0.2 },
  ]);
  assert.deepEqual(symbols[0], { symbol: 'EURUSD', positions: 2, buy: 0.1, sell: 0.25 });
});
