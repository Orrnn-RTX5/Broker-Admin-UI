import { test } from 'node:test';
import assert from 'node:assert/strict';

const browserStorage = new Map();
globalThis.localStorage = {
  getItem: key => browserStorage.get(key) ?? null,
  setItem: (key, value) => browserStorage.set(key, value),
  removeItem: key => browserStorage.delete(key),
};
const {
  GROUP_LIST_FETCH_OPTIONS, clearGroupListSnapshot, loadGroupList, readGroupListSnapshot, writeGroupListSnapshot,
} = await import('./groupListCache.js');

test('the group list is loaded through one shared cache key with a long TTL', () => {
  assert.equal(GROUP_LIST_FETCH_OPTIONS.requestKey, 'groups:list');
  assert.ok(GROUP_LIST_FETCH_OPTIONS.cacheTtlMs >= 60_000);
});

test('loading normalizes the rows and stores a per-broker snapshot for the next start-up', async () => {
  browserStorage.set('brokerLogin', '9001');
  const groups = await loadGroupList(async () => [{ name: 'PREP\\demo\\Client01' }, { Name: 'demo' }]);
  assert.deepEqual(groups.map(group => group.groupName), ['demo', 'PREP\\demo\\Client01']);
  assert.deepEqual(readGroupListSnapshot().map(group => group.groupName), ['demo', 'PREP\\demo\\Client01']);
  assert.ok(browserStorage.has('rtx5-admin-group-list:9001'), 'snapshot is scoped to the broker login');
  clearGroupListSnapshot();
  assert.equal(readGroupListSnapshot(), null);
});

test('two callers that overlap share one group-list request', async () => {
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
});

test('corrupt or foreign snapshots are ignored instead of breaking the tree', () => {
  browserStorage.set('rtx5-admin-group-list:9001', '{not json');
  assert.equal(readGroupListSnapshot(), null);
  browserStorage.set('rtx5-admin-group-list:9001', JSON.stringify({ groups: [{ label: 'no name' }] }));
  assert.equal(readGroupListSnapshot(), null);
  writeGroupListSnapshot('not a list');
  assert.equal(readGroupListSnapshot(), null);
});
