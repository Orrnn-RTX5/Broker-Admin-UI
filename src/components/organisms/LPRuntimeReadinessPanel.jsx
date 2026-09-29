import React, { useEffect, useState } from 'react';
import { runtimeComponentFresh, validateLPRuntimeReadiness } from '../../utils/lpRuntimeReadiness.js';
const labels = { private_fix: 'Private B-book FIX', private_fix_recovery: 'Private FIX ACK recovery', market: 'Market orders', customer_close: 'Customer closes', pending_placement: 'Pending placement', pending_cancel: 'Pending cancellation', pending_cancel_recovery: 'Cancellation recovery', sessions: 'Named sessions', execution: 'FIX execution', quotes: 'Quote reads', cleanup: 'Opening cleanup', closed_recovery: 'Closed-order recovery' };
export default function LPRuntimeReadinessPanel({ connectionID, load }) {
  const [value, setValue] = useState(null), [error, setError] = useState(''), [revision, setRevision] = useState(0), [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let current = true;
    Promise.resolve().then(() => { if (current) { setValue(null); setError(''); } return load(connectionID); }).then(v => { if (current) { setValue(validateLPRuntimeReadiness(v, connectionID)); setNow(Date.now()); } }).catch(() => { if (current) setError('Runtime inspection unavailable.'); });
    return () => { current = false; };
  }, [connectionID, load, revision]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  return <section aria-label="LP runtime inspection" style={{ fontSize: 11, fontWeight: 400, overflowX: 'auto' }}>
    <p>Service composition and session state. Each order still requires current authorization, capability and execution checks.</p>
    <button type="button" onClick={() => setRevision(v => v + 1)}>Refresh runtime inspection</button>
    {error && <p role="status">{error}</p>}
    {!error && !value && <p role="status">Loading runtime inspection...</p>}
    {value && ['gateway', 'bridge'].map(source => {
      const c = value[source], live = runtimeComponentFresh(c, now);
      return <div key={source}><p>{source === 'gateway' ? 'Order service' : 'FIX service'}: {live ? 'Current observation' : 'Unavailable or expired; refresh required'}</p>
        {live && <><table><thead><tr><th>Operation</th><th>Configured</th><th>Composed</th><th>Service lifecycle</th><th>Fresh claiming</th></tr></thead><tbody>{c.operations.map(op => <tr key={op.name}><td>{labels[op.name] || op.name.replaceAll('_', ' ')}</td><td>{op.configured ? 'Yes' : 'No'}</td><td>{op.composed ? 'Yes' : 'No'}</td><td>{op.lifecycle_live ? 'Live' : 'Inactive'}</td><td>{op.claiming ? 'Enabled' : 'Not enabled here'}</td></tr>)}</tbody></table>
          {c.private_fix && <p>Private B-book FIX session: {c.private_fix.session.replaceAll('_', ' ')}. Dispatch schema: {c.private_fix.dispatch_schema_ready ? 'Installed' : 'Unavailable'}. Recovery composition does not prove a particular ACK has been reconciled.</p>}
          {c.connection && <p>Saved revision {c.connection.saved_revision}; session revision {c.connection.session_revision}; applied revision {c.connection.applied_revision ?? 'Unavailable'}. Quote: {c.connection.quote || 'Unknown'}. Trade: {c.connection.trade || 'Unknown'}.{c.connection.saved_revision !== c.connection.applied_revision && ' Saved settings are not fully applied.'}</p>}</>}
      </div>;
    })}
  </section>;
}