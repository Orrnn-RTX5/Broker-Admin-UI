import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startSessionStateFeed } from './sessionStateFeed.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
test('state changes coalesce, reconnect reloads, and obsolete sockets cannot affect new session', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const sockets = [];
  let tickets = 0, changes = 0;
  const stop = startSessionStateFeed({
    requestTicket: async () => ({ ticket: String(++tickets) }),
    buildUrl: ticket => `ws://example/state?ticket=${ticket}`,
    createSocket: url => {
      const socket = { url, close() { this.onclose?.(); } };
      sockets.push(socket); return socket;
    },
    onChange: () => changes++, retryMs: 10,
  });
  await settle();
  sockets[0].onopen();
  for (let i = 0; i < 20; i++) sockets[0].onmessage({ data: '{"type":"state_changed"}' });
  t.mock.timers.tick(50);
  assert.equal(changes, 1);
  sockets[0].onclose();
  t.mock.timers.tick(10);
  await settle();
  sockets[1].onopen();
  sockets[0].onerror();
  t.mock.timers.tick(50);
  assert.equal(changes, 2);
  assert.equal(tickets, 2);
  stop();
  sockets[1].onmessage({ data: '{"type":"state_changed"}' });
  t.mock.timers.tick(1000);
  assert.equal(changes, 2);
});

test('late ticket from a timed-out request never creates a second socket', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let resolveOld;
  let requests = 0;
  const sockets = [];
  const stop = startSessionStateFeed({
    requestTicket: () => ++requests === 1 ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve({ ticket: 'new' }),
    buildUrl: ticket => ticket,
    createSocket: url => { const socket = { url, close() {} }; sockets.push(socket); return socket; },
    onChange() {}, retryMs: 10,
  });
  t.mock.timers.tick(10000);
  t.mock.timers.tick(10);
  await settle();
  resolveOld({ ticket: 'obsolete' });
  await settle();
  assert.deepEqual(sockets.map(socket => socket.url), ['new']);
  stop();
});
