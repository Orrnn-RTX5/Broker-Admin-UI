import { buildUserFromAuthPayload } from './sessionUser.js';
import { beginMigrationAttempt, countTargetsReadable, LOCK_NOT_SAVED_REASON, liveMigrationAttemptAt, migrationAttemptKeyFor, subscribeMigrationLock, unknownOutcomeText } from './groupMigrationWarning.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIGRATION_OUTCOME_UNKNOWN, caseTwinMergeWarning, confirmTypedMatches, deleteConfirmLine, deleteTypedMatches, destinationCountText, destinationNotFoundMessage,
  migrationAttemptedAt, migrationControls, migrationDestinationReady, migrationEmptiedText, recordMigrationAttempt, resetMigrationAttemptsForTests,
  resolveMigrationDestination, serverBrokerLine, serverRouteLine,
  clearLockLine, clearLockTypedMatches, clearMigrationAttempt, destinationCountLabel, MIGRATION_ATTEMPT_TTL_MS, migrationAttemptKey,
  migrationFailure, migrationRefusedText, sessionAccountScope,
} from './groupMigrationWarning.js';
import { DELETE_OUTCOME_UNKNOWN, clockSkewNote, migrationClockSkewed, visibleCountLabel } from './groupMigrationWarning.js';

// Round 5: an in-memory localStorage stand-in, so the attempt lock can be checked across a simulated reload and other tabs.
const storageMap = new Map();
globalThis.localStorage = {
  getItem: key => (storageMap.has(key) ? storageMap.get(key) : null),
  setItem: (key, value) => { storageMap.set(key, String(value)); },
  removeItem: key => { storageMap.delete(key); },
};

test('a destination that is a case or space twin of the source gets the merge warning', () => {
  assert.equal(caseTwinMergeWarning('Real\\Old', 'real\\old'), "Merging case-twin groups: all accounts of 'Real\\Old' move to 'real\\old'");
  assert.equal(caseTwinMergeWarning('Real\\Old', 'Real\\Old '), "Merging case-twin groups: all accounts of 'Real\\Old' move to 'Real\\Old '");
  assert.equal(caseTwinMergeWarning('Arijit', ' ARIJIT'), "Merging case-twin groups: all accounts of 'Arijit' move to ' ARIJIT'");
});

test('the exact source, unrelated groups and empty destinations get no warning', () => {
  assert.equal(caseTwinMergeWarning('Real\\Old', 'Real\\Old'), '', 'the exact source is refused by the button, not warned');
  assert.equal(caseTwinMergeWarning('Real\\Old', 'Real\\New'), '');
  assert.equal(caseTwinMergeWarning('Real\\Old', ''), '');
  assert.equal(caseTwinMergeWarning('Real\\Old', '   '), '');
  assert.equal(caseTwinMergeWarning('', 'real'), '');
});

test('a destination is ready only when it is exactly a listed name; the request is never trimmed', () => {
  const listed = ['Real\\New', 'Real\\New ', 'real\\new'];
  assert.deepEqual(resolveMigrationDestination('Real\\New', listed), { status: 'exact', name: 'Real\\New', suggestion: null });
  assert.deepEqual(resolveMigrationDestination('Real\\New ', listed), { status: 'padded', name: '', suggestion: null }, 'a padded name is refused even when it is listed');
  assert.deepEqual(resolveMigrationDestination('real\\new', listed), { status: 'exact', name: 'real\\new', suggestion: null });
});

test('a padded destination is refused, listed or not; an unlisted exact name is missing and never suggested', () => {
  assert.deepEqual(resolveMigrationDestination('Real\\Other ', ['Real\\Other']), { status: 'padded', name: '', suggestion: null }, 'a padded entry is refused, with no suggestion');
  assert.deepEqual(resolveMigrationDestination('Real\\Other ', ['Real\\Other', 'Real\\Other ']), { status: 'padded', name: '', suggestion: null }, 'padded and listed: still refused');
  assert.deepEqual(resolveMigrationDestination(' Real\\Missing ', ['Real\\Other']), { status: 'padded', name: '', suggestion: null }, 'a padded unlisted entry is refused');
  assert.deepEqual(resolveMigrationDestination('ARIJIT', ['Arijit']), { status: 'missing', name: '', suggestion: null }, 'a case twin is not a suggestion');
  assert.deepEqual(resolveMigrationDestination('Real\\New', []), { status: 'missing', name: '', suggestion: null }, 'no loaded list: nothing is ready');
});

test('preview is ready only for an exact listed destination that is not the source group', () => {
  assert.equal(migrationDestinationReady(resolveMigrationDestination('Real\\Old', ['Real\\New', 'Real\\Old']), 'Real\\Old'), false, 'the source itself is never a destination');
  assert.equal(migrationDestinationReady(resolveMigrationDestination('Real\\New', ['Real\\New', 'Real\\Old']), 'Real\\Old'), true, 'a listed group other than the source is ready');
  assert.equal(migrationDestinationReady(resolveMigrationDestination('Real\\New ', ['Real\\New']), 'Real\\Old'), false, 'a padded entry that is not listed is not ready');
  assert.equal(migrationDestinationReady(resolveMigrationDestination('', ['Real\\New']), 'Real\\Old'), false);
  assert.equal(migrationDestinationReady(null, 'Real\\Old'), false);
});

