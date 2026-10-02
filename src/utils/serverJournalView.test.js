import test from 'node:test';
import assert from 'node:assert/strict';
import { journalEntryKey, journalEntryText, journalMinimumWidth, newestJournalEntry } from './serverJournalView.js';

test('row copy includes full hidden fields and retains zero account actor fallback', () => {
  const entry = { id: 1, time: Date.parse('2026-10-02T11:00:00Z'), severity: 'error', source: 'Manager API', action: 'LoginFailed', account_login: 0, actor_id: '9001', group: '', message: 'Full message\nwith another line' };
  const cells = journalEntryText(entry).split('\t');
  assert.equal(cells.length, 7);
  assert.deepEqual(cells.slice(1), ['error', 'Manager API', 'LoginFailed', '9001', '—', 'Full message with another line']);
  assert.match(cells[0], /^2026\.10\.02 \d{2}:\d{2}:\d{2}\.000$/);
});

test('clear keys normalize server IDs and distinguish legacy records without IDs', () => {
  assert.equal(journalEntryKey({ id: 7 }), journalEntryKey({ id: '7' }));
  assert.notEqual(journalEntryKey({ time: 1, message: 'First' }), journalEntryKey({ time: 1, message: 'Second' }));
});

test('visible columns set the minimum grid width', () => {
  assert.equal(journalMinimumWidth(['Time', 'Type', 'Source', 'Action', 'Login', 'Group', 'Message']), 1100);
  assert.equal(journalMinimumWidth(['Time', 'Message']), 514);
});

test('auto scroll chooses the latest event in either server order and ignores appended older records', () => {
  const older = { id: 'older', time: 10 }, newest = { id: 'newest', time: 30 }, middle = { id: 'middle', time: 20 };
  assert.equal(newestJournalEntry([newest, middle, older]), newest);
  assert.equal(newestJournalEntry([older, middle, newest]), newest);
  assert.equal(newestJournalEntry([newest, middle, older, { id: 'oldest', time: 1 }]), newest);
  assert.equal(newestJournalEntry([]), null);
});
