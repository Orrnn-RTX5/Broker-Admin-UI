// Pure helpers for the legacy group / account / commission editors after
// R15/R17 gap G8 (manager-backend expected_revision compare-and-swap,
// active-trade locks and actor audit):
//   - revision plumbing: read a revision from a response and add
//     expected_revision to a write only when one is known (older backends
//     return none; the write then stays a legacy blind write),
//   - error reading: CONFIGURATION_REVISION_CONFLICT, CONFIGURATION_IN_USE
//     (with per-reason lock details) and CONFIGURATION_REVISION_REQUIRED,
//   - account trading (leverage, account mode), customer account creation
//     and funding request validation.

export const CONFIG_ERROR_CODES = Object.freeze({
  conflict: 'CONFIGURATION_REVISION_CONFLICT',
  inUse: 'CONFIGURATION_IN_USE',
  required: 'CONFIGURATION_REVISION_REQUIRED',
});

export const ACCOUNT_MODE_OPTIONS = Object.freeze([
  { value: 'hedging', label: 'Hedging' },
  { value: 'netting', label: 'Netting' },
]);

/**
 * The options the account CREATE wizard renders. Netting is shown but DISABLED:
 * the default B-book RAM engine cannot open netting accounts, so a netting
 * account would be stranded (cannot deposit or trade). Hedging stays the
 * default. The edit popup keeps ACCOUNT_MODE_OPTIONS (its mode is read-only).
 */
export const ACCOUNT_MODE_CREATE_OPTIONS = Object.freeze([
  { value: 'hedging', label: 'Hedging', disabled: false },
  { value: 'netting', label: 'Netting — not supported yet', disabled: true },
]);

export const LEVERAGE_MIN = 1;
export const LEVERAGE_MAX = 10000;

const REVISION_RE = /^lcr1:[0-9a-f]{24}$/;

const hasText = (value) => typeof value === 'string' && value.trim() !== '';

/** The revision in a read or write response, or '' when the backend sent none. */
export const readRevision = (response) => {
  const value = response?.revision;
  return hasText(value) && REVISION_RE.test(value.trim()) ? value.trim() : '';
};

/**
 * Adds expected_revision to a write body when the revision is known. An
 * unknown revision (older backend) leaves the body unchanged so the running
 * backend keeps accepting the legacy write.
 */
export const withExpectedRevision = (payload, revision) => (
  hasText(revision) ? { ...payload, expected_revision: revision.trim() } : { ...payload }
);

const LOCK_REASON_LABELS = {
  open_positions: 'open position',
  pending_orders: 'pending order',
  in_flight_commands: 'in-flight order command',
  lp_use_in_flight: 'LP order in flight',
  lp_use_pending: 'LP pending order',
  lp_use_open: 'LP-covered open position',
  lp_use_unknown: 'LP order with unknown outcome',
  lp_use_exposure: 'unreleased LP exposure',
};

/** "2 open positions (EURUSD) on 1001, 1002" for one lock_reasons entry. */
export const describeLockReason = (reason) => {
  const count = Number(reason?.count) || 0;
  const base = LOCK_REASON_LABELS[reason?.reason] || String(reason?.reason || 'active use').replace(/_/g, ' ');
  const label = count === 1 ? base : `${base}s`;
  const symbols = Array.isArray(reason?.symbols) && reason.symbols.length ? ` (${reason.symbols.join(', ')})` : '';
  const logins = Array.isArray(reason?.logins) && reason.logins.length ? ` on ${reason.logins.join(', ')}` : '';
  return `${count} ${label}${symbols}${logins}`;
};

/**
 * Normalizes an axios-style error from a guarded write. Returns
 * { status, code, message, currentRevision, lockReasons, kind } where kind is
 * 'conflict' | 'in_use' | 'required' | 'other'.
 */
