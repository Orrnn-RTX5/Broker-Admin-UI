import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GROUPS_ADMIN_NODE,
  filterGroupsExplorerNodes,
  getGroupsExplorerColumns,
  getGroupsExplorerEditTarget,
  getGroupsExplorerRow,
  getServerGroupCount,
  getServerGroupFolderNodes,
  getServerGroupParentPath,
  listServerGroupContainerPaths,
  loadGroupsExplorerNodes,
} from './groupsExplorerData.js';

test('server container paths include folders implied by nested names, parents first', () => {
  const groups = ['real\\pro\\vip', 'demo', 'Real'].map(groupName => ({ groupName }));
  assert.deepEqual(listServerGroupContainerPaths(groups), ['demo', 'Real', 'real\\pro', 'real\\pro\\vip']);
});

test('server group names nest into folders on backslashes and a group owns the folder of its own name', () => {
  const groups = ['demo', 'real\\pro', 'real\\std', 'real', 'test\\a\\b'].map(groupName => ({ id: `group:${groupName}`, groupName, label: groupName, group: {} }));
  assert.deepEqual(getServerGroupFolderNodes(groups, '').map(node => [node.type, node.label, node.count]), [
    ['server-folder', 'test', 1], ['group', 'demo', 0], ['group', 'real', 2],
  ]);
  const real = getServerGroupFolderNodes(groups, '').find(node => node.label === 'real');
  assert.equal(real.id, 'group:real', 'the merged row keeps the group identity');
  assert.deepEqual(real.group, {}, 'the merged row keeps the group record for Settings');
  assert.deepEqual(getServerGroupFolderNodes(groups, 'real').map(node => [node.type, node.groupName]), [['group', 'real\\pro'], ['group', 'real\\std']]);
  assert.deepEqual(getServerGroupFolderNodes(groups, 'test').map(node => [node.type, node.path, node.id]), [['server-folder', 'test\\a', 'server-folder:test\\a']]);
  assert.equal(getServerGroupCount(groups, 'real'), 3);
  assert.equal(getServerGroupCount(groups), 5);
  assert.equal(getServerGroupParentPath('test\\a\\b'), 'test\\a');
  assert.equal(getServerGroupParentPath('demo'), '');
});

test('Groups root displays the organizational Admin folder without fetching accounts', async () => {
  const nodes = await loadGroupsExplorerNodes({ type: 'root' }, {
    getGroups: () => assert.fail('root does not need group records'),
    getAccounts: () => assert.fail('root does not need account records'),
  });
  assert.deepEqual(nodes, [GROUPS_ADMIN_NODE]);
  assert.equal(getGroupsExplorerEditTarget(nodes[0]), null);
});

test('Admin lists all API pages as group folders without fixed names or row limits', async () => {
  const requested = [];
  const nodes = await loadGroupsExplorerNodes({ type: 'admin' }, {
    getGroups: async params => {
      requested.push(params);
      return params.page === 1
        ? { groups: [{ name: 'contest' }, { name: 'live' }], total: 3 }
        : { groups: [{ Name: 'custom vip' }], total: 3 };
    },
  });
  assert.deepEqual(nodes.map(node => [node.type, node.groupName]), [['group', 'contest'], ['group', 'custom vip'], ['group', 'live']]);
  assert.deepEqual(requested.map(({ page, limit }) => [page, limit]), [[1, 100], [2, 2]]);
});

test('opening a group fetches all its pages and excludes accounts from similarly named groups', async () => {
  const calls = [];
  const nodes = await loadGroupsExplorerNodes({ type: 'group', groupName: 'real' }, {
    getAccounts: async params => {
      calls.push(params);
      return params.page === 1
        ? { accounts: [{ login: 21, group: 'real' }, { login: 10, group: 'real-vip' }], total: 3 }
        : { accounts: [{ Login: 22, Group: 'REAL', Balance: 0 }], total: 3 };
    },
  });
  assert.deepEqual(nodes.map(node => [node.type, node.login]), [['group-account', '21'], ['group-account', '22']]);
  assert.ok(calls.every(call => call.group === 'real'));
  assert.deepEqual(calls.map(call => call.page), [1, 2]);
});

test('empty responses stay empty and failed API requests remain retryable errors', async () => {
  assert.deepEqual(await loadGroupsExplorerNodes({ type: 'admin' }, { getGroups: async () => ({ groups: [] }) }), []);
  await assert.rejects(loadGroupsExplorerNodes({ type: 'group', groupName: 'demo' }, { getAccounts: async () => { throw new Error('Offline'); } }), /Offline/);
});

test('display fields use API values and do not manufacture margin or currency defaults', () => {
  assert.deepEqual(getGroupsExplorerRow({ type: 'group', label: 'custom', group: { executionMode: 'hedged', marginCallLevel: 0, stopOutLevel: 25, currency: 'EUR' } }), { group: 'custom', risk: 'hedged', margin: '0% / 25%', currency: 'EUR' });
  assert.deepEqual(getGroupsExplorerRow(GROUPS_ADMIN_NODE), { group: 'Admin', risk: '', margin: '', currency: '' });
});

test('account columns follow the supplied records and retain zero-valued financial fields', () => {
  const nodes = [{ type: 'group-account', login: '12', label: '12', groupName: 'custom', account: { Login: 12, Group: 'custom', Balance: 0, Currency: 'GBP' } }];
  assert.deepEqual(getGroupsExplorerColumns({ type: 'group' }, nodes).map(column => column.key), ['login', 'group', 'balance', 'currency']);
  assert.deepEqual(getGroupsExplorerColumns({ type: 'group' }, []).map(column => column.key), ['login']);
  assert.equal(getGroupsExplorerRow(nodes[0]).balance, 0);
});

test('search and sort use real names and numeric logins without changing the source list', () => {
  const nodes = [2, 10, 1].map(login => ({ type: 'group-account', label: String(login), login: String(login), groupName: 'demo', account: { name: login === 10 ? 'Zoe' : 'Ada' } }));
  assert.deepEqual(filterGroupsExplorerNodes(nodes).map(node => node.login), ['1', '2', '10']);
  assert.deepEqual(filterGroupsExplorerNodes(nodes, '', 'desc').map(node => node.login), ['10', '2', '1']);
  assert.deepEqual(filterGroupsExplorerNodes(nodes, 'zoe').map(node => node.login), ['10']);
  assert.deepEqual(nodes.map(node => node.login), ['2', '10', '1']);
});

test('edit targets preserve live records for existing group and account editors', () => {
  const group = { Name: 'real', marginCallLevel: 75 };
  const target = getGroupsExplorerEditTarget({ type: 'group', groupName: 'real', group });
  assert.deepEqual(target, { type: 'group', id: 'real', viewType: 'Groups', row: { Name: 'real', marginCallLevel: 75, name: 'real', group: 'real' } });
  const account = { id: 5, login: '22', group: 'real', raw: { Login: 22 } };
  assert.deepEqual(getGroupsExplorerEditTarget({ type: 'group-account', login: '22', account }), { type: 'account', row: account, id: 5, viewType: 'Groups' });
});
