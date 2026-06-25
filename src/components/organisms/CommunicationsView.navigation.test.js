import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const communicationsSrc = readFileSync(new URL('./CommunicationsView.jsx', import.meta.url), 'utf8');
const tableSrc = readFileSync(new URL('./AdminDataTable.jsx', import.meta.url), 'utf8');

test('Communications children open the matching tab', () => {
  assert.match(communicationsSrc, /const TAB_BY_VIEW = \{/);
  assert.match(communicationsSrc, /'Auto Notification Rules': 'rules'/);
  assert.match(communicationsSrc, /'Email Campaigns': 'email'/);
  assert.match(communicationsSrc, /'Message Center': 'msgctr'/);
  assert.match(communicationsSrc, /'Push Notifications': 'push'/);
  assert.match(communicationsSrc, /SMS: 'sms'/);
  assert.match(communicationsSrc, /const CommunicationsView = \(\{ initialTab \}\) => \{/);
  assert.match(communicationsSrc, /setTab\(getInitialCommunicationsTab\(initialTab\)\)/);
  assert.match(tableSrc, /<CommunicationsView initialTab=\{viewType\} \/>/);
});

test('static payment provider screen is not rendered as a working route', () => {
  const folderOnlyBlock = tableSrc.match(/const FOLDER_ONLY_VIEWS = new Set\(\[[\s\S]*?\]\);/)?.[0] || '';

  assert.doesNotMatch(tableSrc, /import PaymentsView from '\.\/PaymentsView';/);
  assert.doesNotMatch(tableSrc, /return <PaymentsView \/>/);
  assert.match(tableSrc, /'Providers'/);
  assert.doesNotMatch(folderOnlyBlock, /'Payments'/);
  assert.match(tableSrc, /if \(viewType === 'Payments' \|\| viewType === 'Payment Methods'\) \{/);
  assert.match(tableSrc, /return <PaymentMethodsView \/>/);
});

test('Analytics parent opens a working analytics view', () => {
  assert.match(tableSrc, /if \(viewType === 'Analytics' \|\| viewType === 'Client Analytics'\) \{/);
  assert.match(tableSrc, /return <AnalyticsClientView \/>/);
});
