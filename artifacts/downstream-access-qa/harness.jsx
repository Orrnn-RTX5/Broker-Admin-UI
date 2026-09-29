import '../qa-shared/guard.js';
import {alerts, assert, button, click, defineSteps, eq, hasText, mount, region, setValue, signIn, statuses, stubRequest, text, waitFor} from '../qa-shared/page-kit.js';
import DownstreamAccessView from '/src/components/organisms/DownstreamAccessView.jsx';
import {buildDraft, createLPDownstreamAPI, EMERGENCY_CONFIRM_TEXT} from '/src/services/lpDownstream.js';
import '/src/index.css';

// C09 Downstream access (lane A2) over a stubbed transport with the real
// validators: Admin-only gate, one-time secret reveal cleared on close,
// in-use banner and the verbatim emergency-revoke confirmation.
const ACCESS = 'dsa_abcdefghijklmnopqrstuvwxyz';
const QSESSION = 'RTXDQABCDEFGHIJKLMNOPQRST';
const TSESSION = 'RTXDTABCDEFGHIJKLMNOPQRST';
const SECRET = 'rtxd1_' + 'Qa7'.repeat(14) + 'Z';
const REVISION = '9007199254740997';
const BASE = '/api/v1/lp/downstream';
const authority = buildDraft({
  counterparty_id: 'trivanta-b', coverage_account_id: '0f8fad5b-d9cb-469f-a165-70867728950e', coverage_login: '9007199254740993',
  group_id: 'bbook-cover', feed_connection_id: 'hub-feed', feed_selection_revision: '9007199254740995', account_mode: 'hedging', route: {kind: 'bbook'},
  symbols: ['BTCUSD', 'EURUSD', 'XAUUSD'],
  quote: {enabled: true, operations: ['quote_subscribe'], symbols: ['EURUSD', 'XAUUSD']},
  trade: {enabled: true, operations: ['close', 'create'], symbols: ['BTCUSD'], order_types: ['market'], policies: ['FOK', 'IOC']},
});
const grant = (patch = {}) => ({
  tenant_id: 't', broker_id: 'b', access_id: ACCESS, authority, enabled: true, revision: REVISION,
  quote_session: {role: 'quote', session_id: QSESSION}, trade_session: {role: 'trade', session_id: TSESSION},
  quote_credential: {revision: '0', state: 'none'}, trade_credential: {revision: '2', state: 'active'},
  application_state: 'unapplied', ...patch,
});
const unavailable = role => ({status: 'listener_profile_unavailable', access_id: ACCESS, role, credential_state: 'none', credential_revision: '0', applied: false, connection: 'not_observed', verification: 'not_verified'});
const history = {revisions: [{revision: REVISION, change_class: 'create', actor: 'admin 9000', created_at: '2026-09-28T10:00:00Z'}], audit: [{id: '1', action: 'grant_create', outcome: 'accepted', actor: 'admin 9000', created_at: '2026-09-28T10:00:01Z'}]};

let stub, current;
function start(overrides = {}, user = {role: 'admin', is_admin: true}) {
  current = grant();
  stub = stubRequest(call => {
    const custom = overrides[`${call.method} ${call.path}`];
    if (custom) return typeof custom === 'function' ? custom(call) : custom;
    if (call.path === `${BASE}/counterparties`) return {body: {counterparties: [{counterparty_id: 'trivanta-b', display_name: 'Trivanta B', status: 'active', revision: '3'}]}};
    if (call.path === `${BASE}/access`) return {body: {access: [current]}};
    if (call.path === `${BASE}/access/${ACCESS}`) return {body: current};
    if (call.path === `${BASE}/access/${ACCESS}/history`) return {body: history};
    const profile = call.path.match(/\/profiles\/(quote|trade)$/);
    if (profile) return {body: unavailable(profile[1])};
    return {status: 500, body: {code: 'UNEXPECTED_QA_ROUTE'}};
  });
  signIn(user, `qa-${Math.random()}`);
  mount(<DownstreamAccessView api={createLPDownstreamAPI(stub.request)}/>);
}
const view = () => region('Downstream access');
const openDetail = async () => {
  const open = await waitFor(() => [...view().querySelectorAll('button')].find(b => b.textContent === 'Open' && !b.disabled), 'grant row');
  click(open, 'Open');
  return waitFor(() => region('Access detail') && region('trade credential') && !hasText('Loading downstream access', view()) && region('Access detail'), 'access detail');
};
const confirmDialog = () => waitFor(() => region('Confirm downstream change'), 'confirmation dialog');
const banner = () => alerts(view()).join(' | ');
const noSecretStored = () => {
  for (const store of [localStorage, sessionStorage]) {
    for (let i = 0; i < store.length; i += 1) assert(!/rtxd1_/i.test(store.getItem(store.key(i)) || ''), `secret written to ${store === localStorage ? 'localStorage' : 'sessionStorage'}`);
  }
};

