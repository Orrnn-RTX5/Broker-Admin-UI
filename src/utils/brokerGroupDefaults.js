// Broker group defaults (Server Config > Broker Defaults) and the create-group
// leverage rules. Pure helpers; the HTTP contract lives in
// services/brokerGroupDefaults.service.js.
//
// Leverage has no client-side default: a new group is pre-filled from the
// broker's configured default, otherwise the field is empty and required.
// Valid values are whole numbers GROUP_LEVERAGE_MIN..GROUP_LEVERAGE_MAX; blank
// means "unset" (null) and is never sent as 0.

export const GROUP_LEVERAGE_MIN = 1;
export const GROUP_LEVERAGE_MAX = 10000;
export const GROUP_DEFAULT_LEVERAGE_FIELD = 'group_default_leverage';

const RANGE_TEXT = `a whole number from ${GROUP_LEVERAGE_MIN} to ${GROUP_LEVERAGE_MAX}`;
const rangeError = (label = 'Leverage') => `${label} must be ${RANGE_TEXT}.`;
const isBlank = (value) => value == null || (typeof value === 'string' && value.trim() === '');

export const isValidGroupLeverage = (value) =>
  Number.isInteger(value) && value >= GROUP_LEVERAGE_MIN && value <= GROUP_LEVERAGE_MAX;

// Blank -> { value: null }; whole number in range -> { value }; else { error }.
export const parseGroupLeverage = (input, label) => {
  if (isBlank(input)) return { value: null };
  let value;
  if (typeof input === 'number') value = input;
  else if (typeof input === 'string' && /^\d+$/.test(input.trim())) value = Number(input.trim());
  return isValidGroupLeverage(value) ? { value } : { error: rangeError(label) };
};

// Create/edit group form rule: required, whole number in range. Same
// (value, label) signature as the other groupFormSteps parsers.
export const validateGroupLeverage = (input, label = 'Leverage') => {
  if (isBlank(input)) throw new Error(`${label} is required. Enter ${RANGE_TEXT}.`);
  const parsed = parseGroupLeverage(input, label);
  if (parsed.error) throw new Error(parsed.error);
  return parsed.value;
};

// GET/PUT 200 body: { broker_id, group_default_leverage: int | null }.
export const normalizeBrokerGroupDefaults = (raw) => {
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw[GROUP_DEFAULT_LEVERAGE_FIELD] : undefined;
  if (value !== null && !isValidGroupLeverage(value)) throw new Error('Invalid broker defaults response.');
  return { brokerId: typeof raw.broker_id === 'string' ? raw.broker_id : '', defaultLeverage: value };
};

// PUT body: exactly { group_default_leverage: int | null } (blank clears).
export const buildBrokerGroupDefaultsBody = (input) => {
  const parsed = parseGroupLeverage(input, 'Default leverage');
  if (parsed.error) {
    const error = new Error(`${parsed.error} Leave it blank to clear the default.`);
    error.code = 'GROUP_POLICY_DEFAULT_INVALID';
    error.field = GROUP_DEFAULT_LEVERAGE_FIELD;
    throw error;
  }
  return { [GROUP_DEFAULT_LEVERAGE_FIELD]: parsed.value };
};

export const formatGroupDefaultLeverage = (value) => (value == null ? 'Not set' : `1:${value}`);

// Create popup: the broker default fills an empty leverage the operator has not
// touched (a parent group or a copied draft keeps its own value).
export const applyBrokerDefaultLeverage = (form, defaultLeverage, touched) =>
  (touched || defaultLeverage == null || !isBlank(form?.leverage) ? form : { ...form, leverage: defaultLeverage });

// state: { status: 'loading' | 'set' | 'unset' | 'error', value }.
export const createGroupLeverageHint = (state) => {
  if (state?.status === 'set') return `Broker default: ${formatGroupDefaultLeverage(state.value)}.`;
  if (state?.status === 'unset') return `No broker default is set. Enter ${RANGE_TEXT}.`;
  if (state?.status === 'error') return `The broker default could not be loaded. Enter ${RANGE_TEXT}.`;
  return undefined;
};

// Group create/update refusals about leverage, mapped to leverage-field text.
const GROUP_CREATE_LEVERAGE_MESSAGES = Object.freeze({
  GROUP_POLICY_DEFAULT_MISSING: `This broker has no default leverage, so the group needs one. Enter ${RANGE_TEXT}, or set a default in Server Config > Broker Defaults.`,
  GROUP_LEVERAGE_INVALID: `The server refused this leverage. Enter ${RANGE_TEXT}.`,
});

export const groupCreateLeverageError = (error) => {
  const data = error?.response?.data;
  const code = typeof data?.code === 'string' ? data.code : '';
  const message = typeof data?.message === 'string' ? data.message : typeof data === 'string' ? data : '';
  const key = Object.keys(GROUP_CREATE_LEVERAGE_MESSAGES).find((name) => code === name || message.trim().startsWith(name));
  return key ? GROUP_CREATE_LEVERAGE_MESSAGES[key] : null;
};
