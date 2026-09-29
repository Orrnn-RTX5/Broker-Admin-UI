import '../qa-shared/guard.js';
import {alerts, assert, button, click, defineSteps, eq, hasText, isDisabled, mount, region, setValue, signIn, statuses, stubRequest, text, waitFor} from '../qa-shared/page-kit.js';
import LPNativePendingEnablementPanel, {NATIVE_PENDING_EXPLANATION} from '/src/components/organisms/LPNativePendingEnablementPanel.jsx';
import {createLPNativePendingEnablementAPI} from '/src/services/lpNativePendingEnablement.js';
import '/src/index.css';

// A-book native pending enablement (migration 339) over a stubbed transport.
const BINDING = 'a'.repeat(64);
const EVIDENCE = {evidence: [
  {connection_id: 'named-one', symbol: 'BTCUSD', revision: 7, native_pending: true, native_control: {supports_cancel: true}},
  {connection_id: 'named-one', symbol: 'XAUUSD', revision: 3, exact_demo_sizing: {id: 'x'}},
]};
const unconfigured = {configured: false, application: 'new_native_pending_placements_only', status: {saved: null, current_evidence_revision: '7', current_binding: BINDING, binding_current: false, cancel_evidence_current: true, effective: false}};
const saved = (patch = {}, status = {}) => ({configured: true, application: 'new_native_pending_placements_only', status: {
  saved: {connection_id: 'named-one', symbol: 'BTCUSD', revision: '1', enabled: true, allow_limit: true, allow_stop: false, allow_gtc: true, allow_gtd: false, connection_revision: '2', evidence_revision: '7', native_pending_evidence_id: 'pending-1', native_control_evidence_id: 'cancel-1', capability_binding: BINDING, actor_login: '9000', reason: 'GTC limit acceptance step 1', created_at: '2026-09-28T12:00:00Z', ...patch},
  current_evidence_revision: '7', current_binding: BINDING, binding_current: true, cancel_evidence_current: true, effective: true, ...status,
}});
const disabledRecord = (revision = '2') => saved({revision, enabled: false, allow_limit: false, allow_gtc: false, capability_binding: '', reason: 'Disable after QA review'}, {effective: false, binding_current: false});

let stub;
function start({list = {body: EVIDENCE}, get = {body: unconfigured}, put} = {}) {
  stub = stubRequest(call => {
    if (call.path === '/api/v1/manager/lp-routing/evidence') return list;
    if (call.method === 'GET') return get;
    return typeof put === 'function' ? put(call) : put;
  });
  signIn(undefined, `qa-${Math.random()}`);
  mount(<LPNativePendingEnablementPanel api={createLPNativePendingEnablementAPI(stub.request)}/>);
}
const panel = () => region('A-book native pending enablement');
async function loadBTC() {
  const select = await waitFor(() => { const s = region('Native pending instrument'); return s && s.options.length === 3 && s; }, 'evidence list');
  setValue(select, 'named-one\u0000BTCUSD');
  click(await waitFor(() => { const b = button('Load enablement', panel()); return b && !b.disabled && b; }, 'load enabled'), 'Load enablement');
  return waitFor(() => panel().querySelector('form'), 'enablement form');
}
async function fillEnable({confirm = true} = {}) {
  click(region('Enable native pending'), 'enable');
  await waitFor(() => !region('Allow Limit').disabled, 'flags enabled');
  click(region('Allow Limit'), 'limit');
  click(region('Allow GTC'), 'gtc');
  setValue(region('Enablement reason'), 'GTC limit acceptance step 1');
  const save = button('Save enablement', panel());
  assert(save.disabled, 'enable needs the evidence review confirmation');
  if (confirm) { click(region('Confirm reviewed evidence'), 'confirm'); await waitFor(() => !save.disabled, 'save enabled'); }
  return save;
}
const puts = () => stub.calls.filter(c => c.method === 'PUT');

