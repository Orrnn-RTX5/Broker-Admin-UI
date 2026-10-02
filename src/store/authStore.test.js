import { test } from 'node:test';
import assert from 'node:assert/strict';

let importId = 0;

const createStorage = (values = {}) => {
  const store = new Map(Object.entries(values));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  };
};

const installBrowserGlobals = () => {
  const session = createStorage();
  const local = createStorage();
  globalThis.sessionStorage = session;
  globalThis.localStorage = local;
  globalThis.window = {
    dispatchEvent: () => true,
    sessionStorage: session,
    localStorage: local,
  };
};

const importFreshAuthStore = () => import(`./authStore.js?case=${++importId}`);

test('changing the configured broker clears the previous session before auth restores', async () => {
  installBrowserGlobals();
  window.__RTX5_RUNTIME_CONFIG__ = { BROKER_ID: 'new-broker', API_HOST: 'https://new.example' };
  sessionStorage.setItem('broker_info', JSON.stringify({ broker_id: 'old-broker', backend_url: 'https://old.example' }));
  localStorage.setItem('broker_info', JSON.stringify({ broker_id: 'old-broker', backend_url: 'https://old.example' }));
  sessionStorage.setItem('auth', JSON.stringify({ token: 'old-token', broker_id: 'old-broker' }));
  localStorage.setItem('authToken', 'old-token');
  localStorage.setItem('brokerId', 'old-broker');
  localStorage.setItem('feedBrokerToken', 'old-feed-token');
  localStorage.setItem('rtx5-auth-storage', JSON.stringify({
    state: { accessToken: 'old-token', user: { broker_id: 'old-broker' }, isAuthenticated: true },
    version: 0,
  }));
  localStorage.setItem('rtx5.theme', 'dark');

  const { ensureAuthStateFromStorage, useAuthStore } = await importFreshAuthStore();

  assert.equal(useAuthStore.getState().isAuthenticated, false);
  assert.equal(ensureAuthStateFromStorage().accessToken, null);
  assert.equal(sessionStorage.getItem('broker_info'), null);
  assert.equal(localStorage.getItem('broker_info'), null);
  assert.equal(localStorage.getItem('authToken'), null);
  assert.equal(localStorage.getItem('feedBrokerToken'), null);
  assert.equal(localStorage.getItem('rtx5.theme'), 'dark');
});

test('matching configured broker keeps its saved login', async () => {
  installBrowserGlobals();
  window.__RTX5_RUNTIME_CONFIG__ = { BROKER_ID: 'ORRNN', API_HOST: 'https://service.orrnn.com' };
  sessionStorage.setItem('broker_info', JSON.stringify({ broker_id: 'orrnn', backend_url: 'https://service.orrnn.com' }));
  sessionStorage.setItem('auth', JSON.stringify({ token: 'current-token', broker_id: 'orrnn' }));
  localStorage.setItem('authToken', 'current-token');
  localStorage.setItem('brokerId', 'orrnn');
  localStorage.setItem('rtx5-auth-storage', JSON.stringify({
    state: { accessToken: 'current-token', user: { broker_id: 'orrnn' }, isAuthenticated: true },
    version: 0,
  }));

  const { ensureAuthStateFromStorage } = await importFreshAuthStore();

  assert.equal(ensureAuthStateFromStorage().accessToken, 'current-token');
  assert.equal(localStorage.getItem('authToken'), 'current-token');
  assert.equal(JSON.parse(sessionStorage.getItem('broker_info')).broker_id, 'orrnn');
});

test('toolbar searches are scoped per broker and cleared on sign-out', async () => {
  installBrowserGlobals();
  const { clearAuthStorage, getSearchesStorageKey, LEGACY_SEARCHES_KEY } = await importFreshAuthStore();

  localStorage.setItem('brokerId', 'Orrnn');
  assert.equal(getSearchesStorageKey(), 'rtx5.searches:orrnn');

  sessionStorage.setItem('rtx5.searches:orrnn', JSON.stringify({ Managers: 'Nexa' }));
  sessionStorage.setItem('rtx5.searches:nexa', JSON.stringify({ Groups: 'PREP' }));
  sessionStorage.setItem('rtx5.activeTab', '"Managers"');
  localStorage.setItem(LEGACY_SEARCHES_KEY, JSON.stringify({ Managers: 'Nexa' }));

  clearAuthStorage();

  assert.equal(sessionStorage.getItem('rtx5.searches:orrnn'), null);
  assert.equal(sessionStorage.getItem('rtx5.searches:nexa'), null);
  assert.equal(localStorage.getItem(LEGACY_SEARCHES_KEY), null);
  assert.equal(sessionStorage.getItem('rtx5.activeTab'), '"Managers"');
});

