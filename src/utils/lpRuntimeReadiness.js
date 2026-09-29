const names = { gateway: ['private_fix', 'private_fix_recovery', 'market', 'customer_close', 'pending_placement', 'pending_cancel', 'pending_cancel_recovery'], bridge: ['sessions', 'execution', 'quotes', 'customer_close', 'pending_cancel', 'pending_cancel_recovery', 'cleanup', 'closed_recovery'] };
const operationName = /^[a-z][a-z0-9_]{0,63}$/;
const maxOperations = 64;
const states = new Set(['', 'connected', 'connecting', 'disabled', 'disconnected', 'failed', 'stop_failed']);
const fresh = (v, now) => {
  const at = Date.parse(v?.observed_at), end = Date.parse(v?.expires_at);
  return Number.isFinite(at) && Number.isFinite(end) && at <= now + 1000 && end > now && end > at && end - at <= 5000;
};
export function runtimeComponentFresh(component, now = Date.now()) { return component?.available === true && fresh(component, now); }
export function validateLPRuntimeReadiness(value, id, now = Date.now()) {
  if (!value || value.connection_id !== id || typeof value.tenant_id !== 'string' || !value.tenant_id || !fresh(value, now)) throw new Error('Runtime inspection unavailable.');
  for (const source of ['gateway', 'bridge']) {
    const c = value[source];
    if (!c || typeof c.available !== 'boolean') throw new Error('Runtime inspection unavailable.');
    if (!c.available) continue;
    if ((source === 'gateway' && (!c.private_fix || !['not_configured', 'connected', 'disconnected'].includes(c.private_fix.session) || typeof c.private_fix.dispatch_schema_ready !== 'boolean')) || (source === 'bridge' && c.private_fix != null)) throw new Error('Runtime inspection unavailable.');
    // Additive operations are tolerated: every known operation must appear exactly
    // once with valid state; a newer service may report further well-formed ones.
    if (!runtimeComponentFresh(c, now) || !Array.isArray(c.operations) || c.operations.length < names[source].length || c.operations.length > maxOperations) throw new Error('Runtime inspection unavailable.');
    const seen = new Set();
    c.operations.forEach(op => {
      if (typeof op?.name !== 'string' || !operationName.test(op.name) || seen.has(op.name) || ['configured', 'composed', 'lifecycle_live', 'claiming'].some(k => typeof op[k] !== 'boolean') || (op.composed && !op.configured) || (op.lifecycle_live && !op.composed) || (op.claiming && !op.lifecycle_live) || (source === 'bridge' && op.claiming)) throw new Error('Runtime inspection unavailable.');
      seen.add(op.name);
    });
    if (names[source].some(name => !seen.has(name))) throw new Error('Runtime inspection unavailable.');
    if (c.connection != null) {
      const v = c.connection;
      if (source !== 'bridge' || typeof v.enabled !== 'boolean' || typeof v.saved_revision !== 'string' || !/^[1-9][0-9]*$/.test(v.saved_revision) || typeof v.session_revision !== 'string' || !/^(0|[1-9][0-9]*)$/.test(v.session_revision) || v.saved_revision.length > 19 || v.session_revision.length > 19 || BigInt(v.session_revision) > BigInt(v.saved_revision) || (v.applied_revision !== null && (typeof v.applied_revision !== 'string' || v.applied_revision !== v.session_revision || v.applied_revision === '0')) || !states.has(v.quote) || !states.has(v.trade)) throw new Error('Runtime inspection unavailable.');
    }
  }
  return value;
}