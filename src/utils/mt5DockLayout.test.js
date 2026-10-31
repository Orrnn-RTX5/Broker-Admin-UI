import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  MT5_DOCK_MODES,
  MT5_DOCK_PANELS,
  applyMt5DockPlacement,
  createInitialMt5DockArrangement,
} from './mt5DockLayout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('MT5 dock placement moves Navigator to left, right, bottom, and top', () => {
  const initial = createInitialMt5DockArrangement();
  assert.equal(initial.mode, MT5_DOCK_MODES.ROW);
  assert.equal(initial.terminalFullWidth, true);
  assert.deepEqual(initial.order, [MT5_DOCK_PANELS.MARKET_WATCH, MT5_DOCK_PANELS.NAVIGATOR]);

  // Move Navigator to outer-left -> Navigator left, Market Watch right, Operations Terminal full width
  const outerLeft = applyMt5DockPlacement(initial, MT5_DOCK_PANELS.NAVIGATOR, 'outer-left');
  assert.equal(outerLeft.mode, MT5_DOCK_MODES.ROW);
  assert.equal(outerLeft.terminalFullWidth, true);
  assert.deepEqual(outerLeft.order, [MT5_DOCK_PANELS.NAVIGATOR, MT5_DOCK_PANELS.MARKET_WATCH]);
  assert.equal(outerLeft.floatingPanel, null);

  // Move Navigator to right -> Market Watch left, Navigator right
  const right = applyMt5DockPlacement(outerLeft, MT5_DOCK_PANELS.NAVIGATOR, 'right');
  assert.equal(right.mode, MT5_DOCK_MODES.ROW);
  assert.deepEqual(right.order, [MT5_DOCK_PANELS.MARKET_WATCH, MT5_DOCK_PANELS.NAVIGATOR]);

  // Move Navigator to bottom -> stacked vertically, Market Watch top, Navigator bottom
  const bottom = applyMt5DockPlacement(right, MT5_DOCK_PANELS.NAVIGATOR, 'bottom');
  assert.equal(bottom.mode, MT5_DOCK_MODES.COLUMN);
  assert.deepEqual(bottom.order, [MT5_DOCK_PANELS.MARKET_WATCH, MT5_DOCK_PANELS.NAVIGATOR]);

  // Move Market Watch to bottom -> stacked vertically, Navigator top, Market Watch bottom
  const mwBottom = applyMt5DockPlacement(bottom, MT5_DOCK_PANELS.MARKET_WATCH, 'bottom');
  assert.equal(mwBottom.mode, MT5_DOCK_MODES.COLUMN);
  assert.deepEqual(mwBottom.order, [MT5_DOCK_PANELS.NAVIGATOR, MT5_DOCK_PANELS.MARKET_WATCH]);
});

test('MarketWatchDock and Mt5SmartDockGuide expose movable headers and MT5 guide zones', () => {
  const dockSource = fs.readFileSync(
    path.join(__dirname, '../components/organisms/MarketWatchDock.jsx'),
    'utf8'
  );
  const guideSource = fs.readFileSync(
    path.join(__dirname, '../components/organisms/Mt5SmartDockGuide.jsx'),
    'utf8'
  );

  assert.match(dockSource, /Mt5SmartDockGuide/);
  assert.match(dockSource, /startPanelMove\(MT5_DOCK_PANELS\.MARKET_WATCH/);
  assert.match(dockSource, /startPanelMove\(MT5_DOCK_PANELS\.NAVIGATOR/);
  assert.match(guideSource, /data-testid="mt5-smart-dock-guide"/);
  assert.match(guideSource, /bindZoneEvents\('outer-left'\)/);
  assert.match(guideSource, /bindZoneEvents\('left'\)/);
  assert.match(guideSource, /bindZoneEvents\('right'\)/);
  assert.match(guideSource, /bindZoneEvents\('bottom'\)/);
});

test('Initial open and Reset layout match the full-width Operations Terminal and compact Market Watch layout', () => {
  const workspaceCss = fs.readFileSync(
    path.join(__dirname, '../styles/adminWorkspace.css'),
    'utf8'
  );
  const dockSource = fs.readFileSync(
    path.join(__dirname, '../components/organisms/MarketWatchDock.jsx'),
    'utf8'
  );
  const terminalSource = fs.readFileSync(
    path.join(__dirname, '../components/organisms/OperationsTerminal.jsx'),
    'utf8'
  );
  const toolbarSource = fs.readFileSync(
    path.join(__dirname, '../components/organisms/ActionToolBar.jsx'),
    'utf8'
  );
  const authenticatedAppSource = fs.readFileSync(
    path.join(__dirname, '../AuthenticatedApp.jsx'),
    'utf8'
  );

  assert.match(workspaceCss, /\.admin-workspace-body\s*>\s*\.operations-terminal[\s\S]*?grid-column:\s*1\s*\/\s*span\s*2/);
  assert.match(dockSource, /className="admin-market-search-bar"/);
  assert.doesNotMatch(dockSource, /Connected · awaiting or receiving ticks/);
  assert.doesNotMatch(terminalSource, /operations-terminal-toolbox-strip/);
  assert.match(toolbarSource, /className="mt5-toolbar-reset"/);
  assert.match(authenticatedAppSource, /onResetLayout=\{onResetLayout\}/);
});
