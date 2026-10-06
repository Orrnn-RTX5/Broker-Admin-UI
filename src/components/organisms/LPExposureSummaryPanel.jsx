import { useCallback, useEffect, useRef, useState } from 'react';
import { exposureSummaryColumns, lpExposureSummary } from '../../services/lpExposureSummary.js';
import LPPositionReconciliationPanel from './LPPositionReconciliationPanel.jsx';

export default function LPExposureSummaryPanel() {
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const load = useCallback(async () => {
    const token = ++generation.current;
    setBusy(true); setError(''); setSummary(null);
    try {
      const result = await lpExposureSummary.get();
      if (generation.current === token) setSummary(result);
    } catch {
      if (generation.current === token) setError('The complete A-Book exposure summary could not be loaded. Refresh to retry.');
    } finally {
      if (generation.current === token) setBusy(false);
    }
  }, []);
  useEffect(() => { load(); return () => { generation.current++; }; }, [load]);
  return <section aria-label="Aggregate A-Book exposure">
    <div className="lp-journal-list-heading"><div><h3>A-Book exposure summary</h3><p>All recorded opening intents for this broker, independent of the journal page.</p></div><button type="button" disabled={busy} onClick={load}>Refresh exposure totals</button></div>
    <p className="lp-journal-note">Opening attribution is cumulative. Recorded remaining quantity uses confirmed close or cleanup evidence; unknown evidence keeps it unavailable. Sources, symbols, sides and lot units are kept separate. These records do not confirm current provider positions or a flat native account.</p>
    {busy && <p role="status">Loading the complete exposure book…</p>}
    {error && <p role="alert" className="lp-journal-error">{error}</p>}
    {summary && <>
      <p>Snapshot {new Date(summary.as_of).toLocaleString()} · {summary.intent_count} opening intents</p>
      {summary.missing_attribution_count !== '0' && <p role="alert">{summary.missing_attribution_count} opening intents have no current attribution. Their quantities are unknown and are excluded from the recorded totals below.</p>}
      {summary.groups.length === 0 ? <p>No opening attribution is recorded.</p> : <div className="lp-journal-scroll" role="region" aria-label="Aggregate exposure totals" tabIndex="0"><table><thead><tr><th scope="col">Source / provider</th><th scope="col">Symbol / side</th><th scope="col">Units / lot</th><th scope="col">Intents</th>{exposureSummaryColumns.map(([key, label]) => <th scope="col" key={key}>{label} (wire)</th>)}<th scope="col">Recorded remaining (wire)</th><th scope="col">Review</th></tr></thead><tbody>{summary.groups.map((group, index) => <tr key={index}>
        <td>{group.connection_id} / {group.provider}</td><td>{group.symbol} / {group.side}</td><td>{group.units_per_lot}</td><td>{group.intent_count}</td>{exposureSummaryColumns.map(([key]) => <td key={key}>{group[key]}</td>)}<td>{group.recorded_remaining_wire_qty ?? 'Unknown'}</td><td>{group.remaining_unknown_count !== '0' && <span>{group.remaining_unknown_count} remaining quantities unknown. </span>}{group.reconciliation_count !== '0' ? `${group.reconciliation_count} reconciliation holds` : 'No hold recorded'}</td>
      </tr>)}</tbody></table></div>}
    </>}
    <LPPositionReconciliationPanel connectionIDs={[...new Set((summary?.groups || []).map(group => group.connection_id))]} />
  </section>;
}
