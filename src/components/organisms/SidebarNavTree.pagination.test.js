import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./SidebarNavTree.jsx', import.meta.url), 'utf8');
const terminalData = readFileSync(new URL('../../data/terminalData.jsx', import.meta.url), 'utf8');
const groupsTree = readFileSync(new URL('./GroupsNavigation.jsx', import.meta.url), 'utf8');

test('sidebar delegates groups to the expandable dynamic hierarchy without a display cap', () => {
  assert.match(src, /newNode\.component = GroupsNavigation/);
  assert.doesNotMatch(src, /SIDEBAR_GROUP_LIMIT|\.slice\(0,/);
  assert.match(groupsTree, /loadGroupTreePages\(\s*ManagerService\.getGroupList/);
  assert.match(groupsTree, /loadGroups, null, \[refreshTrigger\], expanded && canLoadGroups/);
  assert.doesNotMatch(groupsTree, /label: 'Admin'/, 'main groups hang directly off Groups without an Admin folder');
  assert.match(groupsTree, /<ServerFolderChildren[\s\S]*?path=""/);
  assert.match(terminalData, /label:\s*"Groups"[\s\S]*?children:\s*\[\]/);
});

test('Groups sidebar node is collapsed before dynamic group children mount', () => {
  assert.match(src, /newNode\.initiallyExpanded = false/);
  assert.match(
    terminalData,
    /label:\s*"Groups"[\s\S]*?initiallyExpanded:\s*false/
  );
});

test('account lists load only when the Groups tree opens with account permission', () => {
  assert.doesNotMatch(src, /import \{ useAccounts \} from '\.\.\/\.\.\/hooks\/useAccounts';/);
  assert.doesNotMatch(src, /import \{ useInstruments \} from '\.\.\/\.\.\/hooks\/useInstruments';/);
  assert.doesNotMatch(src, /SIDEBAR_COUNT_LIMIT/);
  assert.doesNotMatch(src, /useAccounts\(/);
  assert.doesNotMatch(src, /useInstruments\(/);
  assert.doesNotMatch(src, /getKnownSidebarCount/);
  assert.match(groupsTree, /expanded && canLoadAccounts/);
  assert.match(groupsTree, /canLoadGroups && canAccessView\(currentUser, 'Trading Accounts'\)/);
  assert.match(groupsTree, /AccountsService\.getAllAccounts, null, \[refreshTrigger\], expanded && canLoadAccounts/);
  assert.match(groupsTree, /normalizeNavigationAccounts\(/);
  assert.doesNotMatch(terminalData, /label:\s*"Clients & Accounts"[\s\S]{0,80}count:/);
  assert.doesNotMatch(terminalData, /label:\s*"Symbols"[\s\S]{0,80}count:/);
});

test('unsupported market overview entries do not display static counts', () => {
  assert.doesNotMatch(terminalData, /label:\s*"Mailbox"[\s\S]{0,80}count:/);
});
