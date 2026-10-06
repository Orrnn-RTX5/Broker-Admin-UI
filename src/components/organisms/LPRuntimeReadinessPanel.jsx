import React, { useEffect, useState } from 'react';
import { runtimeComponentFresh, validateLPRuntimeReadiness } from '../../utils/lpRuntimeReadiness.js';
import './lp-connections.css';
const labels = { private_fix: 'Private B-book FIX', private_fix_recovery: 'Private FIX ACK recovery', market: 'Market orders', customer_close: 'Customer closes', pending_placement: 'Pending placement', pending_cancel: 'Pending cancellation', pending_cancel_recovery: 'Cancellation recovery', sessions: 'Named sessions', execution: 'FIX execution', quotes: 'Quote reads', cleanup: 'Opening cleanup', closed_recovery: 'Closed-order recovery' };
const yn = (on, yes = 'Yes', no = 'No') => <span className={`nfc-yn ${on ? 'is-yes' : 'is-no'}`}>{on ? yes : no}</span>;
export default function LPRuntimeReadinessPanel({ connectionID, load }) {
  const [value, setValue] = useState(null), [error, setError] = useState(''), [revision, setRevision] = useState(0), [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let current = true;
    Promise.resolve().then(() => { if (current) { setValue(null); setError(''); } return load(connectionID); }).then(v => { if (current) { setValue(validateLPRuntimeReadiness(v, connectionID)); setNow(Date.now()); } }).catch(() => { if (current) setError('Runtime inspection unavailable.'); });
    return () => { current = false; };
  }, [connectionID, load, revision]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  return <section aria-label="LP runtime inspection" className="nfc-runtime">
    <div className="nfc-runtime-head">
      <div><h3 className="nfc-card-title">Runtime inspection</h3><p>See which order and FIX service operations are ready now. Each order still requires current authorization, capability and execution checks.</p></div>
      <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" disabled={!value&&!error} onClick={() => setRevision(v => v + 1)}>Refresh status</button>
    </div>
    {error && <p role="alert" className="nfc-msg">{error} Select Refresh status to try again.</p>}
    {!error && !value && <p role="status" className="nfc-note">Loading runtime inspection...</p>}
    {value && <p className="nfc-note">Configured means the operation is enabled in settings; composed means its service dependencies are present. A current service observation does not guarantee a specific order will execute.</p>}
    {value && <div className="nfc-runtime-tiles">{['gateway', 'bridge'].map(source => {
      const c = value[source], live = runtimeComponentFresh(c, now);
      return <div key={source} className="nfc-tile"><p className="nfc-tile-head"><span className="nfc-tile-name">{source === 'gateway' ? 'Order service' : 'FIX service'}</span><span className={`nfc-pill ${live ? 'is-ok' : 'is-bad'}`}>{live ? 'Current observation' : 'Unavailable or expired; refresh required'}</span></p>
        {live && <><div className="nfc-table-wrap" role="region" aria-label={`${source === 'gateway' ? 'Order' : 'FIX'} service operations`} tabIndex={0}><table className="nfc-table"><thead><tr><th scope="col">Operation</th><th scope="col">Configured</th><th scope="col">Composed</th><th scope="col">Service lifecycle</th><th scope="col">Fresh claiming</th></tr></thead><tbody>{c.operations.map(op => <tr key={op.name}><th scope="row">{labels[op.name] || op.name.replaceAll('_', ' ')}</th><td>{yn(op.configured)}</td><td>{yn(op.composed)}</td><td>{yn(op.lifecycle_live, 'Live', 'Inactive')}</td><td>{yn(op.claiming, 'Enabled', 'Not enabled here')}</td></tr>)}</tbody></table></div>
          {c.private_fix && <p className="nfc-note">Private B-book FIX session: {c.private_fix.session.replaceAll('_', ' ')}. Dispatch schema: {c.private_fix.dispatch_schema_ready ? 'Installed' : 'Unavailable'}. Recovery composition does not prove a particular ACK has been reconciled.</p>}
          {c.connection && <p className="nfc-note">Saved revision {c.connection.saved_revision}; session revision {c.connection.session_revision}; applied revision {c.connection.applied_revision ?? 'Unavailable'}. Quote: {c.connection.quote || 'Unknown'}. Trade: {c.connection.trade || 'Unknown'}.{c.connection.saved_revision !== c.connection.applied_revision && ' Saved settings are not fully applied.'}</p>}</>}
      </div>;
    })}</div>}
  </section>;
}
