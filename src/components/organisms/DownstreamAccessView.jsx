import {useCallback, useEffect, useRef, useState} from 'react';
import {useAuthStore} from '../../store/authStore.js';
import {isBrokerAdmin} from '../../utils/permissions.js';
import {
  DOWNSTREAM_ROLES, EMERGENCY_REASON_MAX, draftFromAuthority, emergencyReasonError,
  inUseReasonLabel, lpDownstream, newRequestId,
} from '../../services/lpDownstream.js';
import DownstreamGrantEditor from './DownstreamGrantEditor.jsx';
import DownstreamCredentialCard from './DownstreamCredentialCard.jsx';
import DownstreamExportModal from './DownstreamExportModal.jsx';
import './lp-downstream.css';

// C09 "Downstream access (broker-as-LP)". Broker Admin only: managers and
// SuperAdmin get no C09 screen (the backend refuses them as well).
export default function DownstreamAccessView({api = lpDownstream}) {
  const user = useAuthStore(state => state.user);
  const session = useAuthStore(state => state.accessToken);
  if (!isBrokerAdmin(user)) {
    return (
      <section className="lp-downstream" aria-label="Downstream access">
        <p role="alert">Downstream access is managed by the broker Admin only.</p>
      </section>
    );
  }
  return session ? <DownstreamWorkspace key={session} api={api}/> : null;
}

const applicationLabel = state => (state === 'unapplied' ? 'not available' : state);

function ErrorBanner({error}) {
  if (!error) return null;
  if (error.code === 'DOWNSTREAM_ACCESS_IN_USE') {
    return (
      <div role="alert" className="lp-downstream-banner">
        <strong>Trading is running on the coverage account.</strong> The {error.changeClass || 'requested'} change was refused
        {error.reasons?.length ? <> because of: {error.reasons.map(inUseReasonLabel).join(', ')}</> : null}.
        Ordinary disable, edit, rotation and revocation stay locked while trading. Emergency revoke remains available.
      </div>
    );
  }
  return (
    <div role="alert" className="lp-downstream-banner">
      {error.message}
      {error.code === 'REFERENCE_INVALID' && error.reasons?.length ? <> Reason: {error.reasons.join('; ')}.</> : null}
    </div>
  );
}

