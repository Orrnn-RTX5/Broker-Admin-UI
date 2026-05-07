import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, Loader2, X, Plus, RefreshCw, ChevronDown, ChevronUp, AlertCircle, Network } from 'lucide-react';
import { gatewayGetStatus, gatewayConnect, gatewayDisconnect, gatewayGetRoutingOptions } from '../../services/gateway.service';
import { ManagerService } from '../../services/manager.service';

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

// ─── Connect Modal ─────────────────────────────────────────────────────────────
const ConnectModal = ({ onClose, onConnected }) => {
  const [role, setRole]       = useState('quote');
  const [form, setForm]       = useState({
    name:                 'T4B',
    provider:             'Tools for Brokers',
    host:                 'achiever.tp.t4b.app',
    port:                 '12333',
    sender_comp_id:       'TIGER-50071-QUOTES',
    target_comp_id:       'TIGER',
    username:             'TIGER-50071-QUOTES',
    password:             'TIGER@50071$$$$',
    account:              '50071',
    use_ssl:              false,
    trade_sender_comp_id: 'TIGER-50071-TRADE',
    trade_username:       'TIGER-50071-TRADE',
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
              <Input value={form.host} onChange={sf('host')} placeholder="live-achiever.tp-t4b.app" required />
            </F>
            <F label="Port" required>
              <Input value={form.port} onChange={sf('port')} placeholder="12333" required />
            </F>
            <F label="Sender CompID" required>
              <Input value={form.sender_comp_id} onChange={sf('sender_comp_id')} placeholder="TIGER-50071-QUOTES" required />
            </F>
            <F label="Target CompID" required>
              <Input value={form.target_comp_id} onChange={sf('target_comp_id')} placeholder="achiever.tp.t4b.app" required />
            </F>
            <F label="Username" required>
              <Input value={form.username} onChange={sf('username')} placeholder="TIGER-50071-QUOTES" required />
            </F>
            <F label="Password" required>
              <Input type="password" value={form.password} onChange={sf('password')} placeholder="Quote password" required />
            </F>
            <F label="Account">
              <Input value={form.account} onChange={sf('account')} placeholder="50071" />
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
                    placeholder="TIGER-50071-TRADE" required={showTrade} />
                </F>
                <F label="Trade Username" required>
                  <Input value={form.trade_username} onChange={sf('trade_username')}
                    placeholder="TIGER-50071-TRADE" required={showTrade} />
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
            <span style={{ color: '#60a5fa' }}>/api/v1/gateway/lp/disconnect</span>
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

// ─── LP Gateway Panel ──────────────────────────────────────────────────────────
const LpGatewayPanel = ({ hideHostPortPassword }) => {
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
        const httpStatus = e.status ?? e.response?.status ?? (e.message?.match(/HTTP (\d+)/)?.[1] && Number(e.message.match(/HTTP (\d+)/)[1]));
        // 401 means the LP gateway has no active session — treat silently as disconnected
        // 404 / "No active" has the same meaning
        if (httpStatus === 401 || httpStatus === 404 || e.message?.includes('No active')) {
          setStatus({ quote: { connected: false }, trade: { connected: false } });
        } else {
          setErr(e.message || 'Failed to fetch gateway status');
          setStatus({ quote: { connected: false }, trade: { connected: false } });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

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
    <div className="flex-1 flex flex-col bg-[color:var(--bg-app)] overflow-hidden text-[color:var(--text-primary)]">
      <div className="flex justify-between items-start px-5 py-4 border-b border-black/40 shrink-0 bg-[color:var(--bg-surface-1)]">
        <div>
          <h1 className="text-[17px] font-semibold text-white mb-1">Gateways</h1>
          <p className="text-[12px] text-[color:var(--text-muted)]">
            Connect liquidity providers via the LP Gateway API, or choose from built-in exchange gateways below.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-5 flex flex-col gap-6">
        <LpGatewayPanel />
      </div>
    </div>
  );
};

export default GatewaysView;
