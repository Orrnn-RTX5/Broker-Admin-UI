import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

const apiSrc = readFileSync(new URL('./api.js', import.meta.url), 'utf8');

test('legacy account endpoints include metricsNullable=1 query parameter', () => {
  assert.match(apiSrc, /export const getClients = async \(\) => \{\r?\n\s*const data = await apiClient\.get\(\'\/AccountDetailsMany\?metricsNullable=1\'\);/);
  assert.match(apiSrc, /export const getTradingAccounts = async \(\) => \{\r?\n\s*const data = await apiClient\.get\(\'\/AccountDetailsMany\?metricsNullable=1\'\);/);
});

test('getTradingAccounts preserves null for margin, marginFree, and marginLevel', () => {
  assert.match(apiSrc, /margin:\s*p\.margin\s*\?\?\s*p\.Margin\s*\?\?\s*null,/);
  assert.match(apiSrc, /marginFree:\s*p\.marginFree\s*\?\?\s*p\.MarginFree\s*\?\?\s*null,/);
  assert.match(apiSrc, /marginLevel:\s*p\.marginLevel\s*\?\?\s*p\.MarginLevel\s*\?\?\s*null,/);
});

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.sessionStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };

register('../../test-support/resolveExtensionless.mjs', import.meta.url);
const { default: apiClient } = await import('./apiClient.js');
const { getTradingAccounts } = await import('./api.js');

const withStubbedGet = async (rows, run) => {
  const originalGet = apiClient.get;
  const urls = [];
  apiClient.get = async (url) => {
    urls.push(url);
    return rows;
  };
  try {
    await run(urls);
  } finally {
    apiClient.get = originalGet;
  }
};

test('getTradingAccounts sends metricsNullable=1 and keeps cold metrics null', async () => {
  await withStubbedGet([{
    login: 101,
    name: 'Cold',
    balance: 100,
    equity: null,
    profit: null,
    margin: null,
    marginFree: null,
    marginLevel: null,
    metricsAvailable: false,
    metricsUnavailableReason: 'METRICS_CACHE_MISS',
  }], async (urls) => {
    const [account] = await getTradingAccounts();
    assert.deepEqual(urls, ['/AccountDetailsMany?metricsNullable=1']);
    assert.equal(account.margin, null);
    assert.equal(account.marginFree, null);
    assert.equal(account.marginLevel, null);
    assert.equal(account.equity, null);
    assert.equal(account.profit, null);
    assert.equal(account.balance, 100);
  });
});

test('getTradingAccounts keeps a real zero margin as 0', async () => {
  await withStubbedGet([{ login: 102, balance: 50, margin: 0, marginFree: 50, marginLevel: 0 }], async () => {
    const [account] = await getTradingAccounts();
    assert.equal(account.margin, 0);
    assert.equal(account.marginFree, 50);
    assert.equal(account.marginLevel, 0);
  });
});
