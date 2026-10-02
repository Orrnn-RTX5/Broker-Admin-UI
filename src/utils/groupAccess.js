// Group configuration permissions are independent from account/trading rights.
const available = user => (user?.group_config_admin === true && !user?.broker_id) || (user?.operational_ready !== false && Number(user?.authorization_version || 1) < 2);
const explicitAdmin = user => available(user) && user?.group_config_admin === true;
const grant = (user, key) => {
  const p = user?.permissions;
  return Array.isArray(p) ? p.includes(key) : p?.[key] === true;
};
export const groupAccessKey = user => JSON.stringify([
  user?.broker_id, user?.login, user?.access_fingerprint, user?.authorization_version,user?.operational_ready,
  user?.group_access_mode, user?.allowed_groups, user?.group_config_admin,
  grant(user, 'view_groups'), grant(user, 'manage_groups'),
]);
export const canViewGroups = user => explicitAdmin(user) || (
  available(user) && grant(user, 'view_groups') && (user?.group_access_mode === 'all_within_broker' || (user?.group_access_mode === 'restricted' && user.allowed_groups?.length > 0))
);
export const canViewGroup = (user, name) => canViewGroups(user) && (
  explicitAdmin(user) || user.group_access_mode === 'all_within_broker' || user.allowed_groups?.includes(name)
);
export const canEditGroups = user => canViewGroups(user) && (explicitAdmin(user) || grant(user, 'manage_groups'));
export const canEditGroup = (user, name) => canViewGroup(user, name) && (
  explicitAdmin(user) || grant(user, 'manage_groups')
);
export const canManageGroupLifecycle = user => explicitAdmin(user) || (
  canViewGroups(user) && grant(user, 'manage_groups') && user.group_access_mode === 'all_within_broker'
);
export const toggleRolePermission = (permissions, key) => {
  const next = { ...permissions, [key]: !permissions[key] };
  if (key === 'manage_groups' && next.manage_groups) next.view_groups = true;
  if (key === 'view_groups' && !next.view_groups) next.manage_groups = false;
  return next;
};
export const validateGroupAssignment = (mode, names) => {
  if (!['none', 'restricted', 'all_within_broker'].includes(mode)) throw new Error('Choose group access.');
  if (mode === 'restricted' && !names.length) throw new Error('Select at least one group.');
  if (mode === 'restricted' && names.some(name => !name || name.trim() !== name || /[*?]/.test(name))) {
    throw new Error('Select exact group names.');
  }
  return mode;
};
