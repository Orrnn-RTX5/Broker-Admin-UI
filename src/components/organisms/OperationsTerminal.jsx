import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, ListFilter, RefreshCw, Search, TerminalSquare, X } from 'lucide-react';
import { useWorkspaceData } from '../../hooks/useWorkspaceData';
import { DEFAULT_WORKSPACE_LAYOUT } from '../../config/workspaceLayout';
import { buildMt5SymbolSummary, workspacePosition } from '../../utils/workspaceMetrics';
import { useAuthStore } from '../../store/authStore';
import useServerJournal from '../../hooks/useServerJournal';
import { SERVER_JOURNAL_FILTERS, describeServerJournalScope, matchesServerJournalSearch, serverJournalSessionKey } from '../../utils/serverJournal';
import { journalEntryKey } from '../../utils/serverJournalView';
import ServerJournal from './ServerJournal';
import JournalRecoveryStatus from './JournalRecoveryStatus';
import SummaryContextMenu from './SummaryContextMenu';
import './OperationsTerminal.css';
import { useWorkspaceStartupReady } from '../../hooks/useWorkspaceStartup';

const tabs = ['Summary', 'Exposure', 'News', 'Calendar', 'Dealing', 'Alerts', 'Search', 'Journal'];
const value = number => number == null ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 5 }).format(number);

const FALLBACK_USD_RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 155.0,
  CHF: 0.88,
  CAD: 1.38,
  AUD: 1.52,
  NZD: 1.66,
};

const SUMMARY_SORT_KEYS = [
  'symbol',
  'positions',
  'buyVolume',
  'buyPrice',
  'sellVolume',
  'sellPrice',
  'netVolume',
  'displayProfit',
  'displayUncovered',
];

const fmtSummaryLots = (val) => {
  const num = Number(val);
  if (!Number.isFinite(num) || Math.abs(num) < 1e-9) return '0';
  return Number(num.toFixed(2)).toString();
};
const fmtSummaryPrice = (val, digits = 5) => {
  const num = Number(val);
  return (Number.isFinite(num) ? num : 0).toFixed(digits);
};
const fmtSummaryProfit = (val, decimals = 2) => {
  const num = Number(val);
  return (Number.isFinite(num) ? num : 0).toFixed(decimals);
};

