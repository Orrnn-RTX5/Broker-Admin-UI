import test from 'node:test';
import assert from 'node:assert/strict';
import {
 AUTO_BOOTSTRAP_RUN_TIMEOUT_MS,
 buildAutoBootstrapPut,
 describeAutoBootstrapRun,
 readAutoBootstrapConfig,
 readAutoBootstrapRefusal,
 readAutoBootstrapRun,
 readAutoBootstrapStatus,
} from './autoBootstrap.js';

// Generic fixtures only: no broker, login, group or host values.
const configBody = (overrides = {}) => ({
 broker_id: 'broker-a',
 configured: true,
 enabled: false,
 attestation: {execution: 'Execution text', risk: 'Risk text', fx: 'FX text'},
 accept_group_commissions: true,
 zero_commission_reason: 'Promotional zero commission',
 symbol_groups: ['GroupA', 'GroupB'],
 close_counterparts: {profit: 'PROFIT_X', swap: 'SWAP_X', commission: 'COMMISSION_X', fee: 'FEE_X'},
 open_commission_counterpart: 'OPEN_X',
 updated_by: 'manager:100001',
 updated_at: '2026-10-28T13:05:00Z',
 ...overrides,
});
const runBody = (overrides = {}) => ({
 id: 17,
 broker_id: 'broker-a',
 trigger: 'operator:manager:100001',
 started_at: '2026-10-28T13:10:00Z',
 finished_at: '2026-10-28T13:10:04Z',
 outcome: 'activated',
 reason: '',
 blockers: [],
 warnings: [],
 steps: {generate: 'ok', preview: 'ok', activate: 'ok', close_counterparts: 'ok', onboarding: 'kicked'},
 draft_hash: 'a'.repeat(64),
 fingerprint: 'b'.repeat(64),
 policy_version_id: 'pv-1',
 actor: 'system:auto-bootstrap',
 ...overrides,
});

test('config normalizes the GET body and keeps every field for the round trip', () => {
 const config = readAutoBootstrapConfig(configBody());
 assert.equal(config.configured, true);
 assert.equal(config.enabled, false);
 assert.deepEqual(config.attestation, {execution: 'Execution text', risk: 'Risk text', fx: 'FX text'});
 assert.deepEqual(config.symbol_groups, ['GroupA', 'GroupB']);
 assert.deepEqual(config.close_counterparts, {profit: 'PROFIT_X', swap: 'SWAP_X', commission: 'COMMISSION_X', fee: 'FEE_X'});
 assert.equal(config.updated_at, '2026-10-28T13:05:00Z');
});

test('config with no row keeps null symbol groups and empty texts', () => {
 const config = readAutoBootstrapConfig(configBody({
  configured: false, enabled: false, symbol_groups: null, updated_by: '', updated_at: null,
  attestation: {execution: '', risk: '', fx: ''}, close_counterparts: {profit: '', swap: '', commission: '', fee: ''},
  open_commission_counterpart: '', zero_commission_reason: '', accept_group_commissions: false,
 }));
 assert.equal(config.configured, false);
 assert.equal(config.symbol_groups, null);
 assert.equal(config.updated_at, null);
});

test('config refuses a body with the wrong shape', () => {
 assert.throws(() => readAutoBootstrapConfig(null), /unreadable/);
 assert.throws(() => readAutoBootstrapConfig([]), /unreadable/);
 assert.throws(() => readAutoBootstrapConfig(configBody({enabled: 'yes'})), /unreadable/);
 assert.throws(() => readAutoBootstrapConfig(configBody({symbol_groups: 'GroupA'})), /unreadable/);
 assert.throws(() => readAutoBootstrapConfig(configBody({symbol_groups: [1]})), /unreadable/);
 assert.throws(() => readAutoBootstrapConfig(configBody({close_counterparts: {profit: ''}})), /unreadable/);
});

test('PUT round trip sends the form toggle and texts, and every other field exactly as read', () => {
 const config = readAutoBootstrapConfig(configBody());
 const body = buildAutoBootstrapPut(config, {enabled: true, execution: '  New execution  ', risk: 'New risk', fx: 'New fx'});
 assert.deepEqual(body, {
  enabled: true,
  attestation: {execution: 'New execution', risk: 'New risk', fx: 'New fx'},
  accept_group_commissions: true,
  zero_commission_reason: 'Promotional zero commission',
  symbol_groups: ['GroupA', 'GroupB'],
  close_counterparts: {profit: 'PROFIT_X', swap: 'SWAP_X', commission: 'COMMISSION_X', fee: 'FEE_X'},
  open_commission_counterpart: 'OPEN_X',
 });
 for (const key of ['broker_id', 'configured', 'updated_by', 'updated_at']) assert.ok(!(key in body));
});

