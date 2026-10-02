export const SERVER_STATUS_FRESH_MS = 5_000;
export const SERVER_STATUS_SNAPSHOT_MS = 5 * 60_000;
export const SERVER_STATUS_STORAGE_KEY = 'rtx5-server-status-v1';

const savedMetrics = data => Object.fromEntries([
  'active_sessions', 'uptime_human', 'uptime_seconds', 'nats_status',
  'memory_alloc_mb', 'memory_sys_mb', 'goroutines', 'gc_cycles',
].filter(key => typeof data[key] === 'string' || typeof data[key] === 'number')
  .map(key => [key, data[key]]).concat(data.db_pool ? [['db_pool', Object.fromEntries(
    ['acquired_conns', 'idle_conns', 'total_conns'].filter(key => typeof data.db_pool[key] === 'number')
      .map(key => [key, data.db_pool[key]]),
  )]] : []));

// One tab-scoped, bounded snapshot. Never store credentials or arbitrary
// extra response fields. A reload always revalidates the saved measurements.
export const createServerStatusCache = ({ fetchStatus, storage = () => globalThis.sessionStorage, now = Date.now } = {}) => {
  let owner = '', snapshot = null, pending = null, generation = 0;
  const listeners = new Set();
  const notify = () => { for (const listener of listeners) listener(); };
  const removeSaved = () => { try { storage()?.removeItem(SERVER_STATUS_STORAGE_KEY); } catch { /* optional cache */ } };
  const reset = (nextOwner = '') => {
    generation++;
    pending?.controller.abort(); pending = null;
    owner = nextOwner; snapshot = null; removeSaved(); notify();
  };
  const clear = () => reset();
  const peek = scope => {
    if (!scope || (owner && owner !== scope)) return null;
    if (!owner) {
      owner = scope;
      try {
        const saved = JSON.parse(storage()?.getItem(SERVER_STATUS_STORAGE_KEY) || 'null');
        const age = now() - saved?.fetchedAt;
        if (saved?.scope === scope && Number.isFinite(saved.fetchedAt) && age >= 0 && age < SERVER_STATUS_SNAPSHOT_MS
          && saved.data && typeof saved.data === 'object' && !Array.isArray(saved.data)) {
          snapshot = { data: savedMetrics(saved.data), fetchedAt: saved.fetchedAt, source: 'saved' };
        } else removeSaved();
      } catch { removeSaved(); }
    }
    return snapshot;
  };
  const read = (scope, { force = false } = {}) => {
    if (!scope) return Promise.reject(new Error('Server status requires an authorized session.'));
    if (owner && owner !== scope) reset(scope);
    const current = peek(scope);
    if (pending) return pending.promise;
    if (!force && current?.source === 'server' && now() - current.fetchedAt < SERVER_STATUS_FRESH_MS) return Promise.resolve(current.data);
    const request = { controller: new AbortController(), generation, promise: null };
    pending = request;
    const relevant = () => owner === scope && generation === request.generation;
    request.promise = (async () => {
      try {
        const data = await fetchStatus({ signal: request.controller.signal });
        if (!relevant()) throw Object.assign(new Error('Server status request canceled.'), { name: 'AbortError' });
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid server status response.');
        snapshot = { data, fetchedAt: now(), source: 'server' };
        try { storage()?.setItem(SERVER_STATUS_STORAGE_KEY, JSON.stringify({ scope, data: savedMetrics(data), fetchedAt: snapshot.fetchedAt })); } catch { /* memory still works */ }
        notify();
        return data;
      } catch (error) {
        if (relevant() && [401, 403].includes(Number(error?.status ?? error?.response?.status))) clear();
        throw error;
      } finally { if (pending === request) pending = null; }
    })();
    request.promise.catch(() => {});
    return request.promise;
  };
  return { peek, read, clear, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } };
};
