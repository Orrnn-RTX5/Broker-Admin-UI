// C09 downstream (broker-as-LP) access administration client.
// Routes: manager-backend /api/v1/lp/downstream (gated by
// RTX5_C09_DOWNSTREAM_ADMIN_ENABLED=1, broker Admin session only).
//
// One-time credential exports are returned to the caller and never cached,
// stored or logged by this module. Revisions and logins are strings.
import {api} from '../lib/api.js';

const defaultRequest = async (path, options) => {
  try {
    const response = await api.request({
      url: path,
      method: options.method,
      data: options.body === undefined ? undefined : JSON.parse(options.body),
      _noRetry: true,
    });
    return {ok: true, status: response.status, json: async () => response.data};
  } catch (error) {
    if (!error.response) throw error;
    return {ok: false, status: error.response.status, json: async () => error.response.data};
  }
};

export const DOWNSTREAM_BASE = '/api/v1/lp/downstream';
export const DOWNSTREAM_ROLES = Object.freeze(['quote', 'trade']);
export const ACCEPTANCE_SYMBOLS = Object.freeze(['BTCUSD', 'EURUSD', 'XAUUSD']);
export const EMERGENCY_CONFIRM_TEXT = 'Emergency revoke stops new orders; open trades remain.';
export const EMERGENCY_REASON_MIN = 10;
export const EMERGENCY_REASON_MAX = 500;

// What the downstream owner admits today (C09 slice 3): B-book market create
// (FOK/IOC), full and partial close, and order status. Everything else is shown
// disabled as "not supported downstream".
export const DOWNSTREAM_SUPPORT = Object.freeze({
  quote: Object.freeze({operations: Object.freeze(['quote_subscribe']), unsupported: Object.freeze([])}),
  trade: Object.freeze({
    operations: Object.freeze(['create', 'close', 'partial_close', 'order_status']),
    unsupported: Object.freeze(['cancel', 'replace', 'close_by', 'set_protections', 'set_trailing', 'set_expiry']),
  }),
  orderTypes: Object.freeze(['market']),
  unsupportedOrderTypes: Object.freeze(['limit', 'stop', 'stop_limit']),
  policies: Object.freeze(['FOK', 'IOC']),
  unsupportedPolicies: Object.freeze(['GTC', 'GTD', 'DAY']),
});

const KNOWN_OPERATIONS = {
  quote: new Set(['quote_subscribe']),
  trade: new Set(['order_status', 'create', 'cancel', 'replace', 'close', 'partial_close', 'close_by', 'set_protections', 'set_trailing', 'set_expiry']),
};
const KNOWN_ORDER_TYPES = new Set(['market', 'limit', 'stop', 'stop_limit']);
const KNOWN_POLICIES = new Set(['FOK', 'IOC', 'GTC', 'GTD', 'DAY']);
const MAX_INT64 = 9223372036854775807n;

export const revisionOK = (value, allowZero = false) =>
  typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value) && BigInt(value) < MAX_INT64 && (allowZero || value !== '0');
export const accessIdOK = value => typeof value === 'string' && /^dsa_[a-z2-7]{26}$/.test(value);
export const counterpartyIdOK = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{1,62}$/.test(value);
export const sessionIdOK = value => typeof value === 'string' && /^RTXD[QT][A-Z2-7]{20}$/.test(value);
export const uuidOK = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
export const loginOK = value => typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) < MAX_INT64;
export const refOK = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value);
export const symbolOK = value => typeof value === 'string' && /^[A-Z0-9][A-Z0-9._/-]{0,31}$/.test(value);
export const roleOK = value => value === 'quote' || value === 'trade';
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;
const textOK = (value, max, required) =>
  typeof value === 'string' && (value === '' ? !required : value.length <= max && value.trim() === value && !CONTROL.test(value));
const SECRET_MARK = /rtxd1_/i;
const noSecret = value => !SECRET_MARK.test(JSON.stringify(value ?? null));

const invalid = message => {
  const error = new Error(message);
  error.code = 'INVALID_INPUT';
  return error;
};

const canonicalSymbols = (list, label) => {
  if (!Array.isArray(list)) throw invalid(`Select ${label} symbols.`);
  const out = [...new Set(list.map(value => String(value).trim().toUpperCase()))];
  if (!out.every(symbolOK)) throw invalid(`A ${label} symbol is not a valid instrument name.`);
  return out.sort();
};

