import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAuthAccessToken,
  getAuthExpiresAt,
  getAuthExpiresIn,
  getAuthPrimaryPayload,
  getAuthRefreshToken,
} from './authSession.js';

test('auth session parser accepts direct token field variants', () => {
  assert.equal(getAuthAccessToken({ token: 'token-a' }), 'token-a');
  assert.equal(getAuthAccessToken({ access_token: 'token-b' }), 'token-b');
  assert.equal(getAuthAccessToken({ accessToken: 'token-c' }), 'token-c');
  assert.equal(getAuthAccessToken({ session_token: 'token-d' }), 'token-d');
  assert.equal(getAuthAccessToken({ sessionToken: 'token-e' }), 'token-e');
  assert.equal(getAuthAccessToken({ AUTH_TOKEN: 'token-f' }), 'token-f');
  assert.equal(getAuthAccessToken({ 'bearer-token': 'token-g' }), 'token-g');
  assert.equal(getAuthAccessToken({ Authorization: 'Bearer token-h' }), 'token-h');
});

test('auth session parser accepts common wrapped response shapes', () => {
  const response = {
    value: {
      accessToken: 'wrapped-token',
      refreshToken: 'wrapped-refresh',
      expiresIn: 3600,
      broker_id: 'myprop-trade',
    },
  };

  assert.equal(getAuthAccessToken(response), 'wrapped-token');
  assert.equal(getAuthRefreshToken(response), 'wrapped-refresh');
  assert.equal(getAuthExpiresIn(response), 3600);
  assert.equal(getAuthPrimaryPayload(response).broker_id, 'myprop-trade');
});

test('auth session parser keeps expiry field variants aligned with token extraction', () => {
  assert.equal(getAuthExpiresAt({ data: { token_expires_at: '3600' } }), '3600');
  assert.equal(getAuthExpiresAt({ answer: { tokenExpiresAt: '3600' } }), '3600');
  assert.equal(getAuthExpiresIn({ result: { expires_in: '7200' } }), '7200');
});

test('auth session parser accepts wrapped session id fields from broker login responses', () => {
  const response = {
    data: {
      value: {
        sessionId: '3d60f1b9-df9a-5495-f5f0-374e624d3941',
      },
    },
  };

  assert.equal(getAuthAccessToken(response), '3d60f1b9-df9a-5495-f5f0-374e624d3941');
  assert.equal(getAuthPrimaryPayload(response).sessionId, '3d60f1b9-df9a-5495-f5f0-374e624d3941');
});

test('auth session parser accepts token-like id fields but not numeric login ids', () => {
  assert.equal(
    getAuthAccessToken({ id: '3d60f1b9-df9a-5495-f5f0-374e624d3941' }),
    '3d60f1b9-df9a-5495-f5f0-374e624d3941'
  );
  assert.equal(getAuthAccessToken({ id: 10017 }), null);
});

test('auth session parser accepts primitive wrapper token responses', () => {
  assert.equal(
    getAuthAccessToken({ value: '3d60f1b9-df9a-5495-f5f0-374e624d3941' }),
    '3d60f1b9-df9a-5495-f5f0-374e624d3941'
  );
  assert.equal(getAuthAccessToken('3d60f1b9-df9a-5495-f5f0-374e624d3941'), '3d60f1b9-df9a-5495-f5f0-374e624d3941');
  assert.equal(getAuthAccessToken({ value: 'ok' }), null);
});

test('auth session parser returns token values as stable strings', () => {
  assert.equal(getAuthAccessToken({ session_id: 123456 }), '123456');
});
