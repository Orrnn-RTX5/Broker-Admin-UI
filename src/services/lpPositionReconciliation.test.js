import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('./lpPositionReconciliation.js', import.meta.url), 'utf8');
const {validatePositionReconciliation, createLPPositionReconciliation, positionReconciliationErrorMessage} = await import('data:text/javascript;base64,' + Buffer.from(source.replace("import { api } from '../lib/api.js';", 'const api = {};')).toString('base64'));
const now = Date.parse('2026-10-02T12:00:02Z');
const observation = () => ({connection_id:'trade',connection_revision:4,request_id:'read-42',requested_at:'2026-10-02T12:00:00Z',completed_at:'2026-10-02T12:00:01Z',valid_until:'2026-10-02T12:00:21Z',positions_flat_observed:false,orders_checked:false,comparison:{matched:true,expected_count:1,observed_count:1,unresolved:0,discrepancies:[]}});
const position = (quantity = '9007199254740993.000000000000000001') => ({position_id:'position-1',symbol_id:'symbol-1',side:'buy',wire_quantity:quantity});
test('position comparison fetches only the selected connection and validates its revision', async () => {
  const paths=[];
  const client=createLPPositionReconciliation(async path => {paths.push(path);return observation();}, () => now);
  assert.equal((await client.get('trade',4)).comparison.matched,true);
  assert.deepEqual(paths,['/api/v1/manager/lp-connections/trade/position-reconciliation']);
  await assert.rejects(() => client.get('trade',3), /unavailable/);
  await assert.rejects(() => client.get('../foreign'), /saved provider/);
});
test('position comparison refuses stale, foreign and contradictory certainty', () => {
  const value=observation();
  assert.throws(() => validatePositionReconciliation(value,'foreign',now), /unavailable/);
  assert.throws(() => validatePositionReconciliation(value,'trade',Date.parse(value.valid_until)), /unavailable/);
  value.orders_checked=true;assert.throws(() => validatePositionReconciliation(value,'trade',now));value.orders_checked=false;
  value.comparison.unresolved=1;assert.throws(() => validatePositionReconciliation(value,'trade',now));value.comparison.matched=false;
  assert.equal(validatePositionReconciliation(value,'trade',now).comparison.unresolved,1);
  value.comparison.observed_count=2;assert.throws(() => validatePositionReconciliation(value,'trade',now));value.comparison.observed_count=1;
  value.positions_flat_observed=true;assert.throws(() => validatePositionReconciliation(value,'trade',now));
});
test('position discrepancies retain exact quantities and require matching position identities', () => {
  const value=observation();value.comparison.matched=false;
  value.comparison.discrepancies=[{position_id:'position-1',reason:'position_differs',expected:position(),observed:position('10')}];
  assert.equal(validatePositionReconciliation(value,'trade',now).comparison.discrepancies[0].expected.wire_quantity,'9007199254740993.000000000000000001');
  value.comparison.discrepancies[0].observed=position();assert.throws(() => validatePositionReconciliation(value,'trade',now));
  value.comparison.discrepancies[0].observed={...position('10'),position_id:'other'};assert.throws(() => validatePositionReconciliation(value,'trade',now));
  value.comparison.discrepancies[0].observed=position('10.0');assert.throws(() => validatePositionReconciliation(value,'trade',now));
});
test('zero observed positions keeps unresolved allocations visible and orders unknown', () => {
  const value=observation();value.positions_flat_observed=true;
  value.comparison={matched:false,expected_count:1,observed_count:0,unresolved:2,discrepancies:[{position_id:'position-1',reason:'missing_at_lp',expected:position('10')}]};
  assert.equal(validatePositionReconciliation(value,'trade',now).positions_flat_observed,true);
});
test('provider comparison errors explain origin changes, changed evidence and permission refusal without reflecting raw text', async () => {
  const failures = [
    ['LP_POSITION_ORIGIN_CHANGED', /different provider account/],
    ['LP_POSITION_LEDGER_CHANGED', /changed during the provider read/],
    ['LP_POSITION_SNAPSHOT_UNAVAILABLE', /complete current provider/],
    ['LP_POSITION_LEDGER_UNAVAILABLE', /evidence is unavailable or unresolved/],
    ['LP_POSITION_RECONCILIATION_UNAVAILABLE', /unavailable for this connection/],
    ['LP_PERMISSION_DENIED', /permissions do not allow/],
    ['LP_FORBIDDEN', /administrator session/],
  ];
  for (const [code, message] of failures) {
    const client = createLPPositionReconciliation(async () => { throw {response:{data:{error_code:code,message:'private-account secret provider text'}},message:'private raw text'}; }, () => now);
    await assert.rejects(() => client.get('trade'), error => message.test(error.message) && !/private|secret/.test(error.message));
  }
  assert.equal(positionReconciliationErrorMessage('private-account secret'), positionReconciliationErrorMessage());
  assert.equal(positionReconciliationErrorMessage('__proto__'), positionReconciliationErrorMessage());
  assert.equal(positionReconciliationErrorMessage('constructor'), positionReconciliationErrorMessage());
  const unknown = createLPPositionReconciliation(async () => {throw new Error('provider password secret');}, () => now);
  await assert.rejects(() => unknown.get('trade'), error => error.message === positionReconciliationErrorMessage());
});
