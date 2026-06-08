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
