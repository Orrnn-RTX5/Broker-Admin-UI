import { normalizeAllocationGroups } from './allocations.js';

const denied = error => [401, 403].includes(error?.response?.status);
const message = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

/** One request handoff for startup and the table, with progressive columns and counts. */
export const createAllocationLoader = ({ fetchGroups, fetchCounts, readInitial, save, clearSaved,
  isCurrent = () => true, now = Date.now, ttlMs = 60_000 }) => {
  const entries = new Map();
  const listeners = new Set();
  const entryFor = identity => {
    if (!entries.has(identity)) entries.set(identity, {
      state: { ...readInitial(identity), countsError: '' }, generation: 0, pending: null, completedAt: 0,
    });
    return entries.get(identity);
  };
  const notify = () => listeners.forEach(listener => listener());
  const peek = identity => entryFor(identity).state;
  const read = (identity, { force = false } = {}) => {
    if (!identity || !isCurrent(identity)) return Promise.resolve(null);
    const entry = entryFor(identity);
    if (!force && entry.pending) return entry.pending;
    if (!force && entry.completedAt && now() - entry.completedAt < ttlMs) return Promise.resolve(entry.state);
    const generation = ++entry.generation;
    const relevant = () => entries.get(identity) === entry && generation === entry.generation && isCurrent(identity);
    const patch = change => {
      if (!relevant()) return;
      entry.state = { ...entry.state, ...change };
      notify();
    };
    patch({ loading: entry.state.loading && !entry.state.rows.length, syncing: true, error: '', countsError: '' });
    let records = null, counts = null, countsReady = false, groupsFailed = false;
    const publish = () => {
      if (!relevant() || !records || groupsFailed) return;
      const previous = new Map(entry.state.rows.map(row => [row.name.toLowerCase(), row.accounts]));
      const rows = normalizeAllocationGroups(records, counts);
      // A newly created group has an unknown count until the full census answers.
      if (!counts) rows.forEach(row => { row.accounts = previous.get(row.name.toLowerCase()) ?? null; });
      const accountsKnown = rows.every(row => Number.isFinite(row.accounts));
      const at = now();
      patch({ rows, accountsKnown, updatedAt: at, loading: false });
      save({ identity, rows, accountsKnown, at });
    };
    // Both requests start together. Neither waits for the other to leave the browser.
    const groupsRequest = Promise.resolve().then(() => fetchGroups(identity, { force })).then(groups => {
      if (!relevant()) return;
      records = groups.map(group => group?.group && typeof group.group === 'object' ? group.group : { name: group.groupName });
      publish();
    }).catch(error => {
      if (!relevant()) return;
      groupsFailed = true;
      if (denied(error)) {
        clearSaved(identity);
        patch({ rows: [], accountsKnown: false, updatedAt: null });
      }
      patch({ loading: false, error: message(error, 'Account groups could not be loaded.') });
    });
    const countsRequest = Promise.resolve().then(() => fetchCounts(identity, { force })).then(value => {
      if (!relevant()) return;
      counts = value;
      countsReady = true;
      if (records) publish();
    }).catch(error => {
      if (!relevant()) return;
      countsReady = true;
      if (denied(error)) {
        // Account permission can be refused independently of group permission.
        patch({ rows: entry.state.rows.map(row => ({ ...row, accounts: null })), accountsKnown: false });
        clearSaved(identity);
      }
      patch({ countsError: message(error, 'Account totals could not be refreshed.') });
    });
    const task = Promise.all([groupsRequest, countsRequest]).then(() => {
      if (!relevant()) return null;
      patch({ syncing: false, loading: false });
      if (!groupsFailed && countsReady && !entry.state.countsError) entry.completedAt = now();
      // Save count-denial/unknown outcomes too, so a reload cannot resurrect old totals.
      if (!groupsFailed) save({ identity, rows: entry.state.rows, accountsKnown: entry.state.accountsKnown, at: entry.state.updatedAt });
      return entry.state;
    }).finally(() => { if (entry.pending === task) entry.pending = null; });
    entry.pending = task;
    return task;
  };
  const clear = identity => {
    if (identity) { entries.delete(identity); clearSaved(identity); }
    else { for (const owner of entries.keys()) clearSaved(owner); entries.clear(); }
    notify();
  };
  return { peek, read, clear, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } };
};
