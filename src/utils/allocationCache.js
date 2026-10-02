import { normalizeAllocationGroups } from './allocations.js';
import { readGroupListSnapshot } from './groupListCache.js';

// The allocations table paints from this copy. A hard refresh loses the
// in-memory rows and reads the small saved copy, so the grid is not blank
// while GroupList and the account census are still on the network.
const SNAPSHOT_PREFIX = 'rtx5-admin-allocations:';

let memory = null;

const snapshotKey = () => {
  try { return `${SNAPSHOT_PREFIX}${globalThis.localStorage?.getItem('brokerLogin') || 'shared'}`; } catch { return `${SNAPSHOT_PREFIX}shared`; }
};

const slimRow = ({ record: _record, ...row }) => row;

const readDisk = () => {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(snapshotKey()) ?? 'null');
    if (!parsed || !Array.isArray(parsed.rows) || !parsed.rows.length) return null;
    if (!parsed.rows.every((row) => typeof row?.name === 'string' && row.name)) return null;
    return {
      key: snapshotKey(),
      rows: parsed.rows.map(slimRow),
      accountsKnown: Boolean(parsed.accountsKnown),
      at: Number(parsed.at) || 0,
    };
  } catch {
    return null;
  }
};

/** Last rows for this broker: memory first, then the saved copy. */
export const readAllocationCache = () => {
  const key = snapshotKey();
  if (memory?.key === key && Array.isArray(memory.rows) && memory.rows.length) return memory;
  return readDisk();
};

export const writeAllocationCache = ({ rows, accountsKnown, at = Date.now() }) => {
  if (!Array.isArray(rows)) return;
  const key = snapshotKey();
  memory = { key, rows, accountsKnown: Boolean(accountsKnown), at };
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify({
      rows: rows.map(slimRow),
      accountsKnown: Boolean(accountsKnown),
      at,
    }));
  } catch { /* Storage may be full; the in-memory copy still paints this session. */ }
};

/** Drop the in-memory copy. The saved rows remain for the next cold start. */
export const forgetAllocationMemory = () => { memory = null; };

/** Counts carried from the rows already on screen while a newer list is applied. */
export const countsFromAllocationRows = (rows) => {
  if (!Array.isArray(rows) || !rows.length) return null;
  const counts = new Map();
  for (const row of rows) {
    if (typeof row?.accounts !== 'number' || typeof row?.name !== 'string' || !row.name) return null;
    counts.set(row.name.toLowerCase(), row.accounts);
  }
  return counts;
};

const rowsFromNavigation = (navigation) => normalizeAllocationGroups((Array.isArray(navigation) ? navigation : []).map((group) => (
  group?.group && typeof group.group === 'object' ? group.group : { name: group?.groupName || group?.name || '' }
)));

/** What the table shows on the first render, before any request is sent. */
export const initialAllocationState = () => {
  const allocation = readAllocationCache();
  if (allocation?.rows?.length) {
    return {
      loading: false,
      syncing: false,
      error: '',
      rows: allocation.rows,
      accountsKnown: Boolean(allocation.accountsKnown),
      updatedAt: allocation.at || null,
    };
  }
  const rows = rowsFromNavigation(readGroupListSnapshot());
  if (rows.length) {
    return { loading: false, syncing: false, error: '', rows, accountsKnown: false, updatedAt: null };
  }
  return { loading: true, syncing: false, error: '', rows: [], accountsKnown: false, updatedAt: null };
};
