// Pure helpers for the bulk clone wizard (BulkCloneWizard.jsx).
//
// A clone is a derived instrument named category prefix + UPPER(base) +
// category suffix (either may be empty, not both) that copies every
// specification of a configured, non-derived base instrument and prices from
// it (plus its spread markup). Backend: /SymbolCloneCategoryList,
// /SymbolCloneCategoryCreate, /SymbolCloneBulk.

import { normalizeArrayResponse } from '../../../utils/apiShapes.js';
import { inferMarketCategory } from '../../../utils/marketCatalogue.js';
import { cloneDefaultsFromSource } from './symbolRows.js';

export const CLONE_NAME_MAX_LENGTH = 20;
export const BULK_CLONE_MAX_SYMBOLS = 500;
export const CLONE_SUFFIX_MAX_LENGTH = 12;
export const CLONE_AFFIX_MAX_LENGTH = CLONE_SUFFIX_MAX_LENGTH;

const upper = (value) => String(value ?? '').trim().toUpperCase();

// ─── Clone categories ─────────────────────────────────────────────────────────

/** Suffix (or prefix) as the backend stores it (trimmed, upper case). */
export const normalizeCloneSuffix = (suffix) => upper(suffix);

/**
 * A category's naming as { prefix, suffix } (upper case). Accepts a category
 * object or, for suffix-only callers, a plain suffix string.
 */
export const cloneAffix = (value) => {
  if (value && typeof value === 'object') return { prefix: upper(value.prefix), suffix: upper(value.suffix) };
  return { prefix: '', suffix: upper(value) };
};

/** EURUSD + .pro → EURUSD.PRO; with prefix PRO. → PRO.EURUSD */
export const cloneSymbolName = (baseSymbol, affix) => {
  const { prefix, suffix } = cloneAffix(affix);
  return `${prefix}${upper(baseSymbol)}${suffix}`;
};

/** Naming pattern of a category for display, e.g. "PRO.SYMBOL", "SYMBOL.PRO". */
export const formatCloneAffix = (affix) => {
  const { prefix, suffix } = cloneAffix(affix);
  return `${prefix}SYMBOL${suffix}`;
};

/** "" when valid, otherwise why a prefix/suffix is rejected (mirrors the backend rule). */
export const cloneAffixError = (value, label = 'Suffix', { required = false } = {}) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return required ? `${label} is required` : '';
  if (trimmed.length > CLONE_AFFIX_MAX_LENGTH) return `${label} must be at most ${CLONE_AFFIX_MAX_LENGTH} characters`;
  if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) return `${label} may only contain letters, digits, '.', '-' and '_'`;
  if (!/[A-Za-z0-9]/.test(trimmed)) return `${label} needs at least one letter or digit`;
  return '';
};

/** Suffix-only rule (kept for callers without a prefix). */
export const cloneSuffixError = (suffix) => cloneAffixError(suffix, 'Suffix', { required: true });

/**
 * Validates the "+ New clone category" form: a name and at least one of
 * prefix/suffix. Duplicates are checked against the known clone categories
 * (the backend also rejects names used by any other symbol category with 409).
 * Returns { name?, prefix?, suffix? }; {} is valid.
 */
export const validateCloneCategoryForm = ({ name = '', prefix = '', suffix = '' } = {}, existing = []) => {
  const errors = {};
  const trimmed = String(name ?? '').trim();
  if (!trimmed) errors.name = 'Name is required';
  else if (existing.some((category) => upper(category.name) === upper(trimmed))) errors.name = 'A clone category with this name already exists';
  const prefixError = cloneAffixError(prefix, 'Prefix');
  const suffixError = cloneAffixError(suffix, 'Suffix');
  if (prefixError) errors.prefix = prefixError;
  if (suffixError) errors.suffix = suffixError;
  if (!prefixError && !suffixError) {
    if (!String(prefix ?? '').trim() && !String(suffix ?? '').trim()) {
      errors.suffix = 'Enter a prefix, a suffix or both';
    } else {
      const wanted = cloneAffix({ prefix, suffix });
      if (existing.some((category) => {
        const other = cloneAffix(category);
        return other.prefix === wanted.prefix && other.suffix === wanted.suffix;
      })) {
        errors.suffix = 'Another clone category already uses this prefix/suffix';
      }
    }
  }
  return errors;
};

