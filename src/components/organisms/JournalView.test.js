// SUI-A3: the main-area Journal screen reuses the exact surface and data
// layer as the Operations Terminal dock (ServerJournal + useServerJournal
// over the same fetchServerJournal data layer), so Window-menu and header
// Journal entries render live data instead of the empty group-lookup state.
//
// JournalView.jsx is a React/DOM component (no jsdom under plain
// `node --test`), so this file tests its module shape from source — the same
// DOM-free strategy as the sibling adminViewAliases wiring tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'JournalView.jsx'), 'utf8');

test('SUI-A3: JournalView renders the shared ServerJournal surface with live data', () => {
  assert.match(source, /import ServerJournal from '\.\/ServerJournal';/, 'must reuse the Operations Terminal dock surface');
  assert.match(
    source,
    /<ServerJournal journal=\{journal\} query=\{query\} isAuthenticated=\{isAuthenticated\} \/>/,
    'must pass the live journal object through instead of placeholder data'
  );
});

test('SUI-A3: JournalView uses the shared journal data layer, no new backend calls', () => {
  assert.match(
    source,
    /import useServerJournal from '\.\.\/\.\.\/hooks\/useServerJournal';/,
    'must reuse the shared journal hook'
  );
  assert.match(
    source,
    /import \{ serverJournalSessionKey \} from '\.\.\/\.\.\/utils\/serverJournal';/,
    'must key the session the same way as the shared journal layer'
  );
  assert.match(
    source,
    /const journal = useServerJournal\(isAuthenticated, journalSession, true\);/,
    'must subscribe with the session key while authenticated'
  );
  assert.doesNotMatch(source, /services\/journal/, 'must not add its own journal backend calls');
});

test('SUI-A3: JournalView exposes search and journal status', () => {
  assert.match(source, /aria-label="Search journal"/, 'must expose the journal search field');
  assert.match(source, /<span role="status">\{status\}<\/span>/, 'must surface the journal status');
  assert.match(source, /'Sign in to view journal'/, 'must explain the unauthenticated state');
  assert.match(
    source,
    /journal\.error \|\| \(journal\.loading && journal\.entries\.length === 0 \? 'Loading journal…' : ''\)/,
    'must prefer the live error/loading state from the shared hook'
  );
});
