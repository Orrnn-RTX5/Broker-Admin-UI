import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers';
import { extractMarketTicks, startSessionMarketFeed } from './sessionMarketFeed.js';

const settle = () => new Promise((resolve) => setImmediate(resolve));
const fixture = (options = {}) => {
  const sockets = [];
  const ticks = [];
  let tickets = 0;
  const stop = startSessionMarketFeed({
    requestTicket: async () => ({ ticket: `one-use-${++tickets}` }),
    buildUrl: (ticket) => `wss://broker/manager/OnTick?ticket=${ticket}`,
    createSocket: (url) => {
      const socket = { url, close() { this.closed = true; this.onclose?.(); } };
      sockets.push(socket);
      return socket;
    },
    onTicks: (batch) => ticks.push(...batch),
    retryMs: 5,
    ...options,
  });
  return { sockets, ticks, stop };
};

test('streams using automatic session authorization and obtains a new ticket after disconnect', async () => {
  const feed = fixture();
  try {
    await settle();
    assert.equal(feed.sockets[0].url, 'wss://broker/manager/OnTick?ticket=one-use-1');
    feed.sockets[0].onopen();
    feed.sockets[0].onmessage({ data: '{"symbol":"EURUSD","bid":1.1,"ask":1.2}' });
    assert.equal(feed.ticks[0].symbol, 'EURUSD');
    feed.sockets[0].close();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(feed.sockets[1].url, 'wss://broker/manager/OnTick?ticket=one-use-2');
  } finally { feed.stop(); }
});

test('logout while authorization is pending never opens a socket', async () => {
  let resolve;
  const feed = fixture({ requestTicket: () => new Promise((done) => { resolve = done; }) });
  feed.stop();
  resolve({ ticket: 'late' });
  await settle();
  assert.equal(feed.sockets.length, 0);
});

test('stopped connections ignore late prices and do not reconnect', async () => {
  const feed = fixture();
  await settle();
  feed.stop();
  feed.sockets[0].onmessage({ data: '{"symbol":"EURUSD","bid":1,"ask":2}' });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(feed.ticks.length, 0);
  assert.equal(feed.sockets.length, 1);
  assert.equal(feed.sockets[0].closed, true);
});

test('missing authorization never opens an anonymous socket', async () => {
  const feed = fixture({ requestTicket: async () => ({ error: 'Not authenticated' }) });
  await settle();
  feed.stop();
  assert.equal(feed.sockets.length, 0);
});

test('silent feed becomes stale and resumes on real ticks without a new socket', async () => {
  const states = [];
  const feed = fixture({ staleTimeoutMs: 10, onState: state => states.push(state) });
  try {
    await settle();
    feed.sockets[0].onopen();
    feed.sockets[0].onmessage({ data: '{"type":"ping"}' });
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(states.at(-1), 'stale');
    feed.sockets[0].onmessage({ data: '{"symbol":"EURUSD","bid":1.1,"ask":1.2}' });
    assert.equal(states.at(-1), 'connected');
    assert.equal(feed.ticks.length, 1);
    assert.equal(feed.sockets.length, 1);
  } finally { feed.stop(); }
});

test('parses tick batches and envelopes while ignoring malformed data and control frames', () => {
  const rows = extractMarketTicks('broken\n{"type":"ping"}\n{"data":{"symbol":"BTCUSD","bid":100,"ask":101}}\n[{"symbol":"EURUSD","bid":1,"ask":2},{"symbol":"BAD","bid":null,"ask":0}]');
  assert.deepEqual(rows.map((row) => row.symbol), ['BTCUSD', 'EURUSD']);
});
