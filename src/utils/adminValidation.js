const GROUP_ITEM_RE = /^[A-Za-z0-9_*./:-]+$/;

export const canGrantAdminRole = (user) =>
  !!(user?.is_admin || user?.role === 'admin');

export const parseCsvList = (value = '') =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const parseNumber = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${label} must be a valid number.`);
  }
  return number;
};

export const parsePositiveInteger = (value, label) => {
  const number = parseNumber(value, label);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${label} must be a positive whole number.`);
  }
  return number;
};

export const parseNonNegativeNumber = (value, label) => {
  const number = parseNumber(value, label);
  if (number < 0) {
    throw new Error(`${label} cannot be negative.`);
  }
  return number;
};

export const parseNonNegativeInteger = (value, label) => {
  const number = parseNonNegativeNumber(value, label);
  if (!Number.isInteger(number)) {
    throw new Error(`${label} must be a whole number.`);
  }
  return number;
};

export const parseOptionalNonNegativeNumber = (value, label) => {
  if (value === '' || value === null || value === undefined) return undefined;
  return parseNonNegativeNumber(value, label);
};

// Defence-in-depth validation for money fields on deposit/withdrawal/credit
// payment paths (admin-ui-F04). The backend remains the authority; this only
// stops obviously-bad client input (negatives, NaN, "100abc", unbounded values)
// from ever leaving the terminal and rounds to 2 decimal places to avoid
// sending sub-cent float noise. Returns a positive, finite, 2-dp number.
const MAX_MONEY_AMOUNT = 1_000_000_000; // 1e9 hard cap, matches reviewer note

export const parseMoneyAmount = (value, label = 'Amount') => {
  // Reject trailing-garbage like "100abc" that parseFloat would silently accept.
  const raw = String(value ?? '').trim();
  if (raw === '') {
    throw new Error(`${label} is required.`);
  }
  if (!/^\d*\.?\d+$/.test(raw)) {
    throw new Error(`${label} must be a valid amount.`);
  }

  const number = Number(raw);
  if (!Number.isFinite(number)) {
    throw new Error(`${label} must be a valid amount.`);
  }
  if (number <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
  if (number > MAX_MONEY_AMOUNT) {
    throw new Error(`${label} exceeds the maximum allowed.`);
  }

  // Round to 2 decimal places (money precision).
  return Math.round(number * 100) / 100;
};

const isValidIpv4OrCidr = (value) => {
  if (value === '*') return true;

  const [ip, cidr] = value.split('/');
  const parts = ip.split('.');
  if (parts.length !== 4) return false;

  const validIp = parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const octet = Number(part);
    return octet >= 0 && octet <= 255;
  });
  if (!validIp) return false;

  if (cidr === undefined) return true;
  if (!/^\d+$/.test(cidr)) return false;
  const mask = Number(cidr);
  return mask >= 0 && mask <= 32;
};

export const validateManagerLists = ({ allowedGroups = '', ipWhitelist = '' }) => {
  const allowed_groups = parseCsvList(allowedGroups);
  const ip_whitelist = parseCsvList(ipWhitelist);

  const invalidGroup = allowed_groups.find((group) => !GROUP_ITEM_RE.test(group));
  if (invalidGroup) {
    throw new Error(`Allowed group "${invalidGroup}" contains unsupported characters.`);
  }

  const invalidIp = ip_whitelist.find((entry) => !isValidIpv4OrCidr(entry));
  if (invalidIp) {
    throw new Error(`IP whitelist entry "${invalidIp}" must be IPv4 or IPv4/CIDR.`);
  }

  return { allowed_groups, ip_whitelist };
};

// ManagerUpdate POST body from the Edit Manager form, keyed as the backend's
// JSON contract names them. Lists are always sent so clearing a field clears
// it; an empty list goes as [''] (a present-but-blank list). role_id is sent
// only when it changed, as an integer (0 removes the role).
export const buildManagerUpdateParams = (form, original = {}) => {
  const name = String(form.name || '').trim();
  if (!name) throw new Error('Name is required.');

  const { allowed_groups, ip_whitelist } = validateManagerLists({
    allowedGroups: form.allowed_groups,
    ipWhitelist: form.ip_whitelist,
  });

  const params = {
    name,
    enabled: Boolean(form.enabled),
    'allowed_groups[]': allowed_groups.length ? allowed_groups : [''],
    'ip_whitelist[]': ip_whitelist.length ? ip_whitelist : [''],
  };

  const roleId = String(form.role_id ?? '');
  const originalRoleId = String(original.role_id ?? '');
  if (roleId !== originalRoleId) params.role_id = roleId ? parsePositiveInteger(roleId, 'Role') : 0;

  return params;
};

// Same bounds the backend enforces (bcrypt ignores bytes past 72).
export const validateManagerPassword = (password = '', confirm = '') => {
  if (password.length < 12 || password.length > 72) {
    throw new Error('Password must be 12 to 72 characters.');
  }
  if (password !== confirm) {
    throw new Error('Passwords do not match.');
  }
  return password;
};

