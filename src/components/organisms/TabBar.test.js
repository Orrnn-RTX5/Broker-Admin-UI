import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./TabBar.jsx', import.meta.url), 'utf8');

test('TabBar provides usable controls for many open tabs', () => {
  assert.match(src, /role="tablist"/);
  assert.match(src, /aria-label="Open views"/);
  assert.match(src, /aria-label="Scroll tabs left"/);
  assert.match(src, /aria-label="Scroll tabs right"/);
  assert.match(src, /scrollIntoView\(\{ block: 'nearest', inline: 'nearest' \}\)/);
  assert.match(src, /title=\{t\}/);
});

test('TabBar keeps active close controls discoverable and supports keyboard navigation', () => {
  assert.match(src, /role="tab"/);
  assert.match(src, /aria-selected=\{active\}/);
  assert.match(src, /tabIndex=\{active \? 0 : -1\}/);
  assert.match(src, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(src, /event\.key === 'ArrowLeft' \|\| event\.key === 'ArrowRight'/);
  assert.match(src, /active \? 'opacity-100' : 'opacity-55 md:opacity-0 md:group-hover:opacity-100'/);
});
