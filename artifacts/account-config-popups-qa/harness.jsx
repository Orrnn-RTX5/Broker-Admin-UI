import '../qa-shared/guard.js';
import {alerts, assert, button, click, defineSteps, eq, hasText, httpError, mount, region, setValue, signIn, text, waitFor} from '../qa-shared/page-kit.js';
import AccountCreatePopup from '/src/components/RIGHTCLICKJPOPUPS/AccountCreatePopup.jsx';
import FundingPopup from '/src/components/RIGHTCLICKJPOPUPS/FundingPopup.jsx';
import GroupPropertiesPopup from '/src/components/RIGHTCLICKJPOPUPS/GroupPropertiesPopup.jsx';
import {ToastCtx} from '/src/components/ui/useToast.js';
import {AdminConfigApi} from '/src/services/adminConfigApi.js';
import {ManagerService} from '/src/services/manager.service.js';
import {InstrumentsService} from '/src/services/instruments.service.js';
import '/src/index.css';

// G9/G23 Admin editors with stubbed services: account creation, ledger
// funding requests and Group Properties revision/lock refusals. Nothing is
// sent: every service method used here is replaced for this page only.
signIn();
const REV = 'lcr1:0123456789abcdef01234567';
const NEW_REV = 'lcr1:89abcdef0123456789abcdef';
InstrumentsService.getInstrumentCatalogue = async () => [];
InstrumentsService.getConfiguredInstruments = async () => ({instruments: []});

let toasts = [], calls = [], events = [];
const record = (name, fn) => async (...args) => { calls.push({name, args: structuredClone(args)}); return fn(...args); };
const toastBox = () => document.getElementById('qa-toasts');
const notify = toast => {
  toasts.push(toast);
  const el = document.createElement('div');
  el.setAttribute('data-qa-toast', toast.tone || '');
  el.textContent = `${toast.title}${toast.description ? ` — ${toast.description}` : ''}`;
  el.style.cssText = 'padding:6px 10px;margin-top:6px;border:1px solid #555;background:#222;color:#eee;font:12px sans-serif';
  toastBox().appendChild(el);
};
function start(element) {
  toasts = []; calls = []; events = [];
  toastBox().innerHTML = '';
  mount(<ToastCtx.Provider value={{notify}}>{element}</ToastCtx.Provider>);
}
const byId = id => document.getElementById(id);
const dialog = label => region(label);
async function fillCreate() {
  await waitFor(() => byId('create-first'), 'create form');
  setValue(byId('create-first'), 'Qa');
  setValue(byId('create-last'), 'Customer');
  setValue(byId('create-email'), 'qa.customer@example.test');
  setValue(byId('create-leverage'), '200');
  setValue(byId('create-mode'), 'netting');
  setValue(byId('create-master'), 'Master#2026');
}
const createAccount = () => click(button('Create', dialog('New customer account')), 'Create');
const successShown = () => hasText('was created', dialog('New customer account')) || toasts.some(t => t.tone === 'success');

const group = {name: 'real-qa', leverage: 100, marginCallLevel: '100', stopOutLevel: '50', executionMode: 'market'};
const schedules = [{id: 5, name: 'Std', symbol: 'EURUSD', group_name: 'real-qa', commission_type: 'per_lot', value: '7', min_volume: 0, max_volume: 100, enabled: true, revision: REV}];
function stubGroup({update, del} = {}) {
  ManagerService.getGroup = record('getGroup', async () => ({group: 'real-qa', leverage: 100, revision: REV}));
  ManagerService.getGroupAllowedSymbols = record('getGroupAllowedSymbols', async () => ({symbols: [], unrestricted: true, revision: REV}));
  ManagerService.getCommissionScheduleList = record('getCommissionScheduleList', async () => schedules);
  ManagerService.updateGroup = record('updateGroup', update || (async () => ({revision: NEW_REV})));
  ManagerService.deleteCommissionSchedule = record('deleteCommissionSchedule', del || (async () => ({})));
}
function openGroup() {
  start(<GroupPropertiesPopup group={group} onClose={() => events.push('close')} onSaved={() => events.push('saved')}/>);
  return waitFor(() => byId('group-leverage') && calls.some(c => c.name === 'getGroup') && byId('group-leverage'), 'group dialog');
}
async function changeLeverageAndOk(value = '200') {
  setValue(await openGroup(), value);
  click(button('OK'), 'OK');
}
const saveError = () => document.querySelector('span[role="alert"]')?.textContent || '';

