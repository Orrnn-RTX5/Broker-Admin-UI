import '../qa-shared/guard.js';
import {alerts, assert, button, click, defineSteps, eq, hasText, mount, region, setValue, signIn, statuses, stubRequest, text, waitFor} from '../qa-shared/page-kit.js';
import LPSourceGapPanel from '/src/components/organisms/LPSourceGapPanel.jsx';
import {createLPSourceGapsAPI, RELEASE_CONFIRM_TEXT, TYPED_OFF_MESSAGE} from '/src/services/lpSourceGaps.js';
import '/src/index.css';

// Source continuity (lane A3): BTCUSD held and releasable, EURUSD normal (no
// hold), XAUUSD resumed but awaiting its first fresh quote. Stubbed transport.
const BIG_TICKET = '9007199254740993';
const hold = patch => ({
  entity_kind: 'pending', ticket_text: BIG_TICKET, order_version: '9007199254740995', account_login: '1001', symbol: 'BTCUSD',
  feed: 'feed-a', partition: 3, gap_ids: ['gap-1'], gap_reason: 'provider_session_lost', opened_at: '2026-09-28T10:00:00Z',
  resumed: true, first_fresh_seen: true, policy: 'hold', connection_id: 'named-a', ...patch,
});
const HOLDS = [
  hold({}),
  hold({entity_kind: 'protection', ticket_text: '77', order_version: '4', symbol: 'XAUUSD', gap_reason: 'subscription_refresh', gap_ids: ['gap-2', 'gap-3'], first_fresh_seen: false}),
  hold({ticket_text: '88', order_version: '1', symbol: 'XAUUSD', resumed: false, first_fresh_seen: false, connection_id: 'named-b'}),
];
const status = (holds = HOLDS, patch = {}) => ({
  typed: true, available: true, policy_pending: 'hold', policy_protection: 'hold', degraded: true,
  unresumed_gaps: 1, open_symbol_gaps: 1, held_business: holds.length, recorded_gaps: 4, observed_at: '2026-09-28T10:05:00Z',
  tenant_id: 'tenant-qa', holds, ...patch,
});

let stub, holds;
function start(statusReply, releaseReply) {
  holds = [...HOLDS];
  stub = stubRequest(call => {
    if (call.method === 'GET') return typeof statusReply === 'function' ? statusReply() : statusReply ?? {body: status(holds)};
    return typeof releaseReply === 'function' ? releaseReply(call) : releaseReply;
  });
  signIn(undefined, `qa-${Math.random()}`);
  mount(<LPSourceGapPanel connectionID="named-a" revision={2} api={createLPSourceGapsAPI(stub.request)}/>);
}
const panel = () => region('Source continuity');
const rows = () => [...panel().querySelectorAll('tbody tr')];
const row = (ticket) => rows().find(r => r.children[1].textContent === ticket);
const repoll = () => document.dispatchEvent(new Event('visibilitychange'));
async function openRelease(ticket = BIG_TICKET) {
  await waitFor(() => row(ticket), `row ${ticket}`);
  click([...row(ticket).querySelectorAll('button')].find(b => b.textContent === 'Release hold'), 'Release hold');
  return waitFor(() => region('Confirm hold release'), 'confirm dialog');
}
async function confirmWith(dialog, reference) {
  const submit = button('Confirm release', dialog);
  assert(submit.disabled, 'confirm disabled before a reference');
  setValue(region('Operator reference'), 'short');
  assert(submit.disabled, 'confirm disabled for a reference under 8 characters');
  setValue(region('Operator reference'), reference);
  await waitFor(() => !submit.disabled, 'confirm enabled');
  click(submit, 'Confirm release');
}

