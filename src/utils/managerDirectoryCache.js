import { identitySnapshotKey } from './cacheIdentity.js';

export const MANAGER_DIRECTORY_KINDS = ['managers', 'roles', 'online'];
const PREFIX = 'rtx5-manager-directory:';
const SUMMARY_TTL = 60_000;
const SUMMARY_FIELDS = ['login', 'name', 'role_name', 'role_id', 'is_admin', 'enabled', 'last_login', 'last_ip'];
const emptyResource = () => ({ rows: [], hasData: false, loading: true, refreshing: false, error: null, updatedAt: 0 });
const emptyState = () => Object.fromEntries(MANAGER_DIRECTORY_KINDS.map(kind => [kind, emptyResource()]));
const safeScalar = value => value === null || typeof value === 'boolean'
  || (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.length <= 4096);
const validSummary = row => row && typeof row === 'object' && /^\d+$/.test(String(row.login))
  && typeof row.name === 'string' && typeof row.is_admin === 'boolean' && typeof row.enabled === 'boolean'
  && Object.entries(row).every(([key, value]) => SUMMARY_FIELDS.includes(key) && safeScalar(value));

/** Display-only summaries survive a same-tab reload. Editable access settings are never persisted. */
export const createManagerSummaryStore = ({ storage = () => globalThis.sessionStorage, now = Date.now } = {}) => {
  const clear = identity => {
    const key = identitySnapshotKey(PREFIX, identity);
    if (key) { try { storage()?.removeItem(key); } catch { /* Optional storage. */ } }
  };
  return {
    clear,
    read(identity) {
      const key = identitySnapshotKey(PREFIX, identity);
      if (!key) return null;
      try {
        const raw = storage()?.getItem(key);
        if (!raw || raw.length > 2 * 1024 * 1024) return null;
        const data = JSON.parse(raw);
        if (data.version !== 1 || data.identity !== identity || !Number.isFinite(data.at)
          || data.at > now() || now() - data.at >= SUMMARY_TTL || !Array.isArray(data.rows)
          || data.rows.length > 5000 || !data.rows.every(validSummary)
          || new Set(data.rows.map(row => String(row.login))).size !== data.rows.length) return null;
        return { rows: data.rows.map(row => ({ ...row, _directorySummary: true })), at: data.at };
      } catch { return null; }
    },
    write(identity, rows, at) {
      const key = identitySnapshotKey(PREFIX, identity);
      if (!key || !Array.isArray(rows) || rows.length > 5000) return;
      const summaries = rows.map(row => Object.fromEntries(SUMMARY_FIELDS.filter(field => row[field] !== undefined).map(field => [field, row[field]])));
      if (!summaries.every(validSummary)) return;
      try {
        const raw = JSON.stringify({ version: 1, identity, at, rows: summaries });
        if (raw.length <= 2 * 1024 * 1024) storage()?.setItem(key, raw);
      } catch { /* Quota/disabled storage must not delay the live directory. */ }
    },
  };
};

const unwrap = (value, kind) => {
  const rows = Array.isArray(value) ? value : [value?.data, value?.answer, value?.[kind], value?.rows].find(Array.isArray);
  if (!rows || !rows.every(row => row && typeof row === 'object' && !Array.isArray(row))) throw new Error('Invalid manager directory response.');
  return rows;
};

/** Each projection publishes independently; preloads and mounted readers share in-flight work. */
export const createManagerDirectoryLoader = ({ fetchers, summaries = createManagerSummaryStore(),
  isCurrent = () => true, now = Date.now, ttl = { managers: 15_000, roles: 60_000, online: 5_000 } }) => {
  const entries = new Map(), listeners = new Set(), unavailable = emptyState();
  const notify = () => listeners.forEach(listener => listener());
  const entryFor = identity => {
    if (!entries.has(identity)) {
      const saved = summaries.read(identity), state = emptyState();
      if (saved) state.managers = { ...state.managers, rows: saved.rows, hasData: true, loading: false, updatedAt: saved.at };
      entries.set(identity, { state, generations: {}, pending: {}, completed: {} });
    }
    return entries.get(identity);
  };
  const peek = identity => identity ? entryFor(identity).state : unavailable;
  const read = (identity, kind, { force = false } = {}) => {
    if (!identity || !isCurrent(identity) || !MANAGER_DIRECTORY_KINDS.includes(kind)) return Promise.resolve(null);
    const entry = entryFor(identity);
    if (entry.pending[kind] && (!force || entry.pending[kind].force)) return entry.pending[kind].promise;
    if (!force && entry.completed[kind] && now() - entry.completed[kind] < ttl[kind]) return Promise.resolve(entry.state[kind]);
    const generation = (entry.generations[kind] || 0) + 1;
    entry.generations[kind] = generation;
    const current = () => entries.get(identity) === entry && entry.generations[kind] === generation && isCurrent(identity);
    const patch = change => {
      if (!current()) return;
      entry.state = { ...entry.state, [kind]: { ...entry.state[kind], ...change } };
      notify();
    };
    patch({ loading: !entry.state[kind].hasData, refreshing: true, error: null });
    const request = { force, promise: null };
    request.promise = Promise.resolve().then(() => fetchers[kind]()).then(value => {
      if (!current()) return null;
      const rows = unwrap(value, kind), at = now();
      entry.completed[kind] = at;
      patch({ rows, hasData: true, loading: false, refreshing: false, updatedAt: at, error: null });
      if (kind === 'managers') summaries.write(identity, rows, at);
      return entry.state[kind];
    }).catch(error => {
      if (!current()) return null;
      entry.completed[kind] = 0;
      if ([401, 403, 419].includes(Number(error?.response?.status))) {
        summaries.clear(identity);
        patch({ rows: [], hasData: false, updatedAt: 0 });
      }
      patch({ loading: false, refreshing: false, error });
      return entry.state[kind];
    }).finally(() => { if (entry.pending[kind] === request) delete entry.pending[kind]; });
    entry.pending[kind] = request;
    return request.promise;
  };
  return {
    peek, read,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    invalidate(identity, kinds = MANAGER_DIRECTORY_KINDS) {
      const entry = entries.get(identity);
      if (kinds.includes('managers')) summaries.clear(identity);
      if (!entry) return;
      for (const kind of kinds) {
        entry.generations[kind] = (entry.generations[kind] || 0) + 1;
        delete entry.pending[kind]; delete entry.completed[kind];
      }
      notify();
    },
    clear(identity) { summaries.clear(identity); entries.delete(identity); notify(); },
  };
};
