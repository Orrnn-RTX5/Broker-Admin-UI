import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canAccessView, hasPermission, PERMISSION_KEYS } from './utils/permissions.js';
import { getHistoryEntryView, resolveGroupExplorerNode, sameGroupExplorerLocation } from './utils/groupExplorerNavigation.js';

const source = readFileSync(new URL('./AuthenticatedApp.jsx', import.meta.url), 'utf8');

const readHandler = (name) => {
  const match = source.match(new RegExp(`  const ${name} = (?:React\\.useCallback\\()?((?:\\([^)]*\\)) => \\{[\\s\\S]*?\\n  \\})(?:;|, \\[[^\\]]*\\]\\);)`));
  assert.ok(match, `${name} must be present`);
  return `const ${name} = ${match[1]};`;
};

const createHandlers = ({
  activeNode = 'Groups',
  permissions = ['view_groups', 'manage_groups', 'view_accounts', 'edit_accounts'],
  location = resolveGroupExplorerNode('Groups'),
  history = [activeNode],
  currentIndex = 0,
} = {}) => {
  const state = {
    activeNode,
    location,
    reveal: null,
    history: [...history],
    currentIndex,
    searches: { Groups: 'demo', 'Trading Accounts': 'old search' },
    selectedId: 'previous',
    selectedTarget: null,
    editingAccount: null,
    serverTab: 'Status',
    views: [],
    editors: [],
    notices: [],
    capabilityLabels: [],
  };
  const makeBindings = () => ({
    activeNode: state.activeNode,
    groupExplorerLocation: state.location,
    currentIndex: state.currentIndex,
    history: state.history,
    currentUser: { permissions, group_access_mode: 'all_within_broker' },
    canEditAccounts: hasPermission({ permissions }, PERMISSION_KEYS.EDIT_ACCOUNTS),
    canAccessView,
    PERMISSION_KEYS,
    getHistoryEntryView,
    resolveGroupExplorerNode,
    sameGroupExplorerLocation,
    notify: (notice) => state.notices.push(notice),
    setSavedSearches: (update) => { state.searches = update(state.searches); },
    setSelectedSidebarNodeId: (id) => { state.selectedId = id; },
    setSelectedEditTarget: (target) => { state.selectedTarget = target; },
    setGroupExplorerLocation: (next) => { state.location = next; },
    setGroupExplorerReveal: (update) => { state.reveal = update(state.reveal); },
    setEditingAccount: (next) => {
      state.editingAccount = next;
      if (next) state.editors.push(next);
    },
    setServerTargetTab: (tab) => { state.serverTab = tab; },
    setActiveTab: (view) => { state.activeNode = view; state.views.push(view); },
    setHistory: (update) => { state.history = update(state.history); },
    setCurrentIndex: (next) => { state.currentIndex = next; },
    getInitialServerTabForLabel: (label) => label === 'Local Main Status Server' ? 'Status' : null,
    getViewCapabilityToast: (label) => { state.capabilityLabels.push(label); },
    shouldBlockViewNavigation: () => false,
    setIsSuperAdminOpen: () => {},
    setServerPopupData: () => {},
  });
  const create = new Function(...Object.keys(makeBindings()), `
    ${readHandler('openView')}
    ${readHandler('navigateGroupExplorer')}
    ${readHandler('selectGroupAccountNode')}
    ${readHandler('handleNodeSelect')}
    ${readHandler('handleNodeDoubleClick')}
    ${readHandler('openAccountEditor')}
    ${readHandler('restoreHistoryEntry')}
    ${readHandler('handleUndo')}
    ${readHandler('handleRedo')}
    return {
      select: handleNodeSelect,
      doubleClick: handleNodeDoubleClick,
      restore: restoreHistoryEntry,
      undo: handleUndo,
      redo: handleRedo,
    };
  `);
  const dispatch = (name, argument) => create(...Object.values(makeBindings()))[name](argument);
  return {
    select: (value) => dispatch('select', value),
    doubleClick: (value) => dispatch('doubleClick', value),
    restore: (value) => dispatch('restore', value),
    undo: () => dispatch('undo'),
    redo: () => dispatch('redo'),
    state,
  };
};

