import { parseCsvList } from './adminValidation.js';

const NUMERIC_FIELDS = new Set([
  'commissionRate',
  'leverage',
  'lotDivisor',
  'marginCallLevel',
  'maxLotPerTrade',
  'maxTotalLots',
  'spreadMarkup',
  'stopOutLevel',
  'swapMultiplier',
]);

const CSV_FIELDS = new Set(['symbolsAllowed', 'symbolsBlocked']);

const comparableValue = (field, value) => {
  if (CSV_FIELDS.has(field)) {
    return parseCsvList(Array.isArray(value) ? value.join(',') : value);
  }
  if (NUMERIC_FIELDS.has(field)) {
    const text = String(value ?? '').trim();
    const number = Number(text);
    return text && Number.isFinite(number) ? number : text;
  }
  if (typeof value === 'boolean') return value;
  return String(value ?? '').trim();
};

// Ignore formatting-only edits such as 100 -> "100" or spaces in a symbol list.
export const hasGroupFormChanges = (initial, current) => (
  Object.keys({ ...initial, ...current }).some((field) => {
    if (field === 'originalName') return false;
    return JSON.stringify(comparableValue(field, initial?.[field]))
      !== JSON.stringify(comparableValue(field, current?.[field]));
  })
);
