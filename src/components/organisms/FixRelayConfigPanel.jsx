import React, { useEffect, useState } from 'react';
import { gatewayGetRelayConfig, gatewaySaveRelayConfig, gatewayApplyRelayConfig, gatewayGetRelayStatus } from '../../services/gateway.service';
import { buildRelayConfig, relayFormFromConfig } from '../../lib/fixRelayConfig';
import './gateway-support-panels.css';

const connectionFields = [
  ['host', 'Host', 'Relay server address'],
  ['port', 'Port', '1–65535'],
  ['sender_comp_id', 'Sender CompID', 'Your FIX sender ID'],
  ['target_comp_id', 'Target CompID', 'Superadmin FIX target ID'],
  ['username', 'Username', 'Relay username'],
];

export default function FixRelayConfigPanel() {
  const [form, setForm] = useState(() => relayFormFromConfig());
  const [passwordSet, setPasswordSet] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.allSettled([gatewayGetRelayConfig(), gatewayGetRelayStatus()]).then(([configResult, statusResult]) => {
      if (!active) return;
      if (configResult.status === 'fulfilled') {
        const config = configResult.value;
        setForm(relayFormFromConfig(config));
        setPasswordSet(Boolean(config.password_set));
        setSaved(Boolean(config.host));
        setDirty(false);
        setLoadError(false);
      } else setLoadError(true);
      if (statusResult.status === 'fulfilled') setStatus(statusResult.value);
      else setStatus(null);
      const failures = [
        configResult.status === 'rejected' && (configResult.reason?.message || 'Unable to load relay configuration.'),
        statusResult.status === 'rejected' && (statusResult.reason?.message || 'Unable to load relay status.'),
      ].filter(Boolean);
      if (failures.length) setError(failures.join(' '));
    })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [loadAttempt]);

  const change = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
    setError('');
    setNotice('');
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
      setNotice('Apply request accepted. Check the connection status and incoming prices.');
      try { setStatus(await gatewayGetRelayStatus()); }
      catch (err) { setStatus(null); setError(`Apply request accepted, but connection status could not be refreshed. ${err.message || 'Try Refresh status.'}`); }
    } catch (err) { setError(err.message || 'Unable to apply relay configuration.'); }
    finally { setBusy(false); }
  };
  const refresh = async () => {
    setBusy(true); setError('');
    try { setStatus(await gatewayGetRelayStatus()); }
    catch (err) { setStatus(null); setError(err.message || 'Unable to load relay status.'); }
    finally { setBusy(false); }
  };

  const applyBlocked = dirty || !saved || status?.feature_enabled === false || status?.selected === false;
  const applyHelp = dirty ? 'Save your changes before applying.' : !saved ? 'Save a configuration before applying.'
    : status?.feature_enabled === false ? 'Relay access is disabled on this broker.'
      : status?.selected === false ? 'Select the separate FIX relay as the price source first.' : '';

  return (
    <section className="gw-support gw-relay" aria-labelledby="gw-relay-title">
      <header className="gw-support-header">
        <div>
          <h2 id="gw-relay-title">Superadmin FIX relay</h2>
          <p>Enter the connection details issued for this broker by Superadmin. Save the settings, then apply them after the separate FIX relay is enabled for this broker.</p>
        </div>
      </header>

      <div className="gw-support-status-grid" aria-label="Relay status">
        <div><span>Configuration</span><strong>{dirty ? 'Unsaved changes' : saved ? 'Saved' : 'Not saved'}</strong></div>
        <div><span>FIX login</span><strong>{status == null ? 'Unknown' : status.connected ? 'Connected' : 'Disconnected'}</strong></div>
        <div><span>Last price tick</span><strong>{status?.last_received_tick || 'None reported'}</strong></div>
        <div><span>Subscriptions</span><strong>{Array.isArray(status?.subscriptions) ? status.subscriptions.join(', ') || 'None' : 'Not reported'}</strong></div>
      </div>
      {status?.feature_enabled === false && <p className="gw-support-message gw-support-warning">Relay access is disabled on this broker backend.</p>}
      {status?.feature_enabled && status?.selected === false && <p className="gw-support-message gw-support-warning">This broker uses another price source. An operator must select the separate FIX relay before it can connect.</p>}
      {status?.error && <p className="gw-support-message gw-support-error">Connection: {status.error}</p>}
      {error && <p role="alert" className="gw-support-message gw-support-error">{error}</p>}
      {loadError && <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" disabled={busy} onClick={() => { setBusy(true); setError(''); setLoadAttempt(value => value + 1); }}>Retry loading saved configuration</button>}
      {notice && <p role="status" className="gw-support-message gw-support-success" style={{ color: '#ffffff' }}>{notice}</p>}
      {busy && <p role="status" className="gw-support-progress">Updating relay information…</p>}

      <form onSubmit={save}>
        <fieldset disabled={busy} className="gw-support-fieldset">
          <legend>Connection credentials</legend>
          <p className="gw-support-hint">Use the exact FIX details provided by Superadmin. All connection fields are required.</p>
          <div className="gw-support-form-grid">
            {connectionFields.map(([key, label, placeholder]) => (
              <label key={key} className="gw-support-field">
                <span>{label} <span aria-hidden="true">*</span></span>
                <input className="ui-input ui-input-sm" value={form[key]} onChange={change(key)} required type={key === 'port' ? 'number' : 'text'} placeholder={placeholder} {...(key === 'port' ? { min: 1, max: 65535, step: 1 } : {})} />
              </label>
            ))}
            <label className="gw-support-field">
              <span>Password {!passwordSet && <span aria-hidden="true">*</span>}</span>
              <input className="ui-input ui-input-sm" type="password" autoComplete="new-password" value={form.password} onChange={change('password')} placeholder={passwordSet ? 'Leave blank to keep saved password' : 'Password issued by Superadmin'} required={!passwordSet} />
              {passwordSet && <span className="gw-support-hint">A password is saved. Leave this blank to keep it.</span>}
            </label>
          </div>
        </fieldset>
        <fieldset disabled={busy} className="gw-support-fieldset">
          <legend>Feed options</legend>
          <div className="gw-support-form-grid">
            <label className="gw-support-field">
              <span>Allowed symbols {form.enabled && <span aria-hidden="true">*</span>}</span>
              <input className="ui-input ui-input-sm" value={form.symbols} onChange={change('symbols')} placeholder="EURUSD, XAUUSD" required={form.enabled} />
              <span className="gw-support-hint">Enter explicit symbols separated by commas. Wildcards are not supported.</span>
            </label>
            <div className="gw-support-toggle-group">
              <label className="gw-support-check"><input type="checkbox" checked={form.use_tls} onChange={change('use_tls')} /> Use a secure connection (TLS)</label>
              <label className="gw-support-check"><input type="checkbox" checked={form.enabled} onChange={change('enabled')} /> Enable FIX relay source</label>
            </div>
          </div>
        </fieldset>
        <div className="gw-support-actions">
          <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" disabled={busy} onClick={refresh}>Refresh status</button>
          <button type="submit" className="ui-btn ui-btn-primary ui-btn-sm" disabled={busy}>Save configuration</button>
          <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" disabled={busy || applyBlocked} onClick={apply}>Apply saved configuration</button>
        </div>
        {applyHelp && <p className="gw-support-hint gw-support-action-hint">{applyHelp}</p>}
      </form>
    </section>
  );
}
