// Render guard for the Group properties > Migration panel.
// Run with: node --test src/components/organisms/GroupMigrationPanel.render.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadJsxModule } from '../../test/jsxRender.helper.js';

const { default: GroupMigrationPanel } = await loadJsxModule('src/components/organisms/GroupMigrationPanel.jsx');
const popupCss = readFileSync(new URL('../RIGHTCLICKJPOPUPS/GroupPropertiesPopup.css', import.meta.url), 'utf8');
const api = { preview: async () => ({}), migrate: async () => ({}), remove: async () => ({}) };
const render = props => renderToStaticMarkup(React.createElement(GroupMigrationPanel, { source: 'Real\\Old', api, ...props }));
const classTokens = tag => (tag.match(/\sclass="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter(Boolean);
const NO_PERMISSION_NOTE = 'Migrating or deleting groups requires group-management permission across all groups in this broker.';

test('destination input and migration buttons use the popup classes as whole class tokens', () => {
  const html = render({ canManage: true, groupRows: [{ name: 'Real\\New' }] });
  const input = html.match(/<input[^>]*>/)?.[0] ?? '';
  assert.ok(classTokens(input).includes('gpp-input'), 'input carries the gpp-input token');
  assert.match(input, /aria-label="Migration destination group"/);
  const buttons = html.match(/<button[^>]*>/g) ?? [];
  assert.equal(buttons.length, 2, 'preview and delete are rendered before a preview exists');
  for (const button of buttons) assert.ok(classTokens(button).includes('gpp-btn'), `button carries the gpp-btn token: ${button}`);
  assert.doesNotMatch(html, /<button(?![^>]*class=)/, 'no button may render without a class');
});

test('every class token the panel renders is defined in GroupPropertiesPopup.css', () => {
  const html = render({ canManage: false, groupRows: [{ name: 'Real\\New' }] });
  const tokens = new Set([...html.matchAll(/\sclass="([^"]*)"/g)].flatMap(match => match[1].split(/\s+/).filter(Boolean)));
  assert.ok(tokens.size > 0);
  for (const token of tokens) {
    assert.match(popupCss, new RegExp(`\\.${token}(?![\\w-])`), `".${token}" is defined in GroupPropertiesPopup.css`);
  }
  // The migrate button only renders after a preview, so its is-primary modifier is checked against the stylesheet directly.
  assert.match(popupCss, /\.gpp-btn\.is-primary(?![\w-])/);
});

test('destination suggestions come from the loaded group rows and exclude the source group', () => {
  const html = render({ canManage: true, groupRows: [{ name: 'Real\\Old' }, { name: 'Real\\New' }, { name: 'Real\\Other' }] });
  const list = html.match(/<datalist id="([^"]+)">([\s\S]*?)<\/datalist>/);
  assert.ok(list, 'datalist rendered');
  assert.ok(html.includes(`list="${list[1]}"`), 'input is bound to the datalist');
  assert.match(list[2], /value="Real\\New"/);
  assert.match(list[2], /value="Real\\Other"/);
  assert.doesNotMatch(list[2], /value="Real\\Old"/, 'source group is not a destination');
});

test('a row carrying both group and name uses the group key, the same full name the popup uses as the source', () => {
  const html = render({ canManage: true, groupRows: [{ group: 'Real\\Canonical', name: 'Real\\Display' }, { group: 'Real\\Old', name: 'Real\\Other' }] });
  const list = html.match(/<datalist id="([^"]+)">([\s\S]*?)<\/datalist>/);
  assert.match(list[2], /value="Real\\Canonical"/, 'group key is the full name');
  assert.doesNotMatch(list[2], /value="Real\\Display"/, 'name key is not used when group is present');
  assert.doesNotMatch(list[2], /value="Real\\Other"/, 'source is excluded by its group key too');
});

test('datalist is empty and harmless when no group list is available', () => {
  const html = render({ canManage: true });
  assert.match(html, /<datalist id="[^"]+"><\/datalist>/);
});

test('without group-management permission the controls are disabled and the reason is shown', () => {
  const html = render({ canManage: false, groupRows: [{ name: 'Real\\New' }] });
  assert.ok(html.includes(`role="note"`) && html.includes(NO_PERMISSION_NOTE), 'permission note is shown');
  const input = html.match(/<input[^>]*>/)?.[0] ?? '';
  assert.match(input, /disabled=""/, 'destination input is disabled');
  const buttons = html.match(/<button[^>]*>/g) ?? [];
  for (const button of buttons) assert.match(button, /disabled=""/);
});

test('with permission the explanatory note is not shown', () => {
  const html = render({ canManage: true });
  assert.ok(!html.includes(NO_PERMISSION_NOTE));
});
