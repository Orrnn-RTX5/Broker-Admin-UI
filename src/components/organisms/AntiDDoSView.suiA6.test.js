import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./AntiDDoSView.jsx', import.meta.url), 'utf8');

test('SUI-A6: vendor Send-request buttons are disabled with a user-visible reason', () => {
  assert.match(src, /VENDOR_REQUEST_UNAVAILABLE = 'Vendor requests are handled by your platform provider/);
  // The shared reason is both the hover/focus title and a visible note.
  assert.match(src, /title=\{VENDOR_REQUEST_UNAVAILABLE\}/);
  assert.match(src, /role="note"/);
  assert.match(src, /\{VENDOR_REQUEST_UNAVAILABLE\}/);
  // Disabled, never a silent no-op: no bare button without disabled.
  assert.match(src, /<button[^>]*disabled[^>]*>\s*Send request\s*<\/button>/s);
});

test('SUI-A6: Add Proxy Server is disabled with a user-visible reason', () => {
  assert.match(src, /ADD_PROXY_UNAVAILABLE = 'Proxy servers are provisioned by your platform provider/);
  assert.match(src, /title=\{ADD_PROXY_UNAVAILABLE\}/);
  assert.match(src, /<button[^>]*disabled[^>]*>\s*<CheckCircle2[^/]*\/>\s*Add Proxy Server\s*<\/button>/s);
});

test('SUI-A6: no vendor/proxy button fakes success', () => {
  assert.doesNotMatch(src, /onClick=\{(onSendRequest|onAddProxy|handleSendRequest|handleAddProxy)/);
});
