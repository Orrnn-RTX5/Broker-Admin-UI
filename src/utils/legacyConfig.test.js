import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIG_ERROR_CODES,
  buildAccountCreatePayload,
  buildAccountTradingChanges,
  buildFundingRequest,
  buildGroupLeverageChange,
  describeConfigError,
  joinLockDetails,
  describeLockReason,
  emptyAccountCreateForm,
  normalizeAccountConfig,
  readConfigError,
  readCreatedLogin,
  readGroupCurrency,
  readGroupLeverage,
  readRevision,
  resolveAccountCreateDefaults,
  withExpectedRevision,
} from './legacyConfig.js';

const REV = 'lcr1:0123456789abcdef01234567';

test('revisions are read strictly and only sent when known', () => {
  assert.equal(readRevision({ revision: REV }), REV);
  assert.equal(readRevision({ revision: 42 }), '');
  assert.equal(readRevision({ revision: 'not-a-revision' }), '');
  assert.equal(readRevision(null), '');
  assert.deepEqual(withExpectedRevision({ leverage: 200 }, REV), { leverage: 200, expected_revision: REV });
  // Older backends return no revision: the legacy body is unchanged.
  assert.deepEqual(withExpectedRevision({ leverage: 200 }, ''), { leverage: 200 });
  const original = { a: 1 };
  withExpectedRevision(original, REV);
  assert.deepEqual(original, { a: 1 }, 'input is not mutated');
});

test('conflict, lock and required errors are recognised with precise lock reasons', () => {
  const conflict = readConfigError({ response: { status: 409, data: { code: CONFIG_ERROR_CODES.conflict, current_revision: REV, message: 'x' } } });
  assert.equal(conflict.kind, 'conflict');
  assert.equal(conflict.currentRevision, REV);
  assert.match(conflict.message, /Reload/);

  const reasons = [
    { reason: 'open_positions', count: 2, logins: [1001, 1002], symbols: ['EURUSD'] },
    { reason: 'lp_use_unknown', count: 1, logins: [1003] },
  ];
  const locked = readConfigError({ response: { status: 409, data: { error_code: CONFIG_ERROR_CODES.inUse, message: 'Cannot change leverage of account 1001: affected accounts are in use (2 open positions in EURUSD on 1001, 1002).', lock_reasons: reasons } } });
  assert.equal(locked.kind, 'in_use');
  assert.deepEqual(locked.lockDetails, ['2 open positions (EURUSD) on 1001, 1002', '1 LP order with unknown outcome on 1003']);
  assert.equal(
    describeConfigError({ response: { data: { code: CONFIG_ERROR_CODES.inUse, lock_reasons: reasons } } }),
    'The change affects accounts that are trading right now: 2 open positions (EURUSD) on 1001, 1002; 1 LP order with unknown outcome on 1003.',
  );
  // The server sentence and the lock details join as one punctuated sentence.
  assert.equal(
    describeConfigError({ response: { data: { code: CONFIG_ERROR_CODES.inUse, message: 'Group leverage is in use by trading accounts', lock_reasons: reasons.slice(0, 1) } } }),
    'Group leverage is in use by trading accounts: 2 open positions (EURUSD) on 1001, 1002.',
  );
  assert.equal(joinLockDetails('Accounts are trading.', ['1 pending order on 7']), 'Accounts are trading: 1 pending order on 7.');
  assert.equal(joinLockDetails('', ['1 pending order on 7']), '1 pending order on 7.');

  assert.equal(readConfigError({ response: { status: 428, data: { code: CONFIG_ERROR_CODES.required } } }).kind, 'required');
  assert.equal(describeConfigError({ response: { data: { message: 'Group not found' } } }, 'fallback'), 'Group not found');
  assert.equal(describeConfigError({}, 'fallback'), 'fallback');
  assert.equal(describeLockReason({ reason: 'pending_orders', count: 1, logins: [7] }), '1 pending order on 7');
});

