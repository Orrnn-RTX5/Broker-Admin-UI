import React, { useEffect, useRef, useState } from 'react';
import LPRuntimeReadinessPanel from './LPRuntimeReadinessPanel.jsx';
import LPSourceGapPanel from './LPSourceGapPanel.jsx';
import { readLPRuntimeReadiness } from '../../services/lpConnections.service.js';
import { useAuthStore } from '../../store/authStore.js';
import { listLPConnections, saveLPConnection, enableLPConnection, testLPConnection } from '../../services/lpConnections.service.js';
import { emptyConnection, emptyCredentials, saveConnectionPayload, connectionError, connectionResult } from '../../utils/lpConnections.js';

const secrets = () => ({ quote: emptyCredentials(), trade: emptyCredentials() });
const inputClass = 'ui-input ui-input-sm w-full';
const buttonClass = 'rounded border border-white/20 px-3 py-2 disabled:opacity-40';
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
  return <section aria-label="Named FIX connections" className="mb-6 rounded border border-white/15 p-4 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold">Named FIX connections</h2><p className="text-xs text-[color:var(--text-muted)]">Independent quote and trade sessions. Saving does not select a quote feed or authorize trading.</p></div>
      <div className="flex gap-2"><button type="button" className={buttonClass} disabled={busy} onClick={refresh}>Refresh</button><button type="button" className={buttonClass} disabled={busy} onClick={() => select(null)}>New connection</button></div></div>
    <label className="block text-xs">Saved connections<select className={inputClass} value={config.revision ? config.id : ''} disabled={busy} onChange={e => select(records.find(item => item.config.id === e.target.value))}><option value="">New connection</option>{records.map(item => <option key={item.config.id} value={item.config.id}>{item.config.name} · {item.config.enabled ? 'Enabled' : 'Disabled'} · revision {item.config.revision}</option>)}</select></label>
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {config.revision > 0 && <LPRuntimeReadinessPanel key={`${config.id}:${config.revision}`} connectionID={config.id} load={readLPRuntimeReadiness} />}
    {config.revision > 0 && <LPSourceGapPanel key={config.id} connectionID={config.id} revision={config.revision} />}
    <div className="text-xs flex flex-wrap gap-4"><span>Saved revision: {config.revision || 'Not saved'}</span><span>Runtime revision: {status?.revision ?? 'Unknown'}</span><span>Quote: {status?.quote || 'Unknown'}</span><span>Trade: {status?.trade || 'Unknown'}</span>{status?.error_code && <span>{status.error_code}</span>}</div>
    {supplied && <p className="text-xs">RTX supplied connection. Only enable or disable is available.</p>}
    <form onSubmit={save} autoComplete="off" className="space-y-4">
      <fieldset disabled={busy || supplied || conflict} className="space-y-4 disabled:opacity-60">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{[['id','Connection ID'],['name','Name'],['environment','Environment']].map(([key,label]) => <label key={key} className="text-xs">{label}<input className={inputClass} value={config[key]} disabled={key === 'id' && config.revision > 0} onChange={e => field(key,e.target.value)} required /></label>)}
          <label className="text-xs">Provider<input className={inputClass} value={config.provider === 'cserver' ? 'cServer FIX' : config.provider} readOnly /></label>
          <label className="text-xs">Account mode<select className={inputClass} value={config.account_mode} onChange={e => field('account_mode',e.target.value)}><option value="hedging">Hedging</option><option value="netting">Netting</option></select></label>
          <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={config.enabled} onChange={e => field('enabled',e.target.checked)} />Connection enabled</label></div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">{['quote','trade'].map(role => <fieldset key={role} className="border border-white/15 rounded p-3 space-y-3"><legend className="capitalize px-1">{role} session</legend>
          <label className="text-xs flex gap-2"><input type="checkbox" checked={config[role].enabled} onChange={e => sessionField(role,'enabled',e.target.checked)} />Session enabled</label>
          <div className="grid grid-cols-2 gap-3">{[['host','Host'],['port','Port'],['target_comp_id','Target Comp ID']].map(([key,label]) => <label key={key} className="text-xs">{label}<input className={inputClass} type={key === 'port' ? 'number' : 'text'} min={key === 'port' ? 0 : undefined} max={key === 'port' ? 65535 : undefined} value={config[role].endpoint[key]} onChange={e => endpointField(role,key,key === 'port' ? Number(e.target.value) : e.target.value)} /></label>)}<label className="text-xs flex items-center gap-2"><input type="checkbox" checked={config[role].endpoint.tls} onChange={e => endpointField(role,'tls',e.target.checked)} />TLS</label></div>
          {!supplied && <><p className="text-xs text-[color:var(--text-muted)]">Write-only credentials. Leave every field empty to retain saved credentials. To replace, enter all required fields. Quote and trade must use the same provider account.</p><div className="grid grid-cols-2 gap-3">{[['sender_comp_id','Sender Comp ID'],['sender_sub_id','Sender sub ID (optional)'],['username','Username'],['password','Password'],['account_id','Account ID']].map(([key,label]) => <label key={key} className="text-xs">{label}<input className={inputClass} type="password" autoComplete="new-password" value={credentials[role][key]} onChange={e => setCredentials(old => ({ ...old,[role]: { ...old[role],[key]:e.target.value } }))} /></label>)}</div></>}
        </fieldset>)}</div>
      </fieldset>
      <div className="flex flex-wrap gap-2">{!supplied && <button className={buttonClass} type="submit" disabled={busy || conflict}>Save configuration</button>}
        <button className={buttonClass} type="button" disabled={busy || conflict || !config.revision} onClick={() => { const saved = records.find(item => item.config.id === config.id)?.config; if (saved) run(() => enableLPConnection(saved,!saved.enabled)); }}>Toggle saved connection {records.find(item => item.config.id === config.id)?.config.enabled ? 'off' : 'on'}</button>
        <button className={buttonClass} type="button" disabled={busy || conflict || !config.revision || !records.find(item => item.config.id === config.id)?.config.enabled} onClick={() => run(() => testLPConnection(config.id))}>Test saved connection (logon only)</button>
        {busy && <span role="status" className="text-xs self-center">Working…</span>}</div>
      <p className="text-xs text-[color:var(--text-muted)]">Test uses saved settings and submits no orders. A successful logon does not establish execution capability.</p>
    </form>
  </section>;
}
export default function NamedLPConnectionsPanel() {
  const session = useAuthStore(state => state.accessToken);
  return session ? <Workspace key={session} /> : null;
}
