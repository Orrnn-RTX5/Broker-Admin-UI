// Pure helpers for the Server Config > "Demo Accounts" tab (global demo account group).
// Backend contract: GET /manager/DemoAccountGroupGet, POST /manager/DemoAccountGroupSet.

export const AUTOMATIC_DEMO_GROUP_LABEL = 'Automatic (alphabetically first demo group)';

export const DEMO_SIGNUP_DISABLED_MESSAGE = 'Demo signup is disabled — guests cannot create demo accounts.';
export const DEMO_SERVER_OFF_STATUS_MESSAGE =
  'Demo signup is switched off on the server — guests cannot create demo accounts.';
export const DEMO_SERVER_DISABLED_WARNING =
  'Demo signup is switched off on the server (PUBLIC_DEMO_ENABLED=false in the backend .env). ' +
  'Set it to true and restart the gateway and manager to allow demo accounts.';
export const DEMO_DISABLE_CONFIRM_MESSAGE =
  'Disable demo signup? Guests in the web terminal will no longer be able to create demo accounts.';

// Per-broker netting demo group (setting public_demo_netting_group). Every backend name it uses is here.
export const NETTING_DEMO_CONTRACT = {
  responseGroupKey: 'netting_group',
  responseValidKey: 'netting_valid',
  responseListKey: 'netting_demo_groups',
  requestKey: 'netting_group',
};
export const NETTING_DEMO_OFF_LABEL = 'Off (no netting demo accounts)';

const asString = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));

const toPositiveNumber = (value) => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const toDemoGroupOptions = (list) => (Array.isArray(list) ? list : [])
  .filter((g) => g && typeof g === 'object' && asString(g.name).trim())
  .map((g) => ({
    name: asString(g.name).trim(),
    description: asString(g.description),
    currency: asString(g.currency).trim(),
    leverage: toPositiveNumber(g.leverage),
  }));

const marginModeOf = (g) => asString(g?.margin_mode ?? g?.marginMode).trim().toLowerCase();
const isNettingGroup = (g) => marginModeOf(g) === 'netting';

/**
 * Netting demo groups only. A server-filtered list wins (an entry that names another margin mode is still
 * dropped); otherwise demo groups whose margin mode is exactly netting. Fail closed: a demo group without a
 * margin mode is never offered.
 */
const nettingDemoGroupsOf = (data) => {
  const serverList = data[NETTING_DEMO_CONTRACT.responseListKey];
  if (Array.isArray(serverList)) {
    return toDemoGroupOptions(serverList.filter((g) => marginModeOf(g) === '' || isNettingGroup(g)));
  }
  return toDemoGroupOptions((Array.isArray(data.demo_groups) ? data.demo_groups : []).filter(isNettingGroup));
};

/** Normalizes the DemoAccountGroupGet response into a stable shape. */
export const normalizeDemoAccountGroupState = (raw) => {
  const data = raw && typeof raw === 'object' ? raw : {};
  const group = asString(data.group).trim();
  const demoGroups = toDemoGroupOptions(data.demo_groups);
  const nettingGroup = asString(data[NETTING_DEMO_CONTRACT.responseGroupKey]).trim();
  const effectiveGroup = asString(data.effective_group).trim();
  // Both switches default to "on" when an older backend omits them.
  const signupEnabled = data.signup_enabled !== false;
  const serverEnabled = data.server_enabled !== false;
  return {
    brokerId: asString(data.broker_id),
    group,
    configured: data.configured === true || (data.configured == null && group !== ''),
    valid: data.valid === true,
    effectiveGroup,
    demoGroups,
    signupEnabled,
    serverEnabled,
    signupAvailable: typeof data.signup_available === 'boolean'
      ? data.signup_available
      : serverEnabled && signupEnabled && effectiveGroup !== '',
    // An older backend omits the setting; the netting section then stays hidden.
    nettingSupported: Object.prototype.hasOwnProperty.call(data, NETTING_DEMO_CONTRACT.responseGroupKey),
    nettingGroup,
    nettingValid: nettingGroup !== '' && data[NETTING_DEMO_CONTRACT.responseValidKey] === true,
    nettingDemoGroups: nettingDemoGroupsOf(data),
  };
};

/**
 * Body for POST DemoAccountGroupSet. Only the provided keys are sent:
 * `group` (string; '' or null clears it back to Automatic), `signupEnabled` (boolean) and/or
 * `nettingGroup` (string; '' or null switches netting demo accounts off).
 * Throws when none is provided.
 */
export const buildDemoAccountGroupSetBody = (changes) => {
  const c = changes && typeof changes === 'object' ? changes : {};
  const body = {};
  if (c.group !== undefined) body.group = asString(c.group);
  if (typeof c.signupEnabled === 'boolean') body.signup_enabled = c.signupEnabled;
  if (c.nettingGroup !== undefined) body[NETTING_DEMO_CONTRACT.requestKey] = asString(c.nettingGroup).trim();
  if (Object.keys(body).length === 0) {
    throw new Error('setDemoAccountGroup requires a group and/or signupEnabled (or nettingGroup).');
  }
  return body;
};

