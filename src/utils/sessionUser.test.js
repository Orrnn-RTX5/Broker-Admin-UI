import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildUserFromAuthPayload, mergeHydratedUser } from './sessionUser.js';

test('buildUserFromAuthPayload fails closed for manager payloads without permissions', () => {
  const user = buildUserFromAuthPayload({ login: 42, role: 'manager', broker_id: 'gta_broker' });

  assert.equal(user.login, 42);
  assert.equal(user.role, 'manager');
  assert.equal(user.broker_id, 'gta_broker');
  assert.equal(user.permissions, null);
});

test('buildUserFromAuthPayload hydrates backend permissions from array and object shapes', () => {
  assert.deepEqual(
    buildUserFromAuthPayload({ login: 7, permissions: ['manage_payments'] }).permissions,
    ['manage_payments']
  );

  assert.deepEqual(
    buildUserFromAuthPayload({ login: 8, permissions: { manage_managers: true, view_reports: false } }).permissions,
    ['manage_managers']
  );
});

test('buildUserFromAuthPayload gives admin-like payloads an explicit wildcard when no list exists', () => {
  const user = buildUserFromAuthPayload({ login: 'admin', role: 'admin' });

  assert.equal(user.is_admin, true);
  assert.deepEqual(user.permissions, ['*']);
});

test('mergeHydratedUser replaces stale permission state from auth/me payload', () => {
  const merged = mergeHydratedUser(
    { login: '11', name: 'Desk', permissions: null },
    { login: '11', role: 'manager', permissions: ['export_data'] }
  );

  assert.deepEqual(merged.permissions, ['export_data']);
  assert.equal(merged.name, 'Agent 11');
});

// A-R6-1: the store's is_admin follows the role name, so a role named admin with a false claim is still an admin for the store's
// own checks, but the backend admin claim (backend_is_admin) is what the account-data scope reads.
test('the backend admin claim is kept apart from the role-derived is_admin (role admin with a false claim)', () => {
  const user = buildUserFromAuthPayload({ login: 9001, role: 'admin', is_admin: false, broker_id: 'broker-a' });
  assert.equal(user.is_admin, true, 'the store keeps its role-derived flag');
  assert.equal(user.backend_is_admin, false, 'the backend claim is false');
  assert.equal(user.group_config_admin, false);
  const real = buildUserFromAuthPayload({ login: 1, role: 'manager', is_admin: true, broker_id: 'broker-a' });
  assert.equal(real.backend_is_admin, true);
});