const SRC = 'Real\\Old';
const DST = 'Real\\New';
const LISTED = [SRC, DST];
const ready = { source: SRC, destination: DST, listedNames: LISTED, canManage: true, listStatus: 'ready' };
const previewOf = (overrides = {}) => ({ from_group: SRC, to_group: DST, can_migrate: true, accounts: 3, open_positions: 0, ...overrides });

test('a loading or failed list says so, never "not found", and Preview is closed', () => {
  // The destination is a listed group here on purpose: a loading list must close Preview even for a name that is listed.
  const loading = migrationControls({ ...ready, listStatus: 'loading', destination: DST });
  assert.equal(loading.message, 'Group list loading…');
  assert.equal(loading.destinationStatus, 'loading');
  assert.equal(loading.previewEnabled, false);
  assert.equal(migrationControls({ ...ready, listStatus: 'loading', destination: '' }).message, 'Group list loading…', 'the list status shows even with no destination typed');
  const failed = migrationControls({ ...ready, listStatus: 'failed', destination: DST });
  assert.equal(failed.message, 'Group list failed: Retry');
  assert.equal(failed.previewEnabled, false);
  assert.equal(failed.message.includes('not found'), false);
});

test('preview is enabled only for an exact listed destination, never the source, and never without manage permission or while busy', () => {
  assert.equal(migrationControls(ready).previewEnabled, true);
  assert.equal(migrationControls({ ...ready, destination: 'Real\\Gone' }).message, "Destination group 'Real\\Gone' not found. Choose a listed group name exactly.");
  assert.equal(migrationControls({ ...ready, destination: 'Real\\Gone' }).previewEnabled, false);
  assert.equal(migrationControls({ ...ready, destination: SRC }).previewEnabled, false, 'the source is never a destination');
  assert.equal(migrationControls({ ...ready, destination: `${DST} ` }).previewEnabled, false, 'a padded unlisted entry is not ready');
  const padded = migrationControls({ ...ready, destination: `${DST} ` });
  assert.equal(padded.destinationStatus, 'padded');
  assert.equal(padded.suggestion, null, 'a suggestion is never offered for a padded entry');
  assert.equal(migrationControls({ ...ready, canManage: false }).previewEnabled, false);
  assert.equal(migrationControls({ ...ready, busy: true }).previewEnabled, false);
  assert.equal(migrationControls({ ...ready, disabled: true }).previewEnabled, false);
});

test('after any migrate attempt of a source, Preview, Migrate and the destination field stay locked; a verified source can still be deleted once typed', () => {
  storageMap.clear(); resetMigrationAttemptsForTests(); storageMap.set('brokerId', 'broker-a');
  const attemptedAt = recordMigrationAttempt(SRC, new Date('2026-10-29T10:00:00Z'));
  assert.equal(attemptedAt, '2026-10-29T10:00:00.000Z');
  const now = Date.parse('2026-10-29T11:00:00Z');
  const lockedAt = migrationAttemptedAt(SRC, now);
  const locked = migrationControls({ ...ready, attemptedAt: lockedAt, preview: previewOf(), verified: true, deleteTyped: `DELETE ${SRC}` });
  assert.equal(locked.locked, true);
  assert.equal(locked.previewEnabled, false);
  assert.equal(locked.migrateEnabled, false);
  assert.equal(locked.inputDisabled, true, 'the field is locked too, so no other destination is chosen');
  assert.equal(locked.attemptNote, 'Migration attempted at 2026-10-29T10:00:00.000Z: use Check result before any retry');
  assert.equal(locked.deleteEnabled, true, 'the lock does not block deleting a verified source once the line is typed');
  assert.equal(migrationControls({ ...ready, attemptedAt: lockedAt, preview: previewOf(), verified: true, deleteTyped: '' }).deleteEnabled, false);
  assert.equal(migrationAttemptedAt('Real\\Other', now), null, 'another source is not locked');
  assert.equal(recordMigrationAttempt(SRC, new Date('2026-10-29T11:30:00Z')), attemptedAt, 'the first attempt time is kept');
  resetMigrationAttemptsForTests();
  assert.equal(migrationAttemptedAt(SRC, now), attemptedAt, 'a reload reads the lock back from storage');
  clearMigrationAttempt(SRC);
  assert.equal(migrationAttemptedAt(SRC, now), null, 'the typed clear removes it');
  assert.equal(migrationControls({ ...ready }).locked, false);
});

