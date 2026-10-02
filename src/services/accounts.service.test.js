import { test } from 'node:test';
import assert from 'node:assert/strict';

let requestedUrl = '';
let requestedMethod = '';
let requestedAllowAuthFailure = false;
let requestedParams = null;
let requestedData = null;
let requestCount = 0;
let mockAdapter = null;
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
  requestedMethod = config.method;
  requestedAllowAuthFailure = config._allowAuthFailure === true;
  requestedParams = config.params;
  requestedData = config.data;
  requestCount += 1;
  return {
    ...config,
    adapter: mockAdapter || (async (requestConfig) => ({
      data: mockResponseData,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: requestConfig,
      request: {},
    })),
  };
});

const parseRequestData = () => (
  typeof requestedData === 'string' ? JSON.parse(requestedData) : requestedData
);

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

test('updateAccount sends changed account fields through the account REST update endpoint', async () => {
  requestCount = 0;
  mockResponseData = { ok: true };

  const payload = {
    name: 'Updated Trader',
    email: 'updated@example.com',
    group: 'real\\standard',
  };

  const response = await AccountsService.updateAccount(990701, payload);

  assert.equal(requestedUrl, '/api/v2/accounts/990701');
  assert.equal(requestedMethod, 'put');
  assert.deepEqual(parseRequestData(), payload);
  assert.deepEqual(response, { ok: true });
});

test('successful account reassignment reloads group membership instead of reusing the legacy cache', async () => {
  AccountsService.invalidateCache();
  requestCount = 0;
  const originalRows = [
    { Login: 1, Group: 'real' },
    { Login: 2, Group: 'real' },
    { Login: 3, Group: 'demo' },
  ];
  mockResponseData = { answer: originalRows };
  await AccountsService.getAccounts({ page: 1, limit: 2 });
  const before = await AccountsService.getAccounts({ group: 'demo', page: 1, limit: 2 });
  assert.deepEqual(before.answer.map((row) => row.Login), [3]);
  assert.equal(requestCount, 1, 'the initial group lookup should use the legacy cache');

  mockResponseData = { ok: true };
  await AccountsService.updateAccount(1, { group: 'demo' });
  mockResponseData = {
    answer: originalRows.map((row) => row.Login === 1 ? { ...row, Group: 'demo' } : row),
  };
  await AccountsService.getAccounts({ page: 1, limit: 2 });
  const after = await AccountsService.getAccounts({ group: 'demo', page: 1, limit: 2 });
  assert.deepEqual(after.answer.map((row) => row.Login), [1, 3]);
  assert.equal(requestCount, 3, 'a successful update must be followed by one fresh list request');
  AccountsService.invalidateCache();
});

test('manual invalidation prevents an older in-flight request from restoring stale membership', async () => {
  AccountsService.invalidateCache();
  requestCount = 0;
  let releaseOldResponse;
  let markOldRequestStarted;
  const oldRequestStarted = new Promise((resolve) => { markOldRequestStarted = resolve; });
  mockAdapter = (requestConfig) => new Promise((resolve) => {
    releaseOldResponse = () => resolve({
      data: { answer: [{ Login: 1, Group: 'real' }, { Login: 2, Group: 'real' }] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: requestConfig,
      request: {},
    });
    markOldRequestStarted();
  });

  try {
    const oldRequest = AccountsService.getAccounts({ page: 1, limit: 1 });
    await oldRequestStarted;
    AccountsService.invalidateCache();
    mockAdapter = null;
    mockResponseData = { answer: [{ Login: 1, Group: 'demo' }, { Login: 2, Group: 'real' }] };
    const freshResponse = await AccountsService.getAccounts({ page: 1, limit: 1 });
    assert.equal(freshResponse.answer[0].Group, 'demo');
    assert.equal(requestCount, 2, 'refresh must start a new request instead of reusing the old one');

    releaseOldResponse();
    await oldRequest;
    const afterOldRequest = await AccountsService.getAccounts({ group: 'demo', page: 1, limit: 1 });
    assert.deepEqual(afterOldRequest.answer.map((row) => row.Login), [1]);
    assert.equal(requestCount, 2, 'the newly populated cache must survive the late old response');
  } finally {
    mockAdapter = null;
    releaseOldResponse?.();
    AccountsService.invalidateCache();
  }
});

test('getAllAccounts reads every page without a group filter and shares the result until invalidated', async () => {
  AccountsService.invalidateCache();
  useAuthStore.setState({ accessToken: 'session-token', user: { role: 'admin', is_admin: true }, isAuthenticated: true });
  const seenParams = [];
  const rows = Array.from({ length: 150 }, (_, index) => ({ login: 1000 + index, group: index % 2 ? 'dipannita' : 'Orrnn/demo-std' }));
  mockAdapter = async (requestConfig) => {
    seenParams.push(requestConfig.params);
    const { offset = 0, limit = 100 } = requestConfig.params;
    return { data: { accounts: rows.slice(offset, offset + limit), total: rows.length }, status: 200, statusText: 'OK', headers: {}, config: requestConfig, request: {} };
  };
  try {
    const all = await AccountsService.getAllAccounts();
    assert.equal(all.length, 150);
    assert.ok(seenParams.every(params => params.group === undefined), 'no server-side group filter');
    const requests = seenParams.length;
    assert.equal(await AccountsService.getAllAccounts(), all, 'second caller reuses the loaded list');
    assert.equal(seenParams.length, requests);
    AccountsService.invalidateCache();
    await AccountsService.getAllAccounts();
    assert.ok(seenParams.length > requests, 'invalidation forces a fresh read');
  } finally {
    mockAdapter = null;
    AccountsService.invalidateCache();
  }
});
