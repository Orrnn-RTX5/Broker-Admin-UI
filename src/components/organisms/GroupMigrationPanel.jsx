import { useEffect, useId, useRef, useState } from 'react';
import { migrationIsVerified } from '../../services/groupMigration.js';
import {
  DELETE_OUTCOME_UNKNOWN, MIGRATION_OUTCOME_UNKNOWN, MIGRATION_TIMEOUT_OUTCOME_UNKNOWN, caseTwinMergeWarning, clearMigrationAttempt,
  destinationCountLabel, engineGuardLine, isMigrationTimeout, migrationAttemptedAt, migrationControls, migrationFailure, migrationRefusedText,
  beginMigrationAttempt, currentBrokerId, countTargetsReadable, deleteConfirmLine, isPaddedDestination, serverBrokerLine, serverRouteLine,
  subscribeMigrationLock, unknownOutcomeText, visibleCountLabel,
} from '../../utils/groupMigrationWarning.js';

// Same full-name rule as getGroupName (utils/groupProperties.js): the `group` key wins, then `name`.
// Names stay exact: "Foo " and "Foo" are different groups, so neither is trimmed or merged.
const fullGroupName = row => { const value = row && typeof row === 'object' ? (row.group || row.name) : ''; return typeof value === 'string' && value.trim() ? value : ''; };

