import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Save, Zap } from 'lucide-react';
import {
  gatewayApplyFeedConfig,
  gatewayGetFeedConfig,
  gatewaySaveFeedConfig,
} from '../../services/gateway.service';
import { buildFeedConfigPayload, normalizeFeedProvider } from '../../lib/feedConfigPayload';
import { useToast } from '../ui/Toast';

const PROVIDER_OPTIONS = [
  { value: 'rtxmd', label: 'RTX Market Data FIX' },
  { value: 't4b', label: 'T4B' },
  { value: 'equinix', label: 'Equinix FIX 4.4' },
];

const DEFAULT_FORM = {
  feed_provider: 'rtxmd',
  enabled: false,
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

const symbolsToText = (symbols) => {
  if (Array.isArray(symbols)) return symbols.join(', ');
  if (typeof symbols === 'string') return symbols;
  return '';
};

const normalizeForm = (data) => {
  const cserver = data?.cserver || {};
  const symbols = symbolsToText(cserver.symbols);

  return {
    feed_provider: normalizeFeedProvider(data?.feed_provider) || DEFAULT_FORM.feed_provider,
    enabled: Boolean(data?.enabled),
    host: cserver.host || '',
    port: cserver.port ? String(cserver.port) : '',
    sender_comp_id: cserver.sender_comp_id || '',
    target_comp_id: cserver.target_comp_id || '',
    username: cserver.username || '',
    password: '',
    use_ssl: cserver.use_ssl ?? true,
    all_symbols: symbols.trim() === '',
    symbols,
    catalog_file: cserver.catalog_file || '',
  };
};

const Field = ({ label, required, children }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">
      {label}{required && <span className="ml-0.5 text-red-400">*</span>}
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
      className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
      style={{
        background: isError ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
        color: isError ? '#f87171' : '#4ade80',
        border: `1px solid ${isError ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`,
      }}
    >
      {isError ? <AlertCircle size={13} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={13} className="mt-0.5 shrink-0" />}
      <span>{children}</span>
    </div>
  );
};

