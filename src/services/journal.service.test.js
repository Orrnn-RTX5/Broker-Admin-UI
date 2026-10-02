import assert from 'node:assert/strict';
import test from 'node:test';
import { api } from '../lib/api.js';
import { fetchServerJournal, validateServerJournalResponse } from './journal.service.js';

const entry = { id: 'event-1', time: 1790867896000, severity: 'info', source: 'Terminal', message: 'Trading socket connected' };

test('Admin requests the exact Manager journal path using native broker routing and no account scope', async () => {
  const original = api.get;
  const controller = new AbortController();
  api.get = async (url, config) => {
    assert.equal(url, '/api/v1/manager/journal?limit=50');
    assert.equal(config._nativeBrokerApi, true);
    assert.equal(config.timeout, 15000);
    assert.equal(config.signal, controller.signal);
    assert.equal(config.headers, undefined);
    return { data: { entries: [entry], next_cursor: 'older-1', scope: { mode: 'unrestricted' } } };
  };
  try {
    const result = await fetchServerJournal({}, { signal: controller.signal });
    assert.deepEqual(result.entries, [entry]);
    assert.equal(result.next_cursor, 'older-1');
  } finally { api.get = original; }
});

test('server filter and cursor are encoded in the same journal endpoint', async () => {
  const original = api.get;
  api.get = async (url) => {
    const parsed = new URL(url, 'http://test.invalid');
    assert.equal(parsed.pathname, '/api/v1/manager/journal');
    assert.equal(parsed.searchParams.get('category'), 'SECURITY,AUTH');
    assert.equal(parsed.searchParams.get('cursor'), 'cursor+/=');
    assert.equal(parsed.searchParams.get('limit'), '50');
    assert.equal(parsed.searchParams.has('broker_id'), false);
    assert.equal(parsed.searchParams.has('login'), false);
    return { data: { entries: [] } };
  };
  try { assert.deepEqual((await fetchServerJournal({ filter: 'security', cursor: 'cursor+/=' })).entries, []); }
  finally { api.get = original; }
});

test('empty successful journal is accepted and duplicate backend IDs are removed', () => {
  assert.deepEqual(validateServerJournalResponse({ entries: [], next_cursor: null, scope: null }), {
    entries: [], next_cursor: '', scope: null,
  });
  assert.deepEqual(validateServerJournalResponse({ entries: [entry, entry] }).entries, [entry]);
});

test('malformed payloads fail visibly instead of becoming successful empty journals', () => {
  for (const payload of [null, [], {}, { entries: {} }, { entries: [null] },
    { entries: [{ time: entry.time }] }, { entries: [{ id: 'bad', time: 'invalid' }] },
    { entries: [{ ...entry, message: {} }] }, { entries: [{ ...entry, account_login: [] }] },
    { entries: [entry], next_cursor: 1 }, { entries: [entry], scope: [] },
    { entries: [entry], scope: { groups: 'demo' } }, { entries: [entry], scope: { mode: {} } },
    { entries: [entry], scope: { system: 'false' } }]) {
    assert.throws(() => validateServerJournalResponse(payload), /Invalid journal response/);
  }
});

test('permission or explicit error envelopes cannot masquerade as empty successful responses', () => {
  for (const payload of [
    { entries: [], message: 'Permission denied: view_journal' },
    { entries: [], error: 'Forbidden' },
    { entries: [], success: false, message: 'No journal access' },
    { entries: [], status: 'error', error: { status: 403, message: 'Journal access revoked' } },
  ]) {
    assert.throws(() => validateServerJournalResponse(payload), (error) => error.status === 403);
  }
  assert.throws(() => validateServerJournalResponse({ entries: [], status: 503, message: 'Journal unavailable' }),
    (error) => error.status === 503 && error.message === 'Journal unavailable');
  assert.throws(() => validateServerJournalResponse({ entries: [], success: false }), /Journal request failed/);
});

test('backend permission status and readable errors survive Axios failure normalization', async () => {
  const original = api.get;
  api.get = async () => { throw { response: { status: 403, data: { detail: 'Permission denied: view_journal' } } }; };
  try {
    await assert.rejects(fetchServerJournal(), (error) => error.status === 403 && error.message === 'Permission denied: view_journal');
    api.get = async () => { throw new Error('Network offline'); };
    await assert.rejects(fetchServerJournal(), /Network offline/);
  } finally { api.get = original; }
});

test('cancellation remains recognizable so an obsolete response cannot produce an error banner', async () => {
  const original = api.get;
  const error = Object.assign(new Error('Canceled'), { code: 'ERR_CANCELED' });
  api.get = async () => { throw error; };
  try { await assert.rejects(fetchServerJournal(), (received) => received === error); }
  finally { api.get = original; }
});
