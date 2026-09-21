const GROUP_FIELDS = new Set([
  'name', 'description', 'accountType', 'bookType', 'commissionRate', 'commissionType',
  'currency', 'demo', 'executionMode', 'leverage', 'lotDivisor', 'marginCallLevel',
  'maxLotPerTrade', 'maxTotalLots', 'negativeBalanceProtection', 'spreadMarkup',
  'stopOutLevel', 'swapMultiplier', 'symbolsAllowed', 'symbolsBlocked', 'tradeAllowed',
]);
const BOOLEAN_FIELDS = new Set(['demo', 'negativeBalanceProtection', 'tradeAllowed']);

export const parseGroupImport = (text) => {
  const value = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.name !== 'string' || !value.name.trim()) {
    throw new Error('Expected one group configuration object with a non-empty name. Table exports are not group configurations.');
  }
  const draft = {};
  for (const [key, field] of Object.entries(value)) {
    if (!GROUP_FIELDS.has(key)) continue;
    if (BOOLEAN_FIELDS.has(key) && typeof field !== 'boolean') throw new Error(`${key} must be true or false.`);
    if (['symbolsAllowed', 'symbolsBlocked'].includes(key) && Array.isArray(field) && field.every((symbol) => typeof symbol === 'string')) {
      draft[key] = field.join(', ');
    } else if (field !== null && ['string', 'number', 'boolean'].includes(typeof field)) {
      draft[key] = field;
    } else {
      throw new Error(`Invalid value for ${key}.`);
    }
  }
  draft.name = value.name.trim();
  return draft;
};

// Sort the loaded page only; never mutate query-cache rows or reorder server pages.
export const sortToolbarRows = (rows, direction, view) => {
  if (!direction) return rows;
  const valueOf = (row) => view === 'Groups' ? (row.name ?? row.group ?? '')
    : view === 'Symbols' ? (row.symbol ?? row.name ?? '')
      : ['Positions', 'Orders', 'Deals'].includes(view) ? (row.ticket ?? row.id ?? '')
        : (row.login ?? row.id ?? row.name ?? '');
  return [...rows].sort((left, right) => String(valueOf(left)).localeCompare(String(valueOf(right)), undefined, { numeric: true, sensitivity: 'base' }) * (direction === 'desc' ? -1 : 1));
};
