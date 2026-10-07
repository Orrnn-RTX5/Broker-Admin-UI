import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { createServer } from 'vite';
import { createBrokerProxy } from './devBrokerProxy.js';
import { DEV_PROXY_BACKEND_COOKIE, DEV_PROXY_EXT_COOKIE, DEV_PROXY_DIRECT_MANAGER_COOKIE, DEV_PROXY_FEED_COOKIE } from './devProxy.js';

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

test('real Vite WebSocket upgrades follow the selected broker and direct manager routing', async t => {
  const received = [];
  const sockets = new Set();
  const upstream = async name => {
    const server = http.createServer();
    server.on('upgrade', (req, socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
      received.push({ name, path: req.url, origin: req.headers.origin, cookie: req.headers.cookie || '' });
      const accept = createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
      socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => { for (const socket of sockets) socket.destroy(); return new Promise(resolve => server.close(resolve)); });
    return `http://127.0.0.1:${server.address().port}`;
  };
  const a = await upstream('A'), b = await upstream('B');
  const vite = await createServer({
    configFile: false, logLevel: 'silent', appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] },
    server: { host: '127.0.0.1', port: 0, hmr: false, watch: null, proxy: {
      '/manager': createBrokerProxy(a, DEV_PROXY_BACKEND_COOKIE, { ws: true }),
    } },
  });
  t.after(() => vite.close());
  await vite.listen();
  const local = `http://127.0.0.1:${vite.httpServer.address().port}`;
  const upgrade = cookies => new Promise((resolve, reject) => {
    const req = http.request(local + '/manager/api/v1/manager/access/events?ticket=fixture', { headers: {
      Upgrade: 'websocket', Connection: 'Upgrade', 'Sec-WebSocket-Version': '13',
      'Sec-WebSocket-Key': Buffer.alloc(16, 1).toString('base64'), Cookie: cookies, Origin: local,
    } });
    req.setTimeout(5000, () => req.destroy(new Error('WebSocket upgrade timed out')));
    req.on('upgrade', (res, socket) => { socket.destroy(); resolve(res.statusCode); });
    req.on('error', reject);
    req.on('response', res => { res.resume(); reject(new Error(`Unexpected HTTP ${res.statusCode}`)); });
    req.end();
  });
  assert.equal(await upgrade(`${DEV_PROXY_BACKEND_COOKIE}=${encodeURIComponent(b)}; ${DEV_PROXY_DIRECT_MANAGER_COOKIE}=${encodeURIComponent(b)}; session=fixture`), 101);
  assert.equal(await upgrade(`${DEV_PROXY_BACKEND_COOKIE}=${encodeURIComponent(a)}; session=fixture`), 101);
  assert.deepEqual(received, [
    { name: 'B', path: '/api/v1/manager/access/events?ticket=fixture', origin: local, cookie: 'session=fixture' },
    { name: 'A', path: '/manager/api/v1/manager/access/events?ticket=fixture', origin: local, cookie: 'session=fixture' },
  ]);
});

test('Vite reuses upstream connections and retries a reset read once without replaying mutations', async t => {
  const requests = [], counts = new Map();
  const upstream = http.createServer(async (req, res) => {
    const count = (counts.get(req.url) || 0) + 1;
    counts.set(req.url, count);
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({ path: req.url, method: req.method, body, port: req.socket.remotePort,
      cookie: req.headers.cookie || '', authorization: req.headers.authorization || '' });
    if (req.url.endsWith('/always-reset') || req.url.endsWith('/mutate')
      || req.url.endsWith('?always-reset') || req.url === '/manager/GroupDelete' || req.url.endsWith('/Disconnect')
      || (req.url.endsWith('/auth/me') && count === 1)) {
      req.socket.destroy();
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ count, port: req.socket.remotePort }));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => { upstream.closeAllConnections(); return new Promise(resolve => upstream.close(resolve)); });
  const target = `http://127.0.0.1:${upstream.address().port}`;
  const vite = await createServer({
    configFile: false, logLevel: 'silent', appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] },
    server: { host: '127.0.0.1', port: 0, hmr: false, watch: null, proxy: {
      '/manager': createBrokerProxy('http://127.0.0.1:1', DEV_PROXY_BACKEND_COOKIE),
      '/ws/feed/status': createBrokerProxy('http://127.0.0.1:1', DEV_PROXY_FEED_COOKIE),
    } },
  });
  t.after(() => vite.close());
  await vite.listen();
  const local = `http://127.0.0.1:${vite.httpServer.address().port}`;
  const headers = { Cookie: `${DEV_PROXY_BACKEND_COOKIE}=${encodeURIComponent(target)}; ${DEV_PROXY_FEED_COOKIE}=${encodeURIComponent(target)}; session=fixture`, Authorization: 'Bearer fixture' };
  const started = performance.now();
  const recovered = await fetch(local + '/manager/api/v2/auth/me', { headers, signal: AbortSignal.timeout(5000) });
  assert.equal(recovered.status, 200);
  assert.equal((await recovered.json()).count, 2);
  assert(performance.now() - started < 2000, 'Recovery should not wait for a polling interval');
  for (const request of requests) {
    assert.equal(request.cookie, 'session=fixture');
    assert.equal(request.authorization, 'Bearer fixture');
  }
  const first = await fetch(local + '/manager/pool', { headers });
  const firstPort = (await first.json()).port;
  const second = await fetch(local + '/manager/pool', { headers });
  assert.equal((await second.json()).port, firstPort, 'API reads should reuse the same upstream TCP connection');
  const status = await fetch(local + '/ws/feed/status', { headers });
  assert.equal(status.status, 200);
  await status.json();
  const failure = await fetch(local + '/manager/api/v2/auth/me?always-reset', { headers });
  assert.equal(failure.status, 502);
  assert.equal(counts.get('/manager/api/v2/auth/me?always-reset'), 2, 'Read retries must be bounded');
  for (const path of ['/manager/GroupDelete', '/manager/Disconnect']) {
    const legacyWrite = await fetch(local + path, { headers });
    assert.equal(legacyWrite.status, 502);
    assert.equal(counts.get(path), 1, 'Legacy GET actions must never be repeated');
  }
  const mutation = await fetch(local + '/manager/mutate', { method: 'POST', headers, body: '{"fixture":true}' });
  assert.equal(mutation.status, 502);
  assert.equal(counts.get('/manager/mutate'), 1, 'A mutation must never be repeated');
  assert.equal(requests.find(request => request.method === 'POST').body, '{"fixture":true}');
});
