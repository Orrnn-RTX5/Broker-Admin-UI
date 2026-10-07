import { identitySnapshotKey } from './cacheIdentity.js';
import { normalizeArrayResponse, normalizePagedResponse } from './apiShapes.js';

const fields = new Set(`position_ticket_text ticket_text ticket Ticket positionTicket Position position id deal Deal orderTicket OrderTicket order Order login Login accountLogin account_login timeCreateFormatted timeCreate TimeCreate time Time openTime OpenTime timeFormatted timeMsc TimeMsc time_msc createdAt symbol Symbol side Side action Action type Type cmd Cmd entry Entry volume Volume lots Lots volumeExt VolumeExt priceOpen PriceOpen openPrice OpenPrice price Price priceCurrent PriceCurrent currentPrice CurrentPrice priceSl PriceSl priceSL PriceSL sl SL priceTp PriceTp priceTP PriceTP tp TP swap Swap storage Storage profit Profit commission Commission fee Fee digits Digits price_digits PriceDigits volume_digits VolumeDigits currency_digits digits_currency CurrencyDigits`.split(' '));
const scalar = value => value === null || typeof value === 'boolean'
  || (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.length <= 4096);
const rowId = row => row.position_ticket_text ?? row.ticket_text ?? row.ticket ?? row.Ticket
  ?? row.positionTicket ?? row.Position ?? row.position ?? row.deal ?? row.Deal ?? row.id;
const validRow = row => row && typeof row === 'object' && !Array.isArray(row)
  && /^[1-9]\d*$/.test(String(rowId(row)))
  && !(typeof rowId(row) === 'number' && !Number.isSafeInteger(rowId(row)))
  && Object.entries(row).every(([key, value]) => fields.has(key) && scalar(value));

/** Only the default page's display columns survive a same-tab reload. */
export const createTradeListSnapshot = ({ kind, storage = () => globalThis.sessionStorage, now = Date.now } = {}) => {
  const keys = [kind, 'data', 'answer', 'items', 'rows'];
  const prefix = `rtx5-${kind}-display:`;
  const maxAge = kind === 'positions' ? 30_000 : 5 * 60_000;
  const clear = identity => {
    const key = identitySnapshotKey(prefix, identity);
    try { if (key) storage()?.removeItem(key); } catch { /* Optional storage. */ }
  };
  return {
    clear,
    read(identity) {
      const key = identitySnapshotKey(prefix, identity);
      if (!key) return null;
      try {
        const raw = storage()?.getItem(key);
        if (!raw || raw.length > 512 * 1024) return null;
        const saved = JSON.parse(raw);
        if (saved.version !== 1 || saved.identity !== identity || !Number.isFinite(saved.at)
          || saved.at > now() || now() - saved.at >= maxAge || !Array.isArray(saved.rows)
          || saved.rows.length > 100 || !saved.rows.every(validRow)
          || new Set(saved.rows.map(row => String(rowId(row)))).size !== saved.rows.length
          || (saved.total !== null && (!Number.isSafeInteger(saved.total) || saved.total < saved.rows.length))) return null;
        return { [kind]: saved.rows, ...(saved.total !== null ? { total: saved.total } : {}) };
      } catch { return null; }
    },
    write(identity, response) {
      const key = identitySnapshotKey(prefix, identity);
      if (!key || (!Array.isArray(response) && !keys.some(name => Array.isArray(response?.[name])))) return;
      const source = normalizeArrayResponse(response, keys);
      if (source.some(row => !row || typeof row !== 'object' || Array.isArray(row))) return;
      const rows = source.map(row => Object.fromEntries(Object.entries(row).filter(([name, value]) => fields.has(name) && scalar(value))));
      // An endpoint that returns an entire directory is kept intact in memory,
      // but must not be persisted as a truncated page with guessed pagination.
      if (rows.length > 100 || !rows.every(validRow)) return;
      const page = normalizePagedResponse(response, { arrayKeys: keys, limit: 100 });
      try {
        const raw = JSON.stringify({ version: 1, identity, at: now(), rows, total: page.hasKnownTotal ? page.total : null });
        if (raw.length <= 512 * 1024) storage()?.setItem(key, raw);
      } catch { /* Storage is optional; always revalidate on the wire. */ }
    },
  };
};

