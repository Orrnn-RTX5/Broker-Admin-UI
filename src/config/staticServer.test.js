import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const startServerProcess = async (t, envOverrides = {}) => {
  const cleanEnv = { ...process.env };
  for (const key of ['API_HOST_EXT', 'VITE_API_HOST_EXT', 'API_HOST', 'VITE_API_HOST']) {
    delete cleanEnv[key];
  }
  const server = spawn(process.execPath, [fileURLToPath(new URL('../../server.js', import.meta.url))], {
    env: { ...cleanEnv, PORT: '0', HOST: '127.0.0.1', ...envOverrides },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (server.exitCode !== null) return;
    const closed = once(server, 'close');
    server.kill();
    await closed;
  });
  return new Promise((resolve, reject) => {
    let output = '';
    let errors = '';
    const timeout = setTimeout(() => reject(new Error('Static server did not start')), 5000);
    const cleanup = () => clearTimeout(timeout);
    server.once('error', error => { cleanup(); reject(error); });
    server.once('exit', code => { cleanup(); reject(new Error(`Static server exited with ${code}: ${errors}`)); });
    server.stderr.on('data', chunk => { errors += chunk; });
    server.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/listening on (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) { cleanup(); resolve(match[1]); }
    });
  });
};

test('production server delivers build assets and handles missing chunks without an HTML fallback', { timeout: 15000 }, async (t) => {
  const distDir = await mkdtemp(path.join(tmpdir(), 'rtx5-admin-static-'));
  t.after(() => rm(distDir, { recursive: true, force: true }));
  await mkdir(path.join(distDir, 'assets'));
  const document = '<!doctype html><html><body>Admin fixture</body></html>';
  const stylesheet = '.admin { color: red; }';
  const module = 'export const admin = true;';
  await Promise.all([
    writeFile(path.join(distDir, 'index.html'), document),
    writeFile(path.join(distDir, 'runtime-config.js'), 'window.__RTX5_RUNTIME_CONFIG__ = {};'),
    writeFile(path.join(distDir, 'assets', 'AuthenticatedApp-current.css'), stylesheet),
    writeFile(path.join(distDir, 'assets', 'AuthenticatedApp-current.js'), module),
  ]);

  const server = spawn(process.execPath, [fileURLToPath(new URL('../../server.js', import.meta.url))], {
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', DIST_DIR: distDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (server.exitCode !== null) return;
    const closed = once(server, 'close');
    server.kill();
    await closed;
  });
  const baseUrl = await new Promise((resolve, reject) => {
    let output = '';
    let errors = '';
    const timeout = setTimeout(() => reject(new Error('Static server did not start')), 5000);
    const cleanup = () => clearTimeout(timeout);
    server.once('error', error => { cleanup(); reject(error); });
    server.once('exit', code => { cleanup(); reject(new Error(`Static server exited with ${code}: ${errors}`)); });
    server.stderr.on('data', chunk => { errors += chunk; });
    server.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/listening on (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) { cleanup(); resolve(match[1]); }
    });
  });
  const request = (url, options = {}) => fetch(`${baseUrl}${url}`, {
    ...options, signal: AbortSignal.timeout(3000),
  });

  await t.test('existing CSS and JavaScript have their real contents and immutable cache headers', async () => {
    for (const [extension, type, content] of [['css', 'text/css', stylesheet], ['js', 'text/javascript', module]]) {
      const response = await request(`/assets/AuthenticatedApp-current.${extension}?v=1`);
      assert.equal(response.status, 200);
      assert.ok(response.headers.get('content-type').startsWith(type));
      assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(await response.text(), content);
      const head = await request(`/assets/AuthenticatedApp-current.${extension}`, { method: 'HEAD' });
      assert.equal(head.status, 200);
      assert.ok(head.headers.get('content-type').startsWith(type));
      assert.equal(await head.text(), '');
    }
  });

  await t.test('stale chunks return uncached 404s even when requested as documents', async () => {
    for (const url of ['/assets/AuthenticatedApp-old.css', '/assets/AuthenticatedApp-old.js', '/assets/missing', '/runtime-missing.js', '/favicon.ico']) {
      for (const method of ['GET', 'HEAD']) {
        const response = await request(url, { method, headers: { Accept: 'text/html' } });
        assert.equal(response.status, 404, `${method} ${url}`);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.ok(response.headers.get('content-type').startsWith('text/plain'));
        assert.equal(await response.text(), method === 'HEAD' ? '' : 'Not Found');
      }
    }
  });

  await t.test('HTML documents and browser navigations receive fresh entry HTML', async () => {
    for (const url of ['/', '/index.html', '/accounts/42?tab=summary']) {
      const response = await request(url, { headers: { Accept: 'text/html,application/xhtml+xml' } });
      assert.equal(response.status, 200);
      assert.ok(response.headers.get('content-type').startsWith('text/html'));
      assert.equal(response.headers.get('cache-control'), 'no-store, no-cache, must-revalidate');
      assert.equal(await response.text(), document);
    }
    const resource = await request('/not-a-navigation', { headers: { Accept: 'application/json' } });
    assert.equal(resource.status, 404);
    assert.equal(resource.headers.get('cache-control'), 'no-store');
  });

  await t.test('runtime configuration stays uncached and health checks remain available', async () => {
    const runtime = await request('/runtime-config.js');
    assert.equal(runtime.status, 200);
    assert.ok(runtime.headers.get('content-type').startsWith('text/javascript'));
    assert.ok(runtime.headers.get('cache-control').includes('no-store'));
    assert.equal(runtime.headers.get('pragma'), 'no-cache');
    assert.equal(runtime.headers.get('expires'), '0');
    assert.equal(await runtime.text(), 'window.__RTX5_RUNTIME_CONFIG__ = {};');
    const health = await request('/healthz');
    assert.equal(health.status, 200);
    assert.equal(await health.text(), 'ok');
  });
});

