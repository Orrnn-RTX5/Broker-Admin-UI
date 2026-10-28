import { api } from '../lib/api';
import { buildInstrumentToggleRequest } from '../utils/serviceContracts';
import { normalizeArrayResponse } from '../utils/apiShapes';
import { getRuntimeValue } from '../config/runtimeConfig';

const viteEnv = import.meta.env || {};
const MANAGER_SYMBOL_NAMES_CACHE_TTL_MS = 30000;
const MANAGER_SYMBOL_PARAMS_TIMEOUT_MS = 7000;

let managerSymbolNamesCache = null;
let managerSymbolNamesPromise = null;

const getInstrumentsListMode = () =>
  String(
    getRuntimeValue('INSTRUMENTS_LIST_MODE', 'VITE_INSTRUMENTS_LIST_MODE') ||
      viteEnv.VITE_INSTRUMENTS_LIST_MODE ||
      'manager'
  )
    .trim()
    .toLowerCase();

const shouldUseAdminInstrumentsList = () =>
  ['admin', 'admin-api', 'api-v2'].includes(getInstrumentsListMode());

const cleanParams = (params = {}) => Object.fromEntries(
  Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
);

const isNotFoundError = (error) => (
  error?.response?.status === 404 ||
  /\b404\b|not found/i.test(String(error?.response?.data || error?.message || ''))
);

const firstDefined = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== '') ?? undefined;

const pickSymbolName = (symbol) => {
  if (typeof symbol === 'string') return symbol;
  return symbol?.symbol || symbol?.Symbol || symbol?.name || symbol?.Name || symbol?.symbol_name || symbol?.SymbolName || '';
};

const toNumber = (value, fallback = '') => {
  if (value === undefined || value === null || value === '') return fallback;
  const next = Number(value);
  return Number.isFinite(next) ? next : value;
};

const normalizeEnabled = (value) => {
  if (value === undefined || value === null || value === '') return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const normalized = String(value).trim().toLowerCase();
  if (['false', '0', 'disabled', 'disable', 'off'].includes(normalized)) return false;
  if (['true', '1', 'enabled', 'enable', 'on'].includes(normalized)) return true;
  return value;
};

const normalizeEnabledValue = (source) => {
  const enabled = normalizeEnabled(firstDefined(
    source.enabled,
    source.Enabled,
    source.enable,
    source.Enable,
    source.is_enabled,
    source.IsEnabled,
    source.visible,
    source.Visible
  ));

  if (typeof enabled === 'boolean') return enabled;
  if (enabled === undefined || enabled === null) return true;
  return Boolean(enabled);
};

const normalizeSymbolType = (source) => {
  const explicitType = firstDefined(source.symbolType, source.SymbolType, source.symbol_type);
  if (explicitType) return String(explicitType).trim().toLowerCase();

  const parentSymbol = firstDefined(source.parentSymbol, source.ParentSymbol, source.parent_symbol, source.parent);
  return parentSymbol ? 'derived' : 'base';
};

const normalizeSymbolRow = (symbol, fallbackName = '') => {
  const name = pickSymbolName(symbol) || fallbackName;
  const source = typeof symbol === 'object' && symbol !== null ? symbol : {};
  const category = firstDefined(source.category, source.Category, source.path, source.Path);
  const parentSymbol = firstDefined(source.parentSymbol, source.ParentSymbol, source.parent_symbol, source.parent);
  const rawStopsLevel = firstDefined(source.stops_level_points, source.stopsLevelPoints, source.stops_level, source.stopsLevel);
  const stopsLevelPoints = rawStopsLevel !== undefined && rawStopsLevel !== null && rawStopsLevel !== ''
    ? Math.max(0, Math.trunc(toNumber(rawStopsLevel, 0)))
    : 0;

  return {
    ...source,
    id: source.id || source.ID || name,
    symbol: name,
    name,
    description: firstDefined(source.description, source.Description, source.path, source.Path, category) || '',
    digits: toNumber(source.digits ?? source.Digits ?? source.digits_currency ?? source.DigitsCurrency),
    category: category || '',
    contractSize: toNumber(firstDefined(source.contractSize, source.ContractSize, source.contract_size)),
    spread: toNumber(firstDefined(source.spread, source.Spread, source.spread_float, source.SpreadFloat)),
    stops_level_points: stopsLevelPoints,
    stopsLevelPoints,
    calcMode: firstDefined(source.calcMode, source.CalcMode, source.calc_mode, source.calculation_mode) || '',
    symbolType: normalizeSymbolType(source),
    parentSymbol: parentSymbol || '',
    spreadMarkupPips: toNumber(firstDefined(source.spreadMarkupPips, source.SpreadMarkupPips, source.spread_markup_pips), 0),
    type: source.trade_mode || source.TradeMode || source.type || source.Type || source.mode || source.Mode || '',
    execution: source.execution || source.Execution || source.execution_mode || source.ExecutionMode || '',
    expiration: source.expiration || source.Expiration || source.expiration_mode || source.ExpirationMode || '',
    background: source.background || source.Background || '',
    enabled: normalizeEnabledValue(source),
  };
};

const withTimeout = (promise, timeoutMs, message) => new Promise((resolve, reject) => {
  let settled = false;
  const timer = setTimeout(() => {
    settled = true;
    reject(new Error(message));
  }, timeoutMs);

  Promise.resolve(promise)
    .then((value) => {
      if (settled) return;
      clearTimeout(timer);
      resolve(value);
    })
    .catch((error) => {
      if (settled) return;
      clearTimeout(timer);
      reject(error);
    });
});

const getRows = (response) => normalizeArrayResponse(response, [
  'instruments',
  'symbols',
  'data',
  'answer',
  'items',
  'rows',
  'value',
]);

