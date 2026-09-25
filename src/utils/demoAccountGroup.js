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

const asString = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));

const toPositiveNumber = (value) => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Normalizes the DemoAccountGroupGet response into a stable shape. */
export const normalizeDemoAccountGroupState = (raw) => {
  const data = raw && typeof raw === 'object' ? raw : {};
  const group = asString(data.group).trim();
  const demoGroups = (Array.isArray(data.demo_groups) ? data.demo_groups : [])
    .filter((g) => g && typeof g === 'object' && asString(g.name).trim())
    .map((g) => ({
      name: asString(g.name).trim(),
      description: asString(g.description),
      currency: asString(g.currency).trim(),
      leverage: toPositiveNumber(g.leverage),
    }));
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
  };
};

/**
 * Body for POST DemoAccountGroupSet. Only the provided keys are sent:
 * `group` (string; '' or null clears it back to Automatic) and/or `signupEnabled` (boolean).
 * Throws when neither is provided.
 */
export const buildDemoAccountGroupSetBody = (changes) => {
  const c = changes && typeof changes === 'object' ? changes : {};
  const body = {};
  if (c.group !== undefined) body.group = asString(c.group);
  if (typeof c.signupEnabled === 'boolean') body.signup_enabled = c.signupEnabled;
  if (Object.keys(body).length === 0) {
    throw new Error('setDemoAccountGroup requires a group and/or signupEnabled.');
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
