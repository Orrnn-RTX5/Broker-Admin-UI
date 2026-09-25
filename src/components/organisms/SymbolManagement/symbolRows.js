// Pure helpers for the Symbol Management screens: they combine configured
// instruments with the LP symbols (utils/lpSymbols) that are not configured yet.
// Unconfigured symbols are listed so they can be configured; they are never
// tradable until an instrument with reviewed specifications exists.

const upper = (value) => String(value ?? '').trim().toUpperCase();

export const STATUS_FILTERS = [
  { value: '', label: 'All Status' },
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'configured', label: 'Configured' },
  { value: 'not_configured', label: 'Not configured' },
];

/**
 * Configured rows (unchanged, marked `configured: true`) followed by one
 * placeholder row per LP symbol without an instrument. `lpEntries` are the
 * merged entries from loadLpSymbols ({ symbol, configured, category, ... }).
 */
export const buildSymbolRows = (configuredRows = [], lpEntries = []) => {
  const configured = (Array.isArray(configuredRows) ? configuredRows : [])
    .map((row) => ({ ...row, configured: true }));
  const known = new Set(configured.map((row) => upper(row.symbol)));
  const unconfigured = [];
  for (const entry of Array.isArray(lpEntries) ? lpEntries : []) {
    const symbol = upper(entry?.symbol);
    if (!symbol || entry.configured || known.has(symbol)) continue;
    known.add(symbol);
    unconfigured.push({
      symbol,
      name: symbol,
      symbolType: '',
      parentSymbol: '',
      category: entry.category || '',
      enabled: false,
      configured: false,
    });
  }
  return [...configured, ...unconfigured];
};

/** Filters rows by search text, category, type and status (see STATUS_FILTERS). */
export const filterSymbolRows = (rows = [], { search = '', category = '', type = '', status = '' } = {}) => {
  const query = String(search).trim().toLowerCase();
  return rows.filter((row) => {
    if (query && !`${row.symbol || ''} ${row.description || ''}`.toLowerCase().includes(query)) return false;
    if (category && row.category !== category) return false;
    if (type && (!row.configured || (row.symbolType || 'base') !== type)) return false;
    if (status === 'enabled' && !(row.configured && row.enabled)) return false;
    if (status === 'disabled' && !(row.configured && !row.enabled)) return false;
    if (status === 'configured' && !row.configured) return false;
    if (status === 'not_configured' && row.configured) return false;
    return true;
  });
};

/** Category filter options: managed categories plus inferred ones of listed rows. */
export const categoryFilterOptions = (categories = [], rows = []) => {
  const names = new Set();
  for (const category of categories) {
    const name = typeof category === 'string' ? category : category?.name;
    if (name) names.add(name);
  }
  const extra = [...new Set(rows.map((row) => row.category).filter((name) => name && !names.has(name)))]
    .sort((a, b) => a.localeCompare(b));
  return [...names, ...extra];
};

/** "8 configured · 72 not configured" */
export const symbolCountSummary = (rows = []) => {
  const configured = rows.filter((row) => row.configured).length;
  return `${configured} configured · ${rows.length - configured} not configured`;
};

/**
 * Streaming state per symbol. `streamedNames` is the feed's streamed symbol
 * list, or null while unknown (then every symbol reports 'unknown').
 */
export const streamingState = (symbol, streamedNames) => {
  if (!Array.isArray(streamedNames) && !(streamedNames instanceof Set)) return 'unknown';
  const names = streamedNames instanceof Set ? streamedNames : new Set(streamedNames.map(upper));
  return names.has(upper(symbol)) ? 'live' : 'no_data';
};

/**
 * Base symbols a derived symbol can be cloned from. The backend copies the
 * base row from `instruments` and rejects derived bases, so only configured,
 * non-derived instruments qualify.
 */
