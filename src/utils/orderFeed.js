import { createOrderPageLoader } from './orderPageLoader.js';

export const normalizeOrderQuery = (params = {}) => ({
  limit: Number(params.limit ?? 100), offset: Number(params.offset ?? 0),
  search: String(params.search ?? ''), symbol: String(params.symbol ?? ''),
  from: String(params.from ?? ''), to: String(params.to ?? ''), openOnly: Boolean(params.openOnly),
  logins: [...(params.logins ?? [])].map(String).sort(),
});
const defaultPage = query => query.limit === 100 && query.offset === 0 && !query.search
  && !query.symbol && !query.from && !query.to && !query.openOnly && !query.logins.length;
const empty = Object.freeze({ data: null, loading: false, error: null });

/** Shared pages keep the previous successful display while fresh requests run. */
export const createOrderFeed = ({ fetchPage, fetchLogins, snapshot, isCurrent, now = Date.now, ttl = 2000 }) => {
  const entries = new Map();
  const listeners = new Set();
  const notify = () => listeners.forEach(listener => listener());
  const entryFor = (identity, params) => {
    const query = normalizeOrderQuery(params);
    const key = JSON.stringify([identity, query]);
    let entry = entries.get(key);
    if (!entry) {
      const data = defaultPage(query) ? snapshot.read(identity) : null;
      entry = { identity, key, query, state: { data, loading: data === null, error: null },
        pending: null, controller: null, completedAt: null };
      entries.set(key, entry);
      // Retain a small number of visited pages; never evict an active request.
      if (entries.size > 12) {
        const oldest = [...entries.values()].find(value => value !== entry && !value.pending);
        if (oldest) entries.delete(oldest.key);
      }
    }
    return entry;
  };
  const peek = (identity, params) => identity && isCurrent(identity) ? entryFor(identity, params).state : empty;
  const clear = identity => {
    for (const entry of entries.values()) {
      if (identity && entry.identity !== identity) continue;
      entry.controller?.abort();
      entries.delete(entry.key);
    }
    if (identity) snapshot.clear(identity);
    notify();
  };
  const read = (identity, params, { matches = () => true, force = false } = {}) => {
    if (!identity || !isCurrent(identity)) return Promise.resolve(null);
    const entry = entryFor(identity, params);
    if (entry.pending) return entry.pending;
    if (!force && entry.completedAt !== null && now() - entry.completedAt < ttl) return Promise.resolve(entry.state.data);
    const current = () => isCurrent(identity) && entries.get(entry.key) === entry;
    const patch = changes => { entry.state = { ...entry.state, ...changes }; notify(); };
    const controller = new AbortController();
    entry.controller = controller;
    // Warm refreshes do not touch the display or set its loading state.
    if (entry.state.data === null && !entry.state.loading) patch({ loading: true });
    const task = Promise.resolve().then(() => {
      if (!current()) return null;
      if (entry.query.logins.length) return fetchLogins(entry.query.logins, controller.signal);
      const { logins: _logins, ...query } = entry.query;
      // Every revalidation starts with fresh scan pages, including deletions.
      const loader = createOrderPageLoader((page, signal) => fetchPage(page, signal));
      return loader.load(query, matches, controller.signal);
    }).then(data => {
      if (!current() || controller.signal.aborted) return null;
      const same = JSON.stringify(data) === JSON.stringify(entry.state.data);
      entry.completedAt = now();
      if (!same || entry.state.loading || entry.state.error) patch({ data: same ? entry.state.data : data, loading: false, error: null });
      if (defaultPage(entry.query)) snapshot.write(identity, data);
      return data;
    }).catch(error => {
      if (!current() || controller.signal.aborted) return null;
      if ([401, 403].includes(error?.response?.status ?? error?.status)) {
        clear(identity);
        const refused = entryFor(identity, params);
        refused.state = { data: null, loading: false, error };
        notify();
      } else {
        // Temporary failures retain rows; the table can still report the error.
        patch({ loading: false, error });
      }
      return null;
    }).finally(() => { if (entry.pending === task) entry.pending = null; });
    entry.pending = task;
    return task;
  };
  return { peek, read, clear, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } };
};
