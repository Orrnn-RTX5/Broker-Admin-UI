import React, { useState } from 'react';
import { AnalyticsService } from '../../services/analytics.service';
import { RefreshCw } from 'lucide-react';
import { useCachedTabRequest } from '../../hooks/useCachedTabRequest';
import ActionableErrorState from '../atoms/ActionableErrorState';

const TABS = [
  { key: 'clv', label: 'Client Lifetime Value' },
  { key: 'churn', label: 'Churn Prediction' },
  { key: 'retention', label: 'Retention' },
  { key: 'deposits', label: 'Deposits' },
];

const CLIENT_ANALYTICS_LOADERS = {
  clv: () => AnalyticsService.getCLV(),
  churn: () => AnalyticsService.getChurnPrediction(),
  retention: () => AnalyticsService.getRetention(),
  deposits: () => AnalyticsService.getDeposits(),
};

const NUMERIC_COLUMN_RE = /(avg|total|count|revenue|volume|balance|clv|days|rate|probability|amount|deposit)/i;
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
  if (normalized.includes('description')) return 'minmax(260px, 1.5fr)';
  if (normalized.includes('lifetime')) return '150px';
  if (normalized.includes('revenue') || normalized.includes('volume')) return '150px';
  if (normalized.includes('balance')) return '140px';
  if (normalized.includes('clv')) return '120px';
  if (normalized.includes('count') || normalized.includes('accounts')) return '130px';
  if (normalized.includes('date') || normalized.includes('time')) return '170px';

  return isNumericColumn(key) ? '130px' : 'minmax(160px, 1fr)';
};

const getCellAlignment = (key, value) => (
  isNumericColumn(key, value) ? 'text-right tabular-nums' : 'text-left'
);

const ResultTable = ({ data }) => {
  if (!data) {
    return <div role="status" className="m-4 max-w-lg rounded-[var(--radius-md)] border border-[color:var(--border-default)] bg-[color:var(--bg-surface-1)] p-4 text-[12px] text-[color:var(--text-secondary)]">Loading analytics…</div>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <div role="status" className="m-4 max-w-lg rounded-[var(--radius-md)] border border-[color:var(--border-default)] bg-[color:var(--bg-surface-1)] p-4"><div className="text-[13px] text-[color:var(--text-primary)]">No analytics data yet</div><p className="mt-1 text-[12px] text-[color:var(--text-secondary)]">Results will appear here when this report has data.</p></div>;
    }

    const cols = Object.keys(data[0]);
    const gridTemplateColumns = cols.map(getColumnWidth).join(' ');

    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          <div
            className="grid sticky top-0 z-10 min-w-max h-[30px] bg-[color:var(--bg-surface-2)] border-b border-[color:var(--border-default)] shrink-0"
            style={{ gridTemplateColumns }}
          >
            {cols.map((column) => (
              <div
                key={column}
                className={`flex items-center px-3 text-[11px] font-semibold text-[color:var(--text-secondary)] uppercase tracking-wider border-r border-[color:var(--border-subtle)] last:border-r-0 ${getCellAlignment(column)}`}
                title={String(column)}
              >
                <span className="truncate w-full">{formatHeader(column)}</span>
              </div>
            ))}
          </div>

          {data.map((row, index) => (
            <div
              key={index}
              className={`grid min-w-max min-h-[var(--row-h)] border-b border-[color:var(--border-subtle)] ${index % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-[color:var(--bg-surface-3)]`}
              style={{ gridTemplateColumns }}
            >
              {cols.map((column) => {
                const value = fmt(column, row[column]);

                return (
                  <div
                    key={column}
                    className={`flex items-center px-3 text-[11px] text-[color:var(--text-primary)] font-mono border-r border-[color:var(--border-subtle)] last:border-r-0 min-w-0 ${getCellAlignment(column, row[column])}`}
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
      <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-[var(--radius-md)] divide-y divide-[color:var(--border-subtle)]">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="flex items-center px-4 h-[32px]">
            <span className="text-[11px] text-[color:var(--text-secondary)] flex-1">{formatHeader(key)}</span>
            <span className="text-[12px] font-mono text-white">{fmt(key, value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const AnalyticsClientView = () => {
  const [tab, setTab] = useState('clv');
  const { data, loading, error, refresh } = useCachedTabRequest(tab, CLIENT_ANALYTICS_LOADERS, {
    fallback: 'Client analytics failed to load.',
  });

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden">
      <div className="flex items-center bg-[color:var(--bg-surface-1)] border-b border-[color:var(--border-default)] shrink-0 overflow-x-auto" role="group" aria-label="Analytics reports">
        {TABS.map((item) => (
          <button
            type="button"
            key={item.key}
            onClick={() => setTab(item.key)}
            aria-pressed={tab === item.key}
            className={`px-4 min-h-8 text-[11px] border-r border-[color:var(--border-subtle)] whitespace-nowrap transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--accent-500)] ${tab === item.key ? 'bg-[color:var(--bg-app)] text-[color:var(--text-primary)] border-t-2 border-t-[color:var(--accent-500)]' : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface-3)]'}`}
          >
            {item.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          type="button"
          onClick={refresh}
          className="flex items-center gap-1.5 min-h-7 px-3 mr-2 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[color:var(--text-primary)] text-[11px] rounded-[var(--radius-sm)] shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--accent-500)]"
        >
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {loading ? (
        <div role="status" className="flex items-center justify-center flex-1 text-[color:var(--text-secondary)] text-[12px]">Loading analytics…</div>
      ) : error ? (
        <ActionableErrorState
          title="Unable to load data"
          message={error}
          actionLabel="Refresh"
          onAction={refresh}
        />
      ) : (
        <ResultTable data={data} />
      )}
    </div>
  );
};

export default AnalyticsClientView;
