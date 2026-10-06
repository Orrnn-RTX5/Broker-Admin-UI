import { useCallback, useEffect, useRef, useState } from 'react';
import { lpRouting } from '../../services/lpRouting.js';
import { lpPositionReconciliation } from '../../services/lpPositionReconciliation.js';

const reasons = {missing_at_lp: 'Recorded position missing at provider', unmapped_at_lp: 'Provider position has no recorded allocation', position_differs: 'Position identity or quantity differs'};
const positionText = position => position ? `${position.symbol_id} / ${position.side} / ${position.wire_quantity} wire` : 'No position';

export default function LPPositionReconciliationPanel({ connectionIDs = [] }) {
  const [connections, setConnections] = useState([]);
  const [connection, setConnection] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const generation = useRef(0), connectionGeneration = useRef(0);
  const reloadConnections = useCallback(async () => {
    const token = ++connectionGeneration.current;
    generation.current++; setResult(null); setError(''); setBusy(false); setConnectionError('');
    try {
      const data = await lpRouting.connections();
      if (!Array.isArray(data.connections)) throw new Error('Invalid provider list');
      const choices = data.connections.map(item => item.config).filter(item => /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(item?.id) && Number.isSafeInteger(item.revision) && item.revision > 0);
      if (connectionGeneration.current === token) setConnections(choices);
    } catch {
      if (connectionGeneration.current === token) setConnectionError('Saved provider connections could not be loaded. Connections with recorded exposure can still be inspected.');
    }
  }, []);
  useEffect(() => {
    reloadConnections();
    return () => { generation.current++; connectionGeneration.current++; };
  }, [reloadConnections]);
  useEffect(() => {
    if (!result) return;
    const token = generation.current;
    const expiry = Date.parse(result.valid_until);
    const expireIfStale = () => {
      if (generation.current === token && Date.now() >= expiry) { setResult(null); setError('The position observation expired. Inspect the provider again for a current comparison.'); }
    };
    const timer = setTimeout(expireIfStale, Math.max(0, expiry - Date.now()));
    document.addEventListener('visibilitychange', expireIfStale);
    window.addEventListener('focus', expireIfStale);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', expireIfStale); window.removeEventListener('focus', expireIfStale); };
  }, [result]);
  const options = [...new Set([...connections.map(item => item.id), ...connectionIDs])].sort();
  const inspect = async () => {
    const token = ++generation.current;
    const selected = connection;
    const revision = connections.find(item => item.id === selected)?.revision;
    setResult(null); setError(''); setBusy(true);
    try {
      const data = await lpPositionReconciliation.get(selected, revision);
      if (generation.current === token) setResult(data);
    } catch (error) {
      // The service returns only fixed local messages, never provider response text.
      if (generation.current === token) setError(error.message);
    } finally {
      if (generation.current === token) setBusy(false);
    }
  };
  return <section className="lp-position-reconciliation" aria-label="Provider position reconciliation">
    <h3>Compare recorded positions with the provider</h3>
    <p>Select one trade connection to inspect all native positions through its existing session. The comparison uses the recorded allocations for that connection. Working orders are not checked, so this does not establish a flat native account.</p>
    <div className="lp-position-reconciliation-controls"><label>Provider connection <select value={connection} onChange={event => { generation.current++; setConnection(event.target.value); setResult(null); setError(''); setBusy(false); }}><option value="">Select a provider</option>{options.map(id => <option key={id} value={id}>{connections.find(item => item.id === id)?.name || id} · {id}</option>)}</select></label><button type="button" disabled={!connection || busy} onClick={inspect}>Inspect current provider positions</button><button type="button" disabled={busy} onClick={reloadConnections}>Refresh saved providers</button></div>
    {connectionError && <p role="status">{connectionError}</p>}
    {busy && <p role="status">Reading positions and comparing recorded evidence…</p>}
    {error && <p role="alert" className="lp-journal-error">{error}</p>}
    {result && <>
      <p role="status">{result.comparison.matched ? 'Recorded positions match this provider observation.' : 'This provider observation requires review.'} Working orders were not checked.</p>
      <dl className="lp-journal-details">{[
        ['Connection / revision', `${result.connection_id} / ${result.connection_revision}`], ['Observation completed', new Date(result.completed_at).toLocaleString()], ['Observation expires', new Date(result.valid_until).toLocaleString()], ['Recorded positions', result.comparison.expected_count], ['Provider positions observed', result.comparison.observed_count], ['Unresolved evidence', result.comparison.unresolved], ['Zero positions observed', result.positions_flat_observed ? 'Yes; working orders unknown' : 'No'], ['Request', result.request_id],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {result.comparison.discrepancies.length > 0 && <div className="lp-journal-scroll" role="region" aria-label="Provider position discrepancies" tabIndex="0"><table><thead><tr><th scope="col">Position</th><th scope="col">Difference</th><th scope="col">Recorded symbol / side / quantity</th><th scope="col">Provider symbol / side / quantity</th></tr></thead><tbody>{result.comparison.discrepancies.map(item => <tr key={item.position_id}><td>{item.position_id}</td><td>{reasons[item.reason]}</td><td>{positionText(item.expected)}</td><td>{positionText(item.observed)}</td></tr>)}</tbody></table></div>}
      {result.comparison.unresolved > 0 && <p role="alert">Recorded exposure remains unresolved. A matching subset does not establish complete reconciliation.</p>}
    </>}
  </section>;
}
