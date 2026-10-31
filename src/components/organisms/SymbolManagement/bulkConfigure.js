// Bulk "Configure selected": one shared template plus optional per-symbol
// overrides for POST /api/v2/admin/instruments/bulk-configure (G3).
//
// Contract: every numeric value is a decimal STRING (exact, sent as typed),
// digits is an integer, trade_mode is "full". A dry run validates and derives
// only; a real run creates, enables and runs the calculation approval per
// symbol, each in its own transaction. The server derives FX currencies,
// tick_value and (when the feed has them) digits/tick_size; anything it cannot
// derive refuses that symbol only. At most 200 symbols per request.
// v1.3: margin_rate, swap_long, swap_short and swap_rollover_3days are required
// (no DB defaults; the server invents nothing); margin_initial/maintenance/
// hedged accept only "0"; each symbol has its own 120 s limit, so the UI sends
// the symbols in batches of BULK_BATCH_SIZE and shows progress.
// v1.4: category is required again (rows without one cannot be toggled or
// edited later); at most 50 symbols per request with a 10-minute budget, and
// symbols not reached come back refused with code REQUEST_TIMEOUT (nothing
// written), which the UI offers to retry.
import {calcModes, categoryTemplate, cryptoSessions, instrumentForm} from '../../../utils/instrumentForm.js';

// Selection limit of one bulk run in the UI; requests themselves are sent in batches of BULK_BATCH_SIZE (server max 50).
export const MAX_BULK_SYMBOLS = 200;
export const BULK_BATCH_SIZE = 25;
export const BULK_STATUSES = ['refused', 'would_create', 'created', 'enabled', 'exists_unchanged'];
export const REQUEST_TIMEOUT_CODE = 'REQUEST_TIMEOUT';
export const OVERRIDE_FIELDS = ['digits', 'tick_size', 'margin_currency', 'profit_currency', 'calc_mode', 'contract_size'];

const DECIMAL = /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;
const SIGNED_DECIMAL = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;
const CURRENCY = /^[A-Z]{3}$/;
const text = value => String(value ?? '').trim();

export const weekdaySessions = () => cryptoSessions().filter(row => row.day_of_week > 0 && row.day_of_week < 6);

/** Editable template state; starter values come from the category template when one is chosen. */
export function bulkTemplateForm(category = '', instruments = []) {
  const values = categoryTemplate(category, instruments)?.values || {};
  const pick = key => (values[key] === undefined || values[key] === null ? '' : String(values[key]));
  return {
    category,
    calc_mode: pick('calc_mode'),
    contract_size: pick('contract_size'),
    volume_step: pick('volume_step') || '0.01',
    min_volume: pick('min_volume') || '0.01',
    max_volume: pick('max_volume') || '100',
    timezone: pick('symbol_timezone') || 'UTC',
    margin_rate: pick('margin_rate'),
    swap_long: '',
    swap_short: '',
    swap_rollover_3days: '',
    sessions: instrumentForm({sessions: values.sessions || weekdaySessions()}).sessions,
  };
}

const positiveDecimal = (value, label) => {
  const raw = text(value);
  if (!DECIMAL.test(raw) || Number(raw) <= 0) throw new Error(`${label} must be a positive decimal number, e.g. 0.01.`);
  return raw;
};
const nonNegativeDecimal = (value, label) => {
  const raw = text(value);
  if (!DECIMAL.test(raw)) throw new Error(`${label} must be a decimal number of 0 or more.`);
  return raw;
};
const signedDecimal = (value, label) => {
  const raw = text(value);
  if (!SIGNED_DECIMAL.test(raw)) throw new Error(`${label} is required: a decimal number such as -1.25 or 0.`);
  return raw;
};
const compareDecimal = (a, b) => {
  const [ai, af = ''] = a.split('.'), [bi, bf = ''] = b.split('.');
  if (ai.length !== bi.length) return ai.length - bi.length;
  if (ai !== bi) return ai < bi ? -1 : 1;
  const width = Math.max(af.length, bf.length);
  const x = af.padEnd(width, '0'), y = bf.padEnd(width, '0');
  return x === y ? 0 : x < y ? -1 : 1;
};

