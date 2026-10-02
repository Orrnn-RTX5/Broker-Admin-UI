import { normalizeNavigationGroups } from './groupTreeData.js';

// The group list is fetched once and shared by the explorer and the navigator:
// useDataFetch keys both on GROUP_LIST_FETCH_OPTIONS.requestKey, so remounting
// per folder reads the cached response, and a bumped refresh trigger invalidates it.
export const GROUP_LIST_ARRAY_KEYS = ['answer', 'groups', 'data', 'items', 'rows'];
export const GROUP_LIST_CACHE_TTL_MS = 5 * 60 * 1000;
export const GROUP_LIST_FETCH_OPTIONS = Object.freeze({ requestKey: 'groups:list', cacheTtlMs: GROUP_LIST_CACHE_TTL_MS });

const SNAPSHOT_PREFIX = 'rtx5-admin-group-list:';
const SNAPSHOT_LIMIT = 5000;

const snapshotKey = () => {
  try { return `${SNAPSHOT_PREFIX}${globalThis.localStorage?.getItem('brokerLogin') || 'shared'}`; } catch { return `${SNAPSHOT_PREFIX}shared`; }
};

/** Last successfully loaded list for this broker, so the tree paints before the server answers. */
export const readGroupListSnapshot = () => {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(snapshotKey()) ?? 'null');
    return Array.isArray(parsed?.groups) && parsed.groups.every(group => typeof group?.groupName === 'string') ? parsed.groups : null;
  } catch {
    return null;
  }
};

export const writeGroupListSnapshot = (groups) => {
  try {
    if (!Array.isArray(groups) || groups.length > SNAPSHOT_LIMIT) return;
    globalThis.localStorage?.setItem(snapshotKey(), JSON.stringify({ groups, at: Date.now() }));
  } catch { /* Storage may be full or unavailable; the live list still works. */ }
};

export const clearGroupListSnapshot = () => {
  try { globalThis.localStorage?.removeItem(snapshotKey()); } catch { /* ignore */ }
};

let groupListInflight = null;

/** Fetch every page once, normalize, and remember the result for the next start-up. */
export const loadGroupList = (fetchRows) => {
  if (groupListInflight) return groupListInflight;
  groupListInflight = Promise.resolve()
    .then(fetchRows)
    .then((rows) => {
      const groups = normalizeNavigationGroups(rows);
      writeGroupListSnapshot(groups);
      return groups;
    })
    .finally(() => { groupListInflight = null; });
  return groupListInflight;
};
