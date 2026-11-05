// Pure helpers for the Clients & Accounts > Allocations page.
// Groups come from /manager/GroupList. Account counts are filled in afterwards.

const text = (value) => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};

const pick = (record, keys) => {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
};

const GROUP_NAME_KEYS = ['name', 'Name', 'group', 'Group', 'group_name', 'groupName'];
const ACCOUNT_GROUP_KEYS = ['group', 'Group', 'group_name', 'groupName', 'account_group', 'accountGroup', 'accountGroupName'];

// Group names are exact identities: letter case and surrounding spaces make a different group (a case or space twin).
// Blank names still count as missing; a non-blank name is kept exactly as the server sent it.
const exactName = (value) => (typeof value === 'string' && value.trim() ? value : '');

/** Account totals per group, keyed by the exact group name. */
export const countAccountsByGroup = (accounts) => {
  const counts = new Map();
  for (const account of Array.isArray(accounts) ? accounts : []) {
    const group = exactName(pick(account, ACCOUNT_GROUP_KEYS));
    if (group) counts.set(group, (counts.get(group) || 0) + 1);
  }
  return counts;
};

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const toBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  const normalized = text(value).toLowerCase();
  if (['true', '1', 'yes', 'enabled'].includes(normalized)) return true;
  if (['false', '0', 'no', 'disabled'].includes(normalized)) return false;
  return null;
};

const EXECUTION_LABELS = { market: 'Market', instant: 'Instant', request: 'Request', exchange: 'Exchange' };

const isDemoGroup = (record, name) => {
  const flag = toBoolean(pick(record, ['demo', 'Demo', 'isDemo', 'is_demo']));
  if (flag !== null) return flag;
  if (/demo/i.test(text(pick(record, ['accountType', 'account_type', 'type'])))) return true;
  return /(^|[\\/])demo([\\/-]|$)/i.test(name);
};

/** A GroupList record flattened into the columns the page shows. */
export const normalizeAllocationGroup = (record, accountCounts) => {
  // The exact stored name: the editors and the account counts use it to target this group, not a case or space twin.
  const name = exactName(pick(record, GROUP_NAME_KEYS));
  const execution = text(pick(record, ['executionMode', 'execution_mode', 'risk'])).toLowerCase();
  return {
    id: name,
    name,
    description: text(pick(record, ['description', 'Description', 'company', 'Company'])),
    type: isDemoGroup(record, name) ? 'Demo' : 'Real',
    currency: text(pick(record, ['currency', 'Currency', 'depositCurrency'])).toUpperCase(),
    leverage: toNumber(pick(record, ['leverage', 'Leverage'])),
    execution: EXECUTION_LABELS[execution] || (execution ? execution.charAt(0).toUpperCase() + execution.slice(1) : ''),
    marginCall: toNumber(pick(record, ['marginCallLevel', 'margin_call', 'MarginCall', 'margin_call_level'])),
    stopOut: toNumber(pick(record, ['stopOutLevel', 'stop_out', 'MarginStopOut', 'stop_out_level'])),
    tradeAllowed: toBoolean(pick(record, ['tradeAllowed', 'trade_allowed', 'enabled', 'Enabled'])),
    accounts: accountCounts ? (accountCounts.get(name) || 0) : null,
    record,
  };
};

export const normalizeAllocationGroups = (records, accountCounts) => {
  const seen = new Set();
  const groups = [];
  for (const record of Array.isArray(records) ? records : []) {
    const group = normalizeAllocationGroup(record, accountCounts);
    const key = group.name;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    groups.push(group);
  }
  return groups;
};

const SEARCH_FIELDS = ['name', 'description', 'currency', 'type', 'execution'];

const compareValues = (left, right) => {
  const leftEmpty = left === null || left === undefined || left === '';
  const rightEmpty = right === null || right === undefined || right === '';
  if (leftEmpty || rightEmpty) return leftEmpty === rightEmpty ? 0 : leftEmpty ? 1 : -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
};

/** Search, type and currency filters, then a stable column sort (empty values last). */
export const filterAllocationGroups = (groups, { query = '', type = '', currency = '', sortKey = 'name', sortDirection = 'asc' } = {}) => {
  const needle = query.trim().toLowerCase();
  const rows = groups.filter((group) => (
    (!needle || SEARCH_FIELDS.some((field) => String(group[field] ?? '').toLowerCase().includes(needle)))
    && (!type || group.type === type)
    && (!currency || group.currency === currency)
  ));
  const direction = sortDirection === 'desc' ? -1 : 1;
  return rows
    .map((group, index) => ({ group, index }))
    .sort((a, b) => {
      const result = compareValues(a.group[sortKey], b.group[sortKey]);
      if (result === 0) return a.index - b.index;
      const emptyA = a.group[sortKey] === null || a.group[sortKey] === '';
      const emptyB = b.group[sortKey] === null || b.group[sortKey] === '';
      return emptyA || emptyB ? result : result * direction;
    })
    .map(({ group }) => group);
};
