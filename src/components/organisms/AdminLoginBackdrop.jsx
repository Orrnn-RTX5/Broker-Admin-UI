import React from 'react';
import {
  Bell,
  ChartNoAxesCombined,
  ChevronDown,
  Folder,
  LayoutGrid,
  Search,
  Server,
  Settings2,
} from 'lucide-react';
import IntegrationsView from './IntegrationsView';

const quotes = [
  ['ADAUSD', '0.25460', '0.25780', 'down'],
  ['AUDCAD', '0.99454', '0.99459', 'up'],
  ['AUDCHF', '0.58270', '0.58282', 'down'],
  ['AUDJPY', '110.880', '110.910', 'down'],
  ['AUDNZD', '1.23973', '1.24009', 'down'],
  ['AUDUSD', '0.70335', '0.70349', 'down'],
  ['AUS200', '8681.10', '8682.30', 'up'],
  ['BNBUSD', '780.050', '783.110', 'up'],
  ['BTCUSD', '85188.52', '85241.01', 'up'],
  ['CADCHF', '0.58590', '0.58601', 'up'],
  ['CADJPY', '111.496', '111.501', 'up'],
];

const navigator = [
  { label: 'Servers', depth: 0, icon: Server },
  { label: 'Server Configuration', depth: 1, icon: Settings2 },
  { label: 'Administrator', depth: 0, icon: LayoutGrid },
  { label: 'RTX5 Server', depth: 1, icon: Server },
  { label: 'Network Cluster', depth: 2, icon: Server },
  { label: 'Integrations', depth: 2, icon: ChartNoAxesCombined, active: true },
  { label: 'Automations', depth: 2, icon: Settings2 },
  { label: 'Security', depth: 2, icon: Settings2 },
  { label: 'Platform Config', depth: 2, icon: Settings2 },
  { label: 'Time', depth: 2, icon: Settings2 },
  { label: 'Holidays', depth: 2, icon: Settings2 },
];

/** A read-only preview of the admin landing screen. No protected data or requests are used. */
const AdminLoginBackdrop = () => (
  <div className="admin-login-backdrop" aria-hidden="true" inert>
    <header className="admin-preview-toolbar">
      <div className="admin-preview-brand"><span className="admin-preview-mark">✦</span><span>Admin</span></div>
      <div className="admin-preview-menus">File&nbsp;&nbsp;&nbsp; Edit&nbsp;&nbsp;&nbsp; View&nbsp;&nbsp;&nbsp; Tools&nbsp;&nbsp;&nbsp; Window&nbsp;&nbsp;&nbsp; Help</div>
      <div className="admin-preview-tools"><Folder size={15} /><span>⇅</span><ChartNoAxesCombined size={15} /><LayoutGrid size={15} /><span>↗</span><Settings2 size={15} /><span>＋</span><Search size={15} /><Bell size={15} /></div>
      <span className="admin-preview-connect">♙&nbsp; Connect <ChevronDown size={11} /></span>
      <span className="admin-preview-automation">⚙&nbsp; Automation</span>
      <div className="admin-preview-toolbar-end"><span>Filter</span><Search size={14} /><span>Search...</span><Bell size={14} /><span className="admin-preview-avatar">OA</span></div>
    </header>
    <div className="admin-preview-body">
      <aside className="admin-preview-sidebar">
        <section className="admin-preview-market">
          <div className="admin-preview-section-title"><ChartNoAxesCombined size={13} /> MARKET WATCH <ChevronDown size={12} /></div>
          <div className="admin-preview-search"><Search size={12} /> Search symbols...</div>
          <div className="admin-preview-connection">Connected · awaiting or receiving ticks</div>
          <div className="admin-preview-quote-head"><span>SYMBOL</span><span>BID</span><span>ASK</span></div>
          <div className="admin-preview-quotes">
            {quotes.map(([symbol, bid, ask, move]) => (
              <div className="admin-preview-quote" key={symbol}>
                <span><i className={`admin-preview-arrow ${move}`}>{move === 'up' ? '↗' : '↘'}</i> {symbol}</span>
                <span className={move}>{bid}</span>
                <span className={move}>{ask}</span>
              </div>
            ))}
          </div>
          <div className="admin-preview-market-footer">62 symbols <span>Muted = awaiting tick</span></div>
          <div className="admin-preview-market-tabs"><span className="selected">Symbols</span><span>Details</span><span>Ticks</span></div>
        </section>
        <section className="admin-preview-navigator">
          <div className="admin-preview-section-title"><Folder size={13} /> NAVIGATOR <ChevronDown size={12} /></div>
          {navigator.map(({ label, depth, icon: Icon, active }) => (
            <div className={`admin-preview-navitem${active ? ' active' : ''}`} style={{ paddingLeft: `${12 + depth * 15}px` }} key={label}>
              {React.createElement(Icon, { size: 13 })} {label}
            </div>
          ))}
        </section>
      </aside>
      <main className="admin-preview-main"><IntegrationsView /></main>
    </div>
    <footer className="admin-preview-status"><span>●&nbsp; Connected to RTX5-PROD-01</span><span>Download app v1.0.3&nbsp;&nbsp;&nbsp; CAP&nbsp;&nbsp; NUM&nbsp;&nbsp; SCRL&nbsp;&nbsp; 16:44:36</span></footer>
  </div>
);

export default AdminLoginBackdrop;
