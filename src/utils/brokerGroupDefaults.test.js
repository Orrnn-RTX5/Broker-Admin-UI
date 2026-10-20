// Broker group defaults (Server Config > Broker Defaults) and the create-group
// leverage rules: no hardcoded leverage, pre-fill from the broker default,
// otherwise empty and required (whole number MIN..MAX), never 0.
// Run with: node --test src/utils/brokerGroupDefaults.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  GROUP_LEVERAGE_MIN,
  GROUP_LEVERAGE_MAX,
  GROUP_DEFAULT_LEVERAGE_FIELD,
  parseGroupLeverage,
  validateGroupLeverage,
  normalizeBrokerGroupDefaults,
  buildBrokerGroupDefaultsBody,
  formatGroupDefaultLeverage,
  applyBrokerDefaultLeverage,
  createGroupLeverageHint,
  groupCreateLeverageError,
} from './brokerGroupDefaults.js';
import { validateGroupForm, validateGroupSection } from './groupFormSteps.js';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('range constants are defined once: MIN 1, MAX 10000', () => {
  assert.equal(GROUP_LEVERAGE_MIN, 1);
  assert.equal(GROUP_LEVERAGE_MAX, 10000);
  assert.equal(GROUP_DEFAULT_LEVERAGE_FIELD, 'group_default_leverage');
});

test('parseGroupLeverage: blank is null (unset), never 0', () => {
  for (const input of ['', '   ', null, undefined]) assert.deepEqual(parseGroupLeverage(input), { value: null });
});

test('parseGroupLeverage: accepts whole numbers 1..10000 (inclusive) as integers', () => {
  assert.deepEqual(parseGroupLeverage('1'), { value: 1 });
  assert.deepEqual(parseGroupLeverage(' 250 '), { value: 250 });
  assert.deepEqual(parseGroupLeverage(500), { value: 500 });
  assert.deepEqual(parseGroupLeverage('10000'), { value: 10000 });
  assert.equal(typeof parseGroupLeverage('300').value, 'number');
});

test('parseGroupLeverage: rejects 0, 10001, -5, 1.5, abc and other junk', () => {
  for (const input of ['0', 0, '00', '10001', 10001, '-5', -5, '1.5', 1.5, 'abc', '1e3', '1:100', '10x', 'NaN', 'Infinity', true, {}]) {
    const result = parseGroupLeverage(input);
    assert.equal(result.value, undefined, `no value for ${JSON.stringify(input)}`);
    assert.match(result.error, /1.*10000/, `range error for ${JSON.stringify(input)}`);
  }
});

test('validateGroupLeverage throws for blank (required) and invalid, returns the integer otherwise', () => {
  assert.equal(validateGroupLeverage('200', 'Leverage'), 200);
  assert.throws(() => validateGroupLeverage('', 'Leverage'), /Leverage is required/);
  for (const bad of [0, '0', 10001, -5, 1.5, 'abc']) assert.throws(() => validateGroupLeverage(bad, 'Leverage'), /1.*10000/);
});

test('normalizeBrokerGroupDefaults maps the GET body (int or null)', () => {
  assert.deepEqual(normalizeBrokerGroupDefaults({ broker_id: 'broker-a', group_default_leverage: 200 }), { brokerId: 'broker-a', defaultLeverage: 200 });
  assert.deepEqual(normalizeBrokerGroupDefaults({ broker_id: 'broker-a', group_default_leverage: null }), { brokerId: 'broker-a', defaultLeverage: null });
  assert.deepEqual(normalizeBrokerGroupDefaults({ group_default_leverage: 10000 }), { brokerId: '', defaultLeverage: 10000 });
});

test('normalizeBrokerGroupDefaults refuses malformed bodies (never surfaces 0/NaN)', () => {
  for (const raw of [null, undefined, 'oops', [], {}, { group_default_leverage: 0 }, { group_default_leverage: 10001 },
    { group_default_leverage: -5 }, { group_default_leverage: 1.5 }, { group_default_leverage: '200' }]) {
    assert.throws(() => normalizeBrokerGroupDefaults(raw), /broker defaults response/i, JSON.stringify(raw));
  }
});

test('buildBrokerGroupDefaultsBody sends exactly { group_default_leverage } (int or null)', () => {
  assert.deepEqual(buildBrokerGroupDefaultsBody('200'), { group_default_leverage: 200 });
  assert.deepEqual(buildBrokerGroupDefaultsBody(1), { group_default_leverage: 1 });
  assert.deepEqual(buildBrokerGroupDefaultsBody('10000'), { group_default_leverage: 10000 });
  assert.deepEqual(buildBrokerGroupDefaultsBody(''), { group_default_leverage: null });
  assert.deepEqual(buildBrokerGroupDefaultsBody(null), { group_default_leverage: null });
  assert.deepEqual(Object.keys(buildBrokerGroupDefaultsBody('5')), ['group_default_leverage']);
});

test('buildBrokerGroupDefaultsBody refuses invalid input locally (typed, never 0)', () => {
  for (const bad of [0, '0', 10001, '-5', 1.5, 'abc']) {
    assert.throws(() => buildBrokerGroupDefaultsBody(bad), (error) => error.code === 'GROUP_POLICY_DEFAULT_INVALID' && /1.*10000/.test(error.message));
  }
});

