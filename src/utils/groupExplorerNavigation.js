import { normalizeDummyPath } from './dummyGroups.js';

const rootLocation = () => ({ type: 'root', id: 'groups', label: 'Groups' });
const adminLocation = () => ({ type: 'admin', id: 'groups:admin', label: 'Admin' });

const nameText = (value) => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};

const accountGroupName = (account) => {
  for (const key of ['group', 'Group', 'group_name', 'groupName', 'account_group', 'accountGroup', 'accountGroupName', 'AccountGroup']) {
    const name = nameText(account?.[key]);
    if (name) return name;
  }
  return '';
};

/** Resolve a tree node to a folder without treating arbitrary view labels as groups. */
export const resolveGroupExplorerNode = (node) => {
  if (node === 'Groups') return rootLocation();
  if (!node || typeof node !== 'object' || Array.isArray(node)) return null;

  if (node.type === 'dummy-folder' && typeof node.path === 'string') {
    try {
      const path = normalizeDummyPath(node.path);
      return { type: 'dummy-folder', id: `dummy-folder:${path}`, label: path.split('\\').at(-1), path };
    } catch {
      return null;
    }
  }

  if (node.type === 'server-folder' && typeof node.path === 'string') {
    const path = node.path.trim();
    if (!path) return null;
    return { type: 'server-folder', id: `server-folder:${path}`, label: path.split('\\').at(-1), path };
  }

  if (node.type === 'groups-root' || node.type === 'root') return rootLocation();
  if (node.type === 'admin' || node.type === 'groups-admin') return adminLocation();
  if (node.type !== 'group' && node.type !== 'group-account') return null;

  const groupName = nameText(node.groupName)
    || (node.type === 'group-account' ? accountGroupName(node.account) : '');
  if (!groupName) return null;

  return {
    type: 'group',
    id: `group:${groupName}`,
    label: groupName,
    groupName,
    ...(node.type === 'group' && node.group !== undefined ? { group: node.group } : {}),
  };
};

/** Folder identity excludes mutable display metadata and account selection. */
export const sameGroupExplorerLocation = (left, right) => {
  const leftLocation = resolveGroupExplorerNode(left) ?? rootLocation();
  const rightLocation = resolveGroupExplorerNode(right) ?? rootLocation();
  return leftLocation.type === rightLocation.type
    && leftLocation.path === rightLocation.path
    && leftLocation.groupName === rightLocation.groupName;
};

/** Existing saved views and new folder-aware history entries share one reader. */
export const getHistoryEntryView = (entry) => {
  if (typeof entry === 'string' && entry) return entry;
  return typeof entry?.view === 'string' && entry.view ? entry.view : 'Groups';
};

export const retireGroupHistory = (history, source, destination) => {
  const nextLocation = resolveGroupExplorerNode({ type: 'group', groupName: destination }) || rootLocation();
  return history.map(entry => entry?.groupExplorerLocation?.type === 'group' && entry.groupExplorerLocation.groupName === source
    ? { ...entry, groupExplorerLocation: nextLocation } : entry);
};
