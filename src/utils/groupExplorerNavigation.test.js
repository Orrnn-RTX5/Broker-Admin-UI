import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getHistoryEntryView, resolveGroupExplorerNode, sameGroupExplorerLocation } from './groupExplorerNavigation.js';

test('group explorer accepts only explicit navigator folder identities', () => {
  const root = { type: 'root', id: 'groups', label: 'Groups' };
  const admin = { type: 'admin', id: 'groups:admin', label: 'Admin' };
  assert.deepEqual(resolveGroupExplorerNode('Groups'), root);
  assert.deepEqual(resolveGroupExplorerNode({ type: 'groups-root', label: 'Groups' }), root);
  assert.deepEqual(resolveGroupExplorerNode(root), root);
  assert.deepEqual(resolveGroupExplorerNode({ type: 'groups-admin' }), admin);
  assert.deepEqual(resolveGroupExplorerNode(admin), admin);
  for (const node of ['Admin', 'real', 'Trading Accounts', null, undefined, [], {}, { label: 'Groups' }, { type: 'group', label: 'real' }]) {
    assert.equal(resolveGroupExplorerNode(node), null);
  }
});

test('typed groups preserve reserved labels, complete paths, leading zero names and metadata', () => {
  for (const groupName of ['Groups', 'Admin', 'Trading Accounts', 'PREP\\contest\\4540', 'tenant/real/001', '0001']) {
    const group = { name: groupName, currency: 'USD' };
    assert.deepEqual(resolveGroupExplorerNode({ type: 'group', groupName, group }), {
      type: 'group', id: `group:${groupName}`, label: groupName, groupName, group,
    });
  }
});

test('account nodes resolve to their containing group without using login or unrelated labels', () => {
  const expected = { type: 'group', id: 'group:real', label: 'real', groupName: 'real' };
  assert.deepEqual(resolveGroupExplorerNode({ type: 'group-account', groupName: 'real', login: '001' }), expected);
  assert.deepEqual(resolveGroupExplorerNode({ type: 'group-account', account: { Group: 'real', Login: '001' } }), expected);
  assert.deepEqual(resolveGroupExplorerNode({ type: 'group-account', account: { group_name: 'real' } }), expected);
  assert.equal(resolveGroupExplorerNode({ type: 'group-account', label: 'real', login: '001' }), null);
  assert.equal(resolveGroupExplorerNode({ type: 'group-account', account: { Group: {} } }), null);
  assert.equal(resolveGroupExplorerNode({ type: 'group', groupName: false }), null);
});

test('history folder identity ignores changed metadata but distinguishes each navigation level', () => {
  const real = { type: 'group', groupName: 'real', group: { currency: 'USD' } };
  assert.equal(sameGroupExplorerLocation(real, { ...real, group: { currency: 'EUR' } }), true);
  assert.equal(sameGroupExplorerLocation(real, { type: 'group-account', groupName: 'real', login: '001' }), true);
  assert.equal(sameGroupExplorerLocation(real, { type: 'group', groupName: 'demo' }), false);
  assert.equal(sameGroupExplorerLocation(real, { type: 'group', groupName: 'REAL' }), false);
  assert.equal(sameGroupExplorerLocation(null, undefined), true);
  assert.equal(sameGroupExplorerLocation(null, { type: 'root' }), true);
  assert.equal(sameGroupExplorerLocation({ type: 'root' }, { type: 'admin' }), false);
  assert.equal(sameGroupExplorerLocation({ type: 'admin' }, real), false);
});

test('history reader supports legacy string entries and folder-aware entries', () => {
  assert.equal(getHistoryEntryView('Trading Accounts'), 'Trading Accounts');
  assert.equal(getHistoryEntryView({ view: 'Groups', groupExplorerLocation: { type: 'group', groupName: 'real' } }), 'Groups');
  assert.equal(getHistoryEntryView({ view: 'Main Trade Server' }), 'Main Trade Server');
  assert.equal(getHistoryEntryView(null), 'Groups');
  assert.equal(getHistoryEntryView({ view: {} }), 'Groups');
});

test('dummy folders preserve full nested paths and canonicalize user-entered separators', () => {
  const result = resolveGroupExplorerNode({ type: 'dummy-folder', path: ' admin / demo / 0042 ', label: 'wrong', id: 'wrong' });
  assert.deepEqual(result, {
    type: 'dummy-folder', id: 'dummy-folder:Admin\\demo\\0042', label: '0042', path: 'Admin\\demo\\0042',
  });
  assert.deepEqual(resolveGroupExplorerNode(result), result);
  for (const label of ['Groups', 'Trading Accounts', 'Admin']) {
    const folder = resolveGroupExplorerNode({ type: 'dummy-folder', path: `Admin\\${label}` });
    assert.equal(folder.type, 'dummy-folder');
    assert.equal(folder.path, `Admin\\${label}`);
  }
});

test('invalid dummy locations do not enter navigator history', () => {
  for (const path of ['', 'Outside\\demo', 'Admin\\..\\demo', 'Admin\\\\demo', 'Admin\\bad*name', null, {}]) {
    assert.equal(resolveGroupExplorerNode({ type: 'dummy-folder', path }), null);
  }
});

test('dummy folder identity distinguishes parents, siblings and server-data locations', () => {
  const folder = { type: 'dummy-folder', path: 'Admin\\demo\\0042' };
  assert.equal(sameGroupExplorerLocation(folder, { ...folder, label: 'New label', count: 9 }), true);
  assert.equal(sameGroupExplorerLocation(folder, { type: 'dummy-folder', path: 'Admin/demo/0042' }), true);
  assert.equal(sameGroupExplorerLocation(folder, { type: 'dummy-folder', path: 'Admin\\demo' }), false);
  assert.equal(sameGroupExplorerLocation(folder, { type: 'dummy-folder', path: 'Admin\\real\\0042' }), false);
  assert.equal(sameGroupExplorerLocation(folder, { type: 'group', groupName: folder.path }), false);
  assert.equal(sameGroupExplorerLocation({ type: 'dummy-folder', path: 'Admin' }, { type: 'admin' }), false);
  const historyEntry = { view: 'Groups', groupExplorerLocation: resolveGroupExplorerNode(folder) };
  assert.equal(getHistoryEntryView(historyEntry), 'Groups');
  assert.deepEqual(resolveGroupExplorerNode(historyEntry.groupExplorerLocation), resolveGroupExplorerNode(folder));
});
