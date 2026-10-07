import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { getStoredCacheIdentity, identitySnapshotKey } from './cacheIdentity.js';

const browserStorage = new Map();
globalThis.localStorage = {
  getItem: key => browserStorage.get(key) ?? null,
  setItem: (key, value) => browserStorage.set(key, value),
  removeItem: key => browserStorage.delete(key),
};
const {
  GROUP_LIST_CACHE_TTL_MS, GROUP_LIST_FETCH_OPTIONS, clearGroupListSnapshot, invalidateGroupListCache,
  loadGroupList, peekGroupList, readGroupListSnapshot, writeGroupListSnapshot,
} = await import('./groupListCache.js');

const signIn = (overrides = {}) => {
  const user = { login: 9001, broker_id: 'broker-A', group_access_mode: 'all_within_broker', permissions: ['view_groups'], ...overrides };
  const token = `session-${user.broker_id}-${user.login}`;
  browserStorage.set('authToken', token);
  browserStorage.set('brokerId', user.broker_id);
  browserStorage.set('rtx5-auth-storage', JSON.stringify({ state: { user, accessToken: token, isAuthenticated: true } }));
  return getStoredCacheIdentity();
};
const savedKey = (identity = getStoredCacheIdentity()) => identitySnapshotKey('rtx5-admin-group-list:', identity);
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

beforeEach(() => {
  browserStorage.clear();
  invalidateGroupListCache();
  signIn();
});

test('the group list is loaded through one shared cache key with a long TTL', () => {
  assert.equal(GROUP_LIST_FETCH_OPTIONS.requestKey, 'groups:list');
  assert.ok(GROUP_LIST_FETCH_OPTIONS.cacheTtlMs >= 60_000);
});

test('loading normalizes and snapshots a slim list for the exact authenticated scope', async () => {
  const groups = await loadGroupList(async () => [{ name: 'PREP\\demo\\Client01' }, { Name: 'demo' }]);
  assert.deepEqual(groups.map(group => group.groupName), ['demo', 'PREP\\demo\\Client01']);
  assert.deepEqual(readGroupListSnapshot().map(group => group.groupName), ['demo', 'PREP\\demo\\Client01']);
  assert.ok(browserStorage.has(savedKey()));
  clearGroupListSnapshot();
  assert.equal(readGroupListSnapshot(), null);
});

test('overlapping and subsequent readers share one fresh group-list request', async () => {
  let calls = 0;
  const fetchRows = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return [{ name: 'shared' }];
  };
  const [first, second] = await Promise.all([loadGroupList(fetchRows), loadGroupList(fetchRows)]);
  assert.equal(calls, 1);
  assert.equal(first, second);
  assert.deepEqual(first.map((group) => group.groupName), ['shared']);
  assert.equal(await loadGroupList(fetchRows), first);
  assert.equal(peekGroupList(), first);
  assert.equal(calls, 1);
});

test('corrupt or foreign snapshots are ignored instead of breaking the tree', () => {
  browserStorage.set(savedKey(), '{not json');
  assert.equal(readGroupListSnapshot(), null);
  browserStorage.set(savedKey(), JSON.stringify({ groups: [{ label: 'no name' }] }));
  assert.equal(readGroupListSnapshot(), null);
  writeGroupListSnapshot('not a list');
  assert.equal(readGroupListSnapshot(), null);
});

test('empty successful lists remain cacheable and snapshots expire after five minutes', async () => {
  let calls = 0;
  const fetchRows = () => { calls += 1; return []; };
  assert.deepEqual(await loadGroupList(fetchRows), []);
  assert.deepEqual(await loadGroupList(fetchRows), []);
  assert.deepEqual(readGroupListSnapshot(), []);
  assert.equal(calls, 1);
  const snapshot = JSON.parse(browserStorage.get(savedKey()));
  snapshot.at = Date.now() - GROUP_LIST_CACHE_TTL_MS;
  browserStorage.set(savedKey(), JSON.stringify(snapshot));
  assert.equal(readGroupListSnapshot(), null);
});

