import {useRef, useState} from 'react';
import {lpFeeds} from '../../services/lpFeeds.js';
import {ManagerService} from '../../services/manager.service';
import {ACCEPTANCE_SYMBOLS, DOWNSTREAM_SUPPORT, buildDraft, symbolOK} from '../../services/lpDownstream.js';

const emptyScope = () => ({enabled: false, operations: [], symbols: [], order_types: [], policies: []});
const emptyForm = () => ({
  counterparty_id: '', coverage_account_id: '', coverage_login: '', group_id: '', feed_connection_id: '',
  feed_selection_revision: '', account_mode: '', route: {kind: 'bbook'}, symbols: [], label: '',
  quote: emptyScope(), trade: emptyScope(),
});
const formFromAuthority = a => ({
  ...emptyForm(), ...a, label: a.label || '', route: {kind: 'bbook'},
  quote: {...emptyScope(), ...a.quote}, trade: {...emptyScope(), ...a.trade},
});

// Reads the coverage account's current group and effective feed selection,
// then the group's instrument list. The server re-checks every reference on
// save; these reads only prefill and flag staleness.
async function resolveCoverage(accountId) {
  const feed = await lpFeeds.account(accountId.trim());
  if (!feed?.group_name || !feed.selection?.connection_id || !feed.selection?.revision) {
    throw new Error('This account has no effective quote-source selection. Select a named feed for it first.');
  }
  let offered = [...ACCEPTANCE_SYMBOLS];
  let note = '';
  try {
    const group = await ManagerService.getGroupAllowedSymbols(feed.group_name);
    const rows = Array.isArray(group?.symbols) ? group.symbols : [];
    if (group?.unrestricted || !rows.length) {
      note = 'The group is unrestricted; the acceptance scope is offered and the server checks each instrument.';
    } else {
      offered = rows.filter(row => row && row.trade_allowed !== false).map(row => String(row.symbol || '').toUpperCase()).filter(symbolOK);
    }
  } catch {
    note = 'The group instrument list is unavailable; the acceptance scope is offered and the server checks each instrument.';
  }
  return {group_id: feed.group_name, feed_connection_id: feed.selection.connection_id, feed_selection_revision: feed.selection.revision, offered, note};
}

const toggle = (list, value, on) => (on ? [...new Set([...list, value])] : list.filter(item => item !== value));

function Choice({label, checked, disabled, onChange, note}) {
  return (
    <label className="lp-downstream-choice">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)}/>
      {label}{note && <em> {note}</em>}
    </label>
  );
}

function ScopeEditor({role, scope, symbols, disabled, onChange}) {
  const support = DOWNSTREAM_SUPPORT[role];
  const set = patch => onChange({...scope, ...patch});
  const setOperations = operations => {
    const next = {operations};
    if (role === 'trade' && !operations.includes('create')) Object.assign(next, {order_types: [], policies: []});
    set(next);
  };
  return (
    <fieldset disabled={disabled} className="lp-downstream-scope">
      <legend>{role === 'quote' ? 'Quote role scope' : 'Trade role scope'}</legend>
      <Choice label={`Enable ${role} role`} checked={scope.enabled} onChange={on => set({enabled: on})}/>
      <div aria-label={`${role} operations`}>
        {support.operations.map(op => <Choice key={op} label={op} checked={scope.operations.includes(op)} onChange={on => setOperations(toggle(scope.operations, op, on))}/>)}
        {support.unsupported.map(op => <Choice key={op} label={op} checked={false} disabled note="not supported downstream" onChange={() => {}}/>)}
      </div>
      {role === 'trade' && (
        <>
          <div aria-label="Order types">
            {DOWNSTREAM_SUPPORT.orderTypes.map(type => <Choice key={type} label={type} disabled={!scope.operations.includes('create')} checked={scope.order_types.includes(type)} onChange={on => set({order_types: toggle(scope.order_types, type, on)})}/>)}
            {DOWNSTREAM_SUPPORT.unsupportedOrderTypes.map(type => <Choice key={type} label={type} checked={false} disabled note="not supported downstream" onChange={() => {}}/>)}
          </div>
          <div aria-label="Fill policies">
            {DOWNSTREAM_SUPPORT.policies.map(policy => <Choice key={policy} label={policy} disabled={!scope.operations.includes('create')} checked={scope.policies.includes(policy)} onChange={on => set({policies: toggle(scope.policies, policy, on)})}/>)}
            {DOWNSTREAM_SUPPORT.unsupportedPolicies.map(policy => <Choice key={policy} label={policy} checked={false} disabled note="not supported downstream" onChange={() => {}}/>)}
          </div>
        </>
      )}
      <div aria-label={`${role} symbols`}>
        {symbols.length ? symbols.map(symbol => <Choice key={symbol} label={symbol} checked={scope.symbols.includes(symbol)} onChange={on => set({symbols: toggle(scope.symbols, symbol, on)})}/>) : <span>Select access symbols first.</span>}
      </div>
    </fieldset>
  );
}

