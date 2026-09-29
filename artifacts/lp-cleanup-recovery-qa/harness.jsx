import '../qa-shared/guard.js';
import {alerts, assert, button, click, defineSteps, eq, hasText, isDisabled, mount, region, setValue, statuses, stubRequest, text, waitFor, signIn} from '../qa-shared/page-kit.js';
import LPCleanupRecoveryPanel from '/src/components/organisms/LPCleanupRecoveryPanel.jsx';
import {createLPCleanupRecoveryAPI, cleanupRecoveryActions} from '/src/services/lpCleanupRecovery.js';
import '/src/index.css';

// D01 cleanup recovery panel (lane A1) with the real service validators over a
// stubbed transport. No request leaves the page.
signIn();
const INTENT = 'intent-qa-1';
const REVISION = '9007199254740993';
const FORBIDDEN = ['force_close_position', 'mark_flat', 'edit_remaining_quantity', 'waive_or_zero_costs', 'book_customer', 'release_configuration', 'resend_same_clordid', 'emergency_override'];
const options = (permitted = {}, reasons = {}) => cleanupRecoveryActions.map(action => ({
  action, permitted: Boolean(permitted[action]),
  reason: permitted[action] ? 'permitted' : (reasons[action] || 'plan_not_escalated_by_limit'),
  mutating: action === 'authorize_recovery_round',
}));
const read = (patch = {}) => ({
  intent_id: INTENT, plan_id: 'plan-qa-1', plan_revision: REVISION, status: 'escalated', escalation: 'price_limit',
  remaining: '0.25', attributable: '1.5', attempts: 2, unreconciled_attempts: 1, rounds_authorized: 0, max_rounds: 1,
  mutations_enabled: true, actor_can_act: true, required_permission: 'lp_cleanup_recovery',
  options: options({reconcile_original_ids: true, acknowledge: true, authorize_recovery_round: true}), forbidden_actions: FORBIDDEN, ...patch,
});

let stub;
function start(handler) {
  stub = stubRequest(handler);
  mount(<LPCleanupRecoveryPanel key={Math.random()} intentID={INTENT} service={createLPCleanupRecoveryAPI(stub.request)}/>);
}
const panel = () => region('Cleanup recovery');
const requestButtons = () => [...panel().querySelectorAll('button')].filter(b => /^Request /.test(b.getAttribute('aria-label') || ''));
const loaded = () => waitFor(() => panel() && hasText('Recovery rounds used / max', panel()), 'recovery read');
const notices = () => statuses(panel()).filter(s => !s.startsWith('Loading'));
const assertNoOutcomeClaim = () => {
  for (const s of notices()) assert(!/\bflat\b|completed\.|closed\b|succeeded/i.test(s.replace('not completed', '')), `notice claims an outcome: ${s}`);
};

async function openConfirm(action) {
  click(requestButtons().find(b => b.getAttribute('aria-label') === `Request ${action}`), `Request ${action}`);
  return waitFor(() => region('Confirm cleanup recovery action'), 'confirmation dialog');
}
async function submitWithNote(dialog, note = 'Operator QA note: reconcile saved IDs') {
  const send = [...dialog.querySelectorAll('button')].find(b => b.textContent === 'Send recovery request');
  assert(send.disabled, 'Send must be disabled before a note is entered');
  setValue(region('Recovery note'), note);
  await waitFor(() => !send.disabled, 'send enabled after note');
  click(send, 'Send recovery request');
}