test('the attempt lock is kept in localStorage per broker and source, so another tab or a reload sees it', () => {
  storageMap.clear(); resetMigrationAttemptsForTests(); storageMap.set('brokerId', 'broker-a');
  const at = recordMigrationAttempt(SRC, new Date('2026-10-29T10:00:00Z'));
  assert.equal(migrationAttemptKey(SRC), `rtx5-admin-migration-attempt:broker-a:${encodeURIComponent(SRC)}`);
  assert.equal(storageMap.get(migrationAttemptKey(SRC)), '2026-10-29T10:00:00.000Z');
  resetMigrationAttemptsForTests();
  assert.equal(migrationAttemptedAt(SRC, Date.parse('2026-10-29T12:00:00Z')), at, 'the lock is read back on the next page load or in another tab');
  storageMap.set('brokerId', 'broker-b');
  assert.equal(migrationAttemptedAt(SRC, Date.parse('2026-10-29T12:00:00Z')), null, 'another broker is not locked');
  assert.equal(migrationAttemptKey(SRC, ''), null, 'no broker known: no storage key');
  storageMap.set('brokerId', 'broker-a');
});

test('the attempt lock expires after 24 hours, and an expired record is removed', () => {
  storageMap.clear(); resetMigrationAttemptsForTests(); storageMap.set('brokerId', 'broker-a');
  recordMigrationAttempt(SRC, new Date('2026-10-29T10:00:00Z'));
  resetMigrationAttemptsForTests();
  assert.notEqual(migrationAttemptedAt(SRC, Date.parse('2026-10-30T09:59:00Z')), null, 'inside 24 hours');
  assert.equal(migrationAttemptedAt(SRC, Date.parse('2026-10-30T10:00:00Z')), null, 'at 24 hours it has expired');
  assert.equal(storageMap.has(migrationAttemptKey(SRC)), false, 'the expired record is removed');
  assert.equal(MIGRATION_ATTEMPT_TTL_MS, 24 * 60 * 60 * 1000);
});

test('A-R7-1: a storage write that fails refuses the migrate; nothing is sent and no page-only lock is kept', () => {
  resetMigrationAttemptsForTests();
  const storage = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
  const nowMs = Date.parse('2026-10-29T11:00:00Z');
  assert.deepEqual(beginMigrationAttempt(storage, 'broker-a', SRC, new Date('2026-10-29T10:00:00Z')), { ok: false, reason: LOCK_NOT_SAVED_REASON });
  assert.equal(liveMigrationAttemptAt(storage, 'broker-a', SRC, nowMs), null, 'a refused record leaves no lock for this page either');
});

test('A-R7-1: no broker id, or no storage, refuses the migrate and writes nothing', () => {
  resetMigrationAttemptsForTests();
  const writes = [];
  const storage = { getItem: () => null, setItem: (key) => { writes.push(key); }, removeItem: () => {} };
  const at = new Date('2026-10-29T10:00:00Z');
  assert.deepEqual(beginMigrationAttempt(storage, '', SRC, at), { ok: false, reason: LOCK_NOT_SAVED_REASON }, 'a blank broker id');
  assert.deepEqual(beginMigrationAttempt(storage, null, SRC, at), { ok: false, reason: LOCK_NOT_SAVED_REASON }, 'no broker id');
  assert.deepEqual(beginMigrationAttempt(null, 'broker-a', SRC, at), { ok: false, reason: LOCK_NOT_SAVED_REASON }, 'no storage');
  assert.deepEqual(writes, [], 'nothing is written');
  assert.equal(liveMigrationAttemptAt(storage, 'broker-a', SRC, at.getTime()), null);
});

test('A-R7-1: a write that succeeds is the lock: the next migrate of the same source is refused', () => {
  resetMigrationAttemptsForTests();
  const values = new Map();
  const storage = { getItem: (key) => (values.has(key) ? values.get(key) : null), setItem: (key, value) => { values.set(key, String(value)); }, removeItem: (key) => { values.delete(key); } };
  const first = beginMigrationAttempt(storage, 'broker-a', SRC, new Date('2026-10-29T10:00:00Z'));
  assert.deepEqual(first, { ok: true, attemptedAt: '2026-10-29T10:00:00.000Z' });
  assert.equal(beginMigrationAttempt(storage, 'broker-a', SRC, new Date('2026-10-29T10:01:00Z')).ok, false);
});

test('A-R7-2: a stored record that cannot be read is a lock (fail closed); the guard refuses and names the unknown time', () => {
  resetMigrationAttemptsForTests();
  const storage = { getItem: () => { throw new Error('denied'); }, setItem: () => {}, removeItem: () => {} };
  const nowMs = Date.parse('2026-10-29T11:00:00Z');
  assert.equal(liveMigrationAttemptAt(storage, 'broker-a', SRC, nowMs), 'an unreadable time');
  assert.deepEqual(beginMigrationAttempt(storage, 'broker-a', SRC, new Date(nowMs)), {
    ok: false,
    reason: 'Migration attempted at an unreadable time: use Check result before any retry',
    attemptedAt: 'an unreadable time',
  });
});

