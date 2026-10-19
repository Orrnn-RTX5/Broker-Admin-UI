import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const supportSource = readFileSync(new URL('./SupportCenterView.jsx', import.meta.url), 'utf8');
const tableSource = readFileSync(new URL('./AdminDataTable.jsx', import.meta.url), 'utf8');
const terminalDataSource = readFileSync(new URL('../../data/terminalData.jsx', import.meta.url), 'utf8');

test('Support Center uses dynamic white-label branding and support email', () => {
  assert.doesNotMatch(supportSource, /MetaQuotes|support\.metaquotes\.net|Orrnn Support Center|support@orrnn\.com/i);
  assert.match(supportSource, /getBrokerBranding/);
  assert.match(supportSource, /Enter \{supportName\}/);
  assert.match(supportSource, /Official \{vendorName\} Support Channel/);
  assert.match(supportSource, /href=\{`mailto:\$\{supportEmail\}`\}/);
  assert.match(supportSource, /\{supportEmail\}/);
});

test('Support Center sidebar route label uses neutral Leads label', () => {
  assert.doesNotMatch(terminalDataSource, /MetaQuotes Leads|Orrnn Leads/);
  assert.doesNotMatch(tableSource, /MetaQuotes Leads|Orrnn Leads/);
  assert.match(terminalDataSource, /label:\s*"Leads"/);
  assert.match(tableSource, /'Leads'/);
});
