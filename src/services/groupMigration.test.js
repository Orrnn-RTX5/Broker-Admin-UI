/* global Buffer */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { migrationFailure } from '../utils/groupMigrationWarning.js';

const source = await readFile(new URL('./groupMigration.js', import.meta.url), 'utf8');
const { createGroupMigration, migrationIsVerified } = await import('data:text/javascript;base64,' + Buffer.from('const fetchManagerApi=()=>{};\n' + source.slice(source.indexOf('const names ='))).toString('base64'));

test('migration preview and execution keep source/destination identity including nested paths', async () => {
  const calls = [];
  const api = createGroupMigration(async (endpoint, init) => { calls.push({ url: new URL(endpoint, 'http://localhost'), init }); return { ok: true, json: async () => ({ status: 'verified', migration_id: 'migration-one', history_verified: true }) }; });
  await api.preview('real\\old & one', 'real\\new'); await api.migrate('real\\old & one', 'real\\new');
  // Preview is a read-only GET carrying the names in the query.
  assert.equal(calls[0].url.pathname, '/GroupMigrationPreview'); assert.equal(calls[0].init.method, undefined);
  assert.equal(calls[0].url.searchParams.get('from_group'), 'real\\old & one'); assert.equal(calls[0].url.searchParams.get('to_group'), 'real\\new');
  // Migration uses the POST+JSON successor: the legacy mutating GET answers 410 Gone, and the backend rejects a query with a body.
  assert.equal(calls[1].url.pathname, '/GroupMoveAccounts'); assert.equal(calls[1].url.search, '');
  assert.equal(calls[1].init.method, 'POST'); assert.deepEqual(calls[1].init.body, { from_group: 'real\\old & one', to_group: 'real\\new' });
  assert.throws(() => api.preview('same', 'same'));
  assert.throws(() => api.migrate('same', 'same'));
});
test('source deletion uses the POST+JSON successor with only the group field', async () => {
  const calls = [];
  const api = createGroupMigration(async (endpoint, init) => { calls.push({ url: new URL(endpoint, 'http://localhost'), init }); return { ok: true, json: async () => ({ group: 'real\\old & one', deleted: true }) }; });
  assert.deepEqual(await api.remove('real\\old & one', 'DELETE real\\old & one'), { group: 'real\\old & one', deleted: true });
  assert.throws(() => api.remove('real\\old & one'), /DELETE <group>/, 'no typed line: refused before any request');
  assert.throws(() => api.remove('real\\old & one', 'DELETE real\\old & one '), /DELETE <group>/, 'a padded line is refused');
  assert.equal(calls.length, 1, 'the refused deletes sent no request');
  assert.equal(calls[0].url.pathname, '/GroupDelete'); assert.equal(calls[0].url.search, '');
  assert.equal(calls[0].init.method, 'POST'); assert.deepEqual(calls[0].init.body, { group: 'real\\old & one' });
});
test('deletion eligibility requires explicit verified history and migration identity', () => {
  assert.equal(migrationIsVerified({ status: 'verified', migration_id: 'id', history_verified: true }), true);
  assert.equal(migrationIsVerified({ status: 'verified', migration_id: 'id', history_verified: true, from_group: 'wrong', to_group: 'new' }, 'old', 'new'), false);
  for (const result of [{ status: 'running', migration_id: 'id', history_verified: true }, { status: 'verified', migration_id: 'id', history_verified: false }, { status: 'verified', history_verified: true }, { deleted: true }]) assert.equal(migrationIsVerified(result), false);
});
test('migration failures keep backend refusal reasons instead of reporting success', async () => {
  const api = createGroupMigration(async () => ({ ok: false, json: async () => ({ message: 'Coverage ownership must be transferred first.' }) }));
  await assert.rejects(api.migrate('old', 'new'), /Coverage ownership/);
});
test('a case or space twin is a different destination: its exact name is sent, and only an identical pair is refused', async () => {
  const calls = [];
  const api = createGroupMigration(async (endpoint, init) => { calls.push({ url: new URL(endpoint, 'http://localhost'), init }); return { ok: true, json: async () => ({ status: 'verified', migration_id: 'migration-two', history_verified: true }) }; });
  await api.preview('Real\\Old', 'real\\old'); await api.migrate('Real\\Old', 'Real\\Old ');
  assert.equal(calls[0].url.searchParams.get('to_group'), 'real\\old');
  assert.deepEqual(calls[1].init.body, { from_group: 'Real\\Old', to_group: 'Real\\Old ' });
  assert.throws(() => api.migrate('Real\\Old', 'Real\\Old'));
  assert.throws(() => api.preview('Real\\Old', '   '));
});
test('the migrate POST carries a 150 second timeout, the preview GET none, and a timeout is surfaced once, never retried', async () => {
  const seen = [];
  const api = createGroupMigration(async (endpoint, init) => { seen.push({ endpoint, init }); return { ok: true, json: async () => ({ status: 'verified', migration_id: 'm', history_verified: true }) }; });
  await api.preview('Real\\Old', 'Real\\New');
  await api.migrate('Real\\Old', 'Real\\New');
  assert.equal(seen[0].init.timeout, undefined, 'the read has no migration timeout');
  assert.equal(seen[1].init.timeout, 150000, 'the move waits at most 150 seconds, above the backend move bounds');
  const timed = [];
  const slow = createGroupMigration(async (endpoint, init) => { timed.push(init); throw Object.assign(new Error('timeout of 60000ms exceeded'), { code: 'ECONNABORTED' }); });
  await assert.rejects(slow.migrate('Real\\Old', 'Real\\New'), /timeout of 60000ms exceeded/);
  assert.equal(timed.length, 1, 'a timed-out move is not retried by the service');
});
test('the destination count is a plain read of GroupStats for the exact name, with no migration timeout', async () => {
  const calls = [];
  const api = createGroupMigration(async (endpoint, init) => { calls.push({ url: new URL(endpoint, 'http://localhost'), init }); return { ok: true, json: async () => ({ group: 'Real\\New ', accountCount: 9 }) }; });
  const stats = await api.destinationCount('Real\\New');
  assert.equal(stats.accountCount, 9);
  assert.equal(calls[0].url.pathname, '/GroupStats');
  assert.equal(calls[0].url.searchParams.get('group'), 'Real\\New', 'the exact name is sent, unchanged');
  assert.equal(calls[0].init.method, undefined, 'a read is a GET');
  assert.equal(calls[0].init.timeout, undefined);
});
test('a server refusal keeps its status, code and reason, and is classified as refused; no response is an unknown outcome', async () => {
  const refused = createGroupMigration(async () => ({ ok: false, status: 409, json: async () => ({ message: 'Coverage ownership must be transferred first.', error_code: 'GROUP_MIGRATION_BLOCKED' }) }));
  const refusal = await refused.migrate('Real\\Old', 'Real\\New').catch(error => error);
  assert.equal(refusal.status, 409);
  assert.equal(refusal.code, 'GROUP_MIGRATION_BLOCKED');
  assert.match(refusal.message, /Coverage ownership/);
  assert.deepEqual(migrationFailure(refusal), { kind: 'refused', code: 'GROUP_MIGRATION_BLOCKED', message: 'Coverage ownership must be transferred first.' });
  const timedOut = createGroupMigration(async () => { throw Object.assign(new Error('timeout of 60000ms exceeded'), { code: 'ECONNABORTED' }); });
  const timeout = await timedOut.migrate('Real\\Old', 'Real\\New').catch(error => error);
  assert.deepEqual(migrationFailure(timeout), { kind: 'unknown' }, 'a timeout is an unknown outcome');
  const network = createGroupMigration(async () => { throw new Error('Network Error'); });
  assert.deepEqual(migrationFailure(await network.migrate('Real\\Old', 'Real\\New').catch(error => error)), { kind: 'unknown' }, 'a network error is an unknown outcome');
  const bare = createGroupMigration(async () => ({ ok: false, status: 500, json: async () => { throw new Error('not json'); } }));
  assert.equal(migrationFailure(await bare.migrate('Real\\Old', 'Real\\New').catch(error => error)).kind, 'unknown', 'a status without a readable body is not a refusal');
});
