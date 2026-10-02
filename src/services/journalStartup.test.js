import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { createServerJournalStartup, SERVER_JOURNAL_STARTUP_TTL_MS } from './journalStartup.js';

const createClock = () => {
  let current = 0;
  let nextId = 0;
  const timers = new Map();
  return {
    now: () => current,
    setTimer: (callback, delay) => {
      const id = ++nextId;
      timers.set(id, { callback, due: current + delay });
      return id;
    },
    clearTimer: (id) => timers.delete(id),
    setTime: (time) => { current = time; },
    advance: (time) => {
      current = time;
      for (const [id, timer] of timers) {
        if (timer.due <= current) {
          timers.delete(id);
          timer.callback();
        }
      }
    },
    timerCount: () => timers.size,
  };
};

const createHarness = () => {
  const clock = createClock();
  const requests = [];
  const startup = createServerJournalStartup({
    ...clock,
    fetchJournal: (options, config) => {
      let resolve;
      let reject;
      const promise = new Promise((fulfill, fail) => { resolve = fulfill; reject = fail; });
      const request = { options, signal: config.signal, resolve, reject };
      request.signal.addEventListener('abort', () => {
        reject(Object.assign(new Error('Journal request aborted'), { code: 'ERR_CANCELED' }));
      }, { once: true });
      requests.push(request);
      return promise;
    },
  });
  return { startup, clock, requests };
};

const response = { entries: [{ id: 'event-1', time: 1, message: 'Latest event' }], next_cursor: '', scope: { mode: 'unrestricted' } };

test('starts the all-filter request immediately and hands that exact request to one consumer', async () => {
  const { startup, clock, requests } = createHarness();
  const prefetched = startup.prime('broker-1:admin-1');
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].options, { filter: 'all' });
  assert.equal(startup.prime('broker-1:admin-1'), prefetched, 'same owner shares the pending request');
  const consumed = startup.take('broker-1:admin-1', new AbortController().signal);
  assert.equal(consumed, prefetched);
  assert.equal(startup.take('broker-1:admin-1'), null, 'the result is never reused for another refresh');
  assert.equal(clock.timerCount(), 0, 'consumption ends startup retention');
  requests[0].resolve(response);
  assert.equal(await consumed, response);
});

test('resolved startup data is held only until a same-owner consumer takes it', async () => {
  const { startup, requests } = createHarness();
  const prefetched = startup.prime('broker-1:admin-1');
  requests[0].resolve(response);
  await prefetched;
  assert.equal(startup.take('broker-2:admin-1'), null, 'another broker cannot consume the response');
  assert.equal(await startup.take('broker-1:admin-1'), response);
  assert.equal(startup.take('broker-1:admin-1'), null);
});

test('superseding an owner cancels the old request and an old cleanup cannot discard the new owner', async () => {
  const { startup, requests } = createHarness();
  const first = startup.prime('broker-1:old-access');
  const second = startup.prime('broker-1:new-access');
  assert.equal(requests[0].signal.aborted, true);
  await assert.rejects(first, { code: 'ERR_CANCELED' });
  startup.discard('broker-1:old-access');
  assert.equal(requests[1].signal.aborted, false);
  assert.equal(startup.take('broker-1:old-access'), null);
  const consumed = startup.take('broker-1:new-access');
  assert.equal(consumed, second);
  requests[1].resolve(response);
  assert.equal(await consumed, response);
});

test('discard cancels an unconsumed request and never leaves an owner available to take', async () => {
  const { startup, clock, requests } = createHarness();
  const prefetched = startup.prime('broker-1:admin-1');
  startup.discard('broker-1:admin-1');
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(clock.timerCount(), 0);
  assert.equal(startup.take('broker-1:admin-1'), null);
  await assert.rejects(prefetched, { code: 'ERR_CANCELED' });
});

