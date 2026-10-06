import React from 'react';
import { createRoot } from 'react-dom/client';
import GroupPropertiesPopup from '../../src/components/RIGHTCLICKJPOPUPS/GroupPropertiesPopup.jsx';
import AccountCreatePopup from '../../src/components/RIGHTCLICKJPOPUPS/AccountCreatePopup.jsx';
import { ToastCtx } from '../../src/components/ui/useToast.js';
import { ManagerService } from '../../src/services/manager.service.js';
import { AdminConfigApi } from '../../src/services/adminConfigApi.js';

const result = document.getElementById('result');
const assert = (value, message) => { if (!value) throw new Error(message); };
const waitFor = async read => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const value = read();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('Timed out waiting for browser state');
};
const button = (root, label) => [...root.querySelectorAll('button')].find(node => node.textContent.trim() === label);
const changeInput = (input, value) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const changeSelect = (select, value) => {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
};
globalThis.fetch = () => { throw new Error('Browser smoke must not send network requests'); };
let feedCatalog = [];
const calls = [];
const group = { name: 'real\\child', groupPurpose: 'coverage', revision: `lcr1:${'a'.repeat(24)}`,
  leverage: 100, executionMode: 'market', marginCallLevel: 100, stopOutLevel: 50 };
ManagerService.getGroup = async name => { calls.push(['group', name]); return group; };
ManagerService.getGroupAllowedSymbols = async name => {
  calls.push(['assigned', name]);
  return { revision: group.revision, symbols: [{ symbol: 'EURUSD', trade_allowed: true }] };
};
ManagerService.getGroupFeedSymbols = async name => {
  calls.push(['feed', name]);
  return { symbols: feedCatalog.map(symbol => ({ symbol })) };
};
AdminConfigApi.createCustomerAccount = async payload => {
  calls.push(['create', payload]);
  return { login: 200002, accountPurpose: 'coverage', routing_warning: 'no routing rule found' };
};
const toast = { notify: () => {} };
const groupHost = document.createElement('div');
const accountHost = document.createElement('div');
document.getElementById('root').append(groupHost, accountHost);
const groupView = createRoot(groupHost);
const accountView = createRoot(accountHost);

try {
  groupView.render(<ToastCtx.Provider value={toast}>
    <GroupPropertiesPopup group={group} onClose={() => {}} />
  </ToastCtx.Provider>);
  await waitFor(() => button(groupHost, 'Symbols'));
  button(groupHost, 'Symbols').click();
  await waitFor(() => groupHost.textContent.includes('EURUSD'));
  assert(calls.some(call => call[0] === 'assigned' && call[1] === group.name),
    'saved group symbols were not loaded for this group');
  button(groupHost, 'Add').click();
  const emptyInput = await waitFor(() => groupHost.querySelector('input[aria-label^="Symbol to add to"]'));
  await waitFor(() => groupHost.textContent.includes('Choose a quote feed with symbols for this group.'));
  assert(emptyInput.disabled && groupHost.textContent.includes('EURUSD'),
    'empty selected-feed catalog enabled adding or hid saved assignment');
  assert(calls.some(call => call[0] === 'feed' && call[1] === group.name),
    'Admin picker requested the wrong group catalog');
  button(groupHost, 'Cancel').click();
  await waitFor(() => !groupHost.querySelector('input[aria-label^="Symbol to add to"]'));
  feedCatalog = ['XAUUSD'];
  button(groupHost, 'Add').click();
  const readyInput = await waitFor(() => {
    const input = groupHost.querySelector('input[aria-label^="Symbol to add to"]');
    return input && !input.disabled && input;
  });
  changeInput(readyInput, 'GBPUSD');
  await waitFor(() => !button(readyInput.parentElement, 'Add')?.disabled);
  button(readyInput.parentElement, 'Add').click();
  await waitFor(() => groupHost.textContent.includes('Choose a symbol from this group'));
  changeInput(readyInput, 'XAUUSD');
  button(readyInput.parentElement, 'Add').click();
  await waitFor(() => groupHost.textContent.includes('XAUUSD'));
  assert(groupHost.textContent.includes('EURUSD'), 'saved assignment disappeared after adding feed symbol');

  accountView.render(<ToastCtx.Provider value={toast}>
    <AccountCreatePopup group={group.name} defaultLeverage={100} onClose={() => {}} />
  </ToastCtx.Provider>);
  await waitFor(() => accountHost.textContent.includes('Coverage - every new account in this group is a coverage account.'));
  assert(accountHost.textContent.includes('Netting or hedging is permanent after account creation.'),
    'creation-only account mode message missing');
  changeSelect(accountHost.querySelector('#create-mode'), 'netting');
  changeInput(accountHost.querySelector('#create-first'), 'Fixture');
  changeInput(accountHost.querySelector('#create-master'), 'fixture-master');
  accountHost.querySelector('form[role="dialog"]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  const write = await waitFor(() => calls.find(call => call[0] === 'create'));
  assert(write[1].AccountMode === 'netting' && write[1].Group === group.name,
    'Admin creation lost permanent mode or group identity');
  await waitFor(() => accountHost.textContent.includes('Trading is blocked until a valid routing rule'));
  result.textContent = 'PASS: Admin selected-feed picker, retained assignment, creation mode, coverage purpose and route warning';
  document.title = 'PASS admin group browser smoke';
} catch (error) {
  result.textContent = `FAIL: ${error.stack || error}\nCalls: ${JSON.stringify(calls)}`;
  document.title = 'FAIL admin group browser smoke';
}
