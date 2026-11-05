import { normalizeNavigationGroups } from './groupTreeData.js';
import { getStoredCacheIdentity, identitySnapshotKey } from './cacheIdentity.js';

export const GROUP_LIST_ARRAY_KEYS = ['answer', 'groups', 'data', 'items', 'rows'];
export const GROUP_LIST_CACHE_TTL_MS = 5 * 60 * 1000;
export const GROUP_LIST_FETCH_OPTIONS = Object.freeze({ requestKey: 'groups:list', cacheTtlMs: GROUP_LIST_CACHE_TTL_MS });

const SNAPSHOT_PREFIX = 'rtx5-admin-group-list:';
// Version 3: version-2 snapshots were built by the folded code, which dropped case and space twins. They are rejected on
// read, so the live list loads at once. Rolling back is safe: the older code rejects version 3 too.
const SNAPSHOT_VERSION = 3;
const SNAPSHOT_LIMIT = 5000;
const SNAPSHOT_MAX_CHARS = 512 * 1024;
const RECORD_FIELDS = new Set([
  '_allocationSummary',
  'name', 'Name', 'group', 'Group', 'group_name', 'groupName',
  'description', 'Description', 'company', 'Company', 'demo', 'Demo', 'isDemo', 'is_demo',
  'accountType', 'account_type', 'type', 'currency', 'Currency', 'depositCurrency', 'deposit_currency',
  'leverage', 'Leverage', 'executionMode', 'ExecutionMode', 'execution_mode', 'risk', 'risk_management', 'riskManagement',
  'margin', 'Margin', 'marginCallLevel', 'margin_call', 'MarginCall', 'margin_call_level',
  'stopOutLevel', 'stop_out', 'MarginStopOut', 'stop_out_level', 'tradeAllowed', 'trade_allowed', 'enabled', 'Enabled',
]);

let owner = null;
let generation = 0;
let memory = null;
let pending = null;

const prepare = (identity) => {
  if (owner !== identity) {
    owner = identity;
    generation += 1;
    memory = null;
    pending = null;
  }
};

const fresh = (at) => Number.isFinite(at) && at > 0 && Date.now() >= at && Date.now() - at < GROUP_LIST_CACHE_TTL_MS;
const safeScalar = (value) => value === null || typeof value === 'boolean'
  || (typeof value === 'number' && Number.isFinite(value))
  || (typeof value === 'string' && value.length <= 4096);

// Save only the columns needed to paint the navigation and allocation tables.
// Complete editable records stay in memory after the server responds.
const snapshotGroup = (group) => ({
  id: `group:${group.groupName}`,
  groupName: group.groupName,
  label: group.groupName,
  group: { name: group.groupName, ...Object.fromEntries(Object.entries(group.group && typeof group.group === 'object' ? group.group : {})
    .filter(([key, value]) => RECORD_FIELDS.has(key) && safeScalar(value))), _allocationSummary: true },
});

const validGroup = (group) => typeof group?.groupName === 'string' && group.groupName.trim()
  && group.groupName.length <= 1024 && group.group && typeof group.group === 'object' && !Array.isArray(group.group)
  && Object.entries(group.group).every(([key, value]) => RECORD_FIELDS.has(key) && safeScalar(value));

/** A recent display-only snapshot for exactly this broker and authorization scope. */
export const readGroupListSnapshot = (identity = getStoredCacheIdentity()) => {
  const key = identitySnapshotKey(SNAPSHOT_PREFIX, identity);
  if (!key) return null;
  prepare(identity);
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw || raw.length > SNAPSHOT_MAX_CHARS) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== SNAPSHOT_VERSION || parsed.identity !== identity || !fresh(parsed.at)
      || !Array.isArray(parsed.groups) || parsed.groups.length > SNAPSHOT_LIMIT || !parsed.groups.every(validGroup)) return null;
    return parsed.groups.map(snapshotGroup);
  } catch {
    return null;
  }
};

export const writeGroupListSnapshot = (groups, identity = getStoredCacheIdentity(), at = Date.now()) => {
  const key = identitySnapshotKey(SNAPSHOT_PREFIX, identity);
  if (!key || !Array.isArray(groups) || groups.length > SNAPSHOT_LIMIT || !fresh(at)) return;
  try {
    const slimGroups = groups.map(snapshotGroup);
    if (!slimGroups.every(validGroup)) return;
    const raw = JSON.stringify({ version: SNAPSHOT_VERSION, identity, groups: slimGroups, at });
    if (raw.length <= SNAPSHOT_MAX_CHARS) globalThis.localStorage?.setItem(key, raw);
  } catch { /* A full or unavailable store must not interrupt the live list. */ }
};

export const clearGroupListSnapshot = (identity = getStoredCacheIdentity()) => {
  const key = identitySnapshotKey(SNAPSHOT_PREFIX, identity);
  if (!key) return;
  try { globalThis.localStorage?.removeItem(key); } catch { /* ignore */ }
};

/** Fresh complete records, including an empty list, shared by startup and views. */
export const peekGroupList = (identity = getStoredCacheIdentity()) => {
  prepare(identity);
  return identity && memory?.identity === identity && fresh(memory.at) ? memory.groups : null;
};

/** Invalidate after a mutation, explicit refresh, logout or authorization change. */
export const invalidateGroupListCache = ({ identity = owner || getStoredCacheIdentity(), clearSnapshot = false } = {}) => {
  if (!identity || owner === identity) {
    generation += 1;
    memory = null;
    pending = null;
  }
  if (clearSnapshot) clearGroupListSnapshot(identity);
};

const canceled = () => Object.assign(new Error('Group access changed while loading.'), { code: 'ERR_CANCELED' });
const denied = (error) => [401, 403, 419].includes(Number(error?.status ?? error?.response?.status));

/** Fetch every page once; foreground and preload readers share the same request. */
export const loadGroupList = (fetchRows, { force = false, identity = getStoredCacheIdentity() } = {}) => {
  prepare(identity);
  if (!force) {
    const cached = peekGroupList(identity);
    if (cached !== null) return Promise.resolve(cached);
  }
  if (pending && (!force || pending.force)) return pending.promise;
  if (force) invalidateGroupListCache({ identity });

  const request = { identity, generation, force, promise: null };
  const storedAtStart = getStoredCacheIdentity();
  const relevant = () => request.generation === generation && owner === identity
    && (!storedAtStart || getStoredCacheIdentity() === identity);
  request.promise = Promise.resolve().then(fetchRows).then((rows) => {
    if (!relevant()) throw canceled();
    const groups = normalizeNavigationGroups(rows);
    if (identity) {
      const at = Date.now();
      memory = { identity, groups, at };
      writeGroupListSnapshot(groups, identity, at);
    }
    return groups;
  }).catch((error) => {
    if (relevant() && denied(error)) invalidateGroupListCache({ identity, clearSnapshot: true });
    throw error;
  }).finally(() => { if (pending === request) pending = null; });
  pending = request;
  return request.promise;
};
