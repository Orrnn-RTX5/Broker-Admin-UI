const GROUP_NAME_KEYS = ['name', 'Name', 'group', 'Group', 'group_name', 'groupName'];
const ACCOUNT_GROUP_KEYS = ['group', 'Group', 'group_name', 'groupName', 'account_group', 'accountGroup', 'accountGroupName', 'AccountGroup'];
const ACCOUNT_LOGIN_KEYS = ['login', 'Login', 'account_login', 'accountLogin'];
const DEFAULT_ARRAY_KEYS = ['groups', 'accounts', 'answer', 'data', 'items', 'rows', 'results'];
const TOTAL_KEYS = ['total', 'totalCount', 'total_count', 'recordsTotal', 'records_total', 'filteredTotal', 'filtered_total'];

const scalarText = (value) => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};

const fieldText = (row, keys) => {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return '';
  for (const key of keys) {
    const value = scalarText(row[key]);
    if (value) return value;
  }
  return '';
};

const compareLabels = (left, right) => (
  left.label.localeCompare(right.label, undefined, { numeric: true, sensitivity: 'base' })
  || left.label.localeCompare(right.label)
);

// Group names are exact identities: letter case and surrounding spaces both make a different group (case twins),
// so names are kept as the server sent them. Blank values still count as missing.
const exactText = (value) => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};

const exactField = (row, keys) => {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return '';
  for (const key of keys) {
    const value = exactText(row[key]);
    if (value.trim()) return value;
  }
  return '';
};

/** The navigation group named exactly `name`, or null. A case or space twin is a different group and is never returned. */
export const findNavigationGroupByName = (groups, name) => {
  const wanted = exactText(name);
  if (!wanted.trim() || !Array.isArray(groups)) return null;
  return groups.find((group) => group?.groupName === wanted) ?? null;
};

export const normalizeNavigationGroups = (rows) => {
  const groups = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const groupName = typeof row === 'string' ? row : exactField(row, GROUP_NAME_KEYS);
    if (!groupName.trim() || groups.has(groupName)) continue;
    groups.set(groupName, { id: `group:${groupName}`, groupName, label: groupName, group: row });
  }
  return [...groups.values()].sort(compareLabels);
};

export const normalizeNavigationAccounts = (rows, groupName) => {
  const fullGroupName = exactText(groupName);
  if (!fullGroupName.trim()) return [];

  const accounts = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (exactField(row, ACCOUNT_GROUP_KEYS) !== fullGroupName) continue;
    const login = fieldText(row, ACCOUNT_LOGIN_KEYS);
    if (!login || accounts.has(login)) continue;
    accounts.set(login, {
      id: `account:${encodeURIComponent(fullGroupName)}:${encodeURIComponent(login)}`,
      label: login,
      login,
      groupName: fullGroupName,
      account: { ...row, login, group: fullGroupName, raw: row },
    });
  }
  return [...accounts.values()].sort(compareLabels);
};

const readRows = (response, arrayKeys, depth = 0) => {
  if (Array.isArray(response)) return response;
  if (!response || typeof response !== 'object' || depth > 5) return null;
  for (const key of arrayKeys) {
    if (Array.isArray(response[key])) return response[key];
  }
  for (const key of arrayKeys) {
    const nested = readRows(response[key], arrayKeys, depth + 1);
    if (nested) return nested;
  }
  return null;
};

const readCountMetadata = (response, keys, depth = 0) => {
  if (!response || typeof response !== 'object' || Array.isArray(response) || depth > 5) return undefined;
  for (const key of keys) {
    const raw = response[key];
    if (raw === null || raw === undefined || raw === '' || typeof raw === 'boolean') continue;
    const total = Number(raw);
    if (Number.isInteger(total) && total >= 0) return total;
  }
  for (const key of ['pagination', 'meta', 'data', 'answer', 'result']) {
    const nested = readCountMetadata(response[key], keys, depth + 1);
    if (nested !== undefined) return nested;
  }
  return undefined;
};

const readTotal = (response) => (
  readCountMetadata(response, TOTAL_KEYS) ?? readCountMetadata(response, ['count'])
);

/** Load every available page without imposing a limit on the displayed tree. */
export const loadGroupTreePages = async (fetchPage, { arrayKeys = DEFAULT_ARRAY_KEYS, limit = 100, ...params } = {}) => {
  let pageLimit = Number.isInteger(Number(limit)) && Number(limit) > 0 ? Number(limit) : 100;
  let page = 1;
  let knownTotal;
  const result = [];
  const seenPages = new Set();

  while (true) {
    const response = await fetchPage({ ...params, page, limit: pageLimit });
    const rows = readRows(response, arrayKeys);
    if (!rows) throw new Error('The group navigator received an invalid list response.');
    const total = readTotal(response);
    if (total !== undefined) knownTotal = total;

    if (rows.length === 0) {
      if (knownTotal !== undefined && result.length < knownTotal) {
        throw new Error('The group navigator received an empty page before all records were loaded.');
      }
      return result;
    }

    const fingerprint = JSON.stringify(rows);
    if (seenPages.has(fingerprint)) {
      throw new Error('The group navigator received a repeated page before pagination completed.');
    }
    seenPages.add(fingerprint);
    for (const row of rows) result.push(row);

    if (knownTotal !== undefined && result.length >= knownTotal) return result;
    // Older manager endpoints return the entire collection instead of a page.
    if (knownTotal === undefined && rows.length !== pageLimit) return result;

    if (rows.length !== pageLimit) {
      if (page > 1) {
        throw new Error('The group navigator page size changed before all records were loaded.');
      }
      // Some servers enforce a smaller page size than requested. Continue from
      // the actual first-page boundary instead of skipping unseen records.
      pageLimit = rows.length;
    }
    page += 1;
  }
};
