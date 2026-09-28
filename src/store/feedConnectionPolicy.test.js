import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getFeedOriginError, getFeedReconnectDelayMs } from './feedConnectionPolicy.js';

test('feed origin preflight blocks a port absent from the server allowlist', () => {
  const allowed = ['https://admin.orrnn.com', 'http://localhost:5173'];
  assert.match(getFeedOriginError(allowed, 'http://localhost:5174'), /http:\/\/localhost:5174/);
  assert.equal(getFeedOriginError(allowed, 'http://localhost:5173'), '');
});

test('feed origin preflight defers to the configured local WebSocket proxy', () => {
  const allowed = ['http://localhost:5173'];
  assert.equal(getFeedOriginError(allowed, 'http://localhost:5174', true), '');
  assert.equal(getFeedOriginError(null, 'http://localhost:5174'), '');
});

test('feed retry backs off and caps its delay', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(getFeedReconnectDelayMs),
    [1000, 2000, 4000, 8000, 16000, 30000, 30000]);
});
