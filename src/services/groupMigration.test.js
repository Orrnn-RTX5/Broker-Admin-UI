/* global Buffer */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./groupMigration.js', import.meta.url), 'utf8');
const { createGroupMigration, migrationIsVerified } = await import('data:text/javascript;base64,' + Buffer.from('const fetchManagerApi=()=>{};\n' + source.slice(source.indexOf('const names ='))).toString('base64'));

test('migration preview and execution keep source/destination identity including nested paths', async () => {
  const calls = [];
  const api = createGroupMigration(async endpoint => { calls.push(new URL(endpoint, 'http://localhost')); return { ok: true, json: async () => ({ status: 'verified', migration_id: 'migration-one', history_verified: true }) }; });
  await api.preview('real\\old & one', 'real\\new'); await api.migrate('real\\old & one', 'real\\new');
  assert.equal(calls[0].pathname, '/GroupMigrationPreview'); assert.equal(calls[1].pathname, '/GroupMoveAccounts');
  for (const call of calls) { assert.equal(call.searchParams.get('from_group'), 'real\\old & one'); assert.equal(call.searchParams.get('to_group'), 'real\\new'); }
  assert.throws(() => api.preview('same', 'same'));
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
