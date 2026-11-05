// Drives the DEFAULT transport (fetchManagerApi through the shared API client) with its adapter stubbed, so a revert of the
// HTTP status pass-through fails here. The other service tests replace the transport and cannot see that.
// Run with: node --test src/services/groupMigration.transport.test.js
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';




globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.sessionStorage = { values: new Map(), getItem(key) { return this.values.get(key) ?? null; }, setItem(key, value) { this.values.set(key, value); }, removeItem(key) { this.values.delete(key); } };
const { api } = await import('../lib/api.js');
const { useAuthStore } = await import('../store/authStore.js');
useAuthStore.setState({ accessToken: 'session-token', refreshToken: 'session-token', tokenExpiresAt: null, user: { role: 'admin', is_admin: true, broker_id: 'broker-a', login: 9001 }, isAuthenticated: true });

const { createGroupMigration } = await import('./groupMigration.js');
const { isMigrationTimeout, migrationFailure } = await import('../utils/groupMigrationWarning.js');
const originalAdapter = api.defaults.adapter;
afterEach(() => { api.defaults.adapter = originalAdapter; });

// An HTTP error response, as the client sees it: the adapter rejects with the response attached.
const httpError = (status, data) => async (config) => {
  const response = { data, status, statusText: String(status), headers: {}, config, request: {} };
  throw Object.assign(new Error(`Request failed with status code ${status}`), { response, config, isAxiosError: true });
};

test('default transport: a 409 refusal keeps its status, code and reason, and is classified refused', async () => {
  api.defaults.adapter = httpError(409, { message: 'Coverage ownership must be transferred first.', error_code: 'GROUP_MIGRATION_BLOCKED' });
  const error = await createGroupMigration().migrate('Real\\Old', 'Real\\New').catch(failure => failure);
  assert.equal(error.status, 409, 'the HTTP status survives the default transport');
  assert.equal(error.code, 'GROUP_MIGRATION_BLOCKED');
  assert.deepEqual(migrationFailure(error), { kind: 'refused', code: 'GROUP_MIGRATION_BLOCKED', message: 'Coverage ownership must be transferred first.' });
});

test('default transport: a 500 with a body is an unknown outcome, never a refusal', async () => {
  api.defaults.adapter = httpError(500, { message: 'Migration commit failed', error_code: 'MT_RET_ERR_TRADE' });
  const error = await createGroupMigration().migrate('Real\\Old', 'Real\\New').catch(failure => failure);
  assert.equal(error.status, 500);
  assert.deepEqual(migrationFailure(error), { kind: 'unknown', detail: 'Server response 500 (MT_RET_ERR_TRADE): Migration commit failed' });
});

test('default transport: a status returned without a rejection is also kept (the success branch carries it)', async () => {
  api.defaults.adapter = async (config) => ({ data: { message: 'Coverage ownership' }, status: 409, statusText: '409', headers: {}, config, request: {} });
  const error = await createGroupMigration().migrate('Real\\Old', 'Real\\New').catch(failure => failure);
  assert.equal(error.status, 409);
  assert.equal(migrationFailure(error).kind, 'refused');
});

test('default transport: a timeout has no response, is an unknown outcome, and is not retried', async () => {
  let attempts = 0;
  api.defaults.adapter = async () => { attempts += 1; throw Object.assign(new Error('timeout of 60000ms exceeded'), { code: 'ECONNABORTED' }); };
  const error = await createGroupMigration().migrate('Real\\Old', 'Real\\New').catch(failure => failure);
  assert.deepEqual(migrationFailure(error), { kind: 'unknown' });
  assert.equal(attempts, 1, 'a timed-out move is sent once; the client does not retry it');
});

test('R7-04: the move reaches the client with the 150 second timeout, and a timeout is recognised as a timeout on the default transport', async () => {
  let sentTimeout = null;
  api.defaults.adapter = async (config) => { sentTimeout = config.timeout; throw Object.assign(new Error('timeout of 150000ms exceeded'), { code: 'ECONNABORTED' }); };
  const error = await createGroupMigration().migrate('Real\\Old', 'Real\\New').catch(failure => failure);
  assert.equal(sentTimeout, 150000, 'the client is configured with 150 s for the move');
  assert.equal(isMigrationTimeout(error), true);
});
