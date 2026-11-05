// Migration destination warning. Group names are exact identities; this only reports a destination that differs from the
// source by letter case or surrounding spaces (a case twin), so the operator sees the merge before previewing it.
// Folding trims spaces only, as the server's btrim does (a tab or newline is part of the name).
const trimSpaces = (name) => String(name ?? '').replace(/^ +| +$/g, '');
const foldGroupName = (name) => trimSpaces(name).toLowerCase();

/** Warning for a destination that is a case or space twin of the source. Empty when not a twin, or when the names are identical. */
export const caseTwinMergeWarning = (source, destination) => {
  const from = String(source ?? '');
  const to = String(destination ?? '');
  if (!from.trim() || !to.trim() || from === to || foldGroupName(from) !== foldGroupName(to)) return '';
  return `Merging case-twin groups: all accounts of '${from}' move to '${to}'`;
};

// A padded destination is refused even when it is exactly listed: the server compares the padded name exactly, and a padded
// legacy group is read-only. The same rule as the parent field.
export const DESTINATION_PADDED_MESSAGE = 'Destination group names with surrounding spaces are not supported (read-only legacy group)';
export const isPaddedDestination = (typed) => {
  const value = String(typed ?? '');
  return value.trim() !== '' && value !== value.trim();
};

/**
 * The migration destination the operator typed, checked against the EXACT listed group names. Order: blank, then padded (refused
 * even when listed), then exact. Anything else is "missing". The request is never trimmed, and no suggestion is ever applied.
 */
export const resolveMigrationDestination = (typed, groupNames = []) => {
  const value = String(typed ?? '');
  if (!value.trim()) return { status: 'empty', name: '', suggestion: null };
  if (isPaddedDestination(value)) return { status: 'padded', name: '', suggestion: null };
  const names = (Array.isArray(groupNames) ? groupNames : []).filter((name) => typeof name === 'string' && name.trim());
  if (names.includes(value)) return { status: 'exact', name: value, suggestion: null };
  return { status: 'missing', name: '', suggestion: null };
};

export const destinationNotFoundMessage = (typed) => `Destination group '${String(typed ?? '')}' not found`;

/** Preview is allowed only for an exact listed destination that is not the source group itself. */
export const migrationDestinationReady = (resolved, source) => resolved?.status === 'exact' && resolved.name !== String(source ?? '');

// The panel offers a "Check result" button (read-only counts), not a verify step: the text names only what the panel does.
export const MIGRATION_OUTCOME_UNKNOWN = 'Migration outcome unknown: use Check result before any retry';
// A client timeout: the backend can run a move for up to ~4 minutes (freeze, COMMIT, Retry-After), so the wait is longer than a retry.
export const MIGRATION_TIMEOUT_OUTCOME_UNKNOWN = 'Outcome unknown: wait at least 3 minutes, then check the result before any retry';

/** True for a client timeout of the move: no HTTP status and a timeout code or message. A 5xx is never a timeout. */
export const isMigrationTimeout = (error) => {
  if (Number.isInteger(error?.status)) return false;
  return error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT' || /timeout/i.test(String(error?.message ?? ''));
};

/** The server's engine guard mode from a preview (on, shadow or off), read-only; a placeholder when the server omits it. */
export const engineGuardLine = (value) => {
  const mode = value?.engine_guard_mode;
  return `Engine guard: ${typeof mode === 'string' && mode.trim() ? mode : '(not reported)'}`;
};
export const DELETE_OUTCOME_UNKNOWN = 'Delete outcome unknown: use Check result before any retry';

/** The server's broker as reported by a preview or move response, read-only; the placeholder when the server omits it. */
export const serverBrokerLine = (value) => {
  const broker = value?.broker_id;
  return `Server broker: ${broker !== undefined && broker !== null && String(broker).trim() ? String(broker) : '(not reported)'}`;
};

