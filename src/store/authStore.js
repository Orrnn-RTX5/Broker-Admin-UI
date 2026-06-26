import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const SESSION_EXPIRED_EVENT = 'auth:session-expired';
export const TOKEN_UPDATED_EVENT = 'auth:token-updated';
export const AUTH_STORAGE_KEYS = {
  persisted: 'rtx5-auth-storage',
  session: 'auth',
  accessToken: 'authToken',
  refreshToken: 'refreshToken',
  brokerLogin: 'brokerLogin',
  brokerId: 'brokerId',
  brokerInfo: 'broker_info',
  tokenExpiresAt: 'tokenExpiresAt',
  tokenExpiresAtSnake: 'token_expires_at',
};

const AUTH_STORAGE_EVENT_KEYS = new Set(Object.values(AUTH_STORAGE_KEYS));
const MIN_REASONABLE_EPOCH_SECONDS = 1_000_000_000;

const normalizeExpiresIn = (expiresIn) => {
  const seconds = Number(expiresIn);
  return Number.isFinite(seconds) && seconds > 0 ? Date.now() + seconds * 1000 : null;
};

export const normalizeTokenExpiresAt = (expiresAt, expiresIn) => {
  if (expiresAt !== undefined && expiresAt !== null && expiresAt !== '') {
    if (typeof expiresAt === 'number' && Number.isFinite(expiresAt)) {
      if (expiresAt > 0 && expiresAt < MIN_REASONABLE_EPOCH_SECONDS) {
        return normalizeExpiresIn(expiresAt);
      }
      return expiresAt < 100000000000 ? expiresAt * 1000 : expiresAt;
    }

    const raw = String(expiresAt).trim();
    if (/^\d+$/.test(raw)) {
      const numeric = Number(raw);
      if (numeric > 0 && numeric < MIN_REASONABLE_EPOCH_SECONDS) {
        return normalizeExpiresIn(numeric);
      }
      return numeric < 100000000000 ? numeric * 1000 : numeric;
    }

    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (expiresIn !== undefined && expiresIn !== null && expiresIn !== '') {
    return normalizeExpiresIn(expiresIn);
  }

  return null;
};

export const isTokenExpired = (expiresAt, skewMs = 0) => {
  const expiryMs = normalizeTokenExpiresAt(expiresAt);
  return Boolean(expiryMs && expiryMs <= Date.now() + skewMs);
};

const dispatchAuthEvent = (eventName, detail) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
};

const readJson = (raw) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const getSessionAuth = () => {
  if (typeof window === 'undefined') return null;
  return readJson(sessionStorage.getItem(AUTH_STORAGE_KEYS.session));
};

const getPersistedAuthState = () => {
  if (typeof window === 'undefined') return null;
  const persisted = readJson(localStorage.getItem(AUTH_STORAGE_KEYS.persisted));
  return persisted?.state || persisted;
};

const firstValue = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== '') ?? null;

const getTokenFromSessionAuth = (sessionAuth) =>
  firstValue(sessionAuth?.token, sessionAuth?.access_token, sessionAuth?.session_token);

const getStoredAuthSession = () => {
  if (typeof window === 'undefined') return null;

  const sessionAuth = getSessionAuth();
  const persistedState = getPersistedAuthState();
  const accessToken = firstValue(
    getTokenFromSessionAuth(sessionAuth),
    localStorage.getItem(AUTH_STORAGE_KEYS.accessToken),
    persistedState?.accessToken
  );

  if (!accessToken) return null;

  return {
    accessToken,
    refreshToken: firstValue(
      sessionAuth?.refresh_token,
      sessionAuth?.refreshToken,
      localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken),
      persistedState?.refreshToken,
      accessToken
    ),
    tokenExpiresAt: firstValue(
      sessionAuth?.tokenExpiresAt,
      sessionAuth?.token_expires_at,
      sessionAuth?.expires_at,
      sessionAuth?.expiresAt,
      localStorage.getItem(AUTH_STORAGE_KEYS.tokenExpiresAt),
      localStorage.getItem(AUTH_STORAGE_KEYS.tokenExpiresAtSnake),
      persistedState?.tokenExpiresAt
    ),
    user: persistedState?.user || null,
  };
};

