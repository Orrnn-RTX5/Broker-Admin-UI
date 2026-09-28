import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, RefreshCw, Loader2, AlertCircle, AlertTriangle, Copy, KeyRound,
  Pause, Play, Eye, Rss, Users,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Table, THead, TR, TH, TD } from '../ui/Table';
import { useToast } from '../ui/useToast';
import {
  feedTenantsList,
  feedTenantCreate,
  feedTenantSuspend,
  feedTenantActivate,
  feedTenantUpdateCredentials,
  feedSessions,
  feedUsage,
  feedReloadTenants,
} from '../../services/feedTenants.service';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const parseList = (text) =>
  String(text || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const formatWhen = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const copyToClipboard = async (text) => {
  const value = String(text ?? '');
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  // Fallback for non-secure contexts.
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
};

// ─── Shared field components (GatewaysView conventions) ────────────────────────
const F = ({ label, required, hint, children }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    {children}
    {hint && <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{hint}</span>}
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

const ErrBox = ({ msg }) => msg ? (
  <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
    style={{
      background: 'color-mix(in srgb, var(--danger-500) 10%, transparent)',
      color: 'var(--danger-500)',
      border: '1px solid color-mix(in srgb, var(--danger-500) 25%, transparent)',
    }}>
    <AlertCircle size={12} className="shrink-0" /> {msg}
  </div>
) : null;

const StatusBadge = ({ status }) => (
  <Badge tone={status === 'active' ? 'success' : status === 'suspended' ? 'danger' : 'neutral'}>
    {status || 'unknown'}
  </Badge>
);

// ─── Copyable credential row ───────────────────────────────────────────────────
const CopyButton = ({ value, onCopied, onCopyFailed }) => (
  <button
    type="button"
    title="Copy to clipboard"
    onClick={async () => {
      try {
        await copyToClipboard(value);
        onCopied?.();
      } catch {
        onCopyFailed?.();
      }
    }}
    className="ui-btn ui-btn-ghost ui-btn-icon ui-btn-sm shrink-0"
  >
    <Copy size={12} />
  </button>
);

const CredRow = ({ label, value, onCopied, onCopyFailed }) => (
  <div className="flex items-center justify-between gap-3 py-1 border-b" style={{ borderColor: 'var(--border-3)' }}>
    <span className="text-[11px] shrink-0" style={{ color: 'var(--text-3)' }}>{label}</span>
    <span className="flex items-center gap-1 min-w-0">
      <span className="text-[11px] font-mono break-all text-right" style={{ color: 'var(--text)' }}>
        {value === '' || value == null ? '—' : String(value)}
      </span>
      <CopyButton value={value} onCopied={onCopied} onCopyFailed={onCopyFailed} />
    </span>
  </div>
);

// ─── Show-once credentials modal ───────────────────────────────────────────────
// `payload` lives ONLY in the parent's modal state and is discarded on close —
// the password is never persisted client-side.
const ShowOnceCredentialsModal = ({ payload, onClose }) => {
  const { notify } = useToast();
  if (!payload) return null;

  const onCopied = () => notify({ title: 'Copied to clipboard', tone: 'success' });
  const onCopyFailed = () => notify({ title: 'Copy failed', tone: 'danger' });

  const response = payload.response || {};
  const details = response.connection_details || response.connection || {};
  const tenant = response.tenant || {};

  const copyAll = async () => {
    try {
      await copyToClipboard(JSON.stringify({
        credentials: { username: payload.username, password: payload.password },
        company_code: payload.companyCode,
        connection_details: details,
        message: response.message,
      }, null, 2));
      onCopied();
    } catch {
      onCopyFailed();
    }
  };

  return (
    <Modal
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={payload.kind === 'rotated' ? 'New Tenant Credentials' : 'Tenant Created — Credentials'}
      size="lg"
      footer={(
        <>
          <button type="button" onClick={copyAll} className="ui-btn ui-btn-secondary ui-btn-sm gap-1.5">
            <Copy size={12} /> Copy All
          </button>
          <button type="button" onClick={onClose} className="ui-btn ui-btn-primary ui-btn-sm">
            I saved the credentials
          </button>
        </>
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 text-xs px-3 py-2 rounded-lg"
          style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>
            Copy these credentials now — <strong>they will never be shown again</strong>.
            The password is not stored or returned in cleartext by the server.
          </span>
        </div>

        {response.message && (
          <p className="text-[11px]" style={{ color: 'var(--text-2)' }}>{response.message}</p>
        )}

        <div className="flex flex-col">
          <CredRow label="Company Code" value={payload.companyCode || tenant.company_code} onCopied={onCopied} onCopyFailed={onCopyFailed} />
          {(details.sender_comp_id || tenant.sender_comp_id) != null && (
            <CredRow label="Sender CompID" value={details.sender_comp_id || tenant.sender_comp_id} onCopied={onCopied} onCopyFailed={onCopyFailed} />
          )}
          <CredRow label="Username (tag 553)" value={payload.username} onCopied={onCopied} onCopyFailed={onCopyFailed} />
          <CredRow label="Password (tag 554)" value={payload.password} onCopied={onCopied} onCopyFailed={onCopyFailed} />
          {details.host != null && <CredRow label="Host" value={details.host} onCopied={onCopied} onCopyFailed={onCopyFailed} />}
          {details.port != null && <CredRow label="Port" value={details.port} onCopied={onCopied} onCopyFailed={onCopyFailed} />}
          {details.target_comp_id != null && <CredRow label="Target CompID" value={details.target_comp_id} onCopied={onCopied} onCopyFailed={onCopyFailed} />}
          {details.protocol != null && <CredRow label="Protocol" value={details.protocol} onCopied={onCopied} onCopyFailed={onCopyFailed} />}
          {details.heartbeat != null && <CredRow label="Heartbeat" value={details.heartbeat} onCopied={onCopied} onCopyFailed={onCopyFailed} />}
        </div>

        {details.logon_message && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--text-3)' }}>
                Logon Message Template
              </span>
              <CopyButton value={details.logon_message} onCopied={onCopied} onCopyFailed={onCopyFailed} />
            </div>
            <div className="rounded-lg p-3 font-mono text-[10px] break-all"
              style={{ background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border-3)' }}>
              {details.logon_message}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

// ─── Create tenant modal ───────────────────────────────────────────────────────
const EMPTY_CREATE_FORM = {
  company_name: '',
  company_code: '',
  sender_comp_id: '',
  username: '',
  password: '',
  allowed_symbols: '',
  blocked_symbols: '',
  max_symbols: '50',
  max_msg_per_sec: '100',
  ip_whitelist: '',
};

const CreateTenantModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState(EMPTY_CREATE_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const setField = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErr('');

    if (form.max_symbols && !Number.isInteger(Number(form.max_symbols))) {
      setErr('Max symbols must be a whole number.');
      return;
    }
    if (form.max_msg_per_sec && !Number.isInteger(Number(form.max_msg_per_sec))) {
      setErr('Rate limit must be a whole number.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        company_name: form.company_name.trim(),
        company_code: form.company_code.trim(),
        username: form.username.trim(),
        password: form.password,
        allowed_symbols: parseList(form.allowed_symbols),
        blocked_symbols: parseList(form.blocked_symbols),
        max_symbols: Number(form.max_symbols) || 0,
        max_msg_per_sec: Number(form.max_msg_per_sec) || 0,
        ip_whitelist: parseList(form.ip_whitelist),
      };
      const senderCompId = form.sender_comp_id.trim();
      if (senderCompId) payload.sender_comp_id = senderCompId;

      const response = await feedTenantCreate(payload);
      // Hand the one-time payload to the parent's modal state, then drop the
      // form (and the password with it).
      onCreated({
        kind: 'created',
        response,
        username: payload.username,
        password: payload.password,
        companyCode: payload.company_code,
      });
    } catch (error) {
      setErr(error.message || 'Failed to create tenant');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Add Feed Tenant"
      description="Provision a FIX 4.4 market-data tenant. Credentials are shown exactly once after creation."
      size="xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <ErrBox msg={err} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <F label="Company Name" required>
            <Input value={form.company_name} onChange={setField('company_name')} placeholder="Acme Brokers Ltd" required disabled={saving} />
          </F>
          <F label="Company Code" required hint="Short unique code, e.g. ACME">
            <Input value={form.company_code} onChange={setField('company_code')} placeholder="ACME" required disabled={saving} />
          </F>
          <F label="Sender CompID" hint="Optional — defaults to the company code">
            <Input value={form.sender_comp_id} onChange={setField('sender_comp_id')} placeholder="ACME" disabled={saving} />
          </F>
          <F label="Username (tag 553)" required>
            <Input value={form.username} onChange={setField('username')} placeholder="acme_feed" required disabled={saving} />
          </F>
          <F label="Password (tag 554)" required hint="Write-only — shown once after creation, never again">
            <Input type="password" value={form.password} onChange={setField('password')} placeholder="Password" required disabled={saving} />
          </F>
          <F label="Max Symbols">
            <Input type="number" value={form.max_symbols} onChange={setField('max_symbols')} placeholder="50" disabled={saving} />
          </F>
          <F label="Rate Limit (msg/sec)">
            <Input type="number" value={form.max_msg_per_sec} onChange={setField('max_msg_per_sec')} placeholder="100" disabled={saving} />
          </F>
          <F label="IP Whitelist" hint="Comma-separated; empty = no IP restriction">
            <Input value={form.ip_whitelist} onChange={setField('ip_whitelist')} placeholder="203.0.113.10, 198.51.100.0/24" disabled={saving} />
          </F>
          <F label="Allowed Symbols" hint="Comma-separated; empty = all entitled symbols">
            <Input value={form.allowed_symbols} onChange={setField('allowed_symbols')} placeholder="EURUSD, GBPUSD, XAUUSD" disabled={saving} />
          </F>
          <F label="Blocked Symbols" hint="Comma-separated">
            <Input value={form.blocked_symbols} onChange={setField('blocked_symbols')} placeholder="BTCUSD" disabled={saving} />
          </F>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="ui-btn ui-btn-secondary ui-btn-sm" disabled={saving}>Cancel</button>
          <button type="submit" disabled={saving} className="ui-btn ui-btn-primary ui-btn-sm gap-1.5">
            {saving ? <><Loader2 size={12} className="animate-spin" /> Creating…</> : <><Plus size={12} /> Create Tenant</>}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ─── Rotate credentials modal ──────────────────────────────────────────────────
const RotateCredentialsModal = ({ tenant, onClose, onRotated }) => {
  const [form, setForm] = useState({ username: tenant?.username || '', password: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const setField = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErr('');
    setSaving(true);
    try {
      const response = await feedTenantUpdateCredentials({
        company_code: tenant.company_code,
        username: form.username.trim(),
        password: form.password,
      });
      onRotated({
        kind: 'rotated',
        response,
        username: form.username.trim(),
        password: form.password,
        companyCode: tenant.company_code,
      });
    } catch (error) {
      setErr(error.message || 'Failed to update credentials');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={`Rotate Credentials — ${tenant?.company_name || tenant?.company_code || ''}`}
      description="The tenant must reconnect with the new credentials. The new password is shown once, then never again."
      size="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <ErrBox msg={err} />
        <F label="Username (tag 553)" required>
          <Input value={form.username} onChange={setField('username')} placeholder="Username" required disabled={saving} />
        </F>
        <F label="New Password (tag 554)" required hint="Write-only — shown once after rotation">
          <Input type="password" value={form.password} onChange={setField('password')} placeholder="New password" required disabled={saving} />
        </F>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="ui-btn ui-btn-secondary ui-btn-sm" disabled={saving}>Cancel</button>
          <button type="submit" disabled={saving} className="ui-btn ui-btn-primary ui-btn-sm gap-1.5">
            {saving ? <><Loader2 size={12} className="animate-spin" /> Rotating…</> : <><KeyRound size={12} /> Rotate Credentials</>}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ─── Per-tenant sessions & usage modal ─────────────────────────────────────────
const TenantDetailsModal = ({ tenant, onClose }) => {
  const [sessions, setSessions] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [unsupported, setUnsupported] = useState(false);

  const companyCode = tenant?.company_code;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const [sessionsRes, usageRes] = await Promise.all([
          feedSessions(),
          feedUsage({ company_code: companyCode, days: 30 }),
        ]);
        if (cancelled) return;
        const all = Array.isArray(sessionsRes?.sessions) ? sessionsRes.sessions : [];
        setSessions(all.filter((s) => s?.company_code === companyCode));
        setUsage(Array.isArray(usageRes?.usage) ? usageRes.usage : []);
      } catch (error) {
        if (cancelled) return;
        if (error?.status === 404) {
          setUnsupported(true);
        } else {
          setErr(error.message || 'Failed to load sessions / usage');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyCode]);

  return (
    <Modal
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={`Sessions & Usage — ${tenant?.company_name || companyCode || ''}`}
      size="xl"
    >
      <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
        <ErrBox msg={err} />

        {loading && (
          <div className="flex items-center gap-2 py-6 text-sm justify-center" style={{ color: 'var(--muted)' }}>
            <Loader2 size={14} className="animate-spin" /> Loading sessions and usage…
          </div>
        )}

        {!loading && unsupported && (
          <p className="text-xs py-4 text-center" style={{ color: 'var(--text-3)' }}>
            Sessions / usage are not exposed by this manager backend.
          </p>
        )}

        {!loading && !unsupported && (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--text-3)' }}>
                Live Sessions
              </span>
              {(sessions || []).length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>No live sessions for this tenant.</p>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Connected</TH>
                      <TH>Since</TH>
                      <TH>Last Market Data</TH>
                      <TH align="right">Messages</TH>
                      <TH align="right">Peak msg/s</TH>
                      <TH>Subscriptions</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {sessions.map((session, index) => (
                      <TR key={index}>
                        <TD>{session.connected ? 'Yes' : 'No'}</TD>
                        <TD>{formatWhen(session.connected_since)}</TD>
                        <TD>{formatWhen(session.last_market_data)}</TD>
                        <TD align="right">{session.messages_relayed ?? '—'}</TD>
                        <TD align="right">{session.peak_msg_sec ?? '—'}</TD>
                        <TD className="whitespace-normal break-all">
                          {Array.isArray(session.subscriptions) && session.subscriptions.length > 0
                            ? session.subscriptions.join(', ')
                            : '—'}
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--text-3)' }}>
                Usage (last 30 days)
              </span>
              {(usage || []).length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>No usage recorded for this tenant.</p>
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Date</TH>
                      <TH align="right">Messages</TH>
                      <TH align="right">Snapshots</TH>
                      <TH align="right">Incrementals</TH>
                      <TH align="right">Symbols</TH>
                      <TH align="right">Peak msg/s</TH>
                      <TH align="right">Uptime (s)</TH>
                      <TH align="right">Errors</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {usage.map((row, index) => (
                      <TR key={`${row.date}-${index}`}>
                        <TD>{row.date}</TD>
                        <TD align="right">{row.messages_relayed ?? '—'}</TD>
                        <TD align="right">{row.snapshots_sent ?? '—'}</TD>
                        <TD align="right">{row.incrementals_sent ?? '—'}</TD>
                        <TD align="right">{row.symbols_subscribed ?? '—'}</TD>
                        <TD align="right">{row.peak_msg_per_sec ?? '—'}</TD>
                        <TD align="right">{row.uptime_seconds ?? '—'}</TD>
                        <TD align="right">{row.errors ?? '—'}</TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

// ─── Main view ─────────────────────────────────────────────────────────────────
const FeedTenantsView = () => {
  const { notify } = useToast();
  const [tenants, setTenants] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [err, setErr] = useState('');
  // null = probing; false = manager lacks the feed-tenant proxy (404).
  const [supported, setSupported] = useState(null);
  const [busyCode, setBusyCode] = useState(null);
  // modal: {type:'create'} | {type:'rotate',tenant} | {type:'details',tenant}
  const [modal, setModal] = useState(null);
  // One-time credential payload. Lives ONLY here while the show-once modal is
  // open; cleared (discarded) the moment it closes.
  const [showOnce, setShowOnce] = useState(null);

  const loadAll = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setErr('');
    try {
      const tenantsRes = await feedTenantsList();
      setTenants(Array.isArray(tenantsRes?.tenants) ? tenantsRes.tenants : []);
      setSupported(true);
      try {
        const sessionsRes = await feedSessions();
        setSessions(Array.isArray(sessionsRes?.sessions) ? sessionsRes.sessions : []);
      } catch {
        // Sessions are best-effort (feed server may be down); columns degrade to '—'.
        setSessions([]);
      }
    } catch (error) {
      if (error?.status === 404) {
        setSupported(false);
      } else {
        setSupported(true);
        setErr(error.message || 'Failed to load feed tenants');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve(); // defer past the effect's synchronous phase
      if (!cancelled) await loadAll();
    })();
    return () => { cancelled = true; };
  }, [loadAll]);

  const sessionsByCode = useMemo(() => {
    const map = {};
    for (const session of sessions) {
      const code = session?.company_code;
      if (!code) continue;
      const entry = map[code] || { connections: 0, last: null };
      if (session.connected) entry.connections += 1;
      const seen = session.last_market_data || session.connected_since;
      if (seen) {
        const ts = new Date(seen).getTime();
        if (Number.isFinite(ts) && (!entry.last || ts > entry.last)) entry.last = ts;
      }
      map[code] = entry;
    }
    return map;
  }, [sessions]);

  const handleSuspendToggle = async (tenant) => {
    const suspending = tenant.status === 'active';
    setBusyCode(tenant.company_code);
    try {
      const response = suspending
        ? await feedTenantSuspend(tenant.company_code)
        : await feedTenantActivate(tenant.company_code);
      notify({
        title: suspending ? 'Tenant suspended' : 'Tenant activated',
        description: response?.message,
        tone: suspending ? 'warning' : 'success',
      });
      await loadAll({ silent: true });
    } catch (error) {
      notify({ title: suspending ? 'Suspend failed' : 'Activate failed', description: error.message, tone: 'danger' });
    } finally {
      setBusyCode(null);
    }
  };

  const handleReload = async () => {
    setReloading(true);
    try {
      const response = await feedReloadTenants();
      notify({ title: 'Tenants reloaded on bridge', description: response?.message, tone: 'success' });
    } catch (error) {
      notify({ title: 'Reload failed', description: error.message, tone: 'danger' });
    } finally {
      setReloading(false);
    }
  };

  const closeShowOnce = () => setShowOnce(null);

  if (supported === false) {
    return (
      <div className="flex-1 min-h-0 bg-[color:var(--bg-app)] overflow-y-auto text-[color:var(--text-primary)]">
        <div className="flex flex-col items-center gap-3 py-16">
          <Rss size={28} style={{ color: 'var(--muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Feed tenant management is not supported by this manager backend.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 bg-[color:var(--bg-app)] overflow-y-auto text-[color:var(--text-primary)]">
      <div className="flex justify-between items-start px-5 py-4 border-b border-black/40 shrink-0 bg-[color:var(--bg-surface-1)]">
        <div>
          <h1 className="text-[17px] font-semibold text-white mb-1 flex items-center gap-2">
            <Users size={16} className="text-white" /> Feed Tenants
          </h1>
          <p className="text-[12px] text-[color:var(--text-muted)]">
            Multi-tenant FIX 4.4 market-data subscribers. Credentials are write-only and shown exactly once.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => loadAll()} disabled={loading} title="Refresh"
            className="ui-btn ui-btn-ghost ui-btn-icon ui-btn-sm">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleReload} disabled={reloading} title="Reload tenants from DB on the bridge feed server"
            className="ui-btn ui-btn-secondary ui-btn-sm gap-1.5">
            {reloading ? <Loader2 size={12} className="animate-spin" /> : <Rss size={12} />} Reload on Bridge
          </button>
          <button onClick={() => setModal({ type: 'create' })} className="ui-btn ui-btn-primary ui-btn-sm gap-1.5">
            <Plus size={12} /> Add Tenant
          </button>
        </div>
      </div>

      <div className="p-5 pb-12 flex flex-col gap-4">
        <ErrBox msg={err} />

        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm justify-center" style={{ color: 'var(--muted)' }}>
            <Loader2 size={14} className="animate-spin" /> Loading feed tenants…
          </div>
        ) : err ? null : tenants.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <Users size={28} style={{ color: 'var(--muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>No feed tenants yet</p>
            <button onClick={() => setModal({ type: 'create' })} className="ui-btn ui-btn-primary ui-btn-sm gap-1.5">
              <Plus size={12} /> Add Tenant
            </button>
          </div>
        ) : (
          <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <Table>
              <THead>
                <TR>
                  <TH>ID</TH>
                  <TH>Company</TH>
                  <TH>Sender CompID</TH>
                  <TH>Status</TH>
                  <TH align="right">Connections</TH>
                  <TH>Last Session</TH>
                  <TH>Plan</TH>
                  <TH align="right">Max Symbols</TH>
                  <TH align="right">Rate Limit</TH>
                  <TH align="right">Actions</TH>
                </TR>
              </THead>
              <tbody>
                {tenants.map((tenant) => {
                  const live = sessionsByCode[tenant.company_code] || {};
                  const busy = busyCode === tenant.company_code;
                  return (
                    <TR key={tenant.id ?? tenant.company_code}>
                      <TD>{tenant.id}</TD>
                      <TD>
                        <span className="text-[color:var(--text-primary)]">{tenant.company_name}</span>
                        <span className="ml-1.5 text-[10px] text-[color:var(--text-muted)]">({tenant.company_code})</span>
                      </TD>
                      <TD>{tenant.sender_comp_id || '—'}</TD>
                      <TD><StatusBadge status={tenant.status} /></TD>
                      <TD align="right">{live.connections ?? 0}</TD>
                      <TD>{live.last ? formatWhen(live.last) : '—'}</TD>
                      <TD>{tenant.plan_type || '—'}</TD>
                      <TD align="right">{tenant.max_symbols ?? '—'}</TD>
                      <TD align="right">{tenant.max_msg_per_sec ?? '—'}</TD>
                      <TD align="right">
                        <span className="inline-flex items-center gap-1">
                          <button
                            title="Sessions & usage"
                            onClick={() => setModal({ type: 'details', tenant })}
                            className="ui-btn ui-btn-ghost ui-btn-icon ui-btn-sm"
                          >
                            <Eye size={12} />
                          </button>
                          <button
                            title="Rotate credentials"
                            onClick={() => setModal({ type: 'rotate', tenant })}
                            className="ui-btn ui-btn-ghost ui-btn-icon ui-btn-sm"
                          >
                            <KeyRound size={12} />
                          </button>
                          <button
                            title={tenant.status === 'active' ? 'Suspend tenant (disconnects live sessions)' : 'Activate tenant'}
                            onClick={() => handleSuspendToggle(tenant)}
                            disabled={busy}
                            className="ui-btn ui-btn-ghost ui-btn-icon ui-btn-sm"
                            style={{ color: tenant.status === 'active' ? 'var(--danger-500)' : 'var(--success-500)' }}
                          >
                            {busy ? <Loader2 size={12} className="animate-spin" />
                              : tenant.status === 'active' ? <Pause size={12} /> : <Play size={12} />}
                          </button>
                        </span>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </div>

      {modal?.type === 'create' && (
        <CreateTenantModal
          onClose={() => setModal(null)}
          onCreated={(payload) => {
            setModal(null);
            setShowOnce(payload);
            loadAll({ silent: true });
          }}
        />
      )}
      {modal?.type === 'rotate' && (
        <RotateCredentialsModal
          tenant={modal.tenant}
          onClose={() => setModal(null)}
          onRotated={(payload) => {
            setModal(null);
            setShowOnce(payload);
            loadAll({ silent: true });
          }}
        />
      )}
      {modal?.type === 'details' && (
        <TenantDetailsModal tenant={modal.tenant} onClose={() => setModal(null)} />
      )}

      {showOnce && <ShowOnceCredentialsModal payload={showOnce} onClose={closeShowOnce} />}
    </div>
  );
};

export default FeedTenantsView;