const fetchManagerSymbolNames = async () => {
  if (
    managerSymbolNamesCache &&
    Date.now() - managerSymbolNamesCache.cachedAt < MANAGER_SYMBOL_NAMES_CACHE_TTL_MS
  ) {
    return managerSymbolNamesCache.data;
  }

  if (managerSymbolNamesPromise) return managerSymbolNamesPromise;

  managerSymbolNamesPromise = (async () => {
    try {
      const res = await api.get('/manager/SymbolsList');
      return res.data;
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
      const res = await api.get('/manager/SymbolList');
      return res.data;
    }
  })()
    .then((data) => {
      managerSymbolNamesCache = {
        data,
        cachedAt: Date.now(),
      };
      return data;
    })
    .finally(() => {
      managerSymbolNamesPromise = null;
    });

  return managerSymbolNamesPromise;
};

const fetchManagerSymbolParams = async (symbols) => {
  if (!symbols.length) return [];

  try {
    const res = await withTimeout(
      api.get('/manager/SymbolsParams', {
        params: { symbols },
      }),
      MANAGER_SYMBOL_PARAMS_TIMEOUT_MS,
      'manager symbol params request timed out'
    );
    return getRows(res.data);
  } catch {
    return [];
  }
};

const getManagerInstruments = async (params = {}) => {
  const safePage = Math.max(1, Number(params.page) || 1);
  const safeLimit = Math.max(1, Number(params.limit) || 100);
  const search = String(params.search || '').trim().toLowerCase();
  const enabledFilter = params.enabled;
  const listResponse = await fetchManagerSymbolNames();
  const listRows = getRows(listResponse);
  const symbolMap = new Map();

  for (const row of listRows) {
    const name = pickSymbolName(row);
    if (name && !symbolMap.has(name)) symbolMap.set(name, row);
  }

  const searchedNames = Array.from(symbolMap.keys()).filter((name) => {
    if (!search) return true;
    const row = symbolMap.get(name);
    return (
      name.toLowerCase().includes(search) ||
      Object.values(row || {}).some((value) => String(value ?? '').toLowerCase().includes(search))
    );
  });
  const startIndex = (safePage - 1) * safeLimit;
  const pageNames = searchedNames.slice(startIndex, startIndex + safeLimit);
  const paramRows = await fetchManagerSymbolParams(pageNames);
  const paramMap = new Map();

  for (const row of paramRows) {
    const name = pickSymbolName(row);
    if (name) paramMap.set(name, row);
  }

  const rows = pageNames
    .map((name) => normalizeSymbolRow({ ...(symbolMap.get(name) || {}), ...(paramMap.get(name) || {}) }, name))
    .filter((row) => {
      if (enabledFilter === '' || enabledFilter === undefined || enabledFilter === null) return true;
      return String(Boolean(row.enabled)) === String(enabledFilter);
    });

  return {
    data: rows,
    total: searchedNames.length,
    page: safePage,
    limit: safeLimit,
  };
};

// Top-level flags of the last instrument-catalogue response (G2): false when the
// server could not read the relay's sender catalog or reach the bridge, so the
// list may be incomplete. null = not reported (older server) or not loaded yet.
let catalogueFlags = {catalogAvailable: null, bridgeAvailable: null};
const flagOf = value => (typeof value === 'boolean' ? value : null);
export const readCatalogueFlags = (data) => ({
  catalogAvailable: flagOf(data?.catalog_available),
  bridgeAvailable: flagOf(data?.bridge_available),
});
export const getCatalogueFlags = () => ({...catalogueFlags});

export const InstrumentsService = {
  // Management edits require complete gateway specifications, never manager fallbacks.
  getConfiguredInstruments: async (params = {}) => {
    const res = await api.get('/api/v2/admin/instruments', {params: cleanParams(params)});
    return {...res.data, instruments: getRows(res.data).map(row => normalizeSymbolRow(row))};
  },
  getInstrumentCatalogue: async () => {
    catalogueFlags = {catalogAvailable: null, bridgeAvailable: null}; // never keep flags of an earlier response
    const res = await api.get('/api/v2/admin/instrument-catalogue');
    catalogueFlags = readCatalogueFlags(res.data);
    return getRows(res.data);
  },
  // Names only: Market Watch must not fetch full parameters for every symbol.
  getMarketSymbols: async () => getRows(await fetchManagerSymbolNames())
    .map(pickSymbolName).filter(Boolean),
  getInstruments: async (params = {}) => {
    if (!shouldUseAdminInstrumentsList()) return getManagerInstruments(params);

    try {
      const res = await api.get('/api/v2/admin/instruments', {
        params: cleanParams(params),
        _expectedStatuses: [404],
      });
      return res.data;
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
      return getManagerInstruments(params);
    }
  },

  createInstrument: async (data) => {
    const res = await api.post('/api/v2/admin/instruments', data);
    return res.data;
  },

  // Bulk configure (G3): { dry_run, symbols, template, per_symbol } -> per-symbol
  // results, HTTP 200 even with partial refusals; a whole-request error is 400.
  bulkConfigureInstruments: async (body) => {
    const res = await api.post('/api/v2/admin/instruments/bulk-configure', body);
    return res.data;
  },

  updateInstrument: async (symbol, data) => {
    const res = await api.put(`/api/v2/admin/instruments/${encodeURIComponent(symbol)}`, data);
    return res.data;
  },

  toggleInstrument: async (symbol, enabled) => {
    if (typeof enabled !== 'boolean') {
      throw new Error('enabled boolean is required');
    }
    const request = buildInstrumentToggleRequest(symbol, enabled);
    const res = await api.patch(request.url, request.data);
    return res.data;
  }
};
