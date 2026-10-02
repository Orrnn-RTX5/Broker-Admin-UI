import { useId, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Copy, FileText, Search, X } from 'lucide-react';
import { formatServerJournalTime, matchesServerJournalSearch, serverJournalDetail, serverJournalLogin, severityClass } from '../../utils/serverJournal.js';
import './JournalMenu.css';

// Log metadata can contain credentials in before/after values. Never expose
// those values when inspecting the full record in the viewer.
function safeEvent(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map(item => safeEvent(item, seen));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key, /password|passwd|pwd|secret|token|authorization|api[_-]?key|private[_-]?key|cookie|credential/i.test(key)
      ? '[Redacted]' : safeEvent(item, seen),
  ]));
}

function EntryDetails({ entry }) {
  if (!entry) return <p className="journal-dialog-empty">Select an event to inspect its details.</p>;
  const record = safeEvent(entry);
  const fields = [
    ['Time', formatServerJournalTime(record.time) || '—'],
    ['Type', record.severity || '—'],
    ['Source', record.source || '—'],
    ['Action', record.action || '—'],
    ['Login', serverJournalLogin(record)],
    ['Group', record.group || '—'],
  ];
  return (
    <div className="journal-dialog-entry">
      <dl className="journal-dialog-fields">
        {fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{String(value)}</dd></div>)}
      </dl>
      <div className="journal-dialog-detail-block"><h3>Message</h3><p>{record.message || '—'}</p></div>
      <div className="journal-dialog-detail-block"><h3>Event details</h3><p>{serverJournalDetail(record)}</p></div>
      <details className="journal-dialog-raw"><summary>Raw event data</summary><pre>{JSON.stringify(record, null, 2)}</pre></details>
    </div>
  );
}

function Viewer({ entries, onCopy }) {
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState(null);
  const rows = entries.filter(entry => matchesServerJournalSearch(entry, query));
  const selectedIndex = rows.findIndex((entry, index) => (entry.id ?? index) === selection);
  const currentIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const selectedEntry = rows[currentIndex];

  function selectSibling(event, index) {
    let next;
    if (event.key === 'ArrowDown') next = Math.min(rows.length - 1, index + 1);
    if (event.key === 'ArrowUp') next = Math.max(0, index - 1);
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = rows.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    setSelection(rows[next].id ?? next);
    event.currentTarget.parentElement.children[next]?.focus({ preventScroll: true });
    event.currentTarget.parentElement.children[next]?.scrollIntoView({ block: 'nearest' });
  }

  return (
    <>
      <div className="journal-viewer-toolbar">
        <label className="journal-viewer-search" htmlFor={searchId}>
          <Search size={13} aria-hidden="true" />
          <span className="journal-visually-hidden">Search loaded journal events</span>
          <input id={searchId} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search loaded journal events" type="search" autoComplete="off" />
        </label>
        <span className="journal-viewer-count" role="status">{rows.length.toLocaleString()} of {entries.length.toLocaleString()} events</span>
      </div>
      <div className="journal-viewer-workspace">
        <div className="journal-viewer-list">
          <table aria-label="Loaded journal events">
            <thead><tr><th scope="col">Time</th><th scope="col">Source</th><th scope="col">Message</th></tr></thead>
            <tbody>
              {rows.map((entry, index) => (
                <tr key={entry.id ?? index} tabIndex={index === currentIndex ? 0 : -1} aria-selected={index === currentIndex}
                  className={index === currentIndex ? 'is-selected' : ''}
                  onClick={() => setSelection(entry.id ?? index)} onFocus={() => setSelection(entry.id ?? index)}
                  onKeyDown={event => selectSibling(event, index)}>
                  <td>{formatServerJournalTime(entry.time) || '—'}</td>
                  <td>{entry.source || '—'}</td>
                  <td title={entry.message || ''}><span className={'journal-viewer-type ' + severityClass(entry.severity)} aria-label={entry.severity || 'Info'} />{entry.message || '—'}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={3} className="journal-dialog-empty" role="status">{query.trim() ? 'No loaded events match your search.' : 'No loaded journal events.'}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="journal-viewer-detail"><EntryDetails entry={selectedEntry} /></div>
      </div>
      <div className="journal-dialog-footer">
        <button type="button" className="journal-dialog-button" disabled={!selectedEntry} onClick={() => onCopy(selectedEntry)}><Copy size={13} aria-hidden="true" />Copy entry</button>
        <Dialog.Close asChild><button type="button" className="journal-dialog-button">Close</button></Dialog.Close>
      </div>
    </>
  );
}

export default function JournalDialogs({ mode, entry, entries, onClose, onCopy, onCloseAutoFocus }) {
  const isViewer = mode === 'viewer';
  return (
    <Dialog.Root open={Boolean(mode)} onOpenChange={open => { if (!open) onClose(); }}>
      {mode && <Dialog.Portal>
        <Dialog.Overlay className="journal-dialog-overlay" />
        <Dialog.Content className={'journal-dialog' + (isViewer ? ' is-viewer' : '')} onCloseAutoFocus={onCloseAutoFocus}>
          <div className="journal-dialog-heading">
            <Dialog.Title><FileText size={15} aria-hidden="true" />{isViewer ? 'Journal Viewer' : 'Journal entry'}</Dialog.Title>
            <Dialog.Close asChild><button type="button" className="journal-dialog-close" aria-label="Close journal dialog"><X size={15} aria-hidden="true" /></button></Dialog.Close>
          </div>
          <Dialog.Description className="journal-dialog-description">{isViewer ? 'Loaded journal events. Search the current events and select an entry to inspect its details.' : 'Full details for the selected journal event.'}</Dialog.Description>
          {isViewer ? <Viewer entries={entries} onCopy={onCopy} /> : <>
            <div className="journal-dialog-body"><EntryDetails entry={entry} /></div>
            <div className="journal-dialog-footer">
              <button type="button" className="journal-dialog-button" disabled={!entry} onClick={() => onCopy(entry)}><Copy size={13} aria-hidden="true" />Copy entry</button>
              <Dialog.Close asChild><button type="button" className="journal-dialog-button">Close</button></Dialog.Close>
            </div>
          </>}
        </Dialog.Content>
      </Dialog.Portal>}
    </Dialog.Root>
  );
}
