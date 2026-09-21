import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPER_ADMIN_API_CATALOG,
  SUPER_ADMIN_API_SECTIONS,
  SUPER_ADMIN_API_OPERATIONS,
  getSuperAdminOperation,
  extractPathParams,
} from './superAdminApiCatalog.js';


test('catalog contains all 91 endpoints in the 10 documented sections', () => {
  assert.equal(SUPER_ADMIN_API_SECTIONS.length, 10);
  assert.equal(SUPER_ADMIN_API_CATALOG.length, 91);
  assert.deepEqual(
    SUPER_ADMIN_API_SECTIONS.map(({ endpoints }) => endpoints.length),
    [2, 4, 21, 8, 4, 3, 29, 15, 4, 1],
  );
});

test('every endpoint has a unique method and path pair', () => {
  const routeKeys = SUPER_ADMIN_API_CATALOG.map(({ method, path }) => `${method} ${path}`);
  assert.equal(new Set(routeKeys).size, routeKeys.length);
});

test('every endpoint has a stable unique id and the required catalog fields', () => {
  const ids = SUPER_ADMIN_API_CATALOG.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);

  for (const endpoint of SUPER_ADMIN_API_CATALOG) {
    assert.match(endpoint.id, /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
    assert.match(endpoint.method, /^(GET|POST|PUT|DELETE)$/);
    assert.match(endpoint.path, /^\//);
    assert.ok(endpoint.label.length > 0);
    assert.equal(typeof endpoint.auth, 'boolean');
  }
});

test('extractPathParams returns ordered parameter names from catalog paths', () => {
  assert.deepEqual(extractPathParams('/api/v1/admin/stats'), []);
  assert.deepEqual(
    extractPathParams('/api/v1/admin/brokers/{broker_id}'),
    ['broker_id'],
  );
  assert.deepEqual(
    extractPathParams('/api/v1/admin/brokers/{broker_id}/servers/{server_id}/ping'),
    ['broker_id', 'server_id'],
  );
  assert.deepEqual(
    extractPathParams('/api/v1/admin/market-data/candle-gaps/backfill/{job_id}'),
    ['job_id'],
  );
});

test('all catalog path placeholders are exposed by extractPathParams', () => {
  for (const { path } of SUPER_ADMIN_API_CATALOG) {
    const placeholders = [...path.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]);
    assert.deepEqual(extractPathParams(path), placeholders, path);
  }
});

test('SUPER_ADMIN_API_OPERATIONS maps operations by dot and underscore id', () => {
  assert.ok(SUPER_ADMIN_API_OPERATIONS['authentication.login']);
  assert.ok(SUPER_ADMIN_API_OPERATIONS['authentication_login']);
  assert.equal(SUPER_ADMIN_API_OPERATIONS['authentication.login'].path, '/api/v1/admin/auth/login');
});

test('getSuperAdminOperation resolves by id, alias, path, and method+path', () => {
  assert.equal(getSuperAdminOperation('authentication.login')?.path, '/api/v1/admin/auth/login');
  assert.equal(getSuperAdminOperation('auth_me')?.path, '/api/v1/admin/auth/me');
  assert.equal(getSuperAdminOperation('GET /api/v1/admin/stats')?.id, 'system.stats');
  assert.equal(getSuperAdminOperation('/api/v1/admin/stats')?.id, 'system.stats');
  assert.equal(getSuperAdminOperation({ path: '/custom' })?.path, '/custom');
  assert.equal(getSuperAdminOperation('nonexistent'), null);
});