/** GET /SymbolCloneCategoryList → [{ id, name, prefix, suffix, description, symbolCount }] sorted by name. */
export const normalizeCloneCategories = (response) => normalizeArrayResponse(response, ['categories', 'data', 'items'])
  .filter((row) => row && typeof row === 'object' && row.id !== undefined && row.id !== null && row.name)
  .map((row) => ({
    id: row.id,
    name: String(row.name),
    prefix: normalizeCloneSuffix(row.prefix),
    suffix: normalizeCloneSuffix(row.suffix),
    description: row.description || '',
    symbolCount: Number(row.symbol_count ?? row.symbolCount ?? 0) || 0,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

// ─── Symbol selection (step 2) ────────────────────────────────────────────────

export const CLONE_GROUP_ORDER = ['Forex', 'Metals', 'Crypto', 'Indices', 'Energy', 'Commodities', 'Stocks', 'Futures', 'Bonds', 'Others'];

export const isDerivedInstrument = (instrument) => {
  if (!instrument || typeof instrument !== 'object') return false;
  const type = String(instrument.symbolType || instrument.symbol_type || '').toLowerCase();
  const parent = instrument.parentSymbol || instrument.parent_symbol || '';
  return type === 'derived' || Boolean(parent);
};

/** Market group of an LP entry: its (instrument) category, else the inferred one. */
export const cloneGroupOf = (entry) => {
  const supplied = String(entry?.instrument?.category || entry?.category || '').trim();
  const category = supplied || inferMarketCategory(upper(entry?.symbol));
  return CLONE_GROUP_ORDER.find((name) => name.toLowerCase() === category.toLowerCase()) || category || 'Others';
};

const groupRank = (name) => {
  const index = CLONE_GROUP_ORDER.indexOf(name);
  if (name === 'Others') return CLONE_GROUP_ORDER.length + 1;
  return index === -1 ? CLONE_GROUP_ORDER.length : index;
};

/**
 * Candidates grouped by market category. Each item has a status:
 *   eligible      configured base instrument, clone name free
 *   cloned        PREFIX+BASE+SUFFIX already exists
 *   too_long      PREFIX+BASE+SUFFIX exceeds CLONE_NAME_MAX_LENGTH
 *   unconfigured  LP symbol without an instrument (configure first)
 * Derived instruments (existing clones) are not bases and are left out.
 * Returns [{ name, items, eligible, total }] with configured items first.
 */
export const buildCloneCandidates = (entries = [], affix = '') => {
  const list = Array.isArray(entries) ? entries : [];
  const existing = new Set(list.map((entry) => upper(entry?.symbol)).filter(Boolean));
  const groups = new Map();
  for (const entry of list) {
    const symbol = upper(entry?.symbol);
    if (!symbol) continue;
    if (entry.configured && isDerivedInstrument(entry.instrument)) continue;
    const cloneName = cloneSymbolName(symbol, affix);
    let status = 'eligible';
    if (!entry.configured) status = 'unconfigured';
    else if (existing.has(cloneName)) status = 'cloned';
    else if (cloneName.length > CLONE_NAME_MAX_LENGTH) status = 'too_long';
    const group = cloneGroupOf(entry);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push({ symbol, cloneName, status, instrument: entry.instrument || null });
  }
  return [...groups.entries()]
    .map(([name, items]) => ({
      name,
      items: items.sort((a, b) => Number(a.status === 'unconfigured') - Number(b.status === 'unconfigured') || a.symbol.localeCompare(b.symbol)),
      eligible: items.filter((item) => item.status === 'eligible').length,
      total: items.length,
    }))
    .sort((a, b) => groupRank(a.name) - groupRank(b.name) || a.name.localeCompare(b.name));
};

/** Groups narrowed to items whose symbol matches `search`; empty groups dropped. */
export const filterCloneCandidates = (groups = [], search = '') => {
  const query = upper(search);
  if (!query) return groups;
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.symbol.includes(query)) }))
    .filter((group) => group.items.length > 0);
};

export const eligibleSymbols = (groups = []) => groups
  .flatMap((group) => group.items)
  .filter((item) => item.status === 'eligible')
  .map((item) => item.symbol);

/** 'all' | 'some' | 'none' for a group's (visible) eligible items. */
export const groupSelectionState = (group, selected) => {
  const symbols = (group?.items || []).filter((item) => item.status === 'eligible').map((item) => item.symbol);
  const count = symbols.filter((symbol) => selected.has(symbol)).length;
  if (count === 0) return 'none';
  return count === symbols.length ? 'all' : 'some';
};

/** New selection with the group's eligible items added (checked) or removed. */
export const toggleGroupSelection = (selected, group, checked) => {
  const next = new Set(selected);
  for (const item of group?.items || []) {
    if (item.status !== 'eligible') continue;
    if (checked) next.add(item.symbol);
    else next.delete(item.symbol);
  }
  return next;
};

/** Selection limited to symbols that are still eligible (e.g. after the suffix changed). */
export const pruneSelection = (selected, groups) => {
  const allowed = new Set(eligibleSymbols(groups));
  const next = new Set([...selected].filter((symbol) => allowed.has(symbol)));
  return next.size === selected.size ? selected : next;
};

/** "" when the selection can go to step 3, otherwise why not. */
export const selectionError = (selected) => {
  const size = selected?.size ?? 0;
  if (size === 0) return 'Select at least one symbol';
  if (size > BULK_CLONE_MAX_SYMBOLS) return `At most ${BULK_CLONE_MAX_SYMBOLS} symbols per bulk clone (${size} selected)`;
  return '';
};

// ─── Configure (step 3) ───────────────────────────────────────────────────────

export const CLONE_ROW_FIELDS = ['spreadMarkupPips', 'contractSize', 'minVolume', 'maxVolume', 'volumeStep'];
export const APPLY_ALL_FIELDS = ['spreadMarkupPips', 'minVolume', 'maxVolume', 'volumeStep'];

