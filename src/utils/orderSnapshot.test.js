import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createOrderSnapshot } from './orderSnapshot.js';
const setup = () => {
  const entries = new Map(); let time = 1000;
  const snapshot = createOrderSnapshot({ now: () => time, storage: () => ({
    getItem: key => entries.get(key), setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key),
  }) });
  return { snapshot, entries, advance: value => { time += value; } };
};
const rows = Array.from({ length: 100 }, (_, index) => ({ ticket_text: String(9007199254740993n + BigInt(index)), login: 200001,
  symbol: 'BTCUSD', side: 'Buy', volume: 0.01, priceOpen: 85193.42, priceSl: 0, priceTp: 0, status: 'open', timeSetup: 1791267960, comment: '-' }));

test('a hard reload restores all 100 display rows and exact tickets in under 20ms', () => {
  const { snapshot } = setup(); snapshot.write('A', { orders: rows, total: 312 });
  const start = performance.now(); const result = snapshot.read('A'); const elapsed = performance.now() - start;
  assert(elapsed < 20, `Display restore took ${elapsed}ms`);
  assert.equal(result.orders.length, 100);
  assert.equal(result.orders[0].ticket_text, '9007199254740993');
  assert.equal(result.total, 312);
  console.log(`Order snapshot restore: ${elapsed.toFixed(3)} ms`);
});

test('empty success restores zero orders; unknown totals stay unknown', () => {
  const { snapshot } = setup(); snapshot.write('A', { orders: [], total: 0 });
  assert.deepEqual(snapshot.read('A'), { orders: [], total: 0 });
  snapshot.write('A', rows); assert.equal(snapshot.read('A').total, undefined);
});

test('scopes, expiration and future timestamps cannot resurrect unrelated or stale rows', () => {
  const { snapshot, advance } = setup(); snapshot.write('A', rows);
  assert.equal(snapshot.read('B'), null); assert.equal(snapshot.read(null), null);
  advance(-1); assert.equal(snapshot.read('A'), null);
  advance(300001); assert.equal(snapshot.read('A'), null);
});

test('clear removes only the revoked session scope and retains other users', () => {
  const { snapshot } = setup(); snapshot.write('A', rows); snapshot.write('B', rows);
  snapshot.clear('A'); assert.equal(snapshot.read('A'), null); assert.equal(snapshot.read('B').orders.length, 100);
});

test('display persistence strips unexpected fields and never writes malformed or oversized rows', () => {
  const { snapshot } = setup(); snapshot.write('A', [{ ...rows[0], access_token: 'not-for-storage', extra: { nested: true } }]);
  assert.equal(snapshot.read('A').orders[0].access_token, undefined);
  assert.equal(snapshot.read('A').orders[0].extra, undefined);
  snapshot.clear('A');
  for (const response of [[null], [{ ticket: 9007199254740992 }], [...rows, rows[0]]]) {
    snapshot.write('A', response); assert.equal(snapshot.read('A'), null);
  }
});

test('corrupt storage and duplicate tickets are rejected, including invalid pagination totals', () => {
  const { snapshot, entries } = setup(); snapshot.write('A', rows);
  const key = entries.keys().next().value;
  const original = entries.get(key);
  for (const modify of [saved => { saved.version = 2; }, saved => { saved.identity = 'B'; },
    saved => { saved.rows[1] = saved.rows[0]; }, saved => { saved.total = 0; }, saved => { saved.rows[0].extra = {}; }]) {
    const saved = JSON.parse(original); modify(saved); entries.set(key, JSON.stringify(saved));
    assert.equal(snapshot.read('A'), null);
  }
  entries.set(key, '{'); assert.equal(snapshot.read('A'), null);
});

test('unavailable storage does not break rendering or a successful live request', () => {
  const snapshot = createOrderSnapshot({ storage: () => { throw new Error('Unavailable'); } });
  assert.equal(snapshot.read('A'), null); assert.doesNotThrow(() => snapshot.write('A', rows));
  assert.doesNotThrow(() => snapshot.clear('A'));
});
