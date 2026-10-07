import test from 'node:test';
import assert from 'node:assert/strict';
import { createGatewayConnectionsCache } from './gatewayConnectionsCache.js';

const payload = id => ({ connections: [{ config: { id, revision: 1 }, status: { quote: 'connected' } }] });
const setup = () => {
  let now = 100;
  const requests = [];
  const cache = createGatewayConnectionsCache({ now: () => now, fetchConnections: ({ signal }) => new Promise((resolve, reject) => requests.push({ signal, resolve, reject })) });
  return { cache, requests, time: value => { now = value; } };
};

test('startup and opening Connections share one request, including a valid empty list', async () => {
  const { cache, requests } = setup();
  const startup = cache.read('scope'), visible = cache.read('scope');
  assert.equal(requests.length, 1);
  requests[0].resolve({ connections: [] });
  assert.deepEqual(await startup, { connections: [] });
  assert.equal(await visible, cache.peek('scope').data);
  await cache.read('scope'); assert.equal(requests.length, 1);
});

test('a fresh handoff is immediate; stale settings stay available during a forced server read', async () => {
  const { cache, requests, time } = setup();
  const first = cache.read('scope'); requests[0].resolve(payload('one')); await first;
  time(6000);
  const refresh = cache.read('scope'); assert.equal(cache.peek('scope').data.connections[0].config.id, 'one');
  requests[1].resolve(payload('two')); await refresh;
  const forced = cache.read('scope', { force: true }); assert.equal(requests.length, 3);
  requests[2].resolve(payload('three')); await forced;
  time(70000); assert.equal(cache.peek('scope'), null);
});

test('broker, user, permission and backend scope changes cancel and reject an obsolete response', async () => {
  const { cache, requests } = setup();
  const old = cache.read('old-scope'), current = cache.read('new-scope');
  assert(requests[0].signal.aborted);
  requests[0].resolve(payload('obsolete')); await assert.rejects(old, { code: 'ERR_CANCELED' });
  requests[1].resolve(payload('current')); await current;
  assert.equal(cache.peek('old-scope'), null);
  assert.equal(cache.peek('new-scope').data.connections[0].config.id, 'current');
});

test('navigation intent cannot repeatedly request an unavailable endpoint; Retry can make a fresh read', async () => {
  const { cache, requests } = setup();
  const first = cache.read('scope'); requests[0].reject(Object.assign(new Error('Not found'), { status: 404 }));
  await assert.rejects(first, { status: 404 });
  await assert.rejects(cache.read('scope'), { status: 404 }); assert.equal(requests.length, 1);
  const retry = cache.read('scope', { force: true }); requests[1].resolve(payload('one')); await retry;
  assert.equal(cache.peek('scope').data.connections[0].config.id, 'one');
});

test('a denial removes every saved setting, while a transient failure cannot fabricate an empty success', async () => {
  const { cache, requests } = setup();
  const first = cache.read('scope'); requests[0].resolve(payload('one')); await first;
  const unavailable = cache.read('scope', { force: true }); requests[1].reject(new Error('Network failure')); await assert.rejects(unavailable);
  assert.equal(cache.peek('scope').data.connections[0].config.id, 'one');
  const denied = cache.read('scope', { force: true }); requests[2].reject({ response: { status: 403 } }); await assert.rejects(denied);
  assert.equal(cache.peek('scope'), null);
  const malformed = cache.read('scope', { force: true }); requests[3].resolve({}); await assert.rejects(malformed, /Invalid saved connections/);
});

test('mutation invalidation and sign-out prevent obsolete snapshots from being reused', async () => {
  const { cache, requests } = setup();
  const first = cache.read('scope'); requests[0].resolve(payload('one')); await first;
  cache.invalidate('scope'); assert.equal(cache.peek('scope'), null);
  const pending = cache.read('scope'); cache.clear(); assert(requests[1].signal.aborted);
  requests[1].resolve(payload('obsolete')); await assert.rejects(pending, { code: 'ERR_CANCELED' });
  assert.equal(cache.peek('scope'), null);
});
