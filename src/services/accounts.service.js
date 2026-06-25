import { api } from '../lib/api.js';
import { normalizeArrayResponse } from '../utils/apiShapes.js';

const ACCOUNT_ARRAY_KEYS = ['accounts', 'data', 'answer', 'items', 'rows'];
const ACCOUNT_TOTAL_PATHS = [
  ['total'],
  ['totalCount'],
  ['total_count'],
  ['count'],
  ['recordsTotal'],
  ['records_total'],
  ['meta', 'total'],
  ['meta', 'totalCount'],
  ['pagination', 'total'],
  ['pagination', 'totalCount'],
];
const DEFAULT_ACCOUNT_LIMIT = 100;
const LEGACY_ACCOUNT_CACHE_TTL_MS = 2 * 60 * 1000;

let legacyAccountsCache = null;
let legacyAccountsProbePromise = null;
const pendingAccountRequests = new Map();

const cleanParams = (params = {}) => Object.fromEntries(
  Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
);

const toPositiveInteger = (value, fallback) => {
  const next = Number(value);
  return Number.isInteger(next) && next > 0 ? next : fallback;
};

const buildAccountParams = (params = {}) => {
  const page = toPositiveInteger(params.page, 1);
  const limit = toPositiveInteger(params.limit, DEFAULT_ACCOUNT_LIMIT);
  const offset = (page - 1) * limit;

  return cleanParams({
    ...params,
    page,
    limit,
    offset,
  });
};

const readNestedValue = (source, path) => {
  let current = source;

  for (const key of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[key];
  }

  return current;
};

const readTotal = (response) => {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return undefined;

  for (const path of ACCOUNT_TOTAL_PATHS) {
    const value = readNestedValue(response, path);
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 0) return numeric;
  }

  return undefined;
};

const getArrayKey = (response) => {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return 'data';

  for (const key of ACCOUNT_ARRAY_KEYS) {
    if (Array.isArray(response[key])) return key;
  }

  return 'data';
};

const createResponseTemplate = (response, arrayKey) => {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return {};
  const { [arrayKey]: _rows, ...template } = response;
  return template;
};

const normalizeText = (value) => String(value ?? '').trim().toLowerCase();

const getField = (row, keys) => {
  if (!row || typeof row !== 'object') return undefined;

  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }

  return undefined;
};

const accountMatchesFilter = (row, params) => {
  const search = normalizeText(params.search);
  const group = normalizeText(params.group);
  const status = normalizeText(params.status);

  if (search) {
    const haystack = Object.values(row || {})
      .filter((value) => value !== null && typeof value !== 'object')
      .join(' ')
      .toLowerCase();

    if (!haystack.includes(search)) return false;
  }

  if (group) {
    const rowGroup = normalizeText(getField(row, ['group', 'Group', 'group_name', 'groupName', 'account_group', 'accountGroup']));
    if (!rowGroup.includes(group)) return false;
  }

  if (status) {
    const rawStatus = getField(row, ['status', 'Status']);
    const rowStatus = normalizeText(
      rawStatus ?? (row?.enabled === false || row?.Enabled === false ? 'disabled' : 'active')
    );
    if (rowStatus !== status && !rowStatus.includes(status)) return false;
  }

  return true;
};

const buildPagedAccountResponse = ({ template, arrayKey, rows, total, params }) => {
  const page = toPositiveInteger(params.page, 1);
  const limit = toPositiveInteger(params.limit, DEFAULT_ACCOUNT_LIMIT);
  const offset = (page - 1) * limit;
  const hasLocalFilter = Boolean(params.search || params.group || params.status);
  const filteredRows = hasLocalFilter
    ? rows.filter((row) => accountMatchesFilter(row, params))
    : rows;
  const effectiveTotal = hasLocalFilter ? filteredRows.length : (Number.isFinite(total) ? total : filteredRows.length);
  const pageRows = filteredRows.slice(offset, offset + limit);
  const pagination = template?.pagination && typeof template.pagination === 'object'
    ? template.pagination
    : {};

  return {
    ...template,
    [arrayKey]: pageRows,
    total: effectiveTotal,
    totalCount: effectiveTotal,
    page,
    limit,
    offset,
    pagination: {
      ...pagination,
      total: effectiveTotal,
      page,
      limit,
      offset,
    },
  };
};

