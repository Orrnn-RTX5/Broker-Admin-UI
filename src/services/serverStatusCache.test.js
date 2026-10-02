import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServerStatusCache, SERVER_STATUS_FRESH_MS, SERVER_STATUS_SNAPSHOT_MS, SERVER_STATUS_STORAGE_KEY } from './serverStatusCache.js';

const memoryStorage = () => {
  const records = new Map();
  return { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) };
};
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('startup, panel, and refresh share pending status; fresh tabs reuse data; force reads current data', async () => {
  let time = 1000, calls = 0;
  const response = deferred(), disk = memoryStorage();
  const cache = createServerStatusCache({ storage: () => disk, now: () => time, fetchStatus: () => { calls++; return response.promise; } });
  const first = cache.read('broker-a');
  assert.equal(cache.read('broker-a'), first);
  assert.equal(cache.read('broker-a', { force: true }), first);
  assert.equal(calls, 1);
  response.resolve({ active_sessions: 28 }); await first;
  const snapshot = cache.peek('broker-a');
  assert.equal(cache.peek('broker-a'), snapshot, 'external store snapshot stays referentially stable');
  await cache.read('broker-a'); assert.equal(calls, 1);
  await cache.read('broker-a', { force: true }); assert.equal(calls, 2);
  time += SERVER_STATUS_FRESH_MS;
  await cache.read('broker-a'); assert.equal(calls, 3);
});

test('hard reload synchronously restores only known metrics, preserves capture time, and always revalidates', async () => {
  const disk = memoryStorage(); let calls = 0;
  const options = { storage: () => disk, now: () => 1000, fetchStatus: async () => { calls++; return { active_sessions: 28, secret: 'never save', db_pool: { total_conns: 5, connection_string: 'never save' } }; } };
  await createServerStatusCache(options).read('broker-a');
  assert(!disk.getItem(SERVER_STATUS_STORAGE_KEY).includes('never save'));
  const reload = createServerStatusCache(options);
  assert.deepEqual(reload.peek('broker-a'), { data: { active_sessions: 28, db_pool: { total_conns: 5 } }, fetchedAt: 1000, source: 'saved' });
  await reload.read('broker-a'); assert.equal(calls, 2);
  assert.equal(reload.peek('broker-a').source, 'server');
});

test('expired, future, malformed, and different-broker disk snapshots are discarded', () => {
  const disk = memoryStorage(), now = 500_000;
  for (const stored of [
    { scope: 'broker-a', fetchedAt: now - SERVER_STATUS_SNAPSHOT_MS, data: { active_sessions: 28 } },
    { scope: 'broker-a', fetchedAt: now + 1, data: { active_sessions: 28 } },
    { scope: 'broker-b', fetchedAt: now - 1, data: { active_sessions: 28 } },
    { scope: 'broker-a', fetchedAt: now - 1, data: [] },
    'broken-json',
  ]) {
    disk.setItem(SERVER_STATUS_STORAGE_KEY, typeof stored === 'string' ? stored : JSON.stringify(stored));
    const cache = createServerStatusCache({ storage: () => disk, now: () => now });
    assert.equal(cache.peek('broker-a'), null);
    assert.equal(disk.getItem(SERVER_STATUS_STORAGE_KEY), null);
  }
});

test('transient failures retain the snapshot; retry succeeds; access denial erases it immediately', async () => {
  const disk = memoryStorage(); let failure = 0;
  const cache = createServerStatusCache({ storage: () => disk, fetchStatus: async () => {
    if (failure) throw Object.assign(new Error('failure'), { response: { status: failure } });
    return { active_sessions: 28 };
  } });
  await cache.read('broker-a'); failure = 503;
  await assert.rejects(cache.read('broker-a', { force: true }));
  assert.equal(cache.peek('broker-a').data.active_sessions, 28);
  failure = 0; await cache.read('broker-a', { force: true });
  for (const status of [401, 403]) {
    failure = status;
    await assert.rejects(cache.read('broker-a', { force: true }));
    assert.equal(cache.peek('broker-a'), null);
    assert.equal(disk.getItem(SERVER_STATUS_STORAGE_KEY), null);
    failure = 0; await cache.read('broker-a');
  }
});

test('scope change aborts old requests and late responses cannot overwrite the new broker or logged-out cache', async () => {
  const old = deferred(), disk = memoryStorage(); let signal;
  const cache = createServerStatusCache({ storage: () => disk, fetchStatus: config => {
    if (!signal) { signal = config.signal; return old.promise; }
    return Promise.resolve({ active_sessions: 29 });
  } });
  const pending = cache.read('broker-a');
  const unsubscribe = cache.subscribe(() => { cache.peek('broker-a'); });
  assert.equal(cache.peek('broker-b'), null);
  await cache.read('broker-b'); assert.equal(signal.aborted, true);
  old.resolve({ active_sessions: 100 }); await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(cache.peek('broker-b').data.active_sessions, 29);
  unsubscribe();
  cache.clear(); assert.equal(cache.peek('broker-b'), null);
  assert.equal(disk.getItem(SERVER_STATUS_STORAGE_KEY), null);
});

test('blocked storage and synchronous fetch errors do not prevent subsequent status reads', async () => {
  let failed = true;
  const cache = createServerStatusCache({ storage: () => { throw new Error('blocked storage'); }, fetchStatus: () => {
    if (failed) throw new Error('fetch failed');
    return { active_sessions: 28 };
  } });
  await assert.rejects(cache.read('broker-a'), /fetch failed/);
  failed = false; await cache.read('broker-a');
  assert.equal(cache.peek('broker-a').data.active_sessions, 28);
  await assert.rejects(cache.read(''), /authorized session/);
});
