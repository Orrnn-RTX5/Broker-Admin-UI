import test from 'node:test';
import assert from 'node:assert/strict';
import { createManagerDirectoryLoader, createManagerSummaryStore } from './managerDirectoryCache.js';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const row = (login = 1) => ({ login, name: 'Manager ' + login, enabled: true, is_admin: false, role_id: 2, role_name: 'Dealer' });
const storage = () => { const values = new Map(); return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };

test('managers publish without waiting for roles or sessions and startup readers share requests', async () => {
  const managers = deferred(), roles = deferred(), online = deferred(); let calls = 0;
  const loader = createManagerDirectoryLoader({ fetchers: { managers: () => { calls++; return managers.promise; }, roles: () => roles.promise, online: () => online.promise } });
  const first = loader.read('scope', 'managers'), handoff = loader.read('scope', 'managers');
  const roleRequest = loader.read('scope', 'roles'), sessionRequest = loader.read('scope', 'online');
  assert.equal(first, handoff);
  managers.resolve([row()]); await first;
  assert.equal(calls, 1); assert.equal(loader.peek('scope').managers.rows.length, 1);
  assert.equal(loader.peek('scope').managers.loading, false); assert.equal(loader.peek('scope').roles.loading, true);
  assert.equal(loader.peek('scope').online.hasData, false);
  roles.resolve([]); online.resolve([]); await Promise.all([roleRequest, sessionRequest]);
});

test('warm reads reuse live rows, including empty results, and expire to revalidate', async () => {
  let at = 1000, calls = 0;
  const loader = createManagerDirectoryLoader({ now: () => at, fetchers: { managers: async () => { calls++; return []; } } });
  await loader.read('scope', 'managers'); await loader.read('scope', 'managers');
  assert.equal(calls, 1); assert.equal(loader.peek('scope').managers.hasData, true);
  at += 15_001; await loader.read('scope', 'managers'); assert.equal(calls, 2);
});

test('mutation invalidation supersedes an older request and publishes a newly created row', async () => {
  const older = deferred(); let calls = 0;
  const loader = createManagerDirectoryLoader({ fetchers: { managers: () => ++calls === 1 ? older.promise : Promise.resolve([row(2)]) } });
  const oldRequest = loader.read('scope', 'managers'); await Promise.resolve();
  loader.invalidate('scope', ['managers']); await loader.read('scope', 'managers');
  older.resolve([row(1)]); await oldRequest;
  assert.deepEqual(loader.peek('scope').managers.rows.map(item => item.login), [2]);
});

test('a background refresh keeps visible rows and a transient failure remains retryable', async () => {
  const delayed = deferred(); let calls = 0;
  const loader = createManagerDirectoryLoader({ fetchers: { managers: () => ++calls === 1 ? Promise.resolve([row()]) : calls === 2 ? delayed.promise : Promise.resolve([row(2)]) } });
  await loader.read('scope', 'managers'); const refresh = loader.read('scope', 'managers', { force: true });
  assert.equal(loader.peek('scope').managers.loading, false); assert.equal(loader.peek('scope').managers.refreshing, true);
  delayed.reject(new Error('network')); await refresh;
  assert.equal(loader.peek('scope').managers.rows[0].login, 1);
  await loader.read('scope', 'managers'); assert.equal(loader.peek('scope').managers.rows[0].login, 2);
});

test('summary restoration is immediate, scoped and limited to display columns', async () => {
  const disk = storage(); let at = 1000;
  const summaries = createManagerSummaryStore({ storage: () => disk, now: () => at });
  summaries.write('broker-a:admin', [{ ...row(), password: 'secret', ip_whitelist: ['10.0.0.1'], allowed_groups: ['private'], permissions: ['*'] }], at);
  const raw = [...disk.values.values()][0];
  for (const key of ['password', 'ip_whitelist', 'allowed_groups', 'permissions']) assert(!raw.includes(key));
  const slow = deferred();
  const loader = createManagerDirectoryLoader({ summaries, now: () => at, fetchers: { managers: () => slow.promise } });
  assert.equal(loader.peek('broker-a:admin').managers.rows[0]._directorySummary, true);
  assert.equal(loader.peek('broker-a:admin').managers.loading, false);
  assert.equal(loader.peek('broker-b:admin').managers.hasData, false);
  const request = loader.read('broker-a:admin', 'managers'); slow.resolve([row(2)]); await request;
  assert.equal(loader.peek('broker-a:admin').managers.rows[0]._directorySummary, undefined);
  at += 60_001; assert.equal(summaries.read('broker-a:admin'), null);
});

test('malformed, future, wrong-scope and duplicate summary rows cannot be restored', () => {
  const disk = storage(), summaries = createManagerSummaryStore({ storage: () => disk, now: () => 1000 });
  summaries.write('scope', [row()], 1000); const key = [...disk.values.keys()][0], original = JSON.parse(disk.getItem(key));
  for (const override of [{ identity: 'different' }, { version: 99 }, { at: 1001 }, { rows: [row(), row()] }, { rows: [{ ...row(), password: 'secret' }] }]) {
    disk.setItem(key, JSON.stringify({ ...original, ...override })); assert.equal(summaries.read('scope'), null);
  }
  disk.setItem(key, 'invalid-json'); assert.equal(summaries.read('scope'), null);
});

test('authorization changes and logout discard old rows and late responses', async () => {
  let identity = 'before'; const slow = deferred(), disk = storage();
  const summaries = createManagerSummaryStore({ storage: () => disk });
  const loader = createManagerDirectoryLoader({ summaries, isCurrent: scope => scope === identity, fetchers: { managers: () => slow.promise } });
  const request = loader.read(identity, 'managers'); identity = 'after'; loader.clear('before');
  slow.resolve([row()]); await request;
  assert.equal(loader.peek('after').managers.hasData, false); assert.equal(disk.values.size, 0);
  assert.equal(await loader.read('before', 'managers'), null);
});

test('permission rejection clears cached display rows and their snapshot', async () => {
  const disk = storage(), summaries = createManagerSummaryStore({ storage: () => disk }); let fail = false;
  const loader = createManagerDirectoryLoader({ summaries, fetchers: { managers: async () => { if (fail) throw { response: { status: 403 } }; return [row()]; } } });
  await loader.read('scope', 'managers'); fail = true;
  await loader.read('scope', 'managers', { force: true });
  assert.equal(loader.peek('scope').managers.rows.length, 0); assert.equal(loader.peek('scope').managers.hasData, false);
  assert.equal(disk.values.size, 0);
});

test('an invalid backend response is reported rather than cached as an empty list', async () => {
  const loader = createManagerDirectoryLoader({ fetchers: { managers: async () => ({ success: true }) } });
  await loader.read('scope', 'managers');
  assert.equal(loader.peek('scope').managers.hasData, false); assert.match(loader.peek('scope').managers.error.message, /Invalid/);
});
