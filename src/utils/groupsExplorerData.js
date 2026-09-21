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

export const loadGroupsExplorerNodes = async (location, { getGroups, getAccounts }) => {
  if (location.type === 'root') return [GROUPS_ADMIN_NODE];
  if (location.type === 'admin') {
    const rows = await loadGroupTreePages(getGroups, { arrayKeys: ['answer', 'groups', 'data', 'items', 'rows'] });
    return normalizeNavigationGroups(rows).map(group => ({ ...group, type: 'group' }));
  }
  if (location.type === 'group' && location.groupName) {
    const rows = await loadGroupTreePages(getAccounts, {
      group: location.groupName,
      arrayKeys: ['accounts', 'data', 'answer', 'items', 'rows'],
    });
    return normalizeNavigationAccounts(rows, location.groupName).map(account => ({ ...account, type: 'group-account' }));
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

// Header labels describe the API schema; account columns appear only when the
// current collection supplies values, including numeric zero balances.
export const getGroupsExplorerColumns = (location, nodes) => {
  if (location.type !== 'group') return FOLDER_COLUMNS;
  const rows = nodes.map(getGroupsExplorerRow);
  return ACCOUNT_COLUMNS.filter(column => column.primary || rows.some(row => row[column.key] !== ''));
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
