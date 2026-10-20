import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./AdminContextMenu.jsx', import.meta.url), 'utf8');
const explorerSrc = readFileSync(new URL('./GroupsExplorer.jsx', import.meta.url), 'utf8');

test('SUI-A7: entries without a handler render disabled with a reason, never silent no-ops', () => {
  assert.match(src, /ADMIN_MENU_UNAVAILABLE_REASON = 'This action is not available in this workspace\.'/);
  assert.match(src, /const isDisabled = Boolean\(disabled \|\| !onClick\)/);
  assert.match(src, /if \(isDisabled\) \{\s*return;/s);
  assert.match(src, /aria-disabled=\{isDisabled\}/);
  assert.match(src, /title=\{isDisabled \? \(disabledReason \|\| ADMIN_MENU_UNAVAILABLE_REASON\) : undefined\}/);
  // Spot-check handler-less definitions: no onClick anywhere on these rows.
  for (const label of ['Move Up', 'Sort Alphabetically', 'Export to File', 'Find', 'Columns']) {
    const row = src.split('\n').find((line) => line.includes(`label="${label}"`));
    assert.ok(row, `${label} definition exists`);
    assert.doesNotMatch(row, /onClick=\{/, `${label} has no click handler`);
  }
});

test('SUI-A7: Add/Edit/Delete stay wired to caller handlers with honest gating', () => {
  assert.match(src, /label="Add"[^>]*onClick=\{onAdd\}/);
  assert.match(src, /label="Edit"[^>]*onClick=\{selectedRow && onEdit \? onEdit : null\}/);
  assert.match(src, /label="Delete"[^>]*onClick=\{selectedRow && onDelete \? onDelete : null\}/);
  assert.match(src, /ADMIN_MENU_NO_ROW_REASON = 'Select a group row first\.'/);
  assert.match(src, /ADMIN_MENU_ADD_UNAVAILABLE_REASON/);
  assert.match(src, /ADMIN_MENU_DELETE_UNAVAILABLE_REASON/);
});

test('SUI-A7: the Groups view renders AdminContextMenu for group rows with existing definitions', () => {
  assert.match(explorerSrc, /import AdminContextMenu from '\.\/AdminContextMenu';/);
  assert.match(explorerSrc, /const \[adminMenu, setAdminMenu\] = useState\(null\)/);
  // Group rows go to the shared menu; folder/account rows keep the radix menu.
  assert.match(explorerSrc, /if \(node\.type === 'group'\) \{\s*event\.preventDefault\(\);\s*setMenuNode\(null\);\s*setAdminMenu\(/s);
  assert.match(explorerSrc, /<AdminContextMenu/);
  assert.match(explorerSrc, /selectedRow=\{adminMenu\.node\.group \?\? adminMenu\.node\}/);
  assert.match(explorerSrc, /onAdd=\{canLifecycle \? \(\) => addGroup\(containerOf\(adminMenu\.node\)\) : undefined\}/);
  assert.match(explorerSrc, /onEdit=\{adminMenu\.node\.group\?\._allocationSummary \? undefined : \(\) => openSettings\(adminMenu\.node\)\}/);
  assert.match(explorerSrc, /onDelete=\{canDelete\(adminMenu\.node\) && !deleting \? \(\) => deleteGroup\(adminMenu\.node\) : undefined\}/);
  assert.match(explorerSrc, /onClose=\{\(\) => setAdminMenu\(null\)\}/);
});