test('formatGroupDefaultLeverage: Not set or 1:N', () => {
  assert.equal(formatGroupDefaultLeverage(null), 'Not set');
  assert.equal(formatGroupDefaultLeverage(250), '1:250');
});

test('create popup: broker default int pre-fills an untouched empty leverage', () => {
  assert.deepEqual(applyBrokerDefaultLeverage({ name: 'g', leverage: '' }, 300, false), { name: 'g', leverage: 300 });
});

test('create popup: null default / touched field / existing value are left alone', () => {
  const empty = { leverage: '' };
  assert.equal(applyBrokerDefaultLeverage(empty, null, false), empty);
  assert.equal(applyBrokerDefaultLeverage(empty, 300, true), empty);
  const drafted = { leverage: 50 };
  assert.equal(applyBrokerDefaultLeverage(drafted, 300, false), drafted);
});

test('create popup: hint per broker-default state is neutral and names the range', () => {
  assert.match(createGroupLeverageHint({ status: 'set', value: 300 }), /1:300/);
  assert.match(createGroupLeverageHint({ status: 'unset', value: null }), /No broker default.*1.*10000/);
  assert.match(createGroupLeverageHint({ status: 'error', value: null }), /could not be loaded.*1.*10000/);
  assert.equal(createGroupLeverageHint({ status: 'loading' }), undefined);
});

test('create popup: empty leverage blocks submit (required); 0/10001/1.5 rejected; valid value accepted', () => {
  const complete = { name: 'Broker/real', currency: 'USD', leverage: '', spreadMarkup: 0, commissionRate: 0, marginCallLevel: 100, stopOutLevel: 50, symbolsAllowed: '' };
  const blank = validateGroupForm(complete);
  assert.equal(blank.field, 'leverage');
  assert.equal(blank.section, 'trading');
  assert.match(blank.message, /required/i);
  for (const bad of [0, '0', 10001, '10001', -5, 1.5, 'abc']) assert.equal(validateGroupSection({ ...complete, leverage: bad }, 'trading').field, 'leverage');
  assert.equal(validateGroupForm({ ...complete, leverage: '10000' }), null);
  assert.equal(validateGroupForm({ ...complete, leverage: 1 }), null);
});

test('create errors: GROUP_POLICY_DEFAULT_MISSING / GROUP_LEVERAGE_INVALID map to leverage-field text', () => {
  const backend = (code, message) => Object.assign(new Error('Request failed with status code 400'), { response: { status: 400, data: { code, message } } });
  const missing = groupCreateLeverageError(backend(undefined, 'GROUP_POLICY_DEFAULT_MISSING: leverage is omitted and no default is configured'));
  assert.match(missing, /no default leverage/i);
  assert.doesNotMatch(missing, /GROUP_POLICY_DEFAULT_MISSING/);
  assert.match(groupCreateLeverageError(backend('GROUP_LEVERAGE_INVALID', 'GROUP_LEVERAGE_INVALID leverage out of range')), /1.*10000/);
  assert.match(groupCreateLeverageError(backend('MT_RET_ERR_PARAMS', 'GROUP_LEVERAGE_INVALID: leverage 0')), /1.*10000/);
  assert.equal(groupCreateLeverageError(backend('MT_RET_ERR_PARAMS', 'Group name already exists')), null);
  assert.equal(groupCreateLeverageError(new Error('Network Error')), null);
});

test('CreateGroupPopup source: no numeric leverage literal; broker default read and helpers wired', async () => {
  const popup = await read('../components/RIGHTCLICKJPOPUPS/CreateGroupPopup.jsx');
  assert.doesNotMatch(popup, /leverage:\s*\d/, 'no numeric leverage default in form state');
  assert.match(popup, /leverage:\s*''/, 'create form starts with an empty leverage');
  assert.match(popup, /BrokerGroupDefaultsApi\.get\(\)/);
  assert.match(popup, /applyBrokerDefaultLeverage\(/);
  assert.match(popup, /createGroupLeverageHint\(/);
  assert.match(popup, /groupCreateLeverageError\(/);
  assert.match(popup, /min: GROUP_LEVERAGE_MIN, max: GROUP_LEVERAGE_MAX/);
  // changedFields is a Set: `.includes` throws a TypeError before any request.
  assert.doesNotMatch(popup, /changedFields\.current\.includes\(/);
});

test('Server Config source: Broker Defaults tab is wired to the group-defaults service', async () => {
  const workspace = await read('../components/organisms/ServerConfigWorkspace.jsx');
  const view = await read('../components/organisms/ServerConfigBrokerDefaults.jsx');
  assert.match(workspace, /\{ id: 'defaults', label: 'Broker Defaults'/);
  assert.match(workspace, /\{tab === 'defaults' && <BrokerDefaultsTab \/>\}/);
  assert.match(view, /Default leverage/);
  assert.match(view, /BrokerGroupDefaultsApi\.get\(\)/);
  assert.match(view, /BrokerGroupDefaultsApi\.save\(/);
  assert.match(view, /formatGroupDefaultLeverage\(/);
  assert.doesNotMatch(view, /\b100\b/);
});