test('T7-1 helper: a padded or blank source or destination is never asked for by Check result', () => {
  assert.deepEqual(countTargetsReadable(SRC, DST), { source: true, destination: true });
  assert.deepEqual(countTargetsReadable(`${SRC} `, DST), { source: false, destination: true });
  assert.deepEqual(countTargetsReadable(SRC, ` ${DST}`), { source: true, destination: false });
  assert.deepEqual(countTargetsReadable(' ', ' '), { source: false, destination: false });
  assert.deepEqual(countTargetsReadable(SRC, ''), { source: true, destination: false });
});

test('A-R6-15: a 5xx keeps the server code and message after the outcome-unknown wording; a timeout and a refusal read as before', () => {
  const commit = migrationFailure(Object.assign(new Error('Migration commit failed'), { status: 500, code: 'MT_RET_ERR_TRADE', details: { message: 'Migration commit failed' } }));
  assert.deepEqual(commit, { kind: 'unknown', detail: 'Server response 500 (MT_RET_ERR_TRADE): Migration commit failed' });
  assert.equal(unknownOutcomeText(MIGRATION_OUTCOME_UNKNOWN, commit), 'Migration outcome unknown: use Check result before any retry. Server response 500 (MT_RET_ERR_TRADE): Migration commit failed');
  const timeout = migrationFailure(Object.assign(new Error('timeout of 150000ms exceeded'), { code: 'ECONNABORTED' }));
  assert.equal(unknownOutcomeText(MIGRATION_OUTCOME_UNKNOWN, timeout), MIGRATION_OUTCOME_UNKNOWN, 'no response means no server detail');
  const refused = migrationFailure(Object.assign(new Error('Group is busy'), { status: 409, code: 'GROUP_BUSY', details: { message: 'Group is busy' } }));
  assert.equal(refused.kind, 'refused');
});

test('clearing needs the line CLEAR <SRC>, typed byte-exact, with manage rights and not while busy', () => {
  assert.equal(clearLockLine(SRC), `CLEAR ${SRC}`);
  assert.equal(clearLockTypedMatches(`CLEAR ${SRC}`, SRC), true);
  assert.equal(clearLockTypedMatches(`CLEAR ${SRC} `, SRC), false, 'a trailing space does not match');
  assert.equal(clearLockTypedMatches(`clear ${SRC}`, SRC), false, 'a case change does not match');
  assert.equal(clearLockTypedMatches(SRC, SRC), false);
  const locked = { ...ready, attemptedAt: '2026-10-29T10:00:00.000Z' };
  assert.equal(migrationControls({ ...locked, clearTyped: `CLEAR ${SRC}` }).clearEnabled, true);
  assert.equal(migrationControls({ ...locked, clearTyped: '' }).clearEnabled, false);
  assert.equal(migrationControls({ ...locked, clearTyped: `CLEAR ${SRC}`, canManage: false }).clearEnabled, false);
  assert.equal(migrationControls({ ...locked, clearTyped: `CLEAR ${SRC}`, busy: true }).clearEnabled, false);
  assert.equal(migrationControls({ ...ready, clearTyped: `CLEAR ${SRC}` }).clearEnabled, false, 'nothing to clear without a lock');
  assert.match(migrationControls({ ...locked }).lockNote, /survives reloads and other tabs/);
  storageMap.clear(); resetMigrationAttemptsForTests(); storageMap.set('brokerId', 'broker-a');
  recordMigrationAttempt(SRC, new Date());
  clearMigrationAttempt(SRC);
  assert.equal(migrationAttemptedAt(SRC), null);
  assert.equal(storageMap.has(migrationAttemptKey(SRC)), false);
});

test('a refused migrate with a server body shows its reason; a timeout, a network error or a bare status is an unknown outcome', () => {
  assert.deepEqual(migrationFailure(Object.assign(new Error('Coverage ownership'), { status: 409, code: 'GROUP_MIGRATION_BLOCKED', details: { message: 'Coverage ownership' } })),
    { kind: 'refused', code: 'GROUP_MIGRATION_BLOCKED', message: 'Coverage ownership' });
  assert.equal(migrationRefusedText({ kind: 'refused', code: 'GROUP_MIGRATION_BLOCKED', message: 'Coverage ownership' }), 'Migration refused by the server (GROUP_MIGRATION_BLOCKED): Coverage ownership');
  assert.equal(migrationRefusedText({ kind: 'refused', code: null, message: 'x' }), 'Migration refused by the server (no code): x');
  assert.deepEqual(migrationFailure(Object.assign(new Error('timeout of 60000ms exceeded'), { code: 'ECONNABORTED' })), { kind: 'unknown' });
  assert.deepEqual(migrationFailure(new Error('Network Error')), { kind: 'unknown' });
  assert.deepEqual(migrationFailure(Object.assign(new Error('Migration request failed.'), { status: 500 })), { kind: 'unknown', detail: 'Server response 500: Migration request failed.' }, 'a status without a body is not a readable refusal');
  assert.deepEqual(migrationFailure(undefined), { kind: 'unknown' });
});