/** The server's from and to groups as reported by a response, read-only; a placeholder for any field the server omits. */
export const serverRouteLine = (value) => {
  const shown = (field) => (typeof value?.[field] === 'string' && value[field] ? value[field] : '(not reported)');
  return `Server route: ${shown('from_group')} → ${shown('to_group')}`;
};

// A migrate attempt locks the source's migration controls. The record is kept in localStorage per broker and source, so the
// lock holds across tabs and windows of the same browser and survives a reload. It expires 24 hours after the attempt. A
// record dated later than this clock is still a lock, flagged as clock skew; a stored value that cannot be read is also a lock
// (fail closed). A clear needs the typed line CLEAR <SRC>. A migrate is refused when the record cannot be written to storage
// (or no broker is known): a lock held only in this page's memory would not survive a reload or reach another tab. The page's
// memory is kept as a second copy of a lock that was written.
export const MIGRATION_ATTEMPT_TTL_MS = 24 * 60 * 60 * 1000;
// A-R7-2: the lock time shown when a stored record cannot be read. The lock holds; the time is not known.
const UNREADABLE_ATTEMPT = 'an unreadable time';
// A-R7-1: the refusal when the lock cannot be recorded. Nothing is sent.
export const LOCK_NOT_SAVED_REASON = 'lock could not be saved: migration blocked';
export const CLOCK_SKEW_TOLERANCE_MS = 60 * 1000;
const migrationAttempts = new Map(); // "<broker>|<source>" -> ISO time, the in-page fallback

const attemptStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
const brokerIdForAttempt = () => { try { return String(attemptStorage()?.getItem('brokerId') ?? '').trim(); } catch { return ''; } };
/** The session's broker id as the attempt record sees it (the stored brokerId), or '' when none is known. */
export const currentBrokerId = () => brokerIdForAttempt();
const memoryKeyFor = (brokerId, source) => `${String(brokerId ?? '')}|${String(source ?? '')}`;
/** The localStorage key of a source's attempt record for a broker, or null when no broker is known. */
export const migrationAttemptKeyFor = (brokerId, source) => (brokerId ? `rtx5-admin-migration-attempt:${brokerId}:${encodeURIComponent(String(source ?? ''))}` : null);
export const migrationAttemptKey = (source, brokerId = brokerIdForAttempt()) => migrationAttemptKeyFor(brokerId, source);

const readStoredAttempt = (storage, key, nowMs) => {
  try {
    const stored = storage?.getItem(key);
    if (typeof stored !== 'string' || !stored) return null;
    const at = Date.parse(stored);
    if (!Number.isFinite(at)) return stored;
    if (at <= nowMs && nowMs - at >= MIGRATION_ATTEMPT_TTL_MS) { storage?.removeItem(key); return null; }
    return stored;
  } catch { return UNREADABLE_ATTEMPT; }
};

const readMemoryAttempt = (brokerId, source, nowMs) => {
  const memory = migrationAttempts.get(memoryKeyFor(brokerId, source));
  if (!memory) return null;
  const at = Date.parse(memory);
  const expired = Number.isFinite(at) && at <= nowMs && nowMs - at >= MIGRATION_ATTEMPT_TTL_MS;
  return expired ? null : memory;
};

/** The live lock for a source and broker: the stored record first (another tab's too), then this page's fallback. */
export const liveMigrationAttemptAt = (storage, brokerId, source, nowMs = Date.now()) => {
  const key = migrationAttemptKeyFor(brokerId, source);
  return (key ? readStoredAttempt(storage, key, nowMs) : null) ?? readMemoryAttempt(brokerId, source, nowMs);
};

/**
 * The migrate guard, called at the moment of the request. It reads the live record and refuses if a lock is present (a record
 * another tab wrote, or one from before a reload, refuses here even when this panel's render showed no lock). Otherwise it writes
 * the record, in storage and in the page fallback, before it returns ok.
 */
