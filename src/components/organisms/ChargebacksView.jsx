import React, { useState, useEffect } from 'react';
import { PaymentService } from '../../services/payment.service';
import { Plus, RefreshCw, X, CheckCircle, XCircle } from 'lucide-react';

const fmt = (v) => (v == null ? '—' : v);
const fmtTs = (v) => { if (!v) return '—'; try { return new Date(v * 1000).toLocaleString(); } catch { return v; } };

const STATUS_STYLE = {
  open:     { color: 'text-[#f4c96e]', bg: 'bg-[#f4c96e]/10' },
  resolved: { color: 'text-[#4ec9b0]', bg: 'bg-[#4ec9b0]/10' },
  rejected: { color: 'text-[#f48771]', bg: 'bg-[#f48771]/10' },
};
const Badge = ({ status }) => {
  const s = STATUS_STYLE[status] || { color: 'text-[#aaa]', bg: 'bg-white/5' };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-[2px] ${s.color} ${s.bg}`}>{status || '—'}</span>;
};

// ── Create Chargeback Popup ────────────────────────────────────────────────
const CreatePopup = ({ onClose, onSaved }) => {
  const [form, setForm] = useState({ deposit_id: '', account_login: '', amount: '', reason: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const inp = "w-full bg-[color:var(--bg-surface-2)] border border-[#555] text-[color:var(--text-primary)] text-[12px] px-2 py-1 rounded-[2px] focus:outline-none focus:border-[color:var(--accent-500)]";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.deposit_id || !form.account_login) { setError('Deposit ID and Account Login are required.'); return; }
    setLoading(true); setError('');
    try {
      const payload = { deposit_id: parseInt(form.deposit_id), account_login: parseInt(form.account_login) };
      if (form.amount) payload.amount = parseFloat(form.amount);
      if (form.reason) payload.reason = form.reason;
      await PaymentService.createChargeback(payload);
      onSaved(); onClose();
    } catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setLoading(false); }
  };

  const Lbl = ({ t, req, children }) => (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] text-[#888] uppercase tracking-wider">{t}{req && <span className="text-[#f48771] ml-0.5">*</span>}</label>
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-[3px] shadow-2xl w-[420px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center h-9 px-4 border-b border-black/40 bg-[color:var(--bg-surface-1)]">
          <span className="text-[12px] font-semibold text-[color:var(--text-primary)] flex-1">Create Chargeback</span>
          <button onClick={onClose} className="text-[#555] hover:text-[#ccc]"><X size={14} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Lbl t="Deposit ID" req><input className={inp} type="number" value={form.deposit_id} onChange={e => set('deposit_id', e.target.value)} /></Lbl>
            <Lbl t="Account Login" req><input className={inp} type="number" value={form.account_login} onChange={e => set('account_login', e.target.value)} /></Lbl>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Lbl t="Amount"><input className={inp} type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="optional" /></Lbl>
            <Lbl t="Reason"><input className={inp} value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="Unauthorized transaction" /></Lbl>
          </div>
          {error && <div className="text-[11px] text-[#f48771] bg-[color:var(--bg-surface-2)] px-3 py-1.5 rounded-[2px]">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="h-[26px] px-4 text-[11px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--border-strong)] text-[#ccc] rounded-[2px]">Cancel</button>
            <button type="submit" disabled={loading} className="h-[26px] px-4 text-[11px] bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] disabled:opacity-50 text-white rounded-[2px]">{loading ? 'Creating…' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Resolve Popup ──────────────────────────────────────────────────────────
const ResolvePopup = ({ row, onClose, onSaved }) => {
  const [form, setForm] = useState({ status: 'resolved', resolution: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const inp = "w-full bg-[color:var(--bg-surface-2)] border border-[#555] text-[color:var(--text-primary)] text-[12px] px-2 py-1 rounded-[2px] focus:outline-none focus:border-[color:var(--accent-500)]";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await PaymentService.resolveChargeback(row.id, form.status, form.resolution || undefined);
      onSaved(); onClose();
    } catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-[3px] shadow-2xl w-[380px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center h-9 px-4 border-b border-black/40 bg-[color:var(--bg-surface-1)]">
          <span className="text-[12px] font-semibold text-[color:var(--text-primary)] flex-1">Resolve Chargeback #{row.id}</span>
          <button onClick={onClose} className="text-[#555] hover:text-[#ccc]"><X size={14} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div className="bg-[color:var(--bg-app)] rounded-[2px] px-3 py-2 text-[11px] text-[#888] border border-[color:var(--border-default)]">
            Login: <span className="text-[color:var(--text-primary)]">{row.account_login}</span> · Amount: <span className="text-[#f48771] font-semibold">{row.amount}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-[#888] uppercase">Resolution Status<span className="text-[#f48771] ml-0.5">*</span></label>
              <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="resolved">resolved</option>
                <option value="rejected">rejected</option>
              </select>
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-[#888] uppercase">Notes</label>
              <input className={inp} value={form.resolution} onChange={e => set('resolution', e.target.value)} placeholder="Refund issued…" />
            </div>
          </div>
          {error && <div className="text-[11px] text-[#f48771] bg-[color:var(--bg-surface-2)] px-3 py-1.5 rounded-[2px]">{error}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="h-[26px] px-4 text-[11px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--border-strong)] text-[#ccc] rounded-[2px]">Cancel</button>
            <button type="submit" disabled={loading}
              className={`h-[26px] px-4 text-[11px] disabled:opacity-50 text-white rounded-[2px] ${form.status === 'resolved' ? 'bg-[#4ec9b0] hover:bg-[#5dd9be]' : 'bg-[#e51400] hover:bg-[#ff2d00]'}`}>
              {loading ? 'Saving…' : form.status === 'resolved' ? 'Resolve' : 'Reject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main View ──────────────────────────────────────────────────────────────
const ChargebacksView = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [resolveRow, setResolveRow] = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await PaymentService.getChargebackList(filterStatus || undefined);
      setData(Array.isArray(res) ? res : res?.data ?? []);
    } catch (err) { console.error(err); setData([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const cols = [
    { label: 'ID', w: 'w-[60px]' }, { label: 'Deposit ID', w: 'w-[90px]' },
    { label: 'Login', w: 'w-[90px]' }, { label: 'Amount', w: 'w-[100px]' },
    { label: 'Status', w: 'w-[100px]' }, { label: 'Reason', w: 'w-[220px]' },
    { label: 'Resolution', w: 'w-[180px]' }, { label: 'Created', w: 'w-[150px]' },
    { label: 'Resolved', w: 'flex-1' },
  ];

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden relative"
      onClick={() => setContextMenu({ visible: false })} onContextMenu={e => e.preventDefault()}>
      <div className="flex items-center gap-2 px-2 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0 select-none">
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 h-[24px] px-3 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px]">
          <Plus size={12} /> Create Chargeback
        </button>
        <div className="flex items-center gap-1.5 ml-3">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="h-[22px] bg-[color:var(--bg-surface-2)] border border-[#555] text-[#ccc] text-[11px] px-2 rounded-[2px]">
            <option value="">All status</option>
            {['open','resolved','rejected'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={fetchData} className="h-[22px] px-2.5 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--border-strong)] text-[#ccc] text-[11px] rounded-[2px] border border-[#555]">Filter</button>
        </div>
        <div className="ml-auto pr-2"><button onClick={fetchData} className="text-[#999] hover:text-white"><RefreshCw size={13} /></button></div>
      </div>

      <div className="flex bg-[color:var(--bg-surface-2)] border-b border-black/40 sticky top-0 z-10 select-none shrink-0">
        {cols.map(c => <div key={c.label} className={`${c.w} px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 shrink-0`}>{c.label}</div>)}
        <div className="w-[90px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] shrink-0">Action</div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        {data.map((row, idx) => (
          <div key={row.id || idx}
            onContextMenu={e => { e.preventDefault(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, row }); }}
            className={`flex border-b border-black/10 hover:bg-blue-600/10 ${idx%2===0?'bg-[color:var(--bg-app)]':'bg-[color:var(--bg-surface-1)]'}`}>
            <div className="w-[60px] px-3 py-1 text-[12px] text-[#9cdcfe] font-semibold border-r border-black/10 shrink-0 flex items-center">{fmt(row.id)}</div>
            <div className="w-[90px] px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 flex items-center">{fmt(row.deposit_id)}</div>
            <div className="w-[90px] px-3 py-1 text-[12px] text-[color:var(--text-primary)] border-r border-black/10 shrink-0 flex items-center">{fmt(row.account_login)}</div>
            <div className="w-[100px] px-3 py-1 text-[12px] text-[#f48771] font-semibold border-r border-black/10 shrink-0 flex items-center">{fmt(row.amount)}</div>
            <div className="w-[100px] px-3 py-1 border-r border-black/10 shrink-0 flex items-center"><Badge status={row.status} /></div>
            <div className="w-[220px] px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate flex items-center">{fmt(row.reason)}</div>
            <div className="w-[180px] px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate flex items-center">{fmt(row.resolution)}</div>
            <div className="w-[150px] px-3 py-1 text-[11px] text-[#888] font-mono border-r border-black/10 shrink-0 flex items-center">{fmtTs(row.created_at)}</div>
            <div className="flex-1 px-3 py-1 text-[11px] text-[#888] font-mono border-r border-black/10 flex items-center">{fmtTs(row.resolved_at)}</div>
            <div className="w-[90px] px-2 py-1 flex items-center shrink-0">
              {row.status === 'open' && (
                <button onClick={() => setResolveRow(row)}
                  className="flex items-center gap-1 h-[20px] px-2 bg-[#4ec9b0]/20 hover:bg-[#4ec9b0]/40 text-[#4ec9b0] text-[10px] rounded-[2px]">
                  <CheckCircle size={10} /> Resolve
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="p-4 text-[color:var(--text-muted)] text-[12px] italic">Loading…</div>}
        {!loading && data.length === 0 && <div className="p-4 text-[color:var(--text-muted)] text-[12px] italic">No chargebacks found.</div>}
        {[...Array(12)].map((_, i) => <div key={i} className={`flex border-b border-black/5 opacity-30 h-6 ${i%2===0?'bg-[color:var(--bg-app)]':'bg-[color:var(--bg-surface-1)]'}`}></div>)}
      </div>

      {contextMenu.visible && (
        <div className="fixed z-[9999] bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] shadow-2xl py-1 min-w-[160px] text-[12px] text-[color:var(--text-secondary)] rounded-[2px]"
          style={{ top: contextMenu.y, left: contextMenu.x }} onClick={e => e.stopPropagation()}>
          <div className="px-4 py-1 hover:bg-[color:var(--accent-500)] hover:text-white cursor-pointer" onClick={() => { setCreateOpen(true); setContextMenu({ visible: false }); }}>Create Chargeback</div>
          {contextMenu.row?.status === 'open' && <>
            <div className="h-px bg-[color:var(--border-default)] my-1 mx-2"></div>
            <div className="px-4 py-1 hover:bg-[#4ec9b0]/30 hover:text-[#4ec9b0] cursor-pointer" onClick={() => { setResolveRow(contextMenu.row); setContextMenu({ visible: false }); }}>Resolve / Reject</div>
          </>}
        </div>
      )}

      {createOpen && <CreatePopup onClose={() => setCreateOpen(false)} onSaved={fetchData} />}
      {resolveRow && <ResolvePopup row={resolveRow} onClose={() => setResolveRow(null)} onSaved={fetchData} />}

      <div className="h-6 bg-[color:var(--accent-500)] text-white flex items-center px-4 text-[11px] select-none shrink-0 border-t border-[color:var(--accent-700)]">
        <span>Total: {data.length}</span>
        {filterStatus && <span className="ml-4 opacity-70">Status: {filterStatus}</span>}
      </div>
    </div>
  );
};
export default ChargebacksView;
