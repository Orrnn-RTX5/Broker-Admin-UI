import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAuthRejectionError } from './api.js';

const errorWith = (status, data) => ({ response: { status, data } });

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
