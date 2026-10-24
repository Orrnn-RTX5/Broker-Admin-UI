import { buildMarketCatalogue } from './marketCatalogue.js';

// Session snapshots of the last successful catalogue and management payload.
// Keyed by broker so a signed-out or switched session cannot paint another
// broker's rows. The live feed is the fallback when no snapshot exists yet.
const snapshots = new Map();

const upper = (value) => String(value ?? '').trim().toUpperCase();

export const symbolViewScope = () => {
  try {
    return String(globalThis.localStorage?.getItem('brokerId') || 'anonymous').trim() || 'anonymous';
  } catch {
    return 'anonymous';
  }
};

const bucket = (scope) => snapshots.get(scope) || null;

export const peekMarketCatalogue = (scope = symbolViewScope()) => {
  const saved = bucket(scope)?.catalogue;
  return Array.isArray(saved) ? saved : null;
};

export const peekSymbolManagement = (scope = symbolViewScope()) => bucket(scope)?.management || null;

export const rememberMarketCatalogue = (catalogue, scope = symbolViewScope()) => {
  if (!Array.isArray(catalogue)) return;
  snapshots.set(scope, { ...bucket(scope), catalogue });
};

export const rememberSymbolManagement = (management, scope = symbolViewScope()) => {
  if (!management || typeof management !== 'object') return;
  snapshots.set(scope, { ...bucket(scope), management });
};

export const clearSymbolViewSnapshots = () => {
  snapshots.clear();
};

const persistedMetadata = () => {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    const raw = storage.getItem(`rtx-symbols-storage:${encodeURIComponent(symbolViewScope())}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const state = parsed?.state && typeof parsed.state === 'object' ? parsed.state : parsed;
    if (!Array.isArray(state?.symbolMetadata) || state.symbolMetadata.length === 0) return null;
    return { symbolMetadata: state.symbolMetadata };
  } catch {
    return null;
  }
};

/** Prefer the in-memory feed. A hard reload reads the persisted symbol list synchronously. */
export const resolveDynamicSymbolState = (liveState) => {
  const live = liveState && typeof liveState === 'object' ? liveState : {};
  const hasNames = Array.isArray(live.feedSymbolNames)
    || (Array.isArray(live.symbolMetadata) && live.symbolMetadata.length > 0)
    || (live.symbols && typeof live.symbols === 'object' && Object.keys(live.symbols).length > 0);
  return hasNames ? live : (persistedMetadata() || live);
};

/**
 * Category rows from symbols the feed is already streaming. No network call.
 * An empty feed inventory is authoritative and is not replaced by older metadata.
 */
export const catalogueFromDynamic = (liveState) => {
  const state = resolveDynamicSymbolState(liveState);
  const knownCategory = new Map();
  for (const entry of Array.isArray(state.symbolMetadata) ? state.symbolMetadata : []) {
    const symbol = upper(entry?.symbol);
    if (symbol) knownCategory.set(symbol, entry.category || '');
  }
  for (const entry of Object.values(state.symbols || {})) {
    const symbol = upper(entry?.symbol);
    if (symbol && !knownCategory.has(symbol)) knownCategory.set(symbol, entry.category || '');
  }

  const streamed = Array.isArray(state.feedSymbolNames) ? state.feedSymbolNames : null;
  const source = streamed
    ? streamed.map((symbol) => ({ symbol, category: knownCategory.get(upper(symbol)) || '' }))
    : [...knownCategory.entries()].map(([symbol, category]) => ({ symbol, category }));
  return buildMarketCatalogue(source, []);
};

export const initialMarketBrowserState = (liveState, scope = symbolViewScope()) => {
  const saved = peekMarketCatalogue(scope);
  if (saved) return { catalogue: saved, loading: false, syncing: true };
  const catalogue = catalogueFromDynamic(liveState);
  return { catalogue, loading: catalogue.length === 0, syncing: catalogue.length > 0 };
};

const dynamicManagement = (catalogue) => ({
  symbols: [],
  categories: [...new Set(catalogue.map((row) => row.category).filter(Boolean))].map((name) => ({ name })),
  lpEntries: catalogue.map((row) => ({
    symbol: row.symbol,
    configured: false,
    instrument: null,
    category: row.category,
    fromLp: true,
    detailsPending: true,
  })),
  loading: false,
  syncing: true,
  fromDynamic: true,
});

export const initialSymbolManagementState = (liveState, scope = symbolViewScope()) => {
  const saved = peekSymbolManagement(scope);
  if (saved && (saved.symbols?.length || saved.lpEntries?.length)) {
    return {
      symbols: saved.symbols || [],
      categories: saved.categories || [],
      lpEntries: saved.lpEntries || [],
      loading: false,
      syncing: true,
      fromDynamic: false,
    };
  }
  const catalogue = catalogueFromDynamic(liveState);
  if (catalogue.length === 0) {
    return { symbols: [], categories: [], lpEntries: [], loading: true, syncing: false, fromDynamic: false };
  }
  return dynamicManagement(catalogue);
};
