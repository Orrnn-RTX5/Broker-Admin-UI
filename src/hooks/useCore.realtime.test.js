import assert from 'node:assert/strict';
import { test, beforeEach, afterEach, after } from 'node:test';
import { readFile } from 'node:fs/promises';

// Run the real hook/cache code with deterministic hook storage and auth/network
// boundaries. Deferred responses reproduce races without rendering a browser.
const subscribers = new Set();
let auth = { isAuthenticated: true, accessToken: 'session-initial' };
let current;
const runtime = {
  useState(initial) {
    const host = current, index = host.cursor++;
    host.values[index] = initial;
    return [initial, value => { host.values[index] = value; }];
  },
  useRef(initial) { return { current: initial }; },
  useCallback(callback) { return callback; },
  useEffect(effect) { current.effects.push(effect); },
  auth: Object.assign(selector => selector(auth), {
    getState: () => auth,
    subscribe: listener => { subscribers.add(listener); return () => subscribers.delete(listener); },
  }),
};
globalThis.__adminHookRuntime = runtime;
// Replace only import boundaries; every hook/cache statement below them is the
// production implementation, executed rather than inspected as text.
const source = (await readFile(new URL('./useCore.js', import.meta.url), 'utf8'))
  .replace(/import \{[^}]+\} from 'react';/, 'const {useState,useRef,useCallback,useEffect}=globalThis.__adminHookRuntime;')
  .replace("import { useAuthStore } from '../store/authStore';", 'const useAuthStore=globalThis.__adminHookRuntime.auth;');
const { useDataFetch } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const setSession = next => { auth = next; for (const listener of subscribers) listener(auth); };
const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
const settle = () => new Promise(resolve => setImmediate(resolve));
let hosts, requests, counter = 0;
const fetchData = () => { const pending = deferred(); requests.push(pending); return pending.promise; };
function mount() {
  const host = { cursor: 0, values: [], effects: [], cleanups: [] };
  current = host;
  host.result = useDataFetch(fetchData, null, [], true, { requestKey: 'accounts', cacheTtlMs: 60_000 });
  current = null;
  for (const effect of host.effects) { const cleanup = effect(); if (typeof cleanup === 'function') host.cleanups.push(cleanup); }
  hosts.push(host);
  return host;
}
beforeEach(() => {
  hosts = []; requests = []; globalThis.window = new EventTarget();
  setSession({ isAuthenticated: true, accessToken: `session-${++counter}` });
});
afterEach(() => { for (const host of hosts) for (const cleanup of host.cleanups) cleanup(); delete globalThis.window; });
after(() => { delete globalThis.__adminHookRuntime; });

test('state event during a read forces a new request and late response cannot replace cache', async () => {
  const first = mount();
  assert.equal(requests.length, 1);
  window.dispatchEvent(new Event('admin:state-changed'));
  assert.equal(requests.length, 2, 'invalidation must not join the pre-change snapshot');
  requests[1].resolve({ balance: 20 }); await settle();
  requests[0].resolve({ balance: 10 }); await settle();
  assert.deepEqual(first.values[0], { balance: 20 });
  const cached = mount(); await settle();
  assert.deepEqual(cached.values[0], { balance: 20 });
  assert.equal(requests.length, 2, 'a new consumer should receive the newest cached snapshot');
});

test('older completion cannot detach a newer request that another view must join', async () => {
  mount();
  window.dispatchEvent(new Event('admin:state-changed'));
  requests[0].resolve({ balance: 10 }); await settle();
  const joining = mount();
  assert.equal(requests.length, 2, 'old finally must not remove the newer pending promise');
  requests[1].resolve({ balance: 30 }); await settle();
  assert.deepEqual(joining.values[0], { balance: 30 });
});

test('session switch discards both cached data and late prior-session responses', async () => {
  const prior = mount();
  const priorRequest = requests[0];
  setSession({ isAuthenticated: false, accessToken: null });
  setSession({ isAuthenticated: true, accessToken: 'new-session' });
  const next = mount();
  assert.equal(requests.length, 2);
  requests[1].resolve({ owner: 'new' }); await settle();
  priorRequest.resolve({ owner: 'old-private-data' }); await settle();
  assert.equal(prior.values[0], null, 'old session request must not commit after logout');
  assert.deepEqual(next.values[0], { owner: 'new' });
  const cached = mount(); await settle();
  assert.deepEqual(cached.values[0], { owner: 'new' });
  assert.equal(requests.length, 2);
  setSession({ isAuthenticated: false, accessToken: null });
  setSession({ isAuthenticated: true, accessToken: 'new-session' });
  const signedInAgain = mount();
  assert.equal(requests.length, 3, 'logout must clear cache even when the next token is identical');
  requests[2].resolve({ owner: 'signed-in-again' }); await settle();
  assert.deepEqual(signedInAgain.values[0], { owner: 'signed-in-again' });
});

test('scoped denial clears displayed and cached rows; retry cannot reuse the denied snapshot', async () => {
 const host=mount();requests[0].resolve({rows:[{login:'1001',group:'old'}]});await settle();
 assert.equal(host.values[0].rows[0].group,'old');
 const denied=Object.assign(Error('scope denied'),{__rtx5SuppressLog:true});
 const deniedRead=host.result.mutate(); requests[1].reject(denied); await deniedRead;
 assert.equal(host.values[0],null); assert.equal(host.values[2],denied);
 const retry=mount(); assert.equal(requests.length,3);
 requests[2].resolve({rows:[{login:'1001',group:'new'}]});await settle();
 assert.equal(retry.values[0].rows[0].group,'new');
});