export const readConfigError = (error, fallback = 'Request failed.') => {
  const data = error?.response?.data;
  const status = Number(error?.response?.status) || 0;
  const code = String(data?.error_code || data?.code || '');
  const serverMessage = typeof data === 'string' ? data.trim() : (hasText(data?.message) ? data.message.trim() : '');
  const lockReasons = Array.isArray(data?.lock_reasons) ? data.lock_reasons : [];
  let kind = 'other';
  let message = serverMessage || error?.message || fallback;
  if (code === CONFIG_ERROR_CODES.conflict) {
    kind = 'conflict';
    message = 'Someone else changed this configuration after you opened it. Reload it, check the current values and apply your change again.';
  } else if (code === CONFIG_ERROR_CODES.inUse) {
    kind = 'in_use';
    message = serverMessage || 'The change affects accounts that are trading right now.';
  } else if (code === CONFIG_ERROR_CODES.required) {
    kind = 'required';
    message = 'This change needs the current configuration revision. Reload and try again.';
  }
  return {
    status,
    code,
    kind,
    message,
    currentRevision: hasText(data?.current_revision) ? data.current_revision : '',
    lockReasons,
    lockDetails: lockReasons.map(describeLockReason),
  };
};

/**
 * "Group leverage is in use by trading accounts: 2 open positions (EURUSD) on
 * 1001, 1002; 1 pending order on 1003." The server sentence loses its own
 * closing punctuation so the lock details read as its continuation.
 */
export const joinLockDetails = (message, lockDetails) => {
  const lead = String(message || '').trim().replace(/[\s.;:,!?]+$/, '');
  const details = lockDetails.join('; ');
  return lead ? `${lead}: ${details}.` : `${details}.`;
};

/** One-line text for a toast or inline error. */
export const describeConfigError = (error, fallback) => {
  const parsed = readConfigError(error, fallback);
  if (parsed.kind === 'in_use' && parsed.lockDetails.length && !parsed.message.includes('in use (')) {
    return joinLockDetails(parsed.message, parsed.lockDetails);
  }
  return parsed.message;
};

const pick = (source, keys, fallback = '') => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
};

/** UserDetails -> the editable trading configuration of one account. */
export const normalizeAccountConfig = (user) => ({
  login: String(pick(user, ['login', 'Login'], '')),
  group: String(pick(user, ['Group', 'group'], '')),
  currency: String(pick(user, ['Currency', 'currency'], '')),
  leverage: String(pick(user, ['Leverage', 'leverage'], '')),
  accountMode: String(pick(user, ['AccountMode', 'account_mode', 'accountMode'], 'hedging')).toLowerCase(),
  revision: readRevision(user),
});

const parseLeverage = (value) => {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return { error: `Leverage must be a whole number from ${LEVERAGE_MIN} to ${LEVERAGE_MAX}.` };
  const n = Number(text);
  if (n < LEVERAGE_MIN || n > LEVERAGE_MAX) return { error: `Leverage must be a whole number from ${LEVERAGE_MIN} to ${LEVERAGE_MAX}.` };
  return { value: n };
};

/**
 * The PATCH /api/v1/manager/accounts/{login} body for the trading section:
 * only effectively changed fields. Returns { changes, errors }.
 */
export const buildAccountTradingChanges = (original, form) => {
  const errors = {};
  const changes = {};
  // An untouched field is never validated, so a profile-only save works even
  // when the stored value could not be read.
  const leverageText = String(form?.leverage ?? '').trim();
  if (leverageText !== String(original?.leverage ?? '').trim()) {
    const leverage = parseLeverage(leverageText);
    if (leverage.error) errors.leverage = leverage.error;
    else if (String(leverage.value) !== String(original?.leverage ?? '').trim()) changes.leverage = leverage.value;
  }
  const mode = String(form?.accountMode ?? '').trim().toLowerCase();
  const storedMode = String(original?.accountMode || 'hedging').toLowerCase();
  if (mode !== storedMode) errors.accountMode = 'Account mode is fixed at creation and cannot be changed.';
  return { changes: Object.keys(errors).length ? {} : changes, errors };
};

/** Validated group leverage change for GroupUpdate ({} when unchanged). */
export const buildGroupLeverageChange = (initial, value) => {
  const parsed = parseLeverage(value);
  if (parsed.error) return { changes: {}, error: parsed.error };
  return {
    changes: String(parsed.value) === String(initial ?? '').trim() ? {} : { leverage: parsed.value },
    error: '',
  };
};

