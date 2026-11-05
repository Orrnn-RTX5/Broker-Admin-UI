import { api } from '../lib/api.js';
import { normalizeArrayResponse } from '../utils/apiShapes.js';
import { loadGroupTreePages } from '../utils/groupTreeData.js';
import { useAuthStore } from '../store/authStore.js';
import { groupAccessKey } from '../utils/groupAccess.js';
import { createCacheIdentity } from '../utils/cacheIdentity.js';
import { createAccountDirectorySnapshot } from '../utils/accountDirectorySnapshot.js';

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
const ALL_ACCOUNTS_TTL_MS = 60 * 1000;
const ACCOUNT_PAGE_CACHE_TTL_MS = 60 * 1000;
const MAX_CACHED_ACCOUNT_PAGES = 64;

let legacyAccountsCache = null;
let legacyAccountsProbePromise = null;
let accountCacheGeneration = 0;
let allAccountsLoad = null;
const pendingAccountRequests = new Map();
const accountPages = new Map();
const directorySnapshots = createAccountDirectorySnapshot();
const directoryIdentity = () => createCacheIdentity(useAuthStore.getState());
const isDirectoryFirstPage = params => params.page === 1 && params.limit === 100 && !params.search && !params.group && !params.status;

export const getAccountCacheIdentity = (state = useAuthStore.getState()) => {
  const identity = createCacheIdentity(state);
  return JSON.stringify([
    state.isAuthenticated, Boolean(state.accessToken), identity ?? groupAccessKey(state.user),
    // Older sessions without a broker/login still need their access scope checked.
    ...(identity ? [] : [state.user?.role, state.user?.is_admin, state.user?.permissions]),
  ]);
};

const invalidateAccountsCache = ({ keepDisplaySnapshot = false } = {}) => {
  if (!keepDisplaySnapshot) directorySnapshots.clear(directoryIdentity());
  accountCacheGeneration += 1;
  legacyAccountsCache = null;
  legacyAccountsProbePromise = null;
  allAccountsLoad = null;
  pendingAccountRequests.clear();
  accountPages.clear();
};

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
    metricsNullable: '1',
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

