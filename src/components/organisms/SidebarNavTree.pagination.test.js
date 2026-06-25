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

test('sidebar counts for clients and symbols come from API responses', () => {
  assert.match(src, /import \{ useAccounts \} from '\.\.\/\.\.\/hooks\/useAccounts';/);
  assert.match(src, /import \{ useInstruments \} from '\.\.\/\.\.\/hooks\/useInstruments';/);
  assert.match(src, /const SIDEBAR_COUNT_LIMIT = 1/);
  assert.match(src, /useAccounts\(1,\s*SIDEBAR_COUNT_LIMIT,\s*'',\s*'',\s*'',\s*canLoadClientAccounts\)/);
  assert.match(src, /useInstruments\(1,\s*SIDEBAR_COUNT_LIMIT,\s*'',\s*'',\s*canLoadSymbols\)/);
  assert.match(src, /newNode\.label === 'Clients & Accounts'[\s\S]*?getKnownSidebarCount\(accountsResponse,\s*\['accounts', 'data', 'answer', 'items', 'rows'\]\)/);
  assert.match(src, /newNode\.label === 'Symbols'[\s\S]*?getKnownSidebarCount\(symbolsResponse,\s*\['instruments', 'symbols', 'data', 'answer', 'items', 'rows', 'value'\]\)/);
  assert.doesNotMatch(terminalData, /label:\s*"Clients & Accounts"[\s\S]{0,80}count:/);
  assert.doesNotMatch(terminalData, /label:\s*"Symbols"[\s\S]{0,80}count:/);
});

test('unsupported market overview entries do not display static counts', () => {
  assert.doesNotMatch(terminalData, /label:\s*"Mailbox"[\s\S]{0,80}count:/);
});
