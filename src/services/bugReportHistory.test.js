import test from 'node:test';
import assert from 'node:assert/strict';
import { bugReportHistoryScope, readBugReportHistory, recordBugReportReceipt } from './bugReportHistory.js';

const storage = () => {
  const data = new Map();
  return { data, getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
};
test('receipts are isolated by broker and reporter and contain only safe metadata', () => {
  const saved = storage();
  const scope = bugReportHistoryScope({ broker_id: 'broker-A', login: 9001 });
  recordBugReportReceipt(scope, { report_id: 'REPORT-1', token: 'private' }, {
    title: ' Quote issue ', description: 'private details', steps: 'private steps', severity: 'high', category: 'market_data',
  }, saved);
  const rows = readBugReportHistory(scope, saved);
  assert.equal(rows[0].title, 'Quote issue');
  assert.equal(rows[0].report_id, 'REPORT-1');
  assert.equal(rows[0].severity, 'high');
  assert.deepEqual(Object.keys(rows[0]).sort(), ['attachment_issue', 'category', 'report_id', 'severity', 'submitted_at', 'title']);
  assert.deepEqual(readBugReportHistory(bugReportHistoryScope({ broker_id: 'broker-B', login: 9001 }), saved), []);
  assert.deepEqual(readBugReportHistory(bugReportHistoryScope({ broker_id: 'broker-A', login: 9002 }), saved), []);
  assert.equal(bugReportHistoryScope({ login: 9001 }), null);
  assert.equal(bugReportHistoryScope({ broker_id: 'broker-A' }), null);
  assert(![...saved.data.values()].join('').includes('private'));
});
test('missing confirmations are ignored, duplicate references are replaced, and attachment failures remain visible', () => {
  const saved = storage(), scope = 'dedupe-test';
  recordBugReportReceipt(scope, {}, { title: 'Unconfirmed' }, saved);
  assert.deepEqual(readBugReportHistory(scope, saved), []);
  recordBugReportReceipt(scope, { report_id: 'REPORT-2' }, { title: 'First' }, saved);
  recordBugReportReceipt(scope, { report_id: 'REPORT-2', failed_attachments: ['screenshot.png'] }, { title: 'Updated' }, saved);
  assert.equal(readBugReportHistory(scope, saved).length, 1);
  assert.equal(readBugReportHistory(scope, saved)[0].attachment_issue, true);
});
test('blocked storage cannot turn server success into failure or hide the latest receipt', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  assert.doesNotThrow(() => recordBugReportReceipt('blocked-storage-test', { report_id: 'REPORT-3' }, { title: 'Confirmed' }, broken));
  assert.equal(readBugReportHistory('blocked-storage-test', broken)[0].report_id, 'REPORT-3');
});
test('refresh restores validated receipts and discards malformed stored entries', () => {
  const saved = storage(), scope = 'reload-test';
  saved.setItem(`admin:bug-report-receipts:v1:${scope}`, JSON.stringify([
    null, { report_id: 'bad', title: 'Missing date' },
    { report_id: 'REPORT-4', title: 'Restored', submitted_at: 1000, description: 'private' },
  ]));
  const rows = readBugReportHistory(scope, saved);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].report_id, 'REPORT-4');
  assert.equal(rows[0].description, undefined);
  saved.setItem('admin:bug-report-receipts:v1:corrupt-test', '{broken');
  assert.deepEqual(readBugReportHistory('corrupt-test', saved), []);
});
test('session history is bounded to the latest 100 receipts', () => {
  const saved = storage(), scope = 'limit-test';
  for (let index = 0; index < 105; index++) recordBugReportReceipt(scope, { report_id: `R-${index}` }, { title: 'Report' }, saved);
  assert.equal(readBugReportHistory(scope, saved).length, 100);
  assert.equal(readBugReportHistory(scope, saved)[0].report_id, 'R-104');
});