const time = value => /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(value);
function checkSessions(sessions) {
  if (!Array.isArray(sessions) || !sessions.length) throw new Error('Configure at least one quote and trading session.');
  const seen = new Set();
  return sessions.map(session => {
    const day = Number(session.day_of_week);
    if (!Number.isInteger(day) || day < 0 || day > 6) throw new Error('Invalid session day.');
    if (seen.has(day)) throw new Error('Use one session per day.');
    seen.add(day);
    const row = {day_of_week: day};
    for (const key of ['quote_from', 'quote_to', 'trade_from', 'trade_to']) {
      const value = text(session[key]);
      if (!time(value) || (key.endsWith('_from') && value === '24:00')) throw new Error('Session times must use HH:MM; 24:00 is only valid as an end.');
      row[key] = value;
    }
    return row;
  });
}

function checkOverride(symbol, raw = {}) {
  const out = {};
  for (const key of OVERRIDE_FIELDS) {
    const value = text(raw[key]);
    if (!value) continue;
    if (key === 'digits') {
      if (!/^\d+$/.test(value) || Number(value) > 12) throw new Error(`${symbol}: digits must be a whole number from 0 to 12.`);
      out.digits = Number(value);
    } else if (key === 'calc_mode') {
      if (!calcModes.includes(value)) throw new Error(`${symbol}: select a supported calculation mode.`);
      out.calc_mode = value;
    } else if (key === 'margin_currency' || key === 'profit_currency') {
      const currency = value.toUpperCase();
      if (!CURRENCY.test(currency)) throw new Error(`${symbol}: ${key.replace('_', ' ')} must be a 3-letter code.`);
      out[key] = currency;
    } else {
      out[key] = positiveDecimal(value, `${symbol}: ${key.replace('_', ' ')}`);
    }
  }
  return out;
}

/**
 * The request body, validated like the single-instrument save. Throws an
 * Error with an operator-facing message. Symbols are sent exactly as listed.
 */
export function buildBulkConfigureRequest({symbols = [], form, perSymbol = {}, dryRun}) {
  const list = [...new Set((Array.isArray(symbols) ? symbols : []).map(text).filter(Boolean))];
  if (!list.length) throw new Error('Select at least one symbol to configure.');
  if (list.length > MAX_BULK_SYMBOLS) throw new Error(`Configure at most ${MAX_BULK_SYMBOLS} symbols at a time (${list.length} selected).`);
  if (!calcModes.includes(text(form?.calc_mode))) throw new Error('Select a supported calculation mode.');
  const volume_step = positiveDecimal(form.volume_step, 'Volume step');
  const min_volume = positiveDecimal(form.min_volume, 'Minimum volume');
  const max_volume = positiveDecimal(form.max_volume, 'Maximum volume');
  if (compareDecimal(min_volume, max_volume) > 0) throw new Error('Minimum volume cannot exceed maximum volume.');
  const timezone = text(form.timezone);
  try {
    if (!timezone) throw new Error();
    new Intl.DateTimeFormat('en', {timeZone: timezone});
  } catch {
    throw new Error('Enter a valid timezone, such as UTC or America/New_York.');
  }
  const category = text(form.category);
  if (!category) throw new Error('Select a category: bulk-created symbols need one to be edited or enabled later.');
  const template = {
    category,
    calc_mode: text(form.calc_mode),
    contract_size: positiveDecimal(form.contract_size, 'Contract size'),
    volume_step, min_volume, max_volume,
    sessions: checkSessions(form.sessions),
    timezone,
    trade_mode: 'full',
    margin_rate: nonNegativeDecimal(form.margin_rate, 'Margin rate'),
    swap_long: signedDecimal(form.swap_long, 'Swap long'),
    swap_short: signedDecimal(form.swap_short, 'Swap short'),
    swap_rollover_3days: tripleSwapDay(form.swap_rollover_3days),
    // Only "0" is accepted for these (the single save cannot write them).
    margin_initial: '0',
    margin_maintenance: '0',
    margin_hedged: '0',
  };
  const per_symbol = {};
  for (const symbol of list) {
    const override = checkOverride(symbol, perSymbol[symbol]);
    if (Object.keys(override).length) per_symbol[symbol] = override;
  }
  return {dry_run: dryRun === true, symbols: list, template, per_symbol};
}

