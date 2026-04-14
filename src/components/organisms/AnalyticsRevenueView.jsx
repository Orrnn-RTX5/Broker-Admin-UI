import React, { useState, useEffect } from 'react';
import { AnalyticsService } from '../../services/analytics.service';
import { RefreshCw } from 'lucide-react';

const fmt = (v) => typeof v === 'number' ? v.toFixed(2) : String(v ?? '—');
const pnlColor = (v) => (v > 0 ? 'text-[#4ec9b0]' : v < 0 ? 'text-[#f48771]' : 'text-[color:var(--text-primary)]');

const AnalyticsRevenueView = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await AnalyticsService.getRevenueForecast();
      setData(res);
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const renderData = () => {
    if (!data) return <div className="text-[#555] text-[11px]">No forecast data available.</div>;
    if (Array.isArray(data)) {
      if (data.length === 0) return <div className="text-[#555] text-[11px]">No forecast data available.</div>;
      const cols = Object.keys(data[0]);
      return (
        <div className="flex flex-col overflow-hidden">
          <div className="flex items-center px-3 h-[24px] bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0">
            {cols.map(c => <div key={c} className="min-w-[140px] text-[10px] font-semibold text-[#888] uppercase tracking-wider pr-3">{c}</div>)}
          </div>
          <div className="overflow-auto">
            {data.map((row, i) => (
              <div key={i} className={`flex items-center px-3 h-[22px] border-b border-black/20 ${i % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-[#2a2d2e]`}>
                {cols.map(c => {
                  const v = row[c];
                  const isRevenue = c.toLowerCase().includes('revenue') || c.toLowerCase().includes('forecast');
                  return <div key={c} className={`min-w-[140px] text-[11px] pr-3 font-mono ${isRevenue && typeof v === 'number' ? pnlColor(v) : 'text-[color:var(--text-primary)]'}`}>{fmt(v)}</div>;
                })}
              </div>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="max-w-[420px]">
        <div className="text-[12px] font-semibold text-[#9cdcfe] mb-3">Revenue Forecast</div>
        <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--bg-surface-2)] rounded-[3px] divide-y divide-black/30">
          {Object.entries(data).map(([k, v]) => (
            <div key={k} className="flex items-center px-4 h-[34px]">
              <span className="text-[11px] text-[#888] flex-1">{k}</span>
              <span className={`text-[13px] font-mono font-semibold ${typeof v === 'number' ? pnlColor(v) : 'text-[color:var(--text-primary)]'}`}>{fmt(v)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-3 h-[30px] bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
        <span className="text-[11px] font-semibold text-[#9cdcfe] flex-1">Revenue Forecast Analytics</span>
        <button onClick={load} className="flex items-center gap-1.5 h-[22px] px-3 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px]">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading
          ? <div className="text-[#888] text-[11px]">Loading…</div>
          : renderData()}
      </div>
    </div>
  );
};

export default AnalyticsRevenueView;