const account = { id: 990701, login: 990701, group: 'real', raw: { Login: 990701, Group: 'real' } };
const node = { type: 'group-account', id: 'group-account:real:990701', label: '990701', login: 990701, groupName: 'real', account };
const realFolder = { type: 'group', groupName: 'real', label: 'real' };

test('root, Admin, and dynamic group folders use canonical Groups view and reveal the same directory', () => {
  for (const folder of [{ type: 'groups-root' }, { type: 'admin' }, realFolder]) {
    for (const action of ['select', 'doubleClick']) {
      const { state, ...handlers } = createHandlers({ activeNode: 'Trading Accounts' });
      handlers[action](folder);
      const expected = resolveGroupExplorerNode(folder);
      assert.equal(state.activeNode, 'Groups');
      assert.deepEqual(state.location, expected);
      assert.deepEqual(state.reveal, { ...expected, revision: 1 });
      assert.equal(state.selectedId, expected.id);
      assert.equal(state.serverTab, null);
      assert.deepEqual(state.history, ['Trading Accounts', { view: 'Groups', groupExplorerLocation: expected }]);
      assert.deepEqual(state.capabilityLabels, []);
    }
  }
});

test('reserved group labels remain dynamic folders instead of activating unrelated views', () => {
  for (const groupName of ['Groups', 'Admin', 'Trading Accounts', 'Main Trade Server', 'PREP\\contest\\0001']) {
    const { select, state } = createHandlers();
    select({ type: 'group', groupName, label: groupName });
    assert.equal(state.activeNode, 'Groups');
    assert.equal(state.location.groupName, groupName);
    assert.equal(state.selectedId, `group:${groupName}`);
    assert.deepEqual(state.capabilityLabels, []);
  }
});

test('group account selection retains its folder screen and only clears the Groups search', () => {
  const { select, state } = createHandlers();
  select(node);

  assert.equal(state.activeNode, 'Groups');
  assert.deepEqual(state.location, resolveGroupExplorerNode(realFolder));
  assert.deepEqual(state.views, ['Groups']);
  assert.deepEqual(state.searches, { Groups: '', 'Trading Accounts': 'old search' });
  assert.equal(state.selectedId, node.id);
  assert.deepEqual(state.selectedTarget, { type: 'account', row: account, viewType: 'Groups', id: account.id });
  assert.equal(state.serverTab, null);
  assert.deepEqual(state.capabilityLabels, [], 'account login must never become a view label');
});

test('reopening a folder and selecting sibling accounts does not duplicate navigation history', () => {
  const { select, doubleClick, state } = createHandlers();
  select(realFolder);
  const initialHistory = [...state.history];
  doubleClick(realFolder);
  select(node);
  const sibling = { ...node, id: 'account:real:0002', login: '0002', account: { login: '0002', group: 'real' } };
  select(sibling);

  assert.deepEqual(state.history, initialHistory);
  assert.equal(state.selectedId, sibling.id);
  assert.equal(state.reveal.revision, 4);
});

test('group and account view permissions fail closed before changing the visible folder or selection', () => {
  for (const [permissions, required] of [
    [['view_groups', 'manage_groups', 'edit_accounts'], 'view_accounts'],
    [['view_accounts', 'edit_accounts'], 'view_groups'],
    [[], 'view_accounts'],
  ]) {
    for (const action of ['select', 'doubleClick']) {
      const handlers = createHandlers({ permissions });
      handlers[action](node);
      assert.deepEqual(handlers.state.views, []);
      assert.deepEqual(handlers.state.editors, []);
      assert.deepEqual(handlers.state.history, ['Groups']);
      assert.deepEqual(handlers.state.searches, { Groups: 'demo', 'Trading Accounts': 'old search' });
      assert.equal(handlers.state.selectedId, 'previous');
      assert.equal(handlers.state.notices.length, 1);
      assert.ok(handlers.state.notices[0].description.includes(required));
    }
  }
  const denied = createHandlers({ permissions: ['view_accounts'] });
  denied.select(realFolder);
  assert.equal(denied.state.location.type, 'root');
  assert.match(denied.state.notices[0].description, /view_groups/);
});