const subset = (list, allowed, message) => {
  if (!Array.isArray(list)) throw invalid(message);
  const out = [...new Set(list)];
  if (!out.every(value => allowed.has(value))) throw invalid(message);
  return out.sort();
};

function scope(role, value, grantSymbols, strict) {
  const source = value || {};
  const allowedOps = strict ? new Set(DOWNSTREAM_SUPPORT[role].operations) : KNOWN_OPERATIONS[role];
  const operations = subset(source.operations || [], allowedOps, `Only supported ${role} operations can be granted.`);
  const symbols = canonicalSymbols(source.symbols || [], role);
  if (!symbols.every(symbol => grantSymbols.has(symbol))) throw invalid(`Every ${role} symbol must be one of the access symbols.`);
  const out = {enabled: source.enabled === true, operations, symbols};
  if (role === 'trade') {
    const orderTypes = subset(source.order_types || [], strict ? new Set(DOWNSTREAM_SUPPORT.orderTypes) : KNOWN_ORDER_TYPES, 'Only supported order types can be granted.');
    const policies = subset(source.policies || [], strict ? new Set(DOWNSTREAM_SUPPORT.policies) : KNOWN_POLICIES, 'Only supported fill policies can be granted.');
    const creates = operations.includes('create');
    if (creates !== (orderTypes.length > 0 && policies.length > 0)) {
      throw invalid('Order creation needs at least one order type and one fill policy, and order types or policies need order creation.');
    }
    if (orderTypes.length) out.order_types = orderTypes;
    if (policies.length) out.policies = policies;
  } else if ((source.order_types || []).length || (source.policies || []).length) {
    throw invalid('The quote role cannot carry order types or policies.');
  }
  if (out.enabled && (!operations.length || !symbols.length)) throw invalid(`An enabled ${role} role needs operations and symbols.`);
  return out;
}

// buildDraft validates the editable authority before it is sent. strict=true
// (the editor) limits choices to what the downstream owner supports today.
export function buildDraft(form, {strict = true} = {}) {
  const value = form || {};
  if (!counterpartyIdOK(value.counterparty_id)) throw invalid('Select a counterparty.');
  if (!uuidOK(value.coverage_account_id)) throw invalid('Enter the coverage account UUID (lowercase).');
  if (!loginOK(value.coverage_login)) throw invalid('Enter the coverage account login.');
  if (!refOK(value.group_id)) throw invalid('Resolve the coverage account group.');
  if (!refOK(value.feed_connection_id) || !revisionOK(value.feed_selection_revision)) throw invalid('Resolve the coverage account feed selection.');
  if (value.account_mode !== 'hedging' && value.account_mode !== 'netting') throw invalid('Select the coverage account mode.');
  const route = value.route || {kind: 'bbook'};
  if (strict && route.kind !== 'bbook') throw invalid('Downstream access supports the B-book route only.');
  let routeOut;
  if (route.kind === 'bbook' && !route.rule_id && (route.rule_revision === undefined || route.rule_revision === '' || route.rule_revision === '0')) {
    routeOut = {kind: 'bbook'};
  } else if (route.kind === 'external' && refOK(route.rule_id) && revisionOK(route.rule_revision)) {
    routeOut = {kind: 'external', rule_id: route.rule_id, rule_revision: route.rule_revision};
  } else {
    throw invalid('The route is not valid.');
  }
  if (!textOK(value.label ?? '', 120, false)) throw invalid('The label must be at most 120 characters without leading or trailing spaces.');
  const symbols = canonicalSymbols(value.symbols || [], 'access');
  if (!symbols.length) throw invalid('Select at least one access symbol.');
  const grantSymbols = new Set(symbols);
  const draft = {
    counterparty_id: value.counterparty_id,
    coverage_account_id: value.coverage_account_id,
    coverage_login: value.coverage_login,
    group_id: value.group_id,
    feed_connection_id: value.feed_connection_id,
    feed_selection_revision: value.feed_selection_revision,
    account_mode: value.account_mode,
    route: routeOut,
    symbols,
    quote: scope('quote', value.quote, grantSymbols, strict),
    trade: scope('trade', value.trade, grantSymbols, strict),
  };
  if (value.label) draft.label = value.label;
  return draft;
}

// draftFromAuthority re-sends a saved authority unchanged (enable/disable). It
// keeps only the known Draft fields and does not narrow to supported options.
export const draftFromAuthority = authority => buildDraft(authority, {strict: false});

