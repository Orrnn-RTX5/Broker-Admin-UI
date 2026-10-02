import React, { useState } from 'react';
import { AnalyticsService } from '../../services/analytics.service';
import { RefreshCw } from 'lucide-react';
import { useCachedTabRequest } from '../../hooks/useCachedTabRequest';
import ActionableErrorState from '../atoms/ActionableErrorState';

const TABS = [
  { key: 'pnl', label: 'PnL' },
  { key: 'volume', label: 'Volume' },
  { key: 'patterns', label: 'Trading Patterns' },
  { key: 'margin', label: 'Margin Utilization' },
  { key: 'groups', label: 'Group Stats' },
  { key: 'symbols', label: 'Symbol Stats' },
];

const TRADING_ANALYTICS_LOADERS = {
  pnl: () => AnalyticsService.getPnL(),
  volume: () => AnalyticsService.getVolume(),
  patterns: () => AnalyticsService.getTradingPatterns(),
  margin: () => AnalyticsService.getMarginUtilization(),
  groups: () => AnalyticsService.getGroupStats(),
  symbols: () => AnalyticsService.getSymbolStats(),
};

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

const getPnlTone = (key, value, tab) => {
  const neutral = 'text-[color:var(--text-primary)]';
  if (tab !== 'pnl' || value == null || value === '') return neutral;
  const name = String(key).toLowerCase();
  if (!/(pnl|profit|revenue|gain|loss)/.test(name) || /(count|rate|percent|trades|orders|volume|balance)/.test(name)) return neutral;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) return neutral;
  if (name.includes('loss')) return 'text-[color:var(--market-loss)]';
  return numeric > 0
    ? 'text-[color:var(--market-profit)]'
    : 'text-[color:var(--market-loss)]';
};

const ResultTable = ({ data, tab }) => {
  if (!data) {
    return <div className="flex items-center justify-center h-24 text-[color:var(--text-muted)] text-[11px]">Loading...</div>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <div className="flex items-center justify-center h-24 text-[color:var(--text-muted)] text-[11px]">No data available.</div>;
    }

    const cols = Object.keys(data[0]);
    const gridTemplateColumns = cols.map(getColumnWidth).join(' ');

    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          <div
            className="grid sticky top-0 z-10 min-w-max h-[28px] bg-[color:var(--bg-surface-1)] border-b border-[color:var(--border-default)] shrink-0"
            style={{ gridTemplateColumns }}
          >
            {cols.map((column) => (
              <div
                key={column}
                className={`flex items-center px-3 text-[10px] font-semibold text-[color:var(--text-muted)] uppercase tracking-wider border-r border-[color:var(--border-subtle)] last:border-r-0 ${getCellAlignment(column)}`}
                title={String(column)}
              >
                <span className="truncate w-full">{formatHeader(column)}</span>
              </div>
            ))}
          </div>

          {data.map((row, index) => (
            <div
              key={index}
              className={`grid min-w-max min-h-[26px] border-b border-[color:var(--border-subtle)] ${index % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-[color:var(--bg-surface-2)]`}
              style={{ gridTemplateColumns }}
            >
              {cols.map((column) => {
                const value = fmt(column, row[column]);

                return (
                  <div
                    key={column}
                    className={`flex items-center px-3 text-[11px] ${getPnlTone(column, row[column], tab)} font-mono border-r border-[color:var(--border-subtle)] last:border-r-0 min-w-0 ${getCellAlignment(column, row[column])}`}
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
      <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-[3px] divide-y divide-[color:var(--border-default)]">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="flex items-center px-4 h-[32px]">
            <span className="text-[11px] text-[color:var(--text-muted)] flex-1">{formatHeader(key)}</span>
            <span className={`text-[12px] font-mono ${getPnlTone(key, value, tab)}`}>{fmt(key, value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const AnalyticsTradingView = () => {
  const [tab, setTab] = useState('pnl');
  const { data, loading, error, refresh } = useCachedTabRequest(tab, TRADING_ANALYTICS_LOADERS, {
    fallback: 'Trading analytics failed to load.',
  });

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden">
      <div className="flex items-center bg-[color:var(--bg-surface-1)] border-b border-[color:var(--border-default)] shrink-0 overflow-x-auto">
        {TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`px-4 h-[30px] text-[11px] border-r border-[color:var(--border-subtle)] whitespace-nowrap transition-colors ${tab === item.key ? 'bg-[color:var(--bg-app)] text-[color:var(--text-primary)] border-t-2 border-t-[color:var(--accent-500)]' : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]'}`}
          >
            {item.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 h-[24px] px-3 mr-2 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[color:var(--text-secondary)] text-[11px] rounded-[2px] shrink-0"
        >
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1 text-[color:var(--text-muted)] text-[11px]">Loading...</div>
      ) : error ? (
        <ActionableErrorState
          title="Unable to load data"
          message={error}
          actionLabel="Refresh"
          onAction={refresh}
        />
      ) : (
        <ResultTable data={data} tab={tab} />
      )}
    </div>
  );
};

export default AnalyticsTradingView;
