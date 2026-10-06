import { useEffect, useRef, useState } from 'react';
import { groupCoverage } from '../../services/groupCoverage.js';

const adminPermissions = { group: () => true, account: () => true, connection: () => true };
export default function GroupCoveragePanel({ connections = [], permissions = adminPermissions }) {
  const [group, setGroup] = useState(''), [account, setAccount] = useState(''), [loaded, setLoaded] = useState(null);
  const [kind, setKind] = useState('internal'), [connection, setConnection] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  const reset = () => { generation.current++; setLoaded(null); setError(''); setNotice(''); };
  const run = async save => {
    const request = ++generation.current; setBusy(true); setError(''); setNotice('');
    try {
      const value = save ? await groupCoverage.save(loaded.group_name, loaded.coverage_account_id, loaded.assignment?.revision || '0', kind, kind === 'external' ? connection : '') : await groupCoverage.get(group.trim(), account.trim());
      if (request !== generation.current) return;
      setLoaded(value); setKind(value.assignment?.destination_kind || 'internal'); setConnection(value.assignment?.connection_id || '');
      if (save) setNotice('Coverage destination assigned to this client group. Each coverage account can serve only one client group.');
    } catch (e) { if (request === generation.current) {
      setError(save && loaded?.assignment?.destination_kind === 'internal'
        ? `${e.message} The last loaded assignment was Internal. Reload it to confirm whether new orders remain blocked.`
        : e.message);
      setLoaded(null);
    } }
    finally { if (request === generation.current) setBusy(false); }
  };
  const coverageGroup = loaded?.coverage_group || loaded?.assignment?.coverage_group;
  const allowed = loaded && permissions.group('configuration', loaded.group_name)
    && permissions.account('configuration', loaded.coverage_account_id, coverageGroup)
    && (kind !== 'external' || permissions.connection('configuration', connection))
    && (!loaded.assignment?.connection_id || permissions.connection('configuration', loaded.assignment.connection_id));
  return <fieldset style={{ fontSize: '11px', fontWeight: 400 }}><legend>Group coverage destination</legend>
    <p>Assign an internal or external coverage account to one client trading group. Coverage destination and coverage percentage are separate settings; the account keeps its permanent netting or hedging mode. Saving an assignment alone does not activate trade execution.</p>
    <label>Client group<input aria-label="Coverage client group" disabled={busy} value={group} onChange={e => { reset(); setGroup(e.target.value); }} /></label>
    <label>Coverage account UUID<input aria-label="Coverage destination account" disabled={busy} value={account} onChange={e => { reset(); setAccount(e.target.value); }} /></label>
    <button type="button" disabled={busy || !group.trim() || !account.trim() || !permissions.group('view', group.trim())} onClick={() => run(false)}>Load coverage assignment</button>
    {loaded && <>
      <p>Coverage account {loaded.coverage_account_id} · coverage group {coverageGroup || 'Unavailable'} · revision {loaded.assignment?.revision || '0'}</p>
      <label>Destination<select aria-label="Coverage destination kind" disabled={busy} value={kind} onChange={e => { setKind(e.target.value); setConnection(''); }}><option value="internal">Internal</option><option value="external">External LP</option></select></label>
      {(kind === 'internal' || loaded.assignment?.destination_kind === 'internal') && <p role="status">
        {loaded.assignment?.destination_kind === 'internal'
          ? 'New orders for this client group are blocked by its saved internal coverage assignment until linked trade execution is available.'
          : 'Linked trade execution is currently unavailable. Saving an internal coverage assignment will block new orders for this client group.'}
      </p>}
      {kind === 'external' && <label>LP connection<select aria-label="Coverage LP connection" disabled={busy} value={connection} onChange={e => setConnection(e.target.value)}><option value="">Choose a connection</option>{connection && !connections.some(value => value.id === connection) && <option value={connection}>{connection} — unavailable</option>}{connections.map(value => <option key={value.id} value={value.id}>{value.name} ({value.id})</option>)}</select></label>}
      <button type="button" disabled={busy || !allowed || (kind === 'external' && !connections.some(value => value.id === connection))} onClick={() => run(true)}>Save group coverage assignment</button>
      {!allowed && <p>Configuration permission for both groups, the coverage account and required LP connections is needed.</p>}
    </>}
    {busy && <p role="status">Loading or saving coverage...</p>}{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
  </fieldset>;
}
