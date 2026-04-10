import React, { useState, useEffect } from 'react';
import { AnalyticsService } from '../../services/analytics.service';
import { RefreshCw } from 'lucide-react';

const TABS = [
  { key: 'clv', label: 'Client Lifetime Value' },
  { key: 'churn', label: 'Churn Prediction' },
  { key: 'retention', label: 'Retention' },
  { key: 'deposits', label: 'Deposits' },
];

const fmt = (v) => typeof v === 'number' ? v.toFixed(2) : String(v ?? '—');

const ResultTable = ({ data }) => {
  if (!data) return <div className="flex items-center justify-center h-24 text-[#555] text-[11px]">Loading…</div>;
  if (Array.isArray(data)) {
    if (data.length === 0) return <div className="flex items-center justify-center h-24 text-[#555] text-[11px]">No data available.</div>;
    const cols = Object.keys(data[0]);
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center px-3 h-[24px] bg-[#252526] border-b border-black/30 shrink-0">
          {cols.map(c => <div key={c} className="min-w-[140px] text-[10px] font-semibold text-[#888] uppercase tracking-wider pr-3">{c}</div>)}
        </div>
        <div className="flex-1 overflow-auto">
          {data.map((row, i) => (
            <div key={i} className={`flex items-center px-3 h-[22px] border-b border-black/20 ${i % 2 === 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'} hover:bg-[#2a2d2e]`}>
              {cols.map(c => <div key={c} className="min-w-[140px] text-[11px] text-[#e1e1e1] pr-3 truncate font-mono">{fmt(row[c])}</div>)}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="p-4 max-w-[480px]">
      <div className="bg-[#252526] border border-[#3c3c3c] rounded-[3px] divide-y divide-black/30">
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

const AnalyticsClientView = () => {
  const [tab, setTab] = useState('clv');
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);

  const load = async (key) => {
    if (results[key]) return;
    setLoading(true);
    try {
      let res;
      if (key === 'clv') res = await AnalyticsService.getCLV();
      else if (key === 'churn') res = await AnalyticsService.getChurnPrediction();
      else if (key === 'retention') res = await AnalyticsService.getRetention();
      else if (key === 'deposits') res = await AnalyticsService.getDeposits();
      setResults(r => ({ ...r, [key]: res ?? [] }));
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    } finally { setLoading(false); }
  };

  const refresh = async () => {
    setResults(r => { const copy = { ...r }; delete copy[tab]; return copy; });
  };

  useEffect(() => { load(tab); }, [tab]);

  return (
    <div className="flex-1 bg-[#1e1e1e] flex flex-col overflow-hidden">
      {/* Tab Bar */}
      <div className="flex items-center bg-[#252526] border-b border-black/40 shrink-0">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 h-[30px] text-[11px] border-r border-black/30 transition-colors ${tab === t.key ? 'bg-[#1e1e1e] text-[#e1e1e1] border-t-2 border-t-[#007acc]' : 'text-[#888] hover:text-[#ccc]'}`}>
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={refresh} className="flex items-center gap-1.5 h-[24px] px-3 mr-2 bg-[#3c3c3c] hover:bg-[#4a4a4a] text-[#ccc] text-[11px] rounded-[2px]">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {loading
        ? <div className="flex items-center justify-center flex-1 text-[#888] text-[11px]">Loading…</div>
        : <ResultTable data={results[tab] ?? null} />}
    </div>
  );
};

export default AnalyticsClientView;
