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
  explorerBranchNames,
  explorerFolderGroupName,
  listServerGroupContainerPaths,
  loadGroupsExplorerNodes,
  resolveExplorerAccountGroup,
} from './groupsExplorerData.js';

test('server container paths include folders implied by nested names, parents first', () => {
  const groups = ['real\\pro\\vip', 'demo', 'Real'].map(groupName => ({ groupName }));
  // "Real" (a group) and "real" (a folder implied by real\pro\vip) are different paths, so both are listed.
  assert.deepEqual([...listServerGroupContainerPaths(groups)].sort(), ['Real', 'demo', 'real', 'real\\pro', 'real\\pro\\vip']);
  assert.deepEqual(listServerGroupContainerPaths([{ groupName: 'demo' }, { groupName: 'real\\pro' }]), ['demo', 'real', 'real\\pro']);
});

test('case twin groups and folders are separate rows, each owning only its own subgroups', () => {
  const groups = ['Foo', 'foo', 'Foo\\bar', 'foo\\baz', 'foo\\baz\\x'].map(groupName => ({ id: `group:${groupName}`, groupName, label: groupName, group: { name: groupName } }));
  const root = getServerGroupFolderNodes(groups, '');
  assert.deepEqual(root.map(node => node.id).sort(), ['group:Foo', 'group:foo']);
  assert.equal(root.find(node => node.id === 'group:Foo').count, 1);
  assert.equal(root.find(node => node.id === 'group:foo').count, 2);
  assert.deepEqual(root.find(node => node.id === 'group:Foo').group, { name: 'Foo' }, 'the upper-case twin keeps its own record');
  assert.deepEqual(getServerGroupFolderNodes(groups, 'foo').map(node => node.groupName).sort(), ['foo\\baz']);
  assert.deepEqual(getServerGroupFolderNodes(groups, 'Foo').map(node => node.groupName), ['Foo\\bar']);
  assert.equal(getServerGroupCount(groups, 'Foo'), 2, 'the group itself and its subgroup, not the twin "foo"');
  assert.equal(getServerGroupCount(groups, 'FOO'), 0, 'a folder path that differs by case matches nothing');
  const folders = getServerGroupFolderNodes([{ groupName: 'Real\\pro' }, { groupName: 'real\\std' }].map(g => ({ ...g, id: g.groupName, label: g.groupName, group: {} })), '');
  assert.deepEqual(folders.map(node => node.id).sort(), ['server-folder:Real', 'server-folder:real']);
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

test('opening a group picks exactly its own accounts, not case twins or similarly named groups', async () => {
  const accounts = async () => [
    { login: 21, group: 'Orrnn/demo-std' },
    { login: 10, group: 'orrnn/demo-std-vip' },
    { Login: 22, Group: 'ORRNN/DEMO-STD', Balance: 0 },
    { login: 23, group: 'orrnn/demo-std' },
    { login: 24, group: 'Orrnn/demo-std ' },
    { login: 30, group: 'dipannita' },
  ];
  const nodes = await loadGroupsExplorerNodes({ type: 'group', groupName: 'Orrnn/demo-std' }, { getAllAccounts: accounts });
  assert.deepEqual(nodes.map(node => [node.type, node.login, node.groupName]), [['group-account', '21', 'Orrnn/demo-std']]);
  const twin = await loadGroupsExplorerNodes({ type: 'group', groupName: 'orrnn/demo-std' }, { getAllAccounts: accounts });
  assert.deepEqual(twin.map(node => [node.login, node.groupName]), [['23', 'orrnn/demo-std']]);
});

test('a folder listing subgroups and its own accounts uses the mixed columns', () => {
  const nodes = [
    { type: 'group', id: 'group:PREP\\real', label: 'PREP\\real', groupName: 'PREP\\real', group: { currency: 'USD' } },
    { type: 'group-account', id: 'a', label: '7', login: '7', groupName: 'PREP', account: { name: 'Ann', balance: 5 } },
  ];
  assert.deepEqual(getGroupsExplorerColumns({ type: 'server-folder', path: 'PREP' }, nodes).map(column => column.key), ['group', 'name', 'balance', 'currency']);
  assert.deepEqual(getGroupsExplorerColumns({ type: 'server-folder', path: 'PREP' }, nodes.slice(0, 1)).map(column => column.key), ['group', 'risk', 'margin', 'currency']);
});

test('empty responses stay empty and failed API requests remain retryable errors', async () => {
  assert.deepEqual(await loadGroupsExplorerNodes({ type: 'admin' }, { getGroups: async () => ({ groups: [] }) }), []);
  await assert.rejects(loadGroupsExplorerNodes({ type: 'group', groupName: 'demo' }, { getAllAccounts: async () => { throw new Error('Offline'); } }), /Offline/);
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

// Behaviour of the explorer lookups (the component calls these): a case or space twin is never the group clicked.
const twinNodes = ['Foo', 'foo', 'Foo\\bar', 'foo\\baz', 'Bar ', 'Bar'].map(groupName => ({ id: `group:${groupName}`, type: 'group', groupName, label: groupName, group: { name: groupName } }));

test('an opened folder that is itself a group resolves to that exact group, never a case twin', () => {
  assert.equal(explorerFolderGroupName(twinNodes, { type: 'server-folder', path: 'foo' }), 'foo');
  assert.equal(explorerFolderGroupName(twinNodes, { type: 'server-folder', path: 'Foo' }), 'Foo');
  assert.equal(explorerFolderGroupName(twinNodes, { type: 'server-folder', path: 'FOO' }), '', 'no case-folded match');
  assert.equal(explorerFolderGroupName(twinNodes, { type: 'group', groupName: 'Foo' }), '', 'only a folder location names a folder group');
  assert.equal(explorerFolderGroupName([{ groupName: 'Baz' }], { type: 'server-folder', path: 'Baz ' }), '', 'a space twin is no match');
});

test('an account opens exactly its own group record, and a missing record is a synthetic node with the exact name', () => {
  const twinAccount = { login: '7', groupName: 'foo', account: { login: '7', group: 'foo' } };
  assert.equal(resolveExplorerAccountGroup(twinNodes, twinAccount).groupName, 'foo');
  assert.equal(resolveExplorerAccountGroup(twinNodes, twinAccount).group.name, 'foo');
  const padded = { login: '8', account: { login: '8', group: 'Bar ' } };
  assert.equal(resolveExplorerAccountGroup(twinNodes, padded).groupName, 'Bar ', 'the padded name matches its own record');
  const missing = { login: '9', account: { login: '9', group: 'Baz' } };
  const synthetic = resolveExplorerAccountGroup(twinNodes, missing);
  assert.equal(synthetic.groupName, 'Baz', 'no record for Baz: the exact name is kept, no twin record is borrowed');
  assert.equal(synthetic.group.name, 'Baz');
  assert.equal(resolveExplorerAccountGroup(twinNodes, { login: '10', account: { login: '10', group: 'FOO' } }).groupName, 'FOO', 'no case-folded record is borrowed');
  assert.equal(resolveExplorerAccountGroup(twinNodes, { login: '11' }), null, 'no group name at all');
  assert.equal(resolveExplorerAccountGroup(twinNodes, { login: '12' }, 'foo').groupName, 'foo', 'the folder name is the fallback');
});

test('a branch delete names only the group and its own subgroups, never a case twin branch', () => {
  assert.deepEqual(explorerBranchNames(twinNodes, 'Foo'), ['Foo', 'Foo\\bar']);
  assert.deepEqual(explorerBranchNames(twinNodes, 'foo'), ['foo', 'foo\\baz']);
  assert.deepEqual(explorerBranchNames(twinNodes, 'FOO'), []);
  assert.deepEqual(explorerBranchNames(twinNodes, 'Bar'), ['Bar'], 'a space twin is not in the branch');
});
