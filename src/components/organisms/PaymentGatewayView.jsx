import React, { useState, useEffect } from 'react';
import { PaymentService, newMoneyIdempotencyKey } from '../../services/payment.service';
import { normalizeArrayResponse, getApiErrorMessage } from '../../utils/apiShapes';
import { RefreshCw, ToggleLeft, ToggleRight, Zap, RotateCcw } from 'lucide-react';

const pickDefined = (source, keys, fallback) => {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null) return source[key];
  }
  return fallback;
};

const toBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return ['true', '1', 'yes', 'active', 'enabled'].includes(value.toLowerCase());
  return Boolean(value);
};

const normalizeGatewayRow = (row, idx) => ({
  ...row,
  id: pickDefined(row, ['id', 'gateway_id', 'gatewayId'], idx),
  gateway_name: pickDefined(row, ['gateway_name', 'gatewayName', 'gateway', 'name'], ''),
  provider: pickDefined(row, ['provider', 'provider_name', 'providerName'], ''),
  status: pickDefined(row, ['status', 'health_status', 'healthStatus'], ''),
  success_rate: pickDefined(row, ['success_rate', 'successRate'], undefined),
  avg_response_ms: pickDefined(row, ['avg_response_ms', 'avgResponseMs', 'average_response_ms'], undefined),
  last_health_check: pickDefined(row, ['last_health_check', 'lastHealthCheck', 'checked_at', 'updated_at'], undefined),
  enabled: toBoolean(pickDefined(row, ['enabled', 'is_enabled', 'active'], false)),
});

const fmt = (v) => (v == null ? '—' : v);
const fmtTs = (v) => { if (!v) return '—'; try { return new Date(v * 1000).toLocaleString(); } catch { return v; } };

