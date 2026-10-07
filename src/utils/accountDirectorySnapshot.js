import { identitySnapshotKey } from './cacheIdentity.js';
import { normalizePagedResponse } from './apiShapes.js';

const prefix = 'rtx5-account-directory:';
const keys = ['accounts', 'data', 'answer', 'items', 'rows'];
const fields = new Set([
  'login', 'Login', 'account_login', 'accountLogin', 'id', 'ID',
  'name', 'Name', 'client_name', 'clientName', 'full_name', 'fullName', 'user_name', 'userName',
  'email', 'Email', 'phone', 'Phone', 'group', 'Group', 'group_name', 'groupName', 'account_group', 'accountGroup', 'accountGroupName',
  'balance', 'Balance', 'equity', 'Equity', 'currency', 'Currency', 'currency_digits', 'digits_currency', 'CurrencyDigits',
  'status', 'Status', 'enabled', 'Enabled', 'readonly', 'readOnly', 'ReadOnly', 'read_only', 'is_readonly', 'IsReadOnly',
]);
const validScalar = value => value === null || typeof value === 'boolean'
  || (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.length <= 4096);
const validRow = row => row && typeof row === 'object' && !Array.isArray(row)
  && /^\d+$/.test(String(row.login ?? row.Login ?? row.account_login ?? row.accountLogin))
  && Object.entries(row).every(([key, value]) => fields.has(key) && validScalar(value));

/** Same-tab display handoff; never used to satisfy a live request or edit an account. */
export const createAccountDirectorySnapshot = ({ storage = () => globalThis.sessionStorage, now = Date.now } = {}) => ({
  read(identity) {
    const key = identitySnapshotKey(prefix, identity);
    if (!key) return null;
    try {
      const raw = storage()?.getItem(key);
      if (!raw || raw.length > 2 * 1024 * 1024) return null;
      const saved = JSON.parse(raw);
      if (saved.version !== 1 || saved.identity !== identity || !Number.isFinite(saved.at)
        || saved.at > now() || now() - saved.at >= 5 * 60_000 || !Array.isArray(saved.rows)
        || saved.rows.length > 100 || !saved.rows.every(validRow)
        || new Set(saved.rows.map(row => String(row.login ?? row.Login ?? row.account_login ?? row.accountLogin))).size !== saved.rows.length
        || (saved.total !== null && (!Number.isSafeInteger(saved.total) || saved.total < saved.rows.length))) return null;
      return { accounts: saved.rows.map(row => ({ ...row, _accountDirectorySummary: true })),
        ...(saved.total !== null ? { total: saved.total } : {}) };
    } catch { return null; }
  },
  write(identity, response, at = now()) {
    const key = identitySnapshotKey(prefix, identity);
    if (!key || (!Array.isArray(response) && !keys.some(field => Array.isArray(response?.[field])))) return;
    const page = normalizePagedResponse(response, { arrayKeys: keys, page: 1, limit: 100 });
    const rows = page.rows.map(row => Object.fromEntries(Object.entries(row).filter(([field, value]) => fields.has(field) && validScalar(value))));
    if (rows.length > 100 || !rows.every(validRow)) return;
    try {
      const raw = JSON.stringify({ version: 1, identity, at, rows, total: page.hasKnownTotal ? page.total : null });
      if (raw.length <= 2 * 1024 * 1024) storage()?.setItem(key, raw);
    } catch { /* Optional storage must never delay a live result. */ }
  },
  clear(identity) {
    const key = identitySnapshotKey(prefix, identity);
    if (key) { try { storage()?.removeItem(key); } catch { /* Optional storage. */ } }
  },
});
