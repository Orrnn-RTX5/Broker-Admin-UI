// SUI-A3: Window-menu / header entries without a dedicated renderer resolve
// to the existing view that renders their data, so they never fall through
// to the empty group-lookup state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ADMIN_VIEW_ALIASES, resolveAdminViewTarget } from './adminViewAliases.js';

const here = dirname(fileURLToPath(import.meta.url));
const readSource = (relativePath) => readFileSync(join(here, relativePath), 'utf8');

test('SUI-A3: Online Users resolves to the Managers Online tab', () => {
  assert.deepEqual(resolveAdminViewTarget('Online Users'), { view: 'Managers', initialTab: 'Online' });
});

test('SUI-A3: Journal resolves to the main-area journal renderer', () => {
  assert.deepEqual(resolveAdminViewTarget('Journal'), { view: 'Journal', initialTab: undefined });
});

test('SUI-A3: unmapped labels pass through with no preset tab', () => {
  assert.deepEqual(resolveAdminViewTarget('Managers'), { view: 'Managers', initialTab: undefined });
  assert.deepEqual(resolveAdminViewTarget('  Groups  '), { view: 'Groups', initialTab: undefined });
  assert.deepEqual(resolveAdminViewTarget(''), { view: '', initialTab: undefined });
});

test('SUI-A3: alias map stays label-based with no tenant specifics', () => {
  for (const [label, target] of Object.entries(ADMIN_VIEW_ALIASES)) {
    assert.match(label, /^[A-Za-z ]+$/, `alias label must be generic: ${label}`);
    assert.match(target.view, /^[A-Za-z ]+$/, `alias target must be generic: ${target.view}`);
  }
});

test('SUI-A3: selection resolves aliases before gating and opening', () => {
  const appSource = readSource('../AuthenticatedApp.jsx');
  const handlerMatch = appSource.match(/const\s+handleNodeSelect\s*=\s*\(nodeOrLabel\)\s*=>\s*\{[\s\S]*?\n\s{2}\};/);
  assert.ok(handlerMatch, 'expected AuthenticatedApp handleNodeSelect to exist');
  assert.match(
    handlerMatch[0],
    /const viewTarget = resolveAdminViewTarget\(rawLabel\);\s*const label = viewTarget\.view;/,
    'gating, toasts and history must run on the resolved view'
  );
  assert.match(
    handlerMatch[0],
    /setActiveViewInitialTab\(viewTarget\.initialTab\);/,
    'the alias preset tab must reach the target view'
  );
  assert.match(
    appSource,
    /<ManagersView[^>]*initialTab=\{activeViewInitialTab\}/,
    'Managers must receive the alias preset tab'
  );
});

test('SUI-A3: AdminDataTable renders the main-area journal branch', () => {
  const tableSource = readSource('../components/organisms/AdminDataTable.jsx');
  assert.match(
    tableSource,
    /if \(viewType === 'Journal'\) \{\s*return <JournalView \/>;/,
    'Journal must render live data instead of the empty group-lookup state'
  );
});