export const beginMigrationAttempt = (storage, brokerId, source, now = new Date()) => {
  const at = now instanceof Date ? now : new Date(now);
  const name = String(source ?? '');
  const existing = liveMigrationAttemptAt(storage, brokerId, name, at.getTime());
  if (existing) return { ok: false, reason: attemptLockText(existing), attemptedAt: existing };
  // A-R7-1: no broker, no storage, or a write that fails means the lock cannot survive a reload or reach another tab, so the
  // migrate is refused. Nothing is written to the page's memory and nothing is sent.
  const key = migrationAttemptKeyFor(brokerId, name);
  if (!key || !storage) return { ok: false, reason: LOCK_NOT_SAVED_REASON };
  const iso = at.toISOString();
  try { storage.setItem(key, iso); } catch { return { ok: false, reason: LOCK_NOT_SAVED_REASON }; }
  migrationAttempts.set(memoryKeyFor(brokerId, name), iso);
  return { ok: true, attemptedAt: iso };
};

/** The read-only count targets for Check result: a padded source or destination is never asked for (the server would trim it and count its twin). */
export const countTargetsReadable = (source, destination) => {
  const src = String(source ?? '');
  const dst = String(destination ?? '');
  return { source: src !== '' && src === src.trim(), destination: dst.trim() !== '' && dst === dst.trim() };
};

/**
 * Calls onChange when another tab or window writes storage, so an open panel re-reads the lock. Returns the unsubscribe. The
 * target is window in the app and any EventTarget in tests.
 */
export const subscribeMigrationLock = (target, onChange) => {
  if (!target || typeof target.addEventListener !== 'function') return () => {};
  const handler = () => { onChange(); };
  target.addEventListener('storage', handler);
  return () => { target.removeEventListener('storage', handler); };
};

/** Records the first migrate attempt of a source (ISO, UTC) and returns the attempt time that stands for it. */
export const recordMigrationAttempt = (source, at = new Date()) => beginMigrationAttempt(attemptStorage(), brokerIdForAttempt(), source, at).attemptedAt;

/** The attempt time of this source for the session's broker, or null. Read live on every call. */
export const migrationAttemptedAt = (source, nowMs = Date.now()) => liveMigrationAttemptAt(attemptStorage(), brokerIdForAttempt(), source, nowMs);

/** True when a stored attempt time is later than this clock by more than the tolerance: still a lock, shown with a note. */
export const migrationClockSkewed = (attemptedAt, nowMs = Date.now()) => {
  const at = Date.parse(String(attemptedAt ?? ''));
  return Number.isFinite(at) && at > nowMs + CLOCK_SKEW_TOLERANCE_MS;
};
export const clockSkewNote = 'Clock skew: the lock time is later than this clock. It is still treated as a lock; clear it only after verifying the migration state.';

export const attemptLockText = (attemptedAt) => `Migration attempted at ${attemptedAt}: use Check result before any retry`;

/** Shown with the lock: a reload and other tabs do not clear it. Only the typed clear does. */
export const attemptLockNote = 'This lock survives reloads and other tabs of this browser. Only the typed clear removes it, after you have verified the migration state.';

/** The typed line that clears a source's lock. Byte-exact: no trim, no case change. */
export const clearLockLine = (source) => `CLEAR ${String(source ?? '')}`;
export const clearLockTypedMatches = (typed, source) => String(typed ?? '') === clearLockLine(source);

/** Clears a source's attempt record in memory and storage, for the session's broker. The panel calls it only after the typed line. */
export const clearMigrationAttempt = (source) => {
  const name = String(source ?? '');
  migrationAttempts.delete(memoryKeyFor(brokerIdForAttempt(), name));
  const key = migrationAttemptKey(name);
  try { if (key) attemptStorage()?.removeItem(key); } catch { /* nothing else to clear */ }
};

