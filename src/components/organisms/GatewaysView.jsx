import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, Loader2, X, Plus, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Save, ShieldCheck, Activity, Rss, Zap, ClipboardPaste } from 'lucide-react';
import {
  gatewayGetStatus,
  gatewayConnect,
  gatewayDisconnect,
  gatewayGetCentralConfig,
  gatewaySaveCentralConfig,
  gatewayGetFeedConfig,
  gatewaySaveFeedConfig,
  gatewayApplyFeedConfig,
} from '../../services/gateway.service';
import { buildFeedConfigPayload, normalizeFeedProvider, parseFeedConfigImport } from '../../lib/feedConfigPayload';
import { useToast } from '../ui/Toast';

// ─── Shared field components ───────────────────────────────────────────────────
const F = ({ label, required, children }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    {children}
  </div>
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

const Textarea = ({ value, onChange, placeholder, disabled }) => (
  <textarea
    className="ui-textarea ui-input-sm min-h-[104px] resize-y font-mono text-[11px]"
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    disabled={disabled}
  />
);

const SectionLabel = ({ children, color = 'var(--text-3)' }) => (
  <div className="flex items-center gap-2 mt-2">
    <div className="flex-1 border-t" style={{ borderColor: 'var(--border-3)' }} />
    <span className="text-[10px] uppercase tracking-widest font-bold shrink-0" style={{ color }}>{children}</span>
    <div className="flex-1 border-t" style={{ borderColor: 'var(--border-3)' }} />
  </div>
);

const RoleSelector = ({ value, onChange }) => (
  <div className="flex gap-2">
    {['both', 'quote', 'trade'].map(r => (
      <button
        key={r}
        type="button"
        onClick={() => onChange(r)}
        className="flex-1 py-1.5 text-xs font-semibold capitalize rounded-md border transition-all"
        style={{
          background: value === r ? 'var(--accent)' : 'var(--surface-2)',
          color: value === r ? '#fff' : 'var(--text-2)',
          borderColor: value === r ? 'var(--accent)' : 'var(--border)',
        }}
      >
        {r}
      </button>
    ))}
  </div>
);

const ErrBox = ({ msg }) => msg ? (
  <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
    style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
    <AlertCircle size={12} className="shrink-0" /> {msg}
  </div>
) : null;

const DEFAULT_CENTRAL_LP_FORM = {
  enabled: true,
  upstream_ws_url: '',
  upstream_ws_broker_id: 'gta_broker',
  token: '',
  upstream_ws_auth_header: 'Authorization',
  upstream_ws_symbols: 'EURUSD, GBPUSD, XAUUSD, BTCUSD',
  central_lp_order_url: '',
  central_lp_order_broker_id: 'gta_broker',
  central_lp_order_auth_header: 'Authorization',
  central_lp_order_target_lp: 'T4B-TRADE',
  central_lp_order_timeout_ms: 30000,
  connect: true,
};

const unwrapCentralConfig = (data) =>
  data?.config || data?.central_config || data?.central_lp || data?.data || data || {};

const normalizeSymbols = (symbols) => {
  if (Array.isArray(symbols)) return symbols.join(', ');
  if (typeof symbols === 'string') return symbols;
  return DEFAULT_CENTRAL_LP_FORM.upstream_ws_symbols;
};

const parseSymbols = (symbols) =>
  String(symbols || '')
    .split(',')
    .map((symbol) => symbol.trim())
    .filter(Boolean);

const isSecretConfigured = (config) =>
  Boolean(
    config?.token_configured ??
    config?.token_set ??
    config?.has_token ??
    config?.hasToken ??
    config?.broker_service_token_configured ??
    config?.token
  );

const normalizeCentralForm = (data) => {
  const config = unwrapCentralConfig(data);

  return {
    ...DEFAULT_CENTRAL_LP_FORM,
    enabled: config.enabled ?? DEFAULT_CENTRAL_LP_FORM.enabled,
    upstream_ws_url: config.upstream_ws_url || '',
    upstream_ws_broker_id: config.upstream_ws_broker_id || DEFAULT_CENTRAL_LP_FORM.upstream_ws_broker_id,
    token: '',
    upstream_ws_auth_header: config.upstream_ws_auth_header || DEFAULT_CENTRAL_LP_FORM.upstream_ws_auth_header,
    upstream_ws_symbols: normalizeSymbols(config.upstream_ws_symbols),
    central_lp_order_url: config.central_lp_order_url || '',
    central_lp_order_broker_id: config.central_lp_order_broker_id || DEFAULT_CENTRAL_LP_FORM.central_lp_order_broker_id,
    central_lp_order_auth_header: config.central_lp_order_auth_header || DEFAULT_CENTRAL_LP_FORM.central_lp_order_auth_header,
    central_lp_order_target_lp: config.central_lp_order_target_lp || DEFAULT_CENTRAL_LP_FORM.central_lp_order_target_lp,
    central_lp_order_timeout_ms: Number(config.central_lp_order_timeout_ms || DEFAULT_CENTRAL_LP_FORM.central_lp_order_timeout_ms),
    connect: config.connect ?? DEFAULT_CENTRAL_LP_FORM.connect,
  };
};

const buildCentralPayload = (form) => {
  const payload = {
    enabled: Boolean(form.enabled),
    upstream_ws_url: form.upstream_ws_url.trim(),
    upstream_ws_broker_id: form.upstream_ws_broker_id.trim(),
    upstream_ws_auth_header: form.upstream_ws_auth_header.trim() || 'Authorization',
    upstream_ws_symbols: parseSymbols(form.upstream_ws_symbols),
    central_lp_order_url: form.central_lp_order_url.trim(),
    central_lp_order_broker_id: form.central_lp_order_broker_id.trim(),
    central_lp_order_auth_header: form.central_lp_order_auth_header.trim() || 'Authorization',
    central_lp_order_target_lp: form.central_lp_order_target_lp.trim(),
    central_lp_order_timeout_ms: Number(form.central_lp_order_timeout_ms) || 30000,
    connect: Boolean(form.connect),
  };

  const token = form.token.trim();
  if (token) payload.token = token;

  return payload;
};

const getStatusSummary = (status) => {
  const central = status?.central_lp || status?.central || status || {};
  const quoteConnected = Boolean(status?.quote?.connected);
  const tradeConnected = Boolean(status?.trade?.connected);
  const centralConnected =
    central.connected ??
    central.central_lp_connected ??
    central.upstream_connected;
  const connected = Boolean(centralConnected ?? (quoteConnected || tradeConnected));

  return {
    connected,
    quote: quoteConnected,
    trade: tradeConnected,
    upstream: central.upstream || central.upstream_ws_url || central.feed || null,
    orderLp: status?.order_routing_lp || central.order_routing_lp || central.target_lp || null,
  };
};

const GATEWAY_DISCONNECTED_RE = /(No active|LP Gateway unreachable|connection refused|ECONNREFUSED|dial tcp)/i;

const isGatewayDisconnectedError = (error) => {
  const httpStatus =
    error?.status ??
    error?.response?.status ??
    (error?.message?.match(/HTTP (\d+)/)?.[1] && Number(error.message.match(/HTTP (\d+)/)[1]));

  return httpStatus === 401 || httpStatus === 404 || GATEWAY_DISCONNECTED_RE.test(error?.message || '');
};

const DISCONNECTED_STATUS = {
  quote: { connected: false },
  trade: { connected: false },
};

const ToggleField = ({ label, checked, onChange, disabled }) => (
  <label className="flex items-center gap-2 h-[30px] cursor-pointer">
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className="w-4 h-4 accent-blue-500 rounded"
    />
    <span className="text-xs" style={{ color: 'var(--text-2)' }}>{label}</span>
  </label>
);

const ConfiguredBadge = ({ show }) => show ? (
  <span
    className="inline-flex items-center h-5 px-2 rounded text-[10px] font-semibold uppercase tracking-wide"
    style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}
  >
    Configured
  </span>
) : null;