// groupRowsStatus: 'loading' | 'ready' | 'failed'. The destination is judged only against a ready list (no "not found" while loading).
// accountScope: 'unrestricted' | 'restricted' | 'unknown', the session's account data-access scope (labels the destination count).
export default function GroupMigrationPanel({ source, api, canManage = false, groupRows = [], groupRowsStatus = 'ready', onRetryGroupRows, onMigrated, onDeleted, disabled = false, accountScope = 'unknown' }) {
  const listId = useId();
  const destinationOptions = [...new Set(groupRows.map(fullGroupName))].filter(name => name && name !== String(source ?? ''));
  const [destination, setDestination] = useState(''), [preview, setPreview] = useState(null), [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [confirming, setConfirming] = useState(false), [confirmTyped, setConfirmTyped] = useState(''), [deleteTyped, setDeleteTyped] = useState('');
  const [destinationCount, setDestinationCount] = useState(null), [clearTyped, setClearTyped] = useState(''), [resultCheck, setResultCheck] = useState(null), [, setAttemptTick] = useState(0);
  const generation = useRef(0);
  // Another tab or window writes the attempt record: its storage event re-renders this panel, so the lock shows at once.
  useEffect(() => subscribeMigrationLock(window, () => setAttemptTick(tick => tick + 1)), []);
  // A new source is a new panel: the typed confirmations and the preview start over. The migrate attempt lock is not reset
  // here: it belongs to the page load (migrationAttemptedAt), so reopening the panel does not clear it.
  useEffect(() => { const requestState = generation; requestState.current++; setDestination(''); setPreview(null); setResult(null); setError(''); setNotice(''); setBusy(false); setConfirming(false); setConfirmTyped(''); setDeleteTyped(''); setDestinationCount(null); setResultCheck(null); return () => { requestState.current++; }; }, [source]);
  const listedNames = groupRows.map(fullGroupName).filter(Boolean);
  const controls = migrationControls({
    source, destination, listStatus: groupRowsStatus, listedNames, canManage, disabled, busy,
    attemptedAt: migrationAttemptedAt(source), preview, verified: migrationIsVerified(result, source, destination),
    confirming, confirmTyped, deleteTyped, clearTyped,
  });
  const chooseDestination = name => { generation.current++; setDestination(name); setPreview(null); setResult(null); setDeleteTyped(''); setConfirming(false); setConfirmTyped(''); setError(''); setNotice(''); setDestinationCount(null); };
  const run = async action => {
    if (!canManage || disabled || busy) return;
    if (action === 'preview' && !controls.previewEnabled) return;
    if (action === 'migrate' && !controls.migrateEnabled) return;
    // A-R6-2 and A-R6-6: the padded destination and the typed delete are re-checked here, not only in the button state.
    if (action !== 'delete' && isPaddedDestination(destination)) return;
    if (action === 'delete' && !controls.deleteEnabled) return;
    const request = ++generation.current; setBusy(true); setError(''); setNotice('');
    try {
      if (action === 'preview') {
        const value = await api.preview(source, destination);
        if (request === generation.current) { setPreview(value); setResult(null); setDeleteTyped(''); }
        // The destination's all-login count: a read that never blocks the preview. A padded destination is not asked for.
        if (request === generation.current && destination === destination.trim() && typeof api.destinationCount === 'function') {
          // Not awaited: the count must not hold the panel busy. It lands only while this request is still the current one.
          api.destinationCount(destination).then(stats => stats?.accountCount, () => undefined).then(count => { if (request === generation.current) setDestinationCount({ name: destination, count }); });
        }
      } else if (action === 'migrate') {
        // Read live from storage at the request, not from the last render: another tab may have migrated this source since this
        // panel rendered. A stale open panel therefore refuses here instead of sending a second move.
        // The guard: read the live record and refuse if a lock is there; otherwise write the record before the move is sent.
        const begun = beginMigrationAttempt(globalThis.localStorage, currentBrokerId(), source);
        if (!begun.ok) { setError(begun.reason); setAttemptTick(tick => tick + 1); return; }
        // The attempt is recorded before the request leaves. It stays locked across reloads and tabs whatever the outcome, and a
        // failed move is never retried automatically.
        setAttemptTick(tick => tick + 1);
        setConfirming(false); setConfirmTyped('');
        let value;
        try {
          value = await api.migrate(source, destination);
        } catch (failure) {
          // A server refusal (a status and a body) shows its reason; a timeout or a network error has no response, so the
          // outcome is unknown. The lock stays in both cases, and nothing is retried.
          // A client timeout gets its own wait-then-check wording: the move can still be running on the server for minutes.
          const reading = migrationFailure(failure);
          const unknownText = isMigrationTimeout(failure) ? MIGRATION_TIMEOUT_OUTCOME_UNKNOWN : MIGRATION_OUTCOME_UNKNOWN;
          if (request === generation.current) { setPreview(null); setError(reading.kind === 'refused' ? migrationRefusedText(reading) : unknownOutcomeText(unknownText, reading)); }
          return;
        }
        if (request !== generation.current) return;
        setResult(value); setDeleteTyped(''); setPreview(null);
        setNotice(migrationIsVerified(value, source, destination) ? `Migration ${value.migration_id} verified. ${value.moved} accounts and their history are now associated with ${destination}.` : 'Migration has not been verified. Source deletion remains blocked.');
        if (migrationIsVerified(value, source, destination)) { try { await onMigrated?.(value); } catch { setError('Migration is verified, but views could not refresh. Refresh the views; do not repeat the migration.'); } }
      } else {
        if (!migrationIsVerified(result, source, destination)) throw new Error('A verified complete migration is required before deletion.');
        let value;
        try { value = await api.remove(source, deleteConfirmLine(source)); } catch (failure) {
          // A refusal shows its reason; a 5xx, a timeout or a dropped request leaves the outcome unknown.
          if (request === generation.current) { const reading = migrationFailure(failure); setError(reading.kind === 'refused' ? migrationRefusedText(reading) : unknownOutcomeText(DELETE_OUTCOME_UNKNOWN, reading)); }
          return;
        }
        if (request !== generation.current) return;
        if (value.deleted !== true || value.group !== source) throw new Error('The server did not confirm source-group deletion.');
        setNotice('Source group deleted. Required historical execution configuration is retained.'); try { await onDeleted?.({...value,from_group:source,to_group:result.to_group}); } catch { setError('Source deletion succeeded, but views could not refresh. Refresh the views; do not repeat deletion.'); }
      }
    } catch (e) {
      if (request === generation.current) { setError(e.message || 'Migration failed.'); setPreview(null); setResult(null); setDeleteTyped(''); }
    } finally { if (request === generation.current) setBusy(false); }
  };
  // Check result: a read-only re-fetch of the two counts (GroupStats). It does not change the lock. A blank or padded destination
  // is not asked for (the server would trim it and count the twin).
  const checkResult = async () => {
    if (busy || typeof api?.destinationCount !== 'function') return;
    const request = ++generation.current; setBusy(true); setError('');
    try {
      // A padded source is never asked for: the server would trim it and count its twin.
      const readable = countTargetsReadable(source, destination);
      const [src, dst] = await Promise.allSettled([
        readable.source ? api.destinationCount(source) : Promise.reject(new Error('not asked')),
        readable.destination ? api.destinationCount(destination) : Promise.reject(new Error('not asked')),
      ]);
      if (request === generation.current) {
        setResultCheck({
          source: src.status === 'fulfilled' ? src.value?.accountCount : undefined,
          destination: dst.status === 'fulfilled' ? dst.value?.accountCount : undefined,
          sourceName: source,
          destinationName: destination,
          at: new Date().toISOString(),
        });
      }
    } finally { if (request === generation.current) setBusy(false); }
  };
  const twinWarning = caseTwinMergeWarning(source, destination);
  // A padded destination is never counted (the server would count its twin): destinationCountText reports it unavailable.
  // The count is labelled for what it is (visible to this session, with the scope). A padded destination is never counted.
  const countPending = destinationCount?.name !== destination && destination === destination.trim();
  const countLabel = countPending
    ? 'accounts in destination visible to this session: (loading)'
    : destinationCountLabel(destinationCount?.count, destination, accountScope);
  return <section aria-label="Group migration and verified deletion" className="gpp-stack" style={{ fontSize: '11px', fontWeight: 400 }}>
    <p>Migrate accounts and their complete history from {source} to a saved destination group. Existing positions and pending or in-flight trades retain their original feed and route; new orders use the destination group.</p>
    <p>After migration, new orders on an existing netting symbol are blocked when execution owners conflict until that position is flat. Other symbols use destination settings. Account mode remains fixed.</p>
    {!canManage && <p role="note" className="gpp-field-hint">Migrating or deleting groups requires group-management permission across all groups in this broker.</p>}
    {controls.attemptNote && <p role="alert" className="gpp-field-hint">{controls.attemptNote}</p>}
    {controls.locked && <p role="note" className="gpp-field-hint">{controls.lockNote}</p>}
    {controls.clockSkewNote && <p role="alert" className="gpp-field-hint">{controls.clockSkewNote}</p>}
    {controls.locked && <div className="gpp-toolbar"><button type="button" className="gpp-btn" disabled={busy || disabled || typeof api?.destinationCount !== 'function'} onClick={() => checkResult()}>Check result</button></div>}
    {resultCheck && <p role="status">{visibleCountLabel('source', resultCheck.source, resultCheck.sourceName, accountScope)} · {destinationCountLabel(resultCheck.destination, resultCheck.destinationName, accountScope)}. Counts come from the server and may be cached briefly; checked {resultCheck.at}.</p>}
    {controls.locked && canManage && <label className="gpp-field"><span className="gpp-field-label">Type {controls.clearLine} to clear the lock</span><input className="gpp-input" aria-label="Type the clear line" value={clearTyped} disabled={busy} onChange={e => setClearTyped(e.target.value)} /></label>}
    {controls.locked && <div className="gpp-toolbar"><button type="button" className="gpp-btn" disabled={!controls.clearEnabled} onClick={() => { if (!controls.clearEnabled) return; clearMigrationAttempt(source); setClearTyped(''); setAttemptTick(tick => tick + 1); }}>Clear lock</button></div>}
    <label className="gpp-field"><span className="gpp-field-label">Destination group</span><input className="gpp-input" aria-label="Migration destination group" list={listId} disabled={controls.inputDisabled} value={destination} onChange={e => { generation.current++; setDestination(e.target.value); setPreview(null); setResult(null); setDeleteTyped(''); setConfirming(false); setConfirmTyped(''); setError(''); setNotice(''); setDestinationCount(null); }} /></label>
    <datalist id={listId}>{destinationOptions.map(name => <option key={name} value={name} />)}</datalist>
    {twinWarning && <p role="note" className="gpp-field-hint">{twinWarning}</p>}
    {controls.message && <p role="alert" className="gpp-field-hint">{controls.message}
      {controls.destinationStatus === 'missing' && controls.suggestion !== null && <> <button type="button" className="gpp-btn" disabled={controls.inputDisabled} onClick={() => chooseDestination(controls.suggestion)}>Use '{controls.suggestion}'</button></>}
      {groupRowsStatus === 'failed' && onRetryGroupRows && <> <button type="button" className="gpp-btn" disabled={busy} onClick={() => onRetryGroupRows()}>Retry</button></>}
    </p>}
    <div className="gpp-toolbar"><button type="button" className="gpp-btn" disabled={!controls.previewEnabled} onClick={() => run('preview')}>Preview migration</button></div>
    {preview && <>
      <p>Source {preview.from_group} → Destination {preview.to_group}: {countLabel}</p>
      <p>{serverBrokerLine(preview)} · {engineGuardLine(preview)} · {serverRouteLine(preview)}</p>
      <dl><dt>Accounts</dt><dd>{preview.accounts}</dd><dt>Open positions</dt><dd>{preview.open_positions}</dd><dt>Pending orders</dt><dd>{preview.pending_orders}</dd><dt>Unresolved commands</dt><dd>{preview.unresolved_commands}</dd><dt>Retained execution dependencies</dt><dd>{preview.retained_configuration_uses}</dd></dl>
      {!!preview.blockers?.length && <ul aria-label="Migration blockers">{preview.blockers.map((blocker, index) => <li key={index}>{typeof blocker === 'string' ? blocker : blocker.message || blocker.reason || blocker.code}</li>)}</ul>}
      {!controls.showConfirm && !controls.locked && <div className="gpp-toolbar"><button type="button" className="gpp-btn is-primary" disabled={!controls.migrateEnabled} onClick={() => setConfirming(true)}>Migrate and verify complete history</button></div>}
      {controls.showConfirm && <div role="alert" className="gpp-field-hint"><p>{controls.emptiedText}</p>
        <label className="gpp-field"><span className="gpp-field-label">Type the source group name to confirm</span><input className="gpp-input" aria-label="Type the source group name to confirm" value={confirmTyped} onChange={e => setConfirmTyped(e.target.value)} /></label>
        <div className="gpp-toolbar"><button type="button" className="gpp-btn is-primary" disabled={!controls.confirmEnabled || busy} onClick={() => run('migrate')}>Confirm and migrate</button> <button type="button" className="gpp-btn" disabled={busy} onClick={() => { setConfirming(false); setConfirmTyped(''); }}>Cancel</button></div>
      </div>}
    </>}
    {result && <><p>Verification status: {result.status || 'unverified'} · history {result.history_verified === true ? 'verified' : 'not verified'}</p><p>{serverBrokerLine(result)} · {serverRouteLine(result)}</p></>}
    {result && <label className="gpp-field"><span className="gpp-field-label">Type {controls.deleteLine} to enable deletion</span><input className="gpp-input" aria-label="Type the delete confirmation" value={deleteTyped} onChange={e => setDeleteTyped(e.target.value)} /></label>}
    <div className="gpp-toolbar"><button type="button" className="gpp-btn" disabled={!controls.deleteEnabled} onClick={() => run('delete')}>Delete verified source group</button></div>
    <p>Deletion requires backend verification that no account, history or ongoing execution dependency is stranded. Resolve blockers and preview again to retry.</p>
    {busy && <p role="status">Checking migration...</p>}{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
  </section>;
}
