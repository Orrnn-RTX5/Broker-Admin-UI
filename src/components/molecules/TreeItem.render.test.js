// FEASIBILITY PROBE (ds-20): prove Admin JSX renders under plain Windows
// node:test — no browser, no Docker, no new deps.
// Target: folder-gate TreeItem composition (SUI sidebar tree). TreeItem is the
// highest-value renderable unit: pure presentational + lucide-react + cn()
// (clsx/tailwind-merge), no zustand store singletons, no services, no CSS
// imports — so the only blocker class is JSX parsing, solved test-only by
// src/test/jsxRender.helper.js (rolldown bundle, already installed via vite).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadJsxModule } from '../../test/jsxRender.helper.js';

test('TreeItem folder-gate composition renders under plain node:test', async () => {
  const { default: TreeItem } = await loadJsxModule(
    'src/components/molecules/TreeItem.jsx',
  );
  assert.equal(typeof TreeItem, 'function', 'expected TreeItem default export');

  const item = {
    id: 'groups-root',
    label: 'Groups',
    type: 'groups-root',
    initiallyExpanded: true,
    children: [
      { id: 'g1', label: 'Real\\Group1', type: 'group', groupName: 'Real\\Group1' },
      {
        id: 'locked',
        label: 'Locked Folder',
        type: 'server-folder',
        path: 'srv',
        lockedDropdown: true,
      },
    ],
  };

  const html = renderToStaticMarkup(
    React.createElement(TreeItem, { item, level: 0, selectedId: 'g1' }),
  );

  // Folder gate composition: root + both children render as treeitems.
  assert.match(html, /role="treeitem"/);
  assert.match(html, /Groups/);
  assert.match(html, /Group1/);
  assert.match(html, /Locked Folder/);
  assert.match(html, /role="group"/);
  // Selected group row is marked selected.
  assert.match(html, /aria-selected="true"/);
  // Blocked-navigation folder gate: lock affordance + unavailable title.
  assert.match(html, /Locked Folder — unavailable/);
  assert.match(html, /aria-disabled="true"/);
  // lucide-react icons render as real SVG under SSR (no browser needed).
  assert.match(html, /<svg/);
});
