import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./IntegrationsView.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./IntegrationsView.css', import.meta.url), 'utf8');

test('Integration view presents services as a filterable operational card grid', () => {
  assert.match(src, /const integrationSections = \[/);
  assert.match(src, /const \[activeFilter, setActiveFilter\] = useState\('all'\)/);
  assert.match(src, /className="integration-grid"/);
  assert.match(src, /const IntegrationCard = \(\{ item \}\) =>/);
  assert.match(src, /const ActivityMeter = \(\{ activity, isConfigured \}\) => \{/);
  assert.match(src, /aria-label="Filter integrations"/);
});

test('Integration view exposes summary and setup state clearly', () => {
  assert.match(src, /label="Connected"/);
  assert.match(src, /label: 'Needs setup'/);
  assert.match(src, /label="Setup required"/);
  assert.match(src, /statusLabel: 'Setup required'/);
  assert.match(src, /statusLabel: 'Connected'/);
  assert.match(src, /No activity recorded/);
});

test('Integration styling uses the restrained enterprise visual system', () => {
  assert.match(css, /--integration-text-meta: 11px/);
  assert.match(css, /--integration-text-page: 18px/);
  assert.match(css, /--integration-text-title: 14px/);
  assert.match(css, /background: var\(--bg-surface-1\)/);
  assert.doesNotMatch(css, /font-weight: (?:550|650)/);
  assert.doesNotMatch(src, /integration-card-accent|integration-service-icon-glow|data-service=/);
});

test('Integration operations show failed deliveries without dead guide links', () => {
  assert.match(src, /const OperationsOverview = \(\) =>/);
  assert.match(src, /integration-activity-bar-failure/);
  assert.match(src, /integration-delivery-failure/);
  assert.doesNotMatch(src, /href="#"/);
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
