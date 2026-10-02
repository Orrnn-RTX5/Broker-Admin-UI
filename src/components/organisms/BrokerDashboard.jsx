import { createElement } from 'react';
import { Activity, ArrowUpRight, BarChart3, RefreshCw, ShieldCheck, Users, Wallet } from 'lucide-react';
import { useWorkspaceData } from '../../hooks/useWorkspaceData';
import { useAuthStore } from '../../store/authStore';
import { canAccessView } from '../../utils/permissions';
import useSymbolStore from '../../store/useSymbolStore';
import './BrokerDashboard.css';

const number = value => value == null ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
const money = (value, currency) => value == null ? '—' : currency + ' ' + number(value);
const DashboardMetric = ({ label, value, detail, icon: icon, tone }) => (
  <article className="broker-dashboard-metric" data-tone={tone}>
    <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
    <span className="broker-dashboard-metric-icon">{icon}</span>
  </article>
);
export default function BrokerDashboard({ onNavigate }) {
  const { metrics, loading, errors, updatedAt, refresh, journal } = useWorkspaceData();
  const user = useAuthStore(state => state.user);
  const feedConnected = useSymbolStore(state => state.isConnected);
  const accountsReady = updatedAt !== null && !errors.accounts;
  const positionsReady = updatedAt !== null && !errors.positions;
  const links = [
    ['Trading Accounts', 'Accounts', Users], ['Positions', 'Open positions', BarChart3],
    ['Managers', 'Managers & roles', ShieldCheck], ['Groups', 'Account groups', Wallet],
    ['Integrations', 'Integrations', Activity], ['Risk Events', 'Risk events', Activity],
  ].filter(([view]) => canAccessView(user, view));
  return (
    <div className="broker-dashboard">
      <header className="broker-dashboard-heading">
        <div><h1>Dashboard</h1><p>Brokerage operations, account activity, and trading oversight.</p></div>
        <button type="button" className="broker-dashboard-refresh" onClick={refresh} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />{loading ? 'Refreshing' : 'Refresh snapshot'}
        </button>
      </header>
      <div className="broker-dashboard-snapshot" role="status">
        {loading ? 'Loading broker snapshot…' : updatedAt ? 'Snapshot · ' + new Date(updatedAt).toLocaleTimeString() + ' · Refreshes every 30 seconds' : 'Waiting for broker data'}
        {Object.keys(errors).length > 0 && <span>Some data is unavailable. Refresh to try again.</span>}
      </div>
      <section className="broker-dashboard-metrics" aria-label="Broker metrics">
        <DashboardMetric label="Trading accounts" value={accountsReady ? number(metrics.accounts) : '—'} detail={errors.accounts ? 'Account data unavailable' : 'All broker accounts'} icon={<Users size={17} />} />
        <DashboardMetric label="Real accounts" value={accountsReady ? number(metrics.real) : '—'} detail="Excludes demo account groups" icon={<Users size={17} />} />
        <DashboardMetric label="Demo accounts" value={accountsReady ? number(metrics.demo) : '—'} detail="Demo account groups" icon={<Users size={17} />} />
        <DashboardMetric label="Open positions" value={positionsReady ? number(metrics.positions) : '—'} detail={errors.positions ? 'Position data unavailable' : 'Current position book'} icon={<BarChart3 size={17} />} />
        <DashboardMetric label="Account equity" value={accountsReady ? money(metrics.equity, metrics.currency) : '—'} detail={metrics.currencies.length > 1 ? 'Multiple currencies · see accounts' : metrics.currency ? 'Total account equity · ' + metrics.currency : 'Currency or equity data unavailable'} icon={<Wallet size={17} />} tone="success" />
        <DashboardMetric label="Account balance" value={accountsReady ? money(metrics.balance, metrics.currency) : '—'} detail="Balance across all accounts" icon={<Wallet size={17} />} />
        <DashboardMetric label="Used margin" value={accountsReady ? money(metrics.margin, metrics.currency) : '—'} detail="Reported account margin" icon={<ShieldCheck size={17} />} />
        <DashboardMetric label="Market feed" value={feedConnected ? 'Connected' : 'Awaiting connection'} detail="Broker market data connection" icon={<Activity size={17} />} tone={feedConnected ? 'success' : 'neutral'} />
      </section>
      <section className="broker-dashboard-book">
        <header><div><h2>Position activity by symbol</h2><p>Current open position counts and directional volume.</p></div><span>{positionsReady ? metrics.symbols.length + ' symbols' : 'Data unavailable'}</span></header>
        {positionsReady && metrics.symbols.length > 0 ? (
          <div className="broker-dashboard-symbols">
            {metrics.symbols.slice(0, 8).map(row => <div key={row.symbol} className="broker-dashboard-symbol">
              <div><strong>{row.symbol}</strong><span>{row.positions} {row.positions === 1 ? 'position' : 'positions'}</span></div>
              <div className="broker-dashboard-bar" aria-label={row.positions + ' open positions'}><span style={{ width: (row.positions / metrics.positions * 100) + '%' }} /></div>
              <div className="broker-dashboard-volume"><span>Buy {number(row.buy)} lots</span><span>Sell {number(row.sell)} lots</span></div>
            </div>)}
          </div>
        ) : <div className="broker-dashboard-book-empty"><BarChart3 size={28} strokeWidth={1.3} /><strong>{loading ? 'Loading position activity' : errors.positions ? 'Position activity is unavailable' : 'No open positions'}</strong><p>{errors.positions ? 'Refresh the snapshot or open Positions to check the broker response.' : 'Active symbols and trading volumes appear here when positions are open.'}</p></div>}
      </section>
      <div className="broker-dashboard-bottom">
        <section className="broker-dashboard-panel"><header><h2>Workspace shortcuts</h2><span>Broker administration</span></header><div className="broker-dashboard-links">{links.map(([view, label, icon]) => <button type="button" key={view} onClick={() => onNavigate(view)}>{createElement(icon, { size: 14 })}<span>{label}</span><ArrowUpRight size={13} /></button>)}</div></section>
        <section className="broker-dashboard-panel"><header><h2>Recent workspace activity</h2><span>Current session</span></header><div className="broker-dashboard-events">{journal.slice(0, 4).map(entry => <div key={entry.id}><time>{new Date(entry.time).toLocaleTimeString()}</time><span>{entry.message}</span></div>)}{journal.length === 0 && <p>Session events appear here as the workspace updates.</p>}</div></section>
      </div>
    </div>
  );
}
