import { useEffect, useId, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, Copy, FileSearch, FolderOpen, Search, X } from 'lucide-react';
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

function formatSeverityLabel(severity) {
  const text = String(severity || '').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Info';
}

function buildDiagnosticChips(record) {
  if (!record) return [];
  const chips = [];
  if (record.actor_id) {
    chips.push({
      key: 'actor',
      label: 'Actor',
      value: [record.actor_type, record.actor_id].filter(Boolean).join(' '),
    });
  }
  if (record.actor_ip) {
    chips.push({ key: 'ip', label: 'IP', value: record.actor_ip, mono: true });
  }
  if (record.result) {
    const isDenied = /denied|fail|error|reject/i.test(String(record.result));
    chips.push({
      key: 'result',
      label: 'Result',
      value: record.result,
      tone: isDenied ? 'is-error' : 'is-success',
    });
  }
  if (record.error_code) {
    chips.push({ key: 'code', label: 'Code', value: record.error_code, mono: true, tone: 'is-warn' });
  }
  if (record.metadata?.method && record.metadata?.path) {
    chips.push({
      key: 'endpoint',
      label: 'Endpoint',
      value: `${record.metadata.method} ${record.metadata.path}`,
      mono: true,
    });
  }
  if (record.request_id) {
    chips.push({ key: 'req', label: 'Request ID', value: record.request_id, mono: true });
  }
  return chips;
}

