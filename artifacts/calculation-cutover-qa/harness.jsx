import '../qa-shared/guard.js';
import {alerts, assert, button, click, defineSteps, eq, hasText, httpError, mount, region, setValue, signIn, signOut, statuses, waitFor} from '../qa-shared/page-kit.js';
import CalculationCutoverPanel from '/src/components/organisms/CalculationCutoverPanel.jsx';
import {api} from '/src/lib/api.js';
import '/src/index.css';

// Separate calculation cutover. The panel calls the shared client directly,
// so api.request is replaced for the calculation-baseline routes only; any
// other call falls through to the QA guard adapter and is refused.
const BASE = '/api/v1/manager/calculation-baseline/';
const FP = 'a'.repeat(64), EXPORT = 'b'.repeat(64);
const PARENT = '11111111-1111-4111-8111-111111111111', ROOT = '22222222-2222-4222-8222-222222222222';
const review = (patch = {}) => ({
  kind: 'calculation_additive_cutover', ready: true, broker_id: 'test-broker', tenant_id: 'test-broker', legal_entity_id: 'entity',
  impact: 'scoped_additive_calculation_cutover', economic_equivalence: 'existing_definitions_unchanged', reason: 'dedicated XAUUSD account',
  fingerprint: FP, settings_export_hash: EXPORT, parent_policy_version_id: PARENT, root_policy_version_id: ROOT, parent_event_sequence: '7',
  blockers: [], other_accounts: [{account_login: '200001', group: 'Bidyut', reason: 'group_gains_symbols_account_not_moved'}],
  added_definitions: [{key: 's:' + 'c'.repeat(64), kind: 'symbol', group_name: 'Demo', symbol: 'XAUUSD', hash: 'd'.repeat(64)}],
  settings_review: [{group_name: 'Demo', symbol: 'XAUUSD', current_instrument_json: '{"contract_size":9007199254740993.001}', current_group_json: '{}', current_symbol_override_json: 'null', proposed: {contract_size: '100'}}],
  accounts: [{account_id: '33333333-3333-4333-8333-333333333333', account_login: '9007199254740993', group: 'Demo', currency: 'USD', cutover_kind: 'MOVED_ACCOUNT', current_policy_version_id: PARENT, previous_assignment_id: '44444444-4444-4444-8444-444444444444',
    previous_assignment_version: '1', account_revision: '12', checkpoint_source_revision: '11', checkpoint_balance: '12345678901234567890.01', checkpoint_credit: '-0.0001', checkpoint_source: 'projection-revision:12',
    open_positions: 0, pending_orders: 0, unresolved_commands: 0, in_flight_lp_uses: 0, source_hash: 'e'.repeat(64), current_hidden_opening_markup_points: '0', gained_symbols: ['XAUUSD']}],
  ...patch,
});
const release = (patch = {}) => ({state: 'ACTIVE', broker_id: 'test-broker', settings_export_hash: EXPORT, impact_report_hash: FP, ...patch});
const DRAFT = '{"reason":"dedicated XAUUSD account","move_accounts":[{"account_id":"33333333-3333-4333-8333-333333333333","account_login":200002}]}';

const realRequest = api.request.bind(api);
let calls = [], handler = () => { throw httpError(500, {}); };
api.request = async config => {
  if (!String(config.url).startsWith(BASE)) return realRequest(config);
  const call = {method: config.method, url: config.url, data: config.data, pendingSaved: Object.keys(localStorage).some(key => key.startsWith('rtx5.calculation-cutover.v1:'))};
  calls.push(call);
  return {status: 200, data: structuredClone(await handler(call))};
};

function start(nextHandler, {session = true} = {}) {
  calls = [];
  handler = nextHandler;
  localStorage.clear();
  if (session) {
    sessionStorage.setItem('auth', JSON.stringify({login: '9000', broker_id: 'test-broker', session_scope: 'qa-session'}));
    signIn({role: 'admin', is_admin: true}, 'qa-cutover');
  } else {
    sessionStorage.removeItem('auth');
    signOut();
  }
  mount(<CalculationCutoverPanel key={Math.random()} sessionKey={`qa-${Math.random()}`}/>);
}
const panel = () => region('Calculation cutover for new accounts and symbols');
const field = prefix => [...panel().querySelectorAll('label')].find(label => label.textContent.startsWith(prefix))?.querySelector('input,textarea');
async function reviewDraft(draft = DRAFT) {
  await waitFor(() => field('Account login'), 'form');
  setValue(field('Account login'), '9007199254740993');
  setValue(field('Cutover JSON'), draft);
  click(await waitFor(() => { const b = button('Review cutover', panel()); return b && !b.disabled && b; }, 'review enabled'), 'Review cutover');
}
async function applyReviewed() {
  const apply = await waitFor(() => button('Apply reviewed cutover', panel()), 'apply button');
  assert(apply.disabled, 'apply disabled until the scope is acknowledged');
  click(panel().querySelector('.baseline-confirm input'), 'acknowledge');
  await waitFor(() => !apply.disabled, 'apply enabled');
  click(apply, 'Apply reviewed cutover');
}
const activeNotice = 'The cutover is active for the reviewed accounts. Other accounts keep their existing calculation version.';