defineSteps([
  ['create-validation-sends-nothing', async () => {
    AdminConfigApi.createCustomerAccount = record('createCustomerAccount', async () => ({Login: 1}));
    start(<AccountCreatePopup group="real-qa" defaultLeverage="100" onClose={() => {}}/>);
    await waitFor(() => byId('create-first'), 'create form');
    createAccount();
    await waitFor(() => hasText('Enter a first or last name.', dialog('New customer account')), 'field errors');
    assert(hasText('Master password must have at least 8 characters.', dialog('New customer account')), 'password rule');
    eq(calls.length, 0, 'invalid form never reaches the server');
    assert(!hasText('Balance', dialog('New customer account')) && !hasText('Credit', dialog('New customer account')), 'no balance or credit fields');
    return {sent: 0};
  }],
  ['create-refused-by-server', async () => {
    AdminConfigApi.createCustomerAccount = record('createCustomerAccount', async () => { throw httpError(409, {message: 'Account already exists', code: 'MT_RET_ERR_EXISTS', stackTrace: null}); });
    start(<AccountCreatePopup group="real-qa" defaultLeverage="100" onClose={() => {}}/>);
    await fillCreate();
    createAccount();
    await waitFor(() => alerts(dialog('New customer account')).includes('Account already exists'), 'server refusal');
    assert(!successShown(), 'no success on refusal');
    assert(button('Create', dialog('New customer account')), 'form stays for correction');
    return {refused: true};
  }],
  ['create-without-login-is-not-success', async () => {
    const replies = [{}, {success: false}, {Login: 0}];
    for (const reply of replies) {
      AdminConfigApi.createCustomerAccount = record('createCustomerAccount', async () => reply);
      start(<AccountCreatePopup group="real-qa" defaultLeverage="100" onClose={() => {}}/>);
      await fillCreate();
      createAccount();
      await waitFor(() => calls.length === 1 && !hasText('Creating...', dialog('New customer account')), 'create settled');
      await new Promise(resolve => setTimeout(resolve, 50));
      assert(!successShown(), `a reply without a login must not be shown as created: ${JSON.stringify(reply)}`);
      assert(alerts(dialog('New customer account')).length === 1, 'an error explains the unconfirmed creation');
    }
    return {replies: replies.length};
  }],
  ['create-confirmed-then-deposit-request', async () => {
    AdminConfigApi.createCustomerAccount = record('createCustomerAccount', async () => ({Login: 70001, Group: 'real-qa'}));
    AdminConfigApi.requestFunding = record('requestFunding', async () => ({deposit_id: 9}));
    start(<AccountCreatePopup group="real-qa" defaultLeverage="100" onClose={() => {}}/>);
    await fillCreate();
    createAccount();
    await waitFor(() => hasText('Account #70001 was created in real-qa with a zero balance.', dialog('New customer account')), 'created');
    eq(calls[0].args[0], {Group: 'real-qa', Leverage: 200, AccountMode: 'netting', master_pass: 'Master#2026', FirstName: 'Qa', LastName: 'Customer', Email: 'qa.customer@example.test', Currency: 'USD'}, 'create payload has no balance/credit');
    click(button('Request deposit...'), 'Request deposit');
    const funding = await waitFor(() => dialog('Account funding'), 'funding dialog');
    assert(hasText('nothing is posted from this dialog', funding), 'ledger workflow explanation');
    setValue(byId('funding-amount'), '12.345');
    click(button('Create request', funding), 'Create request');
    await waitFor(() => hasText('Amount must be a positive number with at most 2 decimals.', funding), 'amount rule');
    eq(calls.filter(c => c.name === 'requestFunding').length, 0, 'invalid amount not sent');
    setValue(byId('funding-amount'), '250.50');
    setValue(byId('funding-note'), 'QA-DEP-1');
    click(button('Create request', funding), 'Create request');
    await waitFor(() => !dialog('Account funding'), 'funding dialog closes after the request is created');
    eq(calls.find(c => c.name === 'requestFunding').args, ['deposit', {login: 70001, amount: 250.5, currency: 'USD', reference: 'QA-DEP-1'}], 'deposit request body');
    const toast = toasts.at(-1);
    eq(toast.title, 'Deposit request created', 'request toast, not a balance change');
    assert(toast.description.includes('approve it in Deposits to post it to the ledger'), 'approval still required');
    assert(!toasts.some(t => /balance (updated|changed)|deposited/i.test(`${t.title} ${t.description}`)), 'no balance claim');
    return {login: 70001};
  }],
  ['withdrawal-refusal-keeps-dialog', async () => {
    AdminConfigApi.requestFunding = record('requestFunding', async () => { throw httpError(400, {message: 'Withdrawal exceeds free margin', code: 'MT_RET_ERR_PARAMS'}); });
    start(<FundingPopup login="70001" currency="USD" onClose={() => events.push('close')}/>);
    await waitFor(() => byId('funding-kind'), 'funding form');
    setValue(byId('funding-kind'), 'withdrawal');
    setValue(byId('funding-amount'), '100');
    click(button('Create request', dialog('Account funding')), 'Create request');
    await waitFor(() => alerts(dialog('Account funding')).includes('Withdrawal exceeds free margin'), 'refusal shown');
    eq([events.length, toasts.length], [0, 0], 'no close and no success toast');
    return {refused: true};
  }],
  ['group-leverage-revision-conflict', async () => {
    // Someone else saved the group (margin call 120, stop out 40) after the
    // dialog opened. The conflict reloads the group and its revision, keeps
    // the admin's leverage edit and never re-sends on its own.
    let updates = 0, stored = {group: 'real-qa', leverage: 100, revision: REV};
    stubGroup({update: async () => {
      updates += 1;
      if (updates === 1) {
        stored = {group: 'real-qa', leverage: 100, marginCallLevel: 120, stopOutLevel: 40, executionMode: 'market', negativeBalanceProtection: false, revision: NEW_REV};
        throw httpError(409, {message: 'The configuration was changed by someone else; reload it and apply your change again', code: 'CONFIGURATION_REVISION_CONFLICT', error_code: 'CONFIGURATION_REVISION_CONFLICT', current_revision: NEW_REV, expected_revision: REV});
      }
      return {revision: 'lcr1:fedcba9876543210fedcba98'};
    }});
    ManagerService.getGroup = record('getGroup', async () => structuredClone(stored));
    await changeLeverageAndOk();
    await waitFor(() => saveError(), 'save error');
    eq(saveError(), 'Not saved: someone else changed this group after you opened it. The group was reloaded — review the current values and your edits, then press OK again.', 'reloaded message');
    eq(calls.filter(c => c.name === 'getGroup').length, 2, 'group reloaded after the conflict');
    eq(calls.find(c => c.name === 'updateGroup').args[0], {originalName: 'real-qa', leverage: 200, expected_revision: REV}, 'GroupUpdate carries expected_revision');
    eq([byId('group-margin-call').value, byId('group-stop-out').value, byId('group-leverage').value], ['120', '40', '200'], 'fresh values shown, admin edit kept');
    await new Promise(resolve => setTimeout(resolve, 150));
    eq(calls.filter(c => c.name === 'updateGroup').length, 1, 'never re-submitted automatically');
    eq([events.length, toasts.length], [0, 0], 'dialog stays open and no success toast');
    click(button('OK'), 'OK again');
    await waitFor(() => events.includes('close'), 'dialog closed after the reviewed save');
    eq(calls.filter(c => c.name === 'updateGroup')[1].args[0], {originalName: 'real-qa', leverage: 200, expected_revision: NEW_REV}, 'second save: only the admin edit, fresh revision');
    eq(toasts.at(-1)?.title, 'Group updated', 'success only after the server accepted');
    return {conflict: true, reloaded: true};
  }],
  ['group-leverage-locked-by-open-positions', async () => {
    stubGroup({update: async () => { throw httpError(409, {message: 'Group leverage is in use by trading accounts', code: 'CONFIGURATION_IN_USE', error_code: 'CONFIGURATION_IN_USE', lock_reasons: [{reason: 'open_positions', count: 2, logins: [1001, 1002], symbols: ['EURUSD']}, {reason: 'pending_orders', count: 1, logins: [1003]}]}); }});
    await changeLeverageAndOk();
    await waitFor(() => saveError(), 'save error');
    eq(saveError(), 'Failed to save margin settings: Group leverage is in use by trading accounts: 2 open positions (EURUSD) on 1001, 1002; 1 pending order on 1003.', 'lock reasons listed');
    eq([events.length, toasts.length], [0, 0], 'no success on lock');
    return {locked: true};
  }],
  ['group-save-confirmed', async () => {
    stubGroup();
    await changeLeverageAndOk();
    await waitFor(() => events.includes('close'), 'dialog closed');
    eq(toasts.at(-1)?.title, 'Group updated', 'success only after the server accepted');
    assert(events.includes('saved'), 'caller refreshes');
    return {saved: true};
  }],
  ['commission-delete-conflict-reloads-list', async () => {
    stubGroup({del: async () => { throw httpError(409, {message: 'changed', code: 'CONFIGURATION_REVISION_CONFLICT', error_code: 'CONFIGURATION_REVISION_CONFLICT'}); }});
    await openGroup();
    click(buttons().find(b => text(b).startsWith('Commissions')), 'Commissions tab');
    const row = await waitFor(() => [...document.querySelectorAll('div.cursor-pointer')].find(el => text(el).startsWith('%Std')), 'commission row');
    row.click();
    click(await waitFor(() => { const b = button('Delete'); return b && !b.disabled && b; }, 'delete enabled'), 'Delete');
    await waitFor(() => toasts.some(t => t.title === 'Delete failed'), 'delete failed toast');
    eq(calls.find(c => c.name === 'deleteCommissionSchedule').args, [5, REV], 'delete carries the row revision');
    await waitFor(() => calls.filter(c => c.name === 'getCommissionScheduleList').length === 2, 'list reloaded after conflict');
    assert(!toasts.some(t => t.title === 'Commission deleted'), 'no success toast');
    assert(hasText('Someone else changed this configuration after you opened it.'), 'conflict text in the tab');
    return {reloaded: true};
  }],
  ['group-new-account-opens-create', async () => {
    stubGroup();
    await openGroup();
    click(buttons().find(b => text(b) === 'New account'), 'New account');
    await waitFor(() => dialog('New customer account'), 'create dialog');
    eq(byId('create-group').value, 'real-qa', 'group preset');
    assert(byId('create-group').disabled, 'group fixed');
    eq(byId('create-leverage').value, '100', 'group leverage default');
    return {preset: 'real-qa'};
  }],
]);
function buttons() { return [...document.querySelectorAll('button')]; }
