import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
