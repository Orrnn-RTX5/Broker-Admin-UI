// Focused tests for centralized admin validators.
// Run with: node --test src/utils/adminValidation.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateLpRouteForm, parseMoneyAmount, parsePositiveInteger, buildManagerUpdateParams, validateManagerPassword } from './adminValidation.js';

const validLpForm = () => ({
  // non-numeric passthrough fields
  route_name: 'EU-Aggressive',
  symbol: 'EURUSD',
  lp_name: 'LP1',
  enabled: true,
  // numeric fields, all supplied as strings (as React inputs do)
  priority: '5',
  max_volume: '100',
  rule_min_volume: '1',
  rule_max_volume: '50',
  markup_send_lp_min: '2',
  markup_send_lp_max: '10',
  markup_min_market: '0.5',
  markup_max_market: '3',
  markup_min_limit: '0.25',
  markup_max_limit: '4',
});

test('validateLpRouteForm: coerces ALL validated numerics to numbers (admin-ui-N3-01)', () => {
  const out = validateLpRouteForm(validLpForm());
  const numericKeys = [
    'priority',
    'max_volume',
    'rule_min_volume',
    'rule_max_volume',
    'markup_send_lp_min',
    'markup_send_lp_max',
    'markup_min_market',
    'markup_max_market',
    'markup_min_limit',
    'markup_max_limit',
  ];
  for (const key of numericKeys) {
    assert.equal(typeof out[key], 'number', `${key} should be a number, got ${typeof out[key]}`);
  }
  // Spot-check values are preserved, not mangled.
  assert.equal(out.priority, 5);
  assert.equal(out.markup_min_market, 0.5);
  assert.equal(out.markup_max_limit, 4);
});

test('validateLpRouteForm: preserves non-numeric passthrough fields unchanged', () => {
  const out = validateLpRouteForm(validLpForm());
  assert.equal(out.route_name, 'EU-Aggressive');
  assert.equal(out.symbol, 'EURUSD');
  assert.equal(out.lp_name, 'LP1');
  assert.equal(out.enabled, true);
});

test('validateLpRouteForm: still enforces ordering checks', () => {
  const bad = { ...validLpForm(), rule_max_volume: '0' };
  assert.throws(() => validateLpRouteForm(bad), /Rule max volume/);

  const bad2 = { ...validLpForm(), markup_max_market: '0' };
  assert.throws(() => validateLpRouteForm(bad2), /market markup/);
});

test('validateLpRouteForm: rejects non-numeric / negative input', () => {
  assert.throws(() => validateLpRouteForm({ ...validLpForm(), markup_min_market: 'abc' }), /Min market markup/);
  assert.throws(() => validateLpRouteForm({ ...validLpForm(), max_volume: '-1' }), /Max volume/);
  // priority must be a positive integer
  assert.throws(() => validateLpRouteForm({ ...validLpForm(), priority: '1.5' }), /Priority/);
});

// ── parseMoneyAmount (admin-ui-F04) ─────────────────────────────────────────
test('parseMoneyAmount: accepts a valid positive amount and rounds to 2dp', () => {
  assert.equal(parseMoneyAmount('500.00'), 500);
  assert.equal(parseMoneyAmount('100.5'), 100.5);
  assert.equal(parseMoneyAmount('99.999'), 100); // rounds to 2dp
  assert.equal(parseMoneyAmount('0.01'), 0.01);
  assert.equal(parseMoneyAmount('.5'), 0.5);
  assert.equal(parseMoneyAmount(250), 250); // numeric input is accepted too
});

test('parseMoneyAmount: rejects zero and negatives (no silent withdrawal via negative deposit)', () => {
  assert.throws(() => parseMoneyAmount('0'), /greater than zero/);
  assert.throws(() => parseMoneyAmount('-100'), /valid amount|greater than zero/);
  assert.throws(() => parseMoneyAmount('-0.01'), /valid amount|greater than zero/);
});

test('parseMoneyAmount: rejects blank, NaN, and trailing-garbage that parseFloat would accept', () => {
  assert.throws(() => parseMoneyAmount(''), /required/);
  assert.throws(() => parseMoneyAmount('   '), /required/);
  assert.throws(() => parseMoneyAmount('abc'), /valid amount/);
  assert.throws(() => parseMoneyAmount('100abc'), /valid amount/); // parseFloat would return 100
  assert.throws(() => parseMoneyAmount('1e9'), /valid amount/);    // exponent form rejected
  assert.throws(() => parseMoneyAmount(null), /required/);
  assert.throws(() => parseMoneyAmount(undefined), /required/);
});

test('parseMoneyAmount: enforces an upper bound', () => {
  assert.throws(() => parseMoneyAmount('1000000001'), /maximum/);
  // exactly at the cap is allowed
  assert.equal(parseMoneyAmount('1000000000'), 1000000000);
});

test('parseMoneyAmount: uses the provided label in error messages', () => {
  assert.throws(() => parseMoneyAmount('', 'Deposit'), /Deposit is required/);
});

test('parsePositiveInteger: validates account login values for money-create forms', () => {
  assert.equal(parsePositiveInteger('12345', 'Login'), 12345);
  assert.equal(parsePositiveInteger(900546, 'Login'), 900546);

  assert.throws(() => parsePositiveInteger('', 'Login'), /positive whole number/);
  assert.throws(() => parsePositiveInteger('0', 'Login'), /positive whole number/);
  assert.throws(() => parsePositiveInteger('-1', 'Login'), /positive whole number/);
  assert.throws(() => parsePositiveInteger('123.5', 'Login'), /positive whole number/);
  assert.throws(() => parsePositiveInteger('abc', 'Login'), /valid number/);
});

test('Edit Manager sends changed role, trimmed lists and clears emptied lists', () => {
  const original = { role_id: 3 };
  assert.deepEqual(
    buildManagerUpdateParams({ name: ' Arijit ', role_id: '5', enabled: true, allowed_groups: 'retail, vip', ip_whitelist: '10.0.0.1' }, original),
    { name: 'Arijit', enabled: true, 'allowed_groups[]': ['retail', 'vip'], 'ip_whitelist[]': ['10.0.0.1'], role_id: 5 },
  );
  // Unchanged role is not re-sent; emptied lists are sent as [''] so they clear.
  assert.deepEqual(
    buildManagerUpdateParams({ name: 'Arijit', role_id: '3', enabled: false, allowed_groups: '', ip_whitelist: '  ' }, original),
    { name: 'Arijit', enabled: false, 'allowed_groups[]': [''], 'ip_whitelist[]': [''] },
  );
  // Choosing "No role" removes the role (0 in the integer-typed JSON contract).
  assert.equal(buildManagerUpdateParams({ name: 'A', role_id: '', enabled: true }, original).role_id, 0);
});

test('Edit Manager rejects a blank name and invalid IPs', () => {
  assert.throws(() => buildManagerUpdateParams({ name: '  ' }), /Name is required/);
  assert.throws(() => buildManagerUpdateParams({ name: 'A', ip_whitelist: 'not-an-ip' }), /IP whitelist entry/);
});

test('Reset Password enforces the backend length bounds and confirmation', () => {
  assert.equal(validateManagerPassword('a-valid-password', 'a-valid-password'), 'a-valid-password');
  assert.throws(() => validateManagerPassword('short', 'short'), /12 to 72/);
  assert.throws(() => validateManagerPassword('x'.repeat(73), 'x'.repeat(73)), /12 to 72/);
  assert.throws(() => validateManagerPassword('a-valid-password', 'a-different-pass'), /do not match/);
});
