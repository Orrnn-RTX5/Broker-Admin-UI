import { test } from 'node:test';
import assert from 'node:assert/strict';

let requestedUrl = '';
let requestedAllowAuthFailure = false;
let requestedAuthorization = '';

globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

globalThis.sessionStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const { api } = await import('../lib/api.js');
const { useAuthStore } = await import('../store/authStore.js');
const { AuthService } = await import('./auth.service.js');

api.interceptors.request.use((config) => {
  requestedUrl = config.url;
  requestedAllowAuthFailure = config._allowAuthFailure === true;
  return {
    ...config,
    adapter: async (requestConfig) => {
      requestedAuthorization = requestConfig.headers?.Authorization || '';
      return {
        data: {
          login: 990701,
          role: 'admin',
          is_admin: true,
          broker_id: 'testorrnn',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: requestConfig,
        request: {},
      };
    },
  };
});

test('getMe hydrates admin sessions through the manager API namespace', async () => {
  useAuthStore.setState({
    accessToken: 'session-token',
    refreshToken: 'session-token',
    tokenExpiresAt: null,
    user: null,
    isAuthenticated: true,
  });

  const user = await AuthService.getMe();

  assert.equal(requestedUrl, '/manager/api/v2/auth/me');
  assert.equal(requestedAllowAuthFailure, true);
  assert.equal(requestedAuthorization, 'Bearer session-token');
  assert.equal(user.login, 990701);
  assert.equal(user.role, 'admin');
  assert.equal(user.broker_id, 'testorrnn');
});

test('an older access poll cannot overwrite a newer revocation snapshot', async () => {
  useAuthStore.setState({ accessToken: 'same-session', isAuthenticated: true });
  const originalGet = api.get;
  const pending = [];
  api.get = () => new Promise(resolve => pending.push(resolve));
  try {
    const older = AuthService.getMe();
    const newer = AuthService.getMe();
    pending[1]({ data: { login: 100, broker_id: 'A', group_access_mode: 'none', permissions: [] } });
    await newer;
    pending[0]({ data: { login: 100, broker_id: 'A', group_access_mode: 'all_within_broker', permissions: ['view_groups', 'manage_groups'] } });
    await older;
    assert.equal(useAuthStore.getState().user.group_access_mode, 'none');
    assert.deepEqual(useAuthStore.getState().user.permissions, []);
  } finally { api.get = originalGet; }
});

test('an old identity response cannot hydrate a replacement session', async () => {
  useAuthStore.setState({ accessToken: 'old-identity', isAuthenticated: true });
  const originalGet = api.get;
  let finish;
  api.get = () => new Promise(resolve => { finish = resolve; });
  try {
    const request = AuthService.getMe();
    useAuthStore.setState({ accessToken: 'new-identity', user: { login: 200, group_access_mode: 'none' } });
    finish({ data: { login: 100, is_admin: true, group_access_mode: 'all_within_broker' } });
    await request;
    assert.equal(useAuthStore.getState().user.login, 200);
  } finally { api.get = originalGet; }
});
