import { loadGroupTreePages, normalizeNavigationAccounts, normalizeNavigationGroups } from './groupTreeData.js';

export const GROUPS_ROOT_NODE = Object.freeze({ type: 'groups-root', id: 'groups', label: 'Groups' });
export const GROUPS_ADMIN_NODE = Object.freeze({ type: 'groups-admin', id: 'groups:admin', label: 'Admin' });

const readField = (record, keys) => {
  for (const key of keys) {
    const value = record?.[key];
    if ((typeof value === 'string' && value.trim()) || typeof value === 'number' || typeof value === 'boolean') return value;
  }
  return '';
};

const marginText = (group) => {
  const explicit = readField(group, ['margin', 'Margin']);
  if (explicit !== '') return explicit;
  const call = readField(group, ['marginCallLevel', 'margin_call', 'MarginCall', 'margin_call_level']);
  const stop = readField(group, ['stopOutLevel', 'stop_out', 'MarginStopOut', 'stop_out_level']);
  return [call, stop].filter(value => value !== '').map(value => `${value}%`).join(' / ');
};

/** The accounts of exactly one group, picked from the full account list. */
export const getGroupAccountNodes = (accountRows, groupName) => normalizeNavigationAccounts(accountRows, groupName)
  .map(account => ({ ...account, type: 'group-account' }));

export const loadGroupsExplorerNodes = async (location, { getGroups, getAllAccounts }) => {
  if (location.type === 'root') return [GROUPS_ADMIN_NODE];
  if (location.type === 'admin') {
    const rows = await loadGroupTreePages(getGroups, { arrayKeys: ['answer', 'groups', 'data', 'items', 'rows'] });
    return normalizeNavigationGroups(rows).map(group => ({ ...group, type: 'group' }));
  }
  if (location.type === 'group' && location.groupName) {
    return getGroupAccountNodes(await getAllAccounts(), location.groupName);
  }
  return [];
};

export const getGroupsExplorerRow = (node) => {
  if (node.type === 'group-account') {
    const account = node.account;
    return {
      login: node.login,
      name: readField(account, ['name', 'Name', 'full_name', 'fullName']),
      group: node.groupName,
      balance: readField(account, ['balance', 'Balance']),
      equity: readField(account, ['equity', 'Equity']),
      currency: readField(account, ['currency', 'Currency', 'deposit_currency']),
      status: readField(account, ['status', 'Status']),
    };
  }
  return {
    group: node.label,
    risk: readField(node.group, ['risk', 'risk_management', 'riskManagement', 'executionMode', 'ExecutionMode']),
    margin: marginText(node.group),
    currency: readField(node.group, ['currency', 'Currency', 'deposit_currency']),
  };
};

const FOLDER_COLUMNS = [
  { key: 'group', label: 'Group', primary: true },
  { key: 'risk', label: 'Risk Management' },
  { key: 'margin', label: 'Margin', numeric: true },
  { key: 'currency', label: 'Currency' },
];
const ACCOUNT_COLUMNS = [
  { key: 'login', label: 'Login', primary: true },
  { key: 'name', label: 'Name' },
  { key: 'group', label: 'Group' },
  { key: 'balance', label: 'Balance', numeric: true },
  { key: 'equity', label: 'Equity', numeric: true },
  { key: 'currency', label: 'Currency' },
  { key: 'status', label: 'Status' },
];

// A folder that is itself a group lists its subgroups and its own accounts together.
const MIXED_COLUMNS = [
  { key: 'group', label: 'Group / Login', primary: true },
  { key: 'name', label: 'Name' },
  { key: 'risk', label: 'Risk Management' },
  { key: 'margin', label: 'Margin', numeric: true },
  { key: 'balance', label: 'Balance', numeric: true },
  { key: 'equity', label: 'Equity', numeric: true },
  { key: 'currency', label: 'Currency' },
  { key: 'status', label: 'Status' },
];