const getLoginPathForExpiredSession = (reason, user) => {
  if (reason === 'logout') return '/';
  return user?.is_admin || user?.role === 'admin' ? '/admin-login' : '/manager-login';
};

export const writeAuthSessionStorage = (accessToken, refreshToken, tokenExpiresAt) => {
  if (typeof window === 'undefined' || !accessToken) return;

  const nextSessionAuth = {
    ...(getSessionAuth() || {}),
    token: accessToken,
    access_token: accessToken,
    session_token: accessToken,
    refresh_token: refreshToken || accessToken,
    tokenExpiresAt: tokenExpiresAt || null,
    token_expires_at: tokenExpiresAt || null,
  };

  try {
    sessionStorage.setItem(AUTH_STORAGE_KEYS.session, JSON.stringify(nextSessionAuth));
    localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, accessToken);
    localStorage.setItem(AUTH_STORAGE_KEYS.refreshToken, refreshToken || accessToken);

    if (tokenExpiresAt) {
      localStorage.setItem(AUTH_STORAGE_KEYS.tokenExpiresAt, String(tokenExpiresAt));
      localStorage.setItem(AUTH_STORAGE_KEYS.tokenExpiresAtSnake, String(tokenExpiresAt));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEYS.tokenExpiresAt);
      localStorage.removeItem(AUTH_STORAGE_KEYS.tokenExpiresAtSnake);
    }
  } catch {
    // Storage can be unavailable in constrained browser contexts.
  }
};

export const ensureAuthStateFromStorage = () => {
  const state = useAuthStore.getState();
  if (state.accessToken) return state;

  const stored = getStoredAuthSession();
  if (!stored?.accessToken || isTokenExpired(stored.tokenExpiresAt)) return state;

  useAuthStore.setState({
    accessToken: stored.accessToken,
    refreshToken: stored.refreshToken || stored.accessToken,
    tokenExpiresAt: normalizeTokenExpiresAt(stored.tokenExpiresAt),
    user: state.user || stored.user,
    isAuthenticated: true,
  });
  writeAuthSessionStorage(stored.accessToken, stored.refreshToken, stored.tokenExpiresAt);
  return useAuthStore.getState();
};

export const clearAuthStorage = () => {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.session);
    localStorage.removeItem(AUTH_STORAGE_KEYS.persisted);
    localStorage.removeItem(AUTH_STORAGE_KEYS.accessToken);
    localStorage.removeItem(AUTH_STORAGE_KEYS.refreshToken);
    localStorage.removeItem(AUTH_STORAGE_KEYS.brokerLogin);
    localStorage.removeItem(AUTH_STORAGE_KEYS.brokerId);
    localStorage.removeItem(AUTH_STORAGE_KEYS.brokerInfo);
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.brokerInfo);
    localStorage.removeItem(AUTH_STORAGE_KEYS.tokenExpiresAt);
    localStorage.removeItem(AUTH_STORAGE_KEYS.tokenExpiresAtSnake);
  } catch {
    // Ignore storage cleanup failures; auth state is still cleared in memory.
  }
};

