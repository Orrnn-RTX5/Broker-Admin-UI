import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Network, Save, Zap } from 'lucide-react';
import {
  gatewayApplyFeedConfig,
  gatewayGetFeedConfig,
  gatewaySaveFeedConfig,
} from '../../services/gateway.service';
import { buildFeedConfigPayload, normalizeFeedProvider } from '../../lib/feedConfigPayload';
import { useToast } from '../ui/useToast';
import FixRelayConfigPanel from './FixRelayConfigPanel';
import GatewaySymbolPicker from './GatewaySymbolPicker';
import './GatewaysView.css';

const PROVIDER_OPTIONS = [
  { value: 'rtxmd', label: 'RTX Market Data FIX' },
  { value: 't4b', label: 'T4B' },
  { value: 'equinix', label: 'Equinix FIX 4.4' },
];

const DEFAULT_FORM = {
  feed_provider: 'rtxmd',
  enabled: true,
  host: '',
  port: '',
  sender_comp_id: '',
  target_comp_id: '',
  username: '',
  password: '',
  use_ssl: true,
  all_symbols: true,
  symbols: '',
  catalog_file: '',
};

const providerLabel = (value) =>
  PROVIDER_OPTIONS.find((option) => option.value === normalizeFeedProvider(value))?.label ||
  normalizeFeedProvider(value) ||
  'RTX Market Data FIX';

const formFromSavedConfig = (config) => {
  const cserver = config?.cserver || {};
  const symbols = String(cserver.symbols || '').trim();

  return {
    ...DEFAULT_FORM,
    feed_provider: normalizeFeedProvider(config?.feed_provider) || DEFAULT_FORM.feed_provider,
    enabled: typeof config?.enabled === 'boolean' ? config.enabled : DEFAULT_FORM.enabled,
    host: String(cserver.host || ''),
    port: cserver.port ? String(cserver.port) : '',
    sender_comp_id: String(cserver.sender_comp_id || ''),
    target_comp_id: String(cserver.target_comp_id || ''),
    username: String(cserver.username || ''),
    password: '',
    use_ssl: typeof cserver.use_ssl === 'boolean' ? cserver.use_ssl : DEFAULT_FORM.use_ssl,
    all_symbols: symbols === '',
    symbols,
    catalog_file: String(cserver.catalog_file || ''),
  };
};

const Field = ({ label, required, children }) => (
  <label className="gateways-field">
    <span className="gateways-field-label">
      {label}{required && <span className="gateways-required">*</span>}
    </span>
    {children}
  </label>
);

const Input = ({ type = 'text', value, onChange, placeholder, required, disabled }) => (
  <input
    type={type}
    className="ui-input ui-input-sm"
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    required={required}
    disabled={disabled}
  />
);

