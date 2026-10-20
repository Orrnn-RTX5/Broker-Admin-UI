import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getHistoryEntryView, resolveGroupExplorerNode, sameGroupExplorerLocation, retireGroupHistory } from './groupExplorerNavigation.js';

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

test('SUI-A10: retired dummy-folder nodes never enter navigator history', () => {
  // The local-only dummy-groups surface was removed; its node type is unknown
  // and must resolve to null like any other unrecognized shape.
  for (const node of [
    { type: 'dummy-folder', path: ' admin / demo / 0042 ', label: 'wrong', id: 'wrong' },
    { type: 'dummy-folder', path: 'Admin\\demo\\0042' },
    { type: 'dummy-folder', path: 'Outside\\demo' },
    { type: 'dummy-folder', path: '' },
    { type: 'dummy-folder', path: null },
  ]) {
    assert.equal(resolveGroupExplorerNode(node), null);
  }
});

test('server folders resolve from their group-name prefix and keep identity by path', () => {
  const folder = resolveGroupExplorerNode({ type: 'server-folder', path: 'real\\pro', label: 'wrong', id: 'wrong' });
  assert.deepEqual(folder, { type: 'server-folder', id: 'server-folder:real\\pro', label: 'pro', path: 'real\\pro' });
  assert.deepEqual(resolveGroupExplorerNode(folder), folder);
  assert.equal(resolveGroupExplorerNode({ type: 'server-folder', path: '  ' }), null);
  assert.equal(sameGroupExplorerLocation(folder, { ...folder, count: 3 }), true);
  assert.equal(sameGroupExplorerLocation(folder, { type: 'server-folder', path: 'real' }), false);
  assert.equal(sameGroupExplorerLocation(folder, { type: 'group', groupName: 'real\\pro' }), false);
});

test('SUI-A10: retired dummy locations fall back to the Groups root, never a device-only folder', () => {
  const folder = { type: 'dummy-folder', path: 'Admin\\demo\\0042' };
  assert.equal(sameGroupExplorerLocation(folder, { ...folder, label: 'New label', count: 9 }), true);
  assert.equal(sameGroupExplorerLocation(folder, { type: 'root' }), true);
  assert.equal(sameGroupExplorerLocation({ type: 'dummy-folder', path: 'Admin' }, { type: 'admin' }), false);
  const historyEntry = { view: 'Groups', groupExplorerLocation: { type: 'group', groupName: 'real\\new' } };
  assert.equal(getHistoryEntryView(historyEntry), 'Groups');
});

test('retired source folders leave history and selection targeting the exact destination', () => {
 const old={view:'Groups',groupExplorerLocation:resolveGroupExplorerNode({type:'group',groupName:'real\\old'})};
 const unrelated={view:'Groups',groupExplorerLocation:resolveGroupExplorerNode({type:'group',groupName:'real\\OLD'})};
 const history=['Trading Accounts',old,unrelated];
 const next=retireGroupHistory(history,'real\\old','real\\new');
 assert.equal(next[1].groupExplorerLocation.groupName,'real\\new');
 assert.strictEqual(next[2],unrelated);assert.strictEqual(next[0],history[0]);
 assert.equal(old.groupExplorerLocation.groupName,'real\\old');
 assert.equal(retireGroupHistory(history,'real\\old','')[1].groupExplorerLocation.type,'root');
});