/** Test hook: clears the in-page fallback. Storage is cleared by the test that owns it. */
export const resetMigrationAttemptsForTests = () => migrationAttempts.clear();

/**
 * How a migrate failure reads. Only a 4xx with a readable response body is a refusal, and its reason is shown. A 5xx is NOT a
 * refusal: the backend sends its move failures ("commit failed", and "refused" after a partial step) as HTTP 500 with a body,
 * so a 5xx and a failure with no response (a timeout, a network error) are an unknown outcome. Nothing is retried.
 */
export const migrationFailure = (error) => {
  const status = error?.status;
  const hasBody = Boolean(error?.details) && typeof error.details === 'object';
  if (Number.isInteger(status) && status >= 400 && status < 500 && hasBody) {
    return { kind: 'refused', code: error.code ?? null, message: String(error.message || 'Migration refused.') };
  }
  // A-R6-15: a 5xx keeps the server's code and message, shown after the outcome-unknown wording. A timeout has no status: no detail.
  if (Number.isInteger(status) && status >= 500) {
    const code = error?.code ? String(error.code) : '';
    const message = String(error?.message ?? '').trim();
    return { kind: 'unknown', detail: `Server response ${status}${code ? ` (${code})` : ''}${message ? `: ${message}` : ''}` };
  }
  return { kind: 'unknown' };
};
/** The outcome-unknown line, with the server's detail after it when the failure carried one. */
export const unknownOutcomeText = (unknownText, reading) => (reading?.detail ? `${unknownText}. ${reading.detail}` : unknownText);
export const migrationRefusedText = (failure) => `Migration refused by the server (${failure.code ?? 'no code'}): ${failure.message}`;

/** The line shown before a move: the source is emptied into the destination, with the account count from the preview. */
export const migrationEmptiedText = (source, destination, accounts) => `This group will be emptied: ${source}: ${accounts} accounts move to ${destination}`;

/** The migrate confirmation must be the source group name, typed byte-exact: no trim, no case change. */
export const confirmTypedMatches = (typed, source) => String(typed ?? '') === String(source ?? '');

/** The delete confirmation line for a source group, typed byte-exact. */
export const deleteConfirmLine = (source) => `DELETE ${String(source ?? '')}`;
export const deleteTypedMatches = (typed, source) => String(typed ?? '') === deleteConfirmLine(source);

/**
 * The account count as the server reports it (GroupStats accountCount, every status, under the session's account scope). The
 * server trims its group parameter, so a padded name would count its unpadded twin: that is reported as unavailable.
 */
export const destinationCountText = (count, destination) => {
  const name = String(destination ?? '');
  if (name !== name.trim() || !Number.isInteger(count) || count < 0) return '(count unavailable)';
  return String(count);
};

/**
 * The session's account data-access scope, as the backend's GroupStats applies it (loadManagerAccountScope, account_scope.go):
 * an admin session is unrestricted; any other session is restricted (its allowed groups and login range). The scope reads the
 * backend admin claim only (backend_is_admin, from the raw is_admin claim), never the role name the store derives is_admin from.
 * No session user gives unknown.
 */
export const sessionAccountScope = (user) => {
  if (!user || typeof user !== 'object') return 'unknown';
  return user.backend_is_admin === true ? 'unrestricted' : 'restricted';
};

/**
 * The count of accounts a role can see in a group, labelled for what it is: the accounts this session can see. GroupStats
 * counts under the session's account scope, so it is not "all-login" unless the session is an admin. role is 'source' or
 * 'destination'; accountScope is 'unrestricted', 'restricted' or anything else (unknown). A padded name is never counted.
 */
