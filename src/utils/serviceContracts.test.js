import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCloseAllRequest,
  buildDisconnectRequest,
  buildInstrumentToggleRequest,
} from './serviceContracts.js';

test('buildCloseAllRequest matches gateway admin close-all JSON body contract', () => {
  assert.deepEqual(buildCloseAllRequest({ login: 1001, symbol: 'EURUSD', comment: 'admin close' }), {
    method: 'post',
    url: '/api/v2/admin/close-all',
    data: { symbol: 'EURUSD' },
  });
});

test('buildCloseAllRequest requires a symbol', () => {
  assert.throws(() => buildCloseAllRequest({ login: 1002 }), /symbol is required/);
});

test('buildInstrumentToggleRequest matches gateway PATCH toggle contract', () => {
  assert.deepEqual(buildInstrumentToggleRequest('EURUSD', true), {
    method: 'patch',
    url: '/api/v2/admin/instruments/EURUSD/toggle',
    data: { enabled: true },
  });
  assert.deepEqual(buildInstrumentToggleRequest('EURUSD', false), {
    method: 'patch',
    url: '/api/v2/admin/instruments/EURUSD/toggle',
    data: { enabled: false },
  });
});

test('buildInstrumentToggleRequest encodes path symbols and requires a symbol', () => {
  assert.equal(
    buildInstrumentToggleRequest('BTC/USD', true).url,
    '/api/v2/admin/instruments/BTC%2FUSD/toggle'
  );
  assert.throws(() => buildInstrumentToggleRequest('', true), /symbol is required/);
});

test('buildDisconnectRequest sends id token and preserves auth query through interceptor', () => {
  assert.deepEqual(buildDisconnectRequest('session-token'), {
    method: 'get',
    url: '/Disconnect',
    config: {
      params: { id: 'session-token' },
      _noRetry: true,
      _preserveAuthQuery: true,
    },
  });
});