test('consumption transfers cancellation to the hook and prevents App cleanup from canceling it', async () => {
  const { startup, clock, requests } = createHarness();
  startup.prime('broker-1:admin-1');
  const controller = new AbortController();
  const consumed = startup.take('broker-1:admin-1', controller.signal);
  startup.discard('broker-1:admin-1');
  clock.advance(SERVER_JOURNAL_STARTUP_TTL_MS + 1);
  assert.equal(requests[0].signal.aborted, false, 'App cleanup and startup expiry no longer own this request');
  controller.abort();
  assert.equal(requests[0].signal.aborted, true);
  await assert.rejects(consumed, { code: 'ERR_CANCELED' });
});

test('a consumer already canceled before the handoff cancels the startup request', async () => {
  const { startup, requests } = createHarness();
  startup.prime('broker-1:admin-1');
  const controller = new AbortController();
  controller.abort();
  const consumed = startup.take('broker-1:admin-1', controller.signal);
  assert.equal(requests[0].signal.aborted, true);
  await assert.rejects(consumed, { code: 'ERR_CANCELED' });
});

test('unused requests are canceled automatically after ten seconds', async () => {
  const { startup, clock, requests } = createHarness();
  const prefetched = startup.prime('broker-1:admin-1');
  clock.advance(SERVER_JOURNAL_STARTUP_TTL_MS - 1);
  assert.equal(requests[0].signal.aborted, false);
  clock.advance(SERVER_JOURNAL_STARTUP_TTL_MS);
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(startup.take('broker-1:admin-1'), null);
  assert.equal(clock.timerCount(), 0);
  await assert.rejects(prefetched, { code: 'ERR_CANCELED' });
});

test('TTL starts when the request starts and delayed timer execution cannot expose an expired response', async () => {
  const { startup, clock, requests } = createHarness();
  const prefetched = startup.prime('broker-1:admin-1');
  clock.setTime(SERVER_JOURNAL_STARTUP_TTL_MS - 1);
  requests[0].resolve(response);
  await prefetched;
  clock.setTime(SERVER_JOURNAL_STARTUP_TTL_MS);
  assert.equal(startup.take('broker-1:admin-1'), null, 'completion does not extend the freshness window');
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(clock.timerCount(), 0);
});

test('priming the same owner after TTL begins a new request rather than extending the old one', async () => {
  const { startup, clock, requests } = createHarness();
  const first = startup.prime('broker-1:admin-1');
  clock.setTime(SERVER_JOURNAL_STARTUP_TTL_MS);
  const second = startup.prime('broker-1:admin-1');
  assert.notEqual(first, second);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].signal.aborted, true);
  await assert.rejects(first, { code: 'ERR_CANCELED' });
  const consumed = startup.take('broker-1:admin-1');
  requests[1].resolve(response);
  assert.equal(await consumed, response);
});

test('403 and connection failures before mount are observed and still delivered unchanged to the hook', async () => {
  for (const error of [Object.assign(new Error('No journal access'), { status: 403 }), new Error('Connection unavailable')]) {
    const { startup, requests } = createHarness();
    startup.prime('broker-1:admin-1');
    requests[0].reject(error);
    // A prefetch can fail long before the workspace attaches an awaiter.
    // Node's test runner also checks this turn for unhandled rejections.
    await setImmediate();
    await assert.rejects(startup.take('broker-1:admin-1'), (caught) => caught === error);
  }
});

test('a synchronous request failure is observed without throwing out of the App effect', async () => {
  const error = new Error('Request setup failed');
  const startup = createServerJournalStartup({ ...createClock(), fetchJournal: () => { throw error; } });
  assert.doesNotThrow(() => startup.prime('broker-1:admin-1'));
  await setImmediate();
  await assert.rejects(startup.take('broker-1:admin-1'), (caught) => caught === error);
});

test('settlement releases the hook abort listener', async () => {
  const { startup, requests } = createHarness();
  const listeners = new Set();
  const signal = {
    aborted: false,
    addEventListener: (event, listener) => { if (event === 'abort') listeners.add(listener); },
    removeEventListener: (event, listener) => { if (event === 'abort') listeners.delete(listener); },
  };
  startup.prime('broker-1:admin-1');
  const consumed = startup.take('broker-1:admin-1', signal);
  assert.equal(listeners.size, 1);
  requests[0].resolve(response);
  await consumed;
  assert.equal(listeners.size, 0);
});
