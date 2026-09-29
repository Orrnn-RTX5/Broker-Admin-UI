import '../qa-shared/guard.js';
import {alerts, assert, button, click, defineSteps, eq, hasText, isDisabled, mount, region, setValue, signIn, statuses, stubRequest, text, waitFor} from '../qa-shared/page-kit.js';
import BrokerCapabilitiesPanel from '/src/components/organisms/BrokerCapabilitiesPanel.jsx';
import PrivateFIXReadinessPanel from '/src/components/organisms/PrivateFIXReadinessPanel.jsx';
import {CAPABILITY_KEYS, createBrokerCapabilitiesAPI} from '/src/services/brokerCapabilities.js';
import {createPrivateFIXReadinessAPI} from '/src/services/privateFixReadiness.js';
import '/src/index.css';

// Broker capability registry (G4/G5/G14) and B-book private FIX readiness
// (G6/G7) as mounted together in GatewaysView, over stubbed transports.
const reason = (code, subject) => ({code, ...(subject ? {subject} : {}), required_step: `Step for ${code}.`});
const cap = (key, patch = {}) => ({
  key, title: `Title ${key}`, owner: key.startsWith('exact') ? 'gateway' : 'bridge', compiled_constant: `${key}Enabled`, required_migrations: ['338_broker_capability_registry.sql'],
  receipt_suite: `heavy-verification/${key}`, depends_on: [], pending_decisions: [], conflict: 'c', compiled_in: false, desired_enabled: false, revision: '0',
  prerequisites_met: false, effective: false, reasons: [reason('DESIRED_OFF'), reason('NOT_COMPILED_IN', `${key}Enabled`)], change_blockers: [],
  conflict_in_flight: 0, conflict_readable: true, effective_requires_compiled_in: true, ...patch,
});
const env = patch => ({key: 'internal_fix', title: 'Private FIX', env: 'RTX5_INTERNAL_FIX_ENABLED', owner: 'gateway', state: 'enabled', reason_code: 'ENV_ENABLED', required_step: 'Protected deployment step.', hot_enable: false, ...patch});
const view = (patch = {}, caps = {}) => ({
  tenant_id: 'broker-one', observed_at: '2026-09-28T00:00:00Z', registry_ready: true, change_authority: 'broker_admin',
  capabilities: CAPABILITY_KEYS.map(key => cap(key, caps[key])),
  environment: [env(), env({key: 'hub_pending', title: 'Exact hub pending', env: 'RTX5_EXACT_HUB_PENDING', reason_code: 'ENV_ENABLED_CODE_GATED'}), env({key: 'c09', title: 'C09 admin', env: 'RTX5_C09_DOWNSTREAM_ADMIN_ENABLED', owner: 'manager', state: 'unobserved', reason_code: 'OWNER_UNOBSERVED'})],
  ...patch,
});
const blockers = {d01_recovery_actions: {change_blockers: [reason('ACTIVE_BUSINESS_CONFLICT', 'lp_cleanup_closure_schedule')], conflict_in_flight: 1}};
const readiness = patch => ({
  tenant_id: 'broker-one', observed_at: '2026-09-28T00:00:00Z', expires_at: '2026-09-28T00:00:05Z', named_lp_required: false, deployment: 'enabled',
  configured: true, session: 'connected', dispatch_schema_ready: true, composed: true, lifecycle_live: true, claiming: true,
  recovery_backlog: {available: true, unacknowledged: 2, possibly_sent: 1, oldest_age_seconds: 3, truncated: false}, last_error_code: '', ready: true, ...patch,
});

let capStub, fixStub;
function start({capGet = {body: view({}, blockers)}, capPut, fixGet = {body: readiness()}} = {}) {
  capStub = stubRequest(call => call.method === 'GET' ? capGet : (typeof capPut === 'function' ? capPut(call) : capPut));
  fixStub = stubRequest(() => fixGet);
  signIn(undefined, `qa-${Math.random()}`);
  mount(<><PrivateFIXReadinessPanel api={createPrivateFIXReadinessAPI(fixStub.request)}/><BrokerCapabilitiesPanel api={createBrokerCapabilitiesAPI(capStub.request)}/></>);
}
const caps = () => region('Broker capabilities');
const fix = () => region('B-book private FIX readiness');
const row = key => region(`Capability ${key}`);
const loaded = () => waitFor(() => row('exact_pending_modify') && fix() && !hasText('Loading', fix()) && hasText('Observed', fix()) && row('exact_pending_modify'), 'capabilities and readiness');
async function requestChange(key, reasonText) {
  setValue(region(`Reason for ${key}`), reasonText);
  click(button('Set desired on', row(key)), `Set desired on ${key}`);
}