const GROUP_CURRENCY_KEYS = ['currency', 'Currency', 'depositCurrency', 'deposit_currency'];
const GROUP_LEVERAGE_KEYS = ['leverage', 'Leverage', 'defaultLeverage', 'default_leverage'];
const CURRENCY_RE = /^[A-Z]{3}$/;

/**
 * Live group currency from a GroupGet / GroupList record, uppercased.
 * Returns '' when the group does not name a valid 3-letter currency, so the
 * caller forces explicit operator input instead of inventing one. No
 * tenant/group-specific fallback belongs here: every present and future group
 * supplies its own currency.
 */
export const readGroupCurrency = (group) => {
  const raw = pick(group, GROUP_CURRENCY_KEYS, '');
  const currency = String(raw ?? '').trim().toUpperCase();
  return CURRENCY_RE.test(currency) ? currency : '';
};

/**
 * Live group leverage from a GroupGet / GroupList record, as the form string.
 * Returns '' when the group does not name a valid leverage, so the account
 * form stays blank and validation requires an explicit value.
 */
export const readGroupLeverage = (group) => {
  const raw = pick(group, GROUP_LEVERAGE_KEYS, '');
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const parsed = parseLeverage(text);
  return parsed.error ? '' : String(parsed.value);
};

/**
 * Account-creation defaults inherited from the chosen group's live record:
 * { currency, leverage }, each '' when the group does not supply a valid
 * value. No hardcoded USD / 100 fallback.
 */
export const resolveAccountCreateDefaults = (group) => ({
  currency: readGroupCurrency(group),
  leverage: readGroupLeverage(group),
});