const getCachedAccountResponse = (params) => {
  if (!legacyAccountsCache) return null;

  if (Date.now() - legacyAccountsCache.cachedAt > LEGACY_ACCOUNT_CACHE_TTL_MS) {
    legacyAccountsCache = null;
    return null;
  }

  return buildPagedAccountResponse({
    template: legacyAccountsCache.template,
    arrayKey: legacyAccountsCache.arrayKey,
    rows: legacyAccountsCache.rows,
    total: legacyAccountsCache.total,
    params,
  });
};

const cacheLegacyAccountResponse = (response, rows) => {
  const arrayKey = getArrayKey(response);
  const metadataTotal = readTotal(response);

  legacyAccountsCache = {
    arrayKey,
    template: createResponseTemplate(response, arrayKey),
    rows,
    total: Number.isFinite(metadataTotal) ? metadataTotal : rows.length,
    cachedAt: Date.now(),
  };
};

const shouldShareLegacyProbe = (params) => !params.search && !params.group && !params.status;

const normalizeAccountResponse = (response, params) => {
  const rows = normalizeArrayResponse(response, ACCOUNT_ARRAY_KEYS);
  const limit = toPositiveInteger(params.limit, DEFAULT_ACCOUNT_LIMIT);

  if (rows.length > limit) {
    if (shouldShareLegacyProbe(params)) {
      cacheLegacyAccountResponse(response, rows);
      return getCachedAccountResponse(params);
    }

    const arrayKey = getArrayKey(response);
    return buildPagedAccountResponse({
      template: createResponseTemplate(response, arrayKey),
      arrayKey,
      rows,
      total: readTotal(response),
      params,
    });
  }

  return response;
};

export const AccountsService = {
  getAccount: async (login) => {
    const res = await api.get(`/api/v2/account/${login}`);
    return res.data;
  },

  getAccounts: async (params = {}) => {
    const accountParams = buildAccountParams(params);
    const cachedResponse = getCachedAccountResponse(accountParams);
    if (cachedResponse) return cachedResponse;

    if (shouldShareLegacyProbe(accountParams) && legacyAccountsProbePromise) {
      await legacyAccountsProbePromise.catch(() => null);
      const nextCachedResponse = getCachedAccountResponse(accountParams);
      if (nextCachedResponse) return nextCachedResponse;
    }

    const requestKey = JSON.stringify(accountParams);
    if (pendingAccountRequests.has(requestKey)) {
      return pendingAccountRequests.get(requestKey);
    }

    const requestPromise = api.get('/manager/AccountDetailsMany', {
      params: accountParams,
      _allowAuthFailure: true,
    }).then((res) => normalizeAccountResponse(res.data, accountParams));

    const trackedPromise = requestPromise.finally(() => {
      pendingAccountRequests.delete(requestKey);
    });

    pendingAccountRequests.set(requestKey, trackedPromise);

    if (shouldShareLegacyProbe(accountParams) && !legacyAccountsProbePromise) {
      legacyAccountsProbePromise = trackedPromise.finally(() => {
        legacyAccountsProbePromise = null;
      });
    }

    return trackedPromise;
  },

  deposit: async (login, amount, comment) => {
    const res = await api.post(`/api/v2/accounts/${login}/deposit`, { amount, comment });
    return res.data;
  },

  withdraw: async (login, amount, comment) => {
    const res = await api.post(`/api/v2/accounts/${login}/withdraw`, { amount, comment });
    return res.data;
  },

  credit: async (login, amount, comment, expiration) => {
    const res = await api.post(`/api/v2/accounts/${login}/credit`, { amount, comment, expiration });
    return res.data;
  },

  suspend: async (login, reason) => {
    const res = await api.post(`/api/v2/accounts/${login}/suspend`, { reason });
    return res.data;
  },

  activate: async (login, reason) => {
    const res = await api.post(`/api/v2/accounts/${login}/activate`, { reason });
    return res.data;
  },

  setReadonly: async (login, readonly, reason) => {
    const res = await api.post(`/api/v2/accounts/${login}/readonly`, { readonly, reason });
    return res.data;
  }
};