test('the destination count is labelled as visible to this session, with the scope; never called all-login', () => {
  assert.equal(destinationCountLabel(12, DST, 'unrestricted'), 'accounts in destination visible to this session: 12');
  assert.equal(destinationCountLabel(12, DST, 'restricted'), 'accounts in destination visible to this session: 12 (may be partial: restricted scope)');
  assert.equal(destinationCountLabel(12, DST, 'unknown'), 'accounts in destination visible to this session: 12 (unknown scope)');
  assert.equal(destinationCountLabel(12, DST), 'accounts in destination visible to this session: 12 (unknown scope)', 'no scope given: unknown');
  assert.equal(destinationCountLabel(undefined, DST, 'unrestricted'), 'accounts in destination visible to this session: (count unavailable)');
  assert.equal(destinationCountLabel(12, `${DST} `, 'unrestricted'), 'accounts in destination visible to this session: (count unavailable: padded name)', 'a padded destination is never counted');
  assert.equal(/all-login/i.test(destinationCountLabel(12, DST, 'unrestricted')), false);
});

test('the session account scope: all_within_broker is unrestricted, restricted is restricted, anything else is unknown', () => {
  assert.equal(sessionAccountScope({ backend_is_admin: true, is_admin: false }), 'unrestricted', 'the backend claim alone decides');
  assert.equal(sessionAccountScope({ backend_is_admin: false, is_admin: true, group_access_mode: 'all_within_broker' }), 'restricted', 'the store role flag does not make a session unrestricted');
  assert.equal(sessionAccountScope({ group_access_mode: 'all_within_broker' }), 'restricted', 'no backend claim: restricted, never unrestricted');
  assert.equal(sessionAccountScope(buildUserFromAuthPayload({ login: 9001, role: 'admin', is_admin: false, broker_id: 'broker-a' })), 'restricted', 'the real store shape: role admin with a false claim is restricted');
  assert.equal(sessionAccountScope({}), 'restricted', 'a session without is_admin is restricted');
  assert.equal(sessionAccountScope(null), 'unknown');
});
test('Migrate needs the preview of this exact pair, the server allowing it, and the source name typed byte-exact', () => {
  assert.equal(migrationControls({ ...ready, preview: previewOf() }).migrateEnabled, true);
  assert.equal(migrationControls({ ...ready, preview: previewOf({ can_migrate: false }) }).migrateEnabled, false, 'a refused preview blocks Migrate');
  assert.equal(migrationControls({ ...ready, preview: previewOf({ to_group: 'Real\\Other' }) }).migrateEnabled, false, 'a preview of another pair does not count');
  assert.equal(migrationControls({ ...ready, preview: null }).migrateEnabled, false, 'no preview: no Migrate');
  const shown = migrationControls({ ...ready, preview: previewOf({ accounts: 7 }), confirming: true });
  assert.equal(shown.emptiedText, `This group will be emptied: ${SRC}: 7 accounts move to ${DST}`);
  assert.equal(shown.showConfirm, true);
  assert.equal(shown.confirmEnabled, false, 'nothing typed: no confirm');
  assert.equal(migrationControls({ ...ready, preview: previewOf(), confirming: true, confirmTyped: `${SRC} ` }).confirmEnabled, false, 'a padded source name does not confirm');
  assert.equal(migrationControls({ ...ready, preview: previewOf(), confirming: true, confirmTyped: SRC.toLowerCase() }).confirmEnabled, false, 'a case change does not confirm');
  assert.equal(migrationControls({ ...ready, preview: previewOf(), confirming: true, confirmTyped: SRC }).confirmEnabled, true);
  assert.equal(migrationControls({ ...ready, preview: previewOf(), confirming: false, confirmTyped: SRC }).showConfirm, false, 'the confirm step is shown only when asked');
  assert.equal(migrationControls({ ...ready, preview: previewOf({ can_migrate: false }), confirming: true, confirmTyped: SRC }).showConfirm, false, 'no confirm for a refused move');
  assert.equal(confirmTypedMatches(SRC, SRC), true);
  assert.equal(confirmTypedMatches(`${SRC}\t`, SRC), false);
  assert.equal(migrationEmptiedText(SRC, DST, 0), `This group will be emptied: ${SRC}: 0 accounts move to ${DST}`);
});

test('Delete needs a verified migration and the line "DELETE <SRC>" typed byte-exact', () => {
  assert.equal(deleteConfirmLine(SRC), `DELETE ${SRC}`);
  assert.equal(deleteTypedMatches(`DELETE ${SRC}`, SRC), true);
  assert.equal(deleteTypedMatches(`DELETE ${SRC} `, SRC), false, 'a trailing space does not match');
  assert.equal(deleteTypedMatches(`delete ${SRC}`, SRC), false, 'a case change does not match');
  assert.equal(deleteTypedMatches(SRC, SRC), false, 'the bare name does not match');
  const base = { ...ready, preview: previewOf() };
  assert.equal(migrationControls({ ...base, verified: true, deleteTyped: `DELETE ${SRC}` }).deleteEnabled, true);
  assert.equal(migrationControls({ ...base, verified: false, deleteTyped: `DELETE ${SRC}` }).deleteEnabled, false, 'not verified');
  assert.equal(migrationControls({ ...base, verified: true, deleteTyped: '' }).deleteEnabled, false, 'not typed');
  assert.equal(migrationControls({ ...base, verified: true, deleteTyped: `DELETE ${SRC}`, canManage: false }).deleteEnabled, false);
  assert.equal(migrationControls({ ...base, verified: true, deleteTyped: `DELETE ${SRC}`, busy: true }).deleteEnabled, false);
  assert.equal(migrationControls({ ...base, verified: true }).deleteLine, `DELETE ${SRC}`);
});

