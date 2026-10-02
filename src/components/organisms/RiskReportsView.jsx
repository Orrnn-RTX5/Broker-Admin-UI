import React, { useState } from 'react';
import { RiskManagementService } from '../../services/riskManagement.service';
import { Search } from 'lucide-react';

const TAB_PNL = 'Broker PnL';
const TAB_TOXIC = 'Toxic Flow';

const toUnix = (dateStr) => dateStr ? Math.floor(new Date(dateStr).getTime() / 1000) : '';
const fmt = (v) => (typeof v === 'number' ? v.toFixed(2) : '—');
const pnlColor = (v) => (v > 0 ? 'text-[color:var(--success-500)]' : v < 0 ? 'text-[color:var(--danger-500)]' : 'text-[color:var(--text-primary)]');

const today = () => new Date().toISOString().split('T')[0];
const monthAgo = () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; };

const RiskReportsView = () => {
  const [tab, setTab] = useState(TAB_PNL);
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [pnlData, setPnlData] = useState(null);
  const [toxicData, setToxicData] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleLoad = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      if (tab === TAB_PNL) {
        const res = await RiskManagementService.getBrokerPnL(toUnix(from), toUnix(to));
        setPnlData(res);
      } else {
        const res = await RiskManagementService.getToxicFlowReport(toUnix(from), toUnix(to));
        setToxicData(Array.isArray(res) ? res : []);
      }
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    } finally { setLoading(false); }
  };

  const DateBar = () => (
    <form onSubmit={handleLoad} className="flex items-center gap-2 px-3 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-white">From</span>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-white">To</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]" />
      </div>
      <button type="submit"
        className="flex items-center gap-1.5 h-[22px] px-3 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px]">
        <Search size={11} /> Load
      </button>
    </form>
  );

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden">
      {/* Tab Bar */}
      <div className="flex items-center bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
        {[TAB_PNL, TAB_TOXIC].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 h-[30px] text-[11px] border-r border-black/30 transition-colors ${tab === t ? 'bg-[color:var(--bg-app)] text-[color:var(--text-primary)] border-t-2 border-t-[color:var(--accent-500)]' : 'text-white hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      <DateBar />

      {loading && <div className="flex items-center justify-center flex-1 text-white text-[11px]">Loading…</div>}

      {/* Broker PnL */}
      {!loading && tab === TAB_PNL && (
        <div className="flex-1 overflow-auto p-6">
          {!pnlData ? (
            <div className="text-white text-[11px]">Select a date range and click Load</div>
          ) : (
            <div className="max-w-[400px] flex flex-col gap-3">
              <div className="text-[12px] font-semibold text-white mb-1">Broker PnL Report</div>
              <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--bg-surface-2)] rounded-[3px] divide-y divide-black/30">
                {[
                  ['Commission Revenue', pnlData.commission_revenue],
                  ['Swap Revenue', pnlData.swap_revenue],
                  ['B-Book Profit', pnlData.b_book_profit],
                ].map(([label, val]) => (
                  <div key={label} className="flex items-center px-4 h-[34px]">
                    <span className="text-[11px] text-white flex-1">{label}</span>
                    <span className={`text-[13px] font-mono font-semibold ${pnlColor(val)}`}>{fmt(val)}</span>
                  </div>
                ))}
                <div className="flex items-center px-4 h-[38px] bg-[color:var(--bg-app)]">
                  <span className="text-[11px] text-[color:var(--text-primary)] font-semibold flex-1">Total</span>
                  <span className={`text-[14px] font-mono font-bold ${pnlColor(pnlData.total)}`}>{fmt(pnlData.total)}</span>
                </div>
              </div>
              <div className="text-[10px] text-white">
                Period: {new Date(pnlData.from * 1000).toLocaleDateString()} — {new Date(pnlData.to * 1000).toLocaleDateString()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toxic Flow */}
      {!loading && tab === TAB_TOXIC && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center px-3 h-[24px] bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0">
            {[['Account','w-28'],['Total Deals','w-28'],['Winning','w-28'],['Total Profit','w-32'],['Win Rate %','w-28']].map(([l,w]) => (
              <div key={l} className={`${w} text-[10px] font-semibold text-white uppercase tracking-wider pr-3`}>{l}</div>
            ))}
          </div>
          <div className="flex-1 overflow-auto">
            {toxicData.length === 0
              ? <div className="flex items-center justify-center h-24 text-white text-[11px]">No toxic flow detected in range</div>
              : toxicData.map((row, i) => (
                <div key={row.account_login}
                  className={`flex items-center px-3 h-[22px] border-b border-black/20 select-none ${i % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-[#2a2d2e]`}>
                  <div className="w-28 text-[11px] text-white pr-3">{row.account_login}</div>
                  <div className="w-28 text-[11px] text-[color:var(--text-primary)] pr-3">{row.total_deals}</div>
                  <div className="w-28 text-[11px] text-white pr-3">{row.winning_deals}</div>
                  <div className={`w-32 text-[11px] pr-3 ${pnlColor(row.total_profit)}`}>{fmt(row.total_profit)}</div>
                  <div className={`w-28 text-[11px] font-semibold ${row.win_rate >= 80 ? 'text-[#ff3333]' : row.win_rate >= 70 ? 'text-[#f48771]' : 'text-[#d4a017]'}`}>
                    {fmt(row.win_rate)}%
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskReportsView;
