// Pure helpers behind the Group properties dialog
// (components/RIGHTCLICKJPOPUPS/GroupPropertiesPopup.jsx):
//   - Margin tab: form <-> group record, validation, changed-fields diff.
//   - Symbols tab: GroupSymbolsGet row normalization and the staged list
//     operations (add / remove / move / edit), dirty detection and the
//     GroupSymbolsSave payload.
//   - Commissions tab: schedule form <-> CommissionSchedule* payloads.

const hasValue = (value) => value !== undefined && value !== null && value !== '';

const pickDefined = (source, keys, fallback = '') => {
  for (const key of keys) {
    const value = source?.[key];
    if (hasValue(value)) return value;
  }
  return fallback;
};

const toFiniteNumber = (value, fallback) => {
  if (!hasValue(value)) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseRequiredNumber = (value) => {
  if (!hasValue(String(value ?? '').trim())) return { error: 'is required' };
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return { error: 'must be a number' };
  if (parsed < 0) return { error: 'must be 0 or greater' };
  return { value: parsed };
};

const upper = (value) => String(value ?? '').trim().toUpperCase();

export const getGroupName = (group) => String(group?.group || group?.name || '');

// ---------------------------------------------------------------------------
// Margin tab
// ---------------------------------------------------------------------------

export const EXECUTION_MODE_OPTIONS = [
  { value: 'market', label: 'Market execution' },
  { value: 'instant', label: 'Instant execution' },
];

/** The four Margin fields the backend supports, as editable (string) form values. */
export const buildMarginForm = (group) => ({
  executionMode: String(pickDefined(group, ['executionMode', 'risk'], 'market')).trim().toLowerCase(),
  marginCallLevel: String(pickDefined(group, ['marginCallLevel'], '')),
  stopOutLevel: String(pickDefined(group, ['stopOutLevel'], '')),
  negativeBalanceProtection: pickDefined(group, ['negativeBalanceProtection'], false) === true,
});

/**
 * Validates the Margin form. Returns { values, errors } where `values` holds
 * the parsed fields and `errors` maps field -> message (empty when valid).
 */
export const validateMarginForm = (form) => {
  const errors = {};
  const values = {
    executionMode: String(form?.executionMode ?? '').trim().toLowerCase(),
    negativeBalanceProtection: form?.negativeBalanceProtection === true,
  };

  if (!EXECUTION_MODE_OPTIONS.some((option) => option.value === values.executionMode)) {
    errors.executionMode = 'Execution mode must be market or instant.';
  }

  const marginCall = parseRequiredNumber(form?.marginCallLevel);
  if (marginCall.error) errors.marginCallLevel = `Margin call level ${marginCall.error}.`;
  else values.marginCallLevel = marginCall.value;

  const stopOut = parseRequiredNumber(form?.stopOutLevel);
  if (stopOut.error) errors.stopOutLevel = `Stop out level ${stopOut.error}.`;
  else values.stopOutLevel = stopOut.value;

  if (!errors.marginCallLevel && !errors.stopOutLevel && values.stopOutLevel > values.marginCallLevel) {
    errors.stopOutLevel = 'Stop out level must be less than or equal to the margin call level.';
  }

  return { values, errors };
};

const MARGIN_FIELDS = ['executionMode', 'marginCallLevel', 'stopOutLevel', 'negativeBalanceProtection'];
const sameMarginValue = (a, b) => String(a ?? '').trim() === String(b ?? '').trim();

/** True when the raw Margin form differs from the loaded one. */
export const isMarginFormDirty = (initial, form) => (
  MARGIN_FIELDS.some((key) => !sameMarginValue(initial?.[key], form?.[key]))
);

/**
 * After a revision conflict the group is reloaded: a field the admin edited
 * keeps the admin's value, every untouched field takes the freshly loaded
 * value, so pressing OK again never reverts someone else's change.
 */
export const rebaseMarginForm = (previousBaseline, form, freshBaseline) => {
  const next = { ...freshBaseline };
  for (const key of MARGIN_FIELDS) {
    if (!sameMarginValue(previousBaseline?.[key], form?.[key])) next[key] = form[key];
  }
  return next;
};

/**
 * The GroupUpdate body for the Margin tab: ONLY the fields whose parsed value
 * differs from the loaded group. Returns { changes, errors }; `changes` is
 * empty when validation fails or nothing effectively changed.
 */
export const buildMarginChanges = (initial, form) => {
  const { values, errors } = validateMarginForm(form);
  if (Object.keys(errors).length > 0) return { changes: {}, errors };

  const before = {
    executionMode: String(initial?.executionMode ?? '').trim().toLowerCase(),
    marginCallLevel: toFiniteNumber(initial?.marginCallLevel, null),
    stopOutLevel: toFiniteNumber(initial?.stopOutLevel, null),
    negativeBalanceProtection: initial?.negativeBalanceProtection === true,
  };

  const changes = {};
  for (const key of Object.keys(before)) {
    if (values[key] !== before[key]) changes[key] = values[key];
  }
  return { changes, errors };
};

/** Toast text for a GroupUpdate response ("… applied to N accounts"), or ''. */
export const describeAccountsUpdated = (response) => {
  const count = response?.accounts_updated;
  if (!hasValue(count) || !Number.isFinite(Number(count))) return '';
  const n = Number(count);
  return `Margin settings applied to ${n} account${n === 1 ? '' : 's'}.`;
};

// ---------------------------------------------------------------------------
// Symbols tab
// ---------------------------------------------------------------------------

/** Row shape used by the Symbols tab table (from one GroupSymbolsGet entry). */
export const normalizeGroupSymbolRow = (raw, { persisted = true } = {}) => ({
  symbol: String(raw?.symbol ?? '').trim(),
  spread_markup: Math.max(0, Math.trunc(toFiniteNumber(raw?.spread_markup, 0))),
  commission: Math.max(0, toFiniteNumber(raw?.commission, 0)),
  swap_multiplier: Math.max(0, toFiniteNumber(raw?.swap_multiplier, 1)),
  trade_allowed: raw?.trade_allowed !== false,
  configured: raw?.configured !== false,
  persisted,
});

/**
 * Normalizes a GroupSymbolsGet / GroupSymbolsSave response.
 * Returns { rows, unrestricted, blocked }.
 */
export const normalizeGroupSymbolsResponse = (response) => {
  const list = Array.isArray(response?.symbols) ? response.symbols : (Array.isArray(response) ? response : []);
  const seen = new Set();
  const rows = list
    .map((raw) => normalizeGroupSymbolRow(raw))
    .filter((row) => {
      if (!row.symbol || seen.has(upper(row.symbol))) return false;
      seen.add(upper(row.symbol));
      return true;
    });

  return {
    rows,
    unrestricted: typeof response?.unrestricted === 'boolean' ? response.unrestricted : rows.length === 0,
    blocked: Array.isArray(response?.blocked) ? response.blocked : [],
  };
};

/** A new (unsaved) row with the default per-symbol settings. */
export const createGroupSymbolRow = (symbol, { configured = true } = {}) => normalizeGroupSymbolRow({
  symbol,
  spread_markup: 0,
  commission: 0,
  swap_multiplier: 1,
  trade_allowed: true,
  configured,
}, { persisted: false });

/** Appends `symbol` to the staged list. Throws on empty or duplicate symbols. */
export const addGroupSymbolRow = (rows, symbol, options = {}) => {
  const name = String(symbol ?? '').trim();
  if (!name) throw new Error('Enter a symbol to add.');
  if ((rows || []).some((row) => upper(row.symbol) === upper(name))) {
    throw new Error(`${name} is already in the list.`);
  }
  return [...(rows || []), createGroupSymbolRow(name, options)];
};

/**
 * Categories for "add by category": LP/configured symbol entries grouped by
 * their category (instrument category, e.g. a clone category, or the inferred
 * market). Each option lists its symbols and how many are not yet in `existing`.
 */
export const symbolCategoryOptions = (entries = [], existing = []) => {
  const listed = new Set((existing || []).map(upper));
  const byCategory = new Map();
  for (const entry of entries || []) {
    const symbol = String(entry?.symbol ?? '').trim();
    if (!symbol) continue;
    const category = String(entry.category || '').trim() || 'Others';
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push({ symbol, configured: entry.configured !== false });
  }
  return [...byCategory.entries()]
    .map(([category, symbols]) => ({
      category,
      symbols,
      addable: symbols.filter((item) => !listed.has(upper(item.symbol))).length,
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
};

/** Appends every symbol not already listed; returns { rows, added }. */
export const addGroupSymbolRows = (rows, items = []) => {
  const next = [...(rows || [])];
  const listed = new Set(next.map((row) => upper(row.symbol)));
  let added = 0;
  for (const item of items) {
    const symbol = String(item?.symbol ?? '').trim();
    if (!symbol || listed.has(upper(symbol))) continue;
    listed.add(upper(symbol));
    next.push(createGroupSymbolRow(symbol, { configured: item.configured !== false }));
    added += 1;
  }
  return { rows: next, added };
};

export const removeGroupSymbolRow = (rows, index) => (
  (rows || []).filter((_, i) => i !== index)
);

/**
 * Moves the row at `index` by `delta` (-1 up, +1 down). Returns
 * { rows, index } with the row's new index; unchanged when out of range.
 */
export const moveGroupSymbolRow = (rows, index, delta) => {
  const list = rows || [];
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) {
    return { rows: list, index };
  }
  const next = [...list];
  const [row] = next.splice(index, 1);
  next.splice(target, 0, row);
  return { rows: next, index: target };
};

/** Edit-form values for a row (strings for the inputs). */
export const groupSymbolEditForm = (row) => ({
  spread_markup: String(row?.spread_markup ?? 0),
  commission: String(row?.commission ?? 0),
  swap_multiplier: String(row?.swap_multiplier ?? 1),
  trade_allowed: row?.trade_allowed !== false,
});

/** Validates the per-symbol edit form. Returns { values, errors }. */
export const validateGroupSymbolEdit = (form) => {
  const errors = {};
  const values = { trade_allowed: form?.trade_allowed !== false };

  const spread = parseRequiredNumber(form?.spread_markup);
  if (spread.error) errors.spread_markup = `Spread markup ${spread.error}.`;
  else if (!Number.isInteger(spread.value)) errors.spread_markup = 'Spread markup must be a whole number of points.';
  else values.spread_markup = spread.value;

  const commission = parseRequiredNumber(form?.commission);
  if (commission.error) errors.commission = `Commission ${commission.error}.`;
  else values.commission = commission.value;

  const swap = parseRequiredNumber(form?.swap_multiplier);
  if (swap.error) errors.swap_multiplier = `Swap multiplier ${swap.error}.`;
  else values.swap_multiplier = swap.value;

  return { values, errors };
};

/** Applies validated edit values to the row at `index`. */
export const updateGroupSymbolRow = (rows, index, values) => (
  (rows || []).map((row, i) => (i === index ? { ...row, ...values } : row))
);

export const toGroupSymbolPayloadRow = (row) => ({
  symbol: row.symbol,
  spread_markup: row.spread_markup,
  commission: row.commission,
  swap_multiplier: row.swap_multiplier,
  trade_allowed: row.trade_allowed,
});

/** True when the staged list (order or values) differs from the loaded one. */
export const isGroupSymbolListDirty = (baseline, rows) => (
  JSON.stringify((baseline || []).map(toGroupSymbolPayloadRow))
    !== JSON.stringify((rows || []).map(toGroupSymbolPayloadRow))
);

/** GroupSymbolsSave body. An empty list means "all broker symbols allowed". */
export const buildGroupSymbolsSavePayload = (group, rows) => ({
  group,
  symbols: (rows || []).map(toGroupSymbolPayloadRow),
});

// ---------------------------------------------------------------------------
// Commissions tab
// ---------------------------------------------------------------------------

export const COMMISSION_TYPE_OPTIONS = [
  { value: 'per_lot', label: 'Per lot', valueHint: 'amount per lot traded' },
  { value: 'percentage', label: 'Percentage', valueHint: '% of the deal notional' },
  { value: 'flat', label: 'Flat', valueHint: 'fixed amount per deal' },
];

export const formatCommissionType = (value) => (
  COMMISSION_TYPE_OPTIONS.find((option) => option.value === value)?.label || String(value ?? '')
);

/** Only the schedules that belong to `groupName`. */
export const filterSchedulesForGroup = (list, groupName) => (
  (Array.isArray(list) ? list : []).filter((row) => String(row?.group_name ?? '') === String(groupName ?? ''))
);

export const getScheduleId = (row) => row?.id ?? row?.schedule_id ?? null;

/**
 * "HH:MM" for a schedule time. Accepts "HH:MM[:SS]" strings and pgx time
 * objects ({ Microseconds, Valid }); anything else becomes ''.
 */
export const formatScheduleTime = (value) => {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{1,2}):(\d{2})/);
    return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
  }
  if (value && typeof value === 'object' && value.Valid !== false && Number.isFinite(Number(value.Microseconds))) {
    const totalMinutes = Math.floor(Number(value.Microseconds) / 60e6);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  return '';
};

export const formatVolumeRange = (row) => `${row?.min_volume ?? 0} – ${row?.max_volume ?? ''}`;

/** Blank form for a new schedule (group is fixed by the dialog, not the form). */
export const emptyCommissionForm = () => ({
  name: '',
  symbol: '',
  commission_type: COMMISSION_TYPE_OPTIONS[0].value,
  value: '',
  min_volume: '',
  max_volume: '',
  time_from: '',
  time_to: '',
  enabled: true,
});

/** Form prefilled from a CommissionScheduleList row. */
export const commissionFormFromSchedule = (row) => ({
  name: String(row?.name ?? ''),
  symbol: String(row?.symbol ?? ''),
  commission_type: String(row?.commission_type || COMMISSION_TYPE_OPTIONS[0].value),
  value: hasValue(row?.value) ? String(row.value) : '',
  min_volume: hasValue(row?.min_volume) ? String(row.min_volume) : '',
  max_volume: hasValue(row?.max_volume) ? String(row.max_volume) : '',
  time_from: formatScheduleTime(row?.time_from),
  time_to: formatScheduleTime(row?.time_to),
  enabled: row?.enabled !== false,
});

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Validates the schedule form and builds the CommissionScheduleCreate body,
 * or the CommissionScheduleUpdate body when `id` is given. Throws an Error
 * with a user-facing message on invalid input.
 */
export const buildCommissionSchedulePayload = (form, groupName, { id } = {}) => {
  const name = String(form?.name ?? '').trim();
  const symbol = String(form?.symbol ?? '').trim();
  const commissionType = String(form?.commission_type ?? '');
  if (!String(groupName ?? '').trim()) throw new Error('Group is required.');
  if (!name) throw new Error('Name is required.');
  if (!symbol) throw new Error('Symbol is required.');
  if (!COMMISSION_TYPE_OPTIONS.some((option) => option.value === commissionType)) {
    throw new Error('Choose a commission type.');
  }

  const value = parseRequiredNumber(form?.value);
  if (value.error) throw new Error(`Value ${value.error}.`);

  const minVolume = hasValue(String(form?.min_volume ?? '').trim()) ? parseRequiredNumber(form.min_volume) : { value: 0 };
  if (minVolume.error) throw new Error(`Min volume ${minVolume.error}.`);
  const maxVolume = parseRequiredNumber(form?.max_volume);
  if (maxVolume.error) throw new Error(`Max volume ${maxVolume.error}.`);
  if (maxVolume.value <= 0) throw new Error('Max volume must be greater than 0.');
  if (maxVolume.value < minVolume.value) throw new Error('Max volume must be greater than or equal to min volume.');

  const timeFrom = String(form?.time_from ?? '').trim();
  const timeTo = String(form?.time_to ?? '').trim();
  if (timeFrom && !TIME_RE.test(timeFrom)) throw new Error('Time from must be HH:MM.');
  if (timeTo && !TIME_RE.test(timeTo)) throw new Error('Time to must be HH:MM.');
  if (Boolean(timeFrom) !== Boolean(timeTo)) throw new Error('Set both time from and time to, or leave both empty.');

  const payload = {
    name,
    symbol,
    group_name: String(groupName),
    commission_type: commissionType,
    value: value.value,
    min_volume: minVolume.value,
    max_volume: maxVolume.value,
    time_from: timeFrom,
    time_to: timeTo,
  };

  if (id === undefined || id === null) return payload;
  return { id: Number(id), ...payload, enabled: form?.enabled !== false };
};