export const cloneBaseSymbols = (lpEntries = []) => lpEntries
  .filter((entry) => entry?.configured)
  .filter((entry) => {
    const instrument = entry.instrument || {};
    const type = String(instrument.symbolType || instrument.symbol_type || '').toLowerCase();
    const parent = instrument.parentSymbol || instrument.parent_symbol || '';
    return type !== 'derived' && !parent;
  })
  .map((entry) => entry.symbol);

/**
 * Clone source picker: `ready` can be cloned now; `needsConfig` are LP symbols
 * with no instrument yet — listed so every LP symbol is visible, but they must
 * be configured before their specifications can be copied.
 */
export const cloneSourceOptions = (lpEntries = []) => ({
  ready: cloneBaseSymbols(lpEntries),
  needsConfig: lpEntries.filter((entry) => entry && !entry.configured).map((entry) => entry.symbol),
});

const firstNumber = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return undefined;
};

/**
 * Clone form values taken from the chosen source instrument. The backend
 * applies the form's contract size and volumes as overrides, so they must start
 * at the source's own values; the category is preselected when it is one of
 * the category options. Fields the source does not carry are omitted.
 */
export const cloneDefaultsFromSource = (instrument, categoryNames = []) => {
  if (!instrument || typeof instrument !== 'object') return {};
  const defaults = {};
  const contractSize = firstNumber(instrument.contractSize, instrument.contract_size);
  const minVolume = firstNumber(instrument.minVolume, instrument.min_volume);
  const maxVolume = firstNumber(instrument.maxVolume, instrument.max_volume);
  const volumeStep = firstNumber(instrument.volumeStep, instrument.volume_step);
  if (contractSize !== undefined && contractSize > 0) defaults.contractSize = contractSize;
  if (minVolume !== undefined && minVolume > 0) defaults.minVolume = minVolume;
  if (maxVolume !== undefined && maxVolume > 0) defaults.maxVolume = maxVolume;
  if (volumeStep !== undefined && volumeStep > 0) defaults.volumeStep = volumeStep;
  const category = String(instrument.category || '').trim().toLowerCase();
  const match = categoryNames.find((name) => String(name).trim().toLowerCase() === category);
  defaults.category = match || '';
  return defaults;
};

/** Configured instrument names only (e.g. LP mapping internal symbols, FK-bound). */
export const configuredSymbolNames = (lpEntries = []) => lpEntries
  .filter((entry) => entry?.configured)
  .map((entry) => entry.symbol);

/**
 * Picker options built from merged LP entries: every LP symbol, keeping the
 * option shape the Symbol Management pickers read ({ symbol, name, category,
 * enabled, configured, ... }).
 */
export const lpSymbolOptions = (lpEntries = []) => lpEntries
  .filter((entry) => entry?.symbol)
  .map((entry) => {
    const instrument = entry.instrument && typeof entry.instrument === 'object' ? entry.instrument : {};
    return {
      ...instrument,
      symbol: entry.symbol,
      name: instrument.name || entry.symbol,
      symbolType: instrument.symbolType || (entry.configured ? 'base' : ''),
      parentSymbol: instrument.parentSymbol || '',
      category: entry.category || instrument.category || '',
      enabled: entry.configured ? instrument.enabled !== false : false,
      configured: Boolean(entry.configured),
    };
  });

export const NOT_CONFIGURED_GROUP_LABEL = 'From LP — not configured';

/**
 * Splits picker options into configured / not-configured groups. Options
 * without a `configured` flag (plain strings or legacy rows) count as configured.
 */
export const groupSymbolOptions = (options = []) => {
  const configured = [];
  const unconfigured = [];
  for (const option of Array.isArray(options) ? options : []) {
    const symbol = typeof option === 'string' ? option : option?.symbol;
    if (!symbol) continue;
    if (typeof option === 'object' && option.configured === false) unconfigured.push(symbol);
    else configured.push(symbol);
  }
  return { configured, unconfigured };
};
