import './lp-connections.css';
import React, { useEffect, useRef, useState } from 'react';
import LPRuntimeReadinessPanel from './LPRuntimeReadinessPanel.jsx';
import LPSourceGapPanel from './LPSourceGapPanel.jsx';
import { readLPRuntimeReadiness } from '../../services/lpConnections.service.js';
import { useAuthStore } from '../../store/authStore.js';
import { saveLPConnection, enableLPConnection, testLPConnection } from '../../services/lpConnections.service.js';
import { getGatewayConnectionsScope, peekGatewayConnections, readGatewayConnections, invalidateGatewayConnections } from '../../services/gatewayStartup.js';
import { emptyConnection, emptyCredentials, saveConnectionPayload, connectionError, connectionResult } from '../../utils/lpConnections.js';

const secrets = () => ({ quote: emptyCredentials(), trade: emptyCredentials() });
const inputClass = 'ui-input ui-input-sm w-full';
const buttonClass = 'ui-btn ui-btn-secondary';
const primaryButtonClass = 'ui-btn ui-btn-primary';
// Presentation only: colour a FIX session state reported by the runtime.
const sessionTone = state => ({ connected: 'is-ok', connecting: 'is-warn', disconnected: 'is-bad', failed: 'is-bad', stop_failed: 'is-bad' }[state] || '');
const sessionLabel = state => ({ connected: 'Connected', connecting: 'Connecting', disconnected: 'Disconnected', failed: 'Failed', stop_failed: 'Stop failed' }[state] || state || 'Unknown');
const roleInfo = {
  quote: { sub: 'Receives prices from the provider.', subID: 'Leave empty unless your provider specifies one' },
  trade: { sub: 'Sends and manages orders with the provider.', subID: 'Usually TRADE' },
};
const credentialFields = [['sender_comp_id', 'Sender Comp ID'], ['sender_sub_id', 'Sender sub ID (optional)'], ['username', 'Username'], ['password', 'Password'], ['account_id', 'Account ID']];
const credentialHint = (role, key) => ({ sender_comp_id: 'e.g. demo.pepperstone.5328266', sender_sub_id: roleInfo[role].subID, account_id: 'Last part of Sender Comp ID' }[key]);
function Workspace({ scope }) {
  const initial = peekGatewayConnections(scope)?.data.connections;
  const [records, setRecords] = useState(() => initial || []);
  const [config, setConfig] = useState(() => initial?.[0] ? structuredClone(initial[0].config) : emptyConnection());
  const [credentials, setCredentials] = useState(secrets);
  const [status, setStatus] = useState(() => initial?.[0]?.status || null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [listLoaded, setListLoaded] = useState(() => Boolean(initial));
  const [explicitNew, setExplicitNew] = useState(false);
  const mounted = useRef(false);
  const select = record => {
    setConfig(record ? structuredClone(record.config) : emptyConnection());
    setCredentials(secrets()); setStatus(record?.status || null); setConflict(false); setError(''); setMessage('');
  };
  async function refresh({ force = true } = {}) {
    setBusy(true); setError('');
    try {
      const result = await readGatewayConnections(scope, { force });
      if (!mounted.current) return;
      setRecords(result.connections || []);
      setListLoaded(true);
      select((result.connections || []).find(item => item.config.id === config.id) || result.connections?.[0]);
    } catch (e) {
      if (!mounted.current) return;
      setError(connectionError(e));
      if ([401, 403].includes(Number(e.status ?? e.response?.status))) {
        setRecords([]); setListLoaded(false); setExplicitNew(false); setConfig(emptyConnection()); setStatus(null);
      } else if (listLoaded) setConflict(true);
    }
    finally { if (mounted.current) setBusy(false); }
  }
  useEffect(() => { mounted.current = true; refresh({ force: false }); return () => { mounted.current = false; }; }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Workspace remounts on session changes; form edits must not trigger a refresh.
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
    } finally { invalidateGatewayConnections(scope); if (mounted.current) { setBusy(false); setCredentials(secrets()); } }
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
  const declined = () => { setError(''); setMessage('No action taken. Your unsaved edits are still here.'); return false; };
  const confirmDiscard = () => !hasUnsavedChanges || window.confirm('Discard unsaved connection changes?') || declined();
  const confirmTest = () => !hasUnsavedChanges || window.confirm('Test uses saved settings. Unsaved edits will not be tested, and any credentials entered here will be cleared. Continue?') || declined();
  const chooseConnection = record => { if (confirmDiscard()) { setExplicitNew(!record); select(record); } };
  const refreshSelection = () => { if (confirmDiscard()) refresh(); };
  const runtimeRevision = status?.revision;
  const notApplied = config.revision > 0 && runtimeRevision != null && String(runtimeRevision) !== String(config.revision);
  const endpointInput = (role, key, label) => <div className="nfc-field"><label>{label}<input className={inputClass} type={key === 'port' ? 'number' : 'text'} min={key === 'port' ? 1 : undefined} max={key === 'port' ? 65535 : undefined} value={config[role].endpoint[key]} onChange={e => endpointField(role, key, key === 'port' ? Number(e.target.value) : e.target.value)} required={config[role].enabled} /></label></div>;
  if (!listLoaded && !explicitNew) return <section aria-label="Named FIX connections" className="nfc">
    <div className="nfc-head">
      <div><h2 className="nfc-title">FIX connections</h2><p className="nfc-sub">Load saved provider connections to see their quote and trade sessions.</p></div>
      <div className="nfc-head-actions"><button type="button" className={buttonClass} disabled={busy} onClick={refresh}>Retry loading connections</button><button type="button" className={buttonClass} disabled={busy} onClick={() => chooseConnection(null)}>New connection</button></div>
    </div>
    {busy ? <p className="nfc-empty" role="status">Loading saved connections…</p> : <p className="nfc-msg is-error" role="alert">Saved connections could not be loaded. Their saved state and session status are unknown here. {error}</p>}
  </section>;
  return <section aria-label="Named FIX connections" className="nfc">
    <div className="nfc-head">
      <div><h2 className="nfc-title">FIX connections</h2><p className="nfc-sub">Set up the provider connection used for prices and orders. Each connection has separate quote and trade sessions.</p></div>
      <div className="nfc-head-actions"><button type="button" className={buttonClass} disabled={busy} onClick={refreshSelection}>Refresh</button><button type="button" className={buttonClass} disabled={busy} onClick={() => chooseConnection(null)}>New connection</button></div>
    </div>
    {!busy && !records.length && !error && <p className="nfc-empty" role="status">No saved connections yet. Enter the details below to create one.</p>}
    <div className="nfc-picker nfc-field">
      <label>Choose a connection<select className={inputClass} value={config.revision ? config.id : ''} disabled={busy} onChange={e => chooseConnection(records.find(item => item.config.id === e.target.value))}><option value="">New connection</option>{records.map(item => <option key={item.config.id} value={item.config.id}>{item.config.name || item.config.id} · {item.config.enabled ? 'Enabled' : 'Disabled'}</option>)}</select></label>
    </div>
    <div className="nfc-context">
      <strong>{isNew ? 'New connection' : config.name || config.id}</strong>
      <span>{busy ? 'Checking saved settings and session status…' : isNew ? 'Complete the fields below, then save this connection.' : hasUnsavedChanges ? 'Unsaved edits. Save before testing or changing the connection state.' : 'Showing last loaded settings and session status.'}</span>
    </div>
    <div className="nfc-status" role="group" aria-label="Connection status summary">
      <div className="nfc-status-group">
        <span className={`nfc-pill ${sessionTone(status?.quote)}`} title="Quote session (prices)"><span className="nfc-pill-label">Quote:</span> {isNew ? 'Not saved' : sessionLabel(status?.quote)}</span>
        <span className={`nfc-pill ${sessionTone(status?.trade)}`} title="Trade session (orders)"><span className="nfc-pill-label">Trade:</span> {isNew ? 'Not saved' : sessionLabel(status?.trade)}</span>
        {savedConfig && <span className={`nfc-pill ${savedConfig.enabled ? 'is-ok' : ''}`} title="Saved connection switch">{savedConfig.enabled ? 'Enabled' : 'Disabled'}</span>}
      </div>
      <span className="nfc-status-sep" aria-hidden="true" />
      <div className="nfc-status-group">
        <span className="nfc-stat">Saved revision: <strong>{config.revision || 'Not saved'}</strong></span>
        <span className="nfc-stat" title="Revision currently applied by the running FIX service">Runtime revision: <strong>{isNew ? 'Not available' : status?.revision ?? 'Unknown'}</strong></span>
        {notApplied && <span className="nfc-pill is-warn">Saved settings are waiting to apply</span>}
        {status?.error_code && <span className="nfc-pill is-bad">Runtime issue: {status.error_code}</span>}
      </div>
    </div>
    {conflict && <p role="alert" className="nfc-msg is-warn">Saved settings changed or their final state is uncertain. Refresh the connection before editing or taking another action.</p>}
    {error && <p role="alert" className="nfc-msg is-error">{error}</p>}
    {message && <p role="status" className="nfc-msg is-ok">{message}</p>}
    {supplied && <p className="nfc-shared-note">RTX manages this connection’s settings. You can enable or disable it here.</p>}
    <form onSubmit={save} autoComplete="off" className="nfc-form">
      <fieldset disabled={busy || supplied || conflict} className="nfc-fieldset">
        <div className="nfc-card">
          <div className="nfc-card-head"><h3 className="nfc-card-title">Connection details</h3><span className="nfc-card-sub">Shared by the quote and trade sessions</span></div>
          <div className="nfc-grid">{[['id','Connection ID'],['name','Name'],['environment','Environment']].map(([key,label]) => <div key={key} className="nfc-field"><label>{label}<input className={inputClass} value={config[key]} disabled={key === 'id' && config.revision > 0} aria-describedby={key === 'id' || key === 'environment' ? `nfc-${key}-hint` : undefined} onChange={e => field(key,e.target.value)} required /></label>{key === 'id' && <span id="nfc-id-hint" className="nfc-hint">{config.revision > 0 ? 'Fixed after first save' : 'Letters, numbers, dot, underscore or hyphen'}</span>}{key === 'environment' && <span id="nfc-environment-hint" className="nfc-hint">e.g. demo or live</span>}</div>)}
            <div className="nfc-field"><label>Provider<input className={inputClass} value={config.provider === 'cserver' ? 'cServer FIX' : config.provider} readOnly /></label></div>
            <div className="nfc-field"><label>Account mode<select className={inputClass} value={config.account_mode} onChange={e => field('account_mode',e.target.value)}><option value="hedging">Hedging</option><option value="netting">Netting</option></select></label></div>
            <div className="nfc-field is-check"><label className="nfc-check"><input type="checkbox" checked={config.enabled} onChange={e => field('enabled',e.target.checked)} />Enabled when saved</label><span className="nfc-hint">Controls both sessions. Save to apply this change.</span></div></div>
        </div>
        {!supplied && <p className="nfc-shared-note">Quote and trade must use the same provider account.</p>}
        <div className="nfc-sessions">{['quote','trade'].map(role => <fieldset key={role} className={`nfc-session is-${role}`}><legend>{role} session</legend>
          <p className="nfc-session-sub">{roleInfo[role].sub} Enable this session only when its endpoint and credentials are ready.</p>
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
            <p className="nfc-group-hint">{isNew ? 'For an enabled session, enter Sender Comp ID, username, password, and account ID.' : 'Saved credentials are hidden. Leave every field blank to keep them, or enter Sender Comp ID, username, password, and account ID to replace them.'}</p>
            <div className="nfc-grid-2">{credentialFields.map(([key,label]) => <div key={key} className="nfc-field"><label>{label}<input className={inputClass} type={key === 'password' ? 'password' : 'text'} autoComplete={key === 'password' ? 'new-password' : 'off'} aria-describedby={credentialHint(role, key) ? `nfc-${role}-${key}-hint` : undefined} value={credentials[role][key]} onChange={e => setCredentials(old => ({ ...old,[role]: { ...old[role],[key]:e.target.value } }))} required={isNew && config[role].enabled && key !== 'sender_sub_id'} /></label>{credentialHint(role, key) && <span id={`nfc-${role}-${key}-hint`} className="nfc-hint">{credentialHint(role, key)}</span>}</div>)}</div>
          </div>}
        </fieldset>)}</div>
      </fieldset>
      <div className="nfc-footer">
        <div className="nfc-actions">{!supplied && <button className={primaryButtonClass} type="submit" disabled={busy || conflict}>{isNew ? 'Create connection' : 'Save changes'}</button>}
          <button className={buttonClass} type="button" disabled={busy || conflict || !config.revision} onClick={() => { if (!savedConfig) { setMessage(''); setError('The saved connection is not loaded in this page. Click Refresh at the top of this panel, then try again.'); return; } if (confirmDiscard()) run(() => enableLPConnection(savedConfig,!savedConfig.enabled)); }}>{savedConfig?.enabled ? 'Disable saved connection' : 'Enable saved connection'}</button>
          <button className={buttonClass} type="button" disabled={busy || conflict || !config.revision || !savedConfig?.enabled} onClick={() => { if (confirmTest()) run(() => testLPConnection(config.id)); }}>Test saved connection (logon only)</button>
          {busy && <span role="status" className="nfc-working">Working…</span>}</div>
        {/* Repeat the result beside the buttons; the panel-level copy is off-screen here. */}
        {error && <p className="nfc-msg is-error" aria-hidden="true">{error}</p>}
        {message && <p className="nfc-msg is-ok" aria-hidden="true">{message}</p>}
        {!isNew && !savedConfig?.enabled && <p className="nfc-note">Enable the saved connection to run a logon test.</p>}
        <p className="nfc-note">The test uses saved settings and submits no orders. A successful logon does not verify order execution. Saving this connection does not select a quote feed or authorize trading.</p>
      </div>
    </form>
    {config.revision > 0 && <div className="nfc-diagnostics">
      {config.revision > 0 && <LPRuntimeReadinessPanel key={`${config.id}:${config.revision}`} connectionID={config.id} load={readLPRuntimeReadiness} />}
      {config.revision > 0 && <LPSourceGapPanel key={config.id} connectionID={config.id} revision={config.revision} />}
    </div>}
  </section>;
}
export default function NamedLPConnectionsPanel() {
  const scope = useAuthStore(getGatewayConnectionsScope);
  return scope ? <Workspace key={scope} scope={scope} /> : null;
}