export const emptyAccountCreateForm = (group = '', leverageOrDefaults = '', currency = '') => {
  let leverage = leverageOrDefaults;
  let inheritedCurrency = currency;
  if (leverageOrDefaults && typeof leverageOrDefaults === 'object') {
    leverage = leverageOrDefaults.leverage ?? leverageOrDefaults.Leverage
      ?? leverageOrDefaults.defaultLeverage ?? leverageOrDefaults.default_leverage ?? '';
    inheritedCurrency = leverageOrDefaults.currency ?? leverageOrDefaults.Currency
      ?? leverageOrDefaults.defaultCurrency ?? leverageOrDefaults.groupCurrency ?? '';
  }
  return {
    group,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    currency: String(inheritedCurrency ?? '').trim().toUpperCase(),
    leverage: String(leverage ?? '').trim(),
    accountMode: 'hedging',
    masterPassword: '',
    investorPassword: '',
  };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/v1/manager/accounts body (AccountCreate parameter names). No
 * balance or credit: funding goes through the ledger request workflow.
 * Currency is always required: it defaults to the chosen group's live
 * currency in the UI, and a blank or mismatched value is rejected here so no
 * hardcoded fallback can silently fund the wrong currency. Pass the live
 * group record (or { currency }) as `groupContext` to enforce the match.
 */
export const buildAccountCreatePayload = (form, groupContext = null) => {
  const errors = {};
  const group = String(form?.group ?? '').trim();
  if (!group) errors.group = 'Group is required.';
  const firstName = String(form?.firstName ?? '').trim();
  const lastName = String(form?.lastName ?? '').trim();
  if (!firstName && !lastName) errors.firstName = 'Enter a first or last name.';
  const email = String(form?.email ?? '').trim();
  if (email && !EMAIL_RE.test(email)) errors.email = 'Email is not valid.';
  const leverage = parseLeverage(form?.leverage);
  if (leverage.error) errors.leverage = leverage.error;
  const mode = String(form?.accountMode ?? 'hedging').trim().toLowerCase();
  // Fail closed: netting is refused before any request is sent (the RAM engine cannot open it).
  if (mode === 'netting') errors.accountMode = 'Netting accounts are not supported yet. Select hedging.';
  else if (!ACCOUNT_MODE_CREATE_OPTIONS.some((option) => !option.disabled && option.value === mode)) errors.accountMode = 'Account mode must be hedging or netting.';
  const master = String(form?.masterPassword ?? '');
  const investor = String(form?.investorPassword ?? '');
  if (master.length < 8) errors.masterPassword = 'Master password must have at least 8 characters.';
  if (investor && investor.length < 8) errors.investorPassword = 'Investor password must have at least 8 characters.';
  if (investor && investor === master) errors.investorPassword = 'Investor password must differ from the master password.';
  const currency = String(form?.currency ?? '').trim().toUpperCase();
  if (!currency) errors.currency = 'Currency is required. Enter the group\'s 3-letter currency.';
  else if (!CURRENCY_RE.test(currency)) errors.currency = 'Currency must be a 3-letter code.';
  else {
    const expected = readGroupCurrency(groupContext);
    if (expected && currency !== expected) errors.currency = `Currency must match the group's currency (${expected}).`;
  }
  if (Object.keys(errors).length) return { payload: null, errors };
  const payload = {
    Group: group,
    Leverage: leverage.value,
    AccountMode: mode,
    master_pass: master,
    Currency: currency,
  };
  if (firstName) payload.FirstName = firstName;
  if (lastName) payload.LastName = lastName;
  if (email) payload.Email = email;
  const phone = String(form?.phone ?? '').trim();
  if (phone) payload.Phone = phone;
  if (investor) payload.investor_pass = investor;
  return { payload, errors };
};

/**
 * The login named by an AccountCreate reply, or '' when the reply does not
 * confirm one (empty body, success:false, zero or malformed login). Only a
 * confirmed login may be shown as a created account.
 */
export const readCreatedLogin = (result) => {
  const value = result?.login ?? result?.Login;
  const text = typeof value === 'number'
    ? (Number.isSafeInteger(value) ? String(value) : '')
    : (typeof value === 'string' ? value.trim() : '');
  return /^[1-9][0-9]{0,18}$/.test(text) && BigInt(text) <= 9223372036854775807n ? text : '';
};

export const FUNDING_KINDS = Object.freeze(['deposit', 'withdrawal']);

// Validation errors surface field-by-field AND as one top-level message, so
// no failure is visible only as small text under a field (SUI-A2: the login
// error used to hide under Amount). Order is fixed for stable snapshots.
const FUNDING_ERROR_ORDER = ['kind', 'login', 'amount', 'currency'];

/** Joins a buildFundingRequest errors object into one top-level message. */
export const fundingErrorsToMessage = (errors = {}) => {
  if (!errors || typeof errors !== 'object') return '';
  const seen = new Set();
  const parts = [];
  for (const key of [...FUNDING_ERROR_ORDER, ...Object.keys(errors)]) {
    if (seen.has(key)) continue;
    seen.add(key);
    const value = errors[key];
    if (value !== undefined && value !== null && String(value) !== '') parts.push(String(value));
  }
  return parts.join(' ');
};

/**
 * A deposit or withdrawal REQUEST for the existing ledger workflow
 * (DepositRequestCreate / WithdrawalRequestCreate). It never changes a
 * balance directly: the request is approved in Deposits / Withdrawals, which
 * posts the ledger transaction.
 */
export const buildFundingRequest = (kind, login, form) => {
  const errors = {};
  if (!FUNDING_KINDS.includes(kind)) errors.kind = 'Choose deposit or withdrawal.';
  const accountLogin = Number(String(login ?? '').trim());
  if (!Number.isSafeInteger(accountLogin) || accountLogin <= 0) errors.login = 'A valid account login is required.';
  const amountText = String(form?.amount ?? '').trim();
  const amount = Number(amountText);
  if (!/^\d+(\.\d{1,2})?$/.test(amountText) || !(amount > 0)) errors.amount = 'Amount must be a positive number with at most 2 decimals.';
  const currency = String(form?.currency ?? '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) errors.currency = 'Currency must be a 3-letter code.';
  if (Object.keys(errors).length) return { payload: null, errors };
  const payload = { login: accountLogin, amount, currency };
  const note = String(form?.note ?? '').trim();
  if (kind === 'deposit' && note) payload.reference = note.slice(0, 200);
  if (kind === 'withdrawal' && note) payload.bank_details = note.slice(0, 500);
  return { payload, errors };
};
