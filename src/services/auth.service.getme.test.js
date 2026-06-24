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
