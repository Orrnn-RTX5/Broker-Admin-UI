// Pure helpers that turn the merged LP symbol list (utils/lpSymbols.js) into
// picker options and into rows of the Navigator "Symbols" grid.

export const NOT_CONFIGURED_LABEL = 'Not configured';

const upper = (value) => String(value ?? '').trim().toUpperCase();

/**
 * Datalist / select options for every LP symbol. Unconfigured symbols carry a
 * "not configured" label so pickers can tell them apart from instruments.
 * Returns [{ value, label, configured }].
 */
export const buildLpSymbolOptions = (entries = []) => (Array.isArray(entries) ? entries : [])
  .filter((entry) => entry && entry.symbol)
  .map((entry) => ({
    value: entry.symbol,
    label: entry.configured ? (entry.category || '') : `${NOT_CONFIGURED_LABEL.toLowerCase()}${entry.category ? ` · ${entry.category}` : ''}`,
    configured: Boolean(entry.configured),
  }));

/** Names from `names` that are not already in `existing` (case-insensitive). */
export const excludeSymbols = (names = [], existing = []) => {
  const taken = new Set((existing || []).map(upper));
  return (names || []).filter((name) => name && !taken.has(upper(name)));
};

const splitSymbolList = (value) => String(value ?? '')
  .split(',')
  .map((part) => part.trim())
  .filter(Boolean);

/**
 * Appends `symbol` to a comma-separated symbol list ("EURUSD, forex\\*") unless
 * it is already there. Keeps the existing ", " separated value format.
 */
export const appendSymbolToList = (value, symbol) => {
  const next = String(symbol ?? '').trim();
  const parts = splitSymbolList(value);
  if (!next || parts.some((part) => upper(part) === upper(next))) return parts.join(', ');
  return [...parts, next].join(', ');
};

const matchesSearch = (row, search) => {
  const query = String(search || '').trim().toLowerCase();
  if (!query) return true;
  return [row.symbol, row.description, row.execution]
    .some((value) => String(value ?? '').toLowerCase().includes(query));
};

/** Grid row for an LP symbol that has no configured instrument (empty spec cells). */
export const getUnconfiguredSymbolRow = (entry) => ({
  id: `lp:${entry.symbol}`,
  symbol: entry.symbol,
  description: entry.category || '',
  digits: '',
  type: '',
  execution: NOT_CONFIGURED_LABEL,
  expiration: '',
  background: '',
  configured: false,
  notConfigured: true,
});

/** Unconfigured LP symbols as grid rows, filtered by the grid search text. */
export const getUnconfiguredSymbolRows = (entries = [], search = '') => (Array.isArray(entries) ? entries : [])
  .filter((entry) => entry && entry.symbol && !entry.configured)
  .map(getUnconfiguredSymbolRow)
  .filter((row) => matchesSearch(row, search));

/**
 * Appends unconfigured LP symbol rows after the configured (server-paged)
 * instruments, as one continuous paged list.
 *
 * `paged` is the configured page as built by normalizePagedResponse (rows
 * already mapped); `unconfiguredRows` the full, already filtered unconfigured
 * list. Configured instruments take global positions [0, N), unconfigured ones
 * [N, N + M). When the server gives no total and this page is not the last
 * configured page, the page is returned unchanged (N is not known yet).
 */
export const mergeUnconfiguredSymbolPage = ({
  paged,
  unconfiguredRows = [],
  page = 1,
  pageSize = 100,
  fallbackConfiguredTotal,
}) => {
  const safePage = Math.max(1, Math.floor(Number(page)) || 1);
  const safeSize = Math.max(1, Math.floor(Number(pageSize)) || 100);
  const start = (safePage - 1) * safeSize;
  const configuredRows = Array.isArray(paged?.rows) ? paged.rows : [];

  let configuredTotal;
  if (paged?.hasKnownTotal && Number.isFinite(paged.total)) {
    configuredTotal = paged.total;
  } else if (configuredRows.length >= safeSize) {
    return { ...paged, rows: configuredRows };
  } else if (configuredRows.length === 0 && safePage > 1) {
    configuredTotal = Number.isFinite(fallbackConfiguredTotal) ? fallbackConfiguredTotal : start;
  } else {
    configuredTotal = start + configuredRows.length;
  }

  const onPage = new Set(configuredRows.map((row) => upper(row?.symbol)));
  const extras = (Array.isArray(unconfiguredRows) ? unconfiguredRows : [])
    .filter((row) => !onPage.has(upper(row.symbol)));
  const reachedEnd = start + configuredRows.length >= configuredTotal;
  const fill = reachedEnd ? Math.max(0, safeSize - configuredRows.length) : 0;
  const offset = Math.max(0, start - configuredTotal);
  const rows = [...configuredRows, ...extras.slice(offset, offset + fill)];

  const total = configuredTotal + extras.length;
  const totalPages = Math.max(1, Math.ceil(total / safeSize));
  return {
    ...paged,
    rows,
    total,
    hasKnownTotal: true,
    page: safePage,
    limit: safeSize,
    pageStart: rows.length ? start + 1 : 0,
    pageEnd: rows.length ? start + rows.length : 0,
    totalPages,
    hasNextPage: safePage < totalPages,
  };
};