defineSteps([
  ['inspection-only-without-actor-permission', async () => {
    start(() => ({body: read({actor_can_act: false})}));
    await loaded();
    const body = text(panel());
    assert(body.includes(REVISION), 'plan revision must render as the exact string');
    for (const fragment of ['plan-qa-1', 'escalated', 'price_limit', '0.25', '1.5', '0 / 1']) assert(body.includes(fragment), `missing ${fragment}`);
    assert(body.includes('Inspection only. The lp_cleanup_recovery permission is required'), 'inspection-only notice');
    eq(requestButtons().length, 0, 'no action buttons without actor_can_act');
    assert(isDisabled(panel().querySelector('fieldset')), 'options fieldset disabled');
    for (const label of ['Force-close the position', 'Mark the position flat', 'Waive or zero costs', 'Resend the same ClOrdID', 'Emergency override']) assert(body.includes(label), `forbidden list shows ${label}`);
    assert(body.includes('plan_not_escalated_by_limit - Only a plan escalated'), 'reason code with plain text');
    eq(stub.calls.map(c => c.method), ['GET'], 'read only');
    return {buttons: 0, revision: REVISION};
  }],
  ['gate-off-shows-review-only', async () => {
    start(() => ({body: read({mutations_enabled: false})}));
    await loaded();
    assert(hasText('Recovery actions are disabled on this server. Options are shown for review only.', panel()), 'disabled gate text');
    eq(requestButtons().length, 0, 'no action buttons while mutations are disabled');
    return {buttons: 0};
  }],
  ['held-plan-offers-no-round', async () => {
    start(() => ({body: read({status: 'held', options: options({acknowledge: true}, {authorize_recovery_round: 'held_requires_evidence_resolution'})})}));
    await loaded();
    assert(hasText('Evidence resolution required; recovery rounds are not available.', panel()), 'held message');
    const labels = requestButtons().map(b => b.getAttribute('aria-label'));
    eq(labels, ['Request acknowledge'], 'only permitted options get a button');
    return {labels};
  }],
  ['request-accepted-shows-requested-not-completed', async () => {
    let reads = 0;
    start(call => {
      if (call.method === 'GET') { reads += 1; return {body: read()}; }
      return {status: 202, body: {action: call.body.action, accepted: true, completed: false}};
    });
    await loaded();
    eq(requestButtons().map(b => b.getAttribute('aria-label')), ['Request reconcile_original_ids', 'Request acknowledge', 'Request authorize_recovery_round'], 'buttons only for permitted options');
    const dialog = await openConfirm('reconcile_original_ids');
    assert(text(dialog).includes(`Expected plan revision: ${REVISION}`), 'dialog shows the expected plan revision');
    await submitWithNote(dialog);
    await waitFor(() => notices().some(s => s.includes('requested, not completed')), 'requested notice');
    await waitFor(() => reads === 2, 're-read after 202');
    const post = stub.calls.find(c => c.method === 'POST');
    eq(post.path, `/api/v1/manager/lp-journal/${INTENT}/cleanup-recovery/actions`, 'action route');
    eq(post.body, {action: 'reconcile_original_ids', expected_plan_revision: REVISION, note: 'Operator QA note: reconcile saved IDs'}, 'strict action body with string revision');
    await waitFor(() => hasText('Requested in this view; not completed.', panel()), 'row marked requested');
    assertNoOutcomeClaim();
    return {notice: notices()};
  }],
  ['round-shows-budget-and-no-sending-claim', async () => {
    start(call => call.method === 'GET' ? {body: read()} : {status: 202, body: {action: 'authorize_recovery_round', accepted: true, completed: false, round: {round: 1, attempt_offset: 2, max_attempts: 3, deadline: '2026-09-28T12:30:00Z', remaining: '0.25'}}});
    await loaded();
    const dialog = await openConfirm('authorize_recovery_round');
    assert(text(dialog).includes('It does not send, close or book anything by itself.'), 'round explanation');
    await submitWithNote(dialog, 'Authorize one bounded round for QA');
    const notice = await waitFor(() => notices().find(s => s.includes('Recovery round 1 requested')), 'round notice');
    for (const fragment of ['up to 3 attempts after attempt 2', 'deadline 2026-09-28T12:30:00Z', 'Nothing is sending until the sender records an attempt']) assert(notice.includes(fragment), `round notice has ${fragment}`);
    assertNoOutcomeClaim();
    return {notice};
  }],
  ['unconfirmed-acceptance-is-refused', async () => {
    const replies = [{status: 200, body: {action: 'acknowledge', accepted: true, completed: false}}, {status: 202, body: {action: 'acknowledge', accepted: true, completed: true}}];
    const results = [];
    for (const reply of replies) {
      start(call => call.method === 'GET' ? {body: read()} : reply);
      await loaded();
      const dialog = await openConfirm('acknowledge');
      await submitWithNote(dialog, 'Acknowledge for QA only');
      const alert = await waitFor(() => alerts(panel())[0], 'refusal alert');
      eq(alert, 'The recovery request was not confirmed as accepted. Reload before acting again.', 'unconfirmed message');
      eq(notices().length, 0, 'no requested notice without a confirmed 202');
      assert(hasText('Reload recovery options before another request.', panel()), 'locked after error');
      assert(isDisabled(panel().querySelector('fieldset')), 'options locked');
      results.push(reply.status);
    }
    return {refused: results};
  }],
  ['error-codes-map-to-fixed-messages', async () => {
    const cases = [
      [{status: 409, body: {error_code: 'CLEANUP_PLAN_REVISION_CONFLICT', message: 'upstream text'}}, 'The cleanup plan revision changed. Reload and review before acting.'],
      [{status: 409, body: {error_code: 'CLEANUP_RECOVERY_NOT_PERMITTED', reason: 'attempt_unreconciled'}}, 'This recovery action is not permitted now: attempt_unreconciled - An attempt is not terminal..'],
      [{status: 503, body: {error_code: 'LP_CLEANUP_RECOVERY_DISABLED'}}, 'Cleanup recovery actions are disabled on this server.'],
      [{status: 504, body: {error_code: 'LP_CLEANUP_RECOVERY_UNCONFIRMED'}}, 'The recovery request outcome is unconfirmed. Reload the journal entry before acting again.'],
      [{status: 403, body: {error_code: 'FORBIDDEN'}}, 'This account is not authorized for cleanup recovery.'],
    ];
    const seen = [];
    for (const [reply, message] of cases) {
      start(call => call.method === 'GET' ? {body: read()} : reply);
      await loaded();
      const dialog = await openConfirm('acknowledge');
      await submitWithNote(dialog, 'QA error mapping check');
      const alert = await waitFor(() => alerts(panel())[0], `alert for ${reply.body.error_code}`);
      eq(alert, message, reply.body.error_code);
      assert(!hasText('upstream text', panel()), 'upstream message never echoed');
      eq(notices().length, 0, 'no success notice on error');
      if (reply.body.error_code === 'FORBIDDEN') assert(!hasText('Recovery options', panel()), 'record cleared after FORBIDDEN');
      seen.push(reply.body.error_code);
    }
    return {codes: seen};
  }],
  ['read-errors-show-no-controls', async () => {
    const cases = [
      [{status: 404, body: {error_code: 'LP_CLEANUP_NOT_FOUND'}}, 'No cleanup plan is recorded for this journal entry.'],
      [{status: 200, body: read({plan_revision: Number('9007199254740993')})}, 'Cleanup recovery identity or plan revision is unavailable.'],
      [{status: 200, body: read({options: [...options().slice(0, 3), {action: 'mark_flat', permitted: true, reason: 'permitted', mutating: false}]})}, 'Cleanup recovery option is unavailable.'],
    ];
    for (const [reply, message] of cases) {
      start(() => reply);
      const alert = await waitFor(() => alerts(panel())[0], 'read alert');
      eq(alert, message, 'read error message');
      eq(requestButtons().length, 0, 'no controls after a failed read');
      assert(!hasText('Recovery options', panel()), 'no options rendered');
      assert(button('Reload recovery options', panel()), 'reload remains');
    }
    return {cases: cases.length};
  }],
]);
