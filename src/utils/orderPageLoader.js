import { normalizeArrayResponse, normalizePagedResponse } from './apiShapes.js';

const keys = ['orders', 'data', 'answer', 'items', 'rows'];
const activeFilters = params => Boolean(String(params.search || '').trim() || params.symbol || params.openOnly || params.from || params.to);

/** A request-scoped scan cache handles endpoints that ignore order filters. */
export const createOrderPageLoader = (fetchPage, { now = Date.now, ttl = 5000 } = {}) => {
  const pages = new Map();
  let expiresAt = 0;
  let clientFiltering = false;
  const clear = () => { pages.clear(); expiresAt = 0; };
  const load = async (params, matches, signal) => {
    signal?.throwIfAborted();
    if (!activeFilters(params)) return fetchPage(params, signal);
    if (now() >= expiresAt) { clear(); expiresAt = now() + ttl; }

    // Metadata-bearing filtered endpoints remain the fast path. The deployed
    // array endpoint ignores filters, so its results must be scanned before paging.
    if (!clientFiltering) {
      const response = await fetchPage(params, signal);
      signal?.throwIfAborted();
      const rows = normalizeArrayResponse(response, keys);
      const paged = normalizePagedResponse(response, { arrayKeys: keys, limit: params.limit });
      if (!Array.isArray(response) && paged.hasKnownTotal && rows.every(matches)) return response;
      clientFiltering = true;
    }
    const limit = Number(params.limit) || 100;
    const offset = Number(params.offset) || 0;
    const found = [];
    const seen = new Set();
    let rawOffset = 0;
    let matchedCount = 0;
    let complete = false;
    while (found.length <= limit) {
      signal?.throwIfAborted();
      let response = pages.get(rawOffset);
      if (!response) {
        response = await fetchPage({ limit: 250, offset: rawOffset }, signal);
        signal?.throwIfAborted();
        pages.set(rawOffset, response);
        if (pages.size > 16) pages.delete(pages.keys().next().value);
      }
      const rows = normalizeArrayResponse(response, keys);
      if (!rows.length) { complete = true; break; }
      let newRows = 0;
      for (const row of rows) {
        const id = String(row.ticket ?? row.Ticket ?? row.order ?? row.Order ?? JSON.stringify(row));
        if (seen.has(id)) continue;
        seen.add(id);
        newRows += 1;
        if (!matches(row)) continue;
        if (matchedCount >= offset) found.push(row);
        matchedCount += 1;
      }
      if (!newRows) throw new Error('The order endpoint repeated a page. Refresh and try again.');
      rawOffset += rows.length;
      const paged = normalizePagedResponse(response, { arrayKeys: keys, limit: 250 });
      if (paged.hasKnownTotal && rawOffset >= paged.total) { complete = true; break; }
      // Advance by the returned count; even endpoints with a smaller page cap
      // are exhausted only by an empty page, never by a guessed history limit.
    }
    return { orders: found.slice(0, limit), ...(complete ? { total: matchedCount } : {}), hasNextPage: found.length > limit, clientFiltered: true };
  };
  return { load, clear };
};
