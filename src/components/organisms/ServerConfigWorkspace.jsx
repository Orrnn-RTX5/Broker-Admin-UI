import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  BookOpenCheck,
  Clock3,
  Database,
  HardDrive,
  Radio,
  RefreshCw,
  Settings2,
  ShieldCheck,
  ShieldOff,
  Users,
} from 'lucide-react';
import { ServerConfigService } from '../../services/serverConfig.service';
import { getApiErrorMessage } from '../../utils/apiShapes';
import ActionableErrorState from '../atoms/ActionableErrorState';
import LpSymbolDatalist from '../atoms/LpSymbolDatalist';
import { useServerStatus } from '../../hooks/useServerStatus';
import './ServerConfigWorkspace.css';
import { useWorkspaceStartupReady } from '../../hooks/useWorkspaceStartup';

const ServerSettingsTab = React.lazy(() => import('./ServerConfigTables').then(module => ({ default: module.ServerSettingsTab })));
const SwapRatesTab = React.lazy(() => import('./ServerConfigTables').then(module => ({ default: module.SwapRatesTab })));
const DemoAccountsTab = React.lazy(() => import('./ServerConfigDemoAccounts'));
const CloseCounterpartsTab = React.lazy(() => import('./ServerConfigCloseCounterparts'));
const metricNumberFormats = [0, 1, 2, 3].map(maximumFractionDigits => new Intl.NumberFormat('en-US', { maximumFractionDigits }));

const TABS = [
  { id: 'status', label: 'Server Status', icon: Activity },
  { id: 'settings', label: 'Server Settings', icon: Settings2 },
  { id: 'swaps', label: 'Swap Rates', icon: Database },
  { id: 'halt', label: 'Trading Halt', icon: ShieldOff },
  { id: 'counterparts', label: 'Close Counterparts', icon: BookOpenCheck },
  { id: 'demo', label: 'Demo Accounts', icon: Users },
];

const KNOWN_STATUS_KEYS = new Set([
  'active_sessions', 'uptime_human', 'uptime_seconds', 'nats_status',
  'memory_alloc_mb', 'memory_sys_mb', 'goroutines', 'gc_cycles', 'db_pool',
]);
const KNOWN_POOL_KEYS = new Set(['acquired_conns', 'idle_conns', 'total_conns']);

