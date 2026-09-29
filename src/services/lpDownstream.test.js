import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDraft, draftFromAuthority, createLPDownstreamAPI, emergencyReasonError, validateProfile, validateGrant,
  EMERGENCY_CONFIRM_TEXT, DOWNSTREAM_SUPPORT,
} from './lpDownstream.js';
import {redactForLog} from '../lib/logRedaction.js';

const ACCESS = 'dsa_abcdefghijklmnopqrstuvwxyz';
const QSESSION = 'RTXDQABCDEFGHIJKLMNOPQRST';
const TSESSION = 'RTXDTABCDEFGHIJKLMNOPQRST';
const SECRET = 'rtxd1_' + 'A'.repeat(43);
const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const REQUEST = '6f9619ff-8b86-4011-b42d-00c04fc964ff';

const form = () => ({
  counterparty_id: 'trivanta-b', coverage_account_id: UUID, coverage_login: '9007199254740993', group_id: 'bbook-cover',
  feed_connection_id: 'hub-feed', feed_selection_revision: '9007199254740995', account_mode: 'hedging', route: {kind: 'bbook'},
  symbols: ['xauusd', 'BTCUSD', 'EURUSD'], label: '',
  quote: {enabled: true, operations: ['quote_subscribe'], symbols: ['EURUSD']},
  trade: {enabled: false, operations: ['create', 'close'], symbols: ['BTCUSD'], order_types: ['market'], policies: ['IOC', 'FOK']},
});

const grant = (overrides = {}) => ({
  tenant_id: 't', broker_id: 'b', access_id: ACCESS, authority: {...buildDraft(form())}, enabled: false, revision: '9007199254740997',
  quote_session: {role: 'quote', session_id: QSESSION}, trade_session: {role: 'trade', session_id: TSESSION},
  quote_credential: {revision: '0', state: 'none'}, trade_credential: {revision: '2', state: 'active'},
  application_state: 'unapplied', ...overrides,
});

const unavailable = role => ({status: 'listener_profile_unavailable', access_id: ACCESS, role, credential_state: 'active', credential_revision: '3', applied: false, connection: 'not_observed', verification: 'not_verified'});

const recorder = responses => {
  const calls = [];
  const request = async (path, options) => {
    calls.push({path, ...options});
    const next = responses.shift();
    return {ok: next.ok ?? true, status: next.status ?? 200, json: async () => next.body};
  };
  return {calls, api: createLPDownstreamAPI(request)};
};

test('draft is strict: canonical string revisions/login, B-book only, supported operations only, nothing preselected', () => {
  const draft = buildDraft(form());
  assert.equal(draft.coverage_login, '9007199254740993');
  assert.equal(draft.feed_selection_revision, '9007199254740995');
  assert.deepEqual(draft.symbols, ['BTCUSD', 'EURUSD', 'XAUUSD']);
  assert.deepEqual(draft.route, {kind: 'bbook'});
  assert.deepEqual(draft.trade.policies, ['FOK', 'IOC']);
  assert.equal('label' in draft, false);
  assert.deepEqual(Object.keys(draft).sort(), ['account_mode', 'counterparty_id', 'coverage_account_id', 'coverage_login', 'feed_connection_id', 'feed_selection_revision', 'group_id', 'quote', 'route', 'symbols', 'trade']);
  const bad = [
    {coverage_login: Number("9007199254740993")}, {feed_selection_revision: 3}, {feed_selection_revision: '0'}, {coverage_account_id: UUID.toUpperCase()},
    {route: {kind: 'external', rule_id: 'r1', rule_revision: '2'}}, {account_mode: 'hybrid'}, {symbols: []}, {label: ' padded'},
    {trade: {enabled: true, operations: ['cancel'], symbols: ['BTCUSD']}},
    {trade: {enabled: true, operations: ['create'], symbols: ['BTCUSD'], order_types: ['limit'], policies: ['FOK']}},
    {trade: {enabled: true, operations: ['create'], symbols: ['BTCUSD'], order_types: ['market'], policies: ['GTC']}},
    {trade: {enabled: true, operations: ['create'], symbols: ['BTCUSD']}},
    {trade: {enabled: true, operations: ['close'], symbols: ['BTCUSD'], order_types: ['market'], policies: ['FOK']}},
    {trade: {enabled: true, operations: ['close'], symbols: ['GBPUSD']}},
    {quote: {enabled: true, operations: ['quote_subscribe'], symbols: ['EURUSD'], policies: ['FOK']}},
    {quote: {enabled: true, operations: [], symbols: ['EURUSD']}},
  ];
  for (const patch of bad) assert.throws(() => buildDraft({...form(), ...patch}), error => error.code === 'INVALID_INPUT', JSON.stringify(patch));
  for (const op of DOWNSTREAM_SUPPORT.trade.unsupported) assert.equal(DOWNSTREAM_SUPPORT.trade.operations.includes(op), false);
  assert.deepEqual(draftFromAuthority({...draft, trade: {enabled: false, operations: ['cancel'], symbols: []}}).trade.operations, ['cancel']);
});

