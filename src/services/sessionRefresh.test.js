import { after, before, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import axios, { AxiosError } from 'axios';

const createStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  };
};

const local = createStorage();
const session = createStorage();
const events = [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Mirrors the manager backend: 1 h access tokens, single-use refresh tokens,
// and 403 "Not authenticated" for an expired or unknown access token.
let server;
const createServer = () => ({
  generation: 1,
  validAccess: 'access-1',
  validRefresh: 'refresh-1',
  refreshCalls: 0,
  apiCalls: [],
  apiResponse: null,
  refreshFailure: null,
});

const respond = (config, status, data) => {
  const response = { data, status, statusText: '', headers: {}, config, request: {} };
  if (!config.validateStatus || config.validateStatus(status)) return response;
  throw new AxiosError(
    `Request failed with status code ${status}`,
    status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
    config,
    {},
    response
  );
};

const adapter = async (config) => {
  const path = new URL(String(config.url), 'http://localhost').pathname;
  if (path.endsWith('/auth/refresh')) {
    server.refreshCalls += 1;
    if (server.refreshFailure) throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    await delay(10);
    const { refresh_token: refreshToken } = JSON.parse(config.data);
    if (refreshToken !== server.validRefresh) {
      return respond(config, 401, { error: 'invalid or expired refresh token', success: false });
    }
    server.generation += 1;
    server.validAccess = `access-${server.generation}`;
    server.validRefresh = `refresh-${server.generation}`;
    // The backend sends access_token only, never a `token` field.
    return respond(config, 200, {
      access_token: server.validAccess,
      refresh_token: server.validRefresh,
      expires_in: 3600,
      token_type: 'Bearer',
    });
  }

  const authorization = config.headers?.Authorization;
  server.apiCalls.push(authorization);
  if (server.apiResponse) return respond(config, ...server.apiResponse());
  if (authorization !== `Bearer ${server.validAccess}`) {
    return respond(config, 403, { code: 'MT_RET_ERR_PERMISSIONS', message: 'Not authenticated' });
  }
  return respond(config, 200, { data: [{ login: 9001 }] });
};

let api;
let authService;
let authStore;
let scheduler;

before(async () => {
  globalThis.localStorage = local;
  globalThis.sessionStorage = session;
  globalThis.window = {
    __RTX5_RUNTIME_CONFIG__: { BACKEND_TARGET: 'web' },
    location: { protocol: 'http:', origin: 'http://localhost:5173' },
    localStorage: local,
    sessionStorage: session,
    dispatchEvent: (event) => {
      events.push({ type: event.type, detail: event.detail });
      return true;
    },
  };
  authStore = await import('../store/authStore.js');
  authService = await import('./authService.js');
  scheduler = await import('./sessionRefreshScheduler.js');
  ({ api } = await import('../lib/api.js'));
  axios.defaults.adapter = adapter;
  api.defaults.adapter = adapter;
});

after(() => {
  delete globalThis.window;
  delete globalThis.localStorage;
  delete globalThis.sessionStorage;
});

beforeEach(() => {
  mock.timers.reset();
  mock.restoreAll();
  mock.method(console, 'log', () => {});
  mock.method(console, 'error', () => {});
  server = createServer();
  local.clear();
  session.clear();
  events.length = 0;
  authStore.useAuthStore.setState({
    accessToken: null, refreshToken: null, tokenExpiresAt: null, user: null, isAuthenticated: false,
  });
});

const signIn = ({ expiresIn = 3600, expiresAt } = {}) => {
  const { setToken, setUser } = authStore.useAuthStore.getState();
  setToken('access-1', 'refresh-1', expiresAt, expiresAt ? undefined : expiresIn);
  setUser({ id: '9001', login: '9001', role: 'admin', is_admin: true, broker_id: 'nexa' });
  events.length = 0;
};

const expiredEvents = () => events.filter((event) => event.type === authStore.SESSION_EXPIRED_EVENT);
const getState = () => authStore.useAuthStore.getState();

test('an active admin is kept signed in past 1 h: the token is refreshed before it expires', async () => {
  mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-09-25T09:00:00Z') });
  signIn();

  const timers = [];
  const running = scheduler.startSessionRefreshScheduler({
    setTimeoutFn: (fn, ms) => timers.push({ fn, ms }),
    clearTimeoutFn: () => {},
  });
  assert.equal(timers[0].ms, 3_600_000 - scheduler.TOKEN_REFRESH_LEAD_MS);

  mock.timers.tick(timers[0].ms);
  await timers[0].fn();

  assert.equal(server.refreshCalls, 1);
  assert.equal(getState().accessToken, 'access-2');
  assert.equal(getState().refreshToken, 'refresh-2');
  assert.equal(getState().tokenExpiresAt, Date.now() + 3_600_000);
  assert.equal(local.getItem('authToken'), 'access-2');
  assert.equal(timers[1].ms, 3_600_000 - scheduler.TOKEN_REFRESH_LEAD_MS);

  mock.timers.tick(7 * 60_000);
  const response = await api.get('/api/v2/admin/users');
  assert.deepEqual(response.data, { data: [{ login: 9001 }] });
  assert.equal(getState().isAuthenticated, true);
  assert.deepEqual(expiredEvents(), []);
  running.stop();
});

test('refreshSession accepts a response with access_token and no token field', async () => {
  signIn();
  const token = await authService.refreshSession();

  assert.equal(token, 'access-2');
  assert.equal(getState().accessToken, 'access-2');
  assert.equal(JSON.parse(session.getItem('auth')).refresh_token, 'refresh-2');
});

test('a network failure during the scheduled refresh retries with backoff and never logs out', async () => {
  mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-09-25T09:00:00Z') });
  signIn();
  server.refreshFailure = true;

  const timers = [];
  const running = scheduler.startSessionRefreshScheduler({
    setTimeoutFn: (fn, ms) => timers.push({ fn, ms }),
    clearTimeoutFn: () => {},
  });
  mock.timers.tick(timers[0].ms);
  await timers[0].fn();

  assert.equal(getState().isAuthenticated, true);
  assert.deepEqual(expiredEvents(), []);
  assert.equal(timers[1].ms, 5_000);

  server.refreshFailure = null;
  await timers[1].fn();
  assert.equal(getState().accessToken, 'access-2');
  running.stop();
});

test('403 "Not authenticated" triggers one refresh, the request is retried and the admin stays signed in', async () => {
  signIn();
  server.validAccess = 'server-side-expired';

  const response = await api.get('/api/v2/admin/users');

  assert.deepEqual(response.data, { data: [{ login: 9001 }] });
  assert.equal(server.refreshCalls, 1);
  assert.deepEqual(server.apiCalls, ['Bearer access-1', 'Bearer access-2']);
  assert.equal(getState().isAuthenticated, true);
  assert.deepEqual(expiredEvents(), []);
});

test('a refused refresh token logs the admin out once, even with several requests in flight', async () => {
  signIn();
  server.validAccess = 'server-side-expired';
  server.validRefresh = 'refresh-token-expired';

  const results = await Promise.allSettled([
    api.get('/api/v2/admin/users'),
    api.get('/api/v2/admin/groups'),
  ]);

  assert.deepEqual(results.map((result) => result.status), ['rejected', 'rejected']);
  assert.equal(server.refreshCalls, 1);
  assert.equal(expiredEvents().length, 1);
  assert.equal(expiredEvents()[0].detail.reason, 'refresh_rejected');
  assert.equal(getState().isAuthenticated, false);
  assert.equal(local.getItem('authToken'), null);
});

test('a real permission denial (403 "Access authority denied") neither refreshes nor logs out', async () => {
  signIn();
  server.apiResponse = () => [403, { code: 'MT_RET_ERR_PERMISSIONS', message: 'Access authority denied this entrypoint' }];

  await assert.rejects(api.get('/api/v2/admin/managers'), (error) => error.response?.status === 403);

  assert.equal(server.refreshCalls, 0);
  assert.equal(getState().isAuthenticated, true);
  assert.deepEqual(expiredEvents(), []);
});

test('a passed local expiry refreshes first and then sends the request instead of rejecting it', async () => {
  signIn({ expiresAt: Date.now() - 1_000 });
  server.validAccess = 'server-side-expired';

  assert.equal(authStore.validateAuthSession(), false);
  await api.get('/api/v2/admin/users');

  assert.equal(server.refreshCalls, 1);
  assert.deepEqual(server.apiCalls, ['Bearer access-2']);
  assert.deepEqual(expiredEvents(), []);
});

// Plays the other tab: it holds the shared refresh lock, rotates the tokens
// the way setToken does in a real tab, then releases the lock.
const rotateInOtherTab = async () => {
  local.setItem('authRefreshLock', JSON.stringify({ owner: 'other-tab', expiresAt: Date.now() + 15_000 }));
  await delay(150);
  server.refreshCalls += 1;
  server.generation += 1;
  server.validAccess = `access-${server.generation}`;
  server.validRefresh = `refresh-${server.generation}`;
  const expiresAt = Date.now() + 3_600_000;
  local.setItem('authToken', server.validAccess);
  local.setItem('refreshToken', server.validRefresh);
  local.setItem('tokenExpiresAt', String(expiresAt));
  local.setItem('token_expires_at', String(expiresAt));
  local.removeItem('authRefreshLock');
};

test('two tabs at expiry make exactly one refresh request and both keep working', async () => {
  signIn({ expiresIn: 60 });

  const [token] = await Promise.all([
    authService.refreshSession({ minValidityMs: scheduler.TOKEN_REFRESH_LEAD_MS }),
    rotateInOtherTab(),
  ]);

  assert.equal(server.refreshCalls, 1);
  assert.equal(token, 'access-2');
  assert.equal(getState().accessToken, 'access-2');
  assert.equal(getState().refreshToken, 'refresh-2');
  await api.get('/api/v2/admin/users');
  assert.deepEqual(server.apiCalls, ['Bearer access-2']);
  assert.deepEqual(expiredEvents(), []);
});

test('the storage check adopts another tab\'s refresh instead of logging out on the token change', async () => {
  signIn();
  await rotateInOtherTab();

  assert.equal(authStore.validateAuthSession('storage_changed'), false);
  assert.equal(getState().accessToken, 'access-2');
  assert.equal(JSON.parse(session.getItem('auth')).token, 'access-2');
  assert.deepEqual(expiredEvents(), []);
});
