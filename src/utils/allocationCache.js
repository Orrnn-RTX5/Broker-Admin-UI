import { normalizeAllocationGroups } from './allocations.js';
import { readGroupListSnapshot } from './groupListCache.js';
import { getStoredCacheIdentity, identitySnapshotKey } from './cacheIdentity.js';

// Persist only the table columns. Full group settings stay in memory and are
// loaded from the backend before editing a restored summary.
const SNAPSHOT_PREFIX = 'rtx5-admin-allocations:';
export const ALLOCATION_CACHE_VERSION = 2;
export const ALLOCATION_CACHE_TTL_MS = 5 * 60 * 1000;
export const ALLOCATION_CACHE_ROW_LIMIT = 5000;
export const ALLOCATION_CACHE_SIZE_LIMIT = 2 * 1024 * 1024;
const FUTURE_TOLERANCE_MS = 30_000;

const memory = new Map();
const identityFrom = (options) => typeof options === 'string' ? options
  : options && Object.hasOwn(options, 'identity') ? options.identity : getStoredCacheIdentity();
const fresh = (at) => Number.isFinite(at) && at > 0
  && at <= Date.now() + FUTURE_TOLERANCE_MS && Date.now() - at <= ALLOCATION_CACHE_TTL_MS;
const validString = (value, max) => typeof value === 'string' && value.length <= max;
const nullableNumber = (value) => value === null || (typeof value === 'number' && Number.isFinite(value));
const validAccounts = (value) => value === null || (Number.isSafeInteger(value) && value >= 0);

const validRows = (rows, accountsKnown) => {
  if (!Array.isArray(rows) || rows.length > ALLOCATION_CACHE_ROW_LIMIT) return false;
  const names = new Set();
  for (const row of rows) {
    if (!row || !validString(row.name, 512) || !row.name.trim() || row.name !== row.name.trim()
      || !validString(row.description, 4096) || !['Real', 'Demo'].includes(row.type)
      || !validString(row.currency, 32) || (row.execution !== undefined && !validString(row.execution, 64))
      || !nullableNumber(row.leverage) || !nullableNumber(row.marginCall) || !nullableNumber(row.stopOut)
      || (row.tradeAllowed !== null && typeof row.tradeAllowed !== 'boolean') || !validAccounts(row.accounts)
      || (accountsKnown && row.accounts === null)) return false;
    const name = row.name.toLowerCase();
    if (names.has(name)) return false;
    names.add(name);
  }
  return true;
};

const summaryRecord = (row) => ({
  _allocationSummary: true,
  name: row.name,
  group: row.name,
  description: row.description,
  accountType: row.type,
  demo: row.type === 'Demo',
  currency: row.currency,
  leverage: row.leverage,
  executionMode: row.execution || '',
  marginCallLevel: row.marginCall,
  stopOutLevel: row.stopOut,
  tradeAllowed: row.tradeAllowed,
});

const slimRow = (row) => ({
  id: row.name,
  name: row.name,
  description: row.description,
  type: row.type,
  currency: row.currency,
  leverage: row.leverage,
  execution: row.execution || '',
  marginCall: row.marginCall,
  stopOut: row.stopOut,
  tradeAllowed: row.tradeAllowed,
  accounts: row.accounts,
  record: summaryRecord(row),
});

const readDisk = (identity, key) => {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw || raw.length > ALLOCATION_CACHE_SIZE_LIMIT) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== ALLOCATION_CACHE_VERSION || parsed.identity !== identity
      || typeof parsed.accountsKnown !== 'boolean' || !fresh(parsed.at)
      || !validRows(parsed.rows, parsed.accountsKnown)) return null;
    const snapshot = {
      key, identity, rows: parsed.rows.map(slimRow), accountsKnown: parsed.accountsKnown, at: parsed.at,
    };
    memory.set(identity, snapshot);
    return snapshot;
  } catch { return null; }
};

/** Read the current authorization scope; an empty successful list is a cache hit. */
export const readAllocationCache = (options) => {
  const identity = identityFrom(options);
  const key = identitySnapshotKey(SNAPSHOT_PREFIX, identity);
  if (!key) return null;
  const cached = memory.get(identity);
  if (cached && fresh(cached.at)) return cached;
  memory.delete(identity);
  return readDisk(identity, key);
};

/** Async callers pass the identity captured before starting their requests. */
export const writeAllocationCache = ({ rows, accountsKnown = false, at = Date.now(), ...options }) => {
  const identity = identityFrom(options);
  const key = identitySnapshotKey(SNAPSHOT_PREFIX, identity);
  if (!key || typeof accountsKnown !== 'boolean' || !fresh(at) || !validRows(rows, accountsKnown)) return null;
  const slimRows = rows.map(slimRow);
  const serialized = JSON.stringify({ version: ALLOCATION_CACHE_VERSION, identity, rows: slimRows, accountsKnown, at });
  if (serialized.length > ALLOCATION_CACHE_SIZE_LIMIT) return null;
  const snapshot = { key, identity, rows, accountsKnown, at };
  memory.set(identity, snapshot);
  try { globalThis.localStorage?.setItem(key, serialized); } catch { /* Memory remains useful if storage is full. */ }
  return snapshot;
};

/** Remove rows after authorization is refused or explicitly invalidated. */
export const clearAllocationCache = (options) => {
  const identity = identityFrom(options);
  const key = identitySnapshotKey(SNAPSHOT_PREFIX, identity);
  if (!key) return;
  memory.delete(identity);
  try { globalThis.localStorage?.removeItem(key); } catch { /* ignore storage restrictions */ }
};

/** Disk snapshots remain available after a hard reload. */
export const forgetAllocationMemory = () => { memory.clear(); };

/** Counts carried from the rows already on screen while a newer list is applied. */
export const countsFromAllocationRows = (rows) => {
  if (!Array.isArray(rows) || !rows.length) return null;
  const counts = new Map();
  for (const row of rows) {
    if (!validAccounts(row?.accounts) || row.accounts === null || typeof row?.name !== 'string' || !row.name) return null;
    counts.set(row.name.toLowerCase(), row.accounts);
  }
  return counts;
};

const rowsFromNavigation = (navigation) => normalizeAllocationGroups((Array.isArray(navigation) ? navigation : []).map((group) => (
  group?.group && typeof group.group === 'object'
    ? { ...group.group, _allocationSummary: true }
    : { name: group?.groupName || group?.name || '', _allocationSummary: true }
)));

/** First-render state is synchronous and contains only rows from this scope. */
export const initialAllocationState = (options) => {
  const identity = identityFrom(options);
  const allocation = readAllocationCache({ identity });
  if (allocation) return {
    loading: false, syncing: false, error: '', rows: allocation.rows,
    accountsKnown: allocation.accountsKnown, updatedAt: allocation.at,
  };
  const navigation = identity ? readGroupListSnapshot(identity) : null;
  if (navigation !== null) return {
    loading: false, syncing: false, error: '', rows: rowsFromNavigation(navigation), accountsKnown: false, updatedAt: null,
  };
  return { loading: true, syncing: false, error: '', rows: [], accountsKnown: false, updatedAt: null };
};
