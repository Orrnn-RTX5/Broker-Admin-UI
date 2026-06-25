import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const supportSource = readFileSync(new URL('./SupportCenterView.jsx', import.meta.url), 'utf8');
const tableSource = readFileSync(new URL('./AdminDataTable.jsx', import.meta.url), 'utf8');
const terminalDataSource = readFileSync(new URL('../../data/terminalData.jsx', import.meta.url), 'utf8');

test('Support Center uses Orrnn branding and support email', () => {
  assert.doesNotMatch(supportSource, /MetaQuotes|support\.metaquotes\.net/i);
  assert.match(supportSource, /Orrnn Support Center/);
  assert.match(supportSource, /Orrnn Technical Support Center/);
  assert.match(supportSource, /Official Orrnn Support Channel/);
  assert.match(supportSource, /href="mailto:support@orrnn\.com"/);
  assert.match(supportSource, />support@orrnn\.com</);
});

test('Support Center sidebar route label uses Orrnn Leads', () => {
  assert.doesNotMatch(terminalDataSource, /MetaQuotes Leads/);
  assert.doesNotMatch(tableSource, /MetaQuotes Leads/);
  assert.match(terminalDataSource, /label:\s*"Orrnn Leads"/);
  assert.match(tableSource, /'Orrnn Leads'/);
});