const formatServerMetric = (key, value) => {
  if (value == null || value === '') return '—';
  if (key === 'uptime_human') {
    return String(value).replace(/(\d+)h\s*(\d+)m\s*(\d+)(?:\.\d+)?s/i, '$1h $2m $3s');
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return metricNumberFormats[key.endsWith('_mb') ? 2 : 3].format(value);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const formatLabel = (key) => key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const MetricCard = ({ icon: Icon, label, value, note, tone = 'default' }) => (
  <div className={`server-config-kpi ${tone !== 'default' ? `is-${tone}` : ''}`}>
    <div className="server-config-kpi-top">
      <span className="server-config-kpi-label">{label}</span>
      {React.createElement(Icon, { size: 16, 'aria-hidden': true })}
    </div>
    <strong className="server-config-kpi-value" title={String(value)}>{value}</strong>
    <span className="server-config-kpi-note">{note}</span>
  </div>
);

const MetricRow = ({ label, value, tone = 'default' }) => (
  <div className="server-config-metric-row">
    <span>{label}</span>
    <strong className={tone !== 'default' ? `is-${tone}` : ''} title={String(value)}>{value}</strong>
  </div>
);

const StatusTab = ({ navigate, refreshTrigger }) => {
  const { data, loading, error, lastUpdated, saved, refresh: load } = useServerStatus(refreshTrigger);
  useWorkspaceStartupReady('view', Boolean(data || error) || !loading);

  if (!data && loading) {
    return (
      <div className="server-config-scroll" role="status" aria-label="Loading server status">
        <div className="server-config-inner">
          <div className="server-config-skeleton-line" />
          <div className="server-config-kpi-grid">
            {Array.from({ length: 4 }, (_, index) => <div className="server-config-skeleton-card" key={index} />)}
          </div>
          <div className="server-config-skeleton-panel" />
        </div>
      </div>
    );
  }
  if (!data && error) {
    return <ActionableErrorState title="Unable to load server health" message={error} actionLabel="Refresh" onAction={load} />;
  }

  const metrics = data ?? {};
  const pool = metrics.db_pool && typeof metrics.db_pool === 'object' && !Array.isArray(metrics.db_pool)
    ? metrics.db_pool
    : null;
  const natsState = String(metrics.nats_status ?? '').toLowerCase();
  const natsTone = natsState === 'connected' ? 'good'
    : natsState === 'disconnected' || natsState === 'error' ? 'bad' : 'default';
  const natsLabel = metrics.nats_status == null ? 'Unknown' : formatLabel(String(metrics.nats_status));
  const uptime = metrics.uptime_human != null
    ? formatServerMetric('uptime_human', metrics.uptime_human)
    : metrics.uptime_seconds != null ? `${formatServerMetric('uptime_seconds', metrics.uptime_seconds)} sec` : '—';
  const allocatedMemory = metrics.memory_alloc_mb == null ? '—' : `${formatServerMetric('memory_alloc_mb', metrics.memory_alloc_mb)} MB`;
  const totalPool = Number(pool?.total_conns);
  const acquiredPool = Number(pool?.acquired_conns);
  const poolRatio = Number.isFinite(totalPool) && totalPool > 0 && Number.isFinite(acquiredPool)
    ? Math.max(0, Math.min(100, Math.round((acquiredPool / totalPool) * 100)))
    : null;
  const extraMetrics = Object.entries(metrics).filter(([key]) => !KNOWN_STATUS_KEYS.has(key));
  const extraPoolMetrics = pool ? Object.entries(pool).filter(([key]) => !KNOWN_POOL_KEYS.has(key)) : [];

  return (
    <div className="server-config-scroll">
      <div className="server-config-inner">
        <div className="server-config-section-head">
          <div>
            <div className="server-config-eyebrow">OVERVIEW</div>
            <h2>Server health</h2>
            <p>Current runtime and connection metrics from the server.</p>
          </div>
          <div className="server-config-head-actions">
            <span className="server-config-updated">
              <span className="server-config-updated-dot" />
              {lastUpdated ? `${saved ? 'Saved snapshot' : 'Snapshot'} ${new Date(lastUpdated).toLocaleTimeString()}` : 'Awaiting snapshot'}
            </span>
            <button type="button" className="server-config-button server-config-button-secondary" onClick={load} disabled={loading}>
              <RefreshCw size={13} className={loading ? 'server-config-spin' : ''} aria-hidden="true" />
              {loading ? 'Refreshing' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && (
          <div className="server-config-inline-alert is-danger" role="alert">
            <span>{error}</span>
            <button type="button" onClick={load}>Try again</button>
          </div>
        )}

        <div className="server-config-kpi-grid">
          <MetricCard icon={Users} label="Active sessions" value={formatServerMetric('active_sessions', metrics.active_sessions)} note="Currently connected sessions" />
          <MetricCard icon={Clock3} label="Uptime" value={uptime} note="Since the last server start" />
          <MetricCard icon={HardDrive} label="Memory allocated" value={allocatedMemory} note="Runtime allocation" />
          <MetricCard icon={Radio} label="Messaging" value={natsLabel} note="NATS connection" tone={natsTone} />
        </div>

        <div className="server-config-detail-grid">
          <section className="server-config-panel-card">
            <div className="server-config-card-head">
              <div className="server-config-card-icon"><Activity size={15} aria-hidden="true" /></div>
              <div><h3>Runtime</h3><p>Process and memory counters</p></div>
            </div>
            <div className="server-config-metric-list">
              <MetricRow label="Goroutines" value={formatServerMetric('goroutines', metrics.goroutines)} />
              <MetricRow label="GC cycles" value={formatServerMetric('gc_cycles', metrics.gc_cycles)} />
              <MetricRow label="System memory" value={metrics.memory_sys_mb == null ? '—' : `${formatServerMetric('memory_sys_mb', metrics.memory_sys_mb)} MB`} />
              <MetricRow label="Uptime (seconds)" value={formatServerMetric('uptime_seconds', metrics.uptime_seconds)} />
            </div>
          </section>

          <section className="server-config-panel-card">
            <div className="server-config-card-head">
              <div className="server-config-card-icon"><Database size={15} aria-hidden="true" /></div>
              <div><h3>Database pool</h3><p>Current connection allocation</p></div>
            </div>
            <div className="server-config-metric-list">
              <MetricRow label="Acquired" value={formatServerMetric('acquired_conns', pool?.acquired_conns)} />
              <MetricRow label="Idle" value={formatServerMetric('idle_conns', pool?.idle_conns)} />
              <MetricRow label="Total" value={formatServerMetric('total_conns', pool?.total_conns)} />
              {extraPoolMetrics.map(([key, value]) => <MetricRow key={key} label={formatLabel(key)} value={formatServerMetric(key, value)} />)}
            </div>
            <div className="server-config-pool-usage">
              <div><span>Connections in use</span><strong>{poolRatio == null ? '—' : `${poolRatio}%`}</strong></div>
              <div className="server-config-progress" role="progressbar" aria-label="Database connections in use" aria-valuenow={poolRatio ?? 0} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${poolRatio ?? 0}%` }} />
              </div>
            </div>
          </section>
        </div>

        {extraMetrics.length > 0 && (
          <section className="server-config-panel-card server-config-extra-card">
            <div className="server-config-card-head"><div><h3>Additional metrics</h3><p>Other values returned by this server</p></div></div>
            <div className="server-config-extra-grid">
              {extraMetrics.map(([key, value]) => <MetricRow key={key} label={formatLabel(key)} value={formatServerMetric(key, value)} />)}
            </div>
          </section>
        )}

        <div className="server-config-section-caption">CONFIGURATION</div>
        <div className="server-config-shortcuts">
          <button type="button" onClick={() => navigate('settings')}>
            <Settings2 size={16} aria-hidden="true" />
            <span><strong>Server settings</strong><small>Review and edit configuration keys</small></span>
            <ArrowRight size={14} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => navigate('swaps')}>
            <Database size={16} aria-hidden="true" />
            <span><strong>Swap rates</strong><small>Review financing for each symbol</small></span>
            <ArrowRight size={14} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => navigate('halt')}>
            <ShieldOff size={16} aria-hidden="true" />
            <span><strong>Trading controls</strong><small>Halt or resume a symbol</small></span>
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};

const TradingHaltTab = () => {
  const [symbol, setSymbol] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastAction, setLastAction] = useState(null);

  const handleAction = async (halt) => {
    const target = symbol.trim().toUpperCase();
    if (!target) { setError('Enter a symbol before submitting an action.'); return; }
    setError('');
    setLoading(true);
    try {
      const response = await ServerConfigService.setTradingHalt(target, halt, reason.trim() || undefined);
      setLastAction({ target, halt, reason: reason.trim(), response, at: Date.now() });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Trading action failed.'));
    } finally {
      setLoading(false);
    }
  };

  const resultHalted = typeof lastAction?.response?.halted === 'boolean' ? lastAction.response.halted : lastAction?.halt;

  return (
    <div className="server-config-scroll">
      <div className="server-config-inner">
        <div className="server-config-section-head">
          <div>
            <div className="server-config-eyebrow">OPERATIONS</div>
            <h2>Trading controls</h2>
            <p>Halt or resume trading for one symbol at a time.</p>
          </div>
        </div>

        <div className="server-config-control-grid">
          <section className="server-config-panel-card server-config-control-card">
            <div className="server-config-card-head">
              <div className="server-config-card-icon"><ShieldOff size={15} aria-hidden="true" /></div>
              <div><h3>Symbol action</h3><p>Choose a symbol and the action to apply</p></div>
            </div>
            <div className="server-config-form">
              <label htmlFor="server-config-symbol">Symbol <span>*</span></label>
              <input id="server-config-symbol" value={symbol} onChange={(event) => { setSymbol(event.target.value.toUpperCase()); setError(''); }} placeholder="e.g. EURUSD" list="trading-halt-symbol-options" autoComplete="off" spellCheck={false} />
              <LpSymbolDatalist id="trading-halt-symbol-options" />
              <div className="server-config-field-note">Enter the exact symbol used by your broker.</div>

              <label htmlFor="server-config-reason">Reason <em>optional</em></label>
              <input id="server-config-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Scheduled maintenance" />

              {error && <div className="server-config-inline-alert is-danger" role="alert">{error}</div>}
              <div className="server-config-control-actions">
                <button type="button" className="server-config-button server-config-button-danger" disabled={loading || !symbol.trim()} onClick={() => handleAction(true)}>
                  <ShieldOff size={14} aria-hidden="true" />{loading ? 'Working…' : 'Halt trading'}
                </button>
                <button type="button" className="server-config-button server-config-button-primary" disabled={loading || !symbol.trim()} onClick={() => handleAction(false)}>
                  <ShieldCheck size={14} aria-hidden="true" />{loading ? 'Working…' : 'Resume trading'}
                </button>
              </div>
            </div>
          </section>

          <aside className="server-config-panel-card server-config-guidance-card">
            <div className="server-config-card-head"><div><h3>Action details</h3><p>Review the scope before submitting</p></div></div>
            <div className="server-config-guidance-row"><strong>Scope</strong><span>Only the entered symbol is affected.</span></div>
            <div className="server-config-guidance-row"><strong>Halt duration</strong><span>A halt stays active until that symbol is resumed.</span></div>
            <div className="server-config-guidance-row"><strong>Action result</strong><span>The latest result appears here after you submit an action.</span></div>
            {lastAction && (
              <div className={`server-config-action-result ${resultHalted ? 'is-danger' : 'is-good'}`} role="status">
                <div className="server-config-action-result-title">Last action · {new Date(lastAction.at).toLocaleTimeString()}</div>
                <strong>{lastAction.target} · {resultHalted ? 'Trading halted' : 'Trading resumed'}</strong>
                {(lastAction.response?.reason || lastAction.reason) && <span>{lastAction.response?.reason || lastAction.reason}</span>}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

const ServerConfigWorkspace = ({ refreshTrigger = 0 }) => {
  const [tab, setTab] = useState('status');
  const current = TABS.find((item) => item.id === tab) ?? TABS[0];

  return (
    <div className="server-config-view">
      <div className="server-config-tabs" role="tablist" aria-label="Server configuration sections">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`server-config-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls="server-config-panel"
            onClick={() => setTab(id)}
          >
            {React.createElement(Icon, { size: 13, 'aria-hidden': true })}{label}
          </button>
        ))}
      </div>
      <div id="server-config-panel" className="server-config-tab-panel" role="tabpanel" aria-labelledby={`server-config-tab-${current.id}`}>
        <React.Suspense fallback={<div role="status" className="server-config-scroll">Loading section…</div>}>
        {tab === 'status' && <StatusTab navigate={setTab} refreshTrigger={refreshTrigger} />}
        {tab === 'settings' && <ServerSettingsTab />}
        {tab === 'swaps' && <SwapRatesTab />}
        {tab === 'halt' && <TradingHaltTab />}
        {tab === 'counterparts' && <CloseCounterpartsTab />}
        {tab === 'demo' && <DemoAccountsTab />}
        </React.Suspense>
      </div>
    </div>
  );
};

export default ServerConfigWorkspace;
