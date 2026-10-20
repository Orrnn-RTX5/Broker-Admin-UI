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
  const dark = tokens.match(/:root,\s*\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/)?.[1];
  const light = tokens.match(/\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/)?.[1];

  assert.ok(dark && light, 'light and dark each define their own palette');
  assert.match(dark, /--bg-app:\s*#000000;/i, 'dark workspace uses a black canvas');
  assert.match(dark, /--text-primary:\s*#e4e4e4;/i, 'main text is readable on dark surfaces');
  assert.match(dark, /--text-secondary:\s*#c7c7c7;/i, 'supporting text is softer than main text');
  assert.match(dark, /--text-muted:\s*#b2b2b2;/i, 'muted text remains visible');
  assert.match(dark, /--text-placeholder:\s*#8b8b8b;/i, 'placeholders remain distinct');
  assert.match(light, /--bg-app:\s*#f3f6fa;/i, 'light theme has a light canvas');
  assert.match(light, /--text-primary:\s*#172033;/i, 'light theme has dark text');
  assert.match(light, /color-scheme:\s*light;/);
  assert.match(tokens, /--ui-font-base:\s*11px;/, 'workspace copy uses the compact manager scale');
  assert.match(typography, /:root:has\(\.admin-workspace\) :is\(\[role="dialog"\]/, 'only signed-in portals share the workspace type scale');
  assert.match(typography, /\.text-white,\s*\[class~="text-\[#fff\]"\]/, 'legacy white labels follow the foreground token');
  assert.match(dark, /--accent-500:\s*#0075c2;/i, 'accent matches manager blue');
  assert.match(dark, /--success-500:\s*#8fbd9d;/i, 'connected status is green');
  assert.match(dark, /--market-profit:\s*#4a95e0;/i, 'market profit uses readable dark blue');
  assert.match(dark, /--market-loss:\s*#f06464;/i, 'market loss uses red');

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

test('market prices use blue and red while service statuses retain semantic colors', () => {
  const tokens = src('src/theme/tokens.css');
  const index = src('src/index.css');
  const managerUi = src('src/theme/manager-ui.css');
  const legacyOverrides = src('src/theme/legacy-overrides.css');
  const marketWatchCss = src('src/components/organisms/MarketWatchDock.css');
  const marketWatch = src('src/components/organisms/MarketWatchDock.jsx');
  const symbolList = src('src/components/organisms/SymbolManagement/SymbolListPage.jsx');
  const symbolsTab = src('src/components/organisms/SymbolManagement/SymbolsTab.jsx');

  assert.match(tokens, /--success-500:\s*#8fbd9d;/i);
  assert.match(tokens, /--danger-500:\s*#ed968a;/i);
  assert.match(managerUi, /--ok-text:\s*var\(--success-500\);/);
  assert.match(managerUi, /--danger-text:\s*var\(--danger-500\);/);

  assert.match(index, /--color-green-400:\s*var\(--success-500\);/);
  assert.match(index, /--color-emerald-400:\s*var\(--success-500\);/);
  assert.match(index, /--color-red-400:\s*var\(--danger-500\);/);
  assert.match(index, /--color-rose-400:\s*var\(--danger-500\);/);
  assert.match(legacyOverrides, /Semantic color compatibility/);

  assert.match(marketWatchCss, /--mw-profit:\s*var\(--market-profit\);/);
  assert.match(marketWatchCss, /--mw-loss:\s*var\(--market-loss\);/);
  assert.match(marketWatchCss, /--mw-bg-1:\s*var\(--bg-app\);/);
  assert.match(marketWatchCss, /--mw-accent:\s*var\(--accent-500\);/);
  assert.match(marketWatchCss, /\.quote-up svg\s*\{\s*color:\s*var\(--mw-profit\);/);
  assert.match(marketWatchCss, /\.market-quote-up\s*\{\s*color:\s*var\(--mw-profit\);/);
  assert.match(marketWatchCss, /\.market-quote-down\s*\{\s*color:\s*var\(--mw-loss\);/);
  assert.match(marketWatch, /quotePriceClass\(quote\?\.bidDir, live\)/);
  assert.match(marketWatch, /quotePriceClass\(quote\?\.askDir, live\)/);
  assert.match(symbolList, /quoteColorClass\(item\.bidDir\)/);
  assert.match(symbolList, /quoteColorClass\(item\.askDir\)/);
  assert.match(symbolList, /var\(--market-profit\)/);
  assert.match(symbolList, /var\(--market-loss\)/);
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

  assert.doesNotMatch(app, /admin-workspace-tabs|aria-label="Workspace views"/, 'workspace selection uses the Navigator without a duplicate tab row');
  assert.match(app, /selectedNodeLabel=\{activeNode === 'Market Overview' \? 'Symbols Browser' : activeNode\}/);
  assert.match(app, /viewType=\{activeNode\}/, 'the selected Navigator view drives the main content');
  assert.match(app, /<span>\{activeNode\}<\/span>/, 'the active view remains visible in its heading');
  assert.match(toolbar, /onClick=\{onAddClick\}/);
  assert.match(toolbar, /onChange=\{\(e\) => onSearchChange\?\.\(e\.target\.value\)\}/);
  assert.match(sidebar, /newNode\.blockedNavigation\s*=\s*shouldBlockViewNavigation\(newNode\.label,\s*user\);/);
  assert.match(sidebar, /user=\{currentUser\}|user, onNodeSelect/, 'sidebar lock flags follow the session user');
});