export const getAuthStorageStatus = (authState) => {
  const state = authState || useAuthStore.getState();
  const accessToken = state.accessToken;

  if (!state.isAuthenticated && !accessToken) {
    return { ok: true };
  }

  if (!accessToken) {
    return { ok: false, reason: 'auth_state_missing_token' };
  }

  if (typeof window === 'undefined') {
    return { ok: true };
  }

  const sessionAuth = getSessionAuth();
  const persistedState = getPersistedAuthState();
  const tokens = [
    { label: AUTH_STORAGE_KEYS.session, value: getTokenFromSessionAuth(sessionAuth) },
    { label: AUTH_STORAGE_KEYS.accessToken, value: localStorage.getItem(AUTH_STORAGE_KEYS.accessToken) },
    { label: AUTH_STORAGE_KEYS.persisted, value: persistedState?.accessToken },
  ];

  const presentTokens = tokens.filter((entry) => entry.value);
  const missing = tokens.filter((entry) => !entry.value).map((entry) => entry.label);
  if (presentTokens.length === 0) {
    return { ok: false, reason: 'auth_storage_missing', missing };
  }

  const mismatched = presentTokens
    .filter((entry) => entry.value !== accessToken)
    .map((entry) => entry.label);
  const blockingMismatched = mismatched.filter((label) => label !== AUTH_STORAGE_KEYS.persisted);
  if (blockingMismatched.length > 0) {
    return { ok: false, reason: 'auth_storage_mismatch', mismatched: blockingMismatched };
  }

  const hasMatchingSessionSource = presentTokens.some((entry) => (
    entry.value === accessToken &&
    (entry.label === AUTH_STORAGE_KEYS.session || entry.label === AUTH_STORAGE_KEYS.accessToken)
  ));
  const hasMatchingPersistedSource = persistedState?.accessToken === accessToken;
  if (!hasMatchingSessionSource && !hasMatchingPersistedSource) {
    return { ok: false, reason: 'auth_storage_mismatch', mismatched };
  }

  const missingRecoverableSessionSource = missing.some((label) => (
    label === AUTH_STORAGE_KEYS.session || label === AUTH_STORAGE_KEYS.accessToken
  ));
  if (missingRecoverableSessionSource) {
    writeAuthSessionStorage(accessToken, state.refreshToken, state.tokenExpiresAt);
  }

  const expiresAt = firstValue(
    state.tokenExpiresAt,
    sessionAuth?.tokenExpiresAt,
    sessionAuth?.token_expires_at,
    sessionAuth?.expires_at,
    sessionAuth?.expiresAt,
    localStorage.getItem(AUTH_STORAGE_KEYS.tokenExpiresAt),
    localStorage.getItem(AUTH_STORAGE_KEYS.tokenExpiresAtSnake)
  );

  if (isTokenExpired(expiresAt)) {
    return { ok: false, reason: 'token_expired' };
  }

  return { ok: true };
};

export const isAuthStorageEvent = (event) =>
  !event || event.key === null || AUTH_STORAGE_EVENT_KEYS.has(event.key);

export const useAuthStore = create(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      user: null,
      isAuthenticated: false,

      setToken: (accessToken, refreshToken, expiresAt, expiresIn) => {
        const tokenExpiresAt = normalizeTokenExpiresAt(expiresAt, expiresIn);
        set({ accessToken, refreshToken, tokenExpiresAt, isAuthenticated: true });
        writeAuthSessionStorage(accessToken, refreshToken, tokenExpiresAt);
        dispatchAuthEvent(TOKEN_UPDATED_EVENT, { tokenExpiresAt });
      },

      setUser: (user) => {
        set({ user, isAuthenticated: true });
      },

      logout: () => {
        set({
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          user: null,
          isAuthenticated: false,
        });
        clearAuthStorage();
      },
    }),
    {
      name: AUTH_STORAGE_KEYS.persisted,
      partialize: (state) => ({ 
        accessToken: state.accessToken, 
        refreshToken: state.refreshToken,
        tokenExpiresAt: state.tokenExpiresAt,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      }),
    }
  )
);

export const validateAuthSession = (fallbackReason = 'auth_storage_invalid') => {
  const status = getAuthStorageStatus();
  if (status.ok) return false;

  expireAuthSession(status.reason || fallbackReason);
  return true;
};

export const expireAuthSession = (reason = 'token_expired') => {
  const { user } = useAuthStore.getState();
  const loginPath = getLoginPathForExpiredSession(reason, user);

  useAuthStore.getState().logout();
  dispatchAuthEvent(SESSION_EXPIRED_EVENT, { reason, loginPath });
};
