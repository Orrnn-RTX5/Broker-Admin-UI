import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOrderFeed } from './orderFeed.js';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const setup = (options = {}) => {
  const saved = [], cleared = [];
  const feed = createOrderFeed({
    fetchPage: async () => [{ ticket: '1', symbol: 'EURUSD' }], fetchLogins: async () => [],
    snapshot: { read: () => null, write: (identity, data) => saved.push({ identity, data }), clear: identity => cleared.push(identity) },
    isCurrent: identity => identity === 'A', ...options,
  });
  return { ...feed, saved, cleared };
};

test('startup, mount, replay and polling share an in-flight page request', async () => {
  const pending = deferred(); let calls = 0;
  const feed = setup({ fetchPage: () => { calls++; return pending.promise; } });
  const first = feed.read('A');
  const second = feed.read('A', {}, { force: true });
  assert.equal(first, second);
  await tick();
  assert.equal(calls, 1);
  pending.resolve([]); await first;
  assert.equal(feed.peek('A').loading, false);
  assert.deepEqual(feed.peek('A').data, []);
});

test('warm refresh preserves the snapshot and unchanged results never notify or replace it', async () => {
  const pending = deferred();
  const feed = setup({ fetchPage: () => pending.promise });
  const initial = [{ ticket: '1', symbol: 'EURUSD' }];
  // Fill the feed, then begin a second request with an identical payload.
  pending.resolve(initial); await feed.read('A');
  const before = feed.peek('A'); let notifications = 0;
  feed.subscribe(() => notifications++);
  const refresh = feed.read('A', {}, { force: true });
  assert.equal(feed.peek('A'), before);
  await refresh;
  assert.equal(feed.peek('A'), before);
  assert.equal(notifications, 0);
});

test('fresh complete page responses reconcile additions, deletion, status and zero orders', async () => {
  let rows = [{ ticket: '1', status: 'open' }, { ticket: '2', status: 'open' }];
  const pending = deferred(); let delayed = false;
  const feed = setup({ fetchPage: () => delayed ? pending.promise : Promise.resolve(rows) });
  await feed.read('A');
  delayed = true;
  const refresh = feed.read('A', {}, { force: true });
  assert.equal(feed.peek('A').loading, false);
  assert.equal(feed.peek('A').data.length, 2);
  pending.resolve([{ ticket: '3', status: 'open' }, { ticket: '2', status: 'closed' }]);
  await refresh;
  assert.deepEqual(feed.peek('A').data.map(row => row.ticket), ['3', '2']);
  assert.equal(feed.peek('A').data[1].status, 'closed');
  delayed = false; rows = [];
  await feed.read('A', {}, { force: true });
  assert.deepEqual(feed.peek('A').data, []);
});

test('a restored default page is synchronous, revalidates immediately, and never fills a different query', async () => {
  const pending = deferred(); let calls = 0;
  const data = { orders: [{ ticket: '1' }] };
  const feed = setup({ snapshot: { read: () => data, write() {}, clear() {} }, fetchPage: () => { calls++; return pending.promise; } });
  assert.equal(feed.peek('A').data, data);
  assert.equal(feed.peek('A').loading, false);
  assert.equal(feed.peek('A', { symbol: 'GBPUSD' }).data, null);
  assert.equal(feed.peek('A', { offset: 100 }).data, null);
  assert.equal(feed.peek('A', { logins: [1] }).data, null);
  const task = feed.read('A'); await tick(); assert.equal(calls, 1);
  pending.resolve([]); await task;
});

test('page responses and filters remain isolated when their requests finish out of order', async () => {
  const first = deferred(), second = deferred();
  const feed = setup({ fetchPage: query => query.offset ? second.promise : first.promise });
  const a = feed.read('A'); const b = feed.read('A', { offset: 100 });
  second.resolve([{ ticket: '200' }]); await b;
  first.resolve([{ ticket: '1' }]); await a;
  assert.equal(feed.peek('A', { offset: 100 }).data[0].ticket, '200');
  assert.equal(feed.peek('A').data[0].ticket, '1');
});

test('temporary failure retains rows and recovery clears errors without a loading reset', async () => {
  let failed = false;
  const feed = setup({ fetchPage: async () => { if (failed) throw new Error('Offline'); return [{ ticket: '1' }]; } });
  await feed.read('A'); const before = feed.peek('A').data;
  failed = true; await feed.read('A', {}, { force: true });
  assert.equal(feed.peek('A').data, before);
  assert.equal(feed.peek('A').loading, false);
  assert.equal(feed.peek('A').error.message, 'Offline');
  failed = false; await feed.read('A', {}, { force: true });
  assert.equal(feed.peek('A').data, before);
  assert.equal(feed.peek('A').error, null);
});

test('permission denial removes all cached pages and persisted rows in this scope', async () => {
  let denied = false;
  const feed = setup({ fetchPage: async () => { if (denied) throw { response: { status: 403 } }; return [{ ticket: '1' }]; } });
  await feed.read('A'); await feed.read('A', { offset: 100 });
  denied = true; await feed.read('A', {}, { force: true });
  assert.equal(feed.peek('A').data, null);
  assert.equal(feed.peek('A').error.response.status, 403);
  assert.equal(feed.peek('A', { offset: 100 }).data, null);
  assert.deepEqual(feed.cleared, ['A']);
});

test('logout or authorization change aborts old work and cannot publish or persist its late response', async () => {
  let current = 'A', signal;
  const pending = deferred();
  const feed = setup({ isCurrent: identity => identity === current, fetchPage: (_query, requestSignal) => { signal = requestSignal; return pending.promise; } });
  const task = feed.read('A'); await tick();
  current = 'B'; feed.clear('A');
  assert.equal(signal.aborted, true);
  pending.resolve([{ ticket: '1' }]); await task;
  assert.equal(feed.peek('A').data, null);
  assert.equal(feed.peek('B').data, null);
  assert.deepEqual(feed.saved, []);
});

test('fresh pages reuse a short memory TTL but forced refreshes always revalidate', async () => {
  let time = 0, calls = 0;
  const feed = setup({ now: () => time, fetchPage: async () => { calls++; return []; } });
  await feed.read('A'); await feed.read('A'); assert.equal(calls, 1);
  time = 2001; await feed.read('A'); assert.equal(calls, 2);
  await feed.read('A', {}, { force: true }); assert.equal(calls, 3);
});

test('filtered live refresh rescans fresh backend pages after an order disappears', async () => {
  let rows = [{ ticket: '1', symbol: 'EURUSD' }, { ticket: '2', symbol: 'GBPUSD' }];
  const feed = setup({ fetchPage: async query => rows.slice(query.offset, query.offset + query.limit) });
  const query = { symbol: 'GBPUSD' };
  const options = { matches: row => row.symbol === 'GBPUSD', force: true };
  await feed.read('A', query, options);
  assert.equal(feed.peek('A', query).data.orders[0].ticket, '2');
  rows = [rows[0]];
  await feed.read('A', query, options);
  assert.deepEqual(feed.peek('A', query).data.orders, []);
  assert.equal(feed.peek('A', query).data.total, 0);
});

test('login-bound requests use the account endpoint and never share broker pages', async () => {
  let accounts;
  const feed = setup({ fetchLogins: async logins => { accounts = logins; return [{ ticket: '9' }]; } });
  await feed.read('A', { logins: [3, 1] });
  assert.deepEqual(accounts, ['1', '3']);
  assert.equal(feed.peek('A', { logins: [1, 3] }).data[0].ticket, '9');
  assert.equal(feed.peek('A').data, null);
});
