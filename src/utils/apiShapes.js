const DEFAULT_ARRAY_KEYS = [
  'data',
  'answer',
  'items',
  'results',
  'rows',
  'users',
  'accounts',
  'instruments',
  'symbols',
  'deposits',
  'withdrawals',
  'requests',
];

const DEFAULT_TOTAL_PATHS = [
  ['total'],
  ['totalCount'],
  ['total_count'],
  ['count'],
  ['recordsTotal'],
  ['records_total'],
  ['filteredTotal'],
  ['filtered_total'],
  ['meta', 'total'],
  ['meta', 'totalCount'],
  ['meta', 'count'],
  ['pagination', 'total'],
  ['pagination', 'totalCount'],
  ['pagination', 'count'],
];

export const normalizeArrayResponse = (response, keys = DEFAULT_ARRAY_KEYS) => {
  if (Array.isArray(response)) return response;
  if (!response || typeof response !== 'object') return [];

  for (const key of keys) {
    const value = response[key];
    if (Array.isArray(value)) return value;
  }

  return [];
};

const toPositiveInteger = (value, fallback) => {
  const next = Number(value);
  return Number.isInteger(next) && next > 0 ? next : fallback;
};

const readNestedValue = (source, path) => {
  let current = source;

  for (const key of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[key];
  }

  return current;
};

const readTotal = (response, totalPaths) => {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return undefined;
  }

  for (const path of totalPaths) {
    const value = readNestedValue(response, path);
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 0) return numeric;
  }

  return undefined;
};

export const normalizePagedResponse = (
  response,
  {
    arrayKeys = DEFAULT_ARRAY_KEYS,
    totalPaths = DEFAULT_TOTAL_PATHS,
    page = 1,
    limit = 100,
    filterFn,
  } = {}
) => {
  const safePage = toPositiveInteger(page, 1);
  const safeLimit = toPositiveInteger(limit, 100);
  const startIndex = (safePage - 1) * safeLimit;
  const rawRows = normalizeArrayResponse(response, arrayKeys);
  const filteredRows = typeof filterFn === 'function'
    ? rawRows.filter(filterFn)
    : rawRows;
  const metadataTotal = readTotal(response, totalPaths);
  const hasMetadataTotal = Number.isFinite(metadataTotal);
  const clientPaged = filteredRows.length > safeLimit;
  const rows = clientPaged
    ? filteredRows.slice(startIndex, startIndex + safeLimit)
    : filteredRows;
  const total = hasMetadataTotal
    ? metadataTotal
    : (clientPaged ? filteredRows.length : undefined);
  const hasKnownTotal = Number.isFinite(total);
  const pageStart = rows.length ? startIndex + 1 : 0;
  const pageEnd = rows.length ? startIndex + rows.length : 0;
  const totalPages = hasKnownTotal ? Math.max(1, Math.ceil(total / safeLimit)) : undefined;

  return {
    rows,
    total,
    hasKnownTotal,
    page: safePage,
    limit: safeLimit,
    pageStart,
    pageEnd,
    totalPages,
    hasNextPage: hasKnownTotal ? safePage < totalPages : rows.length >= safeLimit,
    clientPaged,
  };
};

export const getApiErrorMessage = (error, fallback = 'Request failed') => {
  const data = error?.response?.data;
  if (typeof data === 'string' && data.trim()) return data.trim();
  if (data?.message) return data.message;
  if (data?.error?.message) return data.error.message;
  if (data?.error) return String(data.error);
  if (data?.code) return String(data.code);
  if (error?.message) return error.message;
  return fallback;
};