test('account trading changes: only effective, validated, untouched fields ignored', () => {
  const stored = normalizeAccountConfig({ Login: 1001, Group: 'real', Currency: 'USD', Leverage: 100, AccountMode: 'hedging', revision: REV });
  assert.deepEqual(stored, { login: '1001', group: 'real', currency: 'USD', leverage: '100', accountMode: 'hedging', revision: REV });
  assert.deepEqual(buildAccountTradingChanges(stored, { leverage: '100', accountMode: 'hedging' }), { changes: {}, errors: {} });
  assert.match(buildAccountTradingChanges(stored, { leverage: '500', accountMode: 'netting' }).errors.accountMode, /fixed at creation/);
  assert.deepEqual(buildAccountTradingChanges(stored, { leverage: '500', accountMode: 'hedging' }).changes, { leverage: 500 });
  assert.ok(buildAccountTradingChanges(stored, { leverage: '0', accountMode: 'hedging' }).errors.leverage);
  assert.ok(buildAccountTradingChanges(stored, { leverage: '1.5', accountMode: 'hedging' }).errors.leverage);
  assert.ok(buildAccountTradingChanges(stored, { leverage: '100', accountMode: 'hybrid' }).errors.accountMode);
  // Stored leverage unknown and untouched: a profile-only save is not blocked.
  assert.deepEqual(buildAccountTradingChanges({ leverage: '', accountMode: 'hedging' }, { leverage: '', accountMode: 'hedging' }), { changes: {}, errors: {} });
});

test('group leverage change is a validated whole number', () => {
  assert.deepEqual(buildGroupLeverageChange('100', '100'), { changes: {}, error: '' });
  assert.deepEqual(buildGroupLeverageChange('100', '200'), { changes: { leverage: 200 }, error: '' });
  assert.match(buildGroupLeverageChange('100', '20000').error, /1 to 10000/);
});

test('customer account creation payload uses AccountCreate names and never funds', () => {
  const form = { ...emptyAccountCreateForm('real\\std', 200), firstName: 'Ann', email: 'ann@example.com', masterPassword: 'Secret-123', investorPassword: 'Invest-456', currency: 'usd' };
  const { payload, errors } = buildAccountCreatePayload(form);
  assert.deepEqual(errors, {});
  assert.deepEqual(payload, { Group: 'real\\std', Leverage: 200, AccountMode: 'hedging', master_pass: 'Secret-123', FirstName: 'Ann', Email: 'ann@example.com', Currency: 'USD', investor_pass: 'Invest-456' });
  assert.equal('Credit' in payload || 'Balance' in payload || 'amount' in payload, false);
  const bad = buildAccountCreatePayload({ ...form, group: '', firstName: '', masterPassword: 'short', investorPassword: 'short', email: 'x' });
  assert.equal(bad.payload, null);
  for (const key of ['group', 'firstName', 'masterPassword', 'investorPassword', 'email']) assert.ok(bad.errors[key], key);
  assert.ok(buildAccountCreatePayload({ ...form, investorPassword: form.masterPassword }).errors.investorPassword);
});

test('account creation defaults are neutral: no hardcoded USD / 100', () => {
  assert.deepEqual(emptyAccountCreateForm(), {
    group: '', firstName: '', lastName: '', email: '', phone: '',
    currency: '', leverage: '', accountMode: 'hedging', masterPassword: '', investorPassword: '',
  });
  assert.equal(emptyAccountCreateForm('real\\std').currency, '');
  assert.equal(emptyAccountCreateForm('real\\std').leverage, '');
  // Explicit operator values still flow through; currency normalises to upper case.
  assert.equal(emptyAccountCreateForm('real\\std', 200).leverage, '200');
  assert.equal(emptyAccountCreateForm('real\\std', 200).currency, '');
  assert.deepEqual(
    emptyAccountCreateForm('real\\std', { currency: 'eur', leverage: 500 }),
    { ...emptyAccountCreateForm('real\\std'), currency: 'EUR', leverage: '500', group: 'real\\std' },
  );
});

