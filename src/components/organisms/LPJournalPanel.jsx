import LPNativePendingRead from './LPNativePendingRead.jsx';
import LPClosedAllocationRead from './LPClosedAllocationRead.jsx';
import LPClosedRecoveryRead from './LPClosedRecoveryRead.jsx';
import LPReportRiskRead from './LPReportRiskRead.jsx';
import LPPositionLifecycleRead from './LPPositionLifecycleRead.jsx';
import LPCleanupRead from './LPCleanupRead.jsx';
import LPCleanupRecoveryPanel from './LPCleanupRecoveryPanel.jsx';
import LPExposureSummaryPanel from './LPExposureSummaryPanel.jsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { exposureColumns, journalState, lpJournal } from '../../services/lpJournal.js';
import { useAuthStore } from '../../store/authStore.js';
import './lp-journal.css';

const adminPermissions = { can: () => true };
const summaryColumns = ['Intent', 'Source', 'Account', 'Symbol / side', 'State', 'Customer status', 'Revision', 'Known wire qty', 'Raw LP average price'];

export default function LPJournalPanel() {
  const session = useAuthStore(state => state.accessToken);
  return session ? <JournalWorkspace key={session} sessionKey={session} permissions={adminPermissions} /> : null;
}

function JournalWorkspace({ permissions, sessionKey }) {
  const allowed = Boolean(permissions?.can('view'));
  const [rows, setRows] = useState([]);
  const [next, setNext] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCursors, setPageCursors] = useState(['']);
  const [selected, setSelected] = useState(null);
  const [events, setEvents] = useState([]);
  const [historyNext, setHistoryNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);

  const load = useCallback(async (cursor, page = 1) => {
    const token = ++generation.current;
    setBusy(true); setError('');
    try {
      const result = await lpJournal.list(cursor);
      if (token === generation.current) {
        setRows(result.entries);
        setNext(result.next_cursor);
        setPageNumber(page);
        setPageCursors(old => page === 1 ? [''] : [...old.slice(0, page - 1), cursor]);
        setSelected(null);
        setEvents([]);
        setHistoryNext('');
      }
    } catch (e) { if (token === generation.current) setError(e.message || 'Unable to load the journal.'); }
    finally { if (token === generation.current) setBusy(false); }
  }, []);

  useEffect(() => {
    if (allowed) load('', 1);
    else { generation.current++; setRows([]); setSelected(null); setEvents([]); setNext(''); }
    const requestGeneration = generation;
    return () => { requestGeneration.current++; };
  }, [allowed, sessionKey, permissions?.revision, load]);

  const inspect = async entry => {
    const token = ++generation.current;
    setBusy(true); setError(''); setSelected(null); setEvents([]); setHistoryNext('');
    try {
      const fresh = await lpJournal.get(entry.intent_id);
      const history = await lpJournal.history(fresh);
      if (token === generation.current) {
        setSelected(fresh);
        setEvents(history.events);
        setHistoryNext(history.next_revision);
      }
    } catch (e) { if (token === generation.current) setError(e.message || 'Unable to inspect this intent.'); }
    finally { if (token === generation.current) setBusy(false); }
  };
  const moreHistory = async () => {
    const token = ++generation.current;
    setBusy(true); setError('');
    try {
      const result = await lpJournal.history(selected, historyNext);
      if (token === generation.current) {
        setEvents(old => [...old, ...result.events]);
        setHistoryNext(result.next_revision);
      }
    } catch (e) { if (token === generation.current) setError(e.message || 'Unable to load more history.'); }
    finally { if (token === generation.current) setBusy(false); }
  };

  if (!allowed) return null;
  const details = selected && [
    ['Command', selected.command_id], ['Trade source', selected.connection_id], ['Quote source', selected.quote_connection_id],
    ['Action', selected.action], ['Revision', selected.revision], ['LP phase', selected.phase],
    ['Customer status', selected.customer_status], ['Possibly sent', selected.possibly_sent ? 'Yes' : 'No'],
    ['Reconciliation required', selected.reconciliation_required ? 'Yes' : 'No'],
    ['Fault code', selected.fault_code || 'None recorded'], ['Booking reference', selected.booking_ref || 'Not booked'],
    ['Raw LP cumulative fee', selected.cumulative_fee ?? 'Unknown'], ['Customer lots', selected.allocation?.customer_lots],
    ['LP requested lots', selected.allocation?.lp_requested_lots], ['Units per lot', selected.allocation?.units_per_lot],
    ['Leaves wire quantity', selected.leaves_wire_qty],
  ];

  return <section className="lp-journal" aria-labelledby="lp-journal-title">
    <header>
      <div><h2 id="lp-journal-title">Execution journal and exposure</h2><p>Inspect durable execution evidence and gross opening attribution for each intent.</p></div>
      <button type="button" disabled={busy} onClick={() => load('', 1)}>Refresh journal</button>
    </header>
    <LPExposureSummaryPanel />
    <p className="lp-journal-note">These quantities are not remaining open balances after closes. Unknown execution and fees remain unresolved. This view cannot send cleanup orders or book customers.</p>
    {error && <p role="alert" className="lp-journal-message lp-journal-error">{error}</p>}
    {busy && <p role="status" className="lp-journal-progress">Loading journal information…</p>}
    {rows.length > 0 && <>
      <div className="lp-journal-list-heading"><h3>Journal entries</h3><span>Page {pageNumber} · {rows.length} {rows.length === 1 ? 'entry' : 'entries'}</span></div>
      <div className="lp-journal-scroll" role="region" aria-label="Execution journal entries" tabIndex="0">
        <table><thead><tr>{summaryColumns.map(label => <th key={label} scope="col">{label}</th>)}<th scope="col">Action</th></tr></thead><tbody>
          {rows.map(entry => <tr key={entry.intent_id} aria-current={selected?.intent_id === entry.intent_id ? 'true' : undefined}>
            <td>{entry.intent_id}</td><td>{entry.connection_id}</td><td>{entry.account_id}</td><td>{entry.symbol} / {entry.side}</td>
            <td>{journalState(entry)}</td><td>{entry.customer_status}</td><td>{entry.revision}</td><td>{entry.cumulative_wire_qty}</td><td>{entry.average_price}</td>
            <td><button type="button" disabled={busy} onClick={() => inspect(entry)} aria-label={`Inspect intent ${entry.intent_id}`}>Inspect</button></td>
          </tr>)}
        </tbody></table>
      </div>
    </>}
    {!busy && !rows.length && <div className="lp-journal-empty"><strong>No journal entries on this page</strong><p>{next ? 'Continue to the next scoped page to see more entries.' : 'Entries will appear when execution evidence is available.'}</p></div>}
    {(pageNumber > 1 || next) && <div className="lp-journal-pagination">
      {pageNumber > 1 && <button type="button" disabled={busy} onClick={() => load(pageCursors[pageNumber - 2], pageNumber - 1)}>Previous page</button>}
      {next && <button type="button" disabled={busy} onClick={() => load(next, pageNumber + 1)}>Next journal page</button>}
    </div>}

    {selected && <article aria-labelledby="lp-journal-detail-title">
      <div className="lp-journal-detail-heading"><div><h3 id="lp-journal-detail-title">Intent {selected.intent_id}</h3><p>Current journal detail and evidence</p></div></div>
      <dl className="lp-journal-details">{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Unavailable'}</dd></div>)}</dl>
      <p className="lp-journal-note">Raw provider fees have no verified currency or accounting meaning here; they are not a customer fee ledger.</p>
      <LPNativePendingRead pending={selected.native_pending} />
      <LPClosedAllocationRead certificate={selected.closed_allocation} />
      <LPClosedRecoveryRead recovery={selected.closed_recovery} />
      <LPReportRiskRead risk={selected.report_risk} />
      <LPPositionLifecycleRead lifecycle={selected.position_lifecycle} />
      <LPCleanupRead cleanup={selected.cleanup} />
      {['escalated', 'held', 'reconcile_required'].includes(selected.cleanup?.status) && <LPCleanupRecoveryPanel key={selected.intent_id + ':' + selected.cleanup.revision} intentID={selected.intent_id} />}
      {selected.exposure && <><h3>Current gross opening attribution</h3><dl className="lp-journal-details">{exposureColumns.map(([key, label]) => <div key={key}><dt>{label} (wire)</dt><dd>{selected.exposure[key]}</dd></div>)}</dl></>}
      <h3>Immutable gross opening attribution history</h3>
      {events.length > 0 && <div className="lp-journal-scroll" role="region" aria-label="Gross opening attribution history" tabIndex="0">
        <table><thead><tr><th scope="col">Revision</th><th scope="col">LP phase</th><th scope="col">Customer status</th>{exposureColumns.map(([key, label]) => <th key={key} scope="col">{label} (wire)</th>)}<th scope="col">Units / lot</th><th scope="col">Raw LP average price</th><th scope="col">Raw LP fee</th><th scope="col">Reconciliation</th></tr></thead><tbody>
          {events.map(event => <tr key={event.revision}><td>{event.revision}</td><td>{event.phase}</td><td>{event.customer_status}</td>{exposureColumns.map(([key]) => <td key={key}>{event[key]}</td>)}<td>{event.units_per_lot}</td><td>{event.average_price}</td><td>{event.cumulative_fee ?? 'Unknown'}</td><td>{event.reconciliation_required ? 'Required' : 'Not required by this event'}</td></tr>)}
        </tbody></table>
      </div>}
      {!events.length && <p className="lp-journal-empty">No opening attribution events recorded. Control and close operations are not additional opening exposure.</p>}
      {historyNext && <button type="button" disabled={busy} onClick={moreHistory}>Load older-to-newer history page</button>}
    </article>}
  </section>;
}
