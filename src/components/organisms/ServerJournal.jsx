import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, LoaderCircle } from 'lucide-react';
import {
  SERVER_JOURNAL_COLUMNS,
  formatServerJournalTime,
  matchesServerJournalSearch,
  serverJournalDetail,
  serverJournalLogin,
  severityClass,
} from '../../utils/serverJournal.js';
import { copyJournalEntry, journalEntryKey, journalMinimumWidth, newestJournalEntry } from '../../utils/serverJournalView.js';
import JournalContextMenu from './JournalContextMenu';
import JournalDialogs from './JournalDialogs';

function JournalRow({ entry, columns, alternate, selected, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();
  const login = serverJournalLogin(entry);
  const severity = severityClass(entry.severity);
  const severityLabel = entry.severity ? entry.severity.charAt(0).toUpperCase() + entry.severity.slice(1) : 'Info';
  const cells = {
    Time: <td key="Time" className="operations-journal-time" title={formatServerJournalTime(entry.time)}>{formatServerJournalTime(entry.time) || '—'}</td>,
    Type: <td key="Type" title={severityLabel}><span className={'operations-journal-severity ' + severity}>{severityLabel}</span></td>,
    Source: <td key="Source" title={[entry.source, entry.category].filter(Boolean).join(' · ')}>{entry.source || '—'}</td>,
    Action: <td key="Action" title={entry.action || ''}>{entry.action || '—'}</td>,
    Login: <td key="Login" className="operations-journal-login" title={String(login)}>{login}</td>,
    Group: <td key="Group" className="operations-journal-group" title={entry.group || ''}>{entry.group || '—'}</td>,
    Message: <td key="Message" className="operations-journal-message" title={entry.message || ''}>{entry.message || '—'}</td>,
  };
  return (
    <Fragment>
      <tr
        data-journal-key={journalEntryKey(entry)}
        className={'operations-journal-row' + (alternate ? ' is-alternate' : '') + (selected ? ' is-selected' : '')}
        onClick={event => {
          onSelect();
          if (!event.target.closest('button')) event.currentTarget.querySelector('button')?.focus({ preventScroll: true });
        }}
        onFocus={onSelect}
        onContextMenu={event => { onSelect(); event.currentTarget.querySelector('button')?.focus({ preventScroll: true }); }}
        onDoubleClick={event => { if (!event.target.closest('button')) setExpanded(value => !value); }}
        onKeyDown={event => {
          if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
          event.preventDefault();
          const rows = [...event.currentTarget.parentElement.querySelectorAll('.operations-journal-row')];
          rows[rows.indexOf(event.currentTarget) + (event.key === 'ArrowDown' ? 1 : -1)]?.querySelector('button')?.focus();
        }}
      >
        <td className="operations-journal-expander-cell">
          <button
            type="button"
            className="operations-journal-expander"
            aria-label={expanded ? 'Collapse journal details' : 'Expand journal details'}
            aria-expanded={expanded}
            aria-controls={expanded ? detailId : undefined}
            onClick={() => setExpanded(value => !value)}
          >{expanded ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}</button>
        </td>
        {columns.map(label => cells[label])}
      </tr>
      {expanded && (
        <tr id={detailId} className="operations-journal-detail" onContextMenu={event => {
          onSelect();
          event.currentTarget.previousElementSibling?.querySelector('button')?.focus({ preventScroll: true });
        }}>
          <td colSpan={columns.length + 1}>
            <div className="operations-journal-detail-body">
              <strong>Event details</strong>
              <p className="operations-journal-detail-message">{entry.message || '—'}</p>
              <p>{serverJournalDetail(entry)}</p>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

export default function ServerJournal({ journal, query, isAuthenticated }) {
  const [selectedKey, setSelectedKey] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [autoArrange, setAutoArrange] = useState(true);
  const [grid, setGrid] = useState(true);
  const [columns, setColumns] = useState(SERVER_JOURNAL_COLUMNS);
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState('');
  const scroller = useRef(null);
  const lastFollow = useRef({ enabled: false, key: null, view: '', live: false });
  const scrollPosition = useRef({ top: 0, following: true, intentUntil: 0 });
  const needle = query.trim().toLowerCase();
  const rows = journal.entries.filter(entry => matchesServerJournalSearch(entry, needle));
  const selectedEntry = rows.find(entry => journalEntryKey(entry) === selectedKey) || null;
  const latest = newestJournalEntry(rows);
  const latestKey = latest ? journalEntryKey(latest) : null;
  const view = JSON.stringify([journal.key, journal.revision]);
  useLayoutEffect(() => {
    const previous = lastFollow.current;
    lastFollow.current = { enabled: autoScroll, key: latestKey, view, live: journal.live };
    const node = scroller.current;
    if (!node) return;
    const reset = previous.view !== view;
    const resumed = journal.live && !previous.live;
    if (reset) {
      node.scrollTop = 0;
      scrollPosition.current = { top: 0, following: true, intentUntil: 0 };
    }
    if (autoScroll && (!previous.enabled || resumed)) scrollPosition.current.following = true;
    if (resumed || previous.key !== latestKey) scrollPosition.current.intentUntil = 0;
    if (autoScroll && latestKey && scrollPosition.current.following
      && (reset || resumed || !previous.enabled || previous.key !== latestKey)) {
      const row = [...node.querySelectorAll('.operations-journal-row')].find(row => row.dataset.journalKey === latestKey);
      if (row) node.scrollTop += row.getBoundingClientRect().top - node.getBoundingClientRect().top - (node.querySelector('thead')?.getBoundingClientRect().height || 0);
    }
    scrollPosition.current.top = node.scrollTop;
  }, [autoScroll, latestKey, view, journal.live]);
  const rememberScrollIntent = () => { scrollPosition.current.intentUntil = Date.now() + 1500; };
  const handleScroll = event => {
    const node = event.currentTarget;
    const movedDown = node.scrollTop > scrollPosition.current.top + 1;
    const userScroll = Date.now() < scrollPosition.current.intentUntil;
    scrollPosition.current.top = node.scrollTop;
    if (userScroll && movedDown) scrollPosition.current.following = false;
    else if (userScroll && node.scrollTop <= 1) scrollPosition.current.following = true;
    // Fetch before the last visible rows run out. The hook owns the request
    // lock, so fast wheel/touch/keyboard scrolling still starts one batch.
    if (userScroll && movedDown && node.scrollHeight - node.scrollTop - node.clientHeight <= 208
      && isAuthenticated && journal.cursor && !journal.loading && !journal.loadingOlder
      && !journal.error && !journal.olderError && !journal.cleared && !needle) journal.loadOlder();
  };
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  const copy = async entry => {
    if (!entry) return;
    try { await copyJournalEntry(entry); setNotice('Journal entry copied.'); }
    catch (error) { setNotice(error.message); }
  };
  const toggleColumn = label => setColumns(previous => {
    if (previous.includes(label) && previous.length === 1) return previous;
    const next = previous.includes(label) ? previous.filter(column => column !== label) : [...previous, label];
    return SERVER_JOURNAL_COLUMNS.filter(column => next.includes(column));
  });
  const empty = !isAuthenticated ? 'Sign in to view the broker journal.'
    : journal.delayed && !journal.lastUpdatedAt ? (journal.live ? 'Waiting for journal updates. Retrying automatically…' : 'Journal updates are paused. Enable Live or refresh to try again.')
      : journal.loading ? 'Loading journal…'
      : journal.error ? 'Journal events could not be loaded.'
        : needle ? 'No journal events match your search.' : journal.cleared ? 'Journal display cleared.' : 'No journal events available.';

  return (
    <div className={'operations-journal' + (grid ? ' has-grid' : '') + (autoArrange ? ' is-arranged' : ' is-unarranged')}
      onKeyDown={event => {
        if (event.target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]')) return;
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
          if (selectedEntry && !window.getSelection()?.toString()) { event.preventDefault(); copy(selectedEntry); }
        } else if (!event.ctrlKey && !event.metaKey && !event.altKey) {
          if (event.key.toLowerCase() === 'a') { event.preventDefault(); setAutoArrange(value => !value); }
          if (event.key.toLowerCase() === 'g') { event.preventDefault(); setGrid(value => !value); }
        }
      }}>
      {journal.error && (
        <div className="operations-journal-error" role="alert">
          <span>{journal.error}</span>
          <button type="button" onClick={() => journal.refresh({ quiet: true })} disabled={journal.loading || journal.fetching || !isAuthenticated}>Retry</button>
        </div>
      )}
      {journal.cleared && <div className="operations-journal-display-notice"><span>Cleared events are hidden from this view.</span><button type="button" onClick={journal.restore}>Restore journal</button></div>}
      {notice && <div className="operations-journal-copy-notice" role="status">{notice}</div>}
      <JournalContextMenu
        selectedEntry={selectedEntry} canClear={!!journal.entries.length} autoScroll={autoScroll} autoArrange={autoArrange} grid={grid} columns={columns}
        onOpen={() => setDialog('entry')} onCopy={() => copy(selectedEntry)} onViewer={() => setDialog('viewer')}
        onClear={() => { journal.clear(); setSelectedKey(null); setDialog(null); }}
        onAutoScrollChange={setAutoScroll} onAutoArrangeChange={setAutoArrange} onGridChange={setGrid}
        onColumnToggle={toggleColumn} onRestoreColumns={() => setColumns(SERVER_JOURNAL_COLUMNS)}
      >
      <div ref={scroller} className="operations-terminal-scroll" tabIndex={0} aria-label="Journal events"
        onScroll={handleScroll}
        onWheel={rememberScrollIntent}
        onTouchMove={rememberScrollIntent}
        onPointerDown={event => { if (event.target === event.currentTarget) rememberScrollIntent(); }}
        onKeyDown={event => {
          if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) rememberScrollIntent();
          if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
          event.preventDefault();
          event.stopPropagation();
          const anchor = event.target.closest('.operations-journal-row') || event.currentTarget;
          const bounds = anchor.getBoundingClientRect();
          anchor.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: Math.max(8, bounds.left + 14), clientY: Math.max(8, bounds.top + Math.min(bounds.height, 26)) }));
        }}>
        <table className="operations-journal-table" style={{ '--journal-min-width': journalMinimumWidth(columns) + 'px' }} aria-label="Server journal" aria-busy={journal.loading || journal.loadingOlder}>
          <colgroup>
            <col className="operations-journal-column-details" />
            {columns.map(label => <col key={label} className={'operations-journal-column-' + label.toLowerCase()} />)}
          </colgroup>
          <thead><tr><th scope="col" aria-label="Details" />{columns.map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>
            {rows.map((entry, index) => {
              const key = journalEntryKey(entry);
              return <JournalRow key={key} entry={entry} columns={columns} alternate={index % 2 === 1} selected={selectedKey === key} onSelect={() => setSelectedKey(key)} />;
            })}
            {!rows.length && <tr><td colSpan={columns.length + 1} className="operations-journal-empty" role="status">{empty}</td></tr>}
            {journal.cursor && !needle && (
              <tr><td colSpan={columns.length + 1} className="operations-journal-pagination">
                <div className="operations-journal-page-status">
                  <span role="status" aria-live="polite" title={journal.olderError || undefined}>
                    {journal.loadingOlder && <LoaderCircle size={12} className="operations-journal-loading-icon" aria-hidden="true" />}
                    {journal.loadingOlder ? 'Loading older events…' : journal.olderError ? 'Older events could not be loaded.' : 'Scroll for more events'}
                  </span>
                  {!journal.loadingOlder && <button type="button" onClick={journal.loadOlder} disabled={journal.loading || !isAuthenticated}>
                    {journal.olderError ? 'Retry older events' : 'Load older events'}
                  </button>}
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      </JournalContextMenu>
      <JournalDialogs key={journal.filter + ':' + dialog + ':' + selectedKey} mode={isAuthenticated && (dialog !== 'entry' || selectedEntry) ? dialog : null} entry={selectedEntry} entries={journal.entries} onClose={() => setDialog(null)} onCopy={copy}
        onCloseAutoFocus={event => {
          event.preventDefault();
          const selected = [...(scroller.current?.querySelectorAll('.operations-journal-row') || [])].find(row => row.dataset.journalKey === selectedKey);
          (selected?.querySelector('button') || scroller.current)?.focus({ preventScroll: true });
        }} />
    </div>
  );
}