test('account double-click opens the existing editor over the group directory and retains raw account data', () => {
  const { doubleClick, state } = createHandlers();
  doubleClick(node);

  assert.deepEqual(state.editors, [account]);
  assert.equal(state.editingAccount.raw, account.raw);
  assert.equal(state.activeNode, 'Groups');
  assert.equal(state.location.groupName, 'real');
  assert.deepEqual(state.selectedTarget, { type: 'account', row: account, viewType: 'Groups', id: 990701 });
  const readOnly = createHandlers({ permissions: ['view_groups', 'manage_groups', 'view_accounts'] });
  readOnly.doubleClick(node);
  assert.equal(readOnly.state.activeNode, 'Groups');
  assert.deepEqual(readOnly.state.editors, []);
  assert.match(readOnly.state.notices[0].description, /edit_accounts/);
});

test('Groups menu resets an open group to root while ordinary navigation clears the tree leaf', () => {
  const { select, state } = createHandlers();
  select(node);
  select('Groups');
  assert.deepEqual(state.location, resolveGroupExplorerNode('Groups'));
  assert.equal(state.selectedId, 'groups');
  assert.equal(state.selectedTarget, null);
  assert.equal(state.history.length, 3);
  select('Clients');
  assert.equal(state.activeNode, 'Clients');
  assert.equal(state.selectedId, null);
  assert.deepEqual(state.searches, { Groups: '', 'Trading Accounts': 'old search' });
});

test('Back and Forward restore folder location, selected tree folder and expansion', () => {
  const { select, doubleClick, undo, redo, state } = createHandlers();
  select({ type: 'admin' });
  doubleClick(node);
  assert.equal(state.editingAccount, account);
  undo();
  assert.equal(state.currentIndex, 1);
  assert.equal(state.activeNode, 'Groups');
  assert.deepEqual(state.location, resolveGroupExplorerNode({ type: 'admin' }));
  assert.equal(state.selectedId, 'groups:admin');
  assert.equal(state.selectedTarget, null);
  assert.equal(state.editingAccount, null);
  assert.equal(state.reveal.id, 'groups:admin');
  undo();
  assert.equal(state.currentIndex, 0);
  assert.equal(state.location.type, 'root');
  assert.equal(state.selectedId, 'groups');
  redo();
  redo();
  assert.equal(state.currentIndex, 2);
  assert.equal(state.location.groupName, 'real');
  assert.equal(state.selectedId, 'group:real');
  assert.equal(state.reveal.id, 'group:real');
  assert.equal(state.editingAccount, null);
  assert.equal(state.selectedTarget, null);
});

test('opening a new folder after Back replaces the forward branch and history restores non-group views', () => {
  const { select, undo, redo, restore, state } = createHandlers();
  select({ type: 'admin' });
  select(realFolder);
  undo();
  select({ type: 'group', groupName: 'demo' });
  assert.equal(state.history.length, 3);
  assert.equal(state.history[2].groupExplorerLocation.groupName, 'demo');
  redo();
  assert.equal(state.location.groupName, 'demo');
  restore('Local Main Status Server');
  assert.equal(state.activeNode, 'Local Main Status Server');
  assert.equal(state.serverTab, 'Status');
  assert.equal(state.selectedId, null);
  assert.deepEqual(state.searches, { Groups: '', 'Trading Accounts': 'old search' });
});

test('sidebar receives stable account selection and the shared refresh trigger', () => {
  assert.match(source, /<SidebarNavTree[\s\S]*?selectedNodeId=\{selectedSidebarNodeId\}[\s\S]*?refreshTrigger=\{refreshKey\}/);
});
