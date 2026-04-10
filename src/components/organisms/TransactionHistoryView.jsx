import React, { useState, useEffect } from 'react';
import { PaymentService } from '../../services/payment.service';
import { RefreshCw, Settings } from 'lucide-react';

const fmt = (v) => (v == null ? '—' : v);
const fmtTs = (v) => { if (!v) return '—'; try { return new Date(v * 1000).toLocaleString(); } catch { return v; } };

const TYPE_COLORS = { deposit: 'text-[#4ec9b0]', withdraw: 'text-[#f48771]', credit: 'text-[#9cdcfe]', bonus: 'text-[#f4c96e]' };

const TransactionHistoryView = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterLogin, setFilterLogin] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterLimit, setFilterLimit] = useState('200');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { limit: parseInt(filterLimit) || 200 };
      if (filterLogin) params.login = parseInt(filterLogin);
      if (filterType) params.type = filterType;
      const res = await PaymentService.getTransactionHistory(params);
      setData(Array.isArray(res) ? res : res?.data ?? []);
    } catch (err) { console.error(err); setData([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const cols = [
    { label: 'ID', w: 'w-[70px]' }, { label: 'Login', w: 'w-[90px]' },
    { label: 'Type', w: 'w-[100px]' }, { label: 'Amount', w: 'w-[120px]' },
    { label: 'Comment', w: 'flex-1' }, { label: 'Time', w: 'w-[170px]' },
  ];

  return (
    <div className="flex-1 bg-[#1e1e1e] flex flex-col overflow-hidden relative" onContextMenu={e => e.preventDefault()}>
      <div className="flex items-center gap-2 px-2 py-1.5 bg-[#252526] border-b border-black/40 shrink-0 select-none">
        <span className="text-[11px] text-[#888] uppercase tracking-wider">Filters:</span>
        <input value={filterLogin} onChange={e => setFilterLogin(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchData()}
          placeholder="login…" className="h-[22px] w-[90px] bg-[#3c3c3c] border border-[#555] text-[#e1e1e1] text-[11px] px-2 rounded-[2px] focus:outline-none focus:border-[#007acc]" />
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="h-[22px] bg-[#3c3c3c] border border-[#555] text-[#ccc] text-[11px] px-2 rounded-[2px] focus:outline-none">
          <option value="">All types</option>
          {['deposit','withdraw','credit','bonus'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[#888]">Limit:</span>
          <select value={filterLimit} onChange={e => setFilterLimit(e.target.value)}
            className="h-[22px] bg-[#3c3c3c] border border-[#555] text-[#ccc] text-[11px] px-2 rounded-[2px]">
            {['50','100','200','500','1000'].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <button onClick={fetchData} className="h-[22px] px-2.5 bg-[#3c3c3c] hover:bg-[#505050] text-[#ccc] text-[11px] rounded-[2px] border border-[#555]">Apply</button>
        <div className="ml-auto flex items-center gap-2 pr-2">
          <button onClick={fetchData} className="text-[#999] hover:text-white"><RefreshCw size={13} /></button>
          <Settings size={14} className="text-[#999] hover:text-white cursor-pointer" />
        </div>
      </div>

      <div className="flex bg-[#333333] border-b border-black/40 sticky top-0 z-10 select-none shrink-0">
        {cols.map(c => <div key={c.label} className={`${c.w} px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0`}>{c.label}</div>)}
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        {data.map((row, idx) => (
          <div key={row.id || idx} className={`flex border-b border-black/10 hover:bg-blue-600/10 transition-colors ${idx%2===0?'bg-[#1e1e1e]':'bg-[#252526]'}`}>
            <div className="w-[70px] px-3 py-1 text-[12px] text-[#9cdcfe] font-semibold border-r border-black/10 shrink-0 flex items-center">{fmt(row.id)}</div>
            <div className="w-[90px] px-3 py-1 text-[12px] text-[#e1e1e1] border-r border-black/10 shrink-0 flex items-center">{fmt(row.account_login)}</div>
            <div className="w-[100px] px-3 py-1 border-r border-black/10 shrink-0 flex items-center">
              <span className={`text-[11px] font-semibold ${TYPE_COLORS[row.type] || 'text-[#aaa]'}`}>{fmt(row.type)}</span>
            </div>
            <div className={`w-[120px] px-3 py-1 text-[12px] font-semibold border-r border-black/10 shrink-0 flex items-center ${row.type === 'withdraw' ? 'text-[#f48771]' : 'text-[#4ec9b0]'}`}>
              {row.type === 'withdraw' ? '-' : '+'}{fmt(row.amount)}
            </div>
            <div className="flex-1 px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 truncate flex items-center">{fmt(row.comment)}</div>
            <div className="w-[170px] px-3 py-1 text-[11px] text-[#888] font-mono flex items-center">{fmtTs(row.time)}</div>
          </div>
        ))}
        {loading && <div className="p-4 text-[#aaaaaa] text-[12px] italic">Loading…</div>}
        {!loading && data.length === 0 && <div className="p-4 text-[#aaaaaa] text-[12px] italic">No transactions found.</div>}
        {[...Array(12)].map((_, i) => <div key={i} className={`flex border-b border-black/5 opacity-30 h-6 ${i%2===0?'bg-[#1e1e1e]':'bg-[#252526]'}`}></div>)}
      </div>

      <div className="h-6 bg-[#007acc] text-white flex items-center px-4 text-[11px] select-none shrink-0 border-t border-[#005a9e]">
        <span>Records: {data.length}</span>
        {filterLogin && <span className="ml-4 opacity-70">Login: {filterLogin}</span>}
        {filterType && <span className="ml-4 opacity-70">Type: {filterType}</span>}
      </div>
    </div>
  );
};
export default TransactionHistoryView;