export const buildManagerCreatePayload = (form, options = {}) => {
  const {
    requireRole = false,
    includeEmptyLists = false,
    canGrantAdmin = false,
  } = options;

  const login = parsePositiveInteger(form.login, 'Login');
  const name = String(form.name || '').trim();
  const password = String(form.password || '');
  if (!name) throw new Error('Name is required.');
  if (!password) throw new Error('Password is required.');

  const roleId = form.role_id || form.roleId || '';
  if (requireRole && !roleId) {
    throw new Error('Role is required.');
  }

  if (form.is_admin && !canGrantAdmin) {
    throw new Error('Only an admin session can create another admin manager.');
  }

  const { allowed_groups, ip_whitelist } = validateManagerLists({
    allowedGroups: form.allowed_groups ?? form.allowedGroups,
    ipWhitelist: form.ip_whitelist ?? form.ipWhitelist,
  });

  const payload = {
    login,
    name,
    password,
    is_admin: !!form.is_admin && canGrantAdmin,
  };

  if (roleId) payload.role_id = parsePositiveInteger(roleId, 'Role');
  if (includeEmptyLists || allowed_groups.length) payload.allowed_groups = allowed_groups;
  if (includeEmptyLists || ip_whitelist.length) payload.ip_whitelist = ip_whitelist;

  return payload;
};

export const buildGroupRiskPayload = (formData) => ({
  ...formData,
  commissionRate: parseNonNegativeNumber(formData.commissionRate, 'Commission rate'),
  leverage: parsePositiveInteger(formData.leverage, 'Leverage'),
  lotDivisor: parsePositiveInteger(formData.lotDivisor, 'Lot divisor'),
  marginCallLevel: parseNonNegativeNumber(formData.marginCallLevel, 'Margin call level'),
  maxLotPerTrade: parseNonNegativeNumber(formData.maxLotPerTrade, 'Max lot per trade'),
  maxTotalLots: parseNonNegativeNumber(formData.maxTotalLots, 'Max total lots'),
  spreadMarkup: parseNonNegativeNumber(formData.spreadMarkup, 'Spread markup'),
  stopOutLevel: parseNonNegativeNumber(formData.stopOutLevel, 'Stop out level'),
  swapMultiplier: parseNonNegativeNumber(formData.swapMultiplier, 'Swap multiplier'),
  symbolsAllowed: parseCsvList(formData.symbolsAllowed),
  symbolsBlocked: parseCsvList(formData.symbolsBlocked),
});

export const buildDynamicLeveragePayload = (formData) => {
  const volume_from = parseNonNegativeNumber(formData.volume_from, 'Volume from');
  const volume_to = parseNonNegativeNumber(formData.volume_to, 'Volume to');
  if (volume_to < volume_from) {
    throw new Error('Volume to must be greater than or equal to volume from.');
  }

  return {
    ...formData,
    leverage: parsePositiveInteger(formData.leverage, 'Leverage'),
    margin_rate: parseNonNegativeNumber(formData.margin_rate, 'Margin rate'),
    priority: parseNonNegativeInteger(formData.priority, 'Priority'),
    volume_from,
    volume_to,
  };
};

export const buildRiskLimitPayload = (form) => {
  if (form.scope_type !== 'global' && !String(form.scope_value || '').trim()) {
    throw new Error('Scope value is required for account, group, and symbol limits.');
  }

  return {
    ...form,
    scope_value: String(form.scope_value || '').trim(),
    limit_value: parseNonNegativeNumber(form.limit_value, 'Limit value'),
    alert_threshold: parseOptionalNonNegativeNumber(form.alert_threshold, 'Alert threshold'),
  };
};

export const validateDispatchDelay = (value) =>
  parseNonNegativeInteger(value, 'Dispatch delay');

export const validateHiddenMarkup = (value) =>
  parseNonNegativeNumber(value, 'Hidden markup');

export const buildMarketDepthPayload = (config, fallbackSymbol = '') => ({
  symbol: config.symbol || fallbackSymbol.trim(),
  aggregation: config.aggregation,
  depth_levels: parseNonNegativeInteger(config.depth_levels, 'Depth levels'),
  enabled: Boolean(config.enabled),
  spread_markup: parseNonNegativeNumber(config.spread_markup, 'Spread markup'),
  volume_filter: parseNonNegativeNumber(config.volume_filter, 'Volume filter'),
});

export const validateLpRouteForm = (form) => {
  const numericFields = [
    ['priority', 'Priority', true],
    ['max_volume', 'Max volume', false],
    ['rule_min_volume', 'Rule min volume', false],
    ['rule_max_volume', 'Rule max volume', false],
    ['markup_send_lp_min', 'Send to LP after min', true],
    ['markup_send_lp_max', 'Send to LP after max', true],
    ['markup_min_market', 'Min market markup', false],
    ['markup_max_market', 'Max market markup', false],
    ['markup_min_limit', 'Min limit markup', false],
    ['markup_max_limit', 'Max limit markup', false],
  ];

  numericFields.forEach(([key, label, integer]) => {
    if (integer) {
      parseNonNegativeInteger(form[key], label);
    } else {
      parseNonNegativeNumber(form[key], label);
    }
  });

  if (Number(form.rule_max_volume) < Number(form.rule_min_volume)) {
    throw new Error('Rule max volume must be greater than or equal to rule min volume.');
  }
  if (Number(form.markup_send_lp_max) < Number(form.markup_send_lp_min)) {
    throw new Error('Send to LP max must be greater than or equal to min.');
  }
  if (Number(form.markup_max_market) < Number(form.markup_min_market)) {
    throw new Error('Max market markup must be greater than or equal to min market markup.');
  }
  if (Number(form.markup_max_limit) < Number(form.markup_min_limit)) {
    throw new Error('Max limit markup must be greater than or equal to min limit markup.');
  }

  // Coerce every validated numeric field on return so the backend never receives
  // string-typed numerics (admin-ui-N3-01). Keys mirror the numericFields list above.
  const coerced = {};
  numericFields.forEach(([key]) => {
    coerced[key] = Number(form[key]);
  });

  return {
    ...form,
    ...coerced,
  };
};