// Contract §2/§5: the PUT body is closed (the GET fields minus broker_id,
// configured, updated_by, updated_at); any other field is a 400 INVALID_REQUEST.
// So a field the GET adds later is never echoed back.
test('PUT sends exactly the contract fields, never an unknown field from the GET', () => {
 const config = readAutoBootstrapConfig(configBody({
  future_field: 'x',
  close_counterparts: {profit: 'PROFIT_X', swap: 'SWAP_X', commission: 'COMMISSION_X', fee: 'FEE_X', extra: 'EXTRA_X'},
 }));
 const body = buildAutoBootstrapPut(config, {enabled: false, execution: '', risk: '', fx: ''});
 assert.deepEqual(Object.keys(body).sort(), ['accept_group_commissions', 'attestation', 'close_counterparts', 'enabled', 'open_commission_counterpart', 'symbol_groups', 'zero_commission_reason']);
 assert.deepEqual(Object.keys(body.close_counterparts).sort(), ['commission', 'fee', 'profit', 'swap']);
 assert.deepEqual(Object.keys(body.attestation).sort(), ['execution', 'fx', 'risk']);
});

test('PUT body does not share arrays or objects with the loaded config', () => {
 const config = readAutoBootstrapConfig(configBody());
 const body = buildAutoBootstrapPut(config, {enabled: false, execution: '', risk: '', fx: ''});
 body.symbol_groups.push('Extra');
 body.close_counterparts.fee = 'CHANGED';
 assert.deepEqual(config.symbol_groups, ['GroupA', 'GroupB']);
 assert.equal(config.close_counterparts.fee, 'FEE_X');
});

test('PUT keeps null symbol groups and empty counterparts when they were not set', () => {
 const config = readAutoBootstrapConfig(configBody({symbol_groups: null, close_counterparts: {profit: '', swap: '', commission: '', fee: ''}, open_commission_counterpart: ''}));
 const body = buildAutoBootstrapPut(config, {enabled: false, execution: '', risk: '', fx: ''});
 assert.equal(body.symbol_groups, null);
 assert.deepEqual(body.close_counterparts, {profit: '', swap: '', commission: '', fee: ''});
 assert.equal(body.open_commission_counterpart, '');
});

test('enabling refuses when an attestation is blank and names each missing text', () => {
 const config = readAutoBootstrapConfig(configBody());
 assert.throws(() => buildAutoBootstrapPut(config, {enabled: true, execution: 'x', risk: '   ', fx: 'y'}), /Enter the Risk policy attestation before enabling/);
 assert.throws(() => buildAutoBootstrapPut(config, {enabled: true, execution: '', risk: '', fx: ''}), /Execution policy, Risk policy, FX conversion policy attestation/);
 assert.throws(() => buildAutoBootstrapPut(config, {enabled: true, execution: 'x', risk: 'y', fx: ''}), /FX conversion policy attestation/);
});

test('disabled allows blank attestation texts', () => {
 const config = readAutoBootstrapConfig(configBody());
 const body = buildAutoBootstrapPut(config, {enabled: false, execution: '', risk: '', fx: ''});
 assert.equal(body.enabled, false);
 assert.deepEqual(body.attestation, {execution: '', risk: '', fx: ''});
});

test('an attestation over 2000 characters is refused before sending', () => {
 const config = readAutoBootstrapConfig(configBody());
 assert.throws(() => buildAutoBootstrapPut(config, {enabled: false, execution: 'x'.repeat(2001), risk: '', fx: ''}), /at most 2000 characters/);
 assert.doesNotThrow(() => buildAutoBootstrapPut(config, {enabled: false, execution: 'x'.repeat(2000), risk: '', fx: ''}));
});

test('PUT refuses an unloaded config', () => {
 assert.throws(() => buildAutoBootstrapPut(null, {enabled: false, execution: '', risk: '', fx: ''}), /unreadable/);
});

