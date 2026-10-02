import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canViewGroup, canViewGroups, canEditGroup, canManageGroupLifecycle, groupAccessKey, toggleRolePermission, validateGroupAssignment } from './groupAccess.js';
import { buildUserFromAuthPayload } from './sessionUser.js';
import { buildManagerUpdateParams } from './adminValidation.js';

const viewer = { login: 100, broker_id: 'A', permissions: ['view_groups'], group_access_mode: 'restricted', allowed_groups: ['VIP'] };
test('selected viewers read assigned groups and cannot edit', () => {
  assert.equal(canViewGroup(viewer, 'VIP'), true);
  assert.equal(canViewGroup(viewer, 'Standard'), false);
  assert.equal(canEditGroup(viewer, 'VIP'), false);
  assert.equal(canManageGroupLifecycle(viewer), false);
});
test('selected editors edit settings but cannot manage group lifecycle', () => {
  const editor = { ...viewer, permissions: ['view_groups', 'manage_groups'] };
  assert.equal(canEditGroup(editor, 'VIP'), true);
  assert.equal(canEditGroup(editor, 'Standard'), false);
  assert.equal(canManageGroupLifecycle(editor), false);
  assert.equal(canManageGroupLifecycle({ ...editor, group_access_mode: 'all_within_broker' }), true);
});
test('none, missing view, empty selection and blocked versions fail closed', () => {
  for (const overrides of [{ group_access_mode: 'none' }, { permissions: ['manage_groups'] }, { allowed_groups: [] }, { authorization_version: 2 }, { authorization_version: 3 }, { operational_ready: false }]) {
    assert.equal(canViewGroups({ ...viewer, ...overrides }), false);
  }
  assert.equal(canViewGroups(buildUserFromAuthPayload({ role: 'admin', is_admin: false })), false);
  assert.equal(canViewGroups(buildUserFromAuthPayload({ is_admin: true, broker_id: 'A', authorization_version: 2 })), false);
  assert.equal(canViewGroups(buildUserFromAuthPayload({ is_admin: true, broker_id: 'A' })), true);
});
test('role editing makes manage require view', () => {
  assert.deepEqual(toggleRolePermission({}, 'manage_groups'), { manage_groups: true, view_groups: true });
  assert.deepEqual(toggleRolePermission({ manage_groups: true, view_groups: true }, 'view_groups'), { manage_groups: false, view_groups: false });
});
test('assignment validation rejects invalid restricted selections', () => {
  for (const names of [[], ['*'], [' VIP']]) assert.throws(() => validateGroupAssignment('restricted', names));
  assert.equal(validateGroupAssignment('restricted', ['VIP']), 'restricted');
});
test('identity and committed scope changes invalidate group cache keys', () => {
  for (const change of [{ login: 101 }, { broker_id: 'B' }, { group_access_mode: 'none' }, { allowed_groups: ['Standard'] }, { permissions: [] }, { access_fingerprint: 'changed' }]) {
    assert.notEqual(groupAccessKey(viewer), groupAccessKey({ ...viewer, ...change }));
  }
});
test('choosing No groups preserves the account scope array', () => {
  const update = buildManagerUpdateParams({ name: 'Manager', enabled: true, group_access_mode: 'none', allowed_groups: '', ip_whitelist: '' });
  assert.equal(update.group_access_mode, 'none');
  assert.equal(Object.hasOwn(update, 'allowed_groups[]'), false);
});
