import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const readSource = (relativePath) => readFileSync(join(here, relativePath), 'utf8');

test('SUI-A4/A5: sidebar lock flags are session-aware, not hardcoded', () => {
  const sidebarSource = readSource('components/organisms/SidebarNavTree.jsx');

  assert.match(
    sidebarSource,
    /newNode\.blockedNavigation\s*=\s*shouldBlockViewNavigation\(newNode\.label,\s*user\);/,
    'leaf lock must follow the session user'
  );
  assert.match(
    sidebarSource,
    /hasReachableViewInSubtree/,
    'locked folders must consult reachable session views before locking'
  );
  assert.match(
    sidebarSource,
    /newNode\.lockedDropdown\s*=\s*isDropdownLockedForSession\(newNode,\s*user\);/,
    'folders lock only while the session reaches nothing inside'
  );
  assert.match(
    sidebarSource,
    /\}, \[user\]\);/,
    'sidebar lock flags must recompute when the session changes'
  );
});

test('SUI-A4/A5: selection gates on session capabilities and hides stale locked toasts', () => {
  const appSource = readSource('AuthenticatedApp.jsx');
  const handlerMatch = appSource.match(/const\s+handleNodeSelect\s*=\s*\(nodeOrLabel\)\s*=>\s*\{[\s\S]*?\n\s{2}\};/);
  assert.ok(handlerMatch, 'expected AuthenticatedApp handleNodeSelect to exist');

  assert.match(
    handlerMatch[0],
    /const blockedForSession = shouldBlockViewNavigation\(label, currentUser\);/,
    'selection must gate on the session user, not the static map alone'
  );
  assert.match(
    handlerMatch[0],
    /if \(blockedForSession\) return;/,
    'sessions without the capability must stay blocked'
  );
  assert.match(
    handlerMatch[0],
    /\(blockedForSession \|\| !staticallyBlocked\)/,
    'views unlocked by the session must not show a stale "locked" toast'
  );
  assert.match(
    appSource,
    /<SidebarNavTree\s*user=\{currentUser\}/,
    'the sidebar must receive the session user'
  );
});