defineSteps([
  ['registry-renders-server-state-verbatim', async () => {
    start();
    await loaded();
    for (const key of CAPABILITY_KEYS) {
      const body = text(row(key));
      assert(body.includes('EffectiveOFF'), `${key} effective OFF`);
      assert(body.includes('DESIRED_OFF') && body.includes(`NOT_COMPILED_IN ${key}Enabled: Step for NOT_COMPILED_IN.`), `${key} reasons verbatim`);
      assert(body.includes(`Recording "on" does not enable anything in this build`), `${key} not-compiled-in note`);
    }
    const blocked = row('d01_recovery_actions');
    assert(isDisabled(region('Reason for d01_recovery_actions')) && isDisabled(button('Set desired on', blocked)), 'change blocked while business is in flight');
    assert(text(blocked).includes('ACTIVE_BUSINESS_CONFLICT lp_cleanup_closure_schedule'), 'blocker shown');
    assert(!isDisabled(button('Set desired on', row('exact_pending_modify'))), 'unblocked capability can record a desired state');
    const table = region('Deployment-gated features');
    eq(table.querySelectorAll('input,button,select').length, 0, 'deployment-gated features are read only');
    assert(text(table).includes('ENV_ENABLED_CODE_GATED') && text(table).includes('unobserved'), 'env states verbatim');
    return {capabilities: CAPABILITY_KEYS.length};
  }],
  ['desired-on-recorded-effective-stays-off', async () => {
    start({capPut: call => ({body: view({}, {exact_pending_modify: {desired_enabled: true, revision: '1', reasons: [reason('NOT_COMPILED_IN', 'exact_pending_modifyEnabled')], last_actor_login: '9000', last_changed_at: '2026-09-28T01:00:00Z', last_reason: call.body.reason}})})});
    await loaded();
    await requestChange('exact_pending_modify', 'enable after heavy suite review');
    await waitFor(() => statuses(caps()).includes('Recorded desired on for exact_pending_modify at revision 1. Effective: OFF.'), 'recorded notice');
    eq(capStub.calls.find(c => c.method === 'PUT').body, {expected_revision: '0', desired_enabled: true, reason: 'enable after heavy suite review'}, 'PUT body');
    eq(capStub.calls.find(c => c.method === 'PUT').path, '/api/v1/manager/runtime/capabilities/exact_pending_modify', 'PUT path');
    assert(text(row('exact_pending_modify')).includes('Effective' + 'OFF') && text(row('exact_pending_modify')).includes('on (revision 1)'), 'desired on, effective OFF');
    return {revision: '1'};
  }],
  ['unconfirmed-or-refused-change-claims-nothing', async () => {
    const cases = [
      [{body: view({}, blockers)}, 'The change was not confirmed. Reload before another change.'],
      [{status: 409, body: {error_code: 'CONFIGURATION_CONFLICT'}}, 'The capability changed since it was loaded. Reload and review before another change.'],
      [{status: 409, body: {error_code: 'CONFIGURATION_IN_USE'}}, 'Conflicting business is in flight. Wait until it resolves, then reload.'],
      [{status: 409, body: {error_code: 'CAPABILITY_UNCHANGED'}}, 'That desired state is already recorded. Reload to see the current revision.'],
      [{status: 503, body: {error_code: 'CAPABILITY_BUSINESS_UNAVAILABLE'}}, 'In-flight business could not be checked, so the change was refused. Retry later.'],
      [{status: 403, body: {error_code: 'FORBIDDEN'}}, 'Only a broker Admin can view or change capabilities.'],
    ];
    for (const [reply, message] of cases) {
      start({capPut: reply});
      await loaded();
      await requestChange('exact_pending_modify', 'enable after heavy suite review');
      await waitFor(() => alerts(caps()).includes(message), message);
      eq(statuses(caps()).filter(s => s.startsWith('Recorded')).length, 0, 'no recorded notice');
      if (reply.body.error_code === 'FORBIDDEN') assert(!row('exact_pending_modify'), 'registry hidden after FORBIDDEN');
      else assert(hasText('Reload the capabilities before another change.', caps()) && isDisabled(button('Set desired on', row('exact_pending_modify'))), 'locked after refusal');
    }
    return {cases: cases.length};
  }],
  ['registry-unavailable-and-non-admin', async () => {
    start({capGet: {body: view({registry_ready: false})}});
    await loaded();
    assert(alerts(caps()).includes('Registry storage (migration 338) is unavailable. Every capability is off and no change can be recorded.'), 'registry unavailable');
    assert(CAPABILITY_KEYS.every(key => isDisabled(button('Set desired on', row(key)))), 'every change disabled');
    start({capGet: {status: 403, body: {error_code: 'LP_PERMISSION_DENIED'}}, fixGet: {status: 403, body: {error_code: 'LP_PERMISSION_DENIED'}}});
    await waitFor(() => alerts(caps()).includes('Only a broker Admin can view or change capabilities.') && alerts(fix()).includes('This account cannot view private FIX readiness.'), 'non-admin refusals');
    eq(caps().querySelectorAll('input,fieldset').length, 0, 'no capability control for a non-Admin');
    start({capGet: {body: view({}, {exact_named_protection: {effective: true}})}});
    await waitFor(() => alerts(caps()).includes('Invalid capability registry response.'), 'effective must equal the conjunction');
    assert(!row('exact_named_protection'), 'invalid registry not rendered');
    return {cases: 3};
  }],
  ['private-fix-readiness-states', async () => {
    start();
    await loaded();
    assert(text(fix()).includes('READY: Ready.'), 'ready');
    assert(text(fix()).includes('2 unacknowledged, 1 possibly sent, oldest 3s'), 'backlog');
    eq([...fix().querySelectorAll('button')].map(b => b.textContent), ['Reload readiness'], 'read only');
    start({fixGet: {body: readiness({deployment: 'disabled', configured: false, session: 'not_configured', composed: false, lifecycle_live: false, claiming: false, ready: false, last_error_code: 'DEPLOYMENT_DISABLED'})}});
    await waitFor(() => hasText('NOT READY: Private FIX is not enabled for this Gateway (protected deployment step). (DEPLOYMENT_DISABLED)', fix()), 'not ready');
    start({fixGet: {body: readiness({last_error_code: 'SESSION_DISCONNECTED'})}});
    await waitFor(() => alerts(fix()).includes('Invalid private FIX readiness response.'), 'ready with an error code is refused');
    assert(!hasText('READY', fix()), 'no readiness claimed from an invalid read');
    return {cases: 3};
  }],
]);
