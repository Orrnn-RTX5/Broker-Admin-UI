import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTradeListFeed, createTradeListSnapshot, normalizePositionQuery, normalizeDealQuery, recentDealRange } from './tradeListFeed.js';

const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
const fixture = () => {
  let clock = 100_000, identity = 'broker:9001:permissions-a';
  const values = new Map(), requests = [];
  const storage = () => ({ getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) });
  const snapshot = createTradeListSnapshot({ kind: 'positions', storage, now: () => clock });
  const feed = createTradeListFeed({ normalizeQuery: normalizePositionQuery,
    isDefaultQuery: query => query.page === 1 && query.limit === 100 && !query.logins.length,
    snapshot, now: () => clock, isCurrent: value => value === identity,
    fetchPage: (query, signal) => { const task = deferred(); requests.push({ ...task, query, signal }); return task.promise; } });
  return { feed, snapshot, requests, values, storage, identity, tick: amount => { clock += amount; }, switch: value => { identity = value; } };
};
const settle = () => new Promise(resolve => setImmediate(resolve));
test('startup and mounted readers share one request; a reset gets synchronous rows', async () => {
  const { feed, identity, requests } = fixture();
  const startup = feed.read(identity, {}), mounted = feed.read(identity, { page: 1, limit: 100 });
  assert.equal(startup, mounted); await settle(); assert.equal(requests.length, 1);
  requests[0].resolve({ positions: [{ ticket: 1, symbol: 'EURUSD', profit: 5 }], total: 1 });
  await startup;
  assert.equal(feed.peek(identity, {}).data.positions[0].profit, 5);
  assert.equal(feed.peek(identity, {}).verified, true);
  await feed.read(identity, {}); assert.equal(requests.length, 1);
});
test('hard refresh restores only display columns and always verifies them with the server', async () => {
  const { feed, identity, snapshot, requests } = fixture();
  snapshot.write(identity, { positions: [{ ticket: 10, priceCurrent: 1.12, password: 'must-not-persist' }], total: 1 });
  const restored = feed.peek(identity, {});
  assert.deepEqual(restored.data, { positions: [{ ticket: 10, priceCurrent: 1.12 }], total: 1 });
  assert.equal(restored.loading, false); assert.equal(restored.verified, false);
  assert.equal(feed.peek(identity, { page: 2 }).data, null, 'page 2 cannot borrow page 1');
  const fresh = feed.read(identity, {}); await settle(); assert.equal(requests.length, 1);
  requests[0].resolve({ positions: [], total: 0 }); await fresh;
  assert.deepEqual(feed.peek(identity, {}).data, { positions: [], total: 0 });
  assert.equal(feed.peek(identity, {}).verified, true);
});
test('polling retains rows, deduplicates requests and does not publish unchanged pages', async () => {
  const { feed, identity, requests, tick } = fixture();
  const page = { positions: [{ ticket: 10 }], total: 1 };
  const first = feed.read(identity, {}); await settle(); requests[0].resolve(page); await first;
  const shown = feed.peek(identity, {}); let updates = 0;
  const stop = feed.subscribe(() => { updates++; }); tick(2001);
  const next = feed.read(identity, {}, { force: true });
  assert.equal(next, feed.read(identity, {}, { force: true }));
  assert.equal(feed.peek(identity, {}), shown); await settle();
  requests[1].resolve(page); await next;
  assert.equal(feed.peek(identity, {}), shown); assert.equal(updates, 0); stop();
});
test('a mutation during a pending read revalidates afterward and reflects deletions', async () => {
  const { feed, identity, requests } = fixture();
  const first = feed.read(identity, {}); await settle();
  const afterMutation = feed.refresh(identity, {});
  requests[0].resolve({ positions: [{ ticket: 10 }] }); await first; await settle();
  assert.equal(requests.length, 2);
  requests[1].resolve({ positions: [] }); await afterMutation;
  assert.deepEqual(feed.peek(identity, {}).data.positions, []);
});
test('temporary failure retains rows but authorization denial clears display and persistence', async () => {
  const { feed, identity, requests, snapshot } = fixture();
  const first = feed.read(identity, {}); await settle(); requests[0].resolve({ positions: [{ ticket: 10 }] }); await first;
  const temporary = feed.read(identity, {}, { force: true }); await settle(); requests[1].reject(new Error('network')); await temporary;
  assert.equal(feed.peek(identity, {}).data.positions.length, 1);
  const denied = feed.read(identity, {}, { force: true }); await settle(); requests[2].reject({ response: { status: 403 } }); await denied;
  assert.equal(feed.peek(identity, {}).data, null); assert.equal(snapshot.read(identity), null);
});
test('logout or permission changes abort work and cannot republish old private data', async () => {
  const context = fixture(), { feed, identity, requests, snapshot } = context;
  const first = feed.read(identity, {}); await settle();
  context.switch('other-user'); feed.clear(identity);
  assert.equal(requests[0].signal.aborted, true);
  requests[0].resolve({ positions: [{ ticket: 10 }] }); await first;
  assert.equal(feed.peek(identity, {}).data, null); assert.equal(snapshot.read(identity), null);
  assert.equal(feed.peek('other-user', {}).data, null);
});
test('saved prices expire quickly; malformed or foreign snapshots never restore', () => {
  const { identity, snapshot, values, tick } = fixture();
  snapshot.write(identity, { positions: [{ ticket: 10 }] }); assert.ok(snapshot.read(identity));
  assert.equal(snapshot.read('other-broker'), null);
  tick(30_000); assert.equal(snapshot.read(identity), null);
  const key = [...values.keys()][0];
  values.set(key, JSON.stringify({ version: 1, identity, at: 130000, rows: [{ ticket: 10, secret: 'invalid' }], total: 1 }));
  assert.equal(snapshot.read(identity), null);
});
test('storage errors, unsafe numeric tickets and oversized pages do not interrupt live loading', () => {
  const broken = createTradeListSnapshot({ kind: 'positions', storage: () => { throw new Error('storage disabled'); } });
  assert.equal(broken.read('scope'), null); assert.doesNotThrow(() => broken.write('scope', [{ ticket: 10 }]));
  const { snapshot, identity } = fixture();
  snapshot.write(identity, [{ ticket: Number.MAX_SAFE_INTEGER + 1 }]); assert.equal(snapshot.read(identity), null);
  snapshot.write(identity, Array.from({ length: 101 }, (_, i) => ({ ticket: i + 1 }))); assert.equal(snapshot.read(identity), null);
});
test('recent deals use one semantic cache key while each request advances the date window', () => {
  assert.deepEqual(normalizeDealQuery({ range: 'recent', from: 'old', to: 'old' }), normalizeDealQuery({ range: 'recent', from: 'new', to: 'new' }));
  const first = recentDealRange(1800000000000), next = recentDealRange(1800000002000);
  assert.equal(Date.parse(next.to) - Date.parse(first.to), 2000);
  assert.equal(Date.parse(first.to) - Date.parse(first.from), 30 * 86400_000);
  assert.notDeepEqual(normalizeDealQuery({ from: 'a', to: 'b' }), normalizeDealQuery({ from: 'b', to: 'c' }));
});