defineSteps([
  ['status-held-normal-and-awaiting-first-fresh', async () => {
    start();
    await waitFor(() => rows().length, 'holds table');
    const body = text(panel());
    assert(body.includes('Degraded'), 'degraded status');
    assert(body.includes('Policy: pending orders — Hold until operator release; protections — Hold until operator release.'), 'hold policy shown read-only');
    assert(body.includes('Open gaps: 1. Symbols awaiting first fresh quote: 1. Held items: 3. Recorded gaps: 4.'), 'counts');
    assert(body.includes('1 held item is resumed but awaiting a first fresh quote.'), 'awaiting first fresh summary');
    eq(panel().querySelectorAll('select').length, 1, 'only the holds filter is selectable (policy never editable)');
    assert(body.includes('2 of 3 held items shown.'), 'filtered to the selected connection');
    eq(rows().map(r => r.children[4].textContent), ['BTCUSD', 'XAUUSD'], 'connection holds: BTCUSD and XAUUSD; EURUSD normal has none');
    assert(row(BIG_TICKET).children[1].textContent === BIG_TICKET, 'ticket above 2^53 kept exact');
    const btc = [...row(BIG_TICKET).querySelectorAll('button')][0];
    assert(!btc.disabled, 'BTCUSD release offered (resumed and first fresh quote seen)');
    const xau = row('77');
    assert([...xau.querySelectorAll('button')][0].disabled, 'XAUUSD release disabled');
    assert(text(xau).includes('Waiting for the first fresh post-gap quote.'), 'XAUUSD reason');
    setValue(region('Holds shown'), 'all');
    await waitFor(() => hasText('3 of 3 held items shown.', panel()), 'all feeds');
    const unresumed = row('88');
    assert([...unresumed.querySelectorAll('button')][0].disabled && text(unresumed).includes('Waiting for the source gap to resume.'), 'unresumed reason');
    assert(!body.includes('EURUSD'), 'EURUSD is not held');
    return {shown: rows().length};
  }],
  ['release-refused-keeps-the-row', async () => {
    const cases = [
      [{status: 409, body: {error_code: 'TRIGGER_RECOVERY_REQUIRED'}}, 'Partition requires audited recovery; release is refused. (TRIGGER_RECOVERY_REQUIRED)'],
      [{status: 409, body: {error_code: 'SOURCE_GAP_NOT_CLOSED'}}, 'The gap has not resumed or no fresh post-gap quote has arrived yet. Release is refused. (SOURCE_GAP_NOT_CLOSED)'],
      [{status: 403, body: {error: 'LP_FORBIDDEN'}}, 'This account is not authorized to release source gap holds. (LP_FORBIDDEN)'],
      [{status: 404, body: {error_code: 'SOURCE_GAP_HOLD_NOT_FOUND'}}, 'No unreleased hold matches this item. It may already be released or superseded; refresh status. (SOURCE_GAP_HOLD_NOT_FOUND)'],
      [{status: 200, body: {released: 0, partition: 3, release_stream_sequence: '42'}}, 'Release was not confirmed. Refresh status before retrying.'],
    ];
    for (const [reply, message] of cases) {
      start(undefined, reply);
      const dialog = await openRelease();
      assert(text(dialog).includes(RELEASE_CONFIRM_TEXT), 'confirm dialog carries the exact replay sentence');
      await confirmWith(dialog, 'OPS-2026-0928-001');
      await waitFor(() => alerts(dialog).includes(message), `refusal ${message}`);
      assert(!hasText('Release recorded', panel()), 'no release claimed');
      assert(!statuses(panel()).some(s => s.startsWith('Release recorded for')), 'no success notice');
    }
    return {refusals: cases.length};
  }],
  ['release-allowed-row-stays-until-poll', async () => {
    let dropped = false;
    start(() => ({body: status(dropped ? holds.slice(1) : holds)}), call => { dropped = true; return {body: {released: 1, partition: 3, release_stream_sequence: '9007199254740999'}, call}; });
    const dialog = await openRelease();
    await confirmWith(dialog, '  OPS-2026-0928-002  ');
    await waitFor(() => hasText('Release recorded; awaiting status refresh', row(BIG_TICKET)), 'row marked awaiting refresh');
    const post = stub.calls.find(c => c.method === 'POST');
    eq(post.path, '/api/v1/manager/lp-runtime/source-gaps/release', 'release route');
    eq(post.body, {entity_kind: 'pending', ticket: BIG_TICKET, order_version: '9007199254740995', reference: 'OPS-2026-0928-002'}, 'string ticket and version, trimmed reference');
    assert(statuses(panel()).some(s => s.startsWith(`Release recorded for Pending order ${BIG_TICKET} (1 hold)`)), 'notice after a confirmed release');
    repoll();
    await waitFor(() => !row(BIG_TICKET), 'row gone after the next status');
    return {released: BIG_TICKET};
  }],
  ['typed-off-unavailable-and-invalid-policy', async () => {
    start({body: {typed: false}});
    await waitFor(() => statuses(panel()).includes(TYPED_OFF_MESSAGE), 'typed off message');
    assert(!panel().querySelector('table') && !button('Release hold', panel()), 'no holds or release when typed gaps are off');
    start({body: {typed: true, available: false}});
    await waitFor(() => alerts(panel()).includes('Source continuity status is unavailable. Treat named triggers as degraded until it returns.'), 'unavailable');
    start({body: status(HOLDS, {policy_pending: 'release_on_resume'})});
    await waitFor(() => alerts(panel()).includes('Invalid source continuity status.'), 'non-hold policy fails closed');
    assert(!panel().querySelector('table'), 'no table for an invalid status');
    start({status: 403, body: {error_code: 'LP_FORBIDDEN'}});
    await waitFor(() => alerts(panel()).includes('This account is not authorized to release source gap holds.'), 'forbidden read');
    assert(!button('Release hold', panel()), 'no release control without authority');
    return {cases: 4};
  }],
]);