test('create and update send only the strict body with string revisions; enabled is explicit', async () => {
  const {calls, api} = recorder([{status: 201, body: grant()}, {body: grant({enabled: true})}]);
  await api.createGrant({draft: form()});
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].path, '/api/v1/lp/downstream/access');
  assert.deepEqual(Object.keys(JSON.parse(calls[0].body)), ['draft']);
  await api.updateGrant(ACCESS, {draft: form(), enabled: true, expected_revision: '9007199254740997'});
  const body = JSON.parse(calls[1].body);
  assert.equal(calls[1].method, 'PUT');
  assert.deepEqual(Object.keys(body).sort(), ['draft', 'enabled', 'expected_revision']);
  assert.equal(body.expected_revision, '9007199254740997');
  await assert.rejects(api.updateGrant(ACCESS, {draft: form(), enabled: true, expected_revision: Number("9007199254740997")}), error => error.code === 'INVALID_INPUT');
  await assert.rejects(api.updateGrant(ACCESS, {draft: form(), expected_revision: '1'}), error => error.code === 'INVALID_INPUT');
  await assert.rejects(api.grant('../counterparties'), error => error.code === 'INVALID_INPUT');
  assert.equal(calls.length, 2);
});

test('trade-lock, stale and reference errors keep code, class and reasons without leaking server text', async () => {
  const {api} = recorder([
    {ok: false, status: 409, body: {code: 'DOWNSTREAM_ACCESS_IN_USE', message: 'private detail', class: 'scope', reasons: ['open_positions', 'pending_orders']}},
    {ok: false, status: 409, body: {code: 'STALE_REVISION'}},
    {ok: false, status: 409, body: {code: 'REFERENCE_INVALID', reasons: ['symbol XAUUSD not tradeable']}},
    {ok: false, status: 404, body: '404 page not found'},
  ]);
  await assert.rejects(api.updateGrant(ACCESS, {draft: form(), enabled: false, expected_revision: '4'}), error =>
    error.code === 'DOWNSTREAM_ACCESS_IN_USE' && error.changeClass === 'scope' && error.reasons.join() === 'open_positions,pending_orders' && !error.message.includes('private'));
  await assert.rejects(api.updateGrant(ACCESS, {draft: form(), enabled: true, expected_revision: '4'}), error => error.code === 'STALE_REVISION');
  await assert.rejects(api.createGrant({draft: form()}), error => error.code === 'REFERENCE_INVALID' && error.reasons[0].includes('XAUUSD'));
  await assert.rejects(api.grants(), error => error.code === 'DOWNSTREAM_ADMIN_UNAVAILABLE');
});

test('issue returns the one-time export exactly once and the module keeps no copy', async () => {
  const response = {grant_revision: '5', export: {access_id: ACCESS, role: 'trade', sender_comp_id: TSESSION, username: TSESSION, password: SECRET, credential_revision: '3', profile_status: 'listener_profile_unavailable', profile: unavailable('trade')}};
  const {calls, api} = recorder([{status: 201, body: response}, {body: grant()}]);
  const issued = await api.issue(ACCESS, 'trade', {request_id: REQUEST, expected_revision: '4'});
  assert.equal(issued.export.password, SECRET);
  assert.equal(issued.export.profile.host, undefined);
  assert.deepEqual(JSON.parse(calls[0].body), {request_id: REQUEST, expected_revision: '4'});
  assert.equal(calls[0].path, `/api/v1/lp/downstream/access/${ACCESS}/credentials/trade`);
  response.export.password = 'overwritten';
  issued.export.password = null;
  await api.grant(ACCESS);
  assert.equal(JSON.stringify(api).includes('rtxd1_'), false);
  assert.equal(Object.values(api).every(value => typeof value === 'function'), true);
  assert.equal(JSON.stringify(redactForLog({grant_revision: '5', export: {password: SECRET}})).includes('rtxd1_'), false);
  await assert.rejects(api.issue(ACCESS, 'trade', {request_id: 'not-a-uuid', expected_revision: '4'}), error => error.code === 'INVALID_INPUT');
  const bad = recorder([{status: 201, body: {...response, export: {...response.export, password: 'short', role: 'trade'}}}]);
  await assert.rejects(bad.api.issue(ACCESS, 'trade', {request_id: REQUEST, expected_revision: '4'}));
});

