import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';

async function fixture(t, { failFirstSocket = false } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const original = Object.fromEntries(['window', 'localStorage', 'WebSocket', 'fetch'].map(key => [key, globalThis[key]]));
  let store;
  t.after(() => {
    store?.getState().disconnectWebSocket();
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  });
  const sockets = [], frames = [];
  let socketAttempts = 0, resolveStatus;
  const storage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.localStorage = storage;
  globalThis.window = { localStorage: storage, location: { origin: 'http://localhost:5173' },
    requestAnimationFrame: callback => { frames.push(callback); return frames.length; }, cancelAnimationFrame() {} };
  globalThis.WebSocket = class {
    constructor() {
      socketAttempts++;
      if (failFirstSocket && socketAttempts === 1) throw new Error('Socket unavailable');
      this.readyState = 0; this.closeCalls = []; sockets.push(this);
    }
    send() {}
    close() { this.closeCalls.push(this.readyState); this.readyState = 3; this.onclose?.(); }
  };
  // Leave status HTTP pending: first prices must not depend on its response.
  const pendingStatus = new Promise(resolve => { resolveStatus = resolve; });
  globalThis.fetch = () => pendingStatus;
  const endpointFixture = 'data:text/javascript;base64,' + Buffer.from(`
    export const buildFeedWsUrl = () => 'ws://example.test/feed';
    export const buildFeedStatusUrl = () => 'http://example.test/status';
    export const shouldUseFeedDevProxy = () => false;
  `).toString('base64');
  // Load the real store with Node-resolved imports and only its endpoint config
  // replaced; the browser's Vite config is not available to the Node test runner.
  let source = readFileSync(new URL('./useSymbolStore.js', import.meta.url), 'utf8');
  const imports = {
    zustand: import.meta.resolve('zustand'), 'react-dom': import.meta.resolve('react-dom'),
    'zustand/middleware': import.meta.resolve('zustand/middleware'),
    '../config/endpoints': endpointFixture,
    '../utils/marketWatch': new URL('../utils/marketWatch.js', import.meta.url).href,
    './deferredPersistStorage': new URL('./deferredPersistStorage.js', import.meta.url).href,
    './feedConnectionPolicy': new URL('./feedConnectionPolicy.js', import.meta.url).href,
  };
  for (const [specifier, url] of Object.entries(imports)) source = source.replaceAll(`from '${specifier}'`, `from '${url}'`);
  source += `\n// isolated test: ${t.name}`;
  store = (await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))).default;
  store.getState().initWebSocket();
  return { store, sockets, frames, resolveStatus: payload => resolveStatus({ ok: true, json: async () => payload }) };
}

const settle = async () => { for (let count = 0; count < 12; count++) await Promise.resolve(); };

test('a pending status request never delays socket startup or the first quote', async t => {
  const { store, sockets, frames } = await fixture(t);
  assert.equal(sockets.length, 1);
  sockets[0].readyState = 1;
  sockets[0].onopen();
  sockets[0].onmessage({ data: JSON.stringify({ symbol: 'EURUSD', bid: 1.1, ask: 1.1001 }) });
  assert.equal(store.getState().symbols.EURUSD.bid, '1.10000');
  assert.equal(store.getState().symbols.EURUSD.live, true);
  assert.equal(frames.length, 0, 'first quote commits without waiting for a rendering frame');
});

test('a hung status request is released and can be retried without interrupting live prices', async t => {
  const { store, sockets } = await fixture(t);
  sockets[0].readyState = 1;
  sockets[0].onopen();
  sockets[0].onmessage({ data: '{"symbol":"EURUSD","bid":1.1,"ask":1.1001}' });
  assert(store.getState().statusSyncPromise);
  t.mock.timers.tick(3000);
  await settle();
  assert.equal(store.getState().statusSyncPromise, null);
  assert.equal(store.getState().isConnected, true);
  assert.equal(store.getState().symbols.EURUSD.live, true);
  globalThis.fetch = async (_, options) => {
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.signal.aborted, false);
    return { ok: true, json: async () => ({ symbols: ['EURUSD'] }) };
  };
  await store.getState().syncAvailableSymbols({ force: true });
  assert.equal(store.getState().statusSyncPromise, null);
  assert.equal(store.getState().symbols.EURUSD.bid, '1.10000');
});

