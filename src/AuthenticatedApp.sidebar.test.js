import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const readSource = (relativePath) => {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, relativePath), 'utf8');
};

test('Downstream access is a sidebar view next to Gateways and dispatches to the Admin-only view', () => {
  const navSource = readSource('data/terminalData.jsx');
  const tableSource = readSource('components/organisms/AdminDataTable.jsx');
  const permissionSource = readSource('utils/permissions.js');

  assert.match(navSource, /\{ label: "Gateways", icon: Link \},\s*\{ label: "Downstream access", icon: Network \},/);
  assert.match(tableSource, /const DownstreamAccessView = lazy\(\(\) => import\('\.\/DownstreamAccessView'\)\);/);
  assert.match(tableSource, /'Gateways',\s*'Downstream access',\s*'Feed Tenants',\s*\]\);/);
  assert.match(tableSource, /if \(viewType === 'Downstream access'\) \{\s*return \(\s*<div className="flex-1 min-h-0 flex flex-col overflow-hidden">\s*<DownstreamAccessView \/>/);
  assert.match(permissionSource, /'Downstream access': ADMIN_ONLY_VIEW,/);
  assert.equal((navSource.match(/Downstream access/g) || []).length, 1);
});

test('Local Main Status Server opens its own server status view', () => {
  const appSource = readSource('AuthenticatedApp.jsx');
  const tableSource = readSource('components/organisms/AdminDataTable.jsx');
  const handlerMatch = appSource.match(/const\s+handleNodeSelect\s*=\s*\(nodeOrLabel\)\s*=>\s*\{[\s\S]*?\n\s{2}\};/);

  assert.ok(handlerMatch, 'expected AuthenticatedApp handleNodeSelect to exist');
  assert.doesNotMatch(
    handlerMatch[0],
    /label\s*=\s*['"]Main Trade Server['"]/,
    'Local Main Status Server must not be rewritten to Main Trade Server'
  );
  assert.match(
    tableSource,
    /'Local Main Status Server'/,
    'AdminDataTable must keep Local Main Status Server as a server status view'
  );
});

test('Main Trade Server selection clears stale server-status target tab', () => {
  const appSource = readSource('AuthenticatedApp.jsx');

  assert.match(
    appSource,
    /const getInitialServerTabForLabel = \(label\) => \([\s\S]*?MainTrade Backup Server[\s\S]*?Local Main Status Server[\s\S]*?Local Main Backup Server[\s\S]*?\? 'Status'[\s\S]*?: null[\s\S]*?\);/,
    'backup and local status server nodes should force the Status tab'
  );
  assert.match(
    appSource,
    /setServerTargetTab\(getInitialServerTabForLabel\(label\)\);/,
    'sidebar selection must recalculate the server target tab for every server label'
  );
});

test('initial server target tab follows the default workspace view', () => {
  const appSource = readSource('AuthenticatedApp.jsx');

  assert.match(
    appSource,
    /const \[activeTab,\s*setActiveTab\] = React\.useState\(defaultLandingView\);[\s\S]*?const \[serverTargetTab,\s*setServerTargetTab\] = React\.useState\(\(\) => getInitialServerTabForLabel\(activeTab\)\);/,
    'server target tab should be initialized from the default active tab'
  );
});

test('Server status panel remounts when the server changes', () => {
  const tableSource = readSource('components/organisms/AdminDataTable.jsx');

  assert.match(
    tableSource,
    /<ServerStatusPanel key=\{viewType\} serverName=\{viewType\}/,
    'changing Main Trade Server versus Access Server must remount the server panel instead of reusing stale state'
  );
});

test('sidebar selection warns and blocks views the session cannot reach', () => {
  const appSource = readSource('AuthenticatedApp.jsx');
  const handlerMatch = appSource.match(/const\s+handleNodeSelect\s*=\s*\(nodeOrLabel\)\s*=>\s*\{[\s\S]*?\n\s{2}\};/);

  assert.ok(handlerMatch, 'expected AuthenticatedApp handleNodeSelect to exist');
  assert.match(
    appSource,
    /import \{ getViewCapabilityToast, shouldBlockViewNavigation \} from '\.\/config\/viewCapabilities';/,
    'selection handlers must use the central view capability map'
  );
  assert.match(
    handlerMatch[0],
    /const isLockedDropdownParent = typeof nodeOrLabel !== 'string' && nodeOrLabel\.lockedDropdown;[\s\S]*?const blockedForSession = shouldBlockViewNavigation\(label, currentUser\);[\s\S]*?if \(blockedForSession\) return;/,
    'sidebar selection gates on session capabilities and stays silent for still-locked dropdown parents'
  );
});

test('unavailable sidebar entries remain visible and cannot activate', () => {
  const sidebarSource = readSource('components/organisms/SidebarNavTree.jsx');
  const treeItemSource = readSource('components/molecules/TreeItem.jsx');

  assert.match(sidebarSource, /newNode\.blockedNavigation\s*=\s*shouldBlockViewNavigation\(newNode\.label,\s*user\);/);
  assert.match(sidebarSource, /newNode\.lockedDropdown\s*=\s*isDropdownLockedForSession\(newNode,\s*user\);/, 'folders lock only while the session reaches nothing inside');
  assert.match(treeItemSource, /const showArrow = hasChildren \|\| item\.lockedDropdown;/);
  assert.match(treeItemSource, /Boolean\(item\.blockedNavigation \|\| item\.lockedDropdown \|\| item\.disabled\)/);
  assert.match(treeItemSource, /const handleArrowClick = \(e\) => \{\s*e\.stopPropagation\(\);\s*if \(isBlockedNavigation\) return;/);
  assert.match(treeItemSource, /const handleRowClick = \(\) => \{\s*if \(isBlockedNavigation\) return;/);
  assert.match(treeItemSource, /const handleRowDoubleClick = \(\) => \{\s*if \(isBlockedNavigation\) return;/);
  assert.match(treeItemSource, /onDoubleClick=\{handleRowDoubleClick\}/);
  assert.match(treeItemSource, /disabled=\{isBlockedNavigation \|\| !hasChildren\}/);
  assert.match(treeItemSource, /aria-disabled=\{isBlockedNavigation \|\| undefined\}/);
  assert.match(treeItemSource, /isBlockedNavigation \? 'cursor-not-allowed'/);
  assert.doesNotMatch(treeItemSource, /cursor-not-allowed opacity-50/, 'locked labels stay white; the lock icon marks them');
  assert.match(treeItemSource, /isBlockedNavigation && <LockKeyhole/);
  assert.doesNotMatch(treeItemSource, /onLockedDropdownClick/);
});

test('available sidebar folders still expand and select', () => {
  const treeItemSource = readSource('components/molecules/TreeItem.jsx');
  assert.match(treeItemSource, /if \(hasChildren && !item\.lockedDropdown\) \{\s*if \(isGroupFolder\) setOpen\(true\);\s*else toggleOpen\(\);/);
  assert.match(treeItemSource, /setExpansion\(previous => \(\{[^\n]*open: next[^\n]*\}\)\);\s*onExpandedChange\?\.\(next\);/);
  assert.match(treeItemSource, /onSelect && onSelect\(item\)/);
  assert.match(treeItemSource, /hasChildren && !item\.lockedDropdown && \(isOpen \|\| expansion\.hasOpened\)/);
  assert.match(treeItemSource, /hidden=\{!isOpen\}/);
});
test('header omits mounted row payload metric badge', () => {
  const appSource = readSource('AuthenticatedApp.jsx');
  const tableSource = readSource('components/organisms/AdminDataTable.jsx');

  assert.doesNotMatch(appSource, /4482\s*\/\s*8 KB/);
  assert.doesNotMatch(appSource, /const formatBytes = \(value\) => \{/);
  assert.doesNotMatch(appSource, /const activeViewMetricLabel = React\.useMemo\(\(\) => \{/);
  assert.doesNotMatch(appSource, /title="Mounted rows \/ estimated row payload"/);
  assert.doesNotMatch(appSource, /\{activeViewMetricLabel\}/);
  assert.match(tableSource, /const mountedRowBytes = React\.useMemo\(\(\) => estimateJsonBytes\(data\), \[data\]\);/);
  assert.match(tableSource, /visible:\s*data\.length/);
  assert.match(tableSource, /bytes:\s*mountedRowBytes/);
});
