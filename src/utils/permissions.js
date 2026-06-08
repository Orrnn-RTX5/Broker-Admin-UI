// Client-side RBAC helpers. These guards are a defense-in-depth UX layer only;
// the broker backend remains authoritative on every privileged operation.

export const PERMISSION_KEYS = Object.freeze({
  BULK_OPERATIONS: 'bulk_operations',
  CLOSE_POSITIONS: 'close_positions',
  COMPLIANCE_OFFICER: 'compliance_officer',
  CREDIT: 'credit',
  DEALER_QUEUE: 'dealer_queue',
  DEPOSIT: 'deposit',
  EDIT_ACCOUNTS: 'edit_accounts',
  EXPORT_DATA: 'export_data',
  MANAGE_ACCOUNTS: 'manage_accounts',
  MANAGE_BONUSES: 'manage_bonuses',
  MANAGE_COMMUNICATIONS: 'manage_communications',
  MANAGE_FINANCES: 'manage_finances',
  MANAGE_GROUPS: 'manage_groups',
  MANAGE_IB: 'manage_ib',
  MANAGE_KYC: 'manage_kyc',
  MANAGE_MANAGERS: 'manage_managers',
  MANAGE_PAMM: 'manage_pamm',
  MANAGE_PAYMENTS: 'manage_payments',
  MANAGE_PROP: 'manage_prop',
  MANAGE_TRADES: 'manage_trades',
  MANIPULATE_TRADES: 'manipulate_trades',
  RISK_MANAGEMENT: 'risk_management',
  ROLLBACK_DEALS: 'rollback_deals',
  SERVER_ADMIN: 'server_admin',
  VIEW_ACCOUNTS: 'view_accounts',
  VIEW_POSITIONS: 'view_positions',
  VIEW_REPORTS: 'view_reports',
  VIEW_RISK_EVENTS: 'view_risk_events',
  WITHDRAW: 'withdraw',
});

export const WILDCARD_PERMISSION = '*';

export const CANONICAL_PERMISSION_KEYS = Object.freeze(
  new Set([WILDCARD_PERMISSION, ...Object.values(PERMISSION_KEYS)])
);

export const PERMISSION_ALIASES = Object.freeze({
  execute_deals: PERMISSION_KEYS.MANAGE_TRADES,
});

export const ROLE_PERMISSION_OPTIONS = Object.freeze([
  { key: PERMISSION_KEYS.VIEW_ACCOUNTS, label: 'View Accounts' },
  { key: PERMISSION_KEYS.EDIT_ACCOUNTS, label: 'Edit Accounts' },
  { key: PERMISSION_KEYS.MANAGE_ACCOUNTS, label: 'Manage Accounts' },
  { key: PERMISSION_KEYS.VIEW_POSITIONS, label: 'View Positions' },
  { key: PERMISSION_KEYS.CLOSE_POSITIONS, label: 'Close Positions' },
  { key: PERMISSION_KEYS.MANAGE_TRADES, label: 'Manage Trades' },
  { key: PERMISSION_KEYS.MANIPULATE_TRADES, label: 'Manipulate Trades' },
  { key: PERMISSION_KEYS.DEALER_QUEUE, label: 'Dealer Queue' },
  { key: PERMISSION_KEYS.ROLLBACK_DEALS, label: 'Rollback Deals' },
  { key: PERMISSION_KEYS.BULK_OPERATIONS, label: 'Bulk Operations' },
  { key: PERMISSION_KEYS.MANAGE_PAYMENTS, label: 'Manage Payments' },
  { key: PERMISSION_KEYS.MANAGE_FINANCES, label: 'Manage Finances' },
  { key: PERMISSION_KEYS.DEPOSIT, label: 'Deposit' },
  { key: PERMISSION_KEYS.WITHDRAW, label: 'Withdraw' },
  { key: PERMISSION_KEYS.CREDIT, label: 'Credit' },
  { key: PERMISSION_KEYS.MANAGE_GROUPS, label: 'Manage Groups' },
  { key: PERMISSION_KEYS.MANAGE_MANAGERS, label: 'Manage Managers' },
  { key: PERMISSION_KEYS.MANAGE_KYC, label: 'Manage KYC' },
  { key: PERMISSION_KEYS.MANAGE_IB, label: 'Manage IB' },
  { key: PERMISSION_KEYS.MANAGE_PROP, label: 'Manage Prop' },
  { key: PERMISSION_KEYS.MANAGE_BONUSES, label: 'Manage Bonuses' },
  { key: PERMISSION_KEYS.MANAGE_PAMM, label: 'Manage PAMM' },
  { key: PERMISSION_KEYS.VIEW_REPORTS, label: 'View Reports' },
  { key: PERMISSION_KEYS.EXPORT_DATA, label: 'Export Data' },
  { key: PERMISSION_KEYS.RISK_MANAGEMENT, label: 'Risk Management' },
  { key: PERMISSION_KEYS.VIEW_RISK_EVENTS, label: 'View Risk Events' },
  { key: PERMISSION_KEYS.COMPLIANCE_OFFICER, label: 'Compliance Officer' },
  { key: PERMISSION_KEYS.MANAGE_COMMUNICATIONS, label: 'Manage Communications' },
  { key: PERMISSION_KEYS.SERVER_ADMIN, label: 'Server Admin' },
]);

