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
  const session = createStorage({
    auth: JSON.stringify({ token: 'session-token' }),
    broker_info: JSON.stringify({ broker_id: 'demo', backend_url: 'https://broker.example.com' }),
  });
  const local = createStorage({
    authToken: 'session-token',
    refreshToken: 'refresh-token',
    brokerLogin: '1001',
    brokerId: 'demo',
    tokenExpiresAt: String(Date.now() + 60_000),
    token_expires_at: String(Date.now() + 60_000),
  });
  globalThis.sessionStorage = session;
  globalThis.localStorage = local;
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, options = {}) {
      super(type);
      this.detail = options.detail;
    }
  };
  globalThis.window = {
    __RTX5_RUNTIME_CONFIG__: { BACKEND_TARGET: 'web' },
    location: { protocol: 'https:' },
    sessionStorage: session,
    localStorage: local,
    dispatchEvent: () => true,
    rtx5Electron: { clearBrokerOrigins: () => {} },
  };
};

const importFresh = (path) => import(`${path}?case=${++importId}`);

test('logout clears local auth and broker state before slow Disconnect resolves', async () => {
  installBrowserGlobals();
  const { useAuthStore } = await import('../store/authStore.js');
  useAuthStore.setState({
    accessToken: 'session-token',
    refreshToken: 'refresh-token',
    tokenExpiresAt: Date.now() + 60_000,
    user: { role: 'manager' },
    isAuthenticated: true,
  });

  const { api } = await import('../lib/api.js');
  let disconnectStarted = false;
  let resolveDisconnect;
  api.get = () => {
    disconnectStarted = true;
    return new Promise((resolve) => {
      resolveDisconnect = resolve;
    });
  };

  const { AuthService } = await importFresh('./auth.service.js');
  const logoutPromise = AuthService.logout();

  assert.equal(disconnectStarted, true);
  assert.equal(sessionStorage.getItem('auth'), null);
  assert.equal(sessionStorage.getItem('broker_info'), null);
  assert.equal(localStorage.getItem('authToken'), null);
  assert.equal(localStorage.getItem('refreshToken'), null);
  assert.equal(useAuthStore.getState().isAuthenticated, false);

  await logoutPromise;
  resolveDisconnect?.({ data: {} });
});
