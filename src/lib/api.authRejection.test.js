import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isAuthRejectionError,
  isProtectedApiRequest,
  shouldRouteThroughManagerApi,
  shouldSuppressApiErrorLog,
} from './api.js';

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
  // Optional requests opt out before the refresh-and-retry path runs.
  assert.match(
    apiSource,
    /_allowAuthFailure && isAuthRejectionError\(error\)\) \{\s*return Promise\.reject\(error\);[\s\S]*?if \(isAuthRejectionError\(error\)\) \{[\s\S]*?refreshSession\(/
  );
});

test('expected response statuses can skip noisy console error logging', () => {
  assert.match(apiSource, /const shouldSuppressResponseErrorLog = \(error, config, status\) => \{/);
  assert.match(apiSource, /config\?\._expectedStatuses/);
  assert.match(apiSource, /if \(!shouldSuppressResponseErrorLog\(error, originalRequest, error\.response\?\.status\)\) \{/);
});

test('desktop manager requests do not fall through to relative proxy URLs', () => {
  assert.match(apiSource, /DESKTOP_BACKEND_MISSING_MESSAGE/);
  assert.match(apiSource, /const isElectronDesktop = \(\) =>/);
  assert.match(apiSource, /expireMissingBrokerBackendSession\(\);/);
  assert.match(apiSource, /expireAuthSession\('broker_backend_missing'\)/);
  assert.match(apiSource, /createSilentError\(DESKTOP_BACKEND_MISSING_MESSAGE/);
  assert.match(apiSource, /isElectronDesktop\(\) && !isAbsoluteHttpUrl\(resolvedUrl\)/);
});

test('silent API errors opt out of repeated console logging', () => {
  assert.equal(shouldSuppressApiErrorLog({ __rtx5SuppressLog: true }), true);
  assert.equal(shouldSuppressApiErrorLog(new Error('normal')), false);
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
