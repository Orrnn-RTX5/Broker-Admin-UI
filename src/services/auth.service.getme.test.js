import { test } from 'node:test';
import assert from 'node:assert/strict';

let requestedUrl = '';

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
const { AuthService } = await import('./auth.service.js');

api.interceptors.request.use((config) => {
  requestedUrl = config.url;
  return {
    ...config,
    adapter: async (requestConfig) => ({
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
    }),
  };
});

test('getMe hydrates admin sessions through the manager API namespace', async () => {
  const user = await AuthService.getMe();

  assert.equal(requestedUrl, '/manager/api/v2/auth/me');
  assert.equal(user.login, 990701);
  assert.equal(user.role, 'admin');
  assert.equal(user.broker_id, 'testorrnn');
});