test('snapshots omit full group configuration and separate brokers, users and permissions', async () => {
  await loadGroupList(() => [{ name: 'private', currency: 'USD', symbols: ['EURUSD'], secret: 'value' }]);
  const firstIdentity = getStoredCacheIdentity();
  const snapshot = readGroupListSnapshot();
  assert.deepEqual(snapshot[0].group, { name: 'private', currency: 'USD', _allocationSummary: true });
  signIn({ broker_id: 'broker-B' });
  assert.equal(readGroupListSnapshot(), null);
  assert.equal(peekGroupList(), null);
  signIn({ login: 9002 });
  assert.equal(readGroupListSnapshot(), null);
  signIn({ group_access_mode: 'restricted', allowed_groups: ['public'] });
  assert.equal(readGroupListSnapshot(), null);
  signIn();
  assert.equal(getStoredCacheIdentity(), firstIdentity);
  assert.equal(readGroupListSnapshot()[0].groupName, 'private');
});

test('missing authenticated identity never reads old shared or login-only snapshots', async () => {
  browserStorage.clear();
  browserStorage.set('brokerLogin', '9001');
  browserStorage.set('rtx5-admin-group-list:9001', JSON.stringify({ groups: [{ groupName: 'private' }] }));
  browserStorage.set('rtx5-admin-group-list:shared', JSON.stringify({ groups: [{ groupName: 'private' }] }));
  assert.equal(readGroupListSnapshot(), null);
  await loadGroupList(() => [{ name: 'live' }]);
  assert.equal(peekGroupList(), null);
  assert.equal(browserStorage.size, 3);
});

test('a changed authorization scope rejects the older pending result and never saves it', async () => {
  const oldIdentity = getStoredCacheIdentity();
  const first = deferred();
  const older = loadGroupList(() => first.promise);
  const rejection = assert.rejects(older, { code: 'ERR_CANCELED' });
  await Promise.resolve();
  signIn({ broker_id: 'broker-B' });
  const freshRows = await loadGroupList(() => [{ name: 'new scope' }]);
  first.resolve([{ name: 'old scope' }]);
  await rejection;
  assert.equal(peekGroupList(), freshRows);
  assert.equal(browserStorage.has(savedKey(oldIdentity)), false);
  assert.equal(readGroupListSnapshot()[0].groupName, 'new scope');
});

test('logout before a request completes prevents writing its saved snapshot', async () => {
  const oldIdentity = getStoredCacheIdentity();
  const first = deferred();
  const pending = loadGroupList(() => first.promise);
  const rejection = assert.rejects(pending, { code: 'ERR_CANCELED' });
  await Promise.resolve();
  browserStorage.clear();
  first.resolve([{ name: 'private' }]);
  await rejection;
  assert.equal(browserStorage.has(savedKey(oldIdentity)), false);
});

test('forced refresh supersedes an older request and deduplicates concurrent forced readers', async () => {
  const first = deferred();
  const second = deferred();
  const older = loadGroupList(() => first.promise);
  const rejection = assert.rejects(older, { code: 'ERR_CANCELED' });
  await Promise.resolve();
  const fresh = loadGroupList(() => second.promise, { force: true });
  assert.equal(loadGroupList(() => { throw new Error('duplicate'); }, { force: true }), fresh);
  second.resolve([{ name: 'after save' }]);
  const result = await fresh;
  first.resolve([{ name: 'before save' }]);
  await rejection;
  assert.equal(peekGroupList(), result);
});

test('denied live requests remove the saved list instead of retaining forbidden groups', async () => {
  await loadGroupList(() => [{ name: 'private' }]);
  assert.ok(readGroupListSnapshot());
  const denial = Object.assign(new Error('Forbidden'), { response: { status: 403 } });
  await assert.rejects(loadGroupList(() => { throw denial; }, { force: true }), denial);
  assert.equal(readGroupListSnapshot(), null);
  assert.equal(peekGroupList(), null);
});
