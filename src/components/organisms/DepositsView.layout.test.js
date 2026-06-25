import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./DepositsView.jsx', import.meta.url), 'utf8');

test('Deposits actions column fits approve and reject buttons', () => {
  assert.match(src, /<div className="w-\[190px\] px-3 py-1\.5 text-\[11px\] font-medium text-\[color:var\(--text-primary\)\] shrink-0">Actions<\/div>/);
  assert.match(src, /<div className="w-\[190px\] px-2 py-1 flex items-center gap-1\.5 shrink-0 overflow-visible">/);
  assert.match(src, /text-\[10px\] rounded-\[2px\] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0/);
  assert.match(src, /text-\[10px\] rounded-\[2px\] transition-colors whitespace-nowrap shrink-0/);
});