test('the destination count is shown as the server reports it, and a padded destination is never counted', () => {
  assert.equal(destinationCountText(12, DST), '12');
  assert.equal(destinationCountText(0, DST), '0', 'zero members is a real count');
  assert.equal(destinationCountText(undefined, DST), '(count unavailable)', 'a failed read');
  assert.equal(destinationCountText(-1, DST), '(count unavailable)');
  assert.equal(destinationCountText(2.5, DST), '(count unavailable)');
  assert.equal(destinationCountText(12, `${DST} `), '(count unavailable)', 'the server trims its group parameter, so a padded name would count the twin');
});

test('the server broker and route are shown read-only, with a placeholder when the server does not report them', () => {
  assert.equal(serverBrokerLine({ broker_id: 'broker-a' }), 'Server broker: broker-a');
  assert.equal(serverBrokerLine({ broker_id: 7 }), 'Server broker: 7');
  assert.equal(serverBrokerLine({}), 'Server broker: (not reported)');
  assert.equal(serverBrokerLine({ broker_id: '  ' }), 'Server broker: (not reported)');
  assert.equal(serverBrokerLine(null), 'Server broker: (not reported)');
  assert.equal(serverRouteLine({ from_group: SRC, to_group: DST }), `Server route: ${SRC} → ${DST}`);
  assert.equal(serverRouteLine({}), 'Server route: (not reported) → (not reported)');
});

test('the migration outcome message is fixed and carries no retry instruction', () => {
  assert.equal(MIGRATION_OUTCOME_UNKNOWN, 'Migration outcome unknown: use Check result before any retry');
  assert.equal(DELETE_OUTCOME_UNKNOWN, 'Delete outcome unknown: use Check result before any retry');
});

test('blank and missing values are empty, and the message names the typed value', () => {
  assert.deepEqual(resolveMigrationDestination('   ', ['Real']), { status: 'empty', name: '', suggestion: null });
  assert.deepEqual(resolveMigrationDestination(undefined, ['Real']), { status: 'empty', name: '', suggestion: null });
  assert.equal(destinationNotFoundMessage('Real\\New '), "Destination group 'Real\\New ' not found");
});

// Round 6: a stale open panel re-reads the lock live, clock skew fails closed, memory is per broker, and only a 4xx is a refusal.
test('A-R5-1: a stale open panel sees a lock written by another tab at the request, even though its own render showed none', () => {
  storageMap.clear(); resetMigrationAttemptsForTests(); storageMap.set('brokerId', 'broker-a');
  assert.equal(migrationControls({ ...ready }).locked, false, 'the panel rendered with no lock');
  storageMap.set(migrationAttemptKey(SRC), '2026-10-29T10:00:00.000Z'); // written by another tab
  assert.equal(migrationAttemptedAt(SRC, Date.parse('2026-10-29T10:05:00Z')), '2026-10-29T10:00:00.000Z', 'the live read at the request sees the other tab');
});

test('two panel instances sharing storage: the first records the attempt, the second (its own page memory) is refused by the stored record', () => {
  storageMap.clear(); resetMigrationAttemptsForTests(); storageMap.set('brokerId', 'broker-a');
  const first = recordMigrationAttempt(SRC, new Date('2026-10-29T10:00:00Z'));
  resetMigrationAttemptsForTests(); // the second instance has no in-page record
  assert.equal(migrationAttemptedAt(SRC, Date.parse('2026-10-29T10:01:00Z')), first, 'the second instance is refused by the stored record');
  assert.equal(recordMigrationAttempt(SRC, new Date('2026-10-29T10:02:00Z')), first, 'a second record keeps the first time');
});

test('A-R5-3: a future-dated lock is still a lock, flagged as clock skew; an unreadable stored value fails closed', () => {
  storageMap.clear(); resetMigrationAttemptsForTests(); storageMap.set('brokerId', 'broker-a');
  const future = '2026-10-29T12:00:00.000Z';
  storageMap.set(migrationAttemptKey(SRC), future);
  const nowMs = Date.parse('2026-10-29T10:00:00Z'); // the clock was rolled back two hours
  assert.equal(migrationAttemptedAt(SRC, nowMs), future, 'a future-dated record is a lock, not ignored');
  assert.equal(migrationClockSkewed(future, nowMs), true);
  assert.equal(migrationClockSkewed('2026-10-29T10:00:30Z', nowMs), false, 'inside the 60 second tolerance there is no skew note');
  const controls = migrationControls({ ...ready, attemptedAt: future, nowMs });
  assert.equal(controls.locked, true);
  assert.equal(controls.migrateEnabled, false);
  assert.match(controls.clockSkewNote, /Clock skew/);
  assert.equal(migrationControls({ ...ready, attemptedAt: '2026-10-29T10:00:00.000Z', nowMs }).clockSkewNote, '', 'a past lock has no skew note');
  storageMap.set(migrationAttemptKey(SRC), 'not a time');
  assert.equal(migrationAttemptedAt(SRC, nowMs), 'not a time', 'an unreadable stored value still locks (fail closed)');
});

