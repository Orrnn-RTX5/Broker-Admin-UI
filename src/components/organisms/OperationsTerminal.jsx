import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, RefreshCw, ScrollText, Search, TerminalSquare, X } from 'lucide-react';
import { useWorkspaceData } from '../../hooks/useWorkspaceData';
import { DEFAULT_WORKSPACE_LAYOUT } from '../../config/workspaceLayout';
import { workspacePosition } from '../../utils/workspaceMetrics';
import { useAuthStore } from '../../store/authStore';
import useServerJournal from '../../hooks/useServerJournal';
import { SERVER_JOURNAL_FILTERS, describeServerJournalScope, matchesServerJournalSearch, serverJournalSessionKey } from '../../utils/serverJournal';
import { journalEntryKey } from '../../utils/serverJournalView';
import ServerJournal from './ServerJournal';
import './OperationsTerminal.css';

const tabs = ['Summary', 'Exposure', 'News', 'Calendar', 'Dealing', 'Alerts', 'Search', 'Journal'];
const value = number => number == null ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 5 }).format(number);
function TerminalTable({ columns, rows, empty }) {
  return <div className="operations-terminal-scroll"><table><thead><tr>{columns.map(([key, label]) => <th key={key} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id ?? row.ticket ?? index}>{columns.map(([key]) => <td key={key} className={key === 'side' ? row.side.toLowerCase() : key === 'profit' ? (row[key] < 0 ? 'loss' : row[key] > 0 ? 'profit' : '') : ''}>{typeof row[key] === 'number' ? (['ticket', 'login'].includes(key) ? String(row[key]) : value(row[key])) : row[key] || '—'}</td>)}</tr>)}</tbody></table>{!rows.length && <div className="operations-terminal-empty">{empty}</div>}</div>;
}
export default function OperationsTerminal({ onNavigate }) {
  const { positions, metrics, loading, errors, refresh, recordEvent } = useWorkspaceData();
  const user = useAuthStore(state => state.user);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const [tab, setTab] = useState(DEFAULT_WORKSPACE_LAYOUT.operationsTab);
  const activeTab = tabs.includes(tab) ? tab : DEFAULT_WORKSPACE_LAYOUT.operationsTab;
  const [height, setHeight] = useState(DEFAULT_WORKSPACE_LAYOUT.operationsHeight);
  const [collapsed, setCollapsed] = useState(DEFAULT_WORKSPACE_LAYOUT.operationsCollapsed);
  const [query, setQuery] = useState('');
  const [journalQuery, setJournalQuery] = useState('');
  const [clearedJournal, setClearedJournal] = useState({ owner: '', ids: new Set() });
  const journalSession = serverJournalSessionKey(user);
  const journalData = useServerJournal(isAuthenticated, journalSession, activeTab === 'Journal' && !collapsed);
  const journalOwner = JSON.stringify([journalSession, journalData.filter]);
  const hiddenIds = clearedJournal.owner === journalOwner ? clearedJournal.ids : new Set();
  const serverJournal = {
    ...journalData,
    entries: journalData.entries.filter(entry => !hiddenIds.has(journalEntryKey(entry))),
    cleared: hiddenIds.size > 0,
    clear: () => setClearedJournal({ owner: journalOwner, ids: new Set([...hiddenIds, ...journalData.entries.map(journalEntryKey)]) }),
    restore: () => setClearedJournal({ owner: journalOwner, ids: new Set() }),
  };
  const journalStatus = !isAuthenticated ? 'Sign in to view journal'
    : serverJournal.loading && !serverJournal.entries.length ? 'Loading journal…'
      : describeServerJournalScope(serverJournal.scope) || 'Broker journal';
  const terminalLoading = activeTab === 'Journal' ? serverJournal.loading : loading;
  const journalCount = serverJournal.entries.filter(entry => matchesServerJournalSearch(entry, journalQuery.trim().toLowerCase())).length;
  const drag = useRef(null);
  const section = useRef(null);
  const tabButtons = useRef([]);
  const clamp = next => Math.max(130, Math.min(window.innerHeight - 300, next));
  useEffect(() => {
    const selected = tabButtons.current[tabs.indexOf(activeTab)];
    if (collapsed || !selected) return;
    const reveal = () => selected.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(selected.parentElement);
    return () => observer.disconnect();
  }, [activeTab, collapsed]);
  useEffect(() => {
    const move = event => { if (drag.current) setHeight(clamp(drag.current.height + drag.current.y - event.clientY)); };
    const end = () => { drag.current = null; document.body.style.cursor = ''; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); end(); };
  }, [setHeight]);
  const selectTab = next => { setTab(next); recordEvent('Opened ' + next + ' terminal'); };
  const rows = useMemo(() => {
    if (collapsed || !['Summary', 'Search'].includes(activeTab)) return [];
    const search = query.toLowerCase();
    return positions.map(workspacePosition).filter(row => (
      [row.ticket, row.login, row.symbol, row.side, row.comment]
        .some(text => String(text ?? '').toLowerCase().includes(search))
    ));
  }, [activeTab, collapsed, positions, query]);
  const positionColumns = [['ticket', 'Ticket'], ['login', 'Login'], ['symbol', 'Symbol'], ['side', 'Action'], ['lots', 'Lots'], ['open', 'Open'], ['current', 'Current'], ['sl', 'S/L'], ['tp', 'T/P'], ['profit', 'Profit'], ['comment', 'Comment']];
  const emptyPositions = loading ? 'Loading open positions…' : errors.positions ? 'Position data is unavailable. Refresh to try again.' : query ? 'No positions match your search.' : 'No open positions.';
  return <section ref={section} className={'operations-terminal' + (activeTab === 'Journal' ? ' is-journal' : '') + (collapsed ? ' is-collapsed' : '')} style={{ '--terminal-height': Number.isFinite(Number(height)) ? Number(height) + 'px' : DEFAULT_WORKSPACE_LAYOUT.operationsHeight + 'px' }} aria-label="Operations Terminal">
    {!collapsed && <div className="operations-terminal-resize" role="separator" aria-label="Resize Operations Terminal" aria-orientation="horizontal" aria-valuemin={130} aria-valuemax={Math.max(130, window.innerHeight - 300)} aria-valuenow={Math.round(clamp(Number(height)))} tabIndex={0}
      onPointerDown={event => { event.preventDefault(); drag.current = { y: event.clientY, height: section.current.getBoundingClientRect().height }; document.body.style.cursor = 'row-resize'; }}
      onDoubleClick={() => setHeight(DEFAULT_WORKSPACE_LAYOUT.operationsHeight)} onKeyDown={event => { if (['ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) { event.preventDefault(); setHeight(event.key === 'Home' ? DEFAULT_WORKSPACE_LAYOUT.operationsHeight : clamp(Number(height) + (event.key === 'ArrowUp' ? 20 : -20))); } }} />}
    <header className="operations-terminal-heading"><span className="operations-terminal-title">{activeTab === 'Journal' ? <ScrollText size={14} aria-hidden="true" /> : <TerminalSquare size={13} aria-hidden="true" />}{activeTab === 'Journal' ? 'Journal' : 'Operations Terminal'}</span><div className="operations-terminal-controls">
      {!collapsed && <>
        <span className="operations-terminal-caption" role="status" title={activeTab === 'Journal' ? journalStatus : undefined}>{activeTab === 'Summary' ? 'Open positions · 30s refresh' : activeTab === 'Journal' ? journalStatus : activeTab}</span>
        {activeTab === 'Journal' && <>
          <select className="operations-journal-filter" aria-label="Journal filter" value={serverJournal.filter} disabled={!isAuthenticated} onChange={event => serverJournal.setFilter(event.target.value)}>
            {SERVER_JOURNAL_FILTERS.map(filter => <option key={filter.id} value={filter.id}>{filter.label}</option>)}
          </select>
          <label className={'operations-journal-live' + (serverJournal.live ? ' is-live' : '')} title={serverJournal.live ? 'Journal updates automatically every 5 seconds' : 'Live updates are paused. Enable Live to receive the latest journal events.'}><input type="checkbox" checked={serverJournal.live} disabled={!isAuthenticated} onChange={event => serverJournal.setLive(event.target.checked)} />Live</label>
        </>}
        <button type="button" onClick={activeTab === 'Journal' ? serverJournal.refresh : refresh} disabled={terminalLoading || (activeTab === 'Journal' && !isAuthenticated)} title={activeTab === 'Journal' ? 'Refresh journal' : 'Refresh terminal data'} aria-label={activeTab === 'Journal' ? 'Refresh journal' : 'Refresh terminal data'}><RefreshCw size={13} className={terminalLoading ? 'animate-spin' : ''} /></button>
      </>}
      <button type="button" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed} aria-label={collapsed ? 'Expand Operations Terminal' : 'Collapse Operations Terminal'} title={collapsed ? 'Expand terminal' : 'Collapse terminal'}>{collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
    </div></header>
    {!collapsed && <>
      <div id="operations-terminal-panel" role="tabpanel" aria-labelledby={'terminal-tab-' + activeTab} className="operations-terminal-content">
        {['Summary', 'Search'].includes(activeTab) && <TerminalTable columns={positionColumns} rows={rows} empty={emptyPositions} />}
        {activeTab === 'Exposure' && <TerminalTable columns={[[ 'symbol', 'Symbol'], ['positions', 'Open positions'], ['buy', 'Buy lots'], ['sell', 'Sell lots']]} rows={metrics.symbols} empty={emptyPositions} />}
        {activeTab === 'Journal' && <ServerJournal key={journalSession} journal={serverJournal} query={journalQuery} isAuthenticated={isAuthenticated} />}
        {activeTab === 'Alerts' && <div className="operations-terminal-notice"><strong>{Object.keys(errors).length ? 'Data connection alerts' : 'No workspace connection alerts'}</strong>{Object.keys(errors).map(key => <p key={key}>{key === 'accounts' ? 'Account' : 'Position'} data could not be loaded.</p>)}<p>Review broker risk and margin alerts in Risk Events.</p><button type="button" onClick={() => onNavigate('Risk Events')}>Open Risk Events<ExternalLink size={12} /></button></div>}
        {activeTab === 'Dealing' && <div className="operations-terminal-notice"><strong>Trading operations</strong><p>Review orders and open positions using the broker trading workspace.</p><div><button type="button" onClick={() => onNavigate('Orders')}>Open Orders<ExternalLink size={12} /></button><button type="button" onClick={() => onNavigate('Positions')}>Open Positions<ExternalLink size={12} /></button></div></div>}
        {activeTab === 'News' && <div className="operations-terminal-notice"><strong>No news feed connected</strong><p>Market headlines appear here when a news feed is available.</p></div>}
        {activeTab === 'Calendar' && <div className="operations-terminal-notice"><strong>No economic calendar connected</strong><p>Economic events appear here when a calendar feed is available.</p></div>}
      </div>
      <div className="operations-terminal-bottom">
        <div role="tablist" aria-label="Operations Terminal views">{tabs.map((label, index) => <button type="button" ref={node => { tabButtons.current[index] = node; }} key={label} id={'terminal-tab-' + label} role="tab" aria-selected={activeTab === label} aria-controls="operations-terminal-panel" tabIndex={activeTab === label ? 0 : -1} onClick={() => selectTab(label)} onKeyDown={event => { let next; if (event.key === 'ArrowRight') next = (index + 1) % tabs.length; if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length; if (event.key === 'Home') next = 0; if (event.key === 'End') next = tabs.length - 1; if (next != null) { event.preventDefault(); selectTab(tabs[next]); tabButtons.current[next]?.focus(); } }}>{label}</button>)}</div>
        {['Summary', 'Search', 'Journal'].includes(activeTab) && <div className="operations-terminal-tools">
          {activeTab === 'Journal' && <span className="operations-journal-count">{journalQuery.trim() ? `${journalCount} of ${serverJournal.entries.length}` : journalCount} {serverJournal.entries.length === 1 ? 'event' : 'events'}</span>}
          <label className="operations-terminal-search"><Search size={12} aria-hidden="true" /><input aria-label={activeTab === 'Journal' ? 'Search journal' : 'Search terminal positions'} placeholder={activeTab === 'Journal' ? 'Search journal…' : 'Search positions'} value={activeTab === 'Journal' ? journalQuery : query} onChange={event => activeTab === 'Journal' ? setJournalQuery(event.target.value) : setQuery(event.target.value)} /></label>
          {activeTab === 'Journal' && journalQuery && <button type="button" className="operations-journal-clear" aria-label="Clear journal search" title="Clear search" onClick={event => { setJournalQuery(''); event.currentTarget.parentElement.querySelector('input')?.focus(); }}><X size={12} aria-hidden="true" /></button>}
        </div>}
      </div>
    </>}
  </section>;
}