/** e.g. `demo\standard (USD, 1:100)`; omits missing parts. */
export const formatDemoGroupOptionLabel = (demoGroup) => {
  const name = asString(demoGroup?.name);
  const details = [];
  const currency = asString(demoGroup?.currency).trim();
  if (currency) details.push(currency);
  const leverage = toPositiveNumber(demoGroup?.leverage);
  if (leverage != null) details.push(`1:${leverage}`);
  return details.length ? `${name} (${details.join(', ')})` : name;
};

/**
 * Overall status line for the tab. The signup switches take precedence over the group state.
 * tone: 'ok' (configured & valid), 'info' (automatic default in use),
 * 'warning' (signup switched off by the admin or on the server),
 * 'error' (demo signup blocked/unavailable because of the group configuration).
 */
export const buildDemoGroupStatus = (state) => {
  const s = state || normalizeDemoAccountGroupState(null);
  if (!s.signupEnabled) return { tone: 'warning', message: DEMO_SIGNUP_DISABLED_MESSAGE };
  if (!s.serverEnabled) return { tone: 'warning', message: DEMO_SERVER_OFF_STATUS_MESSAGE };
  if (s.configured && s.group) {
    if (s.valid) return { tone: 'ok', message: `Current demo group: ${s.group}` };
    return {
      tone: 'error',
      message: `The configured group ${s.group} is missing, disabled or no longer a demo group — demo signup from the terminal is blocked until you pick a valid group.`,
    };
  }
  if (s.effectiveGroup) {
    return { tone: 'info', message: `Not set — using the automatic default: ${s.effectiveGroup}` };
  }
  if (s.demoGroups.length === 0) {
    return {
      tone: 'error',
      message: "No enabled demo group exists — demo signup is unavailable. Create a group with 'Demo Account' checked first.",
    };
  }
  return { tone: 'error', message: 'Not set — no automatic default is available, so demo signup is unavailable. Pick a demo group.' };
};

/** Prominent warning when the server master switch (PUBLIC_DEMO_ENABLED) is off; null otherwise. */
export const buildDemoServerWarning = (state) =>
  (state && state.serverEnabled === false ? DEMO_SERVER_DISABLED_WARNING : null);

/**
 * Options for the group <select>. The first option clears the setting (value '').
 * A configured group that is no longer a valid choice is kept as a disabled option so the
 * select still reflects the stored value.
 */
export const buildDemoGroupOptions = (state) => {
  const s = state || normalizeDemoAccountGroupState(null);
  const options = [{ value: '', label: AUTOMATIC_DEMO_GROUP_LABEL, disabled: false }];
  for (const g of s.demoGroups) options.push({ value: g.name, label: formatDemoGroupOptionLabel(g), disabled: false });
  if (s.configured && s.group && !s.demoGroups.some((g) => g.name === s.group)) {
    options.push({ value: s.group, label: `${s.group} (unavailable)`, disabled: true });
  }
  return options;
};

/** Value the select should start with: the configured group, or '' for automatic. */
export const initialDemoGroupSelection = (state) => (state?.configured && state.group ? state.group : '');

/** True when the selection differs from what is stored on the server. */
export const isDemoGroupSelectionChanged = (state, selected) =>
  asString(selected) !== initialDemoGroupSelection(state);

/**
 * Options for the netting demo group <select>: Off first (value ''), then netting demo groups only.
 * A stored group missing from the list stays selectable when the server reports it valid; otherwise it is
 * kept as a disabled "(unavailable)" option so the select still reflects the stored value.
 */
export const buildNettingDemoGroupOptions = (state) => {
  const s = state || normalizeDemoAccountGroupState(null);
  const options = [{ value: '', label: NETTING_DEMO_OFF_LABEL, disabled: false }];
  for (const g of s.nettingDemoGroups) options.push({ value: g.name, label: formatDemoGroupOptionLabel(g), disabled: false });
  if (s.nettingGroup && !s.nettingDemoGroups.some((g) => g.name === s.nettingGroup)) {
    options.push(s.nettingValid
      ? { value: s.nettingGroup, label: s.nettingGroup, disabled: false }
      : { value: s.nettingGroup, label: `${s.nettingGroup} (unavailable)`, disabled: true });
  }
  return options;
};

/** Status line for the netting demo group; same tones as buildDemoGroupStatus. */
export const buildNettingDemoGroupStatus = (state) => {
  const s = state || normalizeDemoAccountGroupState(null);
  if (s.nettingGroup) {
    if (s.nettingValid) return { tone: 'ok', message: `Netting demo group: ${s.nettingGroup}` };
    return {
      tone: 'error',
      message: `The netting demo group ${s.nettingGroup} is missing, disabled or no longer a netting demo group — netting demo signup from the terminal is blocked until you pick a valid group or switch it off.`,
    };
  }
  if (s.nettingDemoGroups.length === 0) {
    return { tone: 'info', message: "Netting demo accounts are off. No netting demo group can be selected — a demo group with margin mode 'Netting' is needed to offer them." };
  }
  return { tone: 'info', message: 'Netting demo accounts are off.' };
};

/** Value the netting select starts with: the stored group, or '' for off. */
export const initialNettingDemoGroupSelection = (state) => (state?.nettingGroup ? state.nettingGroup : '');

/** True when the netting selection differs from what is stored on the server. */
export const isNettingDemoGroupSelectionChanged = (state, selected) =>
  asString(selected) !== initialNettingDemoGroupSelection(state);
