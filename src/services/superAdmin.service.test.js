import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPER_ADMIN_TOKEN_KEY,
  SUPER_ADMIN_USER_KEY,
  getSuperAdminSession,
  clearSuperAdminSession,
  getSuperAdminOrigin,
  getSuperAdminBaseUrl,
  requireSuperAdminBaseUrl,
  executeSuperAdminOperation,
  loginSuperAdmin,
} from './superAdmin.service.js';

// Setup mock sessionStorage
class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

globalThis.sessionStorage = new MockStorage();
globalThis.window = {
  location: { hostname: 'localhost', origin: 'http://localhost:5173' },
  dispatchEvent: () => {},
};

beforeEach(() => {
  globalThis.sessionStorage.clear();
});

test('getSuperAdminOrigin uses runtime config and returns empty string when unconfigured', () => {
  delete globalThis.window.__RTX5_RUNTIME_CONFIG__;
  assert.equal(getSuperAdminOrigin(), '');

  globalThis.window.__RTX5_RUNTIME_CONFIG__ = {
    SUPER_ADMIN_API_HOST: 'https://superadmin-prod.example.test/',
  };
  assert.equal(getSuperAdminOrigin(), 'https://superadmin-prod.example.test');
  delete globalThis.window.__RTX5_RUNTIME_CONFIG__;
});

test('getSuperAdminSession detects unauthenticated state when token is empty', () => {
  const session = getSuperAdminSession();
  assert.equal(session.isAuthenticated, false);
  assert.equal(session.token, '');
  assert.equal(session.user, null);
});

test('getSuperAdminSession reads token and user from session storage', () => {
  globalThis.sessionStorage.setItem(SUPER_ADMIN_TOKEN_KEY, 'mock-jwt-token-xyz');
  globalThis.sessionStorage.setItem(SUPER_ADMIN_USER_KEY, JSON.stringify({ username: 'admin', role: 'super_admin' }));

  const session = getSuperAdminSession();
  assert.equal(session.isAuthenticated, true);
  assert.equal(session.token, 'mock-jwt-token-xyz');
  assert.equal(session.user.username, 'admin');
  assert.equal(session.user.role, 'super_admin');
});

test('clearSuperAdminSession clears stored token and user', () => {
  globalThis.sessionStorage.setItem(SUPER_ADMIN_TOKEN_KEY, 'token-123');
  globalThis.sessionStorage.setItem(SUPER_ADMIN_USER_KEY, JSON.stringify({ username: 'super' }));

  clearSuperAdminSession();

  const session = getSuperAdminSession();
  assert.equal(session.isAuthenticated, false);
  assert.equal(session.token, '');
  assert.equal(session.user, null);
});

test('super-admin requests throw visibly when the origin is unconfigured', async () => {
  delete globalThis.window.__RTX5_RUNTIME_CONFIG__;
  const previousHostname = globalThis.window.location.hostname;
  globalThis.window.location.hostname = 'admin.example.test';
  try {
    assert.equal(getSuperAdminOrigin(), '');
    assert.equal(getSuperAdminBaseUrl(), '');
    assert.throws(() => requireSuperAdminBaseUrl(), /Super-admin API host is not configured\. Set SUPER_ADMIN_API_HOST\./);
    await assert.rejects(() => loginSuperAdmin({ username: 'sa', password: 'secret' }), /Super-admin API host is not configured/);
    await assert.rejects(() => executeSuperAdminOperation('auth_me'), /Super-admin API host is not configured/);
  } finally {
    globalThis.window.location.hostname = previousHostname;
  }
});
