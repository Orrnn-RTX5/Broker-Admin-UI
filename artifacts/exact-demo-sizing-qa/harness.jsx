import '../qa-shared/guard.js';
import {useState} from 'react';
import {alerts, assert, button, click, defineSteps, eq, mount, setValue, statuses, text, waitFor} from '../qa-shared/page-kit.js';
import LPExactDemoSizing from '/src/components/organisms/LPExactDemoSizing.jsx';
import {readExactDemoSizing, exactDemoCoverage, EXACT_DEMO_UNVERIFIED_GRID_BASIS} from '/src/services/lpExactDemoSizing.js';
import '/src/index.css';

// LPExactDemoSizing hybrid split (UNVERIFIED provider grid): derived legs,
// refusal instead of rounding, and agreement with the save-time validator.
const evidence = {connection_id: 'named-demo', connection_revision: '4', symbol: 'XAUUSD', trade: {provider_symbol_id: '41', symbol_mapping_version: 'map-3'}};
// The component is controlled; the host keeps its value and the harness reads
// the last value the component emitted.
let latest = null;
const record = next => { latest = next; };
// eslint-disable-next-line react-refresh/only-export-components -- QA page host, not a module export.
function Host() {
  const [value, setValue] = useState(null);
  return <LPExactDemoSizing value={value} evidence={evidence} onChange={next => { record(next); setValue(next); }}/>;
}
const labelled = prefix => [...document.querySelectorAll('label')].find(label => label.textContent.startsWith(prefix));
const input = prefix => labelled(prefix)?.querySelector('input');
const checkbox = prefix => [...document.querySelectorAll('label.lpr-check')].find(label => label.textContent.includes(prefix))?.querySelector('input');
const scope = {connection_id: 'named-demo', connection_revision: '4', symbol: 'XAUUSD', provider_symbol_id: '41', mapping_version: 'map-3'};
const FIXED = {id: 'demo-auth-1', tenant_id: 'broker-one', broker_id: 'broker-one', account_id: '0f8fad5b-d9cb-469f-a165-70867728950e', account_login: '700001', authorized_at: '2026-09-28T00:00:00Z', opening_valid_until: '2099-01-01T00:00:00Z'};
const labels = {id: 'Authorization reference', tenant_id: 'Tenant ID', broker_id: 'Broker ID', account_id: 'Dedicated demo account UUID', account_login: 'Dedicated demo account login', authorized_at: 'Authorized at', opening_valid_until: 'Opening valid until'};

async function enableSizing() {
  mount(<Host/>);
  click(await waitFor(() => checkbox('Use operator-selected exact demo sizing'), 'sizing toggle'), 'sizing toggle');
  await waitFor(() => input('Exact customer lots'), 'sizing fields');
  for (const [key, value] of Object.entries(FIXED)) setValue(input(labels[key]), value);
  setValue(input('Exact customer lots'), '1');
  click(button('Use expected unverified units per lot'), 'expected units');
  await waitFor(() => latest?.units_per_lot === '100', 'units per lot 100 for XAUUSD');
}
async function enableSplit(contract) {
  click(checkbox('Approve a hybrid split'), 'hybrid toggle');
  await waitFor(() => input('Unverified grid contract ID'), 'contract fields');
  for (const [prefix, value] of contract) setValue(input(prefix), value);
}
const derived = () => ['Requested LP lots', 'External LP leg', 'Private B-book remainder', 'Broker-owned excess'].map(prefix => input(prefix).value);
const GOOD = [['Unverified grid contract ID', 'xau-grid-qa-1'], ['External coverage %', '50'], ['Expected minimum LP lots', '0.01'], ['Expected LP lot step', '0.01'], ['Expected maximum LP lots', '50'], ['Expected grid origin lots', '0']];

