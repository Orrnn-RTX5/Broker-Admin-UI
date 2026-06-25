import { test } from 'node:test';
import assert from 'node:assert/strict';

let requestedUrl = '';
let requestedAllowAuthFailure = false;
let requestedParams = null;
let requestCount = 0;
let mockResponseData = {
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
};

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
  requestedParams = config.params;
  requestCount += 1;
  return {
    ...config,
    adapter: async (requestConfig) => ({
      data: mockResponseData,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: requestConfig,
      request: {},
    }),
  };
});

test('Trading Accounts list uses broker manager account details and does not expire login on list failure', async () => {
  requestCount = 0;
  mockResponseData = {
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
  };

  useAuthStore.setState({
    accessToken: 'session-token',
    refreshToken: 'session-token',
    tokenExpiresAt: null,
    user: { role: 'admin', is_admin: true },
    isAuthenticated: true,
  });

  const response = await AccountsService.getAccounts({
    page: 2,
    limit: 100,
    offset: 100,
    search: 'main',
    group: 'real\\standard',
    status: 'active',
  });

  assert.equal(requestedUrl, '/manager/AccountDetailsMany');
  assert.equal(requestedAllowAuthFailure, true);
  assert.deepEqual(requestedParams, {
    page: 2,
    limit: 100,
    offset: 100,
    search: 'main',
    group: 'real\\standard',
    status: 'active',
  });
  assert.deepEqual(response.answer, [
    {
      Login: 990701,
      Name: 'Main Account',
      Group: 'real\\standard',
      Balance: 1000,
      Equity: 990,
      Currency: 'USD',
      Status: 'active',
    },
  ]);
});

test('AccountDetailsMany legacy full-array responses are paged before reaching React state', async () => {
  requestCount = 0;
  mockResponseData = {
    answer: Array.from({ length: 250 }, (_, index) => ({
      Login: 990000 + index,
      Name: `Account ${index + 1}`,
      Group: 'real\\standard',
      Currency: 'USD',
    })),
  };

  const pageTwo = await AccountsService.getAccounts({ page: 2, limit: 100 });

  assert.equal(requestCount, 1);
  assert.deepEqual(requestedParams, {
    page: 2,
    limit: 100,
    offset: 100,
  });
  assert.equal(pageTwo.answer.length, 100);
  assert.equal(pageTwo.answer[0].Login, 990100);
  assert.equal(pageTwo.total, 250);
  assert.equal(pageTwo.pagination.total, 250);

  const pageThree = await AccountsService.getAccounts({ page: 3, limit: 100 });

  assert.equal(requestCount, 1);
  assert.equal(pageThree.answer.length, 50);
  assert.equal(pageThree.answer[0].Login, 990200);
  assert.equal(pageThree.total, 250);
});
