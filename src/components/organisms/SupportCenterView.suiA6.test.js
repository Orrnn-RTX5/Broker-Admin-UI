import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./SupportCenterView.jsx', import.meta.url), 'utf8');

test('SUI-A6: Enter button is disabled with a user-visible reason, never fakes sign-in', () => {
  assert.match(src, /ENTER_UNAVAILABLE = 'Support Center sign-in is not available in this workspace/);
  assert.match(src, /title=\{ENTER_UNAVAILABLE\}/);
  assert.match(src, /role="note"/);
  assert.match(src, /\{ENTER_UNAVAILABLE\}/);
  assert.match(src, /<button[^>]*disabled[^>]*>\s*Enter \{supportName\}\s*<\/button>/s);
  // No submit handler that would pretend to authenticate externally.
  assert.doesNotMatch(src, /onClick=\{/);
  assert.doesNotMatch(src, /onSubmit=\{/);
});