function tripleSwapDay(value) {
  const raw = text(value);
  if (!/^[0-6]$/.test(raw)) throw new Error('Select the triple-swap day.');
  return raw;
}

/** Splits symbols into request batches (the server has a per-symbol time limit). */
export const chunkSymbols = (symbols, size = BULK_BATCH_SIZE) => {
  const out = [];
  for (let i = 0; i < symbols.length; i += size) out.push(symbols.slice(i, i + size));
  return out;
};

/** One response for several batch responses: results concatenated, summary counts added up. */
export const mergeBulkResponses = (responses) => {
  const summary = {};
  const results = [];
  let dryRun;
  for (const response of responses) {
    if (Array.isArray(response?.results)) results.push(...response.results);
    if (typeof response?.dry_run === 'boolean') dryRun = response.dry_run;
    for (const [key, value] of Object.entries(response?.summary || {})) {
      if (typeof value === 'number') summary[key] = (summary[key] || 0) + value;
    }
  }
  return {dry_run: dryRun, results, summary};
};

/** Symbols the server did not reach within its time budget (refused REQUEST_TIMEOUT, nothing written). */
export const timedOutSymbols = response => (Array.isArray(response?.results) ? response.results : [])
  .filter(row => row?.status === 'refused' && row?.code === REQUEST_TIMEOUT_CODE)
  .map(row => text(row.symbol))
  .filter(Boolean);

/** The earlier response with the rows of a retry replacing those symbols' rows; summary counts recomputed from rows. */
export const replaceBulkResults = (earlier, retry) => {
  const retried = new Map((Array.isArray(retry?.results) ? retry.results : []).map(row => [text(row.symbol), row]));
  const results = (Array.isArray(earlier?.results) ? earlier.results : []).map(row => retried.get(text(row.symbol)) || row);
  const count = status => results.filter(row => row?.status === status).length;
  return {...earlier, results, summary: {requested: results.length, created: count('created'), enabled: count('enabled'), refused: count('refused')}};
};

/** Counts per status and approval status; rows sorted refused first, then by symbol. */
export function summarizeBulkResults(response) {
  const results = Array.isArray(response?.results) ? response.results : [];
  const byStatus = Object.fromEntries(BULK_STATUSES.map(status => [status, 0]));
  const byApproval = {approved: 0, refused: 0, not_requested: 0};
  for (const row of results) {
    if (row?.status in byStatus) byStatus[row.status] += 1;
    const approval = row?.approval?.status;
    if (approval in byApproval) byApproval[approval] += 1;
  }
  const rank = status => {
    const index = BULK_STATUSES.indexOf(status);
    return index < 0 ? BULK_STATUSES.length : index;
  };
  const rows = [...results].sort((a, b) => rank(a?.status) - rank(b?.status) || text(a?.symbol).localeCompare(text(b?.symbol)));
  return {total: results.length, byStatus, byApproval, rows};
}

/** Symbols a confirmed run should send: the ones the dry run would create. */
export const symbolsToCreate = response => (Array.isArray(response?.results) ? response.results : [])
  .filter(row => row?.status === 'would_create')
  .map(row => text(row.symbol))
  .filter(Boolean);