defineSteps([
  ['default-off-and-explicit-review', async () => {
    start();
    const form = await loadBTC();
    const select = region('Native pending instrument');
    assert(text(select).includes('named-one / XAUUSD (evidence r3, exact demo sizing, no native pending evidence, no cancel evidence)'), 'evidence limits listed');
    assert(text(form).includes('No saved revision: disabled by default.') && text(form).includes('Effective: no.'), 'default off');
    assert(hasText(NATIVE_PENDING_EXPLANATION, panel()), 'explanation');
    assert(['Allow Limit', 'Allow Stop', 'Allow GTC', 'Allow GTD'].every(label => region(label).disabled), 'flags disabled while off');
    assert(!region('Confirm reviewed evidence'), 'no confirmation while off');
    const save = await fillEnable({confirm: false});
    assert(text(panel()).includes('I reviewed evidence revision 7 and the live acceptance abort rules'), 'confirmation names the evidence revision');
    assert(save.disabled, 'Save enablement stays disabled before the review confirmation');
    panel().querySelector('form').requestSubmit();
    await new Promise(resolve => setTimeout(resolve, 60));
    eq(puts().length, 0, 'a forced submit sends nothing before the review confirmation');
    return {offByDefault: true};
  }],
  ['enable-confirmed-by-server', async () => {
    start({put: {body: saved()}});
    await loadBTC();
    click(await fillEnable(), 'Save enablement');
    await waitFor(() => statuses(panel()).some(s => s.startsWith('Saved revision 1: enabled for evidence revision 7.')), 'saved notice');
    eq(puts()[0].body, {expected_revision: '0', enabled: true, allow_limit: true, allow_stop: false, allow_gtc: true, allow_gtd: false, evidence_revision: '7', reason: 'GTC limit acceptance step 1'}, 'PUT body');
    eq(puts()[0].path, '/api/v1/manager/lp-routing/native-pending-enablements/named-one/BTCUSD', 'PUT path');
    assert(hasText('Bound to the current capability.', panel()), 'binding current');
    return {revision: '1'};
  }],
  ['unconfirmed-save-shows-no-success', async () => {
    const cases = [
      ['stale echo of the prior revision', {get: {body: saved()}, put: {body: saved()}}, false],
      ['disabled record returned for an enable', {put: {body: disabledRecord('1')}}, true],
      ['unconfigured answer', {put: {body: unconfigured}}, true],
    ];
    for (const [label, setup, enable] of cases) {
      start(setup);
      await loadBTC();
      if (enable) click(await fillEnable(), 'Save enablement');
      else {
        click(region('Enable native pending'), 'turn off');
        setValue(region('Enablement reason'), 'Disable after QA review');
        click(await waitFor(() => { const b = button('Save disablement', panel()); return b && !b.disabled && b; }, 'save disablement'), 'Save disablement');
      }
      await waitFor(() => alerts(panel()).length, `refusal: ${label}`);
      eq(statuses(panel()).filter(s => s.startsWith('Saved revision')).length, 0, `no saved notice: ${label}`);
      assert(hasText('Reload the enablement before another save.', panel()), `locked: ${label}`);
    }
    return {cases: cases.length};
  }],
  ['prerequisite-and-authority-errors', async () => {
    const cases = [
      [{status: 409, body: {error_code: 'NATIVE_PENDING_NATIVE_CANCEL_EVIDENCE_REQUIRED'}}, 'Save current native cancellation evidence before enabling placement.', true],
      [{status: 409, body: {error_code: 'CONFIGURATION_CONFLICT'}}, 'The saved enablement or evidence changed. Reload and review before saving.', true],
      [{status: 503, body: {error_code: 'NATIVE_PENDING_ENABLEMENT_UNAVAILABLE'}}, 'Migration 339 or its storage is unavailable; native pending placement stays off.', true],
      [{status: 403, body: {error_code: 'FORBIDDEN'}}, 'Only a broker Admin can change native pending enablement.', false],
    ];
    for (const [reply, message, keepsForm] of cases) {
      start({put: reply});
      await loadBTC();
      click(await fillEnable(), 'Save enablement');
      await waitFor(() => alerts(panel()).includes(message), message);
      eq(Boolean(panel().querySelector('form')), keepsForm, `form ${keepsForm ? 'kept' : 'cleared'} for ${reply.body.error_code}`);
      if (keepsForm) assert(isDisabled(region('Enable native pending')), 'locked after refusal');
      else eq(region('Native pending instrument').options.length, 1, 'evidence list cleared after FORBIDDEN');
    }
    return {codes: cases.map(c => c[0].body.error_code)};
  }],
  ['non-admin-and-stale-binding', async () => {
    start({list: {status: 403, body: {error_code: 'LP_FORBIDDEN'}}});
    await waitFor(() => alerts(panel()).includes('Only a broker Admin can change native pending enablement.'), 'forbidden list');
    assert(button('Load enablement', panel()).disabled && !panel().querySelector('form'), 'no editor without authority');
    start({get: {body: saved({}, {binding_current: false, effective: false})}});
    const form = await loadBTC();
    assert(text(form).includes('Stale: the capability or connection changed since enabling; placement is off until re-enabled.') && text(form).includes('Effective: no.'), 'stale binding shown as off');
    return {stale: true};
  }],
]);