const getCachedAccountResponse = (params, { allowStale = false } = {}) => {
  if (!legacyAccountsCache) return null;

  if (!allowStale && Date.now() - legacyAccountsCache.cachedAt > LEGACY_ACCOUNT_CACHE_TTL_MS) {
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

const normalizeAccountResponse = (response, params, requestGeneration) => {
  const rows = normalizeArrayResponse(response, ACCOUNT_ARRAY_KEYS);
  const limit = toPositiveInteger(params.limit, DEFAULT_ACCOUNT_LIMIT);

  if (rows.length > limit) {
    if (shouldShareLegacyProbe(params) && requestGeneration === accountCacheGeneration) {
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

const rememberAccountPage = (params, response, cachedAt = Date.now()) => {
  const key = JSON.stringify(params);
  accountPages.delete(key);
  accountPages.set(key, { response, cachedAt, firstPage: params.page === 1 && shouldShareLegacyProbe(params) });
  if (isDirectoryFirstPage(params)) directorySnapshots.write(directoryIdentity(), response, cachedAt);
  if (accountPages.size > MAX_CACHED_ACCOUNT_PAGES) {
    const evictionKey = [...accountPages].find(([, entry]) => !entry.firstPage)?.[0]
      ?? accountPages.keys().next().value;
    accountPages.delete(evictionKey);
  }
  return response;
};

// Keep account details in memory for this authenticated access scope. The
// first render can use these rows while an expired page refreshes on the wire.
const peekAccounts = (params = {}, { allowStale = false } = {}) => {
  const accountParams = buildAccountParams(params);
  const cached = accountPages.get(JSON.stringify(accountParams));
  if (cached && (allowStale || Date.now() - cached.cachedAt < ACCOUNT_PAGE_CACHE_TTL_MS)) {
    return cached.response;
  }
  const legacy = getCachedAccountResponse(accountParams, { allowStale });
  return legacy ? rememberAccountPage(accountParams, legacy, legacyAccountsCache.cachedAt)
    : allowStale && isDirectoryFirstPage(accountParams) ? directorySnapshots.read(directoryIdentity()) : null;
};

export const AccountsService = {
  invalidateCache: invalidateAccountsCache,
  peekAccounts,

  getAccount: async (login) => {
    const res = await api.get(`/api/v2/account/${login}`);
    return res.data;
  },

  updateAccount: async (login, data) => {
    const res = await api.put(`/api/v2/accounts/${login}`, data);
    invalidateAccountsCache();
    return res.data;
  },

  getAccounts: async (params = {}) => {
    const accountParams = buildAccountParams(params);
    const cachedResponse = peekAccounts(accountParams);
    if (cachedResponse) return cachedResponse;

    const requestKey = JSON.stringify(accountParams);
    // The workspace census and Clients commonly request the same first page.
    // Join that request before waiting on a legacy full-list probe; waiting
    // first would discard a paginated result and fetch the page a second time.
    if (pendingAccountRequests.has(requestKey)) {
      return pendingAccountRequests.get(requestKey);
    }

    if (shouldShareLegacyProbe(accountParams) && legacyAccountsProbePromise) {
      await legacyAccountsProbePromise.catch(() => null);
      const nextCachedResponse = peekAccounts(accountParams);
      if (nextCachedResponse) return nextCachedResponse;
    }

    if (pendingAccountRequests.has(requestKey)) {
      return pendingAccountRequests.get(requestKey);
    }

    const requestGeneration = accountCacheGeneration;
    const requestIdentity = directoryIdentity();
    const requestPromise = api.get('/manager/AccountDetailsMany', {
      params: accountParams,
      _allowAuthFailure: true,
    }).then((res) => {
      const response = normalizeAccountResponse(res.data, accountParams, requestGeneration);
      if (requestGeneration === accountCacheGeneration) rememberAccountPage(accountParams, response);
      return response;
    }).catch(error => {
      if ([401, 403, 419].includes(Number(error?.response?.status))) {
        directorySnapshots.clear(requestIdentity);
        if (requestGeneration === accountCacheGeneration) invalidateAccountsCache();
      }
      throw error;
    });

    const trackedPromise = requestPromise.finally(() => {
      if (pendingAccountRequests.get(requestKey) === trackedPromise) {
        pendingAccountRequests.delete(requestKey);
      }
    });

    pendingAccountRequests.set(requestKey, trackedPromise);

    if (shouldShareLegacyProbe(accountParams) && !legacyAccountsProbePromise) {
      const probePromise = trackedPromise.finally(() => {
        if (legacyAccountsProbePromise === probePromise) legacyAccountsProbePromise = null;
      });
      legacyAccountsProbePromise = probePromise;
      probePromise.catch(() => {});
    }

    return trackedPromise;
  },

  // Every account on the server, all pages. Group screens filter this one list
  // themselves: the server's group filter is not reliable for every broker
  // (e.g. group names that differ only in letter case).
  getAllAccounts: () => {
    if (allAccountsLoad && Date.now() - allAccountsLoad.startedAt < ALL_ACCOUNTS_TTL_MS) return allAccountsLoad.promise;
    const generation = accountCacheGeneration;
    const fetchPage = async params => {
      if (generation !== accountCacheGeneration) throw new Error('Account access changed while loading.');
      const response = await AccountsService.getAccounts(params);
      if (generation !== accountCacheGeneration) throw new Error('Account access changed while loading.');
      return response;
    };
    const load = {
      startedAt: Date.now(),
      promise: loadGroupTreePages(fetchPage, { arrayKeys: ACCOUNT_ARRAY_KEYS }),
    };
    load.promise.catch(() => {
      if (allAccountsLoad === load) allAccountsLoad = null;
    });
    allAccountsLoad = load;
    return load.promise;
  },

  // DEPRECATED (R15/R17 G23): deposit/withdraw/credit below hit the legacy
  // Gateway routes without an idempotency key and have no UI caller. Admin
  // funding goes through the ledger request workflow: FundingPopup ->
  // AdminConfigApi.requestFunding -> Deposits / Withdrawals approval.
  // Do not add new callers.
  /** @deprecated Use AdminConfigApi.requestFunding('deposit', ...). */
  deposit: async (login, amount, comment) => {
    const res = await api.post(`/api/v2/accounts/${login}/deposit`, { amount, comment });
    return res.data;
  },

  /** @deprecated Use AdminConfigApi.requestFunding('withdrawal', ...). */
  withdraw: async (login, amount, comment) => {
    const res = await api.post(`/api/v2/accounts/${login}/withdraw`, { amount, comment });
    return res.data;
  },

  /** @deprecated Credit is not an Admin ledger operation here; see G23. */
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

useAuthStore.subscribe((state, previous) => {
  if (getAccountCacheIdentity(state) !== getAccountCacheIdentity(previous)) {
    directorySnapshots.clear(createCacheIdentity(previous));
    invalidateAccountsCache();
  }
});