test('A-R5-5: page memory is keyed by broker: after a broker switch in the same page, the other broker is not locked', () => {
  storageMap.clear(); resetMigrationAttemptsForTests(); storageMap.set('brokerId', 'broker-a');
  recordMigrationAttempt(SRC, new Date('2026-10-29T10:00:00Z'));
  storageMap.set('brokerId', 'broker-b');
  assert.equal(migrationAttemptedAt(SRC, Date.parse('2026-10-29T10:01:00Z')), null, 'broker B is not locked by broker A');
  storageMap.set('brokerId', 'broker-a');
  assert.notEqual(migrationAttemptedAt(SRC, Date.parse('2026-10-29T10:01:00Z')), null, 'broker A still is');
});

test('A-R5-2: only a 4xx with a body is a refusal; a 5xx (even with a body) and a missing response are unknown outcomes', () => {
  assert.equal(migrationFailure(Object.assign(new Error('Coverage ownership'), { status: 409, details: { message: 'Coverage ownership' } })).kind, 'refused');
  assert.deepEqual(migrationFailure(Object.assign(new Error('Migration commit failed'), { status: 500, code: 'MT_RET_ERR_TRADE', details: { message: 'Migration commit failed' } })), { kind: 'unknown', detail: 'Server response 500 (MT_RET_ERR_TRADE): Migration commit failed' }, 'commit failed is an unknown outcome');
  assert.deepEqual(migrationFailure(Object.assign(new Error('Migration refused'), { status: 500, code: 'MT_RET_ERR_TRADE', details: { message: 'Migration refused' } })), { kind: 'unknown', detail: 'Server response 500 (MT_RET_ERR_TRADE): Migration refused' }, 'a refusal after a partial step is sent as 500: unknown');
  assert.deepEqual(migrationFailure(Object.assign(new Error('unavailable'), { status: 503, details: {} })), { kind: 'unknown', detail: 'Server response 503: unavailable' });
  assert.deepEqual(migrationFailure(Object.assign(new Error('timeout of 60000ms exceeded'), { code: 'ECONNABORTED' })), { kind: 'unknown' });
});

test('the count line names the source and destination counts for the session, with the scope', () => {
  assert.equal(visibleCountLabel('source', 3, SRC, 'restricted'), 'accounts in source visible to this session: 3 (may be partial: restricted scope)');
  assert.equal(visibleCountLabel('destination', 0, DST, 'unrestricted'), 'accounts in destination visible to this session: 0');
  assert.equal(DELETE_OUTCOME_UNKNOWN, 'Delete outcome unknown: use Check result before any retry');
});

// R7-13 and R7-04: the engine guard line, and the move timeout (150 s) with its wait-then-check wording.
import { MIGRATION_TIMEOUT_OUTCOME_UNKNOWN, engineGuardLine, isMigrationTimeout } from './groupMigrationWarning.js';

test('R7-13: the engine guard mode from a preview is shown read-only, with a placeholder when the server omits it', () => {
  assert.equal(engineGuardLine({ engine_guard_mode: 'on' }), 'Engine guard: on');
  assert.equal(engineGuardLine({ engine_guard_mode: 'shadow' }), 'Engine guard: shadow');
  assert.equal(engineGuardLine({ engine_guard_mode: 'off' }), 'Engine guard: off');
  assert.equal(engineGuardLine({}), 'Engine guard: (not reported)');
  assert.equal(engineGuardLine({ engine_guard_mode: '   ' }), 'Engine guard: (not reported)');
  assert.equal(engineGuardLine(null), 'Engine guard: (not reported)');
});

test('R7-04: a client timeout of the move is recognised; a 5xx and a refusal are not timeouts', () => {
  assert.equal(isMigrationTimeout(Object.assign(new Error('timeout of 150000ms exceeded'), { code: 'ECONNABORTED' })), true);
  assert.equal(isMigrationTimeout(Object.assign(new Error('socket hang up'), { code: 'ETIMEDOUT' })), true);
  assert.equal(isMigrationTimeout(new Error('timeout of 150000ms exceeded')), true, 'a timeout message with no status');
  assert.equal(isMigrationTimeout(Object.assign(new Error('Migration commit failed'), { status: 500, code: 'ECONNABORTED' })), false, 'a status makes it a response, not a timeout');
  assert.equal(isMigrationTimeout(Object.assign(new Error('Coverage ownership'), { status: 409 })), false);
  assert.equal(isMigrationTimeout(new Error('Network Error')), false, 'a network error is an unknown outcome, not a timeout');
  assert.equal(isMigrationTimeout(undefined), false);
});

