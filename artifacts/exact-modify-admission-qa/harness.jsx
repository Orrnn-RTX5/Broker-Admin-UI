import '../qa-shared/guard.js';
import {alerts, assert, button, click, defineSteps, eq, hasText, isDisabled, mount, region, setValue, signIn, statuses, stubRequest, text, waitFor} from '../qa-shared/page-kit.js';
import LPExactPendingModifyAdmissionPanel, {MODIFY_ADMISSION_EXPLANATION} from '/src/components/organisms/LPExactPendingModifyAdmissionPanel.jsx';
import {createLPExactPendingModifyAdmissionAPI} from '/src/services/lpExactPendingModifyAdmission.js';
import '/src/index.css';

// Exact pending Modify admission limit (lane A4) over a stubbed transport.
const record = patch => ({configured: false, revision: '0', max_unsuccessful_modify_per_ticket: 3, default: 3, min: 1, max: 128, application: 'new_modify_admissions_only', ...patch});
let stub;
function start(getReply, putReply) {
  stub = stubRequest(call => {
    if (call.method === 'GET') return typeof getReply === 'function' ? getReply() : getReply ?? {body: record()};
    return typeof putReply === 'function' ? putReply(call) : putReply;
  });
  signIn(undefined, `qa-${Math.random()}`);
  mount(<LPExactPendingModifyAdmissionPanel api={createLPExactPendingModifyAdmissionAPI(stub.request)}/>);
}
const panel = () => region('Exact pending Modify admission');
const input = () => region('Unsuccessful Modify limit');
const loaded = () => waitFor(() => input(), 'admission form');
const save = () => click(button('Save admission limit', panel()), 'Save admission limit');
const puts = () => stub.calls.filter(c => c.method === 'PUT');

defineSteps([
  ['unconfigured-default-and-explanation', async () => {
    start();
    await loaded();
    assert(hasText('Default 3 (no saved revision).', panel()), 'default text');
    assert(hasText(MODIFY_ADMISSION_EXPLANATION, panel()), 'explanation');
    eq(MODIFY_ADMISSION_EXPLANATION, 'Counts unsuccessful Modify requests per pending ticket (rejected, expired or still in flight). At the limit the customer must cancel and place a new order. Applies to new Modify requests only; replay of an admitted request is never limited.', 'plan sentence');
    eq([input().min, input().max, input().value], ['1', '128', '3'], 'bounded integer input');
    return {default: 3};
  }],
  ['save-confirmed-by-server', async () => {
    start(undefined, call => ({body: record({configured: true, revision: '1', max_unsuccessful_modify_per_ticket: call.body.max_unsuccessful_modify_per_ticket})}));
    await loaded();
    setValue(input(), '5');
    save();
    await waitFor(() => statuses(panel()).includes('Saved limit 5 at revision 1. Applies to new Modify requests only.'), 'saved notice');
    eq(puts()[0].body, {expected_revision: '0', max_unsuccessful_modify_per_ticket: 5}, 'PUT body with string revision');
    assert(hasText('Current limit 5 (saved revision 1).', panel()), 'current value after save');
    return {saved: 5};
  }],
  ['unconfirmed-save-shows-no-success-and-locks', async () => {
    const replies = [
      {body: record({configured: true, revision: '1', max_unsuccessful_modify_per_ticket: 4})},
      {body: record({configured: true, revision: '0', max_unsuccessful_modify_per_ticket: 5})},
      {body: record()},
    ];
    for (const reply of replies) {
      start(undefined, reply);
      await loaded();
      setValue(input(), '5');
      save();
      await waitFor(() => alerts(panel()).length, 'refusal');
      const alert = alerts(panel())[0];
      assert(alert === 'Saved Modify admission limit was not confirmed. Reload before another save.' || alert === 'Invalid Modify admission settings.', `unconfirmed: ${alert}`);
      eq(statuses(panel()).filter(s => s.startsWith('Saved')).length, 0, 'no saved notice');
      assert(hasText('Reload the admission limit before another save.', panel()) && isDisabled(input()), 'locked until reload');
    }
    return {refused: replies.length};
  }],
  ['error-codes-and-reload', async () => {
    const cases = [
      [{status: 409, body: {error_code: 'CONFIGURATION_CONFLICT'}}, 'The saved admission revision changed. Reload and review before saving.', true],
      [{status: 400, body: {error_code: 'INVALID_INPUT'}}, 'Enter a whole number from 1 to 128 and reload the revision.', true],
      [{status: 403, body: {error_code: 'FORBIDDEN'}}, 'This account is not authorized for Modify admission settings.', false],
    ];
    for (const [reply, message, keepsForm] of cases) {
      start(undefined, reply);
      await loaded();
      setValue(input(), '7');
      save();
      await waitFor(() => alerts(panel()).includes(message), message);
      assert(Boolean(input()) === keepsForm, `form ${keepsForm ? 'kept (locked)' : 'removed'} after ${reply.body.error_code}`);
      if (keepsForm) assert(isDisabled(input()), 'locked');
    }
    click(button('Reload admission limit', panel()), 'Reload');
    await waitFor(() => input() && !isDisabled(input()) && alerts(panel()).length === 0, 'reload clears the lock');
    return {codes: cases.map(c => c[0].body.error_code)};
  }],
  ['client-bounds-send-nothing', async () => {
    start(undefined, {status: 500, body: {}});
    await loaded();
    for (const value of ['0', '129', '2.5']) {
      setValue(input(), value);
      save();
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    eq(puts().length, 0, 'out-of-range values never reach the server');
    return {sent: 0};
  }],
  ['storage-unavailable-offers-only-reload', async () => {
    start({status: 503, body: {error_code: 'EXACT_PENDING_MODIFY_POLICY_UNAVAILABLE'}});
    await waitFor(() => alerts(panel()).includes('Migration 326 or its storage is unavailable; admission fails closed.'), 'unavailable');
    assert(!input(), 'no editor');
    eq([...panel().querySelectorAll('button')].map(b => b.textContent), ['Reload admission limit'], 'only Reload');
    assert(!text(panel()).includes('Default 3'), 'no default claimed when storage is unavailable');
    return {buttons: 1};
  }],
]);
