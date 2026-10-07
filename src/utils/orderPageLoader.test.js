import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOrderPageLoader } from './orderPageLoader.js';

const rows = Array.from({ length: 830 }, (_, ticket) => ({ ticket, symbol: ticket >= 600 ? 'GBPUSD' : 'EURUSD', status: ticket % 3 ? 'filled' : 'closed' }));
const params = { limit: 50, offset: 0, symbol: 'GBPUSD' };
const matches = row => row.symbol === 'GBPUSD';
const makeLoader = (options, cap = 250) => {
  const calls = [];
  const loader = createOrderPageLoader(async query => { calls.push(query); return rows.slice(query.offset, query.offset + Math.min(cap, query.limit)); }, options);
  return { loader, calls };
};

test('array endpoint fallback finds matches beyond the first raw page and pages matching rows', async () => {
  const { loader, calls } = makeLoader();
  const first = await loader.load(params, matches);
  assert.deepEqual(first.orders.map(row => row.ticket), rows.slice(600, 650).map(row => row.ticket));
  assert.equal(first.hasNextPage, true);
  assert.equal(first.total, undefined);
  assert(calls.some(query => query.offset === 500 && !query.symbol));
  const second = await loader.load({ ...params, offset: 50 }, matches);
  assert.deepEqual(second.orders.map(row => row.ticket), rows.slice(650, 700).map(row => row.ticket));
  const last = await loader.load({ ...params, offset: 200 }, matches);
  assert.equal(last.orders.length, 30);
  assert.equal(last.total, 230);
  assert.equal(last.hasNextPage, false);
});

test('zero matches scan the backend to exhaustion without inventing a total', async () => {
  const { loader, calls } = makeLoader();
  const result = await loader.load({ ...params, search: 'nonexistent' }, () => false);
  assert.deepEqual(result.orders, []);
  assert.equal(result.total, 0);
  assert.equal(result.hasNextPage, false);
  assert.equal(calls.at(-1).offset, rows.length);
});

test('a backend page cap smaller than requested does not truncate history', async () => {
  const { loader } = makeLoader(undefined, 100);
  const result = await loader.load(params, matches);
  assert.equal(result.orders[0].ticket, 600);
  assert.equal(result.orders.length, 50);
});

test('structured filtered backend responses retain their fast path and accurate total', async () => {
  let calls = 0;
  const response = { orders: rows.slice(600, 650), total: 230 };
  const loader = createOrderPageLoader(async () => { calls++; return response; });
  assert.equal(await loader.load(params, matches), response);
  assert.equal(calls, 1);
});

test('structured responses that return nonmatching rows also trigger frontend filtering', async () => {
  const loader = createOrderPageLoader(async query => ({ orders: rows.slice(query.offset, query.offset + query.limit), total: rows.length }));
  assert.equal((await loader.load(params, matches)).orders[0].ticket, 600);
});

test('unfiltered views request only their backend page', async () => {
  const { loader, calls } = makeLoader();
  const result = await loader.load({ limit: 50, offset: 50 }, () => true);
  assert.equal(result.length, 50);
  assert.deepEqual(calls, [{ limit: 50, offset: 50 }]);
});

test('scan cache is briefly reused, expires, and is cleared by explicit refresh', async () => {
  let time = 1000;
  const { loader, calls } = makeLoader({ now: () => time, ttl: 5000 });
  await loader.load(params, matches);
  const before = calls.length;
  await loader.load({ ...params, offset: 50 }, matches);
  assert.equal(calls.length, before);
  time += 5001;
  await loader.load(params, matches);
  assert(calls.length > before);
  const after = calls.length;
  loader.clear();
  await loader.load(params, matches);
  assert(calls.length > after);
});

test('overlapping backend pages do not duplicate orders and repeated pages fail visibly', async () => {
  const repeating = createOrderPageLoader(async () => rows.slice(0, 100));
  await assert.rejects(repeating.load(params, matches), /repeated a page/);
  const overlapping = createOrderPageLoader(async query => query.symbol ? rows.slice(0, 50) : rows.slice(Math.max(0, query.offset - 10), query.offset + 250));
  const result = await overlapping.load({ ...params, limit: 100 }, matches);
  assert.equal(new Set(result.orders.map(row => row.ticket)).size, result.orders.length);
});

test('a superseded request stops scanning and separate loader scopes never share cached data', async () => {
  const controller = new AbortController();
  let calls = 0;
  const loader = createOrderPageLoader(async () => { calls++; controller.abort(); return rows.slice(0, 50); });
  await assert.rejects(loader.load(params, matches, controller.signal), { name: 'AbortError' });
  assert.equal(calls, 1);
  const first = makeLoader(); const second = makeLoader();
  await first.loader.load(params, matches);
  await second.loader.load(params, matches);
  assert(second.calls.length > 1);
});