function DownstreamWorkspace({api}) {
  const [counterparties, setCounterparties] = useState([]);
  const [grants, setGrants] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [editor, setEditor] = useState(null);
  const [partyForm, setPartyForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [emergency, setEmergency] = useState(null);
  const [emergencyResults, setEmergencyResults] = useState([]);
  const [oneTimeExport, setOneTimeExport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const generation = useRef(0);

  const loadLists = useCallback(async () => {
    const token = ++generation.current;
    setBusy(true);
    try {
      const [parties, access] = await Promise.all([api.counterparties(), api.grants()]);
      if (token !== generation.current) return;
      setCounterparties(parties);
      setGrants(access);
    } catch (e) {
      if (token === generation.current) setError(e);
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }, [api]);

  const loadDetail = useCallback(async access => {
    const token = ++generation.current;
    setBusy(true);
    try {
      const grant = await api.grant(access);
      const [quote, trade, history] = await Promise.allSettled([api.profile(access, 'quote'), api.profile(access, 'trade'), api.history(access)]);
      if (token !== generation.current) return;
      setDetail({
        grant,
        profiles: {quote: quote.status === 'fulfilled' ? quote.value : null, trade: trade.status === 'fulfilled' ? trade.value : null},
        profileErrors: {quote: quote.status === 'rejected' ? quote.reason.message : '', trade: trade.status === 'rejected' ? trade.reason.message : ''},
        history: history.status === 'fulfilled' ? history.value : null,
        historyError: history.status === 'rejected' ? history.reason.message : '',
      });
      setGrants(old => old.map(row => (row.access_id === grant.access_id ? grant : row)));
    } catch (e) {
      if (token === generation.current) {
        setDetail(null);
        setError(e);
      }
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }, [api]);

  useEffect(() => {
    loadLists();
    const pending = generation;
    return () => { pending.current++; };
  }, [loadLists]);

  const select = access => {
    setError(null);
    setNotice('');
    setEditor(null);
    setEmergencyResults([]);
    setSelected(access);
    loadDetail(access);
  };

  async function run(action, onDone) {
    const token = ++generation.current;
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      const value = await action();
      if (token === generation.current) onDone(value);
    } catch (e) {
      if (token === generation.current) setError(e);
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }

  function saveParty(event) {
    event.preventDefault();
    const {counterparty_id, display_name, status, revision} = partyForm;
    run(() => api.saveCounterparty(counterparty_id.trim(), {display_name, status, expected_revision: revision}), saved => {
      setPartyForm(null);
      setNotice(`Counterparty ${saved.counterparty_id} saved at revision ${saved.revision}.`);
      loadLists();
    });
  }

  function confirmAction() {
    const grant = detail.grant;
    const {kind, role, requestId} = confirm;
    setConfirm(null);
    if (kind === 'toggle') {
      run(() => api.updateGrant(grant.access_id, {draft: draftFromAuthority(grant.authority), enabled: !grant.enabled, expected_revision: grant.revision, strict: false}), saved => {
        setNotice(`Access ${saved.enabled ? 'enabled' : 'disabled'} at revision ${saved.revision}. Enabling stores authority only; connection is observed separately.`);
        loadDetail(saved.access_id);
      });
    } else if (kind === 'issue' || kind === 'rotate') {
      run(() => api.issue(grant.access_id, role, {request_id: requestId, expected_revision: grant.revision}), issued => {
        setOneTimeExport(issued);
        loadDetail(grant.access_id);
      });
    } else if (kind === 'revoke') {
      run(() => api.revoke(grant.access_id, role, {expected_revision: grant.revision}), saved => {
        setNotice(`The ${role} credential was revoked at revision ${saved.revision}.`);
        loadDetail(saved.access_id);
      });
    }
  }

  async function emergencyRevoke(event) {
    event.preventDefault();
    const grant = detail.grant;
    const {reason, roles} = emergency;
    const token = ++generation.current;
    setBusy(true);
    setError(null);
    setNotice('');
    const results = [];
    let revision = grant.revision;
    try {
      for (const role of DOWNSTREAM_ROLES.filter(item => roles[item])) {
        const result = await api.emergencyRevoke(grant.access_id, role, {expected_revision: revision, reason});
        results.push(result);
        revision = result.grant.revision;
      }
      if (token === generation.current) setEmergency(null);
    } catch (e) {
      if (token === generation.current) setError(e);
    } finally {
      if (token === generation.current) {
        setEmergencyResults(results);
        setBusy(false);
        loadDetail(grant.access_id);
      }
    }
  }

  const grant = detail?.grant;
  const counterpartyName = id => counterparties.find(c => c.counterparty_id === id)?.display_name || id;
  const activeRoles = grant ? DOWNSTREAM_ROLES.filter(role => grant[role + '_credential'].state === 'active') : [];
  const reasonProblem = emergency ? emergencyReasonError(emergency.reason) : '';

  return (
    <section className="lp-downstream" aria-label="Downstream access">
      <header>
        <h2>Downstream access (broker-as-LP)</h2>
        <p>Grant a receiving broker FIX 4.4 quote and trade sessions on one coverage account. B-book only; the coverage account is funded through Payments (Deposits and Withdrawals).</p>
        <div className="lp-downstream-actions">
          <button type="button" disabled={busy} onClick={() => { setError(null); loadLists(); if (selected) loadDetail(selected); }}>Reload</button>
          <button type="button" disabled={busy} onClick={() => { setError(null); setSelected(null); setDetail(null); setEditor({mode: 'create'}); }}>New access</button>
          <button type="button" disabled={busy} onClick={() => setPartyForm({counterparty_id: '', display_name: '', status: 'active', revision: '0', isNew: true})}>New counterparty</button>
        </div>
      </header>
      <ErrorBanner error={error}/>
      {notice && <p role="status">{notice}</p>}
      {busy && <p role="status">Loading downstream access...</p>}

      <section aria-label="Counterparties">
        <h3>Counterparties</h3>
        <table>
          <thead><tr><th>ID</th><th>Name</th><th>Status</th><th>Revision</th><th/></tr></thead>
          <tbody>
            {counterparties.map(c => (
              <tr key={c.counterparty_id}>
                <td>{c.counterparty_id}</td><td>{c.display_name}</td><td>{c.status}</td><td>{c.revision}</td>
                <td><button type="button" disabled={busy} onClick={() => setPartyForm({...c, isNew: false})}>Edit</button></td>
              </tr>
            ))}
            {!counterparties.length && <tr><td colSpan={5}>No counterparties.</td></tr>}
          </tbody>
        </table>
        {partyForm && (
          <form aria-label="Counterparty editor" onSubmit={saveParty}>
            <fieldset disabled={busy}>
              <legend>{partyForm.isNew ? 'New counterparty' : `Edit ${partyForm.counterparty_id} (revision ${partyForm.revision})`}</legend>
              <label>Counterparty ID<input aria-label="Counterparty ID" value={partyForm.counterparty_id} disabled={!partyForm.isNew} onChange={e => setPartyForm(old => ({...old, counterparty_id: e.target.value}))}/></label>
              <label>Display name<input aria-label="Counterparty display name" value={partyForm.display_name} onChange={e => setPartyForm(old => ({...old, display_name: e.target.value}))}/></label>
              <label>Status<select aria-label="Counterparty status" value={partyForm.status} onChange={e => setPartyForm(old => ({...old, status: e.target.value}))}><option value="active">active</option><option value="suspended">suspended</option></select></label>
              <button type="submit">Save counterparty</button>
              <button type="button" onClick={() => setPartyForm(null)}>Cancel</button>
            </fieldset>
            <p>Suspending a counterparty logs out every session it holds.</p>
          </form>
        )}
      </section>

      <section aria-label="Access grants">
        <h3>Access grants</h3>
        <table>
          <thead><tr><th>Access</th><th>Counterparty</th><th>Coverage login</th><th>Enabled</th><th>Revision</th><th>Quote credential</th><th>Trade credential</th><th>Application</th><th/></tr></thead>
          <tbody>
            {grants.map(g => (
              <tr key={g.access_id} aria-selected={g.access_id === selected}>
                <td>{g.access_id}</td><td>{counterpartyName(g.authority.counterparty_id)}</td><td>{g.authority.coverage_login}</td>
                <td>{g.enabled ? 'yes' : 'no'}</td><td>{g.revision}</td><td>{g.quote_credential.state}</td><td>{g.trade_credential.state}</td>
                <td>{applicationLabel(g.application_state)}</td>
                <td><button type="button" disabled={busy} onClick={() => select(g.access_id)}>Open</button></td>
              </tr>
            ))}
            {!grants.length && <tr><td colSpan={9}>No downstream access.</td></tr>}
          </tbody>
        </table>
      </section>

      {editor && (
        <DownstreamGrantEditor
          api={api}
          counterparties={counterparties}
          grant={editor.mode === 'edit' ? grant : null}
          onError={setError}
          onCancel={() => setEditor(null)}
          onSaved={saved => {
            setEditor(null);
            setNotice(`Access ${saved.access_id} saved at revision ${saved.revision}. Saved authority is not applied, connected or verified.`);
            loadLists();
            setSelected(saved.access_id);
            loadDetail(saved.access_id);
          }}
        />
      )}

      {grant && !editor && (
        <section aria-label="Access detail" className="lp-downstream-detail">
          <h3>Access {grant.access_id}</h3>
          <dl className="lp-downstream-facts">
            <dt>Counterparty</dt><dd>{counterpartyName(grant.authority.counterparty_id)} ({grant.authority.counterparty_id})</dd>
            <dt>Coverage account</dt><dd>login {grant.authority.coverage_login} · {grant.authority.coverage_account_id} · {grant.authority.account_mode}</dd>
            <dt>Group / feed</dt><dd>{grant.authority.group_id} · {grant.authority.feed_connection_id} (selection revision {grant.authority.feed_selection_revision})</dd>
            <dt>Route</dt><dd>{grant.authority.route?.kind === 'bbook' ? 'B-book (local)' : grant.authority.route?.kind}</dd>
            <dt>Symbols</dt><dd>{grant.authority.symbols.join(', ')}</dd>
            <dt>Revision</dt><dd>{grant.revision}</dd>
          </dl>
          <div className="lp-downstream-badges">
            <span className="lp-downstream-badge">Authority: {grant.enabled ? 'enabled' : 'disabled'}</span>
            <span className="lp-downstream-badge">Application: {applicationLabel(grant.application_state)}</span>
          </div>
          <div className="lp-downstream-actions">
            <button type="button" disabled={busy} onClick={() => setConfirm({kind: 'toggle'})}>{grant.enabled ? 'Disable access' : 'Enable access'}</button>
            <button type="button" disabled={busy} onClick={() => setEditor({mode: 'edit'})}>Edit access</button>
            <button type="button" className="lp-downstream-danger" disabled={busy} onClick={() => { setEmergencyResults([]); setEmergency({reason: '', roles: Object.fromEntries(DOWNSTREAM_ROLES.map(role => [role, activeRoles.includes(role)]))}); }}>Emergency revoke</button>
          </div>
          <div className="lp-downstream-cards">
            {DOWNSTREAM_ROLES.map(role => (
              <DownstreamCredentialCard key={role} role={role} grant={grant} profile={detail.profiles[role]} profileError={detail.profileErrors[role]} busy={busy}
                onAction={(item, kind) => setConfirm({kind, role: item, requestId: newRequestId()})}/>
            ))}
          </div>
          {emergencyResults.length > 0 && (
            <div role="status" aria-label="Emergency revoke result" className="lp-downstream-banner">
              {emergencyResults.map(result => (
                <p key={result.role}>
                  {result.role}: new orders stopped: {result.new_orders_stopped ? 'yes' : 'no'} (credential revision {result.credential_revision} retired; live sessions {result.session_cut === 'committed_propagating' ? 'are being logged out' : result.session_cut}).
                  {' '}Open trades remain: {result.open_trades_remain ? 'yes' : 'no'} (open positions {result.active_use.open_positions}, pending orders {result.active_use.pending_orders}, unresolved commands {result.active_use.unresolved_commands}).
                </p>
              ))}
              <p>Manage open positions on the coverage account through the normal account controls.</p>
            </div>
          )}
          <p>Fund the coverage account (login {grant.authority.coverage_login}) through Payments: Deposits and Withdrawals.</p>
          <section aria-label="Access history">
            <h4>History</h4>
            {detail.historyError && <p role="alert">{detail.historyError}</p>}
            {detail.history && (
              <table>
                <thead><tr><th>Time</th><th>Kind</th><th>Revision / action</th><th>Class / outcome</th><th>Actor</th></tr></thead>
                <tbody>
                  {[...detail.history.revisions.map(row => ({key: 'r' + row.revision, time: row.created_at, kind: 'revision', what: row.revision, how: row.change_class, actor: row.actor})),
                    ...detail.history.audit.map(row => ({key: 'a' + row.id, time: row.created_at, kind: 'audit', what: row.action, how: row.outcome, actor: row.actor}))]
                    .sort((a, b) => String(b.time).localeCompare(String(a.time)))
                    .map(row => <tr key={row.key}><td>{row.time}</td><td>{row.kind}</td><td>{row.what}</td><td>{row.how}</td><td>{row.actor}</td></tr>)}
                </tbody>
              </table>
            )}
          </section>
        </section>
      )}

      {confirm && grant && (
        <div className="lp-downstream-overlay">
          <div className="lp-downstream-dialog" role="dialog" aria-modal="true" aria-label="Confirm downstream change">
            <h3>{{toggle: grant.enabled ? 'Disable access' : 'Enable access', issue: `Issue ${confirm.role} credential`, rotate: `Rotate ${confirm.role} credential`, revoke: `Revoke ${confirm.role} credential`}[confirm.kind]}</h3>
            <p>Expected revision {grant.revision}. {confirm.kind === 'rotate' ? 'The current secret stops working and live sessions are logged out.' : ''}
              {confirm.kind === 'toggle' && grant.enabled ? 'Disabling logs out live sessions.' : ''}
              {' '}This change is refused while the coverage account is trading.</p>
            {(confirm.kind === 'issue' || confirm.kind === 'rotate') && <p>The new secret is shown once, in the next dialog, and is never stored by this screen.</p>}
            <div className="lp-downstream-actions">
              <button type="button" onClick={confirmAction}>Confirm</button>
              <button type="button" onClick={() => setConfirm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {emergency && grant && (
        <div className="lp-downstream-overlay">
          <form className="lp-downstream-dialog" role="dialog" aria-modal="true" aria-label="Emergency revoke" onSubmit={emergencyRevoke}>
            <h3>Emergency revoke</h3>
            <p className="lp-downstream-warning">Emergency revoke stops new orders; open trades remain.</p>
            <p>The counterparty's selected quote and trade sessions are logged out now and their credentials stop working. Open positions and pending orders on the coverage account are not closed; manage them through the normal account controls.</p>
            <p>Expected revision {grant.revision}. This is audited and allowed while the coverage account is trading.</p>
            <fieldset disabled={busy}>
              <legend>Credentials to revoke</legend>
              {DOWNSTREAM_ROLES.map(role => (
                <label key={role} className="lp-downstream-choice">
                  <input type="checkbox" checked={emergency.roles[role]} disabled={!activeRoles.includes(role)} onChange={e => setEmergency(old => ({...old, roles: {...old.roles, [role]: e.target.checked}}))}/>
                  {role}{activeRoles.includes(role) ? '' : ' (no active credential)'}
                </label>
              ))}
              <label>Reason (10-{EMERGENCY_REASON_MAX} characters)
                <textarea aria-label="Emergency revoke reason" value={emergency.reason} maxLength={EMERGENCY_REASON_MAX} onChange={e => setEmergency(old => ({...old, reason: e.target.value}))}/>
              </label>
              {emergency.reason && reasonProblem && <p role="alert">{reasonProblem}</p>}
            </fieldset>
            <div className="lp-downstream-actions">
              <button type="submit" className="lp-downstream-danger" disabled={busy || Boolean(reasonProblem) || !DOWNSTREAM_ROLES.some(role => emergency.roles[role])}>Emergency revoke now</button>
              <button type="button" disabled={busy} onClick={() => setEmergency(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <DownstreamExportModal value={oneTimeExport} onClose={() => setOneTimeExport(null)}/>
    </section>
  );
}

