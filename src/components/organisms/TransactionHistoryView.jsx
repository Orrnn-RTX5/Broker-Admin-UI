import React, { useCallback, useState, useEffect } from 'react';
import { PaymentService } from '../../services/payment.service';
import { RefreshCw } from 'lucide-react';
import { getApiErrorMessage } from '../../utils/apiShapes';

const fmt = (v) => (v == null ? '—' : v);
const fmtTs = (v) => { if (!v) return '—'; try { return new Date(v * 1000).toLocaleString(); } catch { return v; } };

const TYPE_COLORS = { deposit: 'text-white', withdraw: 'text-[#f48771]', credit: 'text-white', bonus: 'text-[#f4c96e]' };

const TransactionHistoryView = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterLogin, setFilterLogin] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterLimit, setFilterLimit] = useState('200');

  const loadTransactions = useCallback(async ({ login, type, limit }) => {
    setLoading(true);
    setError('');
    try {
      const params = { limit: parseInt(limit) || 200 };
      if (login) params.login = parseInt(login);
      if (type) params.type = type;
      const res = await PaymentService.getTransactionHistory(params);
      setData(Array.isArray(res) ? res : res?.data ?? []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load transactions.'));
      setData([]);
    }
    finally { setLoading(false); }
  }, []);

  const fetchData = useCallback(() => {
    return loadTransactions({ login: filterLogin, type: filterType, limit: filterLimit });
  }, [filterLimit, filterLogin, filterType, loadTransactions]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      loadTransactions({ login: '', type: '', limit: '200' });
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [loadTransactions]);

  const cols = [
    { label: 'ID', w: 'w-[70px]' }, { label: 'Login', w: 'w-[90px]' },
    { label: 'Type', w: 'w-[100px]' }, { label: 'Amount', w: 'w-[120px]' },
    { label: 'Comment', w: 'flex-1' }, { label: 'Time', w: 'w-[170px]' },
  ];

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden relative" onContextMenu={e => e.preventDefault()}>
      <div className="flex items-center gap-2 px-2 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0 select-none">
        <span className="text-[11px] text-white uppercase tracking-wider">Filters:</span>
        <input aria-label="Filter transactions by login" value={filterLogin} onChange={e => setFilterLogin(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchData()}
          placeholder="login…" className="h-[22px] w-[90px] bg-[color:var(--bg-surface-2)] border border-[#555] text-[color:var(--text-primary)] text-[11px] px-2 rounded-[2px] focus:outline-none focus:border-[color:var(--accent-500)]" />
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="h-[22px] bg-[color:var(--bg-surface-2)] border border-[#555] text-white text-[11px] px-2 rounded-[2px] focus:outline-none">
          <option value="">All types</option>
          {['deposit','withdraw','credit','bonus'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-white">Limit:</span>
          <select value={filterLimit} onChange={e => setFilterLimit(e.target.value)}
            className="h-[22px] bg-[color:var(--bg-surface-2)] border border-[#555] text-white text-[11px] px-2 rounded-[2px]">
            {['50','100','200','500','1000'].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <button onClick={fetchData} className="h-[22px] px-2.5 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--border-strong)] text-white text-[11px] rounded-[2px] border border-[#555]">Apply</button>
        <div className="ml-auto flex items-center gap-2 pr-2">
          <button onClick={fetchData} aria-label="Refresh transactions" title="Refresh transactions" className="text-white hover:text-white"><RefreshCw size={13} /></button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="w-max min-w-full">
      <div className="flex w-full bg-[color:var(--bg-surface-2)] border-b border-black/40 sticky top-0 z-10 select-none shrink-0">
        {cols.map(c => <div key={c.label} className={`${c.w} px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 shrink-0 ${c.label === 'Amount' ? 'text-right tabular-nums' : ''}`}>{c.label}</div>)}
      </div>

        {data.map((row, idx) => (
          <div key={row.id || idx} className={`flex w-full border-b border-black/10 hover:bg-blue-600/10 transition-colors ${idx%2===0?'bg-[color:var(--bg-app)]':'bg-[color:var(--bg-surface-1)]'}`}>
            <div className="w-[70px] px-3 py-1 text-[12px] text-white font-semibold border-r border-black/10 shrink-0 flex items-center">{fmt(row.id)}</div>
            <div className="w-[90px] px-3 py-1 text-[12px] text-[color:var(--text-primary)] border-r border-black/10 shrink-0 flex items-center">{fmt(row.account_login)}</div>
            <div className="w-[100px] px-3 py-1 border-r border-black/10 shrink-0 flex items-center">
              <span className={`text-[11px] font-semibold ${TYPE_COLORS[row.type] || 'text-white'}`}>{fmt(row.type)}</span>
            </div>
            <div title={String(row.amount ?? '')} className={`w-[120px] px-3 py-1 text-[12px] font-semibold border-r border-black/10 shrink-0 flex items-center justify-end tabular-nums ${row.type === 'withdraw' ? 'text-[#f48771]' : 'text-white'}`}>
              {row.type === 'withdraw' ? '-' : '+'}{fmt(row.amount)}
            </div>
            <div title={String(row.comment ?? '')} className="flex-1 px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 truncate flex items-center">{fmt(row.comment)}</div>
            <div className="w-[170px] px-3 py-1 text-[11px] text-white font-mono flex items-center">{fmtTs(row.time)}</div>
          </div>
        ))}
        {loading && <div role="status" className="m-4 w-fit rounded-[4px] border border-[color:var(--border-default)] bg-[color:var(--bg-surface-1)] px-4 py-3 text-[12px] text-[color:var(--text-secondary)]">Loading transactions...</div>}
        {!loading && error && <div role="alert" className="m-4 w-fit rounded-[4px] border border-[color:var(--danger-500)]/30 bg-[color:var(--danger-500)]/10 px-4 py-3 text-[12px] text-[color:var(--danger-500)]">{error}</div>}
        {!loading && !error && data.length === 0 && <div role="status" className="m-4 w-fit rounded-[4px] border border-[color:var(--border-default)] bg-[color:var(--bg-surface-1)] px-4 py-3 text-[12px] text-[color:var(--text-secondary)]">No transactions found.</div>}
        </div>
      </div>

      <div className="h-7 border-t border-[color:var(--border-default)] bg-[color:var(--bg-surface-1)] text-[color:var(--text-secondary)] flex items-center px-4 text-[11px] select-none shrink-0">
        <span>Records: <strong className="tabular-nums text-[color:var(--text-primary)]">{data.length}</strong></span>
        {filterLogin && <span className="ml-4">Login: {filterLogin}</span>}
        {filterType && <span className="ml-4">Type: {filterType}</span>}
      </div>
    </div>
  );
};
export default TransactionHistoryView;