const escapeXml = (val) => String(val ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const downloadBlob = (content, mimeType, filename) => {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function deriveUsdConversionRates(positions = []) {
  const rates = { ...FALLBACK_USD_RATES };
  for (const raw of positions) {
    const pos = workspacePosition(raw);
    const sym = String(pos.symbol || '').toUpperCase().replace(/[^A-Z]/g, '');
    const price = pos.current || pos.open;
    if (!price || price <= 0) continue;
    if (sym === 'EURUSD') rates.EUR = 1 / price;
    else if (sym === 'GBPUSD') rates.GBP = 1 / price;
    else if (sym === 'AUDUSD') rates.AUD = 1 / price;
    else if (sym === 'NZDUSD') rates.NZD = 1 / price;
    else if (sym === 'USDJPY') rates.JPY = price;
    else if (sym === 'USDCHF') rates.CHF = price;
    else if (sym === 'USDCAD') rates.CAD = price;
  }
  return rates;
}

function resolveSymbolTermRate(symbol, rates) {
  const clean = String(symbol || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (clean.length >= 6) {
    const quote = clean.slice(3, 6);
    if (rates[quote]) return { rate: rates[quote], decimals: quote === 'JPY' ? 0 : 2 };
  }
  return { rate: 1, decimals: 2 };
}

function TerminalTable({ columns, rows, empty }) {
  return <div className="operations-terminal-scroll"><table><thead><tr>{columns.map(([key, label]) => <th key={key} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id ?? row.ticket ?? index}>{columns.map(([key]) => <td key={key} className={key === 'side' ? row.side.toLowerCase() : key === 'profit' ? (row[key] < 0 ? 'loss' : row[key] > 0 ? 'profit' : '') : ''}>{typeof row[key] === 'number' ? (['ticket', 'login'].includes(key) ? String(row[key]) : value(row[key])) : row[key] || '—'}</td>)}</tr>)}</tbody></table>{!rows.length && <div className="operations-terminal-empty">{empty}</div>}</div>;
}

function SummaryPanel({ positions, query, empty }) {
  const baseRows = useMemo(() => buildMt5SymbolSummary(positions), [positions]);
  const fxRates = useMemo(() => deriveUsdConversionRates(positions), [positions]);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [summaryCurrency, setSummaryCurrency] = useState('USD');
  const [profitMode, setProfitMode] = useState('deposit');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [autoArrange, setAutoArrange] = useState(true);
  const [grid, setGrid] = useState(true);

  const profitUnitLabel = profitMode === 'points'
    ? 'Points'
    : profitMode === 'term'
      ? 'Term'
      : summaryCurrency;

  const columns = useMemo(() => [
    'Symbol',
    'Positions',
    'Buy Volume',
    'Buy Price',
    'Sell Volume',
    'Sell Price',
    'Net Volume',
    `Profit (${profitUnitLabel})`,
    `Uncovered (${profitUnitLabel})`,
  ], [profitUnitLabel]);

  const enrichedRows = useMemo(() => {
    const rate = fxRates[summaryCurrency] ?? 1;
    const depositDecimals = summaryCurrency === 'JPY' ? 0 : 2;
    return baseRows.map(row => {
      let displayProfit = row.profit * rate;
      let displayCoverageProfit = row.coverageProfit * rate;
      let displayUncovered = row.uncoveredProfit * rate;
      let profitDecimals = depositDecimals;

      if (profitMode === 'points') {
        displayProfit = row.pointsProfit ?? 0;
        displayCoverageProfit = 0;
        displayUncovered = row.pointsProfit ?? 0;
        profitDecimals = 1;
      } else if (profitMode === 'term') {
        const term = resolveSymbolTermRate(row.symbol, fxRates);
        displayProfit = row.profit * term.rate;
        displayCoverageProfit = row.coverageProfit * term.rate;
        displayUncovered = row.uncoveredProfit * term.rate;
        profitDecimals = term.decimals;
      }

      const zeroPrice = fmtSummaryPrice(row.coverageBuyPrice, row.digits);
      const formattedProfitCell = `${fmtSummaryProfit(displayProfit, profitDecimals)} / ${fmtSummaryProfit(displayCoverageProfit, profitDecimals)}`;
      const formattedUncoveredCell = fmtSummaryProfit(displayUncovered, profitDecimals);

      return {
        ...row,
        displayProfit,
        displayUncovered,
        cells: [
          row.symbol,
          `${row.positions} / ${row.coveragePositions}`,
          `${fmtSummaryLots(row.buyVolume)} / ${fmtSummaryLots(row.coverageBuyVolume)}`,
          `${fmtSummaryPrice(row.buyPrice, row.digits)} / ${zeroPrice}`,
          `${fmtSummaryLots(row.sellVolume)} / ${fmtSummaryLots(row.coverageSellVolume)}`,
          `${fmtSummaryPrice(row.sellPrice, row.digits)} / ${zeroPrice}`,
          fmtSummaryLots(row.netVolume),
          formattedProfitCell,
          formattedUncoveredCell,
        ],
      };
    });
  }, [baseRows, fxRates, summaryCurrency, profitMode]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = enrichedRows.filter(row => !needle || row.symbol.toLowerCase().includes(needle));
    if (!sortConfig.key) return matched;
    const sorted = [...matched].sort((a, b) => {
      const valA = a[sortConfig.key];
      const valB = b[sortConfig.key];
      if (typeof valA === 'string' || typeof valB === 'string') {
        return String(valA || '').localeCompare(String(valB || ''), undefined, { numeric: true });
      }
      return Number(valA || 0) - Number(valB || 0);
    });
    return sortConfig.direction === 'desc' ? sorted.reverse() : sorted;
  }, [enrichedRows, query, sortConfig]);

  const handleHeaderClick = useCallback((colIndex) => {
    const sortKey = SUMMARY_SORT_KEYS[colIndex];
    if (!sortKey) return;
    setSortConfig(prev => {
      if (prev.key === sortKey) {
        return { key: sortKey, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key: sortKey, direction: 'asc' };
    });
  }, []);

  const handleCopySummary = useCallback(async () => {
    const activeRow = filteredRows.find(r => r.symbol === selectedSymbol) || null;
    const text = activeRow
      ? activeRow.cells.join('\t')
      : [columns.join('\t'), ...filteredRows.map(r => r.cells.join('\t'))].join('\n');
    if (!text) return;
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      // Clipboard write may be restricted in non-secure contexts.
    }
  }, [filteredRows, selectedSymbol, columns]);

  const handleExportReport = useCallback((format) => {
    if (format === 'csv') {
      const csvLines = [
        columns.map(col => `"${String(col).replace(/"/g, '""')}"`).join(','),
        ...filteredRows.map(row => row.cells.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ];
      downloadBlob(csvLines.join('\r\n'), 'text/csv;charset=utf-8', 'summary-report.csv');
      return;
    }
    if (format === 'html') {
      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Summary Report</title>
<style>
  body { font-family: Tahoma, Arial, sans-serif; font-size: 12px; background: #ffffff; color: #111827; margin: 20px; }
  h2 { font-size: 15px; margin-bottom: 10px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; white-space: nowrap; }
  th { background: #f1f5f9; font-weight: 600; }
  tr:nth-child(even) { background: #f8fafc; }
</style>
</head>
<body>
<h2>Summary Report (${escapeXml(profitUnitLabel)})</h2>
<table>
  <thead>
    <tr>${columns.map(col => `<th>${escapeXml(col)}</th>`).join('')}</tr>
  </thead>
  <tbody>
    ${filteredRows.map(row => `<tr>${row.cells.map(cell => `<td>${escapeXml(cell)}</td>`).join('')}</tr>`).join('\n    ')}
  </tbody>
</table>
</body>
</html>`;
      downloadBlob(html, 'text/html;charset=utf-8', 'summary-report.html');
      return;
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Summary">
  <Table>
   <Row>${columns.map(col => `<Cell><Data ss:Type="String">${escapeXml(col)}</Data></Cell>`).join('')}</Row>
   ${filteredRows.map(row => `<Row>${row.cells.map(cell => `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`).join('')}</Row>`).join('\n   ')}
  </Table>
 </Worksheet>
</Workbook>`;
    downloadBlob(xml, 'application/vnd.ms-excel;charset=utf-8', 'summary-report.xml');
  }, [columns, filteredRows, profitUnitLabel]);

  return (
    <SummaryContextMenu
      currency={summaryCurrency}
      profitMode={profitMode}
      autoArrange={autoArrange}
      grid={grid}
      onSelectCurrency={setSummaryCurrency}
      onSelectProfitMode={setProfitMode}
      onCopy={() => void handleCopySummary()}
      onExportReport={handleExportReport}
      onResetSortOrder={() => setSortConfig({ key: null, direction: 'asc' })}
      onToggleAutoArrange={() => setAutoArrange(prev => !prev)}
      onToggleGrid={() => setGrid(prev => !prev)}
    >
      <div
        className={'operations-terminal-scroll operations-summary-scroll' + (grid ? ' has-grid' : ' is-no-grid') + (autoArrange ? ' is-arranged' : ' is-manual-arrange')}
        tabIndex={0}
        onKeyDown={event => {
          if (event.target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]')) return;
          const key = event.key.toLowerCase();
          if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
            if (key === 'c' && !window.getSelection()?.toString()) { event.preventDefault(); void handleCopySummary(); }
            if (key === 'e') { event.preventDefault(); handleExportReport('xml'); }
            if (key === 'h') { event.preventDefault(); handleExportReport('html'); }
          } else if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
            if (key === 'r') { event.preventDefault(); setSortConfig({ key: null, direction: 'asc' }); }
            if (key === 'a') { event.preventDefault(); setAutoArrange(prev => !prev); }
            if (key === 'g') { event.preventDefault(); setGrid(prev => !prev); }
          }
        }}
      >
        <table className="operations-summary-table" aria-label="Symbol summary">
          <colgroup>
            {columns.map(col => (
              <col key={col} className="operations-summary-col" />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={col} scope="col" onClick={() => handleHeaderClick(idx)}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(row => {
              const isSelected = selectedSymbol === row.symbol;
              return (
                <tr
                  key={row.symbol}
                  className={isSelected ? 'is-selected' : undefined}
                  aria-selected={isSelected}
                  onClick={() => setSelectedSymbol(prev => (prev === row.symbol ? null : row.symbol))}
                  onContextMenu={() => setSelectedSymbol(row.symbol)}
                >
                  {row.cells.map((cell, idx) => (
                    <td key={columns[idx]} title={idx === 0 ? row.symbol : undefined}>
                      {cell}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filteredRows.length && <div className="operations-terminal-empty">{empty}</div>}
      </div>
    </SummaryContextMenu>
  );
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
  useWorkspaceStartupReady('terminal', activeTab !== 'Journal' || collapsed || Boolean(journalData.lastUpdatedAt || journalData.error));
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
    if (collapsed || activeTab !== 'Search') return [];
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
    <header className="operations-terminal-heading">
      <div className="operations-terminal-heading-summary">
        <span className="operations-terminal-title"><TerminalSquare size={13} aria-hidden="true" />Operations Terminal</span>
        {!collapsed && <span className="operations-terminal-caption" role="status" title={activeTab === 'Journal' ? journalStatus : undefined}>{activeTab === 'Summary' ? 'Symbol summary · 30s refresh' : activeTab === 'Journal' ? journalStatus.replace(/^Journal\s*·\s*/i, '') : activeTab}</span>}
        {!collapsed && activeTab === 'Journal' && <JournalRecoveryStatus journal={serverJournal} />}
      </div>
      <div className="operations-terminal-controls">
        {!collapsed && activeTab === 'Journal' && <div className="operations-journal-search-control">
          <label className="operations-terminal-search"><Search size={12} aria-hidden="true" /><input aria-label="Search journal" placeholder="Search journal…" value={journalQuery} onChange={event => setJournalQuery(event.target.value)} /></label>
          {journalQuery && <button type="button" className="operations-journal-clear" aria-label="Clear journal search" title="Clear search" onClick={event => { setJournalQuery(''); event.currentTarget.parentElement.querySelector('input')?.focus(); }}><X size={12} aria-hidden="true" /></button>}
        </div>}
        <div className="operations-terminal-actions">
          {!collapsed && activeTab === 'Journal' && <>
            <div className="operations-journal-filter-control"><ListFilter size={12} aria-hidden="true" /><select className="operations-journal-filter" aria-label="Journal filter" value={serverJournal.filter} disabled={!isAuthenticated} onChange={event => serverJournal.setFilter(event.target.value)}>
              {SERVER_JOURNAL_FILTERS.map(filter => <option key={filter.id} value={filter.id}>{filter.label}</option>)}
            </select><ChevronDown size={11} aria-hidden="true" /></div>
            <label className={'operations-journal-live' + (serverJournal.live ? ' is-live' : '') + (serverJournal.delayed ? ' is-delayed' : '')} title={serverJournal.live ? 'Journal refreshes in the background and retries temporary failures automatically.' : 'Live updates are paused. Enable Live to receive the latest journal events.'}><input type="checkbox" checked={serverJournal.live} disabled={!isAuthenticated} onChange={event => serverJournal.setLive(event.target.checked)} />Live</label>
          </>}
          <button type="button" onClick={activeTab === 'Journal' ? () => serverJournal.refresh({ quiet: true }) : refresh} disabled={terminalLoading || (activeTab === 'Journal' && (!isAuthenticated || serverJournal.fetching))} title={activeTab === 'Journal' ? 'Refresh journal' : 'Refresh terminal data'} aria-label={activeTab === 'Journal' ? 'Refresh journal' : 'Refresh terminal data'}><RefreshCw size={13} className={terminalLoading ? 'animate-spin' : ''} /></button>
          <button type="button" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed} aria-label={collapsed ? 'Expand Operations Terminal' : 'Collapse Operations Terminal'} title={collapsed ? 'Expand terminal' : 'Collapse terminal'}>{collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
        </div>
      </div>
    </header>
    {!collapsed && <div className="operations-terminal-body-row">
      <div className="operations-terminal-main-col">
      <div id="operations-terminal-panel" role="tabpanel" aria-labelledby={'terminal-tab-' + activeTab} className="operations-terminal-content">
        {activeTab === 'Summary' && <SummaryPanel positions={positions} query={query} empty={emptyPositions} />}
        {activeTab === 'Search' && <TerminalTable columns={positionColumns} rows={rows} empty={emptyPositions} />}
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
          {activeTab !== 'Journal' && <label className="operations-terminal-search"><Search size={12} aria-hidden="true" /><input aria-label="Search terminal positions" placeholder={activeTab === 'Summary' ? 'Search symbols…' : 'Search positions'} value={query} onChange={event => setQuery(event.target.value)} /></label>}
        </div>}
      </div>
      </div>
    </div>}
  </section>;
}
