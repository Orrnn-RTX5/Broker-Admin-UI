import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/authStore.js';
import { LP_GRANT_ACTIONS, emptyLPGrant, lpGrantValues, lpPermissionAdmin } from '../../services/lpPermissions.js';
import './gateway-support-panels.css';

const actionLabels = {
  view: ['Inspect connections, routing and evidence', 'Required for every other action.'],
  connection_test: ['Test a saved connection', 'Checks the existing connection logon.'],
  configuration: ['Edit existing configuration', 'Limited by the scope and coverage below.'],
  trade_test: ['Run a demo trade test', 'Available only on a saved demo connection when the server enables preview.'],
  cleanup_recovery: ['Request D01 cleanup recovery', 'Audited requests on stopped plans; each request still needs a note and current revision. Never implied by other actions.'],
};
const scopeFields = [
  ['connections', 'connection_ids', 'Connections'],
  ['rules', 'rule_ids', 'Routing rules'],
  ['accounts', 'account_ids', 'Customer accounts'],
  ['groups', 'group_ids', 'Customer groups'],
];

function PermissionsWorkspace() {
  const [managers, setManagers] = useState([]);
  const [selected, setSelected] = useState('');
  const [grant, setGrant] = useState(emptyLPGrant);
  const [reason, setReason] = useState('');
  const [draftDirty, setDraftDirty] = useState(false);
  const [audit, setAudit] = useState([]);
  const [auditViewed, setAuditViewed] = useState(false);
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [scopeText, setScopeText] = useState({});
  const generation = useRef(0);
  const manager = managers.find(item => item.login === selected);

  function draft(item) {
    setSelected(item?.login || '');
    setGrant(item ? { ...emptyLPGrant(), ...item.grant, scope: { ...emptyLPGrant().scope, ...item.grant.scope } } : emptyLPGrant());
    setScopeText(Object.fromEntries(scopeFields.map(([, key]) => [key, (item?.grant.scope?.[key] || []).join(', ')])));
    setReason('');
    setDraftDirty(false);
    setAudit([]);
    setAuditViewed(false);
  }
  async function load(more = false) {
    const token = ++generation.current;
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await lpPermissionAdmin.list(more ? next : '');
      if (token !== generation.current) return;
      const rows = more ? [...managers, ...data.managers] : data.managers;
      setManagers(rows);
      setNext(data.next_after || '');
      if (!more) draft(rows.find(item => item.login === selected) || rows[0]);
    } catch (e) { if (token === generation.current) setError(e.message || 'Unable to load managers.'); }
    finally { if (token === generation.current) setBusy(false); }
  }
  useEffect(() => {
    const requestGeneration = generation;
    const token = ++requestGeneration.current;
    setBusy(true);
    lpPermissionAdmin.list().then(data => {
      if (token !== requestGeneration.current) return;
      const rows = data.managers;
      const first = rows[0];
      setManagers(rows);
      setNext(data.next_after || '');
      setSelected(first?.login || '');
      setGrant(first ? { ...emptyLPGrant(), ...first.grant, scope: { ...emptyLPGrant().scope, ...first.grant.scope } } : emptyLPGrant());
      setScopeText(Object.fromEntries(scopeFields.map(([, key]) => [key, (first?.grant.scope?.[key] || []).join(', ')])));
    }).catch(e => { if (token === requestGeneration.current) setError(e.message || 'Unable to load managers.'); })
      .finally(() => { if (token === requestGeneration.current) setBusy(false); });
    return () => { requestGeneration.current++; };
  }, []);

  async function history(login) {
    const token = ++generation.current;
    setBusy(true); setError(''); setAuditViewed(false);
    try {
      const data = await lpPermissionAdmin.audit(login);
      if (token === generation.current) { setAudit(data.audit || []); setAuditViewed(true); }
    } catch (e) { if (token === generation.current) setError(e.message || 'Unable to load permission audit.'); }
    finally { if (token === generation.current) setBusy(false); }
  }
  async function change(revoke) {
    if (!manager) return;
    const token = ++generation.current;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await (revoke ? lpPermissionAdmin.revoke(manager, reason) : lpPermissionAdmin.save(manager, grant, reason));
      if (token !== generation.current) return;
      const updated = { ...manager, ...result };
      setManagers(old => old.map(item => item.login === updated.login ? updated : item));
      draft(updated);
      setNotice(revoke ? 'LP access revoked. Later actions are denied; accepted orders and connections are unchanged.' : 'Scoped LP permissions saved. Changes apply to later requests.');
      const events = await lpPermissionAdmin.audit(updated.login);
      if (token === generation.current) { setAudit(events.audit || []); setAuditViewed(true); }
    } catch (e) { if (token === generation.current) setError(e.message || 'Unable to update permissions.'); }
    finally { if (token === generation.current) setBusy(false); }
  }
  function setAction(action, checked) {
    setGrant(old => ({
      ...old,
      actions: action === 'view' && !checked ? [] : checked
        ? [...new Set([...old.actions, 'view', action])]
        : old.actions.filter(value => value !== action),
    }));
    setDraftDirty(true);
    setNotice('');
  }

  return <section className="gw-support gw-permissions" aria-labelledby="gw-permissions-title">
    <header className="gw-support-header">
      <div><h2 id="gw-permissions-title">Manager LP permissions</h2><p>Choose an existing manager, select the actions and exact scope they can use, then record why the grant is changing.</p></div>
      <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" disabled={busy} onClick={() => load()}>{draftDirty ? 'Discard edits and refresh' : 'Refresh managers'}</button>
    </header>
    {error && <p role="alert" className="gw-support-message gw-support-error">{error}</p>}
    {notice && <p role="status" className="gw-support-message gw-support-success">{notice}</p>}
    {busy && <p role="status" className="gw-support-progress">Updating manager permissions…</p>}

    <div className="gw-permissions-manager-row">
      <label className="gw-support-field">Manager identity
        <select className="ui-select ui-input-sm" value={selected} disabled={busy} onChange={e => { draft(managers.find(item => item.login === e.target.value)); setNotice(''); setError(''); }}>
          <option value="">Select a manager</option>
          {managers.map(item => <option key={item.login} value={item.login}>{item.name} · {item.login}{item.enabled ? '' : ' · disabled'}</option>)}
        </select>
        {draftDirty && <span className="gw-support-hint">Unsaved edits will be discarded if you select another manager.</span>}
      </label>
      {next && <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" disabled={busy} onClick={() => load(true)}>Load more managers</button>}
    </div>
    {!busy && !error && !managers.length && <div className="gw-support-empty"><strong>No managers found</strong><p>No tenant manager identities are available. Refresh after a manager is added.</p></div>}

    {manager && <form onSubmit={e => { e.preventDefault(); change(false); }} autoComplete="off">
      <p className="gw-permissions-meta">Permission revision {manager.revision} · {manager.enabled ? 'Manager enabled' : 'Manager disabled'}{draftDirty ? ' · Unsaved edits' : ''}</p>
      {!manager.enabled && <p className="gw-support-message gw-support-warning">This manager is disabled. Their grant cannot be edited until the identity is enabled.</p>}
      <fieldset className="gw-support-fieldset" disabled={busy || !manager.enabled}>
        <legend>Allowed actions</legend>
        <p className="gw-support-hint">Inspection is required for every other action. Each permission applies only to the scope below.</p>
        <div className="gw-permissions-actions">
          {LP_GRANT_ACTIONS.map(action => <label className="gw-permissions-option" key={action}>
            <input type="checkbox" checked={grant.actions.includes(action)} onChange={e => setAction(action, e.target.checked)} />
            <span><strong>{actionLabels[action][0]}</strong><small>{actionLabels[action][1]}</small></span>
          </label>)}
        </div>
        <p className="gw-support-hint">Demo tests never reach a live account. Cleanup recovery is separately granted, audited, and subject to server checks. Broker Admin can already request recovery; a platform SuperAdmin cannot.</p>
      </fieldset>
      <fieldset className="gw-support-fieldset" disabled={busy || !manager.enabled}>
        <legend>Admin-imposed scope</legend>
        <p className="gw-support-hint">Empty lists grant no access. “All” is an explicit grant. Use exact customer account and group IDs; narrow scopes expose only routing rules wholly inside them.</p>
        <div className="gw-permissions-scope-grid">
          {scopeFields.map(([kind, key, label]) => <div className="gw-permissions-scope" key={key}>
            <h3>{label}</h3>
            <label className="gw-support-check"><input type="checkbox" checked={grant.scope['all_' + kind]} onChange={e => { setGrant(old => ({ ...old, scope: { ...old.scope, ['all_' + kind]: e.target.checked } })); setDraftDirty(true); }} /> All {label.toLowerCase()}</label>
            <label className="gw-support-field">Allowed IDs
              <input className="ui-input ui-input-sm" disabled={grant.scope['all_' + kind]} placeholder="Comma-separated exact IDs" value={scopeText[key] || ''} onChange={e => { setScopeText(old => ({ ...old, [key]: e.target.value })); setGrant(old => ({ ...old, scope: { ...old.scope, [key]: lpGrantValues(e.target.value) } })); setDraftDirty(true); }} />
            </label>
          </div>)}
        </div>
        <label className="gw-support-field gw-permissions-coverage">Maximum external coverage % for configuration
          <input className="ui-input ui-input-sm" required={grant.actions.includes('configuration')} inputMode="decimal" value={grant.max_coverage_percent} onChange={e => { setGrant(old => ({ ...old, max_coverage_percent: e.target.value })); setDraftDirty(true); }} placeholder="For example, 25" />
          <span className="gw-support-hint">Required when editing configuration. Supplier credentials and active-order locks still apply.</span>
        </label>
      </fieldset>
      <label className="gw-support-field gw-permissions-reason">Audit reason
        <input className="ui-input ui-input-sm" required maxLength={500} disabled={busy} value={reason} onChange={e => { setReason(e.target.value); setDraftDirty(true); }} placeholder="Why is this grant changing?" />
        <span className="gw-support-hint">Required for saving or revoking. Do not include credentials.</span>
      </label>
      <div className="gw-support-actions">
        <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" disabled={busy} onClick={() => history(manager.login)}>View permission audit</button>
        <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" disabled={busy || manager.revision === '0' || !reason.trim()} onClick={() => change(true)}>Revoke all LP access</button>
        <button type="submit" className="ui-btn ui-btn-primary ui-btn-sm" disabled={busy || !manager.enabled || !reason.trim()}>Save LP grant</button>
      </div>
    </form>}

    {auditViewed && <div className="gw-permissions-audit">
      <h3>Recent grant and revoke events</h3>
      {audit.length ? <div className="gw-permissions-table" role="region" aria-label="Permission audit table" tabIndex="0"><table><thead><tr><th>When</th><th>Actor</th><th>Revision</th><th>Operation</th><th>Reason</th></tr></thead><tbody>{audit.map(item => <tr key={item.id}><td>{item.created_at}</td><td>{item.actor_login}</td><td>{item.revision}</td><td>{item.operation}</td><td>{item.reason}</td></tr>)}</tbody></table></div> : <p className="gw-support-empty">No permission audit events were returned for this manager.</p>}
    </div>}
  </section>;
}

export default function LPManagerPermissionsPanel() {
  const session = useAuthStore(state => state.accessToken);
  return session ? <PermissionsWorkspace key={session} /> : null;
}
