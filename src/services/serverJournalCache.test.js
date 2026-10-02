import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { createServerJournalCache, SERVER_JOURNAL_FRESH_MS, SERVER_JOURNAL_WARM_MS } from './serverJournalCache.js';

const page = id => ({ entries: [{ id, time: 1 }], next_cursor: 'older-' + id, scope: { mode: 'unrestricted' } });
const harness = () => {
  let now = 0;
  const requests = [];
  const cache = createServerJournalCache({ now: () => now, fetchJournal: (options, { signal }) => {
    let resolve, reject;
    const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
    requests.push({ options, signal, resolve, reject });
    return promise; // Deliberately permits late completion after abort.
  } });
  return { cache, requests, setTime: value => { now = value; } };
};

test('first pages are shared by prefetch and foreground readers, including empty results', async () => {
  const { cache, requests } = harness();
  const a = cache.read('scope-a', 'errors'), b = cache.read('scope-a', 'errors');
  assert.equal(requests.length, 1);
  const empty = { entries: [], next_cursor: '', scope: { mode: 'unrestricted' } };
  requests[0].resolve(empty);
  assert.equal(await a, empty); assert.equal(await b, empty);
  assert.equal(await cache.read('scope-a', 'errors'), empty);
  assert.equal(cache.peek('scope-a', 'errors').data, empty);
  assert.equal(cache.peek('scope-b', 'errors'), null);
});

test('cached pages remain available while a stale page is refreshed, and refresh can bypass freshness', async () => {
  const { cache, requests, setTime } = harness();
  const first = cache.read('scope-a'); requests[0].resolve(page('first')); await first;
  setTime(SERVER_JOURNAL_FRESH_MS);
  const next = cache.read('scope-a');
  assert.equal(cache.peek('scope-a', 'all').data.entries[0].id, 'first');
  requests[1].resolve(page('next')); await next;
  const forced = cache.read('scope-a', 'all', { force: true });
  assert.equal(requests.length, 3);
  requests[2].resolve(page('forced')); await forced;
  assert.equal(cache.peek('scope-a', 'all').data.entries[0].id, 'forced');
});

test('canceling a view does not cancel its shared prefetch, and removes its abort listener', async () => {
  const { cache, requests } = harness();
  const background = cache.read('scope-a', 'warnings');
  const controller = new AbortController();
  const view = cache.read('scope-a', 'warnings', { signal: controller.signal });
  controller.abort();
  await assert.rejects(view, { code: 'ERR_CANCELED' });
  assert.equal(requests[0].signal.aborted, false);
  requests[0].resolve(page('warning')); await background;
  assert.equal(cache.peek('scope-a', 'warnings').data.entries[0].id, 'warning');
});

test('broker or authorization changes abort old requests and reject their late results', async () => {
  const { cache, requests } = harness();
  const old = cache.read('old-scope', 'errors');
  const current = cache.read('new-scope', 'errors');
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(cache.peek('old-scope', 'errors'), null);
  requests[0].resolve(page('old')); await assert.rejects(old, { code: 'ERR_CANCELED' });
  requests[1].resolve(page('current')); await current;
  assert.equal(cache.peek('new-scope', 'errors').data.entries[0].id, 'current');
});

test('a permission denial clears all filters and ignores other in-flight responses', async () => {
  const { cache, requests } = harness();
  const all = cache.read('scope-a'); requests[0].resolve(page('all')); await all;
  const errors = cache.read('scope-a', 'errors'), warnings = cache.read('scope-a', 'warnings');
  const denied = Object.assign(new Error('No journal access'), { status: 403 });
  requests[1].reject(denied); await assert.rejects(errors, { status: 403 });
  assert.equal(cache.peek('scope-a', 'all'), null);
  assert.equal(cache.getDenial('scope-a'), denied);
  assert.equal(requests[2].signal.aborted, true);
  requests[2].resolve(page('obsolete')); await assert.rejects(warnings, { code: 'ERR_CANCELED' });
  assert.equal(cache.peek('scope-a', 'warnings'), null);
  await assert.rejects(cache.read('scope-a', 'all'), { status: 403 });
  assert.equal(requests.length, 3, 'Changing a filter cannot silently restore denied data');
  const retry = cache.read('scope-a', 'errors', { force: true });
  requests[3].resolve(page('restored')); await retry;
  assert.equal(cache.getDenial('scope-a'), null);
});

test('two background workers prepare every filter without duplicate requests or repeated warming', async () => {
  const { cache, requests } = harness();
  const warming = cache.warm('scope-a');
  assert.equal(requests.length, 2);
  assert.deepEqual(requests.map(r => r.options.filter), ['errors', 'warnings']);
  assert.equal(cache.warm('scope-a'), warming);
  let resolved = 0;
  while (resolved < 9) {
    const batch = requests.slice(resolved);
    for (const request of batch) request.resolve(page(request.options.filter));
    resolved += batch.length;
    await setImmediate();
  }
  await warming;
  assert.equal(new Set(requests.map(r => r.options.filter)).size, 9);
  await cache.warm('scope-a');
  assert.equal(requests.length, 9);
});

test('background failures wait before retry and never hide a cached successful page', async () => {
  const { cache, requests, setTime } = harness();
  const first = cache.read('scope-a', 'errors'); requests[0].resolve(page('old')); await first;
  const refresh = cache.read('scope-a', 'errors', { force: true });
  requests[1].reject(new Error('Connection unavailable')); await assert.rejects(refresh);
  assert.equal(cache.peek('scope-a', 'errors').data.entries[0].id, 'old');
  const warm = cache.warm('scope-a');
  assert(!requests.slice(2).some(r => r.options.filter === 'errors'));
  cache.clear();
  for (const request of requests.slice(2)) request.resolve(page('obsolete'));
  await warm;
  setTime(SERVER_JOURNAL_WARM_MS);
  assert.equal(cache.peek('scope-a', 'errors'), null);
});

test('sign-out clears ready pages and aborts pending work without retaining records', async () => {
  const { cache, requests } = harness();
  const first = cache.read('scope-a'); requests[0].resolve(page('first')); await first;
  const pending = cache.read('scope-a', 'errors');
  cache.clear();
  assert.equal(cache.peek('scope-a', 'all'), null);
  assert.equal(requests[1].signal.aborted, true);
  requests[1].resolve(page('late')); await assert.rejects(pending, { code: 'ERR_CANCELED' });
});