function EntryDetails({ entry }) {
  if (!entry) return <p className="journal-dialog-empty">Select an event to inspect its details.</p>;
  const record = useMemo(() => safeEvent(entry), [entry]);
  const tone = severityClass(record.severity);
  const severityLabel = formatSeverityLabel(record.severity);
  const diagnosticChips = useMemo(() => buildDiagnosticChips(record), [record]);

  return (
    <div className="journal-dialog-entry">
      <div className="journal-dialog-section-header">
        <span className="journal-dialog-section-label">Entry Details</span>
        {(record.request_id || record.id) && (
          <span className="journal-dialog-ref" title="Audit reference ID">
            {record.request_id ? `REQ · ${record.request_id}` : `ID · ${record.id}`}
          </span>
        )}
      </div>

      <dl className="journal-dialog-fields">
        <div className="journal-field-cell">
          <dt className="journal-field-label">Time</dt>
          <dd className="journal-field-value is-mono">{formatServerJournalTime(record.time) || '—'}</dd>
        </div>
        <div className="journal-field-cell">
          <dt className="journal-field-label">Severity</dt>
          <dd className="journal-field-value">
            <span className={`journal-status-pill is-compact ${tone}`}>
              <span className="journal-status-dot" aria-hidden="true" />
              {severityLabel}
            </span>
          </dd>
        </div>
        <div className="journal-field-cell">
          <dt className="journal-field-label">Source</dt>
          <dd className="journal-field-value">{String(record.source || '—')}</dd>
        </div>
        <div className="journal-field-cell">
          <dt className="journal-field-label">Action</dt>
          <dd className="journal-field-value is-mono is-accent">{String(record.action || '—')}</dd>
        </div>
        <div className="journal-field-cell">
          <dt className="journal-field-label">Login</dt>
          <dd className="journal-field-value is-mono">{String(serverJournalLogin(record))}</dd>
        </div>
        <div className="journal-field-cell">
          <dt className="journal-field-label">Group</dt>
          <dd className="journal-field-value is-mono">{String(record.group || '—')}</dd>
        </div>
      </dl>

      <div className="journal-dialog-panels">
        <div className={`journal-detail-panel is-message ${tone}`}>
          <div className="journal-detail-panel-header">
            <h3 className="journal-detail-panel-title">Message</h3>
          </div>
          <p className="journal-detail-panel-body">{record.message || '—'}</p>
        </div>

        <div className="journal-detail-panel is-diagnostics">
          <div className="journal-detail-panel-header">
            <h3 className="journal-detail-panel-title">Details &amp; Telemetry</h3>
            {diagnosticChips.length > 0 && (
              <div className="journal-telemetry-chips">
                {diagnosticChips.map(chip => (
                  <span
                    key={chip.key}
                    className={`journal-telemetry-chip${chip.mono ? ' is-mono' : ''}${chip.tone ? ` ${chip.tone}` : ''}`}
                  >
                    <span className="journal-telemetry-chip-key">{chip.label}:</span>
                    <strong className="journal-telemetry-chip-val">{chip.value}</strong>
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="journal-detail-panel-code">{serverJournalDetail(record)}</p>
        </div>

        <details className="journal-dialog-raw">
          <summary>Raw event data</summary>
          <pre>{JSON.stringify(record, null, 2)}</pre>
        </details>
      </div>
    </div>
  );
}

function Viewer({ entries, onCopy, copied, onTriggerCopy }) {
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
          <input id={searchId} value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter loaded journal events…" type="search" autoComplete="off" />
        </label>
        <span className="journal-viewer-count" role="status">{rows.length.toLocaleString()} of {entries.length.toLocaleString()} events</span>
      </div>
      <div className="journal-viewer-workspace">
        <div className="journal-viewer-list">
          <table aria-label="Loaded journal events">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Type</th>
                <th scope="col">Source</th>
                <th scope="col">Action</th>
                <th scope="col">Login</th>
                <th scope="col">Message</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry, index) => (
                <tr key={entry.id ?? index} tabIndex={index === currentIndex ? 0 : -1} aria-selected={index === currentIndex}
                  className={index === currentIndex ? 'is-selected' : ''}
                  onClick={() => setSelection(entry.id ?? index)} onFocus={() => setSelection(entry.id ?? index)}
                  onKeyDown={event => selectSibling(event, index)}>
                  <td className="journal-viewer-time">{formatServerJournalTime(entry.time) || '—'}</td>
                  <td><span className={'journal-viewer-type ' + severityClass(entry.severity)}>{formatSeverityLabel(entry.severity)}</span></td>
                  <td>{entry.source || '—'}</td>
                  <td className="journal-viewer-mono">{entry.action || '—'}</td>
                  <td className="journal-viewer-mono">{serverJournalLogin(entry)}</td>
                  <td title={entry.message || ''}>{entry.message || '—'}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} className="journal-dialog-empty" role="status">{query.trim() ? 'No loaded events match your search.' : 'No loaded journal events.'}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="journal-viewer-detail"><EntryDetails entry={selectedEntry} /></div>
      </div>
      <div className="journal-dialog-footer">
        <div className="journal-dialog-footer-meta">
          <span className="journal-kbd-hint"><kbd>Esc</kbd> to close</span>
        </div>
        <div className="journal-dialog-footer-actions">
          <button
            type="button"
            className={'journal-dialog-button' + (copied ? ' is-copied' : '')}
            disabled={!selectedEntry}
            onClick={() => onTriggerCopy(selectedEntry, onCopy)}
          >
            {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy entry'}
          </button>
          <Dialog.Close asChild><button type="button" className="journal-dialog-button is-primary">Close</button></Dialog.Close>
        </div>
      </div>
    </>
  );
}

export default function JournalDialogs({ mode, entry, entries, onClose, onCopy, onCloseAutoFocus }) {
  const isViewer = mode === 'viewer';
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [mode, entry]);

  const handleTriggerCopy = (targetEntry, copyFn = onCopy) => {
    if (!targetEntry) return;
    copyFn?.(targetEntry);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const activeTone = !isViewer && entry ? severityClass(entry.severity) : 'is-info';
  const activeSeverityLabel = !isViewer && entry ? formatSeverityLabel(entry.severity) : 'Info';

  return (
    <Dialog.Root open={Boolean(mode)} onOpenChange={open => { if (!open) onClose(); }}>
      {mode && <Dialog.Portal>
        <Dialog.Overlay className="journal-dialog-overlay" />
        <Dialog.Content
          className={'journal-dialog' + (isViewer ? ' is-viewer' : ' is-entry-dialog') + ' ' + activeTone}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <div className="journal-dialog-heading">
            <div className="journal-dialog-title-wrap">
              <span className={`journal-dialog-icon ${activeTone}`} aria-hidden="true">
                {isViewer ? <FileSearch size={14} /> : <FolderOpen size={14} />}
              </span>
              <div className="journal-dialog-title-group">
                <Dialog.Title className="journal-dialog-title-text">
                  {isViewer ? 'Journal Viewer' : 'Journal Entry'}
                </Dialog.Title>
                <Dialog.Description className="journal-dialog-description">
                  {isViewer
                    ? `${entries.length.toLocaleString()} loaded ${entries.length === 1 ? 'event' : 'events'} · Search and inspect audit records`
                    : 'Server Audit Record'}
                </Dialog.Description>
              </div>
            </div>
            <div className="journal-dialog-header-actions">
              {!isViewer && entry && (
                <div className="journal-dialog-header-badges">
                  {entry.category && (
                    <span className="journal-category-badge">{entry.category}</span>
                  )}
                  <span className={`journal-status-pill ${activeTone}`}>
                    <span className="journal-status-dot" aria-hidden="true" />
                    {activeSeverityLabel}
                  </span>
                </div>
              )}
              {!isViewer && (
                <button
                  type="button"
                  className={'journal-dialog-button is-header-btn' + (copied ? ' is-copied' : '')}
                  disabled={!entry}
                  onClick={() => handleTriggerCopy(entry)}
                >
                  {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
              <Dialog.Close asChild>
                <button type="button" className="journal-dialog-close" aria-label="Close journal dialog">
                  <X size={15} aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>
          </div>
          {isViewer ? (
            <Viewer entries={entries} onCopy={onCopy} copied={copied} onTriggerCopy={handleTriggerCopy} />
          ) : (
            <>
              <div className="journal-dialog-body"><EntryDetails entry={entry} /></div>
              <div className="journal-dialog-footer">
                <div className="journal-dialog-footer-meta">
                  <span className="journal-kbd-hint"><kbd>Esc</kbd> to close</span>
                </div>
                <div className="journal-dialog-footer-actions">
                  <button
                    type="button"
                    className={'journal-dialog-button' + (copied ? ' is-copied' : '')}
                    disabled={!entry}
                    onClick={() => handleTriggerCopy(entry)}
                  >
                    {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                    {copied ? 'Copied' : 'Copy entry'}
                  </button>
                  <Dialog.Close asChild>
                    <button type="button" className="journal-dialog-button is-primary">Close</button>
                  </Dialog.Close>
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>}
    </Dialog.Root>
  );
}
