import './lp-connections.css';
import React, { useEffect, useRef, useState } from 'react';
import LPRuntimeReadinessPanel from './LPRuntimeReadinessPanel.jsx';
import LPSourceGapPanel from './LPSourceGapPanel.jsx';
import { readLPRuntimeReadiness } from '../../services/lpConnections.service.js';
import { useAuthStore } from '../../store/authStore.js';
import { listLPConnections, saveLPConnection, enableLPConnection, testLPConnection } from '../../services/lpConnections.service.js';
import { emptyConnection, emptyCredentials, saveConnectionPayload, connectionError, connectionResult } from '../../utils/lpConnections.js';

const secrets = () => ({ quote: emptyCredentials(), trade: emptyCredentials() });
const inputClass = 'ui-input ui-input-sm w-full';
const buttonClass = 'ui-btn ui-btn-secondary';
const primaryButtonClass = 'ui-btn ui-btn-primary';
// Presentation only: colour a FIX session state reported by the runtime.
const sessionTone = state => ({ connected: 'is-ok', connecting: 'is-warn', disconnected: 'is-bad', failed: 'is-bad', stop_failed: 'is-bad' }[state] || '');
const roleInfo = {
  quote: { sub: 'Prices · streams market data from the provider', subID: 'Leave empty' },
  trade: { sub: 'Orders · places and manages orders with the provider', subID: 'Usually TRADE' },
};
const credentialFields = [['sender_comp_id', 'Sender Comp ID'], ['sender_sub_id', 'Sender sub ID (optional)'], ['username', 'Username'], ['password', 'Password'], ['account_id', 'Account ID']];
const credentialHint = (role, key) => ({ sender_comp_id: 'e.g. demo.pepperstone.5328266', sender_sub_id: roleInfo[role].subID, account_id: 'Last part of Sender Comp ID' }[key]);
function Workspace() {
  const [records, setRecords] = useState([]);
  const [config, setConfig] = useState(emptyConnection);
  const [credentials, setCredentials] = useState(secrets);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const mounted = useRef(false);
  const select = record => {
    setConfig(record ? structuredClone(record.config) : emptyConnection());
    setCredentials(secrets()); setStatus(record?.status || null); setConflict(false); setError(''); setMessage('');
  };
  async function refresh() {
    setBusy(true); setError('');
    try {
      const result = await listLPConnections();
      if (!mounted.current) return;
      setRecords(result.connections || []);
      select((result.connections || []).find(item => item.config.id === config.id) || result.connections?.[0]);
    } catch (e) { if (mounted.current) setError(connectionError(e)); }
    finally { if (mounted.current) setBusy(false); }
  }
  useEffect(() => { mounted.current = true; refresh(); return () => { mounted.current = false; }; }, []); // Workspace remounts on session changes.
  async function run(action) {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await action();
      if (!mounted.current) return;
      if (result.config) {
        setConfig(result.config); setStatus(result.status);
        setRecords(old => [...old.filter(item => item.config.id !== result.config.id), result]);
      }
      setMessage(connectionResult(result));
    } catch (e) {
      if (!mounted.current) return;
      setError(connectionError(e));
      if (['CONFIGURATION_CONFLICT', 'CONFIGURATION_COMMIT_UNCERTAIN'].includes(e.response?.data?.error_code)) setConflict(true);
      if (e.response?.data?.test_kind === 'connection_logon' && e.response?.data?.orders_submitted === false) setMessage('Logon test failed. No orders submitted.');
    } finally { if (mounted.current) { setBusy(false); setCredentials(secrets()); } }
  }
  function save(event) {
    event.preventDefault();
    let payload;
    try { payload = saveConnectionPayload(config, credentials); } catch (e) { setError(e.message); return; }
    run(() => saveLPConnection(payload));
  }
  const supplied = config.origin === 'rtx_supplied';
  const field = (key, value) => setConfig(old => ({ ...old, [key]: value }));
  const sessionField = (role, key, value) => setConfig(old => ({ ...old, [role]: { ...old[role], [key]: value } }));
  const endpointField = (role, key, value) => setConfig(old => ({ ...old, [role]: { ...old[role], endpoint: { ...old[role].endpoint, [key]: value } } }));
  const savedConfig = records.find(item => item.config.id === config.id)?.config;
  const isNew = !config.revision;
  const hasCredentialEdits = Object.values(credentials).some(role => Object.values(role).some(Boolean));
  const hasUnsavedChanges = (isNew ? JSON.stringify(config) !== JSON.stringify(emptyConnection()) : Boolean(savedConfig && JSON.stringify(config) !== JSON.stringify(savedConfig))) || hasCredentialEdits;
  // A declined (or browser-blocked) confirm must never look like a dead button.
  const declined = () => { setError(''); setMessage('Nothing was changed because this form has unsaved edits. Reload the page (F5) to discard them, then try again.'); return false; };
  const confirmDiscard = () => !hasUnsavedChanges || window.confirm('Discard unsaved connection changes?') || declined();
  const confirmTest = () => !hasCredentialEdits || window.confirm('Test uses saved settings and will clear the credentials entered here. Continue?') || declined();
  const chooseConnection = record => { if (confirmDiscard()) select(record); };
  const refreshSelection = () => { if (confirmDiscard()) refresh(); };
  const runtimeRevision = status?.revision;
  const notApplied = config.revision > 0 && runtimeRevision != null && String(runtimeRevision) !== String(config.revision);
  const endpointInput = (role, key, label) => <div className="nfc-field"><label>{label}<input className={inputClass} type={key === 'port' ? 'number' : 'text'} min={key === 'port' ? 0 : undefined} max={key === 'port' ? 65535 : undefined} value={config[role].endpoint[key]} onChange={e => endpointField(role, key, key === 'port' ? Number(e.target.value) : e.target.value)} /></label></div>;
  return <section aria-label="Named FIX connections" className="nfc">
    <div className="nfc-head">
      <div><h2 className="nfc-title">Named FIX connections</h2><p className="nfc-sub">Each connection has two independent FIX sessions: a quote session for prices and a trade session for orders. Saving does not select a quote feed or authorize trading.</p></div>
      <div className="nfc-head-actions"><button type="button" className={buttonClass} disabled={busy} onClick={refreshSelection}>Refresh</button><button type="button" className={buttonClass} disabled={busy} onClick={() => chooseConnection(null)}>New connection</button></div>
    </div>
    <div className="nfc-picker nfc-field">
      <label>Saved connections<select className={inputClass} value={config.revision ? config.id : ''} disabled={busy} onChange={e => chooseConnection(records.find(item => item.config.id === e.target.value))}><option value="">New connection</option>{records.map(item => <option key={item.config.id} value={item.config.id}>{item.config.name} · {item.config.enabled ? 'Enabled' : 'Disabled'} · revision {item.config.revision}</option>)}</select></label>
    </div>
    <div className="nfc-context">
      <strong>{isNew ? 'New connection' : config.name || config.id}</strong>
      <span>{isNew ? 'Enter the connection details, then save to inspect runtime status and test the saved settings.' : hasUnsavedChanges ? 'Unsaved changes. Save to store your edits; connection actions use the saved settings. Check runtime revision to confirm application.' : 'Showing saved settings and current runtime status.'}</span>
    </div>
    <div className="nfc-status" role="group" aria-label="Connection status summary">
      <div className="nfc-status-group">
        <span className={`nfc-pill ${sessionTone(status?.quote)}`} title="Quote session (prices)"><span className="nfc-pill-label">Quote:</span> {isNew ? 'Not saved' : status?.quote || 'Unknown'}</span>
        <span className={`nfc-pill ${sessionTone(status?.trade)}`} title="Trade session (orders)"><span className="nfc-pill-label">Trade:</span> {isNew ? 'Not saved' : status?.trade || 'Unknown'}</span>
        {savedConfig && <span className={`nfc-pill ${savedConfig.enabled ? 'is-ok' : ''}`} title="Saved connection switch">{savedConfig.enabled ? 'Enabled' : 'Disabled'}</span>}
      </div>
      <span className="nfc-status-sep" aria-hidden="true" />
      <div className="nfc-status-group">
        <span className="nfc-stat">Saved revision: <strong>{config.revision || 'Not saved'}</strong></span>
        <span className="nfc-stat" title="Revision currently applied by the running FIX service">Runtime revision: <strong>{isNew ? 'Not available' : status?.revision ?? 'Unknown'}</strong></span>
        {notApplied && <span className="nfc-pill is-warn">Latest save not applied yet</span>}
        {status?.error_code && <span className="nfc-pill is-bad">{status.error_code}</span>}
      </div>
    </div>
    {conflict && <p role="alert" className="nfc-msg is-warn">Saved settings changed or their final state is uncertain. Refresh the connection before editing or taking another action.</p>}
    {error && <p role="alert" className="nfc-msg is-error">{error}</p>}
    {message && <p role="status" className="nfc-msg is-ok">{message}</p>}
    {supplied && <p className="nfc-shared-note">RTX supplied connection. Only enable or disable is available.</p>}
    <form onSubmit={save} autoComplete="off" className="nfc-form">
      <fieldset disabled={busy || supplied || conflict} className="nfc-fieldset">
        <div className="nfc-card">
          <div className="nfc-card-head"><h3 className="nfc-card-title">General</h3><span className="nfc-card-sub">Identity and account settings shared by both sessions</span></div>
          <div className="nfc-grid">{[['id','Connection ID'],['name','Name'],['environment','Environment']].map(([key,label]) => <div key={key} className="nfc-field"><label>{label}<input className={inputClass} value={config[key]} disabled={key === 'id' && config.revision > 0} aria-describedby={key === 'id' || key === 'environment' ? `nfc-${key}-hint` : undefined} onChange={e => field(key,e.target.value)} required /></label>{key === 'id' && <span id="nfc-id-hint" className="nfc-hint">{config.revision > 0 ? 'Fixed after first save' : 'Letters, numbers, dot, underscore or hyphen'}</span>}{key === 'environment' && <span id="nfc-environment-hint" className="nfc-hint">e.g. demo or live</span>}</div>)}
            <div className="nfc-field"><label>Provider<input className={inputClass} value={config.provider === 'cserver' ? 'cServer FIX' : config.provider} readOnly /></label></div>
            <div className="nfc-field"><label>Account mode<select className={inputClass} value={config.account_mode} onChange={e => field('account_mode',e.target.value)}><option value="hedging">Hedging</option><option value="netting">Netting</option></select></label></div>
            <div className="nfc-field is-check"><label className="nfc-check"><input type="checkbox" checked={config.enabled} onChange={e => field('enabled',e.target.checked)} />Connection enabled</label><span className="nfc-hint">Master switch for both sessions</span></div></div>
        </div>
        {!supplied && <p className="nfc-shared-note">Quote and trade must use the same provider account.</p>}
        <div className="nfc-sessions">{['quote','trade'].map(role => <fieldset key={role} className={`nfc-session is-${role}`}><legend>{role} session</legend>
          <p className="nfc-session-sub">{roleInfo[role].sub}</p>
          <div className="nfc-group">
            <h4 className="nfc-group-title">Endpoint</h4>
            <div className="nfc-grid-2">
              <div className="nfc-field nfc-span-2"><label className="nfc-check"><input type="checkbox" checked={config[role].enabled} onChange={e => sessionField(role,'enabled',e.target.checked)} />Session enabled</label></div>
              {endpointInput(role, 'host', 'Host')}
              {endpointInput(role, 'port', 'Port')}
              {endpointInput(role, 'target_comp_id', 'Target Comp ID')}
              <div className="nfc-field nfc-tls is-check"><label className="nfc-check"><input type="checkbox" checked={config[role].endpoint.tls} onChange={e => endpointField(role,'tls',e.target.checked)} />TLS</label>{!config[role].endpoint.tls && <span className="nfc-inline-warn">cServer FIX ports 5211/5212 require TLS</span>}</div>
            </div>
          </div>
          {!supplied && <div className="nfc-group">
            <h4 className="nfc-group-title">Credentials</h4>
            <p className="nfc-group-hint">{isNew ? 'Required when enabling a new session: Sender Comp ID, Username, Password and Account ID.' : 'Write-only. Leave blank to keep saved credentials. To replace, fill Sender Comp ID, Username, Password and Account ID.'}</p>
            <div className="nfc-grid-2">{credentialFields.map(([key,label]) => <div key={key} className="nfc-field"><label>{label}<input className={inputClass} type="password" autoComplete="new-password" aria-describedby={credentialHint(role, key) ? `nfc-${role}-${key}-hint` : undefined} value={credentials[role][key]} onChange={e => setCredentials(old => ({ ...old,[role]: { ...old[role],[key]:e.target.value } }))} /></label>{credentialHint(role, key) && <span id={`nfc-${role}-${key}-hint`} className="nfc-hint">{credentialHint(role, key)}</span>}</div>)}</div>
          </div>}
        </fieldset>)}</div>
      </fieldset>
      <div className="nfc-footer">
        <div className="nfc-actions">{!supplied && <button className={primaryButtonClass} type="submit" disabled={busy || conflict}>Save configuration</button>}
          <button className={buttonClass} type="button" disabled={busy || conflict || !config.revision} onClick={() => { if (!savedConfig) { setMessage(''); setError('The saved connection is not loaded in this page. Click Refresh at the top of this panel, then try again.'); return; } if (confirmDiscard()) run(() => enableLPConnection(savedConfig,!savedConfig.enabled)); }}>Toggle saved connection {savedConfig?.enabled ? 'off' : 'on'}</button>
          <button className={buttonClass} type="button" disabled={busy || conflict || !config.revision || !savedConfig?.enabled} onClick={() => { if (confirmTest()) run(() => testLPConnection(config.id)); }}>Test saved connection (logon only)</button>
          {busy && <span role="status" className="nfc-working">Working…</span>}</div>
        {/* Repeat the result beside the buttons; the panel-level copy is off-screen here. */}
        {error && <p className="nfc-msg is-error" aria-hidden="true">{error}</p>}
        {message && <p className="nfc-msg is-ok" aria-hidden="true">{message}</p>}
        {!isNew && !savedConfig?.enabled && <p className="nfc-note">Enable the saved connection to run a logon test.</p>}
        <p className="nfc-note">Test uses saved settings and submits no orders. A successful logon does not establish execution capability.</p>
      </div>
    </form>
    {config.revision > 0 && <div className="nfc-diagnostics">
      {config.revision > 0 && <LPRuntimeReadinessPanel key={`${config.id}:${config.revision}`} connectionID={config.id} load={readLPRuntimeReadiness} />}
      {config.revision > 0 && <LPSourceGapPanel key={config.id} connectionID={config.id} revision={config.revision} />}
    </div>}
  </section>;
}
export default function NamedLPConnectionsPanel() {
  const session = useAuthStore(state => state.accessToken);
  return session ? <Workspace key={session} /> : null;
}