const Notice = ({ tone = 'info', children }) => {
  if (!children) return null;

  const isError = tone === 'error';
  return (
    <div
      className={`gateways-notice gateways-notice--${isError ? 'error' : 'success'}`}
      role={isError ? 'alert' : 'status'}
    >
      {isError ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
      <span>{children}</span>
    </div>
  );
};

const GatewaysView = () => {
  const { notify } = useToast();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [passwordSet, setPasswordSet] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const disabled = saving || applying || loadingConfig;

  useEffect(() => {
    let mounted = true;
    setLoadingConfig(true);
    gatewayGetFeedConfig()
      .then((config) => {
        if (!mounted) return;
        setForm(formFromSavedConfig(config));
        setPasswordSet(Boolean(config?.password_set));
      })
      .catch((err) => {
        if (!mounted) return;
        const message = err.message || 'Failed to load saved LP credentials.';
        setError(message);
      })
      .finally(() => {
        if (mounted) setLoadingConfig(false);
      });

    return () => { mounted = false; };
  }, []);

  const setField = (key) => (event) => {
    const { checked, type, value } = event.target;
    setForm((current) => {
      const next = { ...current, [key]: type === 'checkbox' ? checked : value };
      if (key === 'all_symbols' && checked) next.symbols = '';
      return next;
    });
    setError('');
    setNotice('');
  };

  const validateForm = () => {
    if (form.enabled) {
      const missing = [
        ['Host', form.host],
        ['Port', form.port],
        ['Sender CompID', form.sender_comp_id],
        ['Target CompID', form.target_comp_id],
        ['Username', form.username],
        ['Password', passwordSet || form.password],
      ].filter(([, value]) => !String(value || '').trim());

      if (missing.length > 0) {
        return `${missing.map(([label]) => label).join(', ')} required when LP credentials are enabled.`;
      }

      if (!form.all_symbols && !form.symbols.trim()) {
        return 'Select at least one symbol or enable "Subscribe to all symbols".';
      }
    }

    if (form.port && !Number.isInteger(Number(form.port))) {
      return 'Port must be a whole number.';
    }

    if (form.port && Number(form.port) <= 0) {
      return 'Port must be greater than zero.';
    }

    return '';
  };

  const saveCurrentCredentials = async ({ announce = true } = {}) => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return null;
    }

    const payload = buildFeedConfigPayload(form);
    await gatewaySaveFeedConfig(payload);
    setForm((current) => ({ ...current, password: '' }));
    setPasswordSet(Boolean(payload.password || passwordSet));
    if (announce) {
      setNotice(`${providerLabel(payload.feed_provider)} LP credentials saved.`);
      notify({ title: 'LP credentials saved', tone: 'success' });
    }
    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await saveCurrentCredentials();
    } catch (err) {
      const message = err.message || 'Failed to save LP credentials.';
      setError(message);
      notify({ title: 'Save failed', description: message, tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const handleApply = async () => {
    setError('');
    setNotice('');
    setApplying(true);

    try {
      const payload = await saveCurrentCredentials({ announce: false });
      if (!payload) return;
      const result = await gatewayApplyFeedConfig();
      const activeProvider = result?.feed_provider || result?.provider || form.feed_provider;
      setNotice(`${providerLabel(payload.feed_provider)} LP credentials saved and applied.`);
      notify({ title: 'LP credentials applied', description: providerLabel(activeProvider), tone: 'success' });
    } catch (err) {
      const message = err.message || 'Failed to apply LP credentials.';
      setError(message);
      notify({ title: 'Apply failed', description: message, tone: 'danger' });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="gateways-view">
      <header className="gateways-header">
        <div className="gateways-heading">
          <Network size={15} aria-hidden="true" />
          <h1>Gateways</h1>
          <span className="gateways-header-description">Liquidity provider configuration</span>
        </div>
        <span className="gateways-provider-badge">{providerLabel(form.feed_provider)}</span>
      </header>

      <div className="gateways-content">
        {import.meta.env.VITE_FIX_RELAY_ENABLED === 'true' && <FixRelayConfigPanel />}
        <form
          onSubmit={handleSubmit}
          className="gateways-form"
          aria-labelledby="gateways-credentials-title"
          aria-busy={disabled}
        >
          <div className="gateways-form-heading">
            <div>
              <h2 id="gateways-credentials-title">LP credentials</h2>
              <p>Configure the FIX connection used for upstream market data.</p>
            </div>
            <span className="gateways-config-state">
              {loadingConfig ? <><Loader2 size={12} className="animate-spin" /> Loading configuration</> : 'FIX quote session'}
            </span>
          </div>

          <Notice tone="error">{error}</Notice>
          <Notice>{notice}</Notice>

          <div className="gateways-grid gateways-options">
            <Field label="Provider">
              <select className="ui-select ui-input-sm" value={form.feed_provider} onChange={setField('feed_provider')} disabled={disabled}>
                {PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Enabled">
              <span className="gateways-toggle">
                <input type="checkbox" checked={form.enabled} onChange={setField('enabled')} disabled={disabled} />
                <span>Enable LP credentials</span>
              </span>
            </Field>

            <Field label="Transport security">
              <span className="gateways-toggle">
                <input type="checkbox" checked={form.use_ssl} onChange={setField('use_ssl')} disabled={disabled} />
                <span>Use SSL / TLS</span>
              </span>
            </Field>
          </div>

          <section className="gateways-section" aria-labelledby="gateways-connection-title">
            <h3 id="gateways-connection-title">Connection & authentication</h3>
            <div className="gateways-grid">
              <Field label="Host" required={form.enabled}>
                <Input value={form.host} onChange={setField('host')} placeholder="LP hostname or IP address" disabled={disabled} />
              </Field>

              <Field label="Port" required={form.enabled}>
                <Input type="number" value={form.port} onChange={setField('port')} placeholder="LP connection port" disabled={disabled} />
              </Field>

              <Field label="Sender CompID" required={form.enabled}>
                <Input value={form.sender_comp_id} onChange={setField('sender_comp_id')} placeholder="Enter sender CompID" disabled={disabled} />
              </Field>

              <Field label="Target CompID" required={form.enabled}>
                <Input value={form.target_comp_id} onChange={setField('target_comp_id')} placeholder="Enter target CompID" disabled={disabled} />
              </Field>

              <Field label="Username" required={form.enabled}>
                <Input value={form.username} onChange={setField('username')} placeholder="Enter LP username" disabled={disabled} />
              </Field>

              <Field label="Password" required={form.enabled && !passwordSet}>
                <Input
                  type="password"
                  value={form.password}
                  onChange={setField('password')}
                  placeholder={passwordSet ? 'Leave blank to keep saved password' : 'Enter LP password'}
                  disabled={disabled}
                />
              </Field>
            </div>
          </section>

          <section className="gateways-section" aria-labelledby="gateways-symbols-title">
            <h3 id="gateways-symbols-title">Symbol subscription</h3>
            <div className="gateways-grid">
              <Field label="Symbols mode">
                <span className="gateways-toggle">
                  <input type="checkbox" checked={form.all_symbols} onChange={setField('all_symbols')} disabled={disabled} />
                  <span>Subscribe to all symbols</span>
                </span>
              </Field>

              <div className="gateways-field">
                <span className="gateways-field-label">Symbols</span>
                <GatewaySymbolPicker
                  value={form.symbols}
                  onChange={(symbols) => {
                    setForm((current) => ({ ...current, symbols }));
                    setError('');
                    setNotice('');
                  }}
                  allSymbols={form.all_symbols}
                  disabled={disabled || form.all_symbols}
                />
              </div>

              <Field label="Catalog file">
                <Input value={form.catalog_file} onChange={setField('catalog_file')} placeholder="Optional catalog file path" disabled={disabled} />
              </Field>
            </div>
          </section>

          <footer className="gateways-form-footer">
            <span className="gateways-form-help">
              {passwordSet ? 'Saved password is retained when left blank.' : 'Required fields are marked with *.'}
            </span>
            <div className="gateways-actions">
              <button type="button" onClick={handleApply} disabled={disabled} className="ui-btn ui-btn-secondary ui-btn-sm gap-1.5">
                {applying ? <><Loader2 size={12} className="animate-spin" /> Applying</> : <><Zap size={12} /> Save & Apply</>}
              </button>
              <button type="submit" disabled={disabled} className="ui-btn ui-btn-primary ui-btn-sm gap-1.5">
                {saving || loadingConfig ? <><Loader2 size={12} className="animate-spin" /> {loadingConfig ? 'Loading' : 'Saving'}</> : <><Save size={12} /> Save LP Credentials</>}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default GatewaysView;
