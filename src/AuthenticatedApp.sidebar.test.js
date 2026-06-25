import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const readSource = (relativePath) => {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, relativePath), 'utf8');
};

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
  assert.match(
    appSource,
    /setServerTargetTab\(getInitialServerTabForLabel\(t\)\);\s*openTab\(t\);/,
    'tab selection must also clear stale server target tab state'
  );
});

test('MainTrade Backup Server restores directly to the Status tab on first render', () => {
  const appSource = readSource('AuthenticatedApp.jsx');

  assert.match(
    appSource,
    /const \[activeTab,\s*setActiveTab\] = useLocalStorage\('rtx5\.activeTab', 'Groups'\);[\s\S]*?const \[serverTargetTab,\s*setServerTargetTab\] = React\.useState\(\(\) => getInitialServerTabForLabel\(activeTab\)\);/,
    'server target tab should be initialized from the restored active tab'
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

test('sidebar selection warns and blocks locked non-working views', () => {
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
    /const isLockedDropdownParent = typeof nodeOrLabel !== 'string' && nodeOrLabel\.lockedDropdown;[\s\S]*?const viewCapabilityToast = getViewCapabilityToast\(label\);[\s\S]*?if \(!isLockedDropdownParent && viewCapabilityToast\) notify\(viewCapabilityToast\);[\s\S]*?if \(shouldBlockViewNavigation\(label\)\) return;/,
    'sidebar text selection should suppress the popup for locked dropdown parent rows'
  );
});

test('tab selection also warns and blocks locked non-working views', () => {
  const appSource = readSource('AuthenticatedApp.jsx');

  assert.match(
    appSource,
    /onSelect=\{\(t\) => \{[\s\S]*?const viewCapabilityToast = getViewCapabilityToast\(t\);[\s\S]*?if \(viewCapabilityToast\) notify\(viewCapabilityToast\);[\s\S]*?if \(shouldBlockViewNavigation\(t\)\) return;[\s\S]*?setServerTargetTab\(getInitialServerTabForLabel\(t\)\);[\s\S]*?openTab\(t\);/,
    'tab selection should share the same locked-view behavior as sidebar selection'
  );
});

test('configured sidebar dropdowns stay locked to parent pages only', () => {
  const appSource = readSource('AuthenticatedApp.jsx');
  const sidebarSource = readSource('components/organisms/SidebarNavTree.jsx');
  const treeItemSource = readSource('components/molecules/TreeItem.jsx');

  assert.match(
    sidebarSource,
    /LOCKED_DROPDOWN_LABELS\s*=\s*new Set\(\['Automations', 'Security', 'Platform Config', 'Risk Management', 'Communications', 'Support Center'\]\)/,
    'Automations, Security, Platform Config, Risk Management, Communications, and Support Center should be locked to parent selection only'
  );
  assert.match(
    sidebarSource,
    /LOCKED_DROPDOWN_LABELS\.has\(newNode\.label\)[\s\S]*?newNode\.lockedDropdown\s*=\s*true;[\s\S]*?newNode\.initiallyExpanded\s*=\s*false;/,
    'locked sidebar nodes should keep a visible chevron but start collapsed'
  );
  assert.match(
    treeItemSource,
    /const showArrow = hasChildren \|\| item\.lockedDropdown;/,
    'locked dropdowns should still render the sidebar chevron'
  );
  assert.match(
    treeItemSource,
    /if \(item\.lockedDropdown\) \{[\s\S]*?onLockedDropdownClick && onLockedDropdownClick\(item\);[\s\S]*?return;[\s\S]*?\}/,
    'clicking a locked dropdown chevron should trigger the popup callback instead of selecting the row'
  );
  assert.match(
    treeItemSource,
    /hasChildren && !item\.lockedDropdown && isOpen/,
    'locked dropdowns must not render their children'
  );
  assert.match(
    sidebarSource,
    /onLockedDropdownClick=\{onLockedDropdownClick\}/,
    'sidebar should pass the locked-dropdown chevron callback into TreeItem'
  );
  assert.match(
    appSource,
    /const handleLockedDropdownClick = \(nodeOrLabel\) => \{[\s\S]*?const viewCapabilityToast = getViewCapabilityToast\(label\);[\s\S]*?if \(viewCapabilityToast\) notify\(viewCapabilityToast\);[\s\S]*?\};/,
    'locked dropdown chevron clicks should show the view capability popup'
  );
});

test('locked sidebar options show a blocked cursor', () => {
  const sidebarSource = readSource('components/organisms/SidebarNavTree.jsx');
  const treeItemSource = readSource('components/molecules/TreeItem.jsx');

  assert.match(
    sidebarSource,
    /import \{ shouldBlockViewNavigation \} from '\.\.\/\.\.\/config\/viewCapabilities';/,
    'sidebar should derive locked cursor state from the central capability map'
  );
  assert.match(
    sidebarSource,
    /newNode\.blockedNavigation\s*=\s*shouldBlockViewNavigation\(newNode\.label\);/,
    'blocked navigation rows should be marked before rendering TreeItem'
  );
  assert.match(
    treeItemSource,
    /const isBlockedNavigation = Boolean\(item\.blockedNavigation\);/,
    'TreeItem should normalize blocked navigation state'
  );
  assert.match(
    treeItemSource,
    /isBlockedNavigation \? 'cursor-not-allowed' : 'cursor-default'/,
    'locked rows should use the blocked cursor'
  );
  assert.match(
    treeItemSource,
    /item\.lockedDropdown \? 'cursor-not-allowed' : 'cursor-default'/,
    'locked dropdown arrows should use the blocked cursor'
  );
});

test('sidebar parent row clicks toggle normal dropdowns but not locked dropdowns', () => {
  const treeItemSource = readSource('components/molecules/TreeItem.jsx');

  assert.match(
    treeItemSource,
    /const handleRowClick = \(\) => \{[\s\S]*?if \(hasChildren && !item\.lockedDropdown\) \{[\s\S]*?setIsOpen\(\(current\) => !current\);[\s\S]*?\}/,
    'clicking a normal parent row should toggle its dropdown'
  );
  assert.match(
    treeItemSource,
    /if \(item\.lockedDropdown && isBlockedNavigation\) \{[\s\S]*?onLockedDropdownClick && onLockedDropdownClick\(item\);[\s\S]*?return;/,
    'clicking a locked blocked parent row should show the lock handler instead of opening children'
  );
  assert.match(
    treeItemSource,
    /onClick=\{handleRowClick\}/,
    'the full sidebar row should use the shared row click handler'
  );
});

test('header data metric is derived from active table rows, not hardcoded', () => {
  const appSource = readSource('AuthenticatedApp.jsx');
  const tableSource = readSource('components/organisms/AdminDataTable.jsx');

  assert.doesNotMatch(appSource, /4482\s*\/\s*8 KB/);
  assert.match(appSource, /const formatBytes = \(value\) => \{/);
  assert.match(appSource, /const activeViewMetricLabel = React\.useMemo\(\(\) => \{/);
  assert.match(appSource, /title="Mounted rows \/ estimated row payload"/);
  assert.match(appSource, /\{activeViewMetricLabel\}/);
  assert.match(tableSource, /const mountedRowBytes = React\.useMemo\(\(\) => estimateJsonBytes\(data\), \[data\]\);/);
  assert.match(tableSource, /visible:\s*data\.length/);
  assert.match(tableSource, /bytes:\s*mountedRowBytes/);
});
