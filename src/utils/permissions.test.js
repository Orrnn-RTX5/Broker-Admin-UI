import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PERMISSION_KEYS,
  WILDCARD_PERMISSION,
  ROLE_PERMISSION_OPTIONS,
  normalizePermissions,
  hasPermission,
  requirePermission,
  canAccessView,
  requiredPermissionForView,
  ADMIN_ONLY_VIEW,
  isBrokerAdmin,
} from './permissions.js';

test('Downstream access is broker Admin only: no manager permission, wildcard or SuperAdmin opens it', () => {
  assert.equal(requiredPermissionForView('Downstream access'), ADMIN_ONLY_VIEW);
  assert.equal(canAccessView({ role: 'admin', is_admin: true, permissions: ['*'] }, 'Downstream access'), true);
  assert.equal(canAccessView({ role: 'admin', permissions: null }, 'Downstream access'), true);
  assert.equal(canAccessView({ role: 'manager', permissions: [WILDCARD_PERMISSION] }, 'Downstream access'), false);
  assert.equal(canAccessView({ role: 'manager', permissions: Object.values(PERMISSION_KEYS) }, 'Downstream access'), false);
  assert.equal(canAccessView({ role: 'super_admin', is_admin: true, permissions: ['*'] }, 'Downstream access'), false);
  assert.equal(canAccessView({ role: 'dealer', is_admin: 'true' }, 'Downstream access'), false);
  assert.equal(canAccessView(null, 'Downstream access'), false);
  assert.equal(isBrokerAdmin({ role: 'Admin' }), true);
  assert.equal(ROLE_PERMISSION_OPTIONS.some((option) => option.key === ADMIN_ONLY_VIEW), false);
  assert.equal(hasPermission({ role: 'manager', permissions: [WILDCARD_PERMISSION] }, ADMIN_ONLY_VIEW), false);
});

test('normalizePermissions keeps backend keys and aliases execute_deals to manage_trades', () => {
  const set = normalizePermissions(['manage_groups', ' execute_deals ', 'unknown_permission', '']);

  assert.ok(set instanceof Set);
  assert.equal(set.has(PERMISSION_KEYS.MANAGE_GROUPS), true);
  assert.equal(set.has(PERMISSION_KEYS.MANAGE_TRADES), true);
  assert.equal(set.has('execute_deals'), false);
  assert.equal(set.has('unknown_permission'), false);
});

test('normalizePermissions accepts granted object-map entries only', () => {
  const set = normalizePermissions({
    manage_groups: true,
    view_reports: false,
    execute_deals: 1,
    unknown_permission: true,
  });

  assert.deepEqual(
    [...set].sort(),
    [PERMISSION_KEYS.MANAGE_GROUPS, PERMISSION_KEYS.MANAGE_TRADES].sort()
  );
});

test('normalizePermissions treats unavailable permissions as null and empty lists as present', () => {
  assert.equal(normalizePermissions(null), null);
  assert.equal(normalizePermissions(undefined), null);
  assert.equal(normalizePermissions('   '), null);
  assert.deepEqual([...normalizePermissions([])], []);
});

test('hasPermission fails closed when permissions are unavailable or required keys are unknown', () => {
  assert.equal(hasPermission({ role: 'manager' }, PERMISSION_KEYS.MANAGE_GROUPS), false);
  assert.equal(hasPermission({ role: 'manager', permissions: null }, PERMISSION_KEYS.SERVER_ADMIN), false);
  assert.equal(hasPermission({ role: 'manager', permissions: [PERMISSION_KEYS.MANAGE_GROUPS] }, 'unknown_permission'), false);
});

test('hasPermission allows explicit wildcard and admin/super_admin roles', () => {
  assert.equal(hasPermission({ role: 'manager', permissions: [WILDCARD_PERMISSION] }, PERMISSION_KEYS.SERVER_ADMIN), true);
  assert.equal(hasPermission({ role: 'admin', permissions: [] }, PERMISSION_KEYS.MANAGE_GROUPS), true);
  assert.equal(hasPermission({ role: 'super_admin', permissions: null }, PERMISSION_KEYS.SERVER_ADMIN), true);
});

test('hasPermission enforces canonical permissions with ANY-of array semantics', () => {
  const user = { role: 'manager', permissions: [PERMISSION_KEYS.MANAGE_TRADES] };

  assert.equal(hasPermission(user, PERMISSION_KEYS.MANAGE_TRADES), true);
  assert.equal(hasPermission(user, PERMISSION_KEYS.MANAGE_GROUPS), false);
  assert.equal(hasPermission(user, [PERMISSION_KEYS.MANAGE_GROUPS, 'execute_deals']), true);
  assert.equal(hasPermission(user, [PERMISSION_KEYS.MANAGE_GROUPS, PERMISSION_KEYS.VIEW_REPORTS]), false);
});

test('requirePermission throws when lacking, returns true when allowed', () => {
  const user = { role: 'manager', permissions: [PERMISSION_KEYS.VIEW_REPORTS] };

  assert.equal(requirePermission(user, PERMISSION_KEYS.VIEW_REPORTS), true);
  assert.throws(() => requirePermission(user, PERMISSION_KEYS.MANAGE_GROUPS), /permission/i);
});

test('requiredPermissionForView maps broker backend permission keys', () => {
  assert.equal(requiredPermissionForView('Managers'), PERMISSION_KEYS.MANAGE_MANAGERS);
  assert.equal(requiredPermissionForView('Deposits'), PERMISSION_KEYS.MANAGE_PAYMENTS);
  assert.equal(requiredPermissionForView('Withdrawals'), PERMISSION_KEYS.MANAGE_PAYMENTS);
  assert.equal(requiredPermissionForView('Positions'), PERMISSION_KEYS.VIEW_POSITIONS);
  assert.equal(requiredPermissionForView('Deals'), PERMISSION_KEYS.MANAGE_TRADES);
  assert.equal(requiredPermissionForView('Data Exports'), PERMISSION_KEYS.EXPORT_DATA);
  assert.equal(requiredPermissionForView('Regulatory Reports'), PERMISSION_KEYS.COMPLIANCE_OFFICER);
  assert.equal(requiredPermissionForView('Market Overview'), null);
});

test('ROLE_PERMISSION_OPTIONS are backend keys and do not include execute_deals payload key', () => {
  const optionKeys = ROLE_PERMISSION_OPTIONS.map((option) => option.key);

  assert.equal(optionKeys.includes('execute_deals'), false);
  assert.equal(optionKeys.includes(PERMISSION_KEYS.MANAGE_TRADES), true);
  assert.equal(optionKeys.includes(PERMISSION_KEYS.MANAGE_PAYMENTS), true);
  assert.equal(optionKeys.includes(PERMISSION_KEYS.MANAGE_MANAGERS), true);
  assert.equal(optionKeys.includes(PERMISSION_KEYS.WITHDRAW), true);
  assert.equal(optionKeys.includes(PERMISSION_KEYS.CLOSE_POSITIONS), true);
});

test('canAccessView gates restricted views and allows unmapped views', () => {
  const limited = { role: 'manager', permissions: [PERMISSION_KEYS.VIEW_REPORTS] };

  assert.equal(canAccessView(limited, 'Managers'), false);
  assert.equal(canAccessView(limited, 'Client Analytics'), true);
  assert.equal(canAccessView(limited, 'Deposits'), false);
  assert.equal(canAccessView(limited, 'Transaction History'), false);
  assert.equal(canAccessView(limited, 'Market Overview'), true);
});