const GatewaysView = () => {
  const { notify } = useToast();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [passwordSet, setPasswordSet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const disabled = loading || saving || applying;

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

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotice('');

    try {
      const data = await gatewayGetFeedConfig();
      setForm(normalizeForm(data));
      setPasswordSet(Boolean(data?.password_set));
    } catch (err) {
      setError(`Saved LP credentials could not be loaded: ${err.message || 'request failed'}. You can still enter credentials below.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (!cancelled) await loadConfig();
    })();
    return () => { cancelled = true; };
  }, [loadConfig]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (form.enabled) {
      const missing = [
        ['Host', form.host],
        ['Port', form.port],
        ['Sender CompID', form.sender_comp_id],
        ['Target CompID', form.target_comp_id],
        ['Username', form.username],
      ].filter(([, value]) => !String(value || '').trim());

      if (missing.length > 0) {
        setError(`${missing.map(([label]) => label).join(', ')} required when LP credentials are enabled.`);
        return;
      }
    }

    if (form.port && !Number.isInteger(Number(form.port))) {
      setError('Port must be a whole number.');
      return;
    }

    setSaving(true);
    try {
      const payload = buildFeedConfigPayload(form);
      await gatewaySaveFeedConfig(payload);
      if (payload.password) setPasswordSet(true);
      setForm((current) => ({ ...current, password: '' }));
      setNotice(`${providerLabel(payload.feed_provider)} LP credentials saved.`);
      notify({ title: 'LP credentials saved', tone: 'success' });
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
      const result = await gatewayApplyFeedConfig();
      const activeProvider = result?.feed_provider || result?.provider || form.feed_provider;
      setNotice(`LP credentials applied: ${providerLabel(activeProvider)}.`);
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
    <div className="flex-1 min-h-0 bg-[color:var(--bg-app)] overflow-y-auto text-[color:var(--text-primary)]">
      <div className="flex items-start justify-between border-b border-black/40 bg-[color:var(--bg-surface-1)] px-5 py-4">
        <div>
          <h1 className="mb-1 text-[17px] font-semibold text-white">Gateways</h1>
          <p className="text-[12px] text-[color:var(--text-muted)]">Enter your LP credentials.</p>
        </div>
        <button
          type="button"
          onClick={loadConfig}
          disabled={disabled}
          className="ui-btn ui-btn-ghost ui-btn-icon ui-btn-sm"
          title="Reload saved credentials"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="p-5 pb-12">
        <form
          onSubmit={handleSubmit}
          className="flex max-w-[980px] flex-col gap-4 rounded-xl border p-4"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--border-3)' }}>
            <div>
              <div className="text-sm font-semibold text-[color:var(--text-primary)]">Enter your LP credentials</div>
              <div className="mt-1 text-[12px] text-[color:var(--text-muted)]">
                Save the FIX quote-session credentials that the broker backend should use for upstream market data.
              </div>
            </div>
            <div
              className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
              style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}
            >
              {providerLabel(form.feed_provider)}
            </div>
          </div>

          <Notice tone="error">{error}</Notice>
          <Notice>{notice}</Notice>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Provider">
              <select className="ui-select ui-input-sm" value={form.feed_provider} onChange={setField('feed_provider')} disabled={disabled}>
                {PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Enabled">
              <label className="flex h-[30px] items-center gap-2 rounded border px-2 text-[12px]" style={{ borderColor: 'var(--border-3)' }}>
                <input type="checkbox" checked={form.enabled} onChange={setField('enabled')} disabled={disabled} className="accent-blue-500" />
                Enable these LP credentials
              </label>
            </Field>

            <Field label="Use SSL">
              <label className="flex h-[30px] items-center gap-2 rounded border px-2 text-[12px]" style={{ borderColor: 'var(--border-3)' }}>
                <input type="checkbox" checked={form.use_ssl} onChange={setField('use_ssl')} disabled={disabled} className="accent-blue-500" />
                SSL / TLS
              </label>
            </Field>

            <Field label="Host" required>
              <Input value={form.host} onChange={setField('host')} placeholder="Enter LP host" disabled={disabled} />
            </Field>

            <Field label="Port" required>
              <Input type="number" value={form.port} onChange={setField('port')} placeholder="Enter LP port" disabled={disabled} />
            </Field>

            <Field label="Sender CompID" required>
              <Input value={form.sender_comp_id} onChange={setField('sender_comp_id')} placeholder="Enter sender CompID" disabled={disabled} />
            </Field>

            <Field label="Target CompID" required>
              <Input value={form.target_comp_id} onChange={setField('target_comp_id')} placeholder="Enter target CompID" disabled={disabled} />
            </Field>

            <Field label="Username" required>
              <Input value={form.username} onChange={setField('username')} placeholder="Enter LP username" disabled={disabled} />
            </Field>

            <Field label="Password">
              <Input
                type="password"
                value={form.password}
                onChange={setField('password')}
                placeholder={passwordSet ? 'Configured - enter replacement password' : 'Enter LP password'}
                disabled={disabled}
              />
            </Field>

            <Field label="Symbols Mode">
              <label className="flex h-[30px] items-center gap-2 rounded border px-2 text-[12px]" style={{ borderColor: 'var(--border-3)' }}>
                <input type="checkbox" checked={form.all_symbols} onChange={setField('all_symbols')} disabled={disabled} className="accent-blue-500" />
                All symbols
              </label>
            </Field>

            <Field label="Symbols">
              <Input
                value={form.symbols}
                onChange={setField('symbols')}
                placeholder="EURUSD, GBPUSD, XAUUSD"
                disabled={disabled || form.all_symbols}
              />
            </Field>

            <Field label="Catalog File">
              <Input value={form.catalog_file} onChange={setField('catalog_file')} placeholder="Optional catalog file path" disabled={disabled} />
            </Field>
          </div>

          <div className="flex justify-end gap-2 border-t pt-3" style={{ borderColor: 'var(--border-3)' }}>
            <button type="button" onClick={handleApply} disabled={disabled} className="ui-btn ui-btn-secondary ui-btn-sm gap-1.5">
              {applying ? <><Loader2 size={12} className="animate-spin" /> Applying</> : <><Zap size={12} /> Apply Now</>}
            </button>
            <button type="submit" disabled={disabled} className="ui-btn ui-btn-primary ui-btn-sm gap-1.5">
              {saving ? <><Loader2 size={12} className="animate-spin" /> Saving</> : <><Save size={12} /> Save LP Credentials</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GatewaysView;
