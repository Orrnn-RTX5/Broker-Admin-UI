import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./usePositions.js', import.meta.url), 'utf8');

test('useOrders delegates the current filtered page to the shared live feed', () => {
  assert.doesNotMatch(src, /const ORDER_MAX_PAGES = 50/);
  assert.doesNotMatch(src, /const getOrderPageKey = \(order, index\) => \(/);
  assert.match(src, /export function useOrders\(params = \{\s*limit:\s*100,\s*offset:\s*0,\s*logins:\s*\[\]\s*\}/);
  assert.doesNotMatch(src, /if \(allPages\) \{/);
  assert.doesNotMatch(src, /seenPageSignatures/);
  assert.match(src, /normalizeOrderQuery\(params\)/);
  assert.match(src, /useSyncExternalStore\(subscribeOrders/);
  assert.match(src, /primeOrders\(query, \{ matches, force: true \}\)/);
});

test('Positions and Deals subscribe to startup data and refresh only visible tabs', () => {
  assert.match(src, /useSyncExternalStore\(source.subscribe/);
  assert.match(src, /document\.visibilityState !== 'hidden'/);
  assert.match(src, /useTradeList\('Positions'/);
  assert.match(src, /useTradeList\('Deals'/);
  assert.match(src, /window.addEventListener\('admin:state-changed', mutate\)/);
});
