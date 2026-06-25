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

const NUMERIC_COLUMN_RE = /(avg|total|count|revenue|volume|balance|equity|margin|utilization|pnl|profit|loss|rate|amount|trades|orders)/i;
const INTEGER_COLUMN_RE = /(count|accounts|clients|trades|orders)$/i;

const isNumericColumn = (key, value) => (
  NUMERIC_COLUMN_RE.test(String(key)) ||
  typeof value === 'number'
);

const formatHeader = (key) => String(key)
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase());

const fmt = (key, value) => {
  if (value === undefined || value === null || value === '') return '-';

  if (isNumericColumn(key, value)) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      if (INTEGER_COLUMN_RE.test(String(key))) {
        return new Intl.NumberFormat().format(Math.round(numeric));
      }

      return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numeric);
    }
  }

  return String(value);
};

const getColumnWidth = (key) => {
  const normalized = String(key).toLowerCase();

  if (normalized === 'group' || normalized.includes('group')) return 'minmax(320px, 2fr)';
  if (normalized === 'symbol' || normalized.includes('symbol')) return 'minmax(160px, 1fr)';
  if (normalized.includes('utilization')) return '180px';
  if (normalized.includes('accounts_with_margin')) return '180px';
  if (normalized.includes('count') || normalized.includes('accounts')) return '150px';
  if (normalized.includes('volume') || normalized.includes('revenue')) return '150px';
  if (normalized.includes('equity') || normalized.includes('margin')) return '140px';
  if (normalized.includes('date') || normalized.includes('time')) return '170px';

  return isNumericColumn(key) ? '130px' : 'minmax(160px, 1fr)';
};

const getCellAlignment = (key, value) => (
  isNumericColumn(key, value) ? 'text-right tabular-nums' : 'text-left'
);

const ResultTable = ({ data }) => {
  if (!data) {
    return <div className="flex items-center justify-center h-24 text-[#555] text-[11px]">Loading...</div>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <div className="flex items-center justify-center h-24 text-[#555] text-[11px]">No data available.</div>;
    }

    const cols = Object.keys(data[0]);
    const gridTemplateColumns = cols.map(getColumnWidth).join(' ');

    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          <div
            className="grid sticky top-0 z-10 min-w-max h-[28px] bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0"
            style={{ gridTemplateColumns }}
          >
            {cols.map((column) => (
              <div
                key={column}
                className={`flex items-center px-3 text-[10px] font-semibold text-[#888] uppercase tracking-wider border-r border-black/20 last:border-r-0 ${getCellAlignment(column)}`}
                title={String(column)}
              >
                <span className="truncate w-full">{formatHeader(column)}</span>
              </div>
            ))}
          </div>

          {data.map((row, index) => (
            <div
              key={index}
              className={`grid min-w-max min-h-[26px] border-b border-black/20 ${index % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-[#2a2d2e]`}
              style={{ gridTemplateColumns }}
            >
              {cols.map((column) => {
                const value = fmt(column, row[column]);

                return (
                  <div
                    key={column}
                    className={`flex items-center px-3 text-[11px] text-[color:var(--text-primary)] font-mono border-r border-black/10 last:border-r-0 min-w-0 ${getCellAlignment(column, row[column])}`}
                    title={value}
                  >
                    <span className="truncate w-full">{value}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-[480px]">
      <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--bg-surface-2)] rounded-[3px] divide-y divide-black/30">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="flex items-center px-4 h-[32px]">
            <span className="text-[11px] text-[#888] flex-1">{formatHeader(key)}</span>
            <span className="text-[12px] font-mono text-[#9cdcfe]">{fmt(key, value)}</span>
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
      setResults((current) => ({ ...current, [key]: res ?? [] }));
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    setResults((current) => {
      const copy = { ...current };
      delete copy[tab];
      return copy;
    });
  };

  useEffect(() => { load(tab); }, [tab]);

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden">
      <div className="flex items-center bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0 overflow-x-auto">
        {TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`px-4 h-[30px] text-[11px] border-r border-black/30 whitespace-nowrap transition-colors ${tab === item.key ? 'bg-[color:var(--bg-app)] text-[color:var(--text-primary)] border-t-2 border-t-[color:var(--accent-500)]' : 'text-[#888] hover:text-[#ccc]'}`}
          >
            {item.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 h-[24px] px-3 mr-2 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px] shrink-0"
        >
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1 text-[#888] text-[11px]">Loading...</div>
      ) : (
        <ResultTable data={results[tab] ?? null} />
      )}
    </div>
  );
};

export default AnalyticsTradingView;
