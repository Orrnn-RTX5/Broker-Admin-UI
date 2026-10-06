import { useEffect, useRef, useState } from 'react';
import { migrationIsVerified } from '../../services/groupMigration.js';

export default function GroupMigrationPanel({ source, api, canManage = false, onMigrated, onDeleted, disabled = false }) {
  const [destination, setDestination] = useState(''), [preview, setPreview] = useState(null), [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const generation = useRef(0);
  useEffect(() => { const requestState = generation; requestState.current++; setDestination(''); setPreview(null); setResult(null); setError(''); setNotice(''); setBusy(false); return () => { requestState.current++; }; }, [source]);
  const run = async action => {
    if (!canManage || disabled || busy) return;
    const request = ++generation.current; setBusy(true); setError(''); setNotice('');
    try {
      if (action === 'preview') {
        const value = await api.preview(source, destination.trim());
        if (request === generation.current) { setPreview(value); setResult(null); }
      } else if (action === 'migrate') {
        // The backend performs its own locked revalidation. A preview never authorizes a stale migration.
        const value = await api.migrate(source, destination.trim());
        if (request !== generation.current) return;
        setResult(value); setPreview(null);
        setNotice(migrationIsVerified(value, source, destination.trim()) ? `Migration ${value.migration_id} verified. ${value.moved} accounts and their history are now associated with ${destination.trim()}.` : 'Migration has not been verified. Source deletion remains blocked.');
        if (migrationIsVerified(value, source, destination.trim())) { try { await onMigrated?.(value); } catch { setError('Migration is verified, but views could not refresh. Refresh the views; do not repeat the migration.'); } }
      } else {
        if (!migrationIsVerified(result, source, destination.trim())) throw new Error('A verified complete migration is required before deletion.');
        const value = await api.remove(source);
        if (request !== generation.current) return;
        if (value.deleted !== true || value.group !== source) throw new Error('The server did not confirm source-group deletion.');
        setNotice('Source group deleted. Required historical execution configuration is retained.'); try { await onDeleted?.({...value,from_group:source,to_group:result.to_group}); } catch { setError('Source deletion succeeded, but views could not refresh. Refresh the views; do not repeat deletion.'); }
      }
    } catch (e) {
      if (request === generation.current) { setError(e.message || 'Migration failed.'); setPreview(null); setResult(null); }
    } finally { if (request === generation.current) setBusy(false); }
  };
  return <section aria-label="Group migration and verified deletion" style={{ fontSize: '11px', fontWeight: 400 }}>
    <p>Migrate accounts and their complete history from {source} to a saved destination group. Existing positions and pending or in-flight trades retain their original feed and route; new orders use the destination group.</p>
    <p>After migration, new orders on an existing netting symbol are blocked when execution owners conflict until that position is flat. Other symbols use destination settings. Account mode remains fixed.</p>
    <label>Destination group<input aria-label="Migration destination group" disabled={busy || disabled} value={destination} onChange={e => { generation.current++; setDestination(e.target.value); setPreview(null); setResult(null); setError(''); setNotice(''); }} /></label>
    <button type="button" disabled={busy || disabled || !canManage || !destination.trim() || destination.trim() === source} onClick={() => run('preview')}>Preview migration</button>
    {preview && <>
      <p>Source {preview.from_group} → {preview.to_group}</p>
      <dl><dt>Accounts</dt><dd>{preview.accounts}</dd><dt>Open positions</dt><dd>{preview.open_positions}</dd><dt>Pending orders</dt><dd>{preview.pending_orders}</dd><dt>Unresolved commands</dt><dd>{preview.unresolved_commands}</dd><dt>Retained execution dependencies</dt><dd>{preview.retained_configuration_uses}</dd></dl>
      {!!preview.blockers?.length && <ul aria-label="Migration blockers">{preview.blockers.map((blocker, index) => <li key={index}>{typeof blocker === 'string' ? blocker : blocker.message || blocker.reason || blocker.code}</li>)}</ul>}
      <button type="button" disabled={busy || disabled || !canManage || preview.can_migrate !== true || preview.from_group !== source || preview.to_group !== destination.trim()} onClick={() => run('migrate')}>Migrate and verify complete history</button>
    </>}
    {result && <p>Verification status: {result.status || 'unverified'} · history {result.history_verified === true ? 'verified' : 'not verified'}</p>}
    <button type="button" disabled={busy || disabled || !canManage || !migrationIsVerified(result, source, destination.trim())} onClick={() => run('delete')}>Delete verified source group</button>
    <p>Deletion requires backend verification that no account, history or ongoing execution dependency is stranded. Resolve blockers and preview again to retry.</p>
    {busy && <p role="status">Checking migration...</p>}{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
  </section>;
}
