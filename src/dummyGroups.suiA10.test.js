import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const path = (relativePath) => join(here, relativePath);
const readSource = (relativePath) => readFileSync(path(relativePath), 'utf8');

// SUI-A10: the "Admin" dummy groups lived only in localStorage and were never
// sent to the backend. The dummy surface was unreachable dead code (no route,
// nav entry, or import rendered it), so the fix removes it instead of wiring
// new backend writes. These tests lock the removal and prove the live Groups
// surface (GroupsExplorer + real GroupCreate/GroupUpdate flows) is untouched.

test('SUI-A10: dummy-groups modules, store, components and stale doc are gone', () => {
  for (const removed of [
    'utils/dummyGroups.js',
    'utils/dummyGroups.test.js',
    'store/useDummyGroupsStore.js',
    'store/useDummyGroupsStore.test.js',
    'components/organisms/DummyGroupsExplorer.jsx',
    'components/organisms/DummyGroupsNavigation.jsx',
    'components/RIGHTCLICKJPOPUPS/DummyGroupPropertiesPopup.jsx',
    'components/RIGHTCLICKJPOPUPS/DummyGroupPropertiesPopup.css',
    'components/RIGHTCLICKJPOPUPS/DummySymbolList.jsx',
    'components/RIGHTCLICKJPOPUPS/DummySymbolList.css',
    '../docs/groups-dummy-workspace.md',
  ]) {
    assert.equal(existsSync(path(removed)), false, `${removed} must not exist`);
  }
});

test('SUI-A10: no live module imports or renders the dummy surface', () => {
  for (const live of [
    'AuthenticatedApp.jsx',
    'utils/groupExplorerNavigation.js',
    'components/molecules/TreeItem.jsx',
    'components/organisms/SidebarNavTree.jsx',
    'components/organisms/GroupsNavigation.jsx',
    'components/organisms/GroupsExplorer.jsx',
  ]) {
    const source = readSource(live);
    for (const identifier of [
      'useDummyGroupsStore',
      'dummyGroups.js',
      'DummyGroupsNavigation',
      'DummyGroupPropertiesPopup',
      'DummySymbolList',
      'dummyGroupsRef',
      'dummyActionsRef',
      'isDummy',
      'dummy-folder',
    ]) {
      assert.equal(source.includes(identifier), false, `${live} must not reference ${identifier}`);
    }
    // The shared DummyGroupsExplorer.css stylesheet keeps its name because
    // the live explorer renders on those classes — but no JS module may be
    // imported from the deleted component.
    assert.doesNotMatch(
      source,
      /from\s+['"]\.\/DummyGroupsExplorer(\.jsx)?['"]/,
      `${live} must not import the deleted DummyGroupsExplorer module`
    );
  }
  assert.equal(readSource('AuthenticatedApp.jsx').includes('dgp-modal'), false, 'dummy dialog selector must not linger in AuthenticatedApp');
});

test('SUI-A10: stale device-only dummy key is cleaned up on launch', () => {
  assert.match(
    readSource('AuthenticatedApp.jsx'),
    /localStorage\.removeItem\('rtx5-admin-dummy-groups-v1'\)/,
    'launch must drop the removed store\u2019s persisted key',
  );
});

test('SUI-A10: live Groups explorer keeps its server-backed wiring', () => {
  const explorer = readSource('components/organisms/GroupsExplorer.jsx');
  assert.match(explorer, /onGroupCreate/, 'Add-group flow must stay wired');
  assert.match(explorer, /onGroupDelete/, 'Delete-group flow must stay wired');
  assert.match(explorer, /onGroupEdit/, 'Edit-group flow must stay wired');
  assert.match(explorer, /loadGroupList/, 'explorer must keep loading the server group list');
  assert.match(explorer, /ManagerService\.getGroupList/, 'groups must come from the backend service');
  assert.match(explorer, /AccountsService\.getAllAccounts/, 'accounts must come from the backend service');
  // The shared stylesheet keeps its name because the live explorer (including
  // its Add-subgroup dialog) renders on those classes; only the dead dummy
  // component that gave the file its name is gone.
  assert.equal(existsSync(path('components/organisms/DummyGroupsExplorer.css')), true, 'shared live stylesheet must stay');
  assert.match(explorer, /import '\.\/DummyGroupsExplorer\.css'/, 'live explorer keeps its stylesheet import');
});

test('SUI-A10: live GroupCreate/GroupUpdate flows stay mounted', () => {
  for (const popup of [
    'components/RIGHTCLICKJPOPUPS/CreateGroupPopup.jsx',
    'components/RIGHTCLICKJPOPUPS/GroupPropertiesPopup.jsx',
  ]) {
    assert.equal(existsSync(path(popup)), true, `${popup} must stay`);
  }
  const app = readSource('AuthenticatedApp.jsx');
  assert.match(app, /<GroupsExplorer/, 'Groups view must keep rendering the live explorer');
  assert.match(app, /CreateGroupPopup/, 'real GroupCreate popup must stay mounted');
  assert.match(app, /onCreated=\{\(\) => setRefreshKey/, 'created groups must still refresh the workspace');
  assert.match(app, /GroupPropertiesPopup/, 'real GroupUpdate popup must stay mounted');
  assert.match(app, /onSaved=\{handleGroupSaved\}/, 'saved groups must still refresh membership');
});

test('SUI-A10: sidebar Groups entry keeps the live server navigation', () => {
  const sidebar = readSource('components/organisms/SidebarNavTree.jsx');
  assert.match(sidebar, /import GroupsNavigation from '\.\/GroupsNavigation'/, 'sidebar must use the live navigation');
  assert.match(sidebar, /newNode\.component = GroupsNavigation;/, 'Groups node must mount the live navigation');
  assert.equal(existsSync(path('components/organisms/GroupsNavigation.jsx')), true, 'live GroupsNavigation must stay');
});