// Header labels describe the API schema; account columns appear only when the
// current collection supplies values, including numeric zero balances.
export const getGroupsExplorerColumns = (location, nodes) => {
  const hasAccounts = nodes.some(node => node.type === 'group-account');
  if (location.type !== 'group' && !hasAccounts) return FOLDER_COLUMNS;
  const rows = nodes.map(getGroupsExplorerRow);
  const columns = location.type === 'group' ? ACCOUNT_COLUMNS : MIXED_COLUMNS;
  return columns.filter(column => column.primary || rows.some(row => row[column.key] !== '' && row[column.key] !== undefined));
};

export const filterGroupsExplorerNodes = (nodes, searchQuery = '', sortDirection = 'asc') => {
  const query = String(searchQuery).trim().toLowerCase();
  return nodes.filter(node => !query || Object.values(getGroupsExplorerRow(node)).some(value => String(value).toLowerCase().includes(query)))
    .sort((left, right) => {
      const order = left.label.localeCompare(right.label, undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'desc' ? -order : order;
    });
};

export const getGroupsExplorerEditTarget = (node) => {
  if (node.type === 'group-account') {
    return { type: 'account', row: node.account, id: node.account.id ?? node.login, viewType: 'Groups' };
  }
  if (node.type === 'group') {
    const source = node.group && typeof node.group === 'object' ? node.group : {};
    return { type: 'group', row: { ...source, name: node.groupName, group: node.groupName }, id: node.groupName, viewType: 'Groups' };
  }
  return null;
};

const GROUP_PATH_SEPARATOR = '\\';
const equalPath = (left, right) => left.toLowerCase() === right.toLowerCase();
const belowPath = (candidate, parent) => candidate.toLowerCase().startsWith(`${parent.toLowerCase()}${GROUP_PATH_SEPARATOR}`);

export const getServerGroupCount = (groups, path = '') => groups.filter(group => !path || equalPath(group.groupName, path) || belowPath(group.groupName, path)).length;

export const getServerGroupParentPath = (path = '') => {
  const position = String(path).lastIndexOf(GROUP_PATH_SEPARATOR);
  return position < 0 ? '' : String(path).slice(0, position);
};

// Server names nest on backslashes. A group whose name also prefixes other
// names owns that folder: one row, with the nested groups as its subgroups.
export const getServerGroupFolderNodes = (groups, path = '') => {
  const depth = path ? path.split(GROUP_PATH_SEPARATOR).length : 0;
  const nodes = new Map();
  for (const group of groups) {
    const name = group.groupName;
    if (path && !belowPath(name, path)) continue;
    const parts = name.split(GROUP_PATH_SEPARATOR);
    if (parts.length <= depth) continue;
    const childPath = parts.slice(0, depth + 1).join(GROUP_PATH_SEPARATOR);
    const key = childPath.toLowerCase();
    const node = nodes.get(key) || { id: `server-folder:${childPath}`, type: 'server-folder', label: parts[depth], path: childPath, count: 0 };
    if (parts.length === depth + 1) Object.assign(node, group, { type: 'group', label: group.label, count: node.count });
    else node.count += 1;
    nodes.set(key, node);
  }
  return [...nodes.values()].sort((left, right) => (left.type === right.type ? 0 : left.type === 'server-folder' ? -1 : 1)
    || left.label.localeCompare(right.label, undefined, { numeric: true, sensitivity: 'base' }));
};

/** Every server group and folder path that can hold a subgroup, parents before children. */
export const listServerGroupContainerPaths = (groups) => {
  const paths = new Map();
  for (const group of groups) {
    const parts = group.groupName.split(GROUP_PATH_SEPARATOR);
    for (let depth = 1; depth <= parts.length; depth += 1) {
      const candidate = parts.slice(0, depth).join(GROUP_PATH_SEPARATOR);
      // A real group's spelling wins over a folder merely implied by a nested name.
      if (depth === parts.length || !paths.has(candidate.toLowerCase())) paths.set(candidate.toLowerCase(), candidate);
    }
  }
  return [...paths.values()].sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }));
};