test('production server proxies GET /ext-api/ServerStatus and POST /ext-api/DepositRequestCreate to upstream', { timeout: 15000 }, async (t) => {
  const distDir = await mkdtemp(path.join(tmpdir(), 'rtx5-admin-ext-proxy-'));
  t.after(() => rm(distDir, { recursive: true, force: true }));
  await writeFile(path.join(distDir, 'index.html'), '<!doctype html><html><body>Admin</body></html>');

  const received = [];
  const upstream = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    received.push({
      method: req.method,
      url: req.url,
      headers: {
        authorization: req.headers.authorization || '',
        contentType: req.headers['content-type'] || '',
        accept: req.headers.accept || '',
        idempotencyKey: req.headers['idempotency-key'] || '',
        requestId: req.headers['x-request-id'] || '',
        host: req.headers.host || '',
      },
      body,
    });

    if (req.method === 'GET' && req.url.startsWith('/ServerStatus')) {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Upstream-Server': 'broker-ext',
      });
      res.end(JSON.stringify({ status: 'ok', active_sessions: 42 }));
      return;
    }

    if (req.method === 'POST' && req.url === '/DepositRequestCreate') {
      res.writeHead(201, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Upstream-Server': 'broker-ext',
      });
      res.end(JSON.stringify({ ok: true, request_id: 'dep-1001', received: JSON.parse(body || '{}') }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Upstream route not found', path: req.url }));
  });

  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    upstream.closeAllConnections();
    return new Promise(resolve => upstream.close(resolve));
  });
  const upstreamUrl = `http://127.0.0.1:${upstream.address().port}`;

  const baseUrl = await startServerProcess(t, {
    DIST_DIR: distDir,
    API_HOST: upstreamUrl,
  });

  await t.test('GET /ext-api/ServerStatus strips /ext-api and forwards Authorization to upstream', async () => {
    const response = await fetch(`${baseUrl}/ext-api/ServerStatus?scope=admin`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer admin-jwt-token-123',
        Accept: 'application/json',
        'X-Request-ID': 'req-status-1',
      },
      signal: AbortSignal.timeout(3000),
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-upstream-server'), 'broker-ext');
    assert.deepEqual(await response.json(), { status: 'ok', active_sessions: 42 });

    assert.equal(received.length, 1);
    assert.equal(received[0].method, 'GET');
    assert.equal(received[0].url, '/ServerStatus?scope=admin');
    assert.equal(received[0].headers.authorization, 'Bearer admin-jwt-token-123');
    assert.equal(received[0].headers.accept, 'application/json');
    assert.equal(received[0].headers.requestId, 'req-status-1');
    assert.equal(received[0].headers.host, new URL(upstreamUrl).host);
  });

  await t.test('POST /ext-api/DepositRequestCreate strips /ext-api and preserves Authorization + body', async () => {
    const payload = { login: 990701, amount: 250, currency: 'USD', comment: 'Admin deposit' };
    const response = await fetch(`${baseUrl}/ext-api/DepositRequestCreate`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer admin-jwt-token-456',
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Idempotency-Key': 'idem-key-789',
        'X-Request-ID': 'req-deposit-1',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });

    assert.equal(response.status, 201);
    assert.equal(response.headers.get('x-upstream-server'), 'broker-ext');
    assert.deepEqual(await response.json(), {
      ok: true,
      request_id: 'dep-1001',
      received: payload,
    });

    assert.equal(received.length, 2);
    assert.equal(received[1].method, 'POST');
    assert.equal(received[1].url, '/DepositRequestCreate');
    assert.equal(received[1].headers.authorization, 'Bearer admin-jwt-token-456');
    assert.equal(received[1].headers.contentType, 'application/json');
    assert.equal(received[1].headers.idempotencyKey, 'idem-key-789');
    assert.equal(received[1].headers.requestId, 'req-deposit-1');
    assert.deepEqual(JSON.parse(received[1].body), payload);
  });
});

test('production server returns JSON 503 when /ext-api is called without an upstream host configured', { timeout: 15000 }, async (t) => {
  const distDir = await mkdtemp(path.join(tmpdir(), 'rtx5-admin-ext-unconfigured-'));
  t.after(() => rm(distDir, { recursive: true, force: true }));
  await writeFile(path.join(distDir, 'index.html'), '<!doctype html><html><body>Admin</body></html>');

  const baseUrl = await startServerProcess(t, { DIST_DIR: distDir });

  for (const [method, url] of [['GET', '/ext-api/ServerStatus'], ['POST', '/ext-api/DepositRequestCreate']]) {
    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(method === 'POST' ? { body: '{"login":1}' } : {}),
      signal: AbortSignal.timeout(3000),
    });
    assert.ok(response.status === 502 || response.status === 503, `expected 502/503 for ${method} ${url}, got ${response.status}`);
    assert.ok((response.headers.get('content-type') || '').includes('application/json'));
    const body = await response.json();
    assert.ok(body.error);
  }
});
