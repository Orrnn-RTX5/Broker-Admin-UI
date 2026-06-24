import { test } from 'node:test';
import assert from 'node:assert/strict';

let requestedUrl = '';
let requestedAllowAuthFailure = false;

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
const { AccountsService } = await import('./accounts.service.js');

api.interceptors.request.use((config) => {
  requestedUrl = config.url;
  requestedAllowAuthFailure = config._allowAuthFailure === true;
  return {
    ...config,
    adapter: async (requestConfig) => ({
      data: {
        answer: [
          {
            Login: 990701,
            Name: 'Main Account',
            Group: 'real\\standard',
            Balance: 1000,
            Equity: 990,
            Currency: 'USD',
            Status: 'active',
          },
        ],
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: requestConfig,
      request: {},
    }),
  };
});

test('Trading Accounts list uses broker manager account details and does not expire login on list failure', async () => {
  useAuthStore.setState({
    accessToken: 'session-token',
    refreshToken: 'session-token',
    tokenExpiresAt: null,
    user: { role: 'admin', is_admin: true },
    isAuthenticated: true,
  });

  const rows = await AccountsService.getAccounts();

  assert.equal(requestedUrl, '/manager/AccountDetailsMany');
  assert.equal(requestedAllowAuthFailure, true);
  assert.deepEqual(rows, [
    {
      id: 990701,
      login: 990701,
      name: 'Main Account',
      group: 'real\\standard',
      balance: 1000,
      equity: 990,
      currency: 'USD',
      status: 'active',
    },
  ]);
});