export function validateCounterparty(value) {
  if (!value || !counterpartyIdOK(value.counterparty_id) || !textOK(value.display_name, 120, true) ||
    (value.status !== 'active' && value.status !== 'suspended') || !revisionOK(value.revision)) {
    throw new Error('Invalid counterparty response.');
  }
  return {counterparty_id: value.counterparty_id, display_name: value.display_name, status: value.status, revision: value.revision};
}

const validCredential = value => value && revisionOK(value.revision, true) && ['none', 'active', 'retired'].includes(value.state) &&
  (value.emergency_revoked === undefined || typeof value.emergency_revoked === 'boolean');

export function validateGrant(value) {
  const a = value?.authority;
  if (!value || !accessIdOK(value.access_id) || !revisionOK(value.revision) || typeof value.enabled !== 'boolean' || !a ||
    !counterpartyIdOK(a.counterparty_id) || !uuidOK(a.coverage_account_id) || !loginOK(a.coverage_login) ||
    !Array.isArray(a.symbols) || !a.quote || !a.trade || typeof value.application_state !== 'string') {
    throw new Error('Invalid downstream access response.');
  }
  for (const role of DOWNSTREAM_ROLES) {
    const session = value[role + '_session'];
    if (!session || session.role !== role || !sessionIdOK(session.session_id) || !validCredential(value[role + '_credential'])) {
      throw new Error('Invalid downstream session or credential status.');
    }
  }
  if (!noSecret(value)) throw new Error('A downstream access read must never carry credential material.');
  return value;
}

const ENDPOINT_FIELDS = ['begin_string', 'host', 'port', 'tls_mode', 'certificate_sha256', 'sender_comp_id', 'target_comp_id', 'username', 'heartbeat_seconds', 'reset_seq_num_flag', 'sequence_policy', 'listener_observed_at'];

// validateProfile returns endpoint fields only for an available profile.
export function validateProfile(value, access, role) {
  if (!value || typeof value.status !== 'string' || value.access_id !== access || value.role !== role ||
    typeof value.connection !== 'string' || typeof value.verification !== 'string') {
    throw new Error('Invalid connection profile response.');
  }
  if (!noSecret(value)) throw new Error('A connection profile must never carry credential material.');
  const out = {
    status: value.status, access_id: value.access_id, role: value.role,
    credential_state: value.credential_state || 'none', credential_revision: value.credential_revision || '0',
    applied: value.applied === true, connection: value.connection, verification: value.verification,
  };
  if (value.status === 'available') {
    if (!textOK(value.host, 255, true) || !Number.isSafeInteger(value.port) || value.port < 1 || value.port > 65535 ||
      value.tls_mode !== 'tls' || !sessionIdOK(value.sender_comp_id) || !textOK(value.target_comp_id, 64, true)) {
      throw new Error('Invalid available connection profile.');
    }
    for (const key of ENDPOINT_FIELDS) if (value[key] !== undefined) out[key] = value[key];
  }
  return out;
}

export function validateHistory(value) {
  if (!value || !Array.isArray(value.revisions) || !Array.isArray(value.audit)) throw new Error('Invalid history response.');
  for (const row of value.revisions) {
    if (!revisionOK(row?.revision) || typeof row.change_class !== 'string' || typeof row.actor !== 'string' || typeof row.created_at !== 'string') {
      throw new Error('Invalid history revision.');
    }
  }
  for (const row of value.audit) {
    if (!revisionOK(row?.id) || typeof row.action !== 'string' || typeof row.outcome !== 'string' || typeof row.actor !== 'string' || typeof row.created_at !== 'string') {
      throw new Error('Invalid history audit row.');
    }
  }
  if (!noSecret(value)) throw new Error('History must never carry credential material.');
  return value;
}

// validateExport checks the one-time issue response. The returned object is
// the only copy this module ever holds; it is not cached.
export function validateExport(value, access, role) {
  const e = value?.export;
  if (!value || !revisionOK(value.grant_revision) || !e || e.access_id !== access || e.role !== role ||
    !sessionIdOK(e.sender_comp_id) || e.username !== e.sender_comp_id || typeof e.password !== 'string' ||
    !/^rtxd1_[A-Za-z0-9_-]{43}$/.test(e.password) || !revisionOK(e.credential_revision) || typeof e.profile_status !== 'string') {
    throw new Error('Invalid credential export response.');
  }
  const profile = validateProfile(e.profile, access, role);
  if (profile.status !== e.profile_status) throw new Error('Credential export profile status mismatch.');
  return {
    grant_revision: value.grant_revision,
    export: {
      access_id: e.access_id, role: e.role, sender_comp_id: e.sender_comp_id, username: e.username, password: e.password,
      credential_revision: e.credential_revision, profile_status: e.profile_status, profile,
    },
  };
}

