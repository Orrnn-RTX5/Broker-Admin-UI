import { test } from 'node:test';
import assert from 'node:assert/strict';

let requestedUrl = '';
let requestedAllowAuthFailure = false;
let requestedAuthorization = '';
let requestedTimeout = 0;

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
  requestedTimeout = config.timeout;
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
  assert.equal(requestedTimeout, 5000);
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

test('initial shell hydration shares its early access read without delaying later polls', async () => {
  useAuthStore.setState({ accessToken: 'startup-session', isAuthenticated: true });
  const originalGet = api.get;
  const pending = [];
  api.get = () => new Promise(resolve => pending.push(resolve));
  try {
    const early = AuthService.primeStartupMe();
    assert.equal(AuthService.getStartupMe(), early);
    assert.equal(AuthService.primeStartupMe(), early, 'Development effect replay must not duplicate the startup request');
    assert.equal(pending.length, 1);
    const fresh = AuthService.getMe();
    assert.equal(pending.length, 2, 'A permission event must start a fresh read');
    pending[1]({ data: { login: 100, group_access_mode: 'none', permissions: [] } });
    await fresh;
    pending[0]({ data: { login: 100, group_access_mode: 'all_within_broker', permissions: ['view_groups'] } });
    await early;
    assert.deepEqual(useAuthStore.getState().user.permissions, []);
  } finally { api.get = originalGet; }
});

test('a replacement token never joins the previous startup access request', async () => {
  useAuthStore.setState({ accessToken: 'startup-old-session', isAuthenticated: true });
  const originalGet = api.get;
  const pending = [];
  api.get = () => new Promise(resolve => pending.push(resolve));
  try {
    const old = AuthService.primeStartupMe();
    useAuthStore.setState({ accessToken: 'startup-replacement-session' });
    const next = AuthService.getStartupMe();
    assert.notEqual(next, old);
    assert.equal(pending.length, 2);
    pending[1]({ data: { login: 200, group_access_mode: 'none', permissions: [] } });
    await next;
    pending[0]({ data: { login: 100, is_admin: true } });
    await old;
    assert.equal(useAuthStore.getState().user.login, 200);
  } finally { api.get = originalGet; }
});

test('logging back in cannot reuse a prior startup snapshot even with the same token', async () => {
  useAuthStore.setState({ accessToken: 'startup-round-trip', isAuthenticated: true });
  const originalGet = api.get;
  let calls = 0;
  api.get = async () => {
    calls++;
    return { data: { login: 100, group_access_mode: calls === 1 ? 'all_within_broker' : 'none', permissions: calls === 1 ? ['view_groups'] : [] } };
  };
  try {
    await AuthService.primeStartupMe();
    useAuthStore.setState({ isAuthenticated: false });
    useAuthStore.setState({ isAuthenticated: true });
    await AuthService.getStartupMe();
    assert.equal(calls, 2);
    assert.equal(useAuthStore.getState().user.group_access_mode, 'none');
  } finally { api.get = originalGet; }
});
