import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUMMY_GROUPS_STORAGE_KEY, DUMMY_GROUPS_VERSION } from '../utils/dummyGroups.js';

const browserStorage = new Map();
globalThis.localStorage = {
  getItem: key => browserStorage.get(key) ?? null,
  setItem: (key, value) => browserStorage.set(key, value),
  removeItem: key => browserStorage.delete(key),
};
const { useDummyGroupsStore } = await import('./useDummyGroupsStore.js');

test('dummy edits notify both navigation and explorer and persist only under the isolated versioned key', () => {
  const store = useDummyGroupsStore;
  store.getState().reset();
  const initialRevision = store.getState().revision;
  const added = store.getState().addGroup({ path: 'Admin\\Local\\New' });
  assert.equal(store.getState().groups.length, 10);
  assert.equal(store.getState().revision, initialRevision + 1);
  store.getState().updateGroup(added.id, { currency: 'EUR' });
  store.getState().moveGroup(added.id, 'Admin\\Local\\Moved');
  store.getState().renameFolder('Admin\\Local', 'Admin\\Edited');
  assert.equal(store.getState().groups.find(group => group.id === added.id).path, 'Admin\\Edited\\Moved');
  const copied = store.getState().duplicateGroup(added.id);
  store.getState().deleteGroup(copied.id);
  const stored = JSON.parse(browserStorage.get(DUMMY_GROUPS_STORAGE_KEY));
  assert.equal(stored.version, DUMMY_GROUPS_VERSION);
  assert.equal(stored.state.groups.find(group => group.id === added.id).currency, 'EUR');
  assert.deepEqual(Object.keys(stored.state).sort(), ['groups', 'mode']);
  assert.deepEqual([...browserStorage.keys()], [DUMMY_GROUPS_STORAGE_KEY]);
  store.getState().deleteFolder('Admin\\Edited');
  assert.equal(store.getState().groups.length, 9);
});

test('failed mutations are atomic and Dummy/Server mode changes preserve independent examples', () => {
  const store = useDummyGroupsStore;
  store.getState().reset();
  const initial = store.getState();
  assert.throws(() => store.getState().addGroup({ path: initial.groups[0].path }), /already exists/);
  assert.equal(store.getState().groups, initial.groups);
  assert.equal(store.getState().revision, initial.revision);
  store.getState().setMode('server');
  assert.equal(store.getState().mode, 'server');
  assert.equal(store.getState().groups, initial.groups);
  assert.throws(() => store.getState().setMode('live'), /Choose/);
  store.getState().setMode('dummy');
});

test('rehydration restores persisted edits, rejects corrupted shapes, and migrates old versions', async () => {
  const store = useDummyGroupsStore;
  store.getState().reset();
  const group = store.getState().groups[0];
  store.getState().updateGroup(group.id, { currency: 'EUR' });
  const snapshot = browserStorage.get(DUMMY_GROUPS_STORAGE_KEY);
  store.getState().reset();
  browserStorage.set(DUMMY_GROUPS_STORAGE_KEY, snapshot);
  await store.persist.rehydrate();
  assert.equal(store.getState().groups[0].currency, 'EUR');
  browserStorage.set(DUMMY_GROUPS_STORAGE_KEY, JSON.stringify({ state: { groups: [{ path: 'invalid' }] }, version: DUMMY_GROUPS_VERSION }));
  await store.persist.rehydrate();
  assert.equal(store.getState().groups.length, 9);
  browserStorage.set(DUMMY_GROUPS_STORAGE_KEY, JSON.stringify({ state: { groups: [] }, version: 0 }));
  await store.persist.rehydrate();
  assert.equal(store.getState().groups.length, 9);
  assert.equal(store.getState().mode, 'dummy');
});