const USE_KEYS = ['open_positions', 'pending_orders', 'unresolved_commands', 'configuration_uses'];

export function validateEmergency(value, access, role) {
  if (!value || value.role !== role || !sessionIdOK(value.session_id) || !revisionOK(value.credential_revision) ||
    typeof value.reason !== 'string' || typeof value.open_trades_remain !== 'boolean' || typeof value.session_cut !== 'string' ||
    !value.active_use || !USE_KEYS.every(key => revisionOK(value.active_use[key], true))) {
    throw new Error('Invalid emergency revocation response.');
  }
  const grant = validateGrant(value.grant);
  const credential = grant[role + '_credential'];
  if (grant.access_id !== access || credential.state === 'active') throw new Error('Emergency revocation was not confirmed.');
  return {
    grant, role, session_id: value.session_id, credential_revision: value.credential_revision,
    active_use: Object.fromEntries(USE_KEYS.map(key => [key, value.active_use[key]])),
    open_trades_remain: value.open_trades_remain, session_cut: value.session_cut,
    // The credential is retired at commit: logon and new orders are refused.
    new_orders_stopped: true,
  };
}

export function emergencyReasonError(reason) {
  if (typeof reason !== 'string') return 'Enter a reason.';
  const length = [...reason].length;
  if (length < EMERGENCY_REASON_MIN || length > EMERGENCY_REASON_MAX) return `The reason must be ${EMERGENCY_REASON_MIN} to ${EMERGENCY_REASON_MAX} characters.`;
  if (reason.trim() !== reason || CONTROL.test(reason)) return 'The reason must not start or end with spaces or contain control characters.';
  if (SECRET_MARK.test(reason)) return 'Do not paste credential material into the reason.';
  return '';
}

export const DOWNSTREAM_MESSAGES = Object.freeze({
  DOWNSTREAM_ACCESS_IN_USE: 'Trading is running on the coverage account, so this change is locked. Emergency revoke remains available.',
  STALE_REVISION: 'This access changed since it was loaded. Reload and review before saving.',
  EXPORT_CONSUMED: 'This issue request was already used. The secret cannot be shown again; rotate to issue a new credential.',
  REFERENCE_INVALID: 'A referenced account, group, symbol or route is not valid for downstream access.',
  REFERENCE_CHANGED: 'The coverage account, group, mode, feed selection or route changed. Resolve the references again and review.',
  IDENTITY_IMMUTABLE: 'Counterparty and coverage account cannot change on an existing access. Create a new access instead.',
  ALREADY_EXISTS: 'An access already exists for this counterparty and coverage account.',
  NOT_FOUND: 'The downstream access or counterparty was not found.',
  FORBIDDEN: 'Only the broker Admin can manage downstream access.',
  NOT_AUTHENTICATED: 'Your session ended. Sign in again.',
  INVALID_REQUEST: 'The request was refused as invalid. Check the fields and the revision.',
  EMERGENCY_REASON_REQUIRED: `Enter a reason of ${EMERGENCY_REASON_MIN} to ${EMERGENCY_REASON_MAX} characters without credential material.`,
  STORAGE_UNAVAILABLE: 'Downstream access storage is unavailable. Nothing was changed by this screen.',
  DOWNSTREAM_ADMIN_UNAVAILABLE: 'Downstream access administration is not enabled on this server.',
});

const IN_USE_REASONS = {
  open_positions: 'open positions',
  pending_orders: 'pending orders',
  unresolved_commands: 'unresolved commands',
  configuration_uses: 'configuration uses',
};
export const inUseReasonLabel = reason => IN_USE_REASONS[reason] || String(reason);

