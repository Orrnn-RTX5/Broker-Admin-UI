import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';

const src = (path) => readFileSync(resolve(cwd(), path), 'utf8');

test('theme refresh keeps active and semantic colors readable in both themes', () => {
  const tokens = src('src/theme/tokens.css');
  const managerUi = src('src/theme/manager-ui.css');
  const typography = src('src/theme/typography.css');

  assert.match(tokens, /--bg-app:\s*#10151d;/i, 'workspace uses the night canvas');
  assert.match(tokens, /--text-primary:\s*#e7eff9;/i, 'main text is near-white on the dark workspace');
  assert.match(tokens, /--text-secondary:\s*#b8c8d9;/i, 'supporting text is softer than main text');
  assert.match(tokens, /--text-muted:\s*#93a6bb;/i, 'muted text is readable on dark surfaces');
  assert.match(tokens, /--text-placeholder:\s*(?:#93a6bb|var\(--text-muted\));/i, 'placeholders use the muted tone');
  assert.match(tokens, /--ui-font-base:\s*11px;/, 'workspace copy uses the compact manager scale');
  assert.match(typography, /:root:has\(\.admin-workspace\) :is\(\[role="dialog"\]/, 'only signed-in portals share the workspace type scale');
  assert.match(typography, /\.text-white,\s*\[class~="text-\[\#fff\]"\]/, 'legacy white labels follow the foreground token');
  assert.match(tokens, /--accent-500:\s*#2d6cdf;/i, 'accent matches theme blue');

  assert.match(managerUi, /\[data-theme="dark"\]\s*\{[\s\S]*--accent-text:\s*#ffffff;/);
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

test('positive and negative UI states use the reference market colors', () => {
  const tokens = src('src/theme/tokens.css');
  const index = src('src/index.css');
  const managerUi = src('src/theme/manager-ui.css');
  const legacyOverrides = src('src/theme/legacy-overrides.css');
  const marketWatchCss = src('src/components/organisms/MarketWatchDock.css');
  const marketWatch = src('src/components/organisms/MarketWatchDock.jsx');
  const symbolList = src('src/components/organisms/SymbolManagement/SymbolListPage.jsx');
  const symbolsTab = src('src/components/organisms/SymbolManagement/SymbolsTab.jsx');

  // Buy/profit/success is a professional blue everywhere; green is never used.
  assert.ok((tokens.match(/--success-500:\s*#6db3f2;/g) || []).length >= 1);
  assert.doesNotMatch(tokens, /--success-500:\s*(#2ebd59|#4ec9b0)/);
  assert.match(tokens, /--danger-500:\s*#f27d86;/i);
  // Success words are white; the blue stays on arrows, dots and soft backgrounds.
  assert.equal((managerUi.match(/--ok-text:\s*#ffffff;/g) || []).length, 2);
  assert.equal((managerUi.match(/--danger-text:\s*var\(--danger-500\);/g) || []).length, 2);

  assert.match(index, /--color-green-400:\s*var\(--success-500\);/);
  assert.match(index, /--color-emerald-400:\s*var\(--success-500\);/);
  assert.match(index, /--color-red-400:\s*var\(--danger-500\);/);
  assert.match(index, /--color-rose-400:\s*var\(--danger-500\);/);
  assert.match(legacyOverrides, /Semantic color compatibility/);

  assert.match(marketWatchCss, /--mw-success:\s*var\(--success-500\);/);
  assert.match(marketWatchCss, /--mw-danger:\s*var\(--danger-500\);/);
  assert.match(marketWatchCss, /--mw-bg-1:\s*var\(--bg-app\);/);
  assert.match(marketWatchCss, /--mw-accent:\s*var\(--accent-500\);/);
  assert.match(marketWatchCss, /\.quote-up svg\s*\{\s*color:\s*var\(--mw-success\);/);
  assert.match(marketWatchCss, /\.market-quote-up\s*\{\s*color:\s*var\(--mw-success\);/);
  assert.match(marketWatchCss, /\.market-quote-down\s*\{\s*color:\s*var\(--mw-danger\);/);
  assert.match(marketWatch, /quotePriceClass\(quote\?\.bidDir, live\)/);
  assert.match(marketWatch, /quotePriceClass\(quote\?\.askDir, live\)/);
  assert.match(symbolList, /quoteColorClass\(item\.bidDir\)/);
  assert.match(symbolList, /quoteColorClass\(item\.askDir\)/);
  assert.doesNotMatch(symbolsTab, /var\(--success\)/, 'symbol toggles use the defined success token');
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

  assert.match(toolbar, /label="Integrations"\s+onClick=\{\(\) => onNodeSelect\?\.\('Integrations'\)\}/);
  assert.match(toolbar, /onClick=\{onAddClick\}/);
  assert.match(toolbar, /onChange=\{\(e\) => onSearchChange\?\.\(e\.target\.value\)\}/);
  assert.match(sidebar, /newNode\.blockedNavigation\s*=\s*shouldBlockViewNavigation\(newNode\.label\);/);
});
