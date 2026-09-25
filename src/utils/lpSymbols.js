// Single "LP symbols" source for every admin symbol list and picker.
//
// The LP catalogue (/api/v2/admin/instrument-catalogue) holds every symbol the
// super admin lets this broker stream; only some of them are configured as
// instruments (/api/v2/admin/instruments) and therefore tradable. Lists show
// the union and mark each symbol with `configured`.

import { inferMarketCategory } from './marketCatalogue.js';

const symbolNameOf = (row) => {
  if (typeof row === 'string') return row.trim().toUpperCase();
  if (!row || typeof row !== 'object') return '';
  const name = row.symbol ?? row.Symbol ?? row.name ?? row.Name ?? '';
  return String(name).trim().toUpperCase();
};

/**
 * Merges the LP catalogue with the configured instruments.
 * Returns [{ symbol, configured, instrument, category, fromLp }] sorted by symbol.
 * `instrument` is the configured row (null when not configured); `fromLp` is
 * false for a configured instrument the LP catalogue does not list.
 */
export const mergeLpSymbols = (catalogue = [], configured = []) => {
  const bySymbol = new Map();
  for (const row of Array.isArray(catalogue) ? catalogue : []) {
    const symbol = symbolNameOf(row);
    if (!symbol || bySymbol.has(symbol)) continue;
    bySymbol.set(symbol, { symbol, configured: false, instrument: null, category: inferMarketCategory(symbol), fromLp: true });
  }
  for (const row of Array.isArray(configured) ? configured : []) {
    const symbol = symbolNameOf(row);
    if (!symbol) continue;
    const existing = bySymbol.get(symbol);
    bySymbol.set(symbol, {
      symbol,
      configured: true,
      instrument: row,
      category: (row && typeof row === 'object' && row.category) || existing?.category || inferMarketCategory(symbol),
      fromLp: Boolean(existing),
    });
  }
  return [...bySymbol.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
};

/** Symbol names for pickers: every LP symbol plus every configured instrument. */
export const lpSymbolNames = (entries = []) => entries.map((entry) => entry.symbol);

const CACHE_TTL_MS = 30_000;
let cache = null; // { at, promise }

/**
 * Loads and merges both sources, shared across callers for CACHE_TTL_MS.
 * `services` is injectable for tests: { getInstrumentCatalogue, getConfiguredInstruments }.
 * A failing catalogue still yields the configured instruments (and vice versa),
 * so a picker never ends up empty because one source is down.
 */
export const loadLpSymbols = async (services, { force = false, now = Date.now() } = {}) => {
  if (!force && cache && now - cache.at < CACHE_TTL_MS) return cache.promise;
  const promise = Promise.allSettled([
    services.getInstrumentCatalogue(),
    services.getConfiguredInstruments({ limit: 1000 }),
  ]).then(([catalogueResult, configuredResult]) => {
    if (catalogueResult.status === 'rejected' && configuredResult.status === 'rejected') {
      throw catalogueResult.reason;
    }
    const catalogue = catalogueResult.status === 'fulfilled' ? catalogueResult.value : [];
    const configuredValue = configuredResult.status === 'fulfilled' ? configuredResult.value : null;
    const configured = Array.isArray(configuredValue) ? configuredValue : configuredValue?.instruments || [];
    return mergeLpSymbols(catalogue, configured);
  });
  cache = { at: now, promise };
  promise.catch(() => { if (cache?.promise === promise) cache = null; });
  return promise;
};

/** Drops the shared cache, e.g. after an instrument was created or deleted. */
export const invalidateLpSymbols = () => { cache = null; };
