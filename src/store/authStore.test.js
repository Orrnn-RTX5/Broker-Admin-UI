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