test('later quote batches preserve last-move direction in a single frame', async t => {
  const { store, sockets, frames } = await fixture(t);
  sockets[0].onmessage({ data: '{"symbol":"EURUSD","bid":1.1,"ask":1.1001}' });
  sockets[0].onmessage({ data: '[{"symbol":"EURUSD","bid":1.1002,"ask":1.1003},{"symbol":"EURUSD","bid":1.1001,"ask":1.1002}]' });
  assert.equal(frames.length, 1);
  assert.equal(store.getState().symbols.EURUSD.bid, '1.10000');
  frames[0]();
  assert.equal(store.getState().symbols.EURUSD.bid, '1.10010');
  assert.equal(store.getState().symbols.EURUSD.bidDir, 'down');
});

test('a queued frame from a retired socket cannot update the next session', async t => {
  const { store, sockets, frames } = await fixture(t);
  sockets[0].onmessage({ data: '{"symbol":"EURUSD","bid":1.1,"ask":1.1001}' });
  sockets[0].onmessage({ data: '{"symbol":"EURUSD","bid":1.2,"ask":1.2001}' });
  store.getState().disconnectWebSocket();
  frames[0]();
  assert.equal(store.getState().symbols.EURUSD.bid, '1.10000');
  assert.equal(store.getState().isConnected, false);
});

test('a stale server snapshot never becomes a new live quote just by arriving now', async t => {
  const { store, sockets } = await fixture(t);
  sockets[0].onmessage({ data: JSON.stringify({ symbol: 'EURUSD', bid: 1.1, ask: 1.1001,
    fresh: false, stale: true, quote_time_ms: 1700000000000 }) });
  assert.equal(store.getState().symbols.EURUSD.live, false);
  assert.equal(store.getState().symbols.EURUSD.lastUpdate, 1700000000000);
});

test('a handshake timeout retries without closing CONNECTING or accepting a late retired socket', async t => {
  const { store, sockets } = await fixture(t);
  const obsolete = sockets[0];
  t.mock.timers.tick(10000);
  assert.deepEqual(obsolete.closeCalls, [], 'timeout must never cancel the native handshake');
  assert.equal(obsolete.onmessage, null);
  assert.equal(store.getState().ws, null);
  t.mock.timers.tick(1000);
  const current = sockets[1];
  assert.equal(store.getState().ws, current);
  obsolete.readyState = 1; obsolete.onopen();
  assert.deepEqual(obsolete.closeCalls, [1], 'the obsolete socket closes only once open');
  assert.equal(store.getState().ws, current);
  current.readyState = 1; current.onopen();
  assert.equal(store.getState().isConnected, true);
  assert.equal(store.getState().reconnectTimer, null);
});

test('an error during the handshake retires handlers and schedules only one retry', async t => {
  const { store, sockets } = await fixture(t);
  const oldClose = sockets[0].onclose;
  sockets[0].onerror(); oldClose();
  assert.deepEqual(sockets[0].closeCalls, []);
  assert.equal(sockets[0].onmessage, null);
  t.mock.timers.tick(1000);
  assert.equal(sockets.length, 2);
  assert.equal(store.getState().ws, sockets[1]);
});

test('stopping a connecting feed cancels its watchdog and retry timers', async t => {
  const { store, sockets } = await fixture(t);
  store.getState().disconnectWebSocket();
  t.mock.timers.tick(60000);
  assert.equal(sockets.length, 1);
  assert.deepEqual(sockets[0].closeCalls, []);
  assert.equal(sockets[0].onmessage, null);
  sockets[0].readyState = 1; sockets[0].onopen();
  assert.deepEqual(sockets[0].closeCalls, [1]);
  assert.equal(store.getState().isConnected, false);
});

test('origin rejection retires a connecting socket and resumes after the allowlist changes', async t => {
  const { store, sockets, resolveStatus } = await fixture(t);
  resolveStatus({ allowed_browser_origins: ['https://admin.example.test'] }); await settle();
  assert.equal(store.getState().feedOriginBlocked, true);
  assert.equal(store.getState().ws, null);
  assert.deepEqual(sockets[0].closeCalls, []);
  assert.equal(sockets[0].onmessage, null);
  t.mock.timers.tick(10000);
  assert.equal(sockets.length, 1, 'blocked origins must not trigger retry loops');
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ allowed_browser_origins: ['http://localhost:5173'] }) });
  t.mock.timers.tick(5000); await settle();
  assert.equal(store.getState().feedOriginBlocked, false);
  assert.equal(sockets.length, 2);
  sockets[1].readyState = 1; sockets[1].onopen();
  assert.equal(store.getState().isConnected, true);
});

test('socket construction failure also recovers through the bounded retry timer', async t => {
  const { store, sockets } = await fixture(t, { failFirstSocket: true });
  assert.equal(sockets.length, 0);
  t.mock.timers.tick(1000);
  assert.equal(sockets.length, 1);
  sockets[0].readyState = 1; sockets[0].onopen();
  assert.equal(store.getState().isConnected, true);
});
