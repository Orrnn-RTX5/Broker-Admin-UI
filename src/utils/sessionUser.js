import { normalizePermissions, WILDCARD_PERMISSION } from './permissions.js';

const firstValue = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== '') ?? null;

const isAdminLike = (payload = {}) => {
  const role = String(payload.role || payload.role_name || '').trim().toLowerCase();
  return Boolean(payload.is_admin || role === 'admin' || role === 'super_admin');
};

export const extractRawPermissions = (payload = {}) =>
  firstValue(payload.permissions, payload.perms, payload.scopes, payload.scope);

export const buildUserFromAuthPayload = (payload = {}) => {
  const login = firstValue(payload.login, payload.user, payload.id, payload.username);
  const rawPermissions = extractRawPermissions(payload);
  const permissionSet = normalizePermissions(rawPermissions);
  const isAdmin = isAdminLike(payload);
  const permissions = permissionSet
    ? Array.from(permissionSet)
    : (isAdmin ? [WILDCARD_PERMISSION] : null);

  return {
    id: login || 'admin',
    login: login || '',
    name: firstValue(payload.name, payload.display_name, payload.username, `Agent ${login || ''}`.trim()),
    role: firstValue(payload.role, payload.role_name, isAdmin ? 'admin' : 'manager'),
    is_admin: isAdmin,
    permissions,
    broker_id: firstValue(payload.broker_id, payload.brokerId),
  };
};

export const mergeHydratedUser = (currentUser, hydratedPayload) => ({
  ...(currentUser || {}),
  ...buildUserFromAuthPayload(hydratedPayload),
});
