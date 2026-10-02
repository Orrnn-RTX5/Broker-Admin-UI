import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from 'vite';
import { createBrokerProxy } from './devBrokerProxy.js';
import { DEV_PROXY_BACKEND_COOKIE, DEV_PROXY_EXT_COOKIE, DEV_PROXY_DIRECT_MANAGER_COOKIE } from './devProxy.js';

test('real Vite proxy routes each POST to its selected broker and strips routing cookies', async (t) => {
  const upstream = async (name) => {
    const server = http.createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ name, path: req.url, body, host: req.headers.host,
        origin: req.headers.origin, referer: req.headers.referer, cookie: req.headers.cookie || '',
        ...(req.method === 'GET' ? { authorization: req.headers.authorization || '' } : {}) }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
    return `http://127.0.0.1:${server.address().port}`;
  };
  const a = await upstream('A'), b = await upstream('B');
  const vite = await createServer({
    configFile: false, logLevel: 'silent', appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { host: '127.0.0.1', port: 0, hmr: false, watch: null, proxy: {
      '/manager': createBrokerProxy(a, DEV_PROXY_BACKEND_COOKIE),
      '/api/v1': createBrokerProxy(a, DEV_PROXY_BACKEND_COOKIE),
      '/api/v2': createBrokerProxy(a, DEV_PROXY_BACKEND_COOKIE),
      '/ext-api': createBrokerProxy(a, DEV_PROXY_EXT_COOKIE, { rewrite: p => p.replace(/^\/ext-api/, '') }),
    } },
  });
  t.after(() => vite.close());
  await vite.listen();
  const local = `http://127.0.0.1:${vite.httpServer.address().port}`;
  const request = async (url, cookies) => {
    const response = await fetch(local + url, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookies, Origin: local },
      body: '{"fixture":true}', signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200);
    return response.json();
  };
  await Promise.all(Array.from({ length: 12 }, async (_, i) => {
    const target = i % 2 ? b : a, name = i % 2 ? 'B' : 'A';
    const route = i % 3 ? '/api/v2/admin/login' : '/manager/api/v2/admin/login';
    const result = await request(route,
      `${DEV_PROXY_BACKEND_COOKIE}=${encodeURIComponent(target)}; ${DEV_PROXY_EXT_COOKIE}=${encodeURIComponent(a)}; session=fixture`);
    assert.deepEqual(result, { name, path: route, body: '{"fixture":true}',
      host: new URL(target).host, origin: target, referer: target + '/', cookie: 'session=fixture' });
  }));
  const ext = await request('/ext-api/SessionOverrideSet',
    `${DEV_PROXY_BACKEND_COOKIE}=${encodeURIComponent(a)}; ${DEV_PROXY_EXT_COOKIE}=${encodeURIComponent(b)}`);
  assert.equal(ext.name, 'B');
  assert.equal(ext.path, '/SessionOverrideSet');
  assert.equal(ext.cookie, '');
  const directCookies = `${DEV_PROXY_BACKEND_COOKIE}=${encodeURIComponent(b)}; ${DEV_PROXY_DIRECT_MANAGER_COOKIE}=${encodeURIComponent(b)}`;
  const direct = await request('/manager/api/v2/admin/login', directCookies);
  assert.equal(direct.name, 'B');
  assert.equal(direct.path, '/api/v2/admin/login');
  assert.equal(direct.cookie, '');
  assert.equal((await request('/manager/GroupList', directCookies)).path, '/GroupList');
  for (const [name, target] of [['A', a], ['B', b]]) {
    const response = await fetch(local + '/api/v1/manager/journal?limit=200', {
      headers: { Authorization: 'Bearer test-journal-session', Origin: local,
        Cookie: `${DEV_PROXY_BACKEND_COOKIE}=${encodeURIComponent(target)}; ${DEV_PROXY_DIRECT_MANAGER_COOKIE}=${encodeURIComponent(target)}` },
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.status, 200);
    const journal = await response.json();
    assert.equal(journal.name, name);
    assert.equal(journal.path, '/api/v1/manager/journal?limit=200');
    assert.equal(journal.authorization, 'Bearer test-journal-session');
    assert.equal(journal.origin, target);
    assert.equal(journal.cookie, '');
  }
  const otherBroker = await request('/manager/api/v2/admin/login',
    `${DEV_PROXY_BACKEND_COOKIE}=${encodeURIComponent(a)}; ${DEV_PROXY_DIRECT_MANAGER_COOKIE}=${encodeURIComponent(b)}`);
  assert.equal(otherBroker.name, 'A');
  assert.equal(otherBroker.path, '/manager/api/v2/admin/login');
  const fallback = await request('/api/v2/admin/login', `${DEV_PROXY_BACKEND_COOKIE}=file%3A%2F%2F%2Finvalid`);
  assert.equal(fallback.name, 'A');
  assert.equal(fallback.cookie, '');
});