const CentralLpConfigPanel = () => {
  const [form, setForm] = useState(DEFAULT_CENTRAL_LP_FORM);
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');

  const setField = (key) => (event) => {
    const { type, checked, value } = event.target;
    setForm((current) => ({ ...current, [key]: type === 'checkbox' ? checked : value }));
    setNotice('');
  };

  const loadConfig = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setErr('');
    try {
      const data = await gatewayGetCentralConfig();
      const config = unwrapCentralConfig(data);
      setForm(normalizeCentralForm(data));
      setTokenConfigured(isSecretConfigured(config));
      return data;
    } catch (error) {
      setErr(error.message || 'Failed to load Central LP config');
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const data = await gatewayGetStatus();
      setStatus(data);
      return data;
    } catch (error) {
      if (isGatewayDisconnectedError(error)) {
        setStatus(DISCONNECTED_STATUS);
      } else {
        setErr(error.message || 'Failed to fetch gateway status');
      }
      return null;
    } finally {
      setStatusLoading(false);
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (!cancelled) await loadStatus();
    })();
    return () => { cancelled = true; };
  }, [loadStatus]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErr('');
    setNotice('');

    if (!tokenConfigured && !form.token.trim()) {
      setErr('Broker service token is required before Central LP can be configured.');
      return;
    }

    setSaving(true);
    try {
      const payload = buildCentralPayload(form);
      await gatewaySaveCentralConfig(payload);
      if (payload.token) setTokenConfigured(true);
      setForm((current) => ({ ...current, token: '' }));
      setNotice('Central LP config saved.');
      await loadConfig({ silent: true });
      await loadStatus();
    } catch (error) {
      setErr(error.message || 'Failed to save Central LP config');
    } finally {
      setSaving(false);
    }
  };

  const summary = getStatusSummary(status);
  const disabled = loading || saving;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-3)' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <ShieldCheck size={16} className="text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Central LP Order Routing</span>
              {loading && <Loader2 size={11} className="animate-spin" style={{ color: 'var(--muted)' }} />}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusDot on={summary.connected} />
              <span className="text-xs" style={{ color: summary.connected ? '#4ade80' : 'var(--muted)' }}>
                {summary.connected ? 'Connected' : 'Disconnected'}
              </span>
              <ConfiguredBadge show={tokenConfigured} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { loadConfig(); loadStatus(); }} disabled={disabled} title="Refresh config"
            className="ui-btn ui-btn-ghost ui-btn-icon ui-btn-sm">
            <RefreshCw size={13} className={loading || statusLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
        <ErrBox msg={err} />
        {notice && (
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}>
            <Activity size={12} className="shrink-0" /> {notice}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <F label="Enabled">
            <ToggleField label="Central LP enabled" checked={form.enabled} onChange={setField('enabled')} disabled={disabled} />
          </F>
          <F label="Connect">
            <ToggleField label="Connect after save" checked={form.connect} onChange={setField('connect')} disabled={disabled} />
          </F>
          <F label="Timeout MS">
            <Input type="number" value={form.central_lp_order_timeout_ms} onChange={setField('central_lp_order_timeout_ms')} disabled={disabled} />
          </F>
        </div>

        <SectionLabel>Legacy WebSocket Feed</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <F label="WebSocket URL" required>
            <Input value={form.upstream_ws_url} onChange={setField('upstream_ws_url')} placeholder="wss://superadmin.example.com/ws/feed?broker_id=gta_broker" required disabled={disabled} />
          </F>
          <F label="Broker ID" required>
            <Input value={form.upstream_ws_broker_id} onChange={setField('upstream_ws_broker_id')} placeholder="gta_broker" required disabled={disabled} />
          </F>
          <F label="Auth Header" required>
            <Input value={form.upstream_ws_auth_header} onChange={setField('upstream_ws_auth_header')} placeholder="Authorization" required disabled={disabled} />
          </F>
          <F label="Symbols" required>
            <Input value={form.upstream_ws_symbols} onChange={setField('upstream_ws_symbols')} placeholder="EURUSD, GBPUSD, XAUUSD, BTCUSD" required disabled={disabled} />
          </F>
        </div>

        <SectionLabel>Order Route</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <F label="Order URL" required>
            <Input value={form.central_lp_order_url} onChange={setField('central_lp_order_url')} placeholder="https://superadmin.example.com/api/v1/central-lp/order" required disabled={disabled} />
          </F>
          <F label="Order Broker ID" required>
            <Input value={form.central_lp_order_broker_id} onChange={setField('central_lp_order_broker_id')} placeholder="gta_broker" required disabled={disabled} />
          </F>
          <F label="Order Auth Header" required>
            <Input value={form.central_lp_order_auth_header} onChange={setField('central_lp_order_auth_header')} placeholder="Authorization" required disabled={disabled} />
          </F>
          <F label="Target LP" required>
            <Input value={form.central_lp_order_target_lp} onChange={setField('central_lp_order_target_lp')} placeholder="T4B-TRADE" required disabled={disabled} />
          </F>
        </div>

        <SectionLabel>Broker Service Token</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-end">
          <F label="Token" required={!tokenConfigured}>
            <Input
              type="password"
              value={form.token}
              onChange={setField('token')}
              placeholder={tokenConfigured ? 'Configured - enter replacement token' : 'Broker service token'}
              required={!tokenConfigured}
              disabled={disabled}
            />
          </F>
          <div className="h-[30px] flex items-center">
            <ConfiguredBadge show={tokenConfigured} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          {[
            { label: 'Status', value: summary.connected ? 'Connected' : 'Disconnected', color: summary.connected ? '#4ade80' : 'var(--muted)' },
            { label: 'Quote', value: summary.quote ? 'Connected' : 'Idle', color: summary.quote ? '#60a5fa' : 'var(--muted)' },
            { label: 'Trade', value: summary.trade ? 'Connected' : 'Idle', color: summary.trade ? '#c084fc' : 'var(--muted)' },
            { label: 'Order LP', value: summary.orderLp || form.central_lp_order_target_lp || '-', color: 'var(--text)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg p-3 flex flex-col gap-1"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-3)' }}>
              <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{label}</span>
              <span className="text-xs font-mono font-semibold truncate" style={{ color }}>{value}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button type="submit" disabled={disabled} className="ui-btn ui-btn-primary ui-btn-sm gap-1.5">
            {saving ? <><Loader2 size={12} className="animate-spin" /> Saving</> : <><Save size={12} /> Save Central LP</>}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Market Data Feed provider (manager /gateway/feed contract) ────────────────
const FEED_PROVIDER_OPTIONS = [
  { value: 'rtxmd', label: 'RTX Market Data FIX' },
  { value: 't4b', label: 'T4B' },
  { value: 'equinix', label: 'Equinix FIX 4.4' },
];

const FEED_PROVIDER_LABELS = FEED_PROVIDER_OPTIONS.reduce((acc, provider) => {
  acc[provider.value] = provider.label;
  return acc;
}, {});

const providerLabel = (provider) => {
  const normalized = normalizeFeedProvider(provider);
  return FEED_PROVIDER_LABELS[normalized] || normalized || '-';
};

const DEFAULT_FEED_FORM = {
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

const feedSymbolsToText = (symbols) => {
  if (Array.isArray(symbols)) return symbols.join(', ');
  if (typeof symbols === 'string') return symbols;
  return '';
};

const normalizeFeedForm = (data) => {
  const cserver = data?.cserver || {};
  const symbols = feedSymbolsToText(cserver.symbols);
  return {
    feed_provider: normalizeFeedProvider(data?.feed_provider) || DEFAULT_FEED_FORM.feed_provider,
    enabled: Boolean(data?.enabled),
    host: cserver.host || '',
    port: (cserver.port ?? '') === 0 ? '' : String(cserver.port ?? ''),
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

const getFeedStatusCounts = (status) => {
  const providers = Array.isArray(status?.providers) ? status.providers : [];
  return {
    activeSource: typeof status?.feed_active_source === 'string' ? status.feed_active_source : '',
    lpProvider: typeof status?.feed_provider === 'string' ? status.feed_provider : '',
    connected: providers.filter((provider) => provider?.connected).length,
    total: providers.length,
    streaming: providers.reduce((sum, provider) => sum + (Number(provider?.symbols_streaming) || 0), 0),
  };
};

// Payload shape (CSV-string symbols, write-only password) is pinned by
// src/lib/feedConfigPayload.test.js against the manager feed-config contract.

// formatUpdatedAt renders the feed-config updated_at (epoch SECONDS from the
// manager) as a locale string, guarding null/0/non-numeric → '' (caller hides
// the badge). Mirrors FeedTenantsView's formatWhen guard, but multiplies by
// 1000 because this field is seconds, not millis.
const formatUpdatedAt = (updatedAt) => {
  const seconds = Number(updatedAt);
  if (!seconds || Number.isNaN(seconds)) return '';
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
};

const FeedProviderConfigPanel = () => {
  const { notify } = useToast();
  const [form, setForm] = useState(DEFAULT_FEED_FORM);
  const [importText, setImportText] = useState('');
  const [passwordSet, setPasswordSet] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [lpStatus, setLpStatus] = useState(null);
  // null = probing; false = manager lacks the endpoint (404) → hide the panel.
  const [supported, setSupported] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');

  const setField = (key) => (event) => {
    const { type, checked, value } = event.target;
    setForm((current) => {
      const next = { ...current, [key]: type === 'checkbox' ? checked : value };
      if (key === 'all_symbols' && checked) next.symbols = '';
      return next;
    });
    setNotice('');
  };

  const loadConfig = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setErr('');
    try {
      const data = await gatewayGetFeedConfig();
      setForm(normalizeFeedForm(data));
      setPasswordSet(Boolean(data?.password_set));
      setUpdatedAt(data?.updated_at || null);
      setSupported(true);
      return data;
    } catch (error) {
      if (error?.status === 404) {
        // Older manager backend without the feed-config API: hide silently.
        setSupported(false);
      } else {
        setSupported(true);
        setErr(error.message || 'Failed to load feed provider config');
      }
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadLpStatus = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setStatusLoading(true);
    try {
      const data = await gatewayGetStatus();
      setLpStatus(data);
      return data;
    } catch (error) {
      if (isGatewayDisconnectedError(error)) {
        setLpStatus(DISCONNECTED_STATUS);
      } else {
        setErr(error.message || 'Failed to fetch LP gateway status');
      }
      return null;
    } finally {
      if (!silent) setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve(); // defer past the effect's synchronous phase
      if (!cancelled) {
        await loadConfig();
        await loadLpStatus({ silent: true });
      }
    })();
    return () => { cancelled = true; };
  }, [loadConfig, loadLpStatus]);

  const refreshAll = () => {
    loadConfig();
    loadLpStatus();
  };

  const handleImport = () => {
    setErr('');
    setNotice('');
    const imported = parseFeedConfigImport(importText);
    if (Object.keys(imported).length === 0) {
      setErr('No recognized RTX market-data FIX fields found in the pasted config.');
      return;
    }

    setForm((current) => ({
      ...current,
      ...imported,
      feed_provider: imported.feed_provider || 'rtxmd',
      password: imported.password ?? current.password,
    }));
    setNotice('SuperAdmin RTX Market Data FIX config imported. Review and save to apply it.');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErr('');
    setNotice('');

    if (form.port && !Number.isInteger(Number(form.port))) {
      setErr('cServer port must be a whole number.');
      return;
    }

    setSaving(true);
    try {
      const payload = buildFeedConfigPayload(form);
      await gatewaySaveFeedConfig(payload);
      if (payload.password) setPasswordSet(true);
      setForm((current) => ({ ...current, password: '' }));
      setNotice(`${providerLabel(payload.feed_provider)} config saved.`);
      await loadConfig({ silent: true });
      await loadLpStatus({ silent: true });
    } catch (error) {
      setErr(error.message || 'Failed to save feed provider config');
    } finally {
      setSaving(false);
    }
  };

  const handleApply = async () => {
    setErr('');
    setNotice('');
    setApplying(true);
    try {
      const result = await gatewayApplyFeedConfig();
      // Report the server-confirmed active provider only — never the local
      // (possibly unsaved/dirty) form value — so the success notice cannot
      // claim a provider the apply did not actually activate.
      const applied = result?.feed_provider || result?.provider;
      const appliedLabel = applied ? providerLabel(applied) : 'feed config';
      setNotice(`Feed provider applied: ${appliedLabel}`);
      notify({ title: 'Feed provider applied', description: `Active provider: ${appliedLabel}`, tone: 'success' });
      await loadLpStatus({ silent: true });
    } catch (error) {
      const message = error.message || 'Failed to apply feed provider';
      setErr(message);
      notify({ title: 'Apply failed', description: message, tone: 'danger' });
    } finally {
      setApplying(false);
    }
  };

  if (supported === false) return null;

  const disabled = loading || saving || applying;
  const statusCounts = getFeedStatusCounts(lpStatus);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-3)' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sky-500/10">
            <Rss size={16} className="text-sky-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>RTX Market Data FIX Upstream</span>
              {(loading || statusLoading) && <Loader2 size={11} className="animate-spin" style={{ color: 'var(--muted)' }} />}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <FeedProviderBadge provider={form.feed_provider} />
              {formatUpdatedAt(updatedAt) && (
                <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>updated {formatUpdatedAt(updatedAt)}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={refreshAll} disabled={disabled} title="Refresh feed config"
            className="ui-btn ui-btn-ghost ui-btn-icon ui-btn-sm">
            <RefreshCw size={13} className={loading || statusLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
        <ErrBox msg={err} />
        {notice && (
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}>
            <Activity size={12} className="shrink-0" /> {notice}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          {[
            { label: 'Saved Provider', value: providerLabel(form.feed_provider), color: '#60a5fa' },
            { label: 'LP Provider', value: statusCounts.lpProvider ? providerLabel(statusCounts.lpProvider) : '-', color: 'var(--text)' },
            { label: 'Active Source', value: statusCounts.activeSource || '-', color: statusCounts.activeSource ? '#4ade80' : 'var(--muted)' },
            {
              label: 'Streaming',
              value: statusCounts.total ? `${statusCounts.streaming} symbols / ${statusCounts.connected}/${statusCounts.total}` : '-',
              color: statusCounts.streaming > 0 ? '#4ade80' : 'var(--muted)',
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg p-3 flex flex-col gap-1"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-3)' }}>
              <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{label}</span>
              <span className="text-xs font-mono font-semibold truncate" style={{ color }}>{value}</span>
            </div>
          ))}
        </div>

        <FeedHealthPanel status={lpStatus} />

        <SectionLabel>Import SuperAdmin Config</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-end">
          <F label="Paste Config">
            <Textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder={'FEED_PROVIDER=rtxmd\nCSERVER_HOST=md.example.com\nCSERVER_PORT=5211\nCSERVER_SENDER_COMP_ID=BROKER_MD\nCSERVER_PASSWORD=...'}
              disabled={disabled}
            />
          </F>
          <div className="flex lg:flex-col gap-2">
            <button type="button" onClick={handleImport} disabled={disabled || !importText.trim()} className="ui-btn ui-btn-secondary ui-btn-sm gap-1.5">
              <ClipboardPaste size={12} /> Import Paste
            </button>
            <button type="button" onClick={() => setImportText('')} disabled={disabled || !importText} className="ui-btn ui-btn-ghost ui-btn-sm gap-1.5">
              <X size={12} /> Clear
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <F label="Provider">
            <select
              className="ui-select ui-input-sm"
              value={form.feed_provider}
              onChange={setField('feed_provider')}
              disabled={disabled}
            >
              {FEED_PROVIDER_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </F>
          <F label="Enabled">
            <ToggleField label="cServer feed enabled" checked={form.enabled} onChange={setField('enabled')} disabled={disabled} />
          </F>
          <F label="Use SSL">
            <ToggleField label="Enable SSL / TLS" checked={form.use_ssl} onChange={setField('use_ssl')} disabled={disabled} />
          </F>
          <F label="Symbols Mode">
            <ToggleField label="All symbols" checked={form.all_symbols} onChange={setField('all_symbols')} disabled={disabled} />
          </F>
        </div>

        <SectionLabel>FIX 4.4 Quote Session</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <F label="Host">
            <Input value={form.host} onChange={setField('host')} placeholder="cserver.example.com" disabled={disabled} />
          </F>
          <F label="Port">
            <Input type="number" value={form.port} onChange={setField('port')} placeholder="5211" disabled={disabled} />
          </F>
          <F label="Sender CompID">
            <Input value={form.sender_comp_id} onChange={setField('sender_comp_id')} placeholder="SenderCompID" disabled={disabled} />
          </F>
          <F label="Target CompID">
            <Input value={form.target_comp_id} onChange={setField('target_comp_id')} placeholder="cServer" disabled={disabled} />
          </F>
          <F label="Username">
            <Input value={form.username} onChange={setField('username')} placeholder="Username" disabled={disabled} />
          </F>
          <F label="Password">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  type="password"
                  value={form.password}
                  onChange={setField('password')}
                  placeholder={passwordSet ? 'Configured - enter replacement password' : 'Password'}
                  disabled={disabled}
                />
              </div>
              <ConfiguredBadge show={passwordSet} />
            </div>
          </F>
          <F label="Symbols">
            <Input
              value={form.symbols}
              onChange={setField('symbols')}
              placeholder={form.all_symbols ? 'All symbols - saved as empty symbols' : 'EURUSD, GBPUSD, XAUUSD'}
              disabled={disabled || form.all_symbols}
            />
          </F>
          <F label="Catalog File">
            <Input value={form.catalog_file} onChange={setField('catalog_file')} placeholder="Optional symbol catalog path" disabled={disabled} />
          </F>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={handleApply} disabled={disabled} className="ui-btn ui-btn-secondary ui-btn-sm gap-1.5">
            {applying ? <><Loader2 size={12} className="animate-spin" /> Applying</> : <><Zap size={12} /> Apply now</>}
          </button>
          <button type="submit" disabled={disabled} className="ui-btn ui-btn-primary ui-btn-sm gap-1.5">
            {saving ? <><Loader2 size={12} className="animate-spin" /> Saving</> : <><Save size={12} /> Save Feed Config</>}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Connect Modal ─────────────────────────────────────────────────────────────
const ConnectModal = ({ onClose, onConnected }) => {
  const [role, setRole]       = useState('quote');
  // No default credentials are shipped in source; the operator supplies them.
  const [form, setForm]       = useState({
    name:                 '',
    provider:             '',
    host:                 '',
    port:                 '',
    sender_comp_id:       '',
    target_comp_id:       '',
    username:             '',
    password:             '',
    account:              '',
    use_ssl:              false,
    trade_sender_comp_id: '',
    trade_username:       '',
    trade_password:       '',
  });
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');

  const sf = (k) => (e) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const showTrade = role === 'both' || role === 'trade';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const payload = {
        name:            form.name,
        provider:        form.provider,
        role,
        host:            form.host,
        port:            form.port,
        sender_comp_id:  form.sender_comp_id,
        target_comp_id:  form.target_comp_id,
        username:        form.username,
        password:        form.password,
        account:         form.account,
        use_ssl:         form.use_ssl,
        ...(showTrade && {
          trade_sender_comp_id: form.trade_sender_comp_id,
          trade_username:       form.trade_username,
          trade_password:       form.trade_password,
        }),
      };
      const result = await gatewayConnect(payload);
      onConnected(result);
    } catch (e) {
      setErr(e.message || 'Connection failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="ui-card w-full max-w-xl max-h-[92vh] overflow-y-auto p-6 flex flex-col gap-4"
        style={{ background: 'var(--surface)' }}>

        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <Wifi size={15} className="text-green-400" /> Connect LP Gateway
          </h2>
          <button onClick={onClose} className="ui-btn ui-btn-ghost ui-btn-icon ui-btn-sm"><X size={14} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">

          {/* ── Provider (groups dropdown) + Role ── */}
          <SectionLabel>Identity</SectionLabel>
          <div className="grid grid-cols-3 gap-3">
            <F label="Name" required>
              <Input value={form.name} onChange={sf('name')} placeholder="e.g. T4B" required />
            </F>
            <F label="Provider">
              <Input value={form.provider} onChange={sf('provider')} placeholder="e.g. Tools for Brokers" />
            </F>
            <F label="Role">
              <RoleSelector value={role} onChange={setRole} />
            </F>
          </div>

          {/* ── Connection ── */}
          <SectionLabel>Connection</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <F label="Host" required>
              <Input value={form.host} onChange={sf('host')} placeholder="fix.gateway.example.com" required />
            </F>
            <F label="Port" required>
              <Input value={form.port} onChange={sf('port')} placeholder="Port" required />
            </F>
            <F label="Sender CompID" required>
              <Input value={form.sender_comp_id} onChange={sf('sender_comp_id')} placeholder="SenderCompID" required />
            </F>
            <F label="Target CompID" required>
              <Input value={form.target_comp_id} onChange={sf('target_comp_id')} placeholder="TargetCompID" required />
            </F>
            <F label="Username" required>
              <Input value={form.username} onChange={sf('username')} placeholder="Username" required />
            </F>
            <F label="Password" required>
              <Input type="password" value={form.password} onChange={sf('password')} placeholder="Password" required />
            </F>
            <F label="Account">
              <Input value={form.account} onChange={sf('account')} placeholder="Account number" />
            </F>
            <F label="Use SSL">
              <label className="flex items-center gap-2 h-[30px] cursor-pointer">
                <input type="checkbox" checked={form.use_ssl} onChange={sf('use_ssl')}
                  className="w-4 h-4 accent-blue-500 rounded" />
                <span className="text-xs" style={{ color: 'var(--text-2)' }}>Enable SSL / TLS</span>
              </label>
            </F>
          </div>

          {/* ── Trade session (role = both | trade) ── */}
          {showTrade && (
            <>
              <SectionLabel color="#c084fc">Trade Session</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <F label="Trade Sender CompID" required>
                  <Input value={form.trade_sender_comp_id} onChange={sf('trade_sender_comp_id')}
                    placeholder="Trade SenderCompID" required={showTrade} />
                </F>
                <F label="Trade Username" required>
                  <Input value={form.trade_username} onChange={sf('trade_username')}
                    placeholder="Trade username" required={showTrade} />
                </F>
                <div className="col-span-2">
                  <F label="Trade Password" required>
                    <Input type="password" value={form.trade_password} onChange={sf('trade_password')}
                      placeholder="Trade password" required={showTrade} />
                  </F>
                </div>
              </div>
            </>
          )}

          <ErrBox msg={err} />

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="ui-btn ui-btn-secondary ui-btn-sm">Cancel</button>
            <button type="submit" disabled={saving} className="ui-btn ui-btn-primary ui-btn-sm gap-1.5">
              {saving ? <><Loader2 size={12} className="animate-spin" /> Connecting…</> : <><Wifi size={12} /> Connect</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Disconnect Modal ──────────────────────────────────────────────────────────
const DisconnectModal = ({ onClose, onDisconnected }) => {
  const [role, setRole]         = useState('both');
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const result = await gatewayDisconnect(role);
      onDisconnected(result);
    } catch (e) {
      setErr(e.message || 'Disconnect failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="ui-card w-full max-w-sm p-6 flex flex-col gap-4" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <WifiOff size={15} className="text-red-400" /> Disconnect LP Gateway
          </h2>
          <button onClick={onClose} className="ui-btn ui-btn-ghost ui-btn-icon ui-btn-sm"><X size={14} /></button>
        </div>

        <p className="text-xs" style={{ color: 'var(--text-3)' }}>
          Select which session(s) to disconnect. This will terminate the active FIX connection.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <F label='Role — {"role":"both"}'>
            <RoleSelector value={role} onChange={setRole} />
          </F>

          {/* Live preview of the payload */}
          <div className="rounded-lg p-3 font-mono text-[11px]"
            style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border-3)' }}>
            <span style={{ color: 'var(--text-3)' }}>POST</span>{' '}
            <span style={{ color: '#60a5fa' }}>/api/v1/manager/gateway/lp/disconnect</span>
            <br />
            {`{ "role": "${role}" }`}
          </div>

          <ErrBox msg={err} />

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="ui-btn ui-btn-secondary ui-btn-sm">Cancel</button>
            <button type="submit" disabled={saving}
              className="ui-btn ui-btn-sm gap-1.5"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              {saving ? <><Loader2 size={12} className="animate-spin" /> Disconnecting…</> : <><WifiOff size={12} /> Disconnect</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Status row helper ─────────────────────────────────────────────────────────
const StatusDot = ({ on }) => (
  <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${on ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
);

const KV = ({ label, value, mono }) => (
  <div className="flex items-start justify-between gap-4 py-1 border-b" style={{ borderColor: 'var(--border-3)' }}>
    <span className="text-[11px] shrink-0" style={{ color: 'var(--text-3)' }}>{label}</span>
    <span className={`text-[11px] text-right break-all ${mono ? 'font-mono' : 'font-medium'}`} style={{ color: 'var(--text)' }}>
      {value ?? '—'}
    </span>
  </div>
);

const SessionBlock = ({ title, data, color, hideDetails }) => {
  if (!data || !data.configured) return null;
  const config = data.config || {};
  return (
    <div className="flex flex-col gap-0 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
      <div className="px-3 py-2 text-[10px] uppercase tracking-widest font-bold flex justify-between" style={{ background: 'var(--surface-2)', color }}>
        <span>{title}</span>
        <span>{data.name}</span>
      </div>
      <div className="px-3 py-2 flex flex-col" style={{ background: 'var(--surface)' }}>
        <KV label="Connected"    value={data.connected ? '✓ Yes' : '✗ No'} />
        {config.adapter_name && <KV label="Adapter"     value={config.adapter_name}    mono />}
        {(!hideDetails && config.host) && <KV label="Host : Port" value={`${config.host} : ${config.port}`} mono />}
        {(!hideDetails) && <KV label="Password Set" value={config.password_set ? '✓ Yes' : '✗ No'} />}
        {config.symbols    && <KV label="Symbols"     value={config.symbols.join(', ')} mono />}
      </div>
    </div>
  );
};

// ─── Per-feed health (additive lp/status fields; hidden on older bridges) ──────
const formatTickAge = (age) => {
  if (typeof age !== 'number' || !Number.isFinite(age) || age < 0) return '—';
  return age < 10 ? `${age.toFixed(1)}s` : `${Math.round(age)}s`;
};

const formatSymbolCount = (count) =>
  (typeof count === 'number' && Number.isFinite(count)) ? String(count) : '—';

const FeedProviderBadge = ({ provider }) => provider ? (
  <span
    className="inline-flex items-center h-5 px-2 rounded text-[10px] font-semibold uppercase tracking-wide"
    style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}
  >
    {providerLabel(provider)}
  </span>
) : null;

const FeedProviderRow = ({ provider }) => {
  const connected = Boolean(provider?.connected);
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-3)' }}>
      <span className="flex items-center gap-2 min-w-0">
        <StatusDot on={connected} />
        <span className="text-[11px] font-mono font-semibold uppercase truncate" style={{ color: 'var(--text)' }}>
          {providerLabel(provider?.id)}
        </span>
        <span className="text-[10px]" style={{ color: connected ? '#4ade80' : 'var(--muted)' }}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </span>
      <span className="flex items-center gap-4 shrink-0 text-[11px] font-mono" style={{ color: 'var(--text-2)' }}>
        <span title="Last tick age">tick {formatTickAge(provider?.last_tick_age_sec)}</span>
        <span title="Symbols streaming">{formatSymbolCount(provider?.symbols_streaming)} symbols</span>
      </span>
    </div>
  );
};

// Renders the additive per-feed health fields from GET …/gateway/lp/status.
// Older bridges do not send these fields — in that case render nothing.
const FeedHealthPanel = ({ status }) => {
  const feedProvider = typeof status?.feed_provider === 'string' ? status.feed_provider : '';
  const activeSource = typeof status?.feed_active_source === 'string' ? status.feed_active_source : '';
  const providers = Array.isArray(status?.providers) ? status.providers : [];

  if (!feedProvider && !activeSource && providers.length === 0) return null;

  return (
    <div className="flex flex-col rounded-lg overflow-hidden border mt-2" style={{ borderColor: 'var(--border)' }}>
      <div className="px-3 py-2 text-[10px] uppercase tracking-widest font-bold flex items-center justify-between"
        style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
        <span className="flex items-center gap-1.5"><Activity size={11} /> Feed Health</span>
        <FeedProviderBadge provider={feedProvider} />
      </div>
      <div className="px-3 py-2 flex flex-col gap-2" style={{ background: 'var(--surface)' }}>
        <div className="flex flex-col">
          {feedProvider && <KV label="Configured Provider" value={providerLabel(feedProvider)} mono />}
          {activeSource && <KV label="Active Source" value={activeSource} mono />}
        </div>
        {providers.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {providers.map((provider, index) => (
              <FeedProviderRow key={provider?.id || index} provider={provider} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── LP Gateway Panel ──────────────────────────────────────────────────────────
const LpGatewayPanel = () => {
  const [status, setStatus]           = useState(null);
  const [loading, setLoading]         = useState(true);
  const [modal, setModal]             = useState(null); // 'connect' | 'disconnect'
  const [expanded, setExpanded]       = useState(true);
  const [err, setErr]                 = useState('');

  const fetchStatus = useCallback(() => {
    setLoading(true);
    setErr('');
    gatewayGetStatus()
      .then(setStatus)
      .catch(e => {
        // The manager backend returns this when the LP gateway sidecar is down.
        if (isGatewayDisconnectedError(e)) {
          setStatus(DISCONNECTED_STATUS);
        } else {
          setErr(e.message || 'Failed to fetch gateway status');
          setStatus(DISCONNECTED_STATUS);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (!cancelled) fetchStatus();
    })();
    return () => { cancelled = true; };
  }, [fetchStatus]);

  const isConnected = status?.quote?.connected || status?.trade?.connected;

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ borderColor: isConnected ? 'rgba(74,222,128,0.3)' : 'var(--border)', background: 'var(--surface)' }}>

      {/* ── Panel header ── */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => setExpanded(e => !e)}>
          <div className={`p-2 rounded-lg ${isConnected ? 'bg-green-500/10' : 'bg-gray-500/10'}`}>
            {isConnected
              ? <Wifi size={16} className="text-green-400" />
              : <WifiOff size={16} style={{ color: 'var(--muted)' }} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>LP Gateway</span>
              {status?.quote?.config?.provider && <span className="text-sm font-normal" style={{ color: 'var(--text-3)' }}>— {status.quote.config.provider}</span>}
              {loading && <Loader2 size={11} className="animate-spin" style={{ color: 'var(--muted)' }} />}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusDot on={isConnected} />
              <span className="text-xs capitalize" style={{ color: isConnected ? '#4ade80' : 'var(--muted)' }}>
                {isConnected ? 'Connected' : (status ? 'Disconnected' : 'loading…')}
              </span>
              {status?.quote?.config?.role && <span className="text-xs" style={{ color: 'var(--text-3)' }}>· role: {status.quote.config.role}</span>}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={fetchStatus} title="Refresh status"
            className="ui-btn ui-btn-ghost ui-btn-icon ui-btn-sm">
            <RefreshCw size={13} />
          </button>
          <button onClick={() => setModal('connect')} className="ui-btn ui-btn-primary ui-btn-sm gap-1.5">
            <Plus size={12} /> Connect LP
          </button>
          {isConnected && (
            <button onClick={() => setModal('disconnect')}
              className="ui-btn ui-btn-sm gap-1.5"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              <WifiOff size={12} /> Disconnect
            </button>
          )}
          <button onClick={() => setExpanded(e => !e)} className="ui-btn ui-btn-ghost ui-btn-icon ui-btn-sm">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* ── Expanded status detail ── */}
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t" style={{ borderColor: 'var(--border-3)' }}>
          <ErrBox msg={err} />

          {/* Per-feed health (additive fields; hides itself on older bridges) */}
          <FeedHealthPanel status={status} />

          {loading && !status && (
            <div className="flex items-center gap-2 py-6 text-sm justify-center" style={{ color: 'var(--muted)' }}>
              <Loader2 size={14} className="animate-spin" /> Fetching gateway status…
            </div>
          )}

          {status && !isConnected && (
            <div className="flex flex-col items-center gap-3 py-8">
              <WifiOff size={28} style={{ color: 'var(--muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>No active LP gateway session</p>
              <button onClick={() => setModal('connect')} className="ui-btn ui-btn-primary ui-btn-sm gap-1.5">
                <Plus size={12} /> Connect LP Gateway
              </button>
            </div>
          )}

          {status && isConnected && (
            <>
              {/* Summary row */}
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[
                  { label: 'Status',            value: isConnected ? 'Connected' : 'Disconnected', color: isConnected ? '#4ade80' : 'var(--muted)' },
                  { label: 'Live Data Source',  value: status.quote?.name || '—', color: '#60a5fa' },
                  { label: 'Order Routing LP',  value: status.order_routing_lp || status.trade?.name || '—', color: '#c084fc' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg p-3 flex flex-col gap-1"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-3)' }}>
                    <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>{label}</span>
                    <span className="text-xs font-mono font-semibold" style={{ color }}>{value ?? '—'}</span>
                  </div>
                ))}
              </div>

              {/* Session blocks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SessionBlock title="Quote Session" data={status.quote} color="#60a5fa" />
                <SessionBlock title="Trade Session" data={status.trade} color="#c084fc" />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {modal === 'connect' && (
        <ConnectModal
          onClose={() => setModal(null)}
          onConnected={(result) => { setStatus(result); setModal(null); }}
        />
      )}
      {modal === 'disconnect' && (
        <DisconnectModal
          onClose={() => setModal(null)}
          onDisconnected={(result) => { setStatus(result); setModal(null); }}
        />
      )}
    </div>
  );
};

// Removed LpRoutingOptionsPanel from here, it will be moved to LPRoutingView

// ─── Main View ─────────────────────────────────────────────────────────────────
const GatewaysView = () => {
  return (
    <div className="flex-1 min-h-0 bg-[color:var(--bg-app)] overflow-y-auto text-[color:var(--text-primary)]">
      <div className="flex justify-between items-start px-5 py-4 border-b border-black/40 shrink-0 bg-[color:var(--bg-surface-1)]">
        <div>
          <h1 className="text-[17px] font-semibold text-white mb-1">Gateways</h1>
          <p className="text-[12px] text-[color:var(--text-muted)]">
            Configure RTX market-data FIX, Central LP order routing, and live LP Gateway sessions.
          </p>
        </div>
      </div>

      <div className="p-5 pb-12 flex flex-col gap-6">
        <FeedProviderConfigPanel />
        <CentralLpConfigPanel />
        <LpGatewayPanel />
      </div>
    </div>
  );
};

export default GatewaysView;