export const visibleCountLabel = (role, count, name, accountScope) => {
  const who = role === 'source' ? 'source' : 'destination';
  const text = String(name ?? '');
  if (text !== text.trim()) return `accounts in ${who} visible to this session: (count unavailable: padded name)`;
  const value = destinationCountText(count, name);
  if (value === '(count unavailable)') return `accounts in ${who} visible to this session: (count unavailable)`;
  const suffix = accountScope === 'unrestricted' ? '' : accountScope === 'restricted' ? ' (may be partial: restricted scope)' : ' (unknown scope)';
  return `accounts in ${who} visible to this session: ${value}${suffix}`;
};
export const destinationCountLabel = (count, destination, accountScope) => visibleCountLabel('destination', count, destination, accountScope);

/**
 * Which migration controls are enabled, from one place (the panel renders from it, and the tests call it).
 *   - The destination must be an exact listed group, not the source, and not padded. While the list is loading or failed,
 *     nothing is accepted, and the message says so instead of "not found".
 *   - After any migrate attempt of the source (attemptedAt set), Preview, Migrate and the destination field stay locked.
 *     The lock survives reloads and other tabs; only the typed clear (CLEAR <SRC>) removes it.
 *   - Migrate needs the preview of this exact pair, a preview the server allows, and the source name typed byte-exact.
 *   - Delete needs a verified migration and the line "DELETE <SRC>" typed byte-exact. The lock does not cover Delete.
 */
export const migrationControls = ({
  source = '', destination = '', listStatus = 'ready', listedNames = [], canManage = false, disabled = false,
  busy = false, attemptedAt = null, preview = null, verified = false, confirming = false, confirmTyped = '', deleteTyped = '',
  clearTyped = '', nowMs = Date.now(),
} = {}) => {
  const locked = Boolean(attemptedAt);
  let state;
  if (!String(destination ?? '').trim()) state = { status: 'empty', name: '', suggestion: null };
  else if (listStatus === 'loading') state = { status: 'loading', name: '', suggestion: null };
  else if (listStatus === 'failed') state = { status: 'failed', name: '', suggestion: null };
  else state = resolveMigrationDestination(destination, listedNames);
  const destinationReady = migrationDestinationReady(state, source);
  const open = Boolean(canManage) && !disabled && !busy && !locked;
  const previewed = Boolean(preview) && preview.from_group === source && preview.to_group === destination;
  // The list status is shown whether or not a destination is typed; "not found" only ever comes from a loaded list.
  const listMessage = listStatus === 'loading' ? 'Group list loading…' : listStatus === 'failed' ? 'Group list failed: Retry' : '';
  const message = listMessage
    || (state.status === 'padded' ? DESTINATION_PADDED_MESSAGE : '')
    || (state.status === 'missing' ? `${destinationNotFoundMessage(destination)}. Choose a listed group name exactly.` : '');
  const migrateEnabled = open && previewed && preview.can_migrate === true && destinationReady;
  return {
    destinationStatus: state.status,
    message,
    suggestion: null,
    inputDisabled: Boolean(busy) || Boolean(disabled) || !canManage || locked,
    previewEnabled: open && destinationReady,
    migrateEnabled,
    emptiedText: previewed ? migrationEmptiedText(source, destination, preview.accounts) : '',
    showConfirm: Boolean(confirming) && migrateEnabled,
    confirmEnabled: migrateEnabled && confirmTypedMatches(confirmTyped, source),
    deleteLine: deleteConfirmLine(source),
    deleteEnabled: Boolean(canManage) && !disabled && !busy && Boolean(verified) && deleteTypedMatches(deleteTyped, source),
    locked,
    attemptNote: locked ? attemptLockText(attemptedAt) : '',
    lockNote: locked ? attemptLockNote : '',
    // A stored time later than this clock is still a lock; the note says so.
    clockSkewNote: locked && migrationClockSkewed(attemptedAt, nowMs) ? clockSkewNote : '',
    clearLine: clearLockLine(source),
    // Clearing is the one way back before a reload: manage rights, not busy, and the line typed byte-exact.
    clearEnabled: locked && Boolean(canManage) && !disabled && !busy && clearLockTypedMatches(clearTyped, source),
  };
};
