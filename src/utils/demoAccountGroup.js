// Pure helpers for the Server Config > "Demo Accounts" tab (global demo account group).
// Backend contract: GET /manager/DemoAccountGroupGet, POST /manager/DemoAccountGroupSet.

export const AUTOMATIC_DEMO_GROUP_LABEL = 'Automatic (alphabetically first demo group)';

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
  return {
    brokerId: asString(data.broker_id),
    group,
    configured: data.configured === true || (data.configured == null && group !== ''),
    valid: data.valid === true,
    effectiveGroup: asString(data.effective_group).trim(),
    demoGroups,
  };
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
 * Status line for the current configuration.
 * tone: 'ok' (configured & valid), 'info' (automatic default in use), 'error' (demo signup blocked/unavailable).
 */
export const buildDemoGroupStatus = (state) => {
  const s = state || normalizeDemoAccountGroupState(null);
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
