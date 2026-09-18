import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEV_PROXY_BACKEND_COOKIE,
  parseDevProxyTarget,
  readCookieValue,
  stripDevProxyCookies,
} from './devProxy.js';

test('parseDevProxyTarget keeps http and https origins and rejects other schemes', () => {
  assert.equal(
    parseDevProxyTarget('https://services.growtradingacademy.com/manager'),
    'https://services.growtradingacademy.com'
  );
  assert.equal(parseDevProxyTarget('http://127.0.0.1:8091/api'), 'http://127.0.0.1:8091');
  assert.equal(parseDevProxyTarget('file:///tmp/secret', 'https://fallback.example'), 'https://fallback.example');
  assert.equal(parseDevProxyTarget('', 'https://fallback.example'), 'https://fallback.example');
});

test('dev proxy cookie helpers read the selected broker and strip local routing cookies', () => {
  const cookie = `${DEV_PROXY_BACKEND_COOKIE}=${encodeURIComponent('https://services.growtradingacademy.com')}; session=abc`;

  assert.equal(
    readCookieValue(cookie, DEV_PROXY_BACKEND_COOKIE),
    'https://services.growtradingacademy.com'
  );
  assert.equal(stripDevProxyCookies(cookie), 'session=abc');
});