export const normalizePermissionKey = (key) => {
  const trimmed = String(key || '').trim();
  if (!trimmed) return null;
  const aliased = PERMISSION_ALIASES[trimmed] || trimmed;
  return CANONICAL_PERMISSION_KEYS.has(aliased) ? aliased : null;
};

const entriesToPermissionSet = (entries) => {
  const granted = entries
    .map(normalizePermissionKey)
    .filter(Boolean);
  return new Set(granted);
};

// Normalize whatever shape the backend returns into a Set of granted backend
// permission keys. null/undefined means the permission list is unavailable.
// An empty returned Set means a list was present but no valid permission was
// granted, which must fail closed.
export const normalizePermissions = (raw) => {
  if (raw === null || raw === undefined) return null;

  if (Array.isArray(raw)) {
    return entriesToPermissionSet(raw);
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return entriesToPermissionSet(trimmed.split(/[,\s]+/));
  }

  if (typeof raw === 'object') {
    return entriesToPermissionSet(
      Object.entries(raw)
        .filter(([, value]) => value === true || value === 1 || value === '1' || value === 'true')
        .map(([key]) => key)
    );
  }

  return null;
};

const getUserPermissionSet = (user) => {
  if (user?.permissions instanceof Set) return user.permissions;
  return normalizePermissions(user?.permissions ?? user?.perms ?? user?.scopes);
};

const hasAdminRole = (user) => {
  const role = String(user?.role || user?.role_name || '').trim().toLowerCase();
  return Boolean(user?.is_admin || role === 'admin' || role === 'super_admin');
};

export const hasPermissionWildcard = (user) => {
  const granted = getUserPermissionSet(user);
  return Boolean(granted?.has(WILDCARD_PERMISSION) || hasAdminRole(user));
};

// hasPermission(user, required)
// required: a single permission key, or an array of keys (ANY-of semantics).
export const hasPermission = (user, required) => {
  if (required === null || required === undefined) return true;

  const rawRequiredList = (Array.isArray(required) ? required : [required])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
  if (rawRequiredList.length === 0) return true;

  const requiredList = rawRequiredList.map(normalizePermissionKey).filter(Boolean);
  if (requiredList.length === 0) return false;

  if (hasPermissionWildcard(user)) return true;

  const granted = getUserPermissionSet(user);
  if (!granted) return false;

  return requiredList.some((key) => granted.has(key));
};

export const requirePermission = (user, required, message) => {
  if (hasPermission(user, required)) return true;
  throw new Error(message || 'You do not have permission to perform this action.');
};

