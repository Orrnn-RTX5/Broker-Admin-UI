// Render guard for the Group properties > Migration panel.
// Run with: node --test src/components/organisms/GroupMigrationPanel.render.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadJsxModule } from '../../test/jsxRender.helper.js';
import { migrationAttemptKey } from '../../utils/groupMigrationWarning.js';

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

test('while the group list loads, the destination is not judged: the loading line shows and Preview is disabled', () => {
  const html = render({ canManage: true, groupRows: [{ name: 'Real\\New' }], groupRowsStatus: 'loading' });
  assert.ok(html.includes('Group list loading…'));
  assert.equal(html.includes('not found'), false, 'a loading list is never reported as a missing group');
  assert.match(html, /<button[^>]*disabled=""[^>]*>Preview migration<\/button>/);
});

test('a failed group list says so, offers a working Retry, and never reports "not found"', () => {
  const html = render({ canManage: true, groupRows: [], groupRowsStatus: 'failed', onRetryGroupRows: () => {} });
  assert.ok(html.includes('Group list failed: Retry'));
  assert.match(html, /<button[^>]*>Retry<\/button>/);
  assert.equal(html.includes('not found'), false);
});

test('a ready list with no destination typed shows no list line and no Retry', () => {
  const html = render({ canManage: true, groupRows: [{ name: 'Real\\New' }], groupRowsStatus: 'ready', onRetryGroupRows: () => {} });
  assert.equal(html.includes('Group list'), false);
  assert.equal(html.includes('>Retry<'), false);
});

test('before any preview the panel shows no confirm, lock or server-report text', () => {
  const html = render({ canManage: true, groupRows: [{ name: 'Real\\New' }] });
  assert.equal(html.includes('will be emptied'), false);
  assert.equal(html.includes('Server broker'), false);
  assert.equal(html.includes('Migration outcome unknown'), false);
});

test('a fresh panel shows no attempt lock, no count and no typed-delete field', () => {
  const html = render({ canManage: true, groupRows: [{ name: 'Real\\New' }] });
  assert.equal(html.includes('Migration attempted at'), false);
  assert.equal(html.includes('all-login members'), false);
  assert.equal(html.includes('aria-label="Type the delete confirmation"'), false);
});

// Ordering wiring for the migrate and count reads. The decisions themselves are behaviour-tested in groupMigrationWarning.test.js.
const panelSource = readFileSync(new URL('./GroupMigrationPanel.jsx', import.meta.url), 'utf8');
test('T6-1 wiring: the panel calls the guard before the move and subscribes to storage; removing either fails here', () => {
  const guardAt = panelSource.indexOf('const begun = beginMigrationAttempt(globalThis.localStorage, currentBrokerId(), source);');
  const migrateAt = panelSource.indexOf('value = await api.migrate(source, destination);');
  assert.ok(guardAt > 0 && migrateAt > guardAt, 'the guard runs before the move is sent');
  assert.match(panelSource, /if \(!begun\.ok\) \{ setError\(begun\.reason\)/, 'a locked source is refused, not sent');
  assert.match(panelSource, /useEffect\(\(\) => subscribeMigrationLock\(window, \(\) => setAttemptTick/, 'an open panel re-reads the lock on another tab write');
  assert.match(panelSource, /destination === destination\.trim\(\) && typeof api\.destinationCount === 'function'/);
});

test('space-only and case-only spellings stay separate destination options, exactly as the server named them', () => {
  const html = render({ canManage: true, groupRows: [{ name: 'Real\\New' }, { name: 'Real\\New ' }, { name: 'real\\new' }, { name: ' ' }] });
  const values = [...html.matchAll(/<option value="([^"]*)"/g)].map(match => match[1]);
  assert.deepEqual(values, ['Real\\New', 'Real\\New ', 'real\\new']);
});

// Round 5: a stored migrate attempt (another tab, or before a reload) locks the panel as soon as it opens.
test('a stored migrate attempt locks the panel on open: the attempt line, the lock note, the typed clear, and Preview, Migrate and the field disabled', () => {
  const store = new Map([['brokerId', 'broker-a'], [migrationAttemptKey('Real\\Old', 'broker-a'), new Date().toISOString()]]);
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem: key => (store.has(key) ? store.get(key) : null), setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) };
  try {
    const html = render({ canManage: true, groupRows: [{ name: 'Real\\New' }] });
    assert.ok(html.includes('Migration attempted at '), 'the attempt line is shown');
    assert.ok(html.includes('survives reloads and other tabs'), 'the lock note says a reload does not clear it');
    assert.match(html, /aria-label="Type the clear line"/);
    assert.match(html, /<button[^>]*disabled=""[^>]*>Clear lock<\/button>/, 'the clear is closed until the line is typed');
    assert.match(html, /<button[^>]*disabled=""[^>]*>Preview migration<\/button>/);
    assert.match(html, /<input[^>]*aria-label="Migration destination group"[^>]*disabled=""/);
    assert.match(html, /<button[^>]*>Check result<\/button>/, 'the read-only Check result is offered while locked');
  } finally {
    globalThis.localStorage = saved;
  }
});

test('Delete is closed on a fresh panel: no verified result, no typed delete line', () => {
  const html = render({ canManage: true, groupRows: [{ name: 'Real\\New' }] });
  assert.match(html, /<button[^>]*disabled=""[^>]*>Delete verified source group<\/button>/);
  assert.equal(html.includes('aria-label="Type the delete confirmation"'), false);
});


// Round 7 wiring pins: the re-checks inside run() (A-R6-2, A-R6-6), the Clear guard, the source-change reset (A-R6-4), and the
// delete call that carries the typed line. A removed or bypassed check fails here.
test('R7 wiring: padded destinations and the typed delete are re-checked inside run(); Clear is guarded; a new source resets Check result', () => {
  assert.match(panelSource, /if \(action !== 'delete' && isPaddedDestination\(destination\)\) return;/);
  assert.match(panelSource, /if \(action === 'delete' && !controls\.deleteEnabled\) return;/);
  assert.match(panelSource, /api\.remove\(source, deleteConfirmLine\(source\)\)/);
  assert.match(panelSource, /if \(!controls\.clearEnabled\) return; clearMigrationAttempt\(source\);/);
  assert.match(panelSource, /setDestinationCount\(null\); setResultCheck\(null\);/);
});

// Round 8 wiring pins: the guards that the behaviour tests cannot reach from a server-rendered panel.
test('T7-1 wiring: Check result asks for a source or destination only when it is readable; removing the guard fails here', () => {
  assert.match(panelSource, /import \{[^}]*countTargetsReadable/, 'the guard comes from the tested helper');
  assert.match(panelSource, /const readable = countTargetsReadable\(source, destination\);/);
  assert.match(panelSource, /readable\.source \? api\.destinationCount\(source\)/, 'a padded source is never counted');
  assert.match(panelSource, /readable\.destination \? api\.destinationCount\(destination\)/, 'a padded destination is never counted');
});

test('A-R7-4 wiring: every line that sets the result also clears the typed DELETE line', () => {
  const resultLines = panelSource.split('\n').filter(line => line.includes('setResult('));
  assert.ok(resultLines.length >= 6, 'the result is set on each path that sets it');
  assert.deepEqual(resultLines.filter(line => !line.includes("setDeleteTyped('')")), [], 'a result change must clear the typed DELETE line');
});
