/**
 * Authentication Service
 * Centralizes localStorage operations for tokens and handles session refresh.
 */

import axios from 'axios';
import { buildManagerApiUrl } from '../config/endpoints.js';
import {
  adoptRotatedTokens,
  expireAuthSession,
  normalizeTokenExpiresAt,
  useAuthStore,
} from '../store/authStore.js';

const TOKENS = {
  AUTH: 'authToken',
  REFRESH: 'refreshToken',
  BROKER_LOGIN: 'brokerLogin',
  BROKER_ID: 'brokerId',
};

const REFRESH_PATH = '/api/v1/auth/refresh';
// Refresh tokens are single-use, so only one tab may call the refresh endpoint
// at a time. navigator.locks is preferred; the localStorage lock is the fallback.
const REFRESH_LOCK_NAME = 'rtx5-auth-refresh';
const REFRESH_LOCK_KEY = 'authRefreshLock';
const REFRESH_LOCK_TTL_MS = 15_000;
const REFRESH_REQUEST_TIMEOUT_MS = 15_000;

const getSessionAuth = () => {
  try {
    const raw = sessionStorage.getItem('auth');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getAccessTokenFromPayload = (data) => data?.access_token || data?.token || data?.session_token || null;

export const getAuthToken = () => getSessionAuth()?.token || localStorage.getItem(TOKENS.AUTH);
export const getRefreshToken = () => getSessionAuth()?.refresh_token || localStorage.getItem(TOKENS.REFRESH);

export const setSession = (data) => {
  const token = getAccessTokenFromPayload(data);
  sessionStorage.setItem('auth', JSON.stringify({ ...data, token }));
  if (token) localStorage.setItem(TOKENS.AUTH, token);
  if (data.refresh_token) localStorage.setItem(TOKENS.REFRESH, data.refresh_token);
  if (data.login) localStorage.setItem(TOKENS.BROKER_LOGIN, String(data.login));
  if (data.broker_id) localStorage.setItem(TOKENS.BROKER_ID, data.broker_id);
};

export const clearSession = () => {
  sessionStorage.removeItem('auth');
  localStorage.removeItem(TOKENS.AUTH);
  localStorage.removeItem(TOKENS.REFRESH);
  localStorage.removeItem(TOKENS.BROKER_LOGIN);
  localStorage.removeItem(TOKENS.BROKER_ID);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readRefreshLock = () => {
  try {
    return JSON.parse(localStorage.getItem(REFRESH_LOCK_KEY) || 'null');
  } catch {
    return null;
  }
};

const writeRefreshLock = (value) => {
  try {
    if (value) localStorage.setItem(REFRESH_LOCK_KEY, JSON.stringify(value));
    else localStorage.removeItem(REFRESH_LOCK_KEY);
  } catch {
    // Storage can be unavailable; the refresh still runs, only unguarded.
  }
};

const withStorageRefreshLock = async (task) => {
  const owner = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const deadline = Date.now() + REFRESH_LOCK_TTL_MS;
  let acquired = false;

  while (!acquired && Date.now() < deadline) {
    const lock = readRefreshLock();
    if (lock && lock.expiresAt > Date.now()) {
      await sleep(100);
      continue;
    }
    writeRefreshLock({ owner, expiresAt: Date.now() + REFRESH_LOCK_TTL_MS });
    // Another tab may have written at the same moment; the last writer wins.
    await sleep(25);
    acquired = readRefreshLock()?.owner === owner;
  }

  try {
    // After the deadline the task still runs: it re-reads the shared tokens
    // first, so a rotation by the lock holder is picked up.
    return await task();
  } finally {
    if (readRefreshLock()?.owner === owner) writeRefreshLock(null);
  }
};

const withCrossTabRefreshLock = (task) => {
  const locks = globalThis.navigator?.locks;
  if (typeof locks?.request === 'function') return locks.request(REFRESH_LOCK_NAME, task);
  if (typeof window !== 'undefined' && window.localStorage) return withStorageRefreshLock(task);
  return task();
};

// `rejected` means the backend refused the refresh token (the session is
// over); any other failure (network, 5xx) is transient.
const requestTokenRefresh = async (refreshToken) => {
  try {
    const response = await axios.post(buildManagerApiUrl(REFRESH_PATH), { refresh_token: refreshToken }, {
      headers: { accept: 'application/json', 'Content-Type': 'application/json' },
      timeout: REFRESH_REQUEST_TIMEOUT_MS,
      validateStatus: () => true,
    });

    if ([400, 401, 403].includes(response.status)) return { rejected: true };
    if (response.status < 200 || response.status >= 300) {
      return { rejected: false, error: new Error(`Refresh failed: HTTP ${response.status}`) };
    }
    if (!getAccessTokenFromPayload(response.data)) {
      return { rejected: false, error: new Error('Refresh response did not include an access token') };
    }
    return { rejected: false, data: response.data };
  } catch (error) {
    return { rejected: false, error };
  }
};

let refreshPromise = null;

/**
 * Renews the access token with the refresh token and resolves the new token,
 * or null when it could not be renewed. A refused refresh token ends the
 * session; a network/server failure does not (the caller may retry).
 *
 * Single-flight: one refresh per tab (promise lock) and across tabs (lock plus
 * re-reading the shared tokens), because a refresh token can be used once.
 *
 * - rejectedToken: the access token the backend just refused. If the current
 *   token already differs, someone else refreshed and it is returned as is.
 * - minValidityMs: skip the call while the token is valid for at least this
 *   long (used by the scheduled refresh when another tab refreshed first).
 */
export const refreshSession = ({ rejectedToken = null, minValidityMs = 0 } = {}) => {
  if (refreshPromise) return refreshPromise;

  adoptRotatedTokens();
  const startingRefreshToken = useAuthStore.getState().refreshToken;
  if (!startingRefreshToken) {
    expireAuthSession('refresh_token_missing');
    return Promise.resolve(null);
  }

  refreshPromise = (async () => {
    try {
      return await withCrossTabRefreshLock(async () => {
        adoptRotatedTokens();
        const state = useAuthStore.getState();
        // Logged out (here or in another tab) while waiting for the lock.
        if (!state.accessToken || !state.refreshToken) return null;

        const expiresAt = normalizeTokenExpiresAt(state.tokenExpiresAt);
        const remainingMs = expiresAt ? expiresAt - Date.now() : Number.POSITIVE_INFINITY;
        const rotatedElsewhere = state.refreshToken !== startingRefreshToken ||
          Boolean(rejectedToken && state.accessToken !== rejectedToken);
        if (remainingMs > 0 && rotatedElsewhere) return state.accessToken;
        if (minValidityMs > 0 && remainingMs > minValidityMs) return state.accessToken;

        const result = await requestTokenRefresh(state.refreshToken);
        if (result.rejected) {
          expireAuthSession('refresh_rejected');
          return null;
        }
        if (!result.data) {
          console.error('Session refresh failed:', result.error);
          return null;
        }
        // A logout while the request was in flight must not be undone.
        if (!useAuthStore.getState().accessToken) return null;

        const { data } = result;
        const accessToken = getAccessTokenFromPayload(data);
        useAuthStore.getState().setToken(
          accessToken,
          data.refresh_token || state.refreshToken,
          data.expires_at || data.expiresAt || data.token_expires_at,
          data.expires_in || data.expiresIn
        );
        return accessToken;
      });
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

export default {
  getAuthToken,
  getRefreshToken,
  setSession,
  clearSession,
  refreshSession,
};
