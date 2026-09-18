import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('theme refresh keeps active and semantic colors readable in both themes', () => {
  const tokens = src('src/theme/tokens.css');
  const managerUi = src('src/theme/manager-ui.css');

  assert.match(tokens, /--bg-app:\s*#f3f6fa;/, 'light workspace matches manager');
  assert.match(tokens, /--text-primary:\s*#eef3f6;/, 'dark primary text matches manager workspace');
  assert.match(tokens, /--text-secondary:\s*#b2bec8;/, 'dark secondary text matches manager workspace');
  assert.match(tokens, /--accent-500:\s*#4c8df6;/, 'dark accent matches manager');

  assert.match(managerUi, /\[data-theme="dark"\]\s*\{[\s\S]*--accent-text:\s*#a9ccff;/);
  assert.doesNotMatch(managerUi, /--accent-text:\s*var\(--accent-100\)/);
  assert.match(managerUi, /\.ui-badge-primary\s*\{/);
  assert.match(managerUi, /\.ui-badge-warning\s*\{/);
});

test('shared controls use accent focus and stable dense-table layout', () => {
  const input = src('src/components/ui/Input.jsx');
  const select = src('src/components/ui/Select.jsx');
  const button = src('src/components/ui/Button.jsx');
  const table = src('src/components/ui/Table.jsx');
  const managerUi = src('src/theme/manager-ui.css');

  assert.match(input, /focus:border-\[color:var\(--accent-500\)\]/);
  assert.match(select, /focus:border-\[color:var\(--accent-500\)\]/);
  assert.match(button, /focus-visible:ring-\[color:var\(--accent-500\)\]/);
  assert.match(table, /h-\[var\(--row-h\)\]/);
  assert.match(managerUi, /\.ui-grid thead th\s*\{[\s\S]*position:\s*sticky;/);
  assert.match(managerUi, /\.ui-grid tbody td\s*\{[\s\S]*height:\s*var\(--row-h\);/);
});

test('app shell refresh preserves existing navigation and table wiring', () => {
  const app = src('src/AuthenticatedApp.jsx');
  const toolbar = src('src/components/organisms/ActionToolBar.jsx');
  const sidebar = src('src/components/organisms/SidebarNavTree.jsx');

  assert.match(app, /onNodeSelect=\{handleNodeSelect\}/);
  assert.match(app, /onNodeDoubleClick=\{handleNodeDoubleClick\}/);
  assert.match(app, /onLockedDropdownClick=\{handleLockedDropdownClick\}/);
  assert.match(app, /onAddClick=\{handleAddClick\}/);
  assert.match(app, /onSearchChange=\{setSearchQuery\}/);
  assert.match(app, /onEditableTargetSelect=\{handleEditableTargetSelect\}/);

  assert.match(toolbar, /label="Refresh"\s+onClick=\{onRefresh\}/);
  assert.match(toolbar, /onClick=\{onAddClick\}/);
  assert.match(toolbar, /onChange=\{\(e\) => onSearchChange\?\.\(e\.target\.value\)\}/);
  assert.match(sidebar, /newNode\.blockedNavigation\s*=\s*shouldBlockViewNavigation\(newNode\.label\);/);
});
