import { test } from 'node:test';
import assert from 'node:assert/strict';

import { appendWsAuthParams, readWsAuthContext } from './wsAuth.js';
import { redactUrlForLog } from '../lib/logRedaction.js';

const installStorage = (name, values = {}) => {
  const store = new Map(Object.entries(values));
  globalThis[name] = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
};

test('appendWsAuthParams adds broker id only for the feed, without disturbing existing query', () => {
  const url = appendWsAuthParams('wss://broker.example/ws/feed?symbols=EURUSD', {
    brokerId: 'gta_broker',
  });

  assert.equal(url, 'wss://broker.example/ws/feed?symbols=EURUSD&broker_id=gta_broker');
});

test('appendWsAuthParams emits no token param when no token is supplied', () => {
  const url = appendWsAuthParams('wss://broker.example/ws/feed', { brokerId: 'gta_broker' });

  assert.ok(!url.includes('token='), `feed url must not carry a token: ${url}`);
});

test('appendWsAuthParams supports metrics id token and login query', () => {
  const url = appendWsAuthParams('wss://broker.example/manager/OnAccountMetrics', {
    token: 'session-token',
    tokenParam: 'id',
    brokerIdParam: null,
    extraParams: { login: 1001 },
  });

  assert.equal(url, 'wss://broker.example/manager/OnAccountMetrics?id=session-token&login=1001');
});

test('readWsAuthContext returns the session token and broker id, ignoring any feed token', () => {
  installStorage('sessionStorage', {
    broker_info: JSON.stringify({ broker_id: 'gta_broker', feed_token: 'feed-token' }),
    auth: JSON.stringify({ access_token: 'session-token' }),
  });
  installStorage('localStorage', { authToken: 'local-token' });

  assert.deepEqual(readWsAuthContext(), {
    token: 'session-token',
    brokerId: 'gta_broker',
  });
});

test('readWsAuthContext recovers broker info from local storage', () => {
  installStorage('sessionStorage', {
    auth: JSON.stringify({ access_token: 'session-token' }),
  });
  installStorage('localStorage', {
    broker_info: JSON.stringify({ broker_id: 'myprop', feed_token: 'feed-token' }),
    authToken: 'local-token',
  });

  assert.deepEqual(readWsAuthContext(), {
    token: 'session-token',
    brokerId: 'myprop',
  });
});

test('readWsAuthContext yields no token when only a feed token is present', () => {
  installStorage('sessionStorage', {
    broker_info: JSON.stringify({ broker_id: 'nexa', feed_broker_token: 'deadbeef' }),
  });
  installStorage('localStorage', { feedBrokerToken: 'deadbeef' });

  assert.deepEqual(readWsAuthContext(), {
    token: null,
    brokerId: 'nexa',
  });
});

test('redactUrlForLog redacts WebSocket token and id query parameters', () => {
  assert.equal(
    redactUrlForLog('wss://broker.example/ws/feed?token=secret&broker_id=gta_broker'),
    'wss://broker.example/ws/feed?token=[REDACTED]&broker_id=gta_broker'
  );
  assert.equal(
    redactUrlForLog('wss://broker.example/manager/OnAccountMetrics?id=secret&login=1001'),
    'wss://broker.example/manager/OnAccountMetrics?id=[REDACTED]&login=1001'
  );
});
