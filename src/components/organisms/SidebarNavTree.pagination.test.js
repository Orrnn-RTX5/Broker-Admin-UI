import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./SidebarNavTree.jsx', import.meta.url), 'utf8');
const terminalData = readFileSync(new URL('../../data/terminalData.jsx', import.meta.url), 'utf8');

test('sidebar fetches only a capped first page of groups', () => {
  assert.match(src, /import \{ normalizePagedResponse \} from '\.\.\/\.\.\/utils\/apiShapes';/);
  assert.match(src, /const SIDEBAR_GROUP_LIMIT = 100/);
  assert.match(src, /useGroups\(1,\s*SIDEBAR_GROUP_LIMIT,\s*'',\s*canLoadGroups\)/);
  assert.match(src, /normalizePagedResponse\(groupsResponse,\s*\{/);
  assert.match(src, /apiGroups = groupPage\.rows\.slice\(0,\s*SIDEBAR_GROUP_LIMIT\)/);
});

test('Groups sidebar node is collapsed before dynamic group children mount', () => {
  assert.match(src, /newNode\.initiallyExpanded = false/);
  assert.match(
    terminalData,
    /label:\s*"Groups"[\s\S]*?initiallyExpanded:\s*false/
  );
});

test('sidebar does not fetch heavyweight account or symbol details for counts', () => {
  assert.doesNotMatch(src, /import \{ useAccounts \} from '\.\.\/\.\.\/hooks\/useAccounts';/);
  assert.doesNotMatch(src, /import \{ useInstruments \} from '\.\.\/\.\.\/hooks\/useInstruments';/);
  assert.doesNotMatch(src, /SIDEBAR_COUNT_LIMIT/);
  assert.doesNotMatch(src, /useAccounts\(/);
  assert.doesNotMatch(src, /useInstruments\(/);
  assert.doesNotMatch(src, /getKnownSidebarCount/);
  assert.doesNotMatch(terminalData, /label:\s*"Clients & Accounts"[\s\S]{0,80}count:/);
  assert.doesNotMatch(terminalData, /label:\s*"Symbols"[\s\S]{0,80}count:/);
});

test('unsupported market overview entries do not display static counts', () => {
  assert.doesNotMatch(terminalData, /label:\s*"Mailbox"[\s\S]{0,80}count:/);
});