// ── Gateway Status Tab ─────────────────────────────────────────────────────
const GatewayStatusTab = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await PaymentService.getGatewayStatusList();
      setData(normalizeArrayResponse(res, ['gateways', 'gateway_status', 'statuses', 'data', 'answer', 'items', 'rows']).map(normalizeGatewayRow));
    } catch (err) {
      console.error(err);
      setError(getApiErrorMessage(err, 'Failed to load payment gateways.'));
      setData([]);
    }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleToggle = async (row) => {
    const newEnabled = !row.enabled;
    if (!window.confirm(`${newEnabled ? 'Enable' : 'Disable'} gateway "${row.gateway_name}"?`)) return;
    setToggling(row.id);
    try { await PaymentService.toggleGateway(row.id, newEnabled); fetchData(); }
    catch (err) { alert(getApiErrorMessage(err, 'Failed to update payment gateway.')); }
    finally { setToggling(null); }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center px-2 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0">
        <button onClick={fetchData} className="flex items-center gap-1.5 h-[22px] px-3 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--border-strong)] text-white text-[11px] rounded-[2px] border border-[#555]">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {/* Header */}
      <div className="flex bg-[color:var(--bg-surface-2)] border-b border-black/40 select-none shrink-0">
        {[['ID','w-[60px]'],['Gateway','w-[150px]'],['Provider','w-[110px]'],['Status','w-[100px]'],['Success Rate','w-[110px]'],['Avg ms','w-[90px]'],['Last Health Check','w-[170px]'],['Enabled','flex-1']].map(([l,w]) =>
          <div key={l} className={`${w} px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 shrink-0`}>{l}</div>
        )}
        <div className="w-[90px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] shrink-0">Toggle</div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        {data.map((row, idx) => (
          <div key={row.id || idx} className={`flex border-b border-black/10 hover:bg-blue-600/10 ${idx%2===0?'bg-[color:var(--bg-app)]':'bg-[color:var(--bg-surface-1)]'}`}>
            <div className="w-[60px] px-3 py-1.5 text-[12px] text-white font-semibold border-r border-black/10 shrink-0 flex items-center">{fmt(row.id)}</div>
            <div className="w-[150px] px-3 py-1.5 text-[12px] text-[color:var(--text-primary)] border-r border-black/10 shrink-0 truncate flex items-center">{fmt(row.gateway_name)}</div>
            <div className="w-[110px] px-3 py-1.5 text-[12px] text-[color:var(--text-muted)] font-mono border-r border-black/10 shrink-0 flex items-center">{fmt(row.provider)}</div>
            <div className="w-[100px] px-3 py-1.5 border-r border-black/10 shrink-0 flex items-center">
              <span className={`text-[11px] font-semibold ${row.status === 'active' ? 'text-white' : 'text-[#f48771]'}`}>{fmt(row.status)}</span>
            </div>
            <div className="w-[110px] px-3 py-1.5 text-[12px] text-white font-semibold border-r border-black/10 shrink-0 flex items-center">
              {row.success_rate != null ? `${row.success_rate}%` : '—'}
            </div>
            <div className="w-[90px] px-3 py-1.5 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 flex items-center">{fmt(row.avg_response_ms)}</div>
            <div className="w-[170px] px-3 py-1.5 text-[11px] text-white font-mono border-r border-black/10 shrink-0 flex items-center">{fmtTs(row.last_health_check)}</div>
            <div className="flex-1 px-3 py-1.5 border-r border-black/10 flex items-center">
              <span className={`text-[11px] font-semibold ${row.enabled ? 'text-white' : 'text-[#f48771]'}`}>{row.enabled ? 'Yes' : 'No'}</span>
            </div>
            <div className="w-[90px] px-3 py-1.5 flex items-center shrink-0">
              <button onClick={() => handleToggle(row)} disabled={toggling === row.id}
                className={`flex items-center gap-1 h-[20px] px-2 text-[10px] rounded-[2px] disabled:opacity-50 transition-colors ${row.enabled
                  ? 'bg-[#f48771]/20 hover:bg-[#f48771]/40 text-[#f48771]'
                  : 'bg-[color:var(--accent-soft)] hover:bg-[color:var(--accent-100)] text-[color:var(--success-500)]'}`}>
                {row.enabled ? <><ToggleRight size={10} /> Disable</> : <><ToggleLeft size={10} /> Enable</>}
              </button>
            </div>
          </div>
        ))}
        {loading && <div className="p-4 text-[color:var(--text-muted)] text-[12px] italic">Loading…</div>}
        {!loading && error && <div className="p-4 text-[#f48771] text-[12px] bg-[#f48771]/10 border-b border-[#f48771]/20">{error}</div>}
        {!loading && !error && data.length === 0 && <div className="p-4 text-[color:var(--text-muted)] text-[12px] italic">No gateways found.</div>}
      </div>
    </div>
  );
};