test('reads refuse credential material and profiles expose endpoints only when available', () => {
  assert.throws(() => validateGrant(grant({authority: {...grant().authority, label: SECRET}})));
  const available = {...unavailable('quote'), status: 'available', host: 'fix.example.net', port: 9443, tls_mode: 'tls', sender_comp_id: QSESSION, target_comp_id: 'RTXPROVIDER', begin_string: 'FIX.4.4'};
  assert.equal(validateProfile(available, ACCESS, 'quote').port, 9443);
  assert.equal(validateProfile({...unavailable('quote'), host: 'leak.example.net', port: 1}, ACCESS, 'quote').host, undefined);
  assert.throws(() => validateProfile({...available, tls_mode: 'loopback_plaintext_test'}, ACCESS, 'quote'));
  assert.throws(() => validateProfile(available, ACCESS, 'trade'));
});

test('emergency revoke requires a 10-500 character reason and the expected revision; never reports flat', async () => {
  assert.equal(EMERGENCY_CONFIRM_TEXT, 'Emergency revoke stops new orders; open trades remain.');
  for (const reason of ['short', ' leading spaces here', 'x'.repeat(501), 'pasted rtxd1_secret value', 'line\nbreak reason'])
    assert.notEqual(emergencyReasonError(reason), '');
  assert.equal(emergencyReasonError('Counterparty credential leaked'), '');
  const revoked = grant({trade_credential: {revision: '2', state: 'retired', emergency_revoked: true}, revision: '6'});
  const {calls, api} = recorder([{body: {grant: revoked, role: 'trade', session_id: TSESSION, credential_revision: '2', reason: 'Counterparty credential leaked', active_use: {open_positions: '3', pending_orders: '0', unresolved_commands: '0', configuration_uses: '0'}, open_trades_remain: true, session_cut: 'committed_propagating'}}]);
  await assert.rejects(api.emergencyRevoke(ACCESS, 'trade', {expected_revision: '5', reason: 'short'}), error => error.code === 'INVALID_INPUT');
  await assert.rejects(api.emergencyRevoke(ACCESS, 'trade', {expected_revision: '', reason: 'Counterparty credential leaked'}), error => error.code === 'INVALID_INPUT');
  assert.equal(calls.length, 0);
  const result = await api.emergencyRevoke(ACCESS, 'trade', {expected_revision: '5', reason: 'Counterparty credential leaked'});
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].path, `/api/v1/lp/downstream/access/${ACCESS}/credentials/trade/emergency-revoke`);
  assert.deepEqual(JSON.parse(calls[0].body), {expected_revision: '5', reason: 'Counterparty credential leaked'});
  assert.equal(result.new_orders_stopped, true);
  assert.equal(result.open_trades_remain, true);
  assert.equal(result.active_use.open_positions, '3');
  assert.equal(JSON.stringify(result).includes('flat'), false);
  const unconfirmed = recorder([{body: {grant: grant(), role: 'trade', session_id: TSESSION, credential_revision: '2', reason: 'Counterparty credential leaked', active_use: {open_positions: '0', pending_orders: '0', unresolved_commands: '0', configuration_uses: '0'}, open_trades_remain: false, session_cut: 'committed_propagating'}}]);
  await assert.rejects(unconfirmed.api.emergencyRevoke(ACCESS, 'trade', {expected_revision: '5', reason: 'Counterparty credential leaked'}), /not confirmed/);
});

test('counterparty save and credential revoke use strict bodies', async () => {
  const {calls, api} = recorder([{body: {counterparty_id: 'trivanta-b', display_name: 'Trivanta B', status: 'active', revision: '1'}}, {body: grant()}]);
  await api.saveCounterparty('trivanta-b', {display_name: 'Trivanta B', status: 'active', expected_revision: '0'});
  assert.deepEqual(JSON.parse(calls[0].body), {display_name: 'Trivanta B', status: 'active', expected_revision: '0'});
  await assert.rejects(api.saveCounterparty('Trivanta', {display_name: 'x', status: 'active', expected_revision: '0'}), error => error.code === 'INVALID_INPUT');
  await api.revoke(ACCESS, 'quote', {expected_revision: '7'});
  assert.equal(calls[1].method, 'DELETE');
  assert.deepEqual(JSON.parse(calls[1].body), {expected_revision: '7'});
});
