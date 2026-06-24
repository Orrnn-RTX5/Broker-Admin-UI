import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isAuthRejectionError, isProtectedApiRequest, shouldRouteThroughManagerApi } from './api.js';

const errorWith = (status, data) => ({ response: { status, data } });
const apiSource = readFileSync(new URL('./api.js', import.meta.url), 'utf8');

test('403 invalid credentials is not treated as global token rejection', () => {
  const error = errorWith(403, {
    code: 'MT_RET_ERR_PERMISSIONS',
    message: 'Invalid credentials',
  });

  assert.equal(isAuthRejectionError(error), false);
});

test('403 permission errors are not treated as global token rejection', () => {
  const error = errorWith(403, {
    code: 'MT_RET_ERR_PERMISSIONS',
    message: 'Permission denied',
  });

  assert.equal(isAuthRejectionError(error), false);
});

test('403 explicit session failures still expire auth', () => {
  assert.equal(isAuthRejectionError(errorWith(403, { message: 'Session expired' })), true);
  assert.equal(isAuthRejectionError(errorWith(403, { message: 'Invalid token' })), true);
  assert.equal(isAuthRejectionError(errorWith(403, { message: 'Not authenticated' })), true);
});

test('401 and 419 remain auth rejection statuses', () => {
  assert.equal(isAuthRejectionError(errorWith(401, { message: 'Unauthorized' })), true);
  assert.equal(isAuthRejectionError(errorWith(419, { message: 'Session expired' })), true);
});

test('optional auth hydration requests do not expire the global session', () => {
  assert.match(
    apiSource,
    /originalRequest\?\._allowAuthFailure && isAuthRejectionError\(error\)/
  );
  assert.match(
    apiSource,
    /return Promise\.reject\(error\);[\s\S]*?if \(isAuthRejectionError\(error\) && error\.response\?\.status !== 401\)/
  );
});

test('protected broker API requests require a client auth token', () => {
  assert.equal(isProtectedApiRequest('https://services.myprop.trade/manager/GroupList'), true);
  assert.equal(isProtectedApiRequest('/manager/ManagerList'), true);
  assert.equal(isProtectedApiRequest('/api/v2/admin/users?page=1'), true);
  assert.equal(isProtectedApiRequest('/api/v2/accounts?page=1'), true);
  assert.equal(isProtectedApiRequest('/manager/api/v2/admin/login'), false);
  assert.equal(isProtectedApiRequest('/api/v2/auth/login'), false);
  assert.equal(isProtectedApiRequest('/api/v2/broker/servers'), false);
});

test('admin API paths are routed through the manager backend namespace', () => {
  assert.equal(shouldRouteThroughManagerApi('/api/v2/admin/users?page=1'), true);
  assert.equal(shouldRouteThroughManagerApi('/api/v2/admin/instruments/EURUSD/toggle'), true);
  assert.equal(shouldRouteThroughManagerApi('/api/v2/accounts?page=1'), true);
  assert.equal(shouldRouteThroughManagerApi('/api/v2/account/990701'), true);
  assert.equal(shouldRouteThroughManagerApi('/manager/GroupList'), true);
  assert.equal(shouldRouteThroughManagerApi('/api/v2/broker/servers'), false);
  assert.equal(shouldRouteThroughManagerApi('/uploads/logo.png'), false);
});
