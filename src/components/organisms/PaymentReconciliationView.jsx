import React, { useState, useEffect } from 'react';
import { PaymentService } from '../../services/payment.service';
import { RefreshCw, Play, Link } from 'lucide-react';

const fmt = (v) => (v == null ? '—' : v);
const fmtTs = (v) => { if (!v) return '—'; try { return new Date(v * 1000).toLocaleString(); } catch { return v; } };

// ── Run Reconciliation Tab ─────────────────────────────────────────────────
const RunTab = () => {
  const [form, setForm] = useState({ gateway_id: '', date: '' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const inp = "w-full bg-[color:var(--bg-surface-2)] border border-[#555] text-[color:var(--text-primary)] text-[12px] px-2 py-1.5 rounded-[2px] focus:outline-none focus:border-[color:var(--accent-500)]";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.gateway_id || !form.date) { setError('Gateway ID and Date are required.'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await PaymentService.runReconciliation(parseInt(form.gateway_id), form.date);
      setResult(res);
    } catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col p-6 gap-4 max-w-[480px]">
      <div className="text-[11px] text-[#888]">Run reconciliation for a specific gateway on a given date.</div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-[#888] uppercase tracking-wider">Gateway ID<span className="text-[#f48771] ml-0.5">*</span></label>
            <input className={inp} type="number" value={form.gateway_id} onChange={e => set('gateway_id', e.target.value)} placeholder="1" />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-[#888] uppercase tracking-wider">Date<span className="text-[#f48771] ml-0.5">*</span></label>
            <input className={inp} type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
        </div>
        {error && <div className="text-[11px] text-[#f48771] bg-[color:var(--bg-surface-2)] px-3 py-1.5 rounded-[2px]">{error}</div>}
        {result && (
          <div className="bg-[#1e3a2e] border border-[#4ec9b0]/30 rounded-[2px] px-4 py-3 space-y-1.5">
            <div className="text-[10px] text-[#4ec9b0] font-semibold uppercase mb-2">Reconciliation Complete</div>
            {[['ID', result.id], ['Gateway ID', result.gateway_id], ['Date', result.date], ['Total Count', result.total_count], ['Total Amount', result.total_amount], ['Status', result.status]].map(([k, v]) => (
              <div key={k} className="flex items-center gap-3">
                <span className="text-[10px] text-[#555] w-28 shrink-0">{k}</span>
                <span className="text-[11px] text-[color:var(--text-primary)] font-mono">{fmt(v)}</span>
              </div>
            ))}
          </div>
        )}
        <button type="submit" disabled={loading}
          className="flex items-center justify-center gap-1.5 h-[28px] px-4 text-[11px] bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] disabled:opacity-50 text-white rounded-[2px]">
          <Play size={11} /> {loading ? 'Running…' : 'Run Reconciliation'}
        </button>
      </form>
    </div>
  );
};

// ── Reconciliation List Tab ────────────────────────────────────────────────
const ListTab = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [matchPopup, setMatchPopup] = useState(null);

  const fetchData = async (matched) => {
    setLoading(true);
    try {
      const res = await PaymentService.getReconciliationList(matched !== '' ? matched === 'true' : undefined);
      setData(Array.isArray(res) ? res : res?.data ?? []);
    } catch (err) { console.error(err); setData([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(''); }, []);

  const handleApplyFilter = () => fetchData(filter);

  const MatchPopup = ({ row, onClose, onSaved }) => {
    const [depositId, setDepositId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!depositId) { setError('Deposit ID is required.'); return; }
      setLoading(true);
      try { await PaymentService.matchReconciliation(row.id, parseInt(depositId)); onSaved(); onClose(); }
      catch (err) { setError(err.response?.data?.message || err.message); }
      finally { setLoading(false); }
    };
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={onClose}>
        <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-[3px] shadow-2xl w-[320px]" onClick={e => e.stopPropagation()}>
          <div className="flex items-center h-9 px-4 border-b border-black/40 bg-[color:var(--bg-surface-1)]">
            <span className="text-[12px] font-semibold text-[color:var(--text-primary)] flex-1">Match Record #{row.id}</span>
          </div>
          <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
            <div className="text-[11px] text-[#888]">Link reconciliation record to a deposit request.</div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] text-[#888] uppercase">Deposit ID<span className="text-[#f48771] ml-0.5">*</span></label>
              <input value={depositId} onChange={e => setDepositId(e.target.value)} type="number"
                className="w-full bg-[color:var(--bg-surface-2)] border border-[#555] text-[color:var(--text-primary)] text-[12px] px-2 py-1 rounded-[2px] focus:outline-none focus:border-[color:var(--accent-500)]" />
            </div>
            {error && <div className="text-[11px] text-[#f48771] bg-[color:var(--bg-surface-2)] px-3 py-1.5 rounded-[2px]">{error}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="h-[26px] px-4 text-[11px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--border-strong)] text-[#ccc] rounded-[2px]">Cancel</button>
              <button type="submit" disabled={loading} className="h-[26px] px-4 text-[11px] bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] disabled:opacity-50 text-white rounded-[2px]">{loading ? 'Matching…' : 'Match'}</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0">
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="h-[22px] bg-[color:var(--bg-surface-2)] border border-[#555] text-[#ccc] text-[11px] px-2 rounded-[2px]">
          <option value="">All records</option>
          <option value="true">Matched only</option>
          <option value="false">Unmatched only</option>
        </select>
        <button onClick={handleApplyFilter} className="h-[22px] px-2.5 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--border-strong)] text-[#ccc] text-[11px] rounded-[2px] border border-[#555]">Filter</button>
        <button onClick={() => fetchData(filter)} className="ml-auto text-[#999] hover:text-white"><RefreshCw size={13} /></button>
      </div>
      <div className="flex bg-[color:var(--bg-surface-2)] border-b border-black/40 select-none shrink-0">
        {[['ID','w-[60px]'],['Deposit ID','w-[90px]'],['Gateway Ref','w-[150px]'],['GW Amount','w-[110px]'],['Internal Amount','w-[120px]'],['Matched','w-[90px]'],['Reconciled At','flex-1']].map(([l,w]) =>
          <div key={l} className={`${w} px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 shrink-0`}>{l}</div>
        )}
        <div className="w-[80px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] shrink-0">Action</div>
      </div>
      <div className="flex-1 overflow-auto no-scrollbar">
        {data.map((row, idx) => (
          <div key={row.id || idx} className={`flex border-b border-black/10 hover:bg-blue-600/10 ${idx%2===0?'bg-[color:var(--bg-app)]':'bg-[color:var(--bg-surface-1)]'}`}>
            <div className="w-[60px] px-3 py-1 text-[12px] text-[#9cdcfe] font-semibold border-r border-black/10 shrink-0 flex items-center">{fmt(row.id)}</div>
            <div className="w-[90px] px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 flex items-center">{fmt(row.deposit_id)}</div>
            <div className="w-[150px] px-3 py-1 text-[11px] text-[#888] font-mono border-r border-black/10 shrink-0 truncate flex items-center">{fmt(row.gateway_ref)}</div>
            <div className="w-[110px] px-3 py-1 text-[12px] text-[#4ec9b0] font-semibold border-r border-black/10 shrink-0 flex items-center">{fmt(row.gateway_amount)}</div>
            <div className="w-[120px] px-3 py-1 text-[12px] text-[#4ec9b0] font-semibold border-r border-black/10 shrink-0 flex items-center">{fmt(row.internal_amount)}</div>
            <div className="w-[90px] px-3 py-1 border-r border-black/10 shrink-0 flex items-center">
              <span className={`text-[11px] font-semibold ${row.matched ? 'text-[#4ec9b0]' : 'text-[#f4c96e]'}`}>{row.matched ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex-1 px-3 py-1 text-[11px] text-[#888] font-mono border-r border-black/10 flex items-center">{fmtTs(row.reconciled_at)}</div>
            <div className="w-[80px] px-2 py-1 flex items-center shrink-0">
              {!row.matched && (
                <button onClick={() => setMatchPopup(row)}
                  className="flex items-center gap-1 h-[20px] px-2 bg-[color:var(--accent-500)]/20 hover:bg-[color:var(--accent-500)]/40 text-[color:var(--accent-500)] text-[10px] rounded-[2px]">
                  <Link size={9} /> Match
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="p-4 text-[color:var(--text-muted)] text-[12px] italic">Loading…</div>}
        {!loading && data.length === 0 && <div className="p-4 text-[color:var(--text-muted)] text-[12px] italic">No reconciliation records.</div>}
      </div>
      {matchPopup && <MatchPopup row={matchPopup} onClose={() => setMatchPopup(null)} onSaved={() => fetchData(filter)} />}
    </div>
  );
};

// ── Main View ──────────────────────────────────────────────────────────────
const TABS = ['Run Reconciliation', 'Records'];

const PaymentReconciliationView = () => {
  const [tab, setTab] = useState('Run Reconciliation');
  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden">
      <div className="flex bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0 select-none">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 h-[30px] text-[11px] border-r border-black/30 transition-colors ${tab === t ? 'bg-[color:var(--bg-app)] text-white border-t-2 border-t-[color:var(--accent-500)]' : 'text-[#888] hover:text-[#ccc] hover:bg-[color:var(--bg-surface-1)]'}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto flex flex-col">
        {tab === 'Run Reconciliation' && <RunTab />}
        {tab === 'Records' && <ListTab />}
      </div>
    </div>
  );
};
export default PaymentReconciliationView;
