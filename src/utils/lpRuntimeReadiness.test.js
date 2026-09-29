import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLPRuntimeReadiness, runtimeComponentFresh } from './lpRuntimeReadiness.js';
const now = Date.now();
const stamp = { observed_at: new Date(now).toISOString(), expires_at: new Date(now + 5000).toISOString() };
function response() {
  const component = names => ({ ...stamp, available: true, operations: names.map(name => ({ name, configured: false, composed: false, lifecycle_live: false, claiming: false })) });
  return { ...stamp, tenant_id: 'broker', connection_id: 'one', gateway: { ...component(['private_fix', 'private_fix_recovery', 'market', 'customer_close', 'pending_placement', 'pending_cancel', 'pending_cancel_recovery']), private_fix: { session: 'not_configured', dispatch_schema_ready: false } }, bridge: { ...component(['sessions', 'execution', 'quotes', 'customer_close', 'pending_cancel', 'pending_cancel_recovery', 'cleanup', 'closed_recovery']), connection: { saved_revision: '9007199254740993', session_revision: '9007199254740992', applied_revision: null, enabled: true, quote: 'connected', trade: 'failed' } } };
}
test('runtime inspection preserves exact saved/applied difference without inferring order eligibility', () => {
  const value = validateLPRuntimeReadiness(response(), 'one', now);
  assert.equal(value.bridge.connection.saved_revision, '9007199254740993');
  assert.equal(value.gateway.operations[0].configured, false);
  assert.equal(runtimeComponentFresh(value.bridge, now + 5000), false);
});
test('runtime inspection refuses foreign identity, stale claims and malformed operation states', () => {
  for (const mutate of [v => { v.connection_id = 'other'; }, v => { v.gateway.expires_at = new Date(now - 1).toISOString(); }, v => { v.gateway.operations[0].claiming = true; }, v => { v.bridge.connection.applied_revision = '9007199254740994'; }, v => { v.bridge.connection.saved_revision = 3; }, v => { v.gateway.private_fix.session = 'healthy'; }]) {
    const v = response(); mutate(v); assert.throws(() => validateLPRuntimeReadiness(v, 'one', now));
  }
});
test('unavailable service stays unavailable while the other service retains its own freshness', () => {
  const v = response(); v.gateway = { available: false };
  assert.equal(validateLPRuntimeReadiness(v, 'one', now).gateway.available, false);
  assert.equal(runtimeComponentFresh(v.gateway, now), false);
});
test('runtime inspection tolerates additive operations and fields but still requires every known operation', () => {
  const v = response();
  v.gateway.operations.push({ name: 'pending_modify', configured: true, composed: false, lifecycle_live: false, claiming: false, detail: 'additive' });
  v.bridge.operations.splice(2, 0, { name: 'source_gaps', configured: false, composed: false, lifecycle_live: false, claiming: false });
  v.gateway.future_field = { any: 'shape' };
  v.bridge.connection.future_field = 'x';
  const value = validateLPRuntimeReadiness(v, 'one', now);
  assert.equal(value.gateway.operations.length, 8);
  assert.equal(value.bridge.operations[2].name, 'source_gaps');
  // Reordered known operations are still accepted; identity is by name.
  const r = response(); r.bridge.operations.reverse();
  assert.equal(validateLPRuntimeReadiness(r, 'one', now).bridge.operations[0].name, 'closed_recovery');
});
test('runtime inspection refuses missing, duplicated or malformed operations even when additive ones are present', () => {
  const missing = v => { v.gateway.operations = v.gateway.operations.filter(op => op.name !== 'market'); v.gateway.operations.push({ name: 'pending_modify', configured: false, composed: false, lifecycle_live: false, claiming: false }); };
  const duplicate = v => { v.bridge.operations.push({ ...v.bridge.operations[0] }); };
  const badName = v => { v.gateway.operations.push({ name: 'Pending Modify', configured: false, composed: false, lifecycle_live: false, claiming: false }); };
  const badState = v => { v.gateway.operations.push({ name: 'pending_modify', configured: false, composed: true, lifecycle_live: false, claiming: false }); };
  const bridgeClaim = v => { v.bridge.operations.push({ name: 'source_gaps', configured: true, composed: true, lifecycle_live: true, claiming: true }); };
  const nonBoolean = v => { v.gateway.operations.push({ name: 'pending_modify', configured: 'yes', composed: false, lifecycle_live: false, claiming: false }); };
  const tooMany = v => { for (let i = 0; i < 64; i++) v.gateway.operations.push({ name: `extra_${i}`, configured: false, composed: false, lifecycle_live: false, claiming: false }); };
  for (const mutate of [missing, duplicate, badName, badState, bridgeClaim, nonBoolean, tooMany]) {
    const v = response(); mutate(v); assert.throws(() => validateLPRuntimeReadiness(v, 'one', now));
  }
});