defineSteps([
  ['prefill-and-expected-units', async () => {
    await enableSizing();
    eq([input('Connection ID').value, input('Connection revision').value, input('Customer symbol').value, input('Provider symbol ID').value, input('Mapping version').value], ['named-demo', '4', 'XAUUSD', '41', 'map-3'], 'evidence prefill');
    assert(text().includes('Expected provider wire for XAUUSD (user decision 2026-09-28, UNVERIFIED): 100 units per lot'), 'unverified expected-units notice');
    assert(!input('Exact provider wire quantity').readOnly, 'wire editable without a split');
    return {units: latest.units_per_lot};
  }],
  ['hybrid-split-derives-legs', async () => {
    await enableSizing();
    await enableSplit(GOOD);
    await waitFor(() => input('External LP leg').value === '0.5', 'derived legs');
    eq(derived(), ['0.5', '0.5', '0.5', '0'], 'requested / external / b-book / excess');
    eq(latest.wire_quantity, '50', 'wire = external x units per lot');
    assert(input('Exact provider wire quantity').readOnly, 'wire read-only while split');
    const status = statuses().find(s => s.startsWith('Customer 1 lots'));
    eq(status, 'Customer 1 lots = external 0.5 lots (wire 50, UNVERIFIED grid) + private B-book 0.5 lots; requested 0.5, broker-owned excess 0.', 'split summary');
    eq(latest.hybrid_split.provider_grid_unverified, true, 'recorded as unverified');
    eq(latest.hybrid_split.grid_basis, EXACT_DEMO_UNVERIFIED_GRID_BASIS, 'grid basis');
    const checked = readExactDemoSizing(latest, scope, Date.parse('2026-09-28T12:00:00Z'));
    eq(exactDemoCoverage(checked), {customer_lots: '1', lp_requested_lots: '0.5', internal_lots: '0.5', broker_excess_lots: '0'}, 'save validator accepts the UI split');
    return {split: derived()};
  }],
  ['refusals-blank-legs-and-claim-nothing', async () => {
    const cases = [
      [[['External coverage %', '99.5'], ['Expected minimum LP lots', '1'], ['Expected LP lot step', '1']], 'Hybrid split refused: upward rounding leaves no B-book remainder; use the fixed 100% exact authority.'],
      [[['External coverage %', '100']], 'Hybrid split refused: hybrid coverage must be above 0% and below 100%.'],
      [[['Expected LP lot step', '0.3']], 'Hybrid split refused: customer lots must lie on the approved grid so both legs stay on its step.'],
      [[['Expected maximum LP lots', '0.1']], 'Hybrid split refused: rounded external leg exceeds the approved maximum.'],
      [[['Unverified grid contract ID', '']], 'Hybrid split refused: explicit unverified provider grid contract required.'],
    ];
    const seen = [];
    for (const [patch, message] of cases) {
      await enableSizing();
      await enableSplit([...GOOD, ...patch]);
      await waitFor(() => alerts().includes(message), message);
      eq(derived(), ['', '', '', ''], 'derived legs blanked');
      eq(latest.wire_quantity, '', 'wire blanked so save validation refuses it');
      assert(!statuses().some(s => s.startsWith('Customer ')), 'no split summary on refusal');
      let refused = false;
      try { readExactDemoSizing(latest, scope, Date.parse('2026-09-28T12:00:00Z')); } catch { refused = true; }
      assert(refused, 'save validator refuses the refused split');
      seen.push(message.replace('Hybrid split refused: ', ''));
    }
    return {refusals: seen};
  }],
  ['unsplit-restores-editable-wire', async () => {
    await enableSizing();
    await enableSplit(GOOD);
    await waitFor(() => latest.wire_quantity === '50', 'split wire');
    click(checkbox('Approve a hybrid split'), 'hybrid off');
    await waitFor(() => !input('Unverified grid contract ID'), 'split removed');
    assert(!('hybrid_split' in latest), 'hybrid_split removed from the value');
    assert(!input('Exact provider wire quantity').readOnly, 'wire editable again');
    setValue(input('Exact provider wire quantity'), '100');
    const checked = readExactDemoSizing(latest, scope, Date.parse('2026-09-28T12:00:00Z'));
    eq(exactDemoCoverage(checked), {customer_lots: '1', lp_requested_lots: '1', internal_lots: '0', broker_excess_lots: '0'}, 'fixed 100% authority after unsplit');
    return {wire: latest.wire_quantity};
  }],
]);
