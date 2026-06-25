import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PaymentService } from '../../services/payment.service';
import { parseMoneyAmount, parsePositiveInteger } from '../../utils/adminValidation';
import { normalizeArrayResponse, getApiErrorMessage } from '../../utils/apiShapes';
import { Plus, RefreshCw, X, CheckCircle, XCircle } from 'lucide-react';

const fmt = (v) => (v == null ? '—' : v);
const fmtTs = (v) => { if (!v) return '—'; try { return new Date(v * 1000).toLocaleString(); } catch { return v; } };

const STATUS = {
  pending:  { color: 'text-[#f4c96e]', bg: 'bg-[#f4c96e]/10' },
  approved: { color: 'text-[#4ec9b0]', bg: 'bg-[#4ec9b0]/10' },
  rejected: { color: 'text-[#f48771]', bg: 'bg-[#f48771]/10' },
};
const Badge = ({ status }) => {
  const s = STATUS[status] || { color: 'text-[#aaa]', bg: 'bg-white/5' };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-[2px] ${s.color} ${s.bg}`}>{status || '—'}</span>;
};

// ── Add Deposit Popup ──────────────────────────────────────────────────────
const FormLabel = ({ t, req, children }) => (
  <div className="flex flex-col gap-0.5">
    <label className="text-[10px] text-[#888] uppercase tracking-wider">{t}{req && <span className="text-[#f48771] ml-0.5">*</span>}</label>
    {children}
  </div>
);

const AddDepositPopup = ({ onClose, onSaved }) => {
  const [form, setForm] = useState({ login: '', amount: '', method_id: '', currency: 'USD', reference: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const inp = "w-full bg-[color:var(--bg-surface-2)] border border-[#555] text-[color:var(--text-primary)] text-[12px] px-2 py-1 rounded-[2px] focus:outline-none focus:border-[color:var(--accent-500)]";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.login) { setError('Login and Amount are required.'); return; }
    let login;
    let amount;
    try {
      login = parsePositiveInteger(form.login, 'Login');
      amount = parseMoneyAmount(form.amount, 'Amount');
    } catch (validationErr) {
      setError(validationErr.message);
      return;
    }
    setLoading(true); setError('');
    try {
      const payload = { login, amount, currency: form.currency };
      if (form.method_id) payload.method_id = parseInt(form.method_id);
      if (form.reference) payload.reference = form.reference;
      await PaymentService.createDeposit(payload);
      onSaved(); onClose();
    } catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-[3px] shadow-2xl w-[400px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center h-9 px-4 border-b border-black/40 bg-[color:var(--bg-surface-1)]">
          <span className="text-[12px] font-semibold text-[color:var(--text-primary)] flex-1">New Deposit Request</span>
          <button onClick={onClose} className="text-[#555] hover:text-[#ccc]"><X size={14} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <FormLabel t="Account Login" req><input className={inp} type="number" value={form.login} onChange={e => set('login', e.target.value)} placeholder="12345" /></FormLabel>
            <FormLabel t="Amount" req><input className={inp} type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="500.00" /></FormLabel>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FormLabel t="Method ID"><input className={inp} type="number" value={form.method_id} onChange={e => set('method_id', e.target.value)} placeholder="1" /></FormLabel>
            <FormLabel t="Currency"><input className={inp} value={form.currency} onChange={e => set('currency', e.target.value)} /></FormLabel>
            <FormLabel t="Reference"><input className={inp} value={form.reference} onChange={e => set('reference', e.target.value)} placeholder="GW-REF-001" /></FormLabel>
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

// ── Reject Popup ───────────────────────────────────────────────────────────
const RejectPopup = ({ deposit, onClose, onSaved }) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await PaymentService.rejectDeposit(deposit.id, reason); onSaved(); onClose(); }
    catch (err) { alert(err.response?.data?.message || err.message); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-[3px] shadow-2xl w-[360px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center h-9 px-4 border-b border-black/40 bg-[color:var(--bg-surface-1)]">
          <span className="text-[12px] font-semibold text-[color:var(--text-primary)] flex-1">Reject Deposit #{deposit.id}</span>
          <button onClick={onClose} className="text-[#555] hover:text-[#ccc]"><X size={14} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-[#888] uppercase tracking-wider">Reason (optional)</label>
            <input value={reason} onChange={e => setReason(e.target.value)}
              className="w-full bg-[color:var(--bg-surface-2)] border border-[#555] text-[color:var(--text-primary)] text-[12px] px-2 py-1 rounded-[2px] focus:outline-none focus:border-[color:var(--accent-500)]"
              placeholder="Insufficient proof…" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="h-[26px] px-4 text-[11px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--border-strong)] text-[#ccc] rounded-[2px]">Cancel</button>
            <button type="submit" disabled={loading} className="h-[26px] px-4 text-[11px] bg-[#e51400] hover:bg-[#ff2d00] disabled:opacity-50 text-white rounded-[2px]">{loading ? 'Rejecting…' : 'Reject'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main View ──────────────────────────────────────────────────────────────
const DepositsView = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterLogin, setFilterLogin] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [rejectRow, setRejectRow] = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false });
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filterLogin) params.login = parseInt(filterLogin);
      if (filterStatus) params.status = filterStatus;
      const res = await PaymentService.getDepositList(params);
      setData(normalizeArrayResponse(res, ['deposits', 'requests', 'data', 'answer', 'items']));
    } catch (err) {
      console.error(err);
      setError(getApiErrorMessage(err, 'Failed to load deposit requests.'));
      setData([]);
    }
    finally { setLoading(false); }
  }, [filterLogin, filterStatus]);

  const fetchDataRef = useRef(fetchData);

  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDataRef.current();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleApprove = async (row) => {
    if (!window.confirm(`Approve deposit #${row.id} ($${row.amount}) for login ${row.account_login}?`)) return;
    setActionLoading(row.id);
    try { await PaymentService.approveDeposit(row.id); fetchData(); }
    catch (err) { alert(err.response?.data?.message || err.message); }
    finally { setActionLoading(null); }
  };

  const cols = [
    { label: 'ID', w: 'w-[60px]' }, { label: 'Login', w: 'w-[90px]' },
    { label: 'Method', w: 'w-[80px]' }, { label: 'Amount', w: 'w-[100px]' },
    { label: 'Currency', w: 'w-[80px]' }, { label: 'Status', w: 'w-[100px]' },
    { label: 'Reference', w: 'w-[140px]' }, { label: 'Created', w: 'w-[150px]' },
    { label: 'Processed', w: 'flex-1' },
  ];

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden relative"
      onClick={() => setContextMenu({ visible: false })} onContextMenu={e => e.preventDefault()}>
      {/* Action Bar */}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0 select-none">
        <button onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 h-[24px] px-3 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] transition-colors">
          <Plus size={12} /> New Deposit
        </button>
        <div className="flex items-center gap-1.5 ml-3">
          <input value={filterLogin} onChange={e => setFilterLogin(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchData()}
            placeholder="login…" className="h-[22px] w-[90px] bg-[color:var(--bg-surface-2)] border border-[#555] text-[color:var(--text-primary)] text-[11px] px-2 rounded-[2px] focus:outline-none focus:border-[color:var(--accent-500)]" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="h-[22px] bg-[color:var(--bg-surface-2)] border border-[#555] text-[#ccc] text-[11px] px-2 rounded-[2px] focus:outline-none">
            <option value="">All status</option>
            {['pending','approved','rejected'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={fetchData} className="h-[22px] px-2.5 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--border-strong)] text-[#ccc] text-[11px] rounded-[2px] border border-[#555]">Filter</button>
        </div>
        <div className="ml-auto pr-2"><button onClick={fetchData} className="text-[#999] hover:text-white"><RefreshCw size={13} /></button></div>
      </div>
      {/* Header */}
      <div className="flex bg-[color:var(--bg-surface-2)] border-b border-black/40 sticky top-0 z-10 select-none shrink-0">
        {cols.map(c => <div key={c.label} className={`${c.w} px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 shrink-0`}>{c.label}</div>)}
        <div className="w-[190px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] shrink-0">Actions</div>
      </div>
      {/* Body */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {data.map((row, idx) => (
          <div key={row.id || idx}
            onContextMenu={e => { e.preventDefault(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, row }); }}
            className={`flex border-b border-black/10 hover:bg-blue-600/10 transition-colors ${idx%2===0?'bg-[color:var(--bg-app)]':'bg-[color:var(--bg-surface-1)]'}`}>
            <div className="w-[60px] px-3 py-1 text-[12px] text-[#9cdcfe] font-semibold border-r border-black/10 shrink-0 flex items-center">{fmt(row.id)}</div>
            <div className="w-[90px] px-3 py-1 text-[12px] text-[color:var(--text-primary)] border-r border-black/10 shrink-0 flex items-center">{fmt(row.account_login)}</div>
            <div className="w-[80px] px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 flex items-center">{fmt(row.method_id)}</div>
            <div className="w-[100px] px-3 py-1 text-[12px] text-[#4ec9b0] font-semibold border-r border-black/10 shrink-0 flex items-center">{fmt(row.amount)}</div>
            <div className="w-[80px] px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 flex items-center">{fmt(row.currency)}</div>
            <div className="w-[100px] px-3 py-1 border-r border-black/10 shrink-0 flex items-center"><Badge status={row.status} /></div>
            <div className="w-[140px] px-3 py-1 text-[11px] text-[#888] font-mono border-r border-black/10 shrink-0 truncate flex items-center">{fmt(row.reference)}</div>
            <div className="w-[150px] px-3 py-1 text-[11px] text-[#888] font-mono border-r border-black/10 shrink-0 flex items-center">{fmtTs(row.created_at)}</div>
            <div className="flex-1 px-3 py-1 text-[11px] text-[#888] font-mono border-r border-black/10 flex items-center">{fmtTs(row.processed_at)}</div>
            <div className="w-[190px] px-2 py-1 flex items-center gap-1.5 shrink-0 overflow-visible">
              {row.status === 'pending' && <>
                <button onClick={() => handleApprove(row)} disabled={actionLoading === row.id} title="Approve"
                  className="flex items-center gap-1 h-[20px] px-2 bg-[#4ec9b0]/20 hover:bg-[#4ec9b0]/40 text-[#4ec9b0] text-[10px] rounded-[2px] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0">
                  <CheckCircle size={10} /> Approve
                </button>
                <button onClick={() => setRejectRow(row)} title="Reject"
                  className="flex items-center gap-1 h-[20px] px-2 bg-[#f48771]/20 hover:bg-[#f48771]/40 text-[#f48771] text-[10px] rounded-[2px] transition-colors whitespace-nowrap shrink-0">
                  <XCircle size={10} /> Reject
                </button>
              </>}
            </div>
          </div>
        ))}
        {loading && <div className="p-4 text-[color:var(--text-muted)] text-[12px] italic">Loading…</div>}
        {!loading && error && <div className="p-4 text-[#f48771] text-[12px] bg-[#f48771]/10 border-b border-[#f48771]/20">{error}</div>}
        {!loading && !error && data.length === 0 && <div className="p-4 text-[color:var(--text-muted)] text-[12px] italic">No deposit requests found.</div>}
        {[...Array(12)].map((_, i) => <div key={i} className={`flex border-b border-black/5 opacity-30 h-6 ${i%2===0?'bg-[color:var(--bg-app)]':'bg-[color:var(--bg-surface-1)]'}`}></div>)}
      </div>

      {contextMenu.visible && (
        <div className="fixed z-[9999] bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] shadow-2xl py-1 min-w-[160px] text-[12px] text-[color:var(--text-secondary)] rounded-[2px]"
          style={{ top: contextMenu.y, left: contextMenu.x }} onClick={e => e.stopPropagation()}>
          <div className="px-4 py-1 hover:bg-[color:var(--accent-500)] hover:text-white cursor-pointer" onClick={() => { setAddOpen(true); setContextMenu({ visible: false }); }}>New Deposit</div>
          {contextMenu.row?.status === 'pending' && <>
            <div className="h-px bg-[color:var(--border-default)] my-1 mx-2"></div>
            <div className="px-4 py-1 hover:bg-[#4ec9b0]/30 hover:text-[#4ec9b0] cursor-pointer" onClick={() => { handleApprove(contextMenu.row); setContextMenu({ visible: false }); }}>Approve</div>
            <div className="px-4 py-1 hover:bg-[#e51400] hover:text-white cursor-pointer text-red-400" onClick={() => { setRejectRow(contextMenu.row); setContextMenu({ visible: false }); }}>Reject</div>
          </>}
        </div>
      )}

      {addOpen && <AddDepositPopup onClose={() => setAddOpen(false)} onSaved={fetchData} />}
      {rejectRow && <RejectPopup deposit={rejectRow} onClose={() => setRejectRow(null)} onSaved={fetchData} />}

      <div className="h-6 bg-[color:var(--accent-500)] text-white flex items-center px-4 text-[11px] select-none shrink-0 border-t border-[color:var(--accent-700)]">
        <span>Total: {data.length}</span>
        {filterStatus && <span className="ml-4 opacity-70">Status: {filterStatus}</span>}
      </div>
    </div>
  );
};
export default DepositsView;
