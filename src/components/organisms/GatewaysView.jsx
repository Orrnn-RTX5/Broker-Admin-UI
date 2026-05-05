import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, Loader2, X, Plus, RefreshCw, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { gatewayGetStatus, gatewayConnect, gatewayDisconnect } from '../../services/gateway.service';
import { ManagerService } from '../../services/manager.service';

// ─── Static gateway catalogue ──────────────────────────────────────────────────
const GATEWAY_CATALOGUE = [
  { id: 1,  name: 'ASX Gateway',                build: '5.00 build 5370 (17 Oct 2025)' },
  { id: 2,  name: 'BMFBOVESPA Gateway',          build: '5.00 build 5370 (17 Oct 2025)' },
  { id: 3,  name: 'Borsa Istanbul VIOP Gateway', build: '5.00 build 5370 (17 Oct 2025)' },
  { id: 4,  name: 'BSE Gateway',                 build: '5.00 build 5370 (17 Oct 2025)' },
  { id: 5,  name: 'Cboe FX Gateway',             build: '5.00 build 5370 (17 Oct 2025)' },
  { id: 6,  name: 'Currenex Gateway',            build: '5.00 build 5370 (17 Oct 2025)' },
  { id: 7,  name: 'DGCX Gateway',                build: '5.00 build 5370 (17 Oct 2025)' },
  { id: 8,  name: 'Euronext FX Gateway',         build: '5.00 build 5370 (17 Oct 2025)' },
  { id: 9,  name: 'FXCM Pro Gateway',            build: '5.00 build 5370 (17 Oct 2025)' },
  { id: 10, name: 'GBOT Gateway',                build: '5.00 build 5370 (17 Oct 2025)' },
  { id: 11, name: 'Integral Gateway',            build: '5.00 build 5370 (17 Oct 2025)' },
  { id: 12, name: 'Interactive Brokers Gateway', build: '5.00 build 5100 (6 Jun 2025)'  },
  { id: 13, name: 'LMAX Gateway',                build: '5.00 build 5370 (17 Oct 2025)' },
  { id: 14, name: 'MetaTrader 4 Gateway',        build: '5.00 build 5370 (17 Oct 2025)' },
  { id: 15, name: 'MetaTrader 5 Gateway',        build: '5.00 build 5370 (17 Oct 2025)' },
  { id: 16, name: 'MOEX Derivatives Gateway',    build: '5.00 build 5370 (17 Oct 2025)' },
  { id: 17, name: 'MOEX Securities Gateway',     build: '5.00 build 5370 (17 Oct 2025)' },
  { id: 18, name: 'MOEXFX Gateway',              build: '5.00 build 5370 (17 Oct 2025)' },
  { id: 19, name: 'Remote gateway',              build: '' },
];

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
  const [groups, setGroups]   = useState([]);
  const [role, setRole]       = useState('both');
  const [form, setForm]       = useState({
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

  // Fetch MT5 groups to populate the Provider dropdown
  useEffect(() => {
    ManagerService.getGroupList()
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.answer ?? []);
        setGroups(list);
      })
      .catch(() => {});
  }, []);

  const sf = (k) => (e) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const showTrade = role === 'both' || role === 'trade';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const payload = {
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
          <div className="grid grid-cols-2 gap-3">
            <F label="Provider" required>
              <select
                className="ui-input ui-input-sm"
                value={form.provider}
                onChange={sf('provider')}
                required
              >
                <option value="">Select group…</option>
                {groups.map(g => (
                  <option key={g.name} value={g.name}>{g.name}</option>
                ))}
              </select>
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

const SessionBlock = ({ title, data, color }) => {
  if (!data) return null;
  return (
    <div className="flex flex-col gap-0 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
      <div className="px-3 py-2 text-[10px] uppercase tracking-widest font-bold" style={{ background: 'var(--surface-2)', color }}>
        {title}
      </div>
      <div className="px-3 py-2 flex flex-col" style={{ background: 'var(--surface)' }}>
        {data.session    && <KV label="Session"     value={data.session}    mono />}
        {data.host       && <KV label="Host : Port" value={`${data.host} : ${data.port}`} mono />}
        <KV label="Logged On"    value={data.logged_on    ? '✓ Yes' : '✗ No'} />
        <KV label="Password Set" value={data.password_set ? '✓ Yes' : '✗ No'} />
        {data.symbols    && <KV label="Symbols"     value={data.symbols.join(', ')} mono />}
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
        const httpStatus = e.response?.status ?? (e.message?.match(/HTTP (\d+)/)?.[1] && Number(e.message.match(/HTTP (\d+)/)[1]));
        // 401 means the LP gateway has no active session — treat silently as disconnected
        // 404 / "No active" has the same meaning
        if (httpStatus === 401 || httpStatus === 404 || e.message?.includes('No active')) {
          setStatus({ status: 'disconnected' });
        } else {
          setErr(e.message || 'Failed to fetch gateway status');
          setStatus({ status: 'disconnected' });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const isConnected = status?.status === 'connected';

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
              {status?.name && <span className="text-sm font-normal" style={{ color: 'var(--text-3)' }}>— {status.name}</span>}
              {loading && <Loader2 size={11} className="animate-spin" style={{ color: 'var(--muted)' }} />}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusDot on={isConnected} />
              <span className="text-xs capitalize" style={{ color: isConnected ? '#4ade80' : 'var(--muted)' }}>
                {status?.status ?? 'loading…'}
              </span>
              {status?.provider && <span className="text-xs" style={{ color: 'var(--text-3)' }}>· {status.provider}</span>}
              {status?.role     && <span className="text-xs" style={{ color: 'var(--text-3)' }}>· role: {status.role}</span>}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={fetchStatus} title="Refresh status"
            className="ui-btn ui-btn-ghost ui-btn-icon ui-btn-sm">
            <RefreshCw size={13} />
          </button>
          {isConnected ? (
            <button onClick={() => setModal('disconnect')}
              className="ui-btn ui-btn-sm gap-1.5"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              <WifiOff size={12} /> Disconnect
            </button>
          ) : (
            <button onClick={() => setModal('connect')} className="ui-btn ui-btn-primary ui-btn-sm gap-1.5">
              <Plus size={12} /> Connect LP
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
                  { label: 'Status',            value: status.status,          color: '#4ade80' },
                  { label: 'Live Data Source',  value: status.live_data_source, color: '#60a5fa' },
                  { label: 'Order Routing LP',  value: status.order_routing_lp, color: '#c084fc' },
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

// ─── Main View ─────────────────────────────────────────────────────────────────
const GatewaysView = () => (
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

      <div className="flex items-center gap-3">
        <div className="flex-1 border-t" style={{ borderColor: 'var(--border-3)' }} />
        <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--text-3)' }}>
          Available Gateway Modules
        </span>
        <div className="flex-1 border-t" style={{ borderColor: 'var(--border-3)' }} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {GATEWAY_CATALOGUE.map(gw => (
          <div key={gw.id}
            className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-lg border transition-colors"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <span className="text-xs font-medium text-center leading-snug" style={{ color: 'var(--text-2)' }}>{gw.name}</span>
            {gw.build && <span className="text-[10px] text-center" style={{ color: 'var(--text-3)' }}>{gw.build}</span>}
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default GatewaysView;