// ── Callback Processing Tab ────────────────────────────────────────────────
const CallbackTab = () => {
  const [form, setForm] = useState({ deposit_id: '', gateway_status: 'success', gateway_ref: '' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const inp = "w-full bg-[color:var(--bg-surface-2)] border border-[#555] text-[color:var(--text-primary)] text-[12px] px-2 py-1.5 rounded-[2px] focus:outline-none focus:border-[color:var(--accent-500)]";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.deposit_id || !form.gateway_status) { setError('Deposit ID and Gateway Status are required.'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const params = { deposit_id: parseInt(form.deposit_id), gateway_status: form.gateway_status };
      if (form.gateway_ref) params.gateway_ref = form.gateway_ref;
      const res = await PaymentService.processCallback(params);
      setResult(res);
    } catch (err) { setError(getApiErrorMessage(err, 'Failed to process payment callback.')); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col p-6 gap-4 max-w-[500px]">
      <div className="text-[11px] text-white">Process a callback from a payment gateway to update deposit status and reference.</div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-white uppercase tracking-wider">Deposit ID<span className="text-[#f48771] ml-0.5">*</span></label>
            <input className={inp} type="number" value={form.deposit_id} onChange={e => set('deposit_id', e.target.value)} placeholder="10" />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-white uppercase tracking-wider">Gateway Status<span className="text-[#f48771] ml-0.5">*</span></label>
            <select className={inp} value={form.gateway_status} onChange={e => set('gateway_status', e.target.value)}>
              {['success','failed','pending'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] text-white uppercase tracking-wider">Gateway Reference</label>
          <input className={inp} value={form.gateway_ref} onChange={e => set('gateway_ref', e.target.value)} placeholder="GW-TXN-9988" />
        </div>
        {error && <div className="text-[11px] text-[#f48771] bg-[color:var(--bg-surface-2)] px-3 py-1.5 rounded-[2px]">{error}</div>}
        {result && (
          <div className="bg-[color:var(--accent-soft)] border border-[color:var(--accent-border)] rounded-[2px] px-4 py-3">
            <div className="text-[10px] text-white font-semibold uppercase mb-2">Callback Processed</div>
            <pre className="text-[11px] text-[color:var(--text-primary)] font-mono whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
        <button type="submit" disabled={loading}
          className="flex items-center justify-center gap-1.5 h-[28px] px-4 text-[11px] bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] disabled:opacity-50 text-white rounded-[2px]">
          <Zap size={11} /> {loading ? 'Processing…' : 'Process Callback'}
        </button>
      </form>
    </div>
  );
};

// ── Refund Tab ─────────────────────────────────────────────────────────────
const RefundTab = () => {
  const [form, setForm] = useState({ transaction_id: '', reason: '' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const inp = "w-full bg-[color:var(--bg-surface-2)] border border-[#555] text-[color:var(--text-primary)] text-[12px] px-2 py-1.5 rounded-[2px] focus:outline-none focus:border-[color:var(--accent-500)]";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.transaction_id) { setError('Transaction ID is required.'); return; }
    setLoading(true); setError(''); setResult(null);
    // One idempotency key per click: minted here so a retry of this same
    // click reuses it, while the next click mints a fresh one.
    const idempotencyKey = newMoneyIdempotencyKey();
    try {
      const res = await PaymentService.processRefund(parseInt(form.transaction_id), form.reason || undefined, { idempotencyKey });
      setResult(res);
    } catch (err) { setError(getApiErrorMessage(err, 'Failed to process refund.')); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col p-6 gap-4 max-w-[500px]">
      <div className="text-[11px] text-white">Refund a transaction and credit the account balance (atomic operation).</div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-white uppercase tracking-wider">Transaction ID<span className="text-[#f48771] ml-0.5">*</span></label>
            <input className={inp} type="number" value={form.transaction_id} onChange={e => set('transaction_id', e.target.value)} placeholder="101" />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-white uppercase tracking-wider">Reason</label>
            <input className={inp} value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="Duplicate charge" />
          </div>
        </div>
        {error && <div className="text-[11px] text-[#f48771] bg-[color:var(--bg-surface-2)] px-3 py-1.5 rounded-[2px]">{error}</div>}
        {result && (
          <div className="bg-[color:var(--accent-soft)] border border-[color:var(--accent-border)] rounded-[2px] px-4 py-3">
            <div className="text-[10px] text-white font-semibold uppercase mb-2">Refund Processed</div>
            <pre className="text-[11px] text-[color:var(--text-primary)] font-mono whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
        <button type="submit" disabled={loading}
          className="flex items-center justify-center gap-1.5 h-[28px] px-4 text-[11px] bg-[#ce9178] hover:bg-[#d4a074] disabled:opacity-50 text-[color:var(--bg-app)] font-semibold rounded-[2px]">
          <RotateCcw size={11} /> {loading ? 'Processing…' : 'Process Refund'}
        </button>
      </form>
    </div>
  );
};

// ── Main View ──────────────────────────────────────────────────────────────
const TABS = ['Gateway Status', 'Process Callback', 'Process Refund'];

const PaymentGatewayView = () => {
  const [tab, setTab] = useState('Gateway Status');

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden">
      {/* Tab Bar */}
      <div className="flex bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0 select-none">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 h-[30px] text-[11px] border-r border-black/30 transition-colors ${tab === t ? 'bg-[color:var(--bg-app)] text-white border-t-2 border-t-[color:var(--accent-500)]' : 'text-white hover:text-white hover:bg-[color:var(--bg-surface-1)]'}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {tab === 'Gateway Status' && <GatewayStatusTab />}
        {tab === 'Process Callback' && <CallbackTab />}
        {tab === 'Process Refund' && <RefundTab />}
      </div>
    </div>
  );
};
export default PaymentGatewayView;