export function downstreamError(status, body) {
  const code = typeof body?.code === 'string' ? body.code : (typeof body?.error_code === 'string' ? body.error_code : '');
  const effective = code || (status === 404 ? 'DOWNSTREAM_ADMIN_UNAVAILABLE' : '');
  const error = new Error(DOWNSTREAM_MESSAGES[effective] || 'The downstream access request failed.');
  error.code = effective || 'DOWNSTREAM_REQUEST_FAILED';
  error.status = status;
  if (effective === 'DOWNSTREAM_ACCESS_IN_USE') {
    error.changeClass = typeof body?.class === 'string' ? body.class : '';
    error.reasons = Array.isArray(body?.reasons) ? body.reasons.filter(reason => typeof reason === 'string') : [];
  }
  if (effective === 'REFERENCE_INVALID' && Array.isArray(body?.reasons)) {
    error.reasons = body.reasons.filter(reason => typeof reason === 'string');
  }
  return error;
}

export const newRequestId = () => {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const accessPath = access => {
  if (!accessIdOK(access)) throw invalid('Select a saved downstream access.');
  return `${DOWNSTREAM_BASE}/access/${access}`;
};
const rolePath = role => {
  if (!roleOK(role)) throw invalid('Select the quote or trade role.');
  return role;
};
const expected = (value, allowZero = false) => {
  if (!revisionOK(value, allowZero)) throw invalid('Reload the saved revision before changing it.');
  return value;
};

export function createLPDownstreamAPI(request = defaultRequest) {
  const call = async (path, method = 'GET', payload) => {
    let response;
    try {
      response = await request(path, {method, ...(payload === undefined ? {} : {headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)})});
    } catch {
      const error = new Error('The downstream access request did not reach the server. Reload before retrying.');
      error.code = 'NETWORK';
      throw error;
    }
    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok) throw downstreamError(response.status, data);
    if (data === null || typeof data !== 'object') throw new Error('Invalid downstream access response.');
    return data;
  };
  return {
    counterparties: async () => {
      const value = await call(`${DOWNSTREAM_BASE}/counterparties`);
      if (!Array.isArray(value.counterparties)) throw new Error('Invalid counterparty list.');
      return value.counterparties.map(validateCounterparty);
    },
    saveCounterparty: async (id, {display_name, status, expected_revision}) => {
      if (!counterpartyIdOK(id)) throw invalid('Counterparty IDs use 2-63 lowercase letters, digits, "_" or "-".');
      if (!textOK(display_name, 120, true)) throw invalid('Enter a display name of at most 120 characters.');
      if (status !== 'active' && status !== 'suspended') throw invalid('Select the counterparty status.');
      const body = {display_name, status, expected_revision: expected(expected_revision, true)};
      return validateCounterparty(await call(`${DOWNSTREAM_BASE}/counterparties/${id}`, 'PUT', body));
    },
    grants: async () => {
      const value = await call(`${DOWNSTREAM_BASE}/access`);
      if (!Array.isArray(value.access)) throw new Error('Invalid downstream access list.');
      return value.access.map(validateGrant);
    },
    createGrant: async ({draft}) => validateGrant(await call(`${DOWNSTREAM_BASE}/access`, 'POST', {draft: buildDraft(draft)})),
    grant: async access => validateGrant(await call(accessPath(access))),
    updateGrant: async (access, {draft, enabled, expected_revision, strict = true}) => {
      if (typeof enabled !== 'boolean') throw invalid('Choose whether the access is enabled.');
      const body = {draft: buildDraft(draft, {strict}), enabled, expected_revision: expected(expected_revision)};
      return validateGrant(await call(accessPath(access), 'PUT', body));
    },
    history: async access => validateHistory(await call(accessPath(access) + '/history')),
    profile: async (access, role) => validateProfile(await call(`${accessPath(access)}/profiles/${rolePath(role)}`), access, role),
    issue: async (access, role, {request_id, expected_revision}) => {
      if (!uuidOK(request_id)) throw invalid('The issue request ID is invalid.');
      const body = {request_id, expected_revision: expected(expected_revision)};
      return validateExport(await call(`${accessPath(access)}/credentials/${rolePath(role)}`, 'POST', body), access, role);
    },
    revoke: async (access, role, {expected_revision}) => {
      const body = {expected_revision: expected(expected_revision)};
      return validateGrant(await call(`${accessPath(access)}/credentials/${rolePath(role)}`, 'DELETE', body));
    },
    emergencyRevoke: async (access, role, {expected_revision, reason}) => {
      const problem = emergencyReasonError(reason);
      if (problem) throw invalid(problem);
      const body = {expected_revision: expected(expected_revision), reason};
      return validateEmergency(await call(`${accessPath(access)}/credentials/${rolePath(role)}/emergency-revoke`, 'POST', body), access, role);
    },
  };
}

export const lpDownstream = createLPDownstreamAPI();