test('every known run outcome is read and described', () => {
 const activated = readAutoBootstrapRun(runBody());
 assert.equal(activated.outcome, 'activated');
 assert.equal(activated.draftHash, 'a'.repeat(64));
 assert.equal(activated.finishedAt, '2026-10-28T13:10:04Z');
 assert.deepEqual(activated.steps, {generate: 'ok', preview: 'ok', activate: 'ok', close_counterparts: 'ok', onboarding: 'kicked'});
 assert.equal(describeAutoBootstrapRun(activated), `Activated at 2026-10-28T13:10:04Z, draft ${'a'.repeat(64)}`);

 const blocked = readAutoBootstrapRun(runBody({
  outcome: 'blocked',
  blockers: [{code: 'account_not_quiescent', subject: 'Account 100002', message: 'open positions remain'}],
  steps: {generate: 'blocked', preview: '-', activate: '-', close_counterparts: '-', onboarding: '-'},
 }));
 assert.equal(blocked.blockers.length, 1);
 assert.deepEqual(blocked.blockers[0], {code: 'account_not_quiescent', subject: 'Account 100002', message: 'open positions remain'});
 assert.equal(describeAutoBootstrapRun(blocked), 'Blocked at 2026-10-28T13:10:04Z: 1 blocker must be resolved');

 const skipped = readAutoBootstrapRun(runBody({outcome: 'skipped', reason: 'attestation_missing'}));
 assert.equal(describeAutoBootstrapRun(skipped), 'Skipped at 2026-10-28T13:10:04Z (reason: attestation_missing)');

 const failed = readAutoBootstrapRun(runBody({outcome: 'failed', reason: 'storage_error'}));
 assert.equal(describeAutoBootstrapRun(failed), 'Failed at 2026-10-28T13:10:04Z (reason: storage_error)');

 const active = readAutoBootstrapRun(runBody({outcome: 'already_active', reason: 'existing_lineage'}));
 assert.match(describeAutoBootstrapRun(active), /^Already active at .*nothing was changed \(reason: existing_lineage\)$/);
});

test('an activated run whose close counterparts failed keeps the activation and its reason', () => {
 const run = readAutoBootstrapRun(runBody({reason: 'close_counterparts_failed', steps: {close_counterparts: 'failed'}}));
 assert.equal(run.outcome, 'activated');
 assert.match(describeAutoBootstrapRun(run), /^Activated at .*, draft a+ \(reason: close_counterparts_failed\)$/);
});

test('an unknown run outcome is passed through, not dropped', () => {
 const run = readAutoBootstrapRun(runBody({outcome: 'quarantined', reason: 'new_reason'}));
 assert.equal(run.outcome, 'quarantined');
 assert.equal(describeAutoBootstrapRun(run), 'Outcome "quarantined" at 2026-10-28T13:10:04Z (reason: new_reason)');
});

test('run keeps warnings and tolerates missing finish time', () => {
 const run = readAutoBootstrapRun(runBody({
  warnings: [{code: 'symbol_without_fx_path', subject: 'Group A:SYM', message: 'no FX path'}],
  finished_at: null,
 }));
 assert.equal(run.warnings[0].code, 'symbol_without_fx_path');
 assert.equal(run.finishedAt, null);
 assert.equal(describeAutoBootstrapRun(run), `Activated at 2026-10-28T13:10:00Z, draft ${'a'.repeat(64)}`);
});

test('run refuses unreadable blockers and a missing outcome', () => {
 assert.throws(() => readAutoBootstrapRun(runBody({outcome: ''})), /unreadable/);
 assert.throws(() => readAutoBootstrapRun(runBody({blockers: 'x'})), /no readable blockers list/);
 assert.throws(() => readAutoBootstrapRun(runBody({blockers: [{code: 'x'}]})), /blocker is unreadable/);
 assert.throws(() => readAutoBootstrapRun(null), /unreadable/);
});

test('status parses a running state with a last run, lineage and health reason', () => {
 const status = readAutoBootstrapStatus({
  running: true,
  last_run: runBody({outcome: 'already_active', reason: 'existing_lineage'}),
  next_attempt_at: '2026-10-28T13:15:00Z',
  lineage: 'active',
  health_reason: 'calculation_auto_bootstrap_blocked:account_not_quiescent(+2)',
 });
 assert.equal(status.running, true);
 assert.equal(status.lastRun.outcome, 'already_active');
 assert.equal(status.nextAttemptAt, '2026-10-28T13:15:00Z');
 assert.equal(status.lineage, 'active');
 assert.equal(status.healthReason, 'calculation_auto_bootstrap_blocked:account_not_quiescent(+2)');
});

