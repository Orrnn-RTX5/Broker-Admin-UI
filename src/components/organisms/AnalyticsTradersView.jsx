import React, { useState } from 'react';
import { AnalyticsService } from '../../services/analytics.service';
import { RefreshCw } from 'lucide-react';
import { useCachedTabRequest } from '../../hooks/useCachedTabRequest';
import ActionableErrorState from '../atoms/ActionableErrorState';

const TAB_TOP = 'Top Traders';
const TAB_WORST = 'Worst Traders';
const TRADER_RANKING_LOADERS = {
  [TAB_TOP]: () => AnalyticsService.getTopTraders(),
  [TAB_WORST]: () => AnalyticsService.getWorstTraders(),
};

const fmt = (v) => typeof v === 'number' ? v.toFixed(2) : String(v ?? '—');
const pnlColor = (v) => (v > 0 ? 'text-[#4ec9b0]' : v < 0 ? 'text-[#f48771]' : 'text-[color:var(--text-primary)]');

const TradersTable = ({ data }) => {
  if (!data) return <div className="flex items-center justify-center h-24 text-[#555] text-[11px]">Loading…</div>;
  if (!Array.isArray(data) || data.length === 0) return <div className="flex items-center justify-center h-24 text-[#555] text-[11px]">No data available.</div>;
  const cols = Object.keys(data[0]);
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center px-3 h-[24px] bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0">
        {cols.map(c => <div key={c} className="min-w-[140px] text-[10px] font-semibold text-[#888] uppercase tracking-wider pr-3">{c}</div>)}
      </div>
      <div className="flex-1 overflow-auto">
        {data.map((row, i) => (
          <div key={i} className={`flex items-center px-3 h-[22px] border-b border-black/20 ${i % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-[#2a2d2e]`}>
            {cols.map(c => {
              const v = row[c];
              const isPnl = c.toLowerCase().includes('profit') || c.toLowerCase().includes('pnl');
              return (
                <div key={c} className={`min-w-[140px] text-[11px] pr-3 font-mono ${isPnl && typeof v === 'number' ? pnlColor(v) : 'text-[color:var(--text-primary)]'}`}>
                  {fmt(v)}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

const AnalyticsTradersView = () => {
  const [tab, setTab] = useState(TAB_TOP);
  const { data, loading, error, refresh } = useCachedTabRequest(tab, TRADER_RANKING_LOADERS, {
    fallback: 'Trader rankings failed to load.',
  });

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden">
      {/* Tab Bar */}
      <div className="flex items-center bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
        {[TAB_TOP, TAB_WORST].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 h-[30px] text-[11px] border-r border-black/30 transition-colors ${tab === t ? 'bg-[color:var(--bg-app)] text-[color:var(--text-primary)] border-t-2 border-t-[color:var(--accent-500)]' : 'text-[#888] hover:text-[#ccc]'}`}>
            {t}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={refresh} className="flex items-center gap-1.5 h-[24px] px-3 mr-2 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px]">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {loading
        ? <div className="flex items-center justify-center flex-1 text-[#888] text-[11px]">Loading…</div>
        : error
          ? <ActionableErrorState title="Unable to load data" message={error} actionLabel="Refresh" onAction={refresh} />
          : <TradersTable data={Array.isArray(data) ? data : []} />}
    </div>
  );
};

export default AnalyticsTradersView;