test('account creation inherits the chosen group currency/leverage (USD and non-USD fixtures)', () => {
  // GroupGet-shaped USD fixture.
  assert.deepEqual(resolveAccountCreateDefaults({ currency: 'USD', leverage: 100 }), { currency: 'USD', leverage: '100' });
  // GroupList-shaped non-USD fixture (alternate keys, lower case, string leverage).
  assert.deepEqual(resolveAccountCreateDefaults({ Currency: 'eur', Leverage: '500' }), { currency: 'EUR', leverage: '500' });
  assert.deepEqual(resolveAccountCreateDefaults({ deposit_currency: 'jpy', leverage: '25' }), { currency: 'JPY', leverage: '25' });
  assert.equal(readGroupCurrency({ currency: 'usd' }), 'USD');
  assert.equal(readGroupCurrency({ Currency: 'GBP' }), 'GBP');
  assert.equal(readGroupLeverage({ leverage: 1000 }), '1000');
  // Unknown or invalid group metadata stays neutral so validation forces input.
  assert.deepEqual(resolveAccountCreateDefaults({}), { currency: '', leverage: '' });
  assert.deepEqual(resolveAccountCreateDefaults(null), { currency: '', leverage: '' });
  assert.equal(readGroupCurrency({ currency: 'US' }), '');
  assert.equal(readGroupCurrency({ currency: '' }), '');
  assert.equal(readGroupLeverage({ leverage: '0' }), '');
  assert.equal(readGroupLeverage({}), '');
});

test('account creation requires a valid currency and rejects group mismatches', () => {
  const base = { ...emptyAccountCreateForm('real\\std', { currency: 'EUR', leverage: 500 }), firstName: 'Ann', masterPassword: 'Secret-123' };
  // Matching the live group passes and always sends Currency.
  const ok = buildAccountCreatePayload(base, { currency: 'EUR' });
  assert.deepEqual(ok.errors, {});
  assert.equal(ok.payload.Currency, 'EUR');
  // Blank currency is rejected: the operator must enter the group's code.
  const blank = buildAccountCreatePayload({ ...base, currency: '' }, { currency: 'EUR' });
  assert.equal(blank.payload, null);
  assert.match(blank.errors.currency, /required/);
  const blankNoContext = buildAccountCreatePayload({ ...base, currency: '  ' });
  assert.equal(blankNoContext.payload, null);
  assert.match(blankNoContext.errors.currency, /required/);
  // Malformed codes are rejected.
  for (const currency of ['US', 'USDD', '12', 'U$D']) {
    const bad = buildAccountCreatePayload({ ...base, currency }, { currency: 'EUR' });
    assert.equal(bad.payload, null, currency);
    assert.match(bad.errors.currency, /3-letter/, currency);
  }
  // A value that differs from the live group is rejected with the expected code.
  const mismatch = buildAccountCreatePayload({ ...base, currency: 'USD' }, { currency: 'EUR' });
  assert.equal(mismatch.payload, null);
  assert.match(mismatch.errors.currency, /EUR/);
  // Without live group metadata any well-formed code is accepted.
  const noContext = buildAccountCreatePayload({ ...base, currency: 'usd' });
  assert.deepEqual(noContext.errors, {});
  assert.equal(noContext.payload.Currency, 'USD');
});
test('only a reply naming a positive login confirms account creation', () => {
  assert.equal(readCreatedLogin({ Login: 70001 }), '70001');
  assert.equal(readCreatedLogin({ login: ' 9007199254740993 ' }), '9007199254740993');
  for (const reply of [undefined, null, {}, { success: false }, { Login: 0 }, { Login: -5 }, { Login: '' }, { Login: '12a' }, { Login: 1.5 }, { Login: Number('9007199254740993') }, { login: '9223372036854775808' }]) {
    assert.equal(readCreatedLogin(reply), '', JSON.stringify(reply));
  }
});

test('funding builds a ledger REQUEST, never a balance edit', () => {
  assert.deepEqual(buildFundingRequest('deposit', '1001', { amount: '250.50', currency: 'usd', note: 'wire 42' }).payload,
    { login: 1001, amount: 250.5, currency: 'USD', reference: 'wire 42' });
  assert.deepEqual(buildFundingRequest('withdrawal', 1001, { amount: '10', currency: 'EUR', note: 'IBAN X' }).payload,
    { login: 1001, amount: 10, currency: 'EUR', bank_details: 'IBAN X' });
  const bad = buildFundingRequest('credit', 'abc', { amount: '-1', currency: 'US' });
  assert.equal(bad.payload, null);
  for (const key of ['kind', 'login', 'amount', 'currency']) assert.ok(bad.errors[key], key);
  assert.ok(buildFundingRequest('deposit', 1, { amount: '1.234', currency: 'USD' }).errors.amount);
});
