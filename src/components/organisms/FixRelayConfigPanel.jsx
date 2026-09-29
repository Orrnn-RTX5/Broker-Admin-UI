import React, { useEffect, useState } from 'react';
import { gatewayGetRelayConfig, gatewaySaveRelayConfig, gatewayApplyRelayConfig, gatewayGetRelayStatus } from '../../services/gateway.service';
import { buildRelayConfig, relayFormFromConfig } from '../../lib/fixRelayConfig';

export default function FixRelayConfigPanel() {
  const [form, setForm] = useState(() => relayFormFromConfig());
  const [passwordSet, setPasswordSet] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([gatewayGetRelayConfig(), gatewayGetRelayStatus()]).then(([config, state]) => {
      if (!active) return;
      setForm(relayFormFromConfig(config));
      setPasswordSet(Boolean(config.password_set));
      setSaved(Boolean(config.host));
      setStatus(state);
    }).catch((err) => { if (active) setError(err.message || 'Unable to load relay configuration.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  const change = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((previous) => ({ ...previous, [key]: value }));
    setDirty(true); setError(''); setNotice('');
  };
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const payload = buildRelayConfig(form, passwordSet);
      await gatewaySaveRelayConfig(payload);
      setPasswordSet(passwordSet || Boolean(payload.password));
      setForm((previous) => ({ ...previous, password: '' }));
      setSaved(true); setDirty(false);
      setNotice('Configuration saved. Apply it when this broker is enabled for the separate FIX relay.');
    } catch (err) { setError(err.message || 'Unable to save relay configuration.'); }
    finally { setBusy(false); }
  };
  const apply = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      await gatewayApplyRelayConfig();
      setNotice('Apply request accepted. Refresh connection status to verify FIX login and incoming prices.');
      setStatus(await gatewayGetRelayStatus());
    } catch (err) { setError(err.message || 'Unable to apply relay configuration.'); }
    finally { setBusy(false); }
  };
  const refresh = async () => {
    setBusy(true); setError('');
    try { setStatus(await gatewayGetRelayStatus()); }
    catch (err) { setStatus(null); setError(err.message || 'Unable to load relay status.'); }
    finally { setBusy(false); }
  };
  return (
    <section className="mb-5 max-w-[980px] rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <h2 className="text-sm font-semibold">Superadmin FIX Relay</h2>
      <p className="mt-1 text-xs text-[color:var(--text-muted)]">Enter the connection details issued for this broker by Superadmin. The broker must be enabled for this feed before you apply the saved configuration.</p>
      <div className="my-3 flex flex-wrap gap-4 text-xs" aria-live="polite">
        <span>Configuration: {dirty ? 'Unsaved changes' : saved ? 'Saved' : 'Not saved'}</span>
        <span>FIX login: {status == null ? 'Unknown' : status.connected ? 'Connected' : 'Disconnected'}</span>
        <span>Last tick: {status?.last_received_tick || 'None reported'}</span>
        <span>Subscriptions: {Array.isArray(status?.subscriptions) ? status.subscriptions.join(', ') || 'None' : 'Not reported'}</span>
      </div>
      {status?.feature_enabled === false && <p className="my-2 text-xs text-amber-400">Relay access is disabled on this broker backend.</p>}
      {status?.feature_enabled && status?.selected === false && <p className="my-2 text-xs text-amber-400">This broker currently uses another price source. Your operator must select the separate FIX relay before you can connect.</p>}
      {status?.error && <p className="my-2 text-xs text-red-400">Connection: {status.error}</p>}
      {error && <p role="alert" className="my-2 text-xs text-red-400">{error}</p>}
      {notice && <p role="status" className="my-2 text-xs text-white">{notice}</p>}
      <form onSubmit={save}>
        <fieldset disabled={busy} className="grid gap-3 md:grid-cols-3">
          {['host', 'port', 'sender_comp_id', 'target_comp_id', 'username'].map((key) => (
            <label key={key} className="flex flex-col gap-1 text-xs">
              {key.replaceAll('_', ' ').toUpperCase()}
              <input className="ui-input ui-input-sm" value={form[key]} onChange={change(key)} required type={key === 'port' ? 'number' : 'text'} {...(key === 'port' ? { min: 1, max: 65535, step: 1 } : {})} />
            </label>
          ))}
          <label className="flex flex-col gap-1 text-xs">PASSWORD
            <input className="ui-input ui-input-sm" type="password" autoComplete="new-password" value={form.password} onChange={change('password')} placeholder={passwordSet ? 'Saved; leave blank to keep' : 'Password issued by Superadmin'} required={!passwordSet} />
          </label>
          <label className="flex flex-col gap-1 text-xs">SYMBOLS
            <input className="ui-input ui-input-sm" value={form.symbols} onChange={change('symbols')} placeholder="EURUSD, XAUUSD" required={form.enabled} />
          </label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.use_tls} onChange={change('use_tls')} />Use TLS</label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.enabled} onChange={change('enabled')} />Enable FIX relay source</label>
        </fieldset>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" disabled={busy} onClick={refresh}>Refresh status</button>
          <button type="submit" className="ui-btn ui-btn-primary ui-btn-sm" disabled={busy}>Save configuration</button>
          <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" disabled={busy || dirty || !saved || status?.feature_enabled === false || status?.selected === false} onClick={apply}>Apply saved configuration</button>
        </div>
      </form>
    </section>
  );
}
