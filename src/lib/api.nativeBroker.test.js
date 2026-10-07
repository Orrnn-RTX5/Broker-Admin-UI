import { test } from 'node:test';
import assert from 'node:assert/strict';

test('native journal bypasses the legacy namespace while keeping Bearer authentication', async () => {
  const token = 'test-journal-session';
  const expiresAt = Date.now() + 3600000;
  const user = { login: 'preview-admin', broker_id: 'preview', is_admin: true };
  const values = new Map([
    ['authToken', token], ['refreshToken', token], ['tokenExpiresAt', String(expiresAt)],
    ['broker_info', JSON.stringify({ broker_id: 'preview', backend_url: 'https://broker.example' })],
    ['rtx5-auth-storage', JSON.stringify({ state: { accessToken: token, refreshToken: token, tokenExpiresAt: expiresAt, user, isAuthenticated: true }, version: 0 })],
  ]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  globalThis.localStorage = storage;
  globalThis.sessionStorage = storage;
  globalThis.window = { localStorage: storage, sessionStorage: storage, __RTX5_RUNTIME_CONFIG__: { BACKEND_TARGET: 'web', USE_DEV_PROXY: 'false' }, location: { origin: 'https://admin.example', protocol: 'https:' }, dispatchEvent() {} };
  const { api } = await import('./api.js');
  const { useAuthStore } = await import('../store/authStore.js');
  useAuthStore.setState({ accessToken: token, refreshToken: token, tokenExpiresAt: expiresAt, user, isAuthenticated: true });
  const requests = [];
  const adapter = async config => {
    requests.push(config);
    return { status: 200, statusText: 'OK', headers: {}, config, data: { entries: [] } };
  };
  await api.get('/api/v1/manager/journal?limit=200', { _nativeBrokerApi: true, adapter });
  await api.get('/manager/GroupList', { adapter });
  assert.equal(requests[0].url, 'https://broker.example/api/v1/manager/journal?limit=200');
  assert.equal(requests[0].headers.get('Authorization'), `Bearer ${token}`);
  assert.equal(new URL(requests[0].url).searchParams.has('token'), false);
  assert.equal(requests[1].url, 'https://broker.example/manager/GroupList');
  assert.equal(useAuthStore.getState().isAuthenticated, true);

  const { useConnectionStore } = await import('../store/connectionStore.js');
  const { AxiosError } = await import('axios');
  useConnectionStore.setState({ status: 'error', lastError: 'Existing workspace failure' });
  await api.get('/api/v1/manager/journal?limit=50', { _nativeBrokerApi: true, _isolatedConnectionStatus: true, adapter });
  assert.equal(useConnectionStore.getState().lastError, 'Existing workspace failure', 'journal success cannot mask another connection failure');
  useConnectionStore.getState().markOk();
  const fail = async config => { throw new AxiosError('Journal timeout', 'ECONNABORTED', config); };
  await assert.rejects(api.get('/api/v1/manager/journal?limit=50', { _nativeBrokerApi: true, _isolatedConnectionStatus: true, adapter: fail }));
  assert.equal(useConnectionStore.getState().status, 'ok', 'journal timeout is local to its panel');
  await assert.rejects(api.get('/manager/GroupList', { adapter: fail }));
  assert.equal(useConnectionStore.getState().status, 'error', 'other failures still update workspace connection health');
});