defineSteps([
  ['no-admin-session-cannot-apply', async () => {
    start(() => { throw httpError(403, {}); }, {session: false});
    await waitFor(() => alerts(panel()).includes('An authenticated broker administrator session is required.'), 'session alert');
    await reviewDraft();
    await waitFor(() => calls.length === 1 && !hasText('Waiting for the current result', panel()), 'preview refused');
    // Without a session the generic session message is the explanation.
    eq(alerts(panel()), ['An authenticated broker administrator session is required.'], 'session refusal shown');
    assert(!button('Apply reviewed cutover', panel()) && !hasText('Plan reference', panel()), 'no review and no apply without an admin session');
    return {calls: calls.length};
  }],
  ['server-403-reason-is-kept', async () => {
    // With an Admin session, an explicit server reason is shown as sent; the
    // generic authority text appears only when the 403 carries no reason.
    const cases = [
      [{error_code: 'POLICY_RELEASE_AUTHORITY_REVOKED'}, 'Current broker administrator authority for this account is not held: the session was revoked or the account is not in this broker (POLICY_RELEASE_AUTHORITY_REVOKED).'],
      [{message: 'Admin access for this broker is required', code: 'MT_RET_ERR_PERMISSIONS'}, 'Admin access for this broker is required (MT_RET_ERR_PERMISSIONS).'],
      [{}, 'Current broker administrator authority is required.'],
    ];
    for (const [body, expected] of cases) {
      start(() => { throw httpError(403, body); });
      await reviewDraft();
      await waitFor(() => calls.length === 1 && !hasText('Waiting for the current result', panel()), 'preview refused');
      eq(alerts(panel()), [expected], `403 ${JSON.stringify(body)}`);
      assert(!button('Apply reviewed cutover', panel()), 'no apply after a refusal');
    }
    return {cases: cases.length};
  }],
  ['blocked-review-offers-no-apply', async () => {
    start(() => review({ready: false, blockers: ['Account 9007199254740993 has 1 open position'], accounts: [{...review().accounts[0], open_positions: 1}]}));
    await reviewDraft();
    await waitFor(() => hasText('Blocked', panel()), 'blocked list');
    assert(hasText('Account 9007199254740993 has 1 open position', panel()), 'blocker text');
    assert(!button('Apply reviewed cutover', panel()), 'no apply for a blocked review');
    assert(hasText('12345678901234567890.01', panel()) && hasText('-0.0001', panel()), 'opening values shown exactly');
    return {blocked: true};
  }],
  ['apply-confirmed-by-matching-release', async () => {
    start(call => call.url.includes('cutover/apply') ? release() : review());
    await reviewDraft();
    await waitFor(() => hasText(`Plan reference: ${FP}`, panel()), 'ready review');
    assert(hasText('Group gains symbols, but this account stays on its current version', panel()), 'unaffected account reason');
    await applyReviewed();
    await waitFor(() => statuses(panel()).includes(activeNotice), 'active notice');
    const apply = calls.find(c => c.url.includes('cutover/apply'));
    assert(apply.pendingSaved, 'original identity saved before the apply request');
    eq([apply.method, apply.url, apply.data.fingerprint, apply.data.acknowledge_cutover_scope], ['POST', `${BASE}cutover/apply/9007199254740993`, FP, true], 'apply request');
    eq(Object.keys(localStorage).filter(key => key.startsWith('rtx5.calculation-cutover')).length, 0, 'identity cleared after confirmation');
    return {applied: FP};
  }],
  ['unconfirmed-apply-keeps-identity-and-recovers', async () => {
    let statusReply = 'pending';
    start(call => {
      if (call.url.includes('cutover/apply')) throw httpError(502, {});
      if (call.url.includes('cutover/status')) return statusReply === 'active' ? {status: 'active', fingerprint: FP, release: release()} : {status: statusReply, fingerprint: FP};
      return review();
    });
    await reviewDraft();
    await applyReviewed();
    await waitFor(() => alerts(panel()).includes('The baseline request was not confirmed. Review the current state before continuing.'), 'unconfirmed');
    await waitFor(() => hasText(`Original cutover awaiting confirmation: ${FP}`, panel()), 'identity kept');
    assert(!statuses(panel()).includes(activeNotice), 'no active claim');
    assert(!button('Apply reviewed cutover', panel()) || button('Apply reviewed cutover', panel()).disabled, 'no second apply while unresolved');
    const check = button('Check original cutover', panel());
    click(check, 'check');
    await waitFor(() => statuses(panel()).includes('The original cutover is still unresolved. Check its status again.'), 'pending status');
    statusReply = 'absent';
    click(await waitFor(() => { const b = button('Check original cutover', panel()); return b && !b.disabled && b; }, 'check again'), 'check');
    await waitFor(() => statuses(panel()).includes('The original cutover has not been observed. Keep its identity and check again; a delayed request may still arrive.'), 'absent status');
    statusReply = 'active';
    click(await waitFor(() => { const b = button('Check original cutover', panel()); return b && !b.disabled && b; }, 'check again'), 'check');
    await waitFor(() => statuses(panel()).includes(activeNotice), 'active after recovery');
    eq(calls.filter(c => c.url.includes('cutover/apply')).length, 1, 'status checks never resubmit the cutover');
    return {recovered: true};
  }],
  ['mismatched-release-is-not-success', async () => {
    start(call => call.url.includes('cutover/apply') ? release({impact_report_hash: 'f'.repeat(64)}) : review());
    await reviewDraft();
    await applyReviewed();
    await waitFor(() => alerts(panel()).includes('The active cutover does not match the reviewed plan.'), 'mismatch');
    assert(!statuses(panel()).includes(activeNotice), 'no active claim');
    await waitFor(() => hasText(`Original cutover awaiting confirmation: ${FP}`, panel()), 'identity kept for review');
    return {mismatch: true};
  }],
  ['invalid-draft-sends-nothing', async () => {
    start(() => review());
    await reviewDraft('{"reason":"x","accounts":[{"account_login":9007199254740993}]}');
    await waitFor(() => alerts(panel()).includes('The cutover contains a number that cannot be preserved exactly.'), 'unsafe number');
    eq(calls.length, 0, 'no preview request for an invalid draft');
    return {sent: 0};
  }],
]);