const text = (value) => (value === undefined || value === null ? '' : String(value));

/**
 * One editable row per selected base symbol, in `order` (sorted symbols).
 * New rows start at the source instrument's contract size and volumes with a
 * 0 markup; rows in `previous` keep their edited values. Values are strings
 * (input values); an empty value is omitted so the backend copies the base.
 */
export const buildCloneRows = (symbols = [], entries = [], affix = '', previous = []) => {
  const instruments = new Map((Array.isArray(entries) ? entries : [])
    .filter((entry) => entry?.configured && entry.instrument)
    .map((entry) => [upper(entry.symbol), entry.instrument]));
  const kept = new Map((previous || []).map((row) => [row.baseSymbol, row]));
  return [...symbols].map(upper).sort((a, b) => a.localeCompare(b)).map((baseSymbol) => {
    const newSymbol = cloneSymbolName(baseSymbol, affix);
    const old = kept.get(baseSymbol);
    if (old) return { ...old, newSymbol };
    const defaults = cloneDefaultsFromSource(instruments.get(baseSymbol));
    return {
      baseSymbol,
      newSymbol,
      spreadMarkupPips: '0',
      contractSize: text(defaults.contractSize),
      minVolume: text(defaults.minVolume),
      maxVolume: text(defaults.maxVolume),
      volumeStep: text(defaults.volumeStep),
    };
  });
};

/** Rows with `field` set to `value` everywhere (the "apply to all" row). */
export const applyToAllRows = (rows = [], field, value) => {
  if (!CLONE_ROW_FIELDS.includes(field)) return rows;
  return rows.map((row) => ({ ...row, [field]: text(value).trim() }));
};

const numberOrNull = (value) => {
  const raw = text(value).trim();
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : NaN;
};

/** Field errors of one row, e.g. { minVolume: 'Must be > 0' }; {} is valid. */
export const validateCloneRow = (row) => {
  const errors = {};
  if (!row?.newSymbol) errors.newSymbol = 'Missing name';
  else if (row.newSymbol.length > CLONE_NAME_MAX_LENGTH) errors.newSymbol = `Longer than ${CLONE_NAME_MAX_LENGTH} characters`;
  const markup = numberOrNull(row?.spreadMarkupPips);
  if (Number.isNaN(markup) || (markup !== null && markup < 0)) errors.spreadMarkupPips = 'Must be ≥ 0';
  for (const field of ['contractSize', 'minVolume', 'maxVolume', 'volumeStep']) {
    const value = numberOrNull(row?.[field]);
    if (Number.isNaN(value) || (value !== null && value <= 0)) errors[field] = 'Must be > 0';
  }
  const min = numberOrNull(row?.minVolume);
  const max = numberOrNull(row?.maxVolume);
  if (!errors.minVolume && !errors.maxVolume && min !== null && max !== null && min > max) {
    errors.maxVolume = 'Must be ≥ min volume';
  }
  return errors;
};

/** { valid, errors: { [baseSymbol]: fieldErrors }, invalidCount } */
export const validateCloneRows = (rows = []) => {
  const errors = {};
  for (const row of rows) {
    const rowErrors = validateCloneRow(row);
    if (Object.keys(rowErrors).length > 0) errors[row.baseSymbol] = rowErrors;
  }
  const invalidCount = Object.keys(errors).length;
  const tooMany = rows.length > BULK_CLONE_MAX_SYMBOLS;
  return { valid: rows.length > 0 && invalidCount === 0 && !tooMany, errors, invalidCount };
};

// ─── Create (step 4) ──────────────────────────────────────────────────────────

const PAYLOAD_KEYS = {
  spreadMarkupPips: 'spread_markup_pips',
  contractSize: 'contract_size',
  minVolume: 'min_volume',
  maxVolume: 'max_volume',
  volumeStep: 'volume_step',
};

/** POST /SymbolCloneBulk body; empty fields are omitted (copied from the base). */
export const buildBulkClonePayload = (categoryId, rows = []) => ({
  category_id: categoryId,
  symbols: rows.map((row) => {
    const item = { base_symbol: upper(row.baseSymbol) };
    for (const [field, key] of Object.entries(PAYLOAD_KEYS)) {
      const value = numberOrNull(row[field]);
      if (value !== null && !Number.isNaN(value)) item[key] = value;
    }
    const description = text(row.description).trim();
    if (description) item.description = description;
    return item;
  }),
});

/** POST /SymbolCloneBulk response → { category, prefix, suffix, created, skipped }. */
export const normalizeBulkCloneResult = (response) => {
  const data = response && typeof response === 'object' ? response : {};
  const list = (value) => (Array.isArray(value) ? value : [])
    .filter((row) => row && typeof row === 'object')
    .map((row) => ({
      symbol: String(row.symbol || ''),
      baseSymbol: String(row.base_symbol || row.baseSymbol || ''),
      reason: row.reason ? String(row.reason) : '',
    }));
  return {
    category: String(data.category || ''),
    prefix: String(data.prefix || ''),
    suffix: String(data.suffix || ''),
    created: list(data.created),
    skipped: list(data.skipped),
  };
};
