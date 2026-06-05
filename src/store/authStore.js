import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const SESSION_EXPIRED_EVENT = 'auth:session-expired';
export const TOKEN_UPDATED_EVENT = 'auth:token-updated';

export const normalizeTokenExpiresAt = (expiresAt, expiresIn) => {
  if (expiresAt !== undefined && expiresAt !== null && expiresAt !== '') {
    if (typeof expiresAt === 'number' && Number.isFinite(expiresAt)) {
      return expiresAt < 100000000000 ? expiresAt * 1000 : expiresAt;
    }

    const raw = String(expiresAt).trim();
    if (/^\d+$/.test(raw)) {
      const numeric = Number(raw);
      return numeric < 100000000000 ? numeric * 1000 : numeric;
    }

    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (expiresIn !== undefined && expiresIn !== null && expiresIn !== '') {
    const seconds = Number(expiresIn);
    return Number.isFinite(seconds) ? Date.now() + seconds * 1000 : null;
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

export const useAuthStore = create(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      user: null,
      isAuthenticated: false,

      setToken: (accessToken, refreshToken, expiresAt, expiresIn) => {
        const tokenExpiresAt = normalizeTokenExpiresAt(expiresAt, expiresIn);
        set({ accessToken, refreshToken, tokenExpiresAt, isAuthenticated: true });
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
      },
    }),
    {
      name: 'rtx5-auth-storage',
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

export const expireAuthSession = (reason = 'token_expired') => {
  useAuthStore.getState().logout();
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('auth');
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('brokerLogin');
    localStorage.removeItem('brokerId');
    localStorage.removeItem('tokenExpiresAt');
    localStorage.removeItem('token_expires_at');
  }
  dispatchAuthEvent(SESSION_EXPIRED_EVENT, { reason });
};
