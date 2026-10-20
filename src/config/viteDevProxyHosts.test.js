import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDevProxyHosts } from '../../vite.config.js';

test('resolveDevProxyHosts returns empty strings when nothing is configured', () => {
  assert.deepEqual(resolveDevProxyHosts({}), {
    apiHost: '',
    apiHostExt: '',
    superAdminHost: '',
    wsFeedHost: '',
  });
});

test('resolveDevProxyHosts strict throws only for the deploy-required pair', () => {
  assert.throws(
    () => resolveDevProxyHosts({}, { strict: true }),
    /VITE_API_HOST is not configured/
  );
  assert.throws(
    () => resolveDevProxyHosts({ VITE_API_HOST: 'https://api.example.test' }, { strict: true }),
    /VITE_FEED_WS_URL is not configured/
  );
  const resolved = resolveDevProxyHosts(
    {
      VITE_API_HOST: 'https://api.example.test',
      VITE_FEED_WS_URL: 'wss://feed.example.test/ws/feed',
    },
    { strict: true }
  );
  assert.equal(resolved.apiHost, 'https://api.example.test');
  assert.equal(resolved.wsFeedHost, 'wss://feed.example.test/ws/feed');
});

test('resolveDevProxyHosts strict never throws for missing optional hosts', () => {
  const resolved = resolveDevProxyHosts(
    {
      VITE_API_HOST: 'https://api.example.test',
      VITE_FEED_WS_URL: 'wss://feed.example.test/ws/feed',
    },
    { strict: true }
  );
  assert.equal(resolved.apiHostExt, '');
  assert.equal(resolved.superAdminHost, '');
});

test('resolveDevProxyHosts non-strict never throws, even fully unconfigured', () => {
  const resolved = resolveDevProxyHosts({});
  assert.equal(resolved.apiHost, '');
  assert.equal(resolved.wsFeedHost, '');
  assert.equal(resolved.apiHostExt, '');
  assert.equal(resolved.superAdminHost, '');
});

test('resolveDevProxyHosts honours plain and legacy alias keys', () => {
  assert.equal(
    resolveDevProxyHosts({ API_HOST: 'https://plain.example.test' }).apiHost,
    'https://plain.example.test'
  );
  assert.equal(
    resolveDevProxyHosts({ VITE_API_URL: 'https://legacy.example.test' }).apiHost,
    'https://legacy.example.test'
  );
  assert.equal(
    resolveDevProxyHosts({ WS_HOST: 'wss://ws.example.test/ws/feed' }).wsFeedHost,
    'wss://ws.example.test/ws/feed'
  );
  assert.equal(
    resolveDevProxyHosts({ SUPER_ADMIN_API_HOST: 'https://sa.example.test' }).superAdminHost,
    'https://sa.example.test'
  );
});
