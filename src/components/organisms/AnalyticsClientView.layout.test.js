import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'AnalyticsClientView.jsx'), 'utf8');

test('Client Analytics table uses fixed grid columns for aligned headers and rows', () => {
  assert.match(src, /const gridTemplateColumns = cols\.map\(getColumnWidth\)\.join\(' '\)/);
  assert.match(src, /style=\{\{ gridTemplateColumns \}\}/);
  assert.match(src, /normalized === 'group' \|\| normalized\.includes\('group'\)/);
  assert.match(src, /return 'minmax\(320px, 2fr\)'/);
  assert.doesNotMatch(src, /className="min-w-\[140px\]/);
});

test('Client Analytics numeric columns are right aligned with tabular numbers', () => {
  assert.match(src, /const getCellAlignment = \(key, value\) => \(/);
  assert.match(src, /text-right tabular-nums/);
  assert.match(src, /INTEGER_COLUMN_RE/);
  assert.match(src, /new Intl\.NumberFormat/);
});