test('fresh login is not expired by a stale persisted auth copy', async () => {
  installBrowserGlobals();
  const { AUTH_STORAGE_KEYS, getAuthStorageStatus, useAuthStore } = await importFreshAuthStore();

  useAuthStore.setState({
    accessToken: 'new-token',
    refreshToken: 'new-token',
    tokenExpiresAt: null,
    user: { role: 'admin' },
    isAuthenticated: true,
  });
  sessionStorage.setItem(AUTH_STORAGE_KEYS.session, JSON.stringify({ token: 'new-token' }));
  localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, 'new-token');
  localStorage.setItem(AUTH_STORAGE_KEYS.persisted, JSON.stringify({
    state: { accessToken: 'old-token', tokenExpiresAt: null },
    version: 0,
  }));

  assert.deepEqual(getAuthStorageStatus(), { ok: true });
});

test('real authToken conflicts still invalidate the session', async () => {
  installBrowserGlobals();
  const { AUTH_STORAGE_KEYS, getAuthStorageStatus, useAuthStore } = await importFreshAuthStore();

  useAuthStore.setState({
    accessToken: 'new-token',
    refreshToken: 'new-token',
    tokenExpiresAt: null,
    user: { role: 'admin' },
    isAuthenticated: true,
  });
  sessionStorage.setItem(AUTH_STORAGE_KEYS.session, JSON.stringify({ token: 'new-token' }));
  localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, 'old-token');

  assert.deepEqual(getAuthStorageStatus(), {
    ok: false,
    reason: 'auth_storage_mismatch',
    mismatched: [AUTH_STORAGE_KEYS.accessToken],
  });
});

test('missing session storage is repaired when local authToken matches memory', async () => {
  installBrowserGlobals();
  const { AUTH_STORAGE_KEYS, getAuthStorageStatus, useAuthStore } = await importFreshAuthStore();

  useAuthStore.setState({
    accessToken: 'new-token',
    refreshToken: 'refresh-token',
    tokenExpiresAt: null,
    user: { role: 'admin' },
    isAuthenticated: true,
  });
  localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, 'new-token');

  assert.deepEqual(getAuthStorageStatus(), { ok: true });
  assert.equal(JSON.parse(sessionStorage.getItem(AUTH_STORAGE_KEYS.session)).token, 'new-token');
});

test('auth state can recover from session storage before protected API requests', async () => {
  installBrowserGlobals();
  const { AUTH_STORAGE_KEYS, ensureAuthStateFromStorage, useAuthStore } = await importFreshAuthStore();

  sessionStorage.setItem(AUTH_STORAGE_KEYS.session, JSON.stringify({
    token: 'stored-session-token',
    refresh_token: 'stored-refresh-token',
  }));

  const state = ensureAuthStateFromStorage();

  assert.equal(state.accessToken, 'stored-session-token');
  assert.equal(state.refreshToken, 'stored-refresh-token');
  assert.equal(state.isAuthenticated, true);
  assert.equal(useAuthStore.getState().accessToken, 'stored-session-token');
  assert.equal(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken), 'stored-session-token');
});

test('auth state can recover from persisted storage when session storage is missing', async () => {
  installBrowserGlobals();
  const { AUTH_STORAGE_KEYS, ensureAuthStateFromStorage } = await importFreshAuthStore();

  localStorage.setItem(AUTH_STORAGE_KEYS.persisted, JSON.stringify({
    state: {
      accessToken: 'persisted-token',
      refreshToken: 'persisted-refresh',
      tokenExpiresAt: null,
      user: { role: 'admin' },
      isAuthenticated: true,
    },
    version: 0,
  }));

  const state = ensureAuthStateFromStorage();

  assert.equal(state.accessToken, 'persisted-token');
  assert.equal(state.refreshToken, 'persisted-refresh');
  assert.equal(state.user.role, 'admin');
  assert.equal(JSON.parse(sessionStorage.getItem(AUTH_STORAGE_KEYS.session)).token, 'persisted-token');
});

test('small numeric expires_at values are treated as a duration, not a 1970 timestamp', async () => {
  installBrowserGlobals();
  const { normalizeTokenExpiresAt } = await importFreshAuthStore();

  const before = Date.now();
  const numericExpiry = normalizeTokenExpiresAt(3600);
  const stringExpiry = normalizeTokenExpiresAt('3600');
  const after = Date.now();

  assert.ok(numericExpiry >= before + 3_600_000);
  assert.ok(numericExpiry <= after + 3_600_000);
  assert.ok(stringExpiry >= before + 3_600_000);
  assert.ok(stringExpiry <= after + 3_600_000);
});

test('stale persisted expiry is ignored when active session storage has no expiry', async () => {
  installBrowserGlobals();
  const { AUTH_STORAGE_KEYS, getAuthStorageStatus, useAuthStore } = await importFreshAuthStore();

  useAuthStore.setState({
    accessToken: 'stable-token',
    refreshToken: 'stable-token',
    tokenExpiresAt: null,
    user: { role: 'admin' },
    isAuthenticated: true,
  });
  sessionStorage.setItem(AUTH_STORAGE_KEYS.session, JSON.stringify({ token: 'stable-token' }));
  localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, 'stable-token');
  localStorage.setItem(AUTH_STORAGE_KEYS.persisted, JSON.stringify({
    state: { accessToken: 'stable-token', tokenExpiresAt: 1 },
    version: 0,
  }));

  assert.deepEqual(getAuthStorageStatus(), { ok: true });
});