export default function DownstreamGrantEditor({api, counterparties, grant, onSaved, onCancel, onError}) {
  const editing = Boolean(grant);
  const [form, setForm] = useState(() => (editing ? formFromAuthority(grant.authority) : emptyForm()));
  const [resolved, setResolved] = useState(null);
  const [offered, setOffered] = useState(() => (editing ? [...grant.authority.symbols] : []));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const generation = useRef(0);
  const set = patch => setForm(old => ({...old, ...patch}));
  const saved = editing ? grant.authority : null;
  const stale = Boolean(saved && resolved && (resolved.group_id !== saved.group_id || resolved.feed_connection_id !== saved.feed_connection_id || resolved.feed_selection_revision !== saved.feed_selection_revision));
  const offeredSymbols = [...new Set([...offered, ...form.symbols])].sort();

  async function resolve() {
    const token = ++generation.current;
    setBusy(true);
    setMessage('');
    try {
      const value = await resolveCoverage(form.coverage_account_id);
      if (token !== generation.current) return;
      setResolved(value);
      setOffered(value.offered);
      set({group_id: value.group_id, feed_connection_id: value.feed_connection_id, feed_selection_revision: value.feed_selection_revision});
      if (value.note) setMessage(value.note);
    } catch (error) {
      if (token === generation.current) {
        setResolved(null);
        setMessage(error.message || 'The coverage account references could not be read.');
      }
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    let draft;
    try {
      draft = buildDraft(form);
    } catch (error) {
      setMessage(error.message);
      return;
    }
    const token = ++generation.current;
    setBusy(true);
    setMessage('');
    onError(null);
    try {
      const value = editing
        ? await api.updateGrant(grant.access_id, {draft, enabled: grant.enabled, expected_revision: grant.revision})
        : await api.createGrant({draft});
      if (token === generation.current) onSaved(value);
    } catch (error) {
      if (token === generation.current) {
        if (error.code === 'INVALID_INPUT' || error.code === 'NETWORK') setMessage(error.message);
        else onError(error);
      }
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }

  const setSymbols = symbols => setForm(old => ({
    ...old, symbols,
    quote: {...old.quote, symbols: old.quote.symbols.filter(symbol => symbols.includes(symbol))},
    trade: {...old.trade, symbols: old.trade.symbols.filter(symbol => symbols.includes(symbol))},
  }));

  return (
    <form className="lp-downstream-editor" aria-label={editing ? 'Edit downstream access' : 'New downstream access'} onSubmit={save}>
      <h3>{editing ? `Edit access ${grant.access_id} (revision ${grant.revision})` : 'New downstream access'}</h3>
      <p>Saving stores authority only. It does not apply a listener, connect a session or verify a counterparty.</p>
      <fieldset disabled={busy}>
        <legend>Counterparty and coverage account</legend>
        <label>Counterparty
          <select aria-label="Counterparty" value={form.counterparty_id} disabled={editing} onChange={event => set({counterparty_id: event.target.value})}>
            <option value="">Select a counterparty</option>
            {counterparties.map(c => <option key={c.counterparty_id} value={c.counterparty_id} disabled={c.status !== 'active' && c.counterparty_id !== form.counterparty_id}>{c.display_name} ({c.counterparty_id}){c.status !== 'active' ? ' - suspended' : ''}</option>)}
          </select>
        </label>
        <label>Coverage account login<input aria-label="Coverage account login" inputMode="numeric" value={form.coverage_login} disabled={editing} onChange={event => set({coverage_login: event.target.value.trim()})}/></label>
        <label>Coverage account UUID<input aria-label="Coverage account UUID" value={form.coverage_account_id} disabled={editing} onChange={event => { setResolved(null); set({coverage_account_id: event.target.value.trim().toLowerCase()}); }}/></label>
        <label>Account mode (checked by the server)
          <select aria-label="Coverage account mode" value={form.account_mode} onChange={event => set({account_mode: event.target.value})}>
            <option value="">Select mode</option><option value="hedging">hedging</option><option value="netting">netting</option>
          </select>
        </label>
        <button type="button" disabled={!form.coverage_account_id} onClick={resolve}>{editing ? 'Re-check references' : 'Resolve references'}</button>
      </fieldset>
      <div className="lp-downstream-badges" aria-label="References">
        <span className="lp-downstream-badge">Group: {form.group_id || 'unresolved'}</span>
        <span className="lp-downstream-badge">Feed: {form.feed_connection_id || 'unresolved'}</span>
        <span className="lp-downstream-badge">Feed selection revision: {form.feed_selection_revision || 'unresolved'}</span>
        <span className="lp-downstream-badge">Route: B-book (local)</span>
        {editing && !resolved && <span className="lp-downstream-badge">saved references, not re-checked</span>}
        {stale && <span className="lp-downstream-badge lp-downstream-badge-danger">stale: saved references differ from the account's current ones</span>}
      </div>
      <p>External (A-book or hybrid) routes are not supported downstream.</p>
      <fieldset disabled={busy}>
        <legend>Access symbols</legend>
        {offeredSymbols.length ? offeredSymbols.map(symbol => <Choice key={symbol} label={symbol} checked={form.symbols.includes(symbol)} onChange={on => setSymbols(toggle(form.symbols, symbol, on))}/>) : <span>Resolve the coverage account to list its instruments.</span>}
      </fieldset>
      <ScopeEditor role="quote" scope={form.quote} symbols={form.symbols} disabled={busy} onChange={quote => set({quote})}/>
      <ScopeEditor role="trade" scope={form.trade} symbols={form.symbols} disabled={busy} onChange={trade => set({trade})}/>
      <label>Label (optional)<input aria-label="Access label" value={form.label} disabled={busy} onChange={event => set({label: event.target.value})}/></label>
      {message && <p role="status">{message}</p>}
      <div className="lp-downstream-actions">
        <button type="submit" disabled={busy}>{editing ? 'Save access' : 'Create access'}</button>
        <button type="button" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
