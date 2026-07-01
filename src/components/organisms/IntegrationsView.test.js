import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./IntegrationsView.jsx', import.meta.url), 'utf8');

test('Integration view keeps services in a single aligned operational grid', () => {
  assert.match(src, /const integrationSections = \[/);
  assert.match(src, /grid-cols-\[minmax\(420px,1fr\)_minmax\(300px,420px\)\]/);
  assert.match(src, /const ActivityMeter = \(\{ activity \}\) => \{/);
  assert.doesNotMatch(src, /flex justify-between items-start mb-8/);
});

test('Integration view preserves existing service content', () => {
  [
    'Finteza Analytics',
    'Sponsored VPS',
    'Mail Servers',
    'SMS Gateways',
    'Messenger Channels',
    'KYC Checks',
    'Use end-to-end brokerage analytics for RTX5.',
    'Offer your traders free virtual hosting for round-the-clock trading.',
    'Send newsletters and personal emails to your traders.',
    "Send automatic SMS to verify clients' contact details for newly opened accounts.",
    'Receive platform performance data via messenger channels.',
    'Automatically check documents when opening live accounts.',
  ].forEach((text) => {
    assert.match(src, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});

test('Integration header does not render the MQL5 external link', () => {
  assert.doesNotMatch(src, /www\.mql5\.com/);
  assert.doesNotMatch(src, /href="https:\/\/www\.mql5\.com"/);
});