test('R7-04: the timeout wording tells the operator to wait at least 3 minutes, then check the result', () => {
  assert.equal(MIGRATION_TIMEOUT_OUTCOME_UNKNOWN, 'Outcome unknown: wait at least 3 minutes, then check the result before any retry');
});

// T6-1: the cross-tab lock. The guard at the request and the storage subscription are pure functions, so the repo tests run them
// directly (a node EventTarget stands in for window; a Map stands in for localStorage).
const memoryStorage = () => {
  const values = new Map();
  return { getItem: (key) => (values.has(key) ? values.get(key) : null), setItem: (key, value) => { values.set(key, String(value)); }, removeItem: (key) => { values.delete(key); }, values };
};

test('T6-1: the guard refuses a lock another tab wrote, and writes its own record before it returns ok', () => {
  resetMigrationAttemptsForTests();
  const storage = memoryStorage();
  const first = beginMigrationAttempt(storage, 'broker-a', SRC, new Date('2026-10-29T10:00:00Z'));
  assert.deepEqual(first, { ok: true, attemptedAt: '2026-10-29T10:00:00.000Z' });
  assert.equal(storage.getItem(migrationAttemptKeyFor('broker-a', SRC)), '2026-10-29T10:00:00.000Z', 'the record is written before the ok');
  resetMigrationAttemptsForTests(); // a second panel or tab: no page memory
  const second = beginMigrationAttempt(storage, 'broker-a', SRC, new Date('2026-10-29T10:01:00Z'));
  assert.equal(second.ok, false, 'a stale panel is refused by the stored record');
  assert.equal(second.reason, 'Migration attempted at 2026-10-29T10:00:00.000Z: use Check result before any retry');
  assert.equal(second.attemptedAt, '2026-10-29T10:00:00.000Z', 'the first attempt time stands');
});

test('T6-1: the guard reads a stored lock and refuses it, but a record past the 24 hours does not block', () => {
  resetMigrationAttemptsForTests();
  const storage = memoryStorage();
  storage.setItem(migrationAttemptKeyFor('broker-a', SRC), '2026-10-29T10:00:00.000Z');
  assert.equal(beginMigrationAttempt(storage, 'broker-a', SRC, new Date('2026-10-29T11:00:00Z')).ok, false);
  const later = beginMigrationAttempt(storage, 'broker-a', SRC, new Date('2026-10-31T10:00:00Z'));
  assert.equal(later.ok, true, 'an expired record is replaced by a new attempt');
  assert.equal(storage.getItem(migrationAttemptKeyFor('broker-a', SRC)), '2026-10-31T10:00:00.000Z');
});

test('A-R7-1 (replaces the T6-1 page fallback): without storage every migrate is refused, and no page-only lock is kept', () => {
  resetMigrationAttemptsForTests();
  assert.deepEqual(beginMigrationAttempt(null, 'broker-a', SRC, new Date('2026-10-29T10:00:00Z')), { ok: false, reason: LOCK_NOT_SAVED_REASON });
  assert.deepEqual(beginMigrationAttempt(null, 'broker-a', SRC, new Date('2026-10-29T10:02:00Z')), { ok: false, reason: LOCK_NOT_SAVED_REASON }, 'a second attempt is refused for the same reason, not by a page record');
});

test('T6-1: the storage subscription calls the change handler on a storage event and stops after unsubscribe', () => {
  const target = new EventTarget();
  let calls = 0;
  const unsubscribe = subscribeMigrationLock(target, () => { calls += 1; });
  target.dispatchEvent(new Event('storage'));
  assert.equal(calls, 1, 'another tab writing storage re-renders the panel');
  unsubscribe();
  target.dispatchEvent(new Event('storage'));
  assert.equal(calls, 1, 'no handler after unsubscribe');
  assert.equal(subscribeMigrationLock(null, () => {})(), undefined, 'no target: a no-op unsubscribe');
  assert.equal(subscribeMigrationLock({}, () => {})(), undefined, 'a target without addEventListener: a no-op');
});


// Round 7 (A-R6-2, A-R6-4): a padded destination is refused even when listed; a padded source is never counted.
test('A-R6-2: a padded destination is refused even when it is listed, and the controls name the reason', () => {
  assert.equal(resolveMigrationDestination('Real\\New ', ['Real\\New ']).status, 'padded');
  const padded = migrationControls({ ...ready, destination: 'Real\\New ', listedNames: ['Real\\New '] });
  assert.equal(padded.destinationStatus, 'padded');
  assert.equal(padded.previewEnabled, false);
  assert.equal(padded.message, 'Destination group names with surrounding spaces are not supported (read-only legacy group)');
});

test('A-R6-4: a padded source is never counted: its count label says so', () => {
  assert.equal(visibleCountLabel('source', 3, 'Real\\Old ', 'unrestricted'), 'accounts in source visible to this session: (count unavailable: padded name)');
  assert.equal(visibleCountLabel('source', 3, 'Real\\Old', 'unrestricted'), 'accounts in source visible to this session: 3');
});
