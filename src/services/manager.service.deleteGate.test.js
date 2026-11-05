// The group delete is gated by the typed line DELETE <group>. Without the exact line no request is sent.
// Run with: node --test src/services/manager.service.deleteGate.test.js
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';



import { register } from 'node:module';
register('../../test-support/resolveExtensionless.mjs', import.meta.url);

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.sessionStorage = { values: new Map(), getItem(key) { return this.values.get(key) ?? null; }, setItem(key, value) { this.values.set(key, value); }, removeItem(key) { this.values.delete(key); } };
const { api } = await import('../lib/api.js');
const { useAuthStore } = await import('../store/authStore.js');
useAuthStore.setState({ accessToken: 'session-token', refreshToken: 'session-token', tokenExpiresAt: null, user: { role: 'admin', is_admin: true, broker_id: 'broker-a', login: 9001 }, isAuthenticated: true });

const { ManagerService } = await import('./manager.service.js');
const originalAdapter = api.defaults.adapter;
afterEach(() => { api.defaults.adapter = originalAdapter; });

test('deleteGroup sends nothing without the exact typed line DELETE <group>', async () => {
  let requests = 0;
  api.defaults.adapter = async (config) => { requests += 1; return { data: { deleted: true, group: 'Real\\Old' }, status: 200, statusText: 'OK', headers: {}, config, request: {} }; };
  await assert.rejects(ManagerService.deleteGroup('Real\\Old'), /DELETE <group>/, 'no confirmation');
  await assert.rejects(ManagerService.deleteGroup('Real\\Old', { confirmation: 'DELETE Real\\Old ' }), /DELETE <group>/, 'a padded line is refused');
  await assert.rejects(ManagerService.deleteGroup('Real\\Old', { confirmation: 'delete Real\\Old' }), /DELETE <group>/, 'a case change is refused');
  await assert.rejects(ManagerService.deleteGroup('Real\\Old', { confirmation: 'Real\\Old' }), /DELETE <group>/, 'the bare name is refused');
  assert.equal(requests, 0, 'no request is sent without the line');
});

test('deleteGroup sends its request once the exact line is given', async () => {
  let requests = 0;
  api.defaults.adapter = async (config) => { requests += 1; return { data: { deleted: true, group: 'Real\\Old' }, status: 200, statusText: 'OK', headers: {}, config, request: {} }; };
  await ManagerService.deleteGroup('Real\\Old', { confirmation: 'DELETE Real\\Old' }).catch(() => undefined);
  assert.equal(requests, 1, 'the exact line sends the request');
});
