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

test('Clients shares an in-flight census page and synchronously reuses completed pages', async () => {
  AccountsService.invalidateCache();
  const rows = Array.from({ length: 150 }, (_, index) => ({ Login: 2000 + index, Name: `Client ${index}` }));
  const offsets = [];
  let release;
  let started;
  const firstStarted = new Promise(resolve => { started = resolve; });
  mockAdapter = async requestConfig => {
    const { offset = 0, limit = 100 } = requestConfig.params;
    offsets.push(offset);
    if (offset === 0) await new Promise(resolve => { release = resolve; started(); });
    return { data: { accounts: rows.slice(offset, offset + limit), total: rows.length }, status: 200, statusText: 'OK', headers: {}, config: requestConfig, request: {} };
  };
  try {
    const census = AccountsService.getAllAccounts();
    await firstStarted;
    const clients = AccountsService.getAccounts({ page: 1, limit: 100 });
    release();
    const [all, first] = await Promise.all([census, clients]);
    assert.equal(all.length, 150);
    assert.deepEqual(offsets, [0, 100], 'the Clients request must reuse the census first page');
    assert.equal(AccountsService.peekAccounts({ page: 1, limit: 100 }), first, 'ready rows are available synchronously');
    assert.equal(await AccountsService.getAccounts({ page: 1, limit: 100 }), first);
    const second = AccountsService.peekAccounts({ page: 2, limit: 100 });
    assert.equal(second.accounts[0].Login, 2100);
    assert.equal(second.accounts.length, 50);
    assert.deepEqual(offsets, [0, 100], 'reopening either page must not issue another request');
  } finally {
    release?.();
    mockAdapter = null;
    AccountsService.invalidateCache();
  }
});

test('account snapshots expire for fetching, retain display rows, and keep filters separate', async t => {
  AccountsService.invalidateCache();
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  requestCount = 0;
  mockResponseData = { accounts: [{ Login: 1, Name: 'Original' }], total: 200 };
  try {
    const first = await AccountsService.getAccounts({ page: 1, limit: 100 });
    assert.equal(AccountsService.peekAccounts({ page: 2, limit: 100 }), null);
    assert.equal(AccountsService.peekAccounts({ page: 1, limit: 100, search: 'other' }), null);
    now += 61_000;
    assert.equal(AccountsService.peekAccounts({ page: 1, limit: 100 }), null);
    assert.equal(AccountsService.peekAccounts({ page: 1, limit: 100 }, { allowStale: true }), first);
    mockResponseData = { accounts: [{ Login: 1, Name: 'Updated' }], total: 200 };
    const refreshed = await AccountsService.getAccounts({ page: 1, limit: 100 });
    assert.equal(refreshed.accounts[0].Name, 'Updated');
    assert.equal(requestCount, 2, 'an expired snapshot must be fetched again');
    AccountsService.invalidateCache();
    assert.equal(AccountsService.peekAccounts({ page: 1, limit: 100 }, { allowStale: true }), null);
  } finally {
    mockAdapter = null;
    AccountsService.invalidateCache();
  }
});

test('changing broker access discards account snapshots and late responses cannot refill them', async () => {
  AccountsService.invalidateCache();
  const initialUser = { login: 'manager-a', broker_id: 'broker-a', role: 'admin', is_admin: true, permissions: ['*'], access_fingerprint: 'access-a' };
  useAuthStore.setState({ accessToken: 'account-scope-a', isAuthenticated: true, user: initialUser });
  mockResponseData = { accounts: [{ Login: 1 }], total: 200 };
  await AccountsService.getAccounts({ page: 1, limit: 100 });
  useAuthStore.setState({ user: { ...initialUser, access_fingerprint: 'access-restricted' } });
  assert.equal(AccountsService.peekAccounts({ page: 1, limit: 100 }, { allowStale: true }), null);
  let release;
  let started;
  const requestStarted = new Promise(resolve => { started = resolve; });
  mockAdapter = requestConfig => new Promise(resolve => {
    release = () => resolve({ data: { accounts: [{ Login: 1 }], total: 200 }, status: 200, statusText: 'OK', headers: {}, config: requestConfig, request: {} });
    started();
  });
  try {
    const oldRequest = AccountsService.getAccounts({ page: 1, limit: 100 });
    await requestStarted;
    useAuthStore.setState({ accessToken: 'account-scope-b', user: { ...initialUser, broker_id: 'broker-b' } });
    mockAdapter = null;
    mockResponseData = { accounts: [{ Login: 2 }], total: 200 };
    await AccountsService.getAccounts({ page: 1, limit: 100 });
    release();
    await oldRequest;
    assert.equal(AccountsService.peekAccounts({ page: 1, limit: 100 }).accounts[0].Login, 2);
    useAuthStore.getState().logout();
    assert.equal(AccountsService.peekAccounts({ page: 1, limit: 100 }, { allowStale: true }), null);
  } finally {
    release?.();
    mockAdapter = null;
    AccountsService.invalidateCache();
    useAuthStore.setState({ accessToken: 'session-token', isAuthenticated: true, user: { role: 'admin', is_admin: true } });
  }
});

test('failed account fetches can be retried without caching a failed response', async () => {
  AccountsService.invalidateCache();
  mockAdapter = async () => { throw new Error('Synthetic account request failure'); };
  try {
    await assert.rejects(AccountsService.getAccounts({ page: 1, limit: 100 }), /Synthetic account request failure/);
    assert.equal(AccountsService.peekAccounts({ page: 1, limit: 100 }), null);
    mockAdapter = null;
    mockResponseData = { accounts: [{ Login: 3 }], total: 200 };
    assert.equal((await AccountsService.getAccounts({ page: 1, limit: 100 })).accounts[0].Login, 3);
  } finally {
    mockAdapter = null;
    AccountsService.invalidateCache();
  }
});

test('large account censuses retain the first Clients page within a bounded page cache', async () => {
  AccountsService.invalidateCache();
  requestCount = 0;
  mockAdapter = async requestConfig => ({
    data: { accounts: [{ Login: requestConfig.params.offset + 1 }], total: 7000 },
    status: 200, statusText: 'OK', headers: {}, config: requestConfig, request: {},
  });
  try {
    const first = await AccountsService.getAccounts({ page: 1, limit: 100 });
    for (let page = 2; page <= 70; page += 1) await AccountsService.getAccounts({ page, limit: 100 });
    assert.equal(AccountsService.peekAccounts({ page: 1, limit: 100 }), first);
    assert.equal(await AccountsService.getAccounts({ page: 1, limit: 100 }), first);
    assert.equal(AccountsService.peekAccounts({ page: 2, limit: 100 }), null, 'older later pages are evicted');
    assert.equal(requestCount, 70, 'the first page remains ready after more than 64 census pages');
  } finally {
    mockAdapter = null;
    AccountsService.invalidateCache();
  }
});
