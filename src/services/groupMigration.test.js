/* global Buffer */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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
  assert.deepEqual(await api.remove('real\\old & one'), { group: 'real\\old & one', deleted: true });
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
