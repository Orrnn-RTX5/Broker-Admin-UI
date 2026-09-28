// Group Properties → Symbols tab: every global instrument with the group's
// trade override (GroupSymbolOverridesGet / GroupSymbolOverridesSave).
//
// A group override can only turn a symbol OFF for the group. Clearing it makes
// the symbol follow the global setting again. Rows blocked by something above
// the group override (global instrument off, broker feed scope, the group's
// blocked list or a legacy allow-list) are not editable here.

export const GROUP_SYMBOL_STATUS = {
  global: { label: 'Global', hint: 'No group override; follows the global symbol setting.' },
  override_off: { label: 'Override: OFF', hint: 'Turned off for this group only.' },
  not_in_allow_list: { label: 'Not in allow-list', hint: "Not in this group's legacy allowed-symbols list (Symbol List tab)." },
  blocked_list: { label: 'Blocked list', hint: "In this group's blocked symbols." },
  outside_feed_scope: { label: 'Outside feed', hint: "Not in the broker's feed symbol scope." },
  disabled_globally: { label: 'Disabled globally', hint: 'Disabled in Symbol Management — a group cannot enable it.' },
};

export const GROUP_SYMBOL_FILTERS = [
  { value: 'all', label: 'All symbols' },
  { value: 'on', label: 'Tradeable' },
  { value: 'off', label: 'Not tradeable' },
  { value: 'overrides', label: 'Group overrides' },
];

const EDITABLE = new Set(['global', 'override_off']);

const upper = (value) => String(value ?? '').trim().toUpperCase();

export const normalizeGroupSymbolOverrides = (response) => {
  const list = Array.isArray(response?.symbols) ? response.symbols : [];
  const rows = list
    .map((raw) => ({
      symbol: String(raw?.symbol ?? '').trim(),
      category: String(raw?.category ?? ''),
      globalEnabled: raw?.global_enabled !== false,
      override: raw?.group_override === 'off' ? 'off' : null,
      status: GROUP_SYMBOL_STATUS[raw?.status] ? raw.status : 'global',
      effective: raw?.effective === true,
    }))
    .filter((row) => row.symbol);
  return {
    rows,
    legacyAllowList: response?.legacy_allow_list === true,
    allowListCount: Number(response?.allow_list_count) || 0,
    blocked: Array.isArray(response?.blocked) ? response.blocked : [],
    feedScoped: response?.feed_scoped === true,
  };
};

export const isGroupSymbolEditable = (row) => EDITABLE.has(row?.status);

/** The row as it will be after the staged (unsaved) change, if any. */
export const applyStagedOverride = (row, staged) => {
  const key = upper(row.symbol);
  if (!isGroupSymbolEditable(row) || !staged?.has(key)) return { ...row, staged: false };
  const override = staged.get(key);
  return {
    ...row,
    override,
    status: override === 'off' ? 'override_off' : 'global',
    effective: override !== 'off',
    staged: true,
  };
};

/** Flips the row's override; returns a new Map without no-op entries. */
export const toggleStagedOverride = (staged, row) => {
  const next = new Map(staged);
  if (!isGroupSymbolEditable(row)) return next;
  const key = upper(row.symbol);
  const current = next.has(key) ? next.get(key) : row.override;
  const desired = current === 'off' ? null : 'off';
  if (desired === row.override) next.delete(key);
  else next.set(key, desired);
  return next;
};

/** GroupSymbolOverridesSave changes for the staged overrides. */
export const buildGroupSymbolOverrideChanges = (staged) => (
  [...(staged || new Map()).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([symbol, override]) => ({ symbol, trade_allowed: override !== 'off' }))
);

export const filterGroupSymbolRows = (rows, query, filter) => {
  const q = upper(query);
  return rows.filter((row) => {
    if (q && !upper(row.symbol).includes(q) && !upper(row.category).includes(q)) return false;
    if (filter === 'on') return row.effective;
    if (filter === 'off') return !row.effective;
    if (filter === 'overrides') return row.override === 'off';
    return true;
  });
};

export const summarizeGroupSymbols = (rows) => ({
  total: rows.length,
  tradeable: rows.filter((row) => row.effective).length,
  overrides: rows.filter((row) => row.override === 'off').length,
});