defineSteps([
  ['non-admin-sessions-are-refused', async () => {
    for (const user of [{role: 'manager', permissions: ['*']}, {role: 'super_admin', is_admin: true}]) {
      start({}, user);
      await waitFor(() => alerts(view())[0], 'refusal');
      eq(alerts(view())[0], 'Downstream access is managed by the broker Admin only.', 'admin-only text');
      eq(view().querySelectorAll('button').length, 0, 'no controls for a non-Admin session');
      await new Promise(resolve => setTimeout(resolve, 100));
      eq(stub.calls.length, 0, 'no request from a non-Admin session');
    }
    return {refused: ['manager(*)', 'super_admin']};
  }],
  ['admin-lists-and-detail-badges', async () => {
    start();
    const detail = await openDetail();
    const body = text(detail);
    for (const fragment of ['Authority: enabled', 'Application: not available', 'B-book (local)', 'login 9007199254740993', `Revision${REVISION}`, 'Fund the coverage account (login 9007199254740993) through Payments: Deposits and Withdrawals.'])
      assert(body.includes(fragment), `detail shows ${fragment}`);
    assert(button('Issue quote credential', region('quote credential')), 'quote: Issue offered (no credential)');
    assert(!button('Rotate quote credential', region('quote credential')), 'quote: no Rotate without an active credential');
    assert(button('Rotate trade credential', region('trade credential')) && button('Revoke trade credential', region('trade credential')), 'trade: Rotate/Revoke');
    assert(hasText('Connection profile unavailable (listener_profile_unavailable).', region('trade credential')), 'profile unavailable');
    assert(hasText('Verification: not verified', region('trade credential')) && hasText('Connection: not observed', region('trade credential')), 'separate badges');
    assert(button('Emergency revoke', detail), 'emergency revoke offered to Admin');
    assert(!/success|connected \(observed\)/i.test(body), 'a saved draft never shows a success/connected badge');
    return {grant: ACCESS};
  }],
  ['issue-reveals-secret-once-and-clears-on-close', async () => {
    start({[`POST ${BASE}/access/${ACCESS}/credentials/quote`]: call => {
      current = grant({revision: '9007199254740998', quote_credential: {revision: '1', state: 'active'}});
      return {body: {grant_revision: '9007199254740998', export: {access_id: ACCESS, role: 'quote', sender_comp_id: QSESSION, username: QSESSION, password: SECRET, credential_revision: '1', profile_status: 'listener_profile_unavailable', profile: {...unavailable('quote'), credential_state: 'active', credential_revision: '1'}}}, _call: call};
    }});
    await openDetail();
    click(button('Issue quote credential'), 'Issue quote credential');
    const dialog = await confirmDialog();
    assert(text(dialog).includes(`Expected revision ${REVISION}.`) && text(dialog).includes('shown once'), 'issue confirmation text');
    click(button('Confirm', dialog), 'Confirm');
    const modal = await waitFor(() => region('One-time credential export'), 'one-time export modal');
    const post = stub.calls.find(c => c.method === 'POST');
    assert(/^[0-9a-f-]{36}$/.test(post.body.request_id), 'request_id is a UUID');
    eq(post.body.expected_revision, REVISION, 'expected_revision string');
    eq(region('One-time secret').value, SECRET, 'secret shown in the modal');
    assert(hasText('This secret is shown once.', modal), 'shown-once notice');
    assert(hasText('Connection profile unavailable (listener_profile_unavailable).', modal), 'no endpoint claimed without a serving listener');
    noSecretStored();
    click(button('Close and clear', modal), 'Close and clear');
    await waitFor(() => !region('One-time credential export'), 'modal closed');
    assert(!document.documentElement.outerHTML.includes(SECRET), 'secret removed from the DOM after close');
    assert(![...document.querySelectorAll('input,textarea')].some(el => el.value.includes('rtxd1_')), 'no input keeps the secret');
    noSecretStored();
    await waitFor(() => button('Rotate quote credential', region('quote credential')), 'detail re-read shows the active credential');
    return {secretCleared: true};
  }],
  ['issue-refusals-show-no-secret', async () => {
    const cases = [
      [{status: 409, body: {code: 'EXPORT_CONSUMED'}}, 'This issue request was already used. The secret cannot be shown again; rotate to issue a new credential.'],
      [{body: {grant_revision: '9007199254740998', export: {access_id: ACCESS, role: 'quote', sender_comp_id: QSESSION, username: QSESSION, password: 'rtxd1_short', credential_revision: '1', profile_status: 'listener_profile_unavailable', profile: unavailable('quote')}}}, 'Invalid credential export response.'],
      [{status: 409, body: {code: 'STALE_REVISION'}}, 'This access changed since it was loaded. Reload and review before saving.'],
    ];
    for (const [reply, message] of cases) {
      start({[`POST ${BASE}/access/${ACCESS}/credentials/quote`]: reply});
      await openDetail();
      click(button('Issue quote credential'), 'Issue');
      click(button('Confirm', await confirmDialog()), 'Confirm');
      await waitFor(() => banner().includes(message), `banner ${message}`);
      assert(!region('One-time credential export'), 'no export modal on refusal');
      assert(!document.documentElement.outerHTML.includes('rtxd1_'), 'no secret material in the DOM');
    }
    return {cases: cases.length};
  }],
  ['disable-while-trading-shows-in-use-banner', async () => {
    start({[`PUT ${BASE}/access/${ACCESS}`]: {status: 409, body: {code: 'DOWNSTREAM_ACCESS_IN_USE', class: 'disable', reasons: ['open_positions', 'pending_orders'], message: 'upstream detail'}}});
    await openDetail();
    click(button('Disable access'), 'Disable access');
    const dialog = await confirmDialog();
    assert(text(dialog).includes('Disabling logs out live sessions.'), 'disable consequence');
    click(button('Confirm', dialog), 'Confirm');
    await waitFor(() => banner().includes('Trading is running on the coverage account.'), 'in-use banner');
    const message = banner();
    assert(message.includes('The disable change was refused because of: open positions, pending orders.'), `reasons listed: ${message}`);
    assert(message.includes('Emergency revoke remains available.'), 'emergency still offered');
    assert(!statuses(view()).some(s => /disabled at revision/.test(s)), 'no success notice');
    const put = stub.calls.find(c => c.method === 'PUT');
    eq([put.body.enabled, put.body.expected_revision, put.body.draft.coverage_login], [false, REVISION, '9007199254740993'], 'toggle body keeps string revision/login');
    assert(button('Emergency revoke'), 'emergency revoke still offered while trading');
    return {reasons: ['open_positions', 'pending_orders']};
  }],
  ['emergency-revoke-confirm-text-and-result', async () => {
    start({[`POST ${BASE}/access/${ACCESS}/credentials/trade/emergency-revoke`]: call => {
      current = grant({revision: '9007199254740998', trade_credential: {revision: '3', state: 'retired', emergency_revoked: true}});
      return {body: {grant: current, role: 'trade', session_id: TSESSION, credential_revision: '3', reason: call.body.reason, active_use: {open_positions: '2', pending_orders: '1', unresolved_commands: '0', configuration_uses: '0'}, open_trades_remain: true, session_cut: 'committed_propagating'}};
    }});
    await openDetail();
    click(button('Emergency revoke'), 'Emergency revoke');
    const dialog = await waitFor(() => region('Emergency revoke') && region('Emergency revoke').getAttribute('role') === 'dialog' && region('Emergency revoke'), 'emergency dialog');
    eq(dialog.querySelector('.lp-downstream-warning')?.textContent, EMERGENCY_CONFIRM_TEXT, 'verbatim confirmation sentence');
    eq(EMERGENCY_CONFIRM_TEXT, 'Emergency revoke stops new orders; open trades remain.', 'sentence constant');
    assert(text(dialog).includes('Open positions and pending orders on the coverage account are not closed; manage them through the normal account controls.'), 'open positions explanation');
    assert(text(dialog).includes(`Expected revision ${REVISION}.`), 'expected revision shown');
    const [quoteBox, tradeBox] = [...dialog.querySelectorAll('input[type="checkbox"]')];
    assert(quoteBox.disabled && !quoteBox.checked && text(quoteBox.parentElement).includes('(no active credential)'), 'quote has no active credential');
    assert(tradeBox.checked && !tradeBox.disabled, 'active trade credential selected by default');
    const submit = button('Emergency revoke now', dialog);
    assert(submit.disabled, 'submit disabled without a reason');
    setValue(region('Emergency revoke reason'), 'too short');
    await waitFor(() => alerts(dialog).includes('The reason must be 10 to 500 characters.'), 'short reason refused');
    assert(submit.disabled, 'submit disabled for a short reason');
    setValue(region('Emergency revoke reason'), 'Counterparty key leak suspected');
    await waitFor(() => !submit.disabled, 'submit enabled');
    click(submit, 'Emergency revoke now');
    const result = await waitFor(() => region('Emergency revoke result'), 'emergency result');
    const post = stub.calls.find(c => c.path.endsWith('/emergency-revoke'));
    eq(post.body, {expected_revision: REVISION, reason: 'Counterparty key leak suspected'}, 'emergency body');
    const body = text(result);
    for (const fragment of ['trade: new orders stopped: yes', 'Open trades remain: yes', 'open positions 2, pending orders 1', 'are being logged out', 'Manage open positions on the coverage account through the normal account controls.']) assert(body.includes(fragment), `result shows ${fragment}`);
    assert(!/\bflat\b/i.test(body), 'never claims flat');
    return {result: body};
  }],
  ['emergency-revoke-unconfirmed-claims-nothing', async () => {
    start({[`POST ${BASE}/access/${ACCESS}/credentials/trade/emergency-revoke`]: {body: {grant: grant(), role: 'trade', session_id: TSESSION, credential_revision: '2', reason: 'Counterparty key leak suspected', active_use: {open_positions: '0', pending_orders: '0', unresolved_commands: '0', configuration_uses: '0'}, open_trades_remain: false, session_cut: 'committed_propagating'}}});
    await openDetail();
    click(button('Emergency revoke'), 'Emergency revoke');
    setValue(await waitFor(() => region('Emergency revoke reason'), 'reason box'), 'Counterparty key leak suspected');
    click(await waitFor(() => { const b = button('Emergency revoke now'); return b && !b.disabled && b; }, 'submit'), 'submit');
    await waitFor(() => banner().includes('Emergency revocation was not confirmed.'), 'unconfirmed banner');
    assert(!region('Emergency revoke result'), 'no result claimed when the credential is still active');
    return {unconfirmed: true};
  }],
  ['admin-routes-disabled-offer-nothing', async () => {
    start({[`GET ${BASE}/counterparties`]: {status: 404, body: null}, [`GET ${BASE}/access`]: {status: 404, body: null}});
    await waitFor(() => banner().includes('Downstream access administration is not enabled on this server.'), 'disabled banner');
    assert(!button('Open', view()), 'no grant can be opened');
    assert(hasText('No downstream access.', view()), 'empty list');
    return {disabled: true};
  }],
]);
