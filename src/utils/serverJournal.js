// Shared broker journal contract, matching the Manager operations terminal.
export const SERVER_JOURNAL_COLUMNS = ['Time', 'Type', 'Source', 'Action', 'Login', 'Group', 'Message'];
export const SERVER_JOURNAL_PAGE = 50;

export const SERVER_JOURNAL_FILTERS = [
  { id: 'all', label: 'Business & terminal' },
  { id: 'access', label: 'Permission access', params: { access: 'only' } },
  { id: 'errors', label: 'Errors', params: { severity: 'error' } },
  { id: 'warnings', label: 'Warnings', params: { severity: 'warning' } },
  { id: 'security', label: 'Security & logins', params: { category: 'SECURITY,AUTH' } },
  { id: 'trading', label: 'Trading', params: { category: 'TRADE' } },
  { id: 'accounts', label: 'Accounts & money', params: { category: 'ACCOUNT,FINANCE,PARTNER' } },
  { id: 'config', label: 'Configuration', params: { category: 'CONFIG' } },
  { id: 'staff', label: 'Staff & roles', params: { category: 'ADMIN' } },
  { id: 'system', label: 'Feed & system', params: { category: 'FEED,SYSTEM,NETWORK,API,NOTIFY' } },
];

export const buildServerJournalQuery = ({ filter = 'all', cursor = '', limit = SERVER_JOURNAL_PAGE } = {}) => {
  const preset = SERVER_JOURNAL_FILTERS.find((item) => item.id === filter);
  if (!preset) throw new Error('Invalid journal filter.');
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Journal limit must be a positive integer.');
  if (typeof cursor !== 'string') throw new Error('Journal cursor must be a string.');
  const params = new URLSearchParams({ limit: String(limit), ...preset.params });
  if (cursor) params.set('cursor', cursor);
  return params.toString();
};

export const serverJournalLogin = (entry = {}) => {
  const account = entry.account_login;
  if (account !== null && account !== undefined && Number(account) > 0) return account;
  return entry.actor_id || '—';
};

const pad = (value, width = 2) => String(value).padStart(width, '0');

export const formatServerJournalTime = (ms) => {
  const date = new Date(Number(ms));
  if (!ms || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
};

export const severityClass = (severity) => (
  { warning: 'is-warn', error: 'is-error', critical: 'is-error' }[severity] || 'is-info'
);

export const describeServerJournalScope = (scope) => {
  if (!scope) return '';
  const system = scope.system ? ' + broker-wide events' : '';
  switch (scope.mode) {
    case 'unrestricted': return 'Journal · all broker events';
    case 'all_groups': return `Journal · all client groups + your actions${system}`;
    case 'groups': return `Journal · groups ${(scope.groups || []).join(', ')} + your actions${system}`;
    default: return `Journal · your own actions only${system}`;
  }
};

export const isServerJournalDenied = (error) => Number(error?.status ?? error?.response?.status) === 403;

export const serverJournalAccessKey = ({ isAdmin = false, role = '', permissions = [], revision = '' } = {}) => {
  const list = Array.isArray(permissions) ? [...permissions].map(String).sort() : [];
  return [isAdmin ? 'admin' : 'staff', role || '', revision || '', list.join(',')].join('|');
};

export const serverJournalSessionKey = (user) => JSON.stringify([
  user?.broker_id ?? '', user?.login ?? user?.id ?? '',
  serverJournalAccessKey({
    isAdmin: user?.is_admin ?? user?.isAdmin,
    role: user?.role,
    permissions: user?.permissions,
    revision: JSON.stringify([user?.authorization_version, user?.access_fingerprint, user?.permissions_revision, user?.access_revision, user?.revision]),
  }),
  user?.group_access_mode ?? '', user?.allowed_groups ?? [], user?.groups ?? [], user?.group_mask ?? '',
]);

export const describeServerJournalError = (error) => {
  if (isServerJournalDenied(error)) return 'No journal access — ask an administrator for the "View Journal" permission.';
  return `Journal unavailable — ${error?.message || 'request failed'}`;
};

const show = (value) => {
  if (value === undefined || value === null || value === '') return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
};

export const serverJournalDetail = (entry = {}) => {
  const parts = [
    entry.actor_id ? `By ${[entry.actor_type, entry.actor_id].filter(Boolean).join(' ')}` : '',
    entry.actor_ip ? `IP ${entry.actor_ip}` : '',
    entry.result ? `Result ${entry.result}${entry.error_code ? ` (${entry.error_code})` : ''}` : '',
    entry.target_type && entry.target_id !== undefined && entry.target_id !== null ? `Target ${entry.target_type} ${entry.target_id}` : '',
    entry.request_id ? `Request ${entry.request_id}` : '',
    entry.metadata?.method && entry.metadata?.path ? `${entry.metadata.method} ${entry.metadata.path}` : '',
    entry.metadata?.permission ? `Permission ${entry.metadata.permission}` : '',
  ];
  const before = entry.before && typeof entry.before === 'object' ? entry.before : {};
  const after = entry.after && typeof entry.after === 'object' ? entry.after : {};
  const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
    .map((key) => `${key}: ${show(before[key]) || '—'} → ${show(after[key]) || '—'}`);
  if (changed.length) parts.push(`Changes ${changed.join('; ')}`);
  return parts.filter(Boolean).join(' · ') || 'No additional details.';
};

export const matchesServerJournalSearch = (entry = {}, search = '') => {
  const needle = String(search).trim().toLowerCase();
  if (!needle) return true;
  return [
    formatServerJournalTime(entry.time), entry.severity, entry.source, entry.category, entry.action,
    entry.actor_id, entry.account_login, entry.group, entry.result, entry.message,
  ].join(' ').toLowerCase().includes(needle);
};

// Preserve server order and remove duplicates within both pages, including
// numeric/string representations of the same event ID.
export const mergeServerJournalPages = (current = [], older = []) => {
  const seen = new Set();
  return [...current, ...older].filter((entry) => {
    const id = String(entry.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};
