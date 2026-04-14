import React, { useState, useEffect } from 'react';
import { AnalyticsService } from '../../services/analytics.service';
import { RefreshCw } from 'lucide-react';

const TABS = [
  { key: 'pnl', label: 'PnL' },
  { key: 'volume', label: 'Volume' },
  { key: 'patterns', label: 'Trading Patterns' },
  { key: 'margin', label: 'Margin Utilization' },
  { key: 'groups', label: 'Group Stats' },
  { key: 'symbols', label: 'Symbol Stats' },
];

const fmt = (v) => typeof v === 'number' ? v.toFixed(2) : String(v ?? '—');

const ResultTable = ({ data }) => {
  if (!data) return <div className="flex items-center justify-center h-24 text-[#555] text-[11px]">Loading…</div>;
  if (Array.isArray(data)) {
    if (data.length === 0) return <div className="flex items-center justify-center h-24 text-[#555] text-[11px]">No data available.</div>;
    const cols = Object.keys(data[0]);
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center px-3 h-[24px] bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0">
          {cols.map(c => <div key={c} className="min-w-[140px] text-[10px] font-semibold text-[#888] uppercase tracking-wider pr-3">{c}</div>)}
        </div>
        <div className="flex-1 overflow-auto">
          {data.map((row, i) => (
            <div key={i} className={`flex items-center px-3 h-[22px] border-b border-black/20 ${i % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-[#2a2d2e]`}>
              {cols.map(c => <div key={c} className="min-w-[140px] text-[11px] text-[color:var(--text-primary)] pr-3 truncate font-mono">{fmt(row[c])}</div>)}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="p-4 max-w-[480px]">
      <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--bg-surface-2)] rounded-[3px] divide-y divide-black/30">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="flex items-center px-4 h-[32px]">
            <span className="text-[11px] text-[#888] flex-1">{k}</span>
            <span className="text-[12px] font-mono text-[#9cdcfe]">{fmt(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const AnalyticsTradingView = () => {
  const [tab, setTab] = useState('pnl');
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);

  const load = async (key) => {
    if (results[key]) return;
    setLoading(true);
    try {
      let res;
      if (key === 'pnl') res = await AnalyticsService.getPnL();
      else if (key === 'volume') res = await AnalyticsService.getVolume();
      else if (key === 'patterns') res = await AnalyticsService.getTradingPatterns();
      else if (key === 'margin') res = await AnalyticsService.getMarginUtilization();
      else if (key === 'groups') res = await AnalyticsService.getGroupStats();
      else if (key === 'symbols') res = await AnalyticsService.getSymbolStats();
      setResults(r => ({ ...r, [key]: res ?? [] }));
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    } finally { setLoading(false); }
  };

  const refresh = () => {
    setResults(r => { const copy = { ...r }; delete copy[tab]; return copy; });
  };

  useEffect(() => { load(tab); }, [tab]);

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden">
      {/* Tab Bar */}
      <div className="flex items-center bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 h-[30px] text-[11px] border-r border-black/30 whitespace-nowrap transition-colors ${tab === t.key ? 'bg-[color:var(--bg-app)] text-[color:var(--text-primary)] border-t-2 border-t-[color:var(--accent-500)]' : 'text-[#888] hover:text-[#ccc]'}`}>
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={refresh} className="flex items-center gap-1.5 h-[24px] px-3 mr-2 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px] shrink-0">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {loading
        ? <div className="flex items-center justify-center flex-1 text-[#888] text-[11px]">Loading…</div>
        : <ResultTable data={results[tab] ?? null} />}
    </div>
  );
};

export default AnalyticsTradingView;