const unavailable = Object.freeze({ data: null, loading: false, error: null, verified: false });

/** Startup, mounted views and reset share a bounded, authorization-scoped cache. */
export const createTradeListFeed = ({ normalizeQuery, isDefaultQuery, fetchPage, snapshot,
  isCurrent, now = Date.now, ttl = 2000 }) => {
  const entries = new Map(), listeners = new Set();
  const notify = () => listeners.forEach(listener => listener());
  const entryFor = (identity, params) => {
    const query = normalizeQuery(params), key = JSON.stringify([identity, query]);
    if (!entries.has(key)) {
      const data = isDefaultQuery(query) ? snapshot.read(identity) : null;
      entries.set(key, { key, identity, query, pending: null, controller: null, completedAt: null,
        state: { data, loading: data === null, error: null, verified: false } });
      if (entries.size > 12) {
        const oldest = [...entries.values()].find(entry => entry.key !== key && !entry.pending);
        if (oldest) entries.delete(oldest.key);
      }
    }
    return entries.get(key);
  };
  const peek = (identity, params) => identity && isCurrent(identity) ? entryFor(identity, params).state : unavailable;
  const clear = identity => {
    for (const entry of entries.values()) {
      if (entry.identity !== identity) continue;
      entry.controller?.abort(); entries.delete(entry.key);
    }
    snapshot.clear(identity); notify();
  };
  const read = (identity, params, { force = false } = {}) => {
    if (!identity || !isCurrent(identity)) return Promise.resolve(null);
    const entry = entryFor(identity, params);
    if (entry.pending) return entry.pending;
    if (!force && entry.completedAt !== null && now() - entry.completedAt < ttl) return Promise.resolve(entry.state.data);
    const current = () => isCurrent(identity) && entries.get(entry.key) === entry;
    const patch = values => { entry.state = { ...entry.state, ...values }; notify(); };
    const controller = new AbortController(); entry.controller = controller;
    const task = Promise.resolve().then(() => current() ? fetchPage(entry.query, controller.signal) : null).then(data => {
      if (!current() || controller.signal.aborted) return null;
      const same = JSON.stringify(data) === JSON.stringify(entry.state.data);
      entry.completedAt = now();
      if (!same || entry.state.loading || entry.state.error || !entry.state.verified) {
        patch({ data: same ? entry.state.data : data, loading: false, error: null, verified: true });
      }
      if (isDefaultQuery(entry.query)) snapshot.write(identity, data);
      return data;
    }).catch(error => {
      if (!current() || controller.signal.aborted) return null;
      if ([401, 403, 419].includes(Number(error?.response?.status ?? error?.status))) {
        clear(identity);
        const denied = entryFor(identity, params);
        denied.state = { data: null, loading: false, error, verified: false }; notify();
      } else patch({ loading: false, error });
      return null;
    }).finally(() => { if (entry.pending === task) entry.pending = null; });
    entry.pending = task;
    return task;
  };
  // A state notification arriving mid-request must re-read after it completes.
  const refresh = async (identity, params) => {
    if (!identity || !isCurrent(identity)) return null;
    const pending = entryFor(identity, params).pending;
    if (pending) await pending;
    return read(identity, params, { force: true });
  };
  return { peek, read, refresh, clear, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } };
};

export const normalizePositionQuery = (params = {}) => ({ page: Number(params.page ?? 1), limit: Number(params.limit ?? 100), logins: [...(params.logins ?? [])].map(String).sort() });
export const normalizeDealQuery = (params = {}) => ({ page: Number(params.page ?? 1), limit: Number(params.limit ?? 100), search: String(params.search ?? ''), login: String(params.login ?? ''), symbol: String(params.symbol ?? ''),
  ...(params.range === 'recent' ? { range: 'recent' } : { from: String(params.from ?? ''), to: String(params.to ?? '') }) });
export const recentDealRange = (now = Date.now()) => ({ from: new Date(now - 30 * 86400_000).toISOString(), to: new Date(now).toISOString() });