export const VIEW_PERMISSIONS = Object.freeze({
  // Account and client administration
  'Clients': PERMISSION_KEYS.VIEW_ACCOUNTS,
  'Clients & Accounts': PERMISSION_KEYS.VIEW_ACCOUNTS,
  'Trading Accounts': PERMISSION_KEYS.VIEW_ACCOUNTS,
  'Allocations': PERMISSION_KEYS.MANAGE_ACCOUNTS,

  // Payment and money movement
  'Payments': PERMISSION_KEYS.MANAGE_PAYMENTS,
  'Providers': PERMISSION_KEYS.MANAGE_PAYMENTS,
  'Payment Methods': PERMISSION_KEYS.MANAGE_PAYMENTS,
  'Deposits': PERMISSION_KEYS.MANAGE_PAYMENTS,
  'Withdrawals': PERMISSION_KEYS.MANAGE_PAYMENTS,
  'Payment Gateways': PERMISSION_KEYS.MANAGE_PAYMENTS,
  'Reconciliation': PERMISSION_KEYS.MANAGE_PAYMENTS,
  'Payment Reconciliation': PERMISSION_KEYS.MANAGE_PAYMENTS,
  'Chargebacks': PERMISSION_KEYS.MANAGE_PAYMENTS,
  'Transaction History': PERMISSION_KEYS.MANAGE_PAYMENTS,

  // Group, route, and manager administration
  'Groups': PERMISSION_KEYS.MANAGE_GROUPS,
  'LP Routing': PERMISSION_KEYS.MANAGE_GROUPS,
  'Gateways': PERMISSION_KEYS.SERVER_ADMIN,
  'Managers': PERMISSION_KEYS.MANAGE_MANAGERS,

  // Order and position surfaces
  'Orders': PERMISSION_KEYS.MANAGE_TRADES,
  'Orders & Deals': PERMISSION_KEYS.MANAGE_TRADES,
  'Positions': PERMISSION_KEYS.VIEW_POSITIONS,
  'Deals': PERMISSION_KEYS.MANAGE_TRADES,

  // Reporting and analytics
  'Client Analytics': PERMISSION_KEYS.VIEW_REPORTS,
  'Trading Analytics': PERMISSION_KEYS.VIEW_REPORTS,
  'Trader Rankings': PERMISSION_KEYS.VIEW_REPORTS,
  'Revenue Forecast': PERMISSION_KEYS.VIEW_REPORTS,
  'Data Exports': PERMISSION_KEYS.EXPORT_DATA,
  'Regulatory Reports': PERMISSION_KEYS.COMPLIANCE_OFFICER,
  'Complaints': PERMISSION_KEYS.COMPLIANCE_OFFICER,
  'Risk Reports': PERMISSION_KEYS.VIEW_REPORTS,
  'Reports': PERMISSION_KEYS.VIEW_REPORTS,

  // Risk
  'Exposure': PERMISSION_KEYS.RISK_MANAGEMENT,
  'Risk Events': PERMISSION_KEYS.VIEW_RISK_EVENTS,
  'Risk Limits': PERMISSION_KEYS.RISK_MANAGEMENT,
  'Suspicious Activity': PERMISSION_KEYS.VIEW_RISK_EVENTS,

  // Communications
  'Communications': PERMISSION_KEYS.MANAGE_COMMUNICATIONS,
  'Auto Notification Rules': PERMISSION_KEYS.MANAGE_COMMUNICATIONS,
  'Email Campaigns': PERMISSION_KEYS.MANAGE_COMMUNICATIONS,
  'Message Center': PERMISSION_KEYS.MANAGE_COMMUNICATIONS,
  'Push Notifications': PERMISSION_KEYS.MANAGE_COMMUNICATIONS,
  'SMS': PERMISSION_KEYS.MANAGE_COMMUNICATIONS,

  // Server and security administration
  'Server Config': PERMISSION_KEYS.SERVER_ADMIN,
  'Network Cluster': PERMISSION_KEYS.SERVER_ADMIN,
  'Anti DDoS Protection': PERMISSION_KEYS.SERVER_ADMIN,
  'Integrations': PERMISSION_KEYS.SERVER_ADMIN,
  'Custom Fields': PERMISSION_KEYS.SERVER_ADMIN,
  'Feature Flags': PERMISSION_KEYS.SERVER_ADMIN,
  'Symbol Visibility': PERMISSION_KEYS.SERVER_ADMIN,
  'Trading Terminal Config': PERMISSION_KEYS.SERVER_ADMIN,
  'IP Restrictions': PERMISSION_KEYS.SERVER_ADMIN,
  'Connection Throttle': PERMISSION_KEYS.SERVER_ADMIN,
  'Log Management': PERMISSION_KEYS.SERVER_ADMIN,
  'Backup Schedules': PERMISSION_KEYS.SERVER_ADMIN,
  'Plugin Management': PERMISSION_KEYS.SERVER_ADMIN,
});

export const requiredPermissionForView = (viewLabel) =>
  VIEW_PERMISSIONS[viewLabel] ?? null;

export const canAccessView = (user, viewLabel) =>
  hasPermission(user, requiredPermissionForView(viewLabel));