test('status with no run and no next attempt', () => {
 const status = readAutoBootstrapStatus({running: false, last_run: null, next_attempt_at: null, lineage: 'absent', health_reason: ''});
 assert.equal(status.running, false);
 assert.equal(status.lastRun, null);
 assert.equal(status.nextAttemptAt, null);
 assert.equal(status.lineage, 'absent');
 assert.equal(status.healthReason, '');
});

test('status refuses a body without running or lineage', () => {
 assert.throws(() => readAutoBootstrapStatus({lineage: 'absent'}), /status is unreadable/);
 assert.throws(() => readAutoBootstrapStatus({running: false}), /status is unreadable/);
 assert.throws(() => readAutoBootstrapStatus(null), /status is unreadable/);
});

test('the run timeout is 75 seconds', () => {
 assert.equal(AUTO_BOOTSTRAP_RUN_TIMEOUT_MS, 75000);
});

test('400 names the field and the message', () => {
 assert.equal(readAutoBootstrapRefusal({status: 400, data: {error: 'INVALID_AUTO_BOOTSTRAP_CONFIG', field: 'attestation.risk', message: 'attestation.risk is required when enabled is true'}}),
  'attestation.risk is required when enabled is true');
 assert.equal(readAutoBootstrapRefusal({status: 400, data: {error: 'INVALID_AUTO_BOOTSTRAP_CONFIG', field: 'close_counterparts', message: 'set all four purposes or none'}}),
  'close_counterparts: set all four purposes or none');
 assert.equal(readAutoBootstrapRefusal({status: 400, data: {error: 'INVALID_REQUEST'}}), 'The automatic bootstrap settings are invalid.');
});

test('403 keeps the authority wording of the server', () => {
 const text = readAutoBootstrapRefusal({status: 403, data: {error: 'POLICY_RELEASE_FORBIDDEN', message: 'The manager is not an enabled admin of this broker.'}});
 assert.match(text, /not an enabled admin of this broker/);
 assert.match(text, /POLICY_RELEASE_FORBIDDEN/);
 assert.match(readAutoBootstrapRefusal({status: 403, data: {error: 'POLICY_RELEASE_FORBIDDEN'}}), /authority is required \(POLICY_RELEASE_FORBIDDEN\)/);
 assert.match(readAutoBootstrapRefusal({status: 403, data: ''}), /Current broker administrator authority is required/);
});

test('404 says the server does not have auto-bootstrap yet, whatever the body says', () => {
 assert.equal(readAutoBootstrapRefusal({status: 404, data: '404 page not found'}), 'Auto-bootstrap is not available on this server yet (HTTP 404).');
 assert.equal(readAutoBootstrapRefusal({status: 404, data: {error: 'ACCOUNT_NOT_FOUND', message: 'no such account'}}), 'Auto-bootstrap is not available on this server yet (HTTP 404).');
});

test('409 busy says a run is already in progress', () => {
 assert.equal(readAutoBootstrapRefusal({status: 409, data: {error: 'AUTO_BOOTSTRAP_BUSY', message: 'A bootstrap for this broker is already running; retry in a few seconds'}}),
  'A bootstrap run is already in progress.');
});

test('413 and 503 name the limit or the unavailability and the HTTP status', () => {
 assert.match(readAutoBootstrapRefusal({status: 413, data: {error: 'over_size'}}), /64 KiB.*HTTP 413/);
 assert.match(readAutoBootstrapRefusal({status: 503, data: {error: 'POLICY_RELEASE_UNAVAILABLE', message: 'gateway down'}}), /unavailable \(HTTP 503\)/);
});

test('other statuses name the HTTP status and the server message', () => {
 assert.equal(readAutoBootstrapRefusal({status: 500, data: {message: 'boom'}}), 'boom (HTTP 500).');
 assert.equal(readAutoBootstrapRefusal({status: 401, data: ''}), 'The automatic bootstrap request was not confirmed (HTTP 401).');
 assert.equal(readAutoBootstrapRefusal(undefined), 'The automatic bootstrap request was not confirmed (HTTP error).');
});
