import axios from 'axios';
import {
  ensureAuthStateFromStorage,
  expireAuthSession,
  isTokenExpired,
  useAuthStore,
  validateAuthSession,
} from '../store/authStore.js';
import { useConnectionStore } from '../store/connectionStore.js';
import { refreshSession } from '../services/authService.js';
import { redactForLog, redactUrlForLog } from './logRedaction.js';


import { API_HOST, buildBrokerApiUrl, buildExtApiUrl, buildManagerApiUrl, shouldUseLocalDevProxy } from '../config/endpoints.js';

const AUTH_REJECTION_RE = /\b(not authenticated|unauthenticated|unauthorized|missing authorization|missing bearer|invalid token|token expired|expired token|invalid session|session expired|invalid jwt|jwt expired)\b/i;
const AUTH_QUERY_PARAM_RE = /^(token|access_token|refresh_token|session|session_token|auth|authorization|jwt)$/i;
const MANAGER_API_PATH_RE = /^\/manager(?:\/|\?|$)|^\/api\/v\d+\/(?:admin|manager|accounts?)(?:\/|\?|$)/i;
const PROTECTED_API_PATH_RE = /(?:^|\/)(?:manager)(?:\/|$)|\/api\/v\d+\/(?:admin|manager|accounts?)(?:\/|$)/i;
const PUBLIC_AUTH_PATH_RE = /\/api\/v\d+\/(?:admin\/login|auth\/login|auth\/refresh|broker\/servers)(?:\/|\?|$)/i;
const AUTH_TOKEN_MISSING_MESSAGE = 'Missing auth token. Please log in again.';
const DESKTOP_BACKEND_MISSING_MESSAGE = 'Broker backend URL is not configured. Sign out and select the broker again.';
const SILENT_ERROR_FLAG = '__rtx5SuppressLog';
const isAbsoluteHttpUrl = (value = '') => /^https?:\/\//i.test(String(value || ''));
const isElectronDesktop = () =>
  typeof window !== 'undefined' &&
  typeof window.rtx5Electron === 'object' &&
  window.rtx5Electron !== null;
let brokerBackendMissingSessionExpired = false;

export const shouldSuppressApiErrorLog = (error) => Boolean(error?.[SILENT_ERROR_FLAG]);

const createSilentError = (message, flags = {}) => {
  const error = new Error(message);
  error[SILENT_ERROR_FLAG] = true;
  return Object.assign(error, flags);
};

// A refresh that failed for a transient reason (network, 5xx) keeps the user
// signed in; only a session that is actually gone reports "Session expired".
const createRenewalError = () => new Error(useAuthStore.getState().isAuthenticated
  ? 'Could not renew the session. Check the connection and try again.'
  : 'Session expired. Please log in again.');

const getBearerToken = (headers) => {
  const value = headers?.Authorization ?? headers?.authorization ?? headers?.get?.('Authorization');
  const match = /^Bearer\s+(.+)$/i.exec(String(value || ''));
  return match ? match[1] : null;
};

const expireMissingBrokerBackendSession = () => {
  if (brokerBackendMissingSessionExpired) return;
  brokerBackendMissingSessionExpired = true;
  expireAuthSession('broker_backend_missing');
};

const isCurrentTokenValue = (value, token) =>
  !!token && String(value || '') === String(token);

const shouldRemoveAuthQueryParam = (key, value, token) =>
  AUTH_QUERY_PARAM_RE.test(key) || (String(key).toLowerCase() === 'id' && isCurrentTokenValue(value, token));

const stripAuthQueryFromUrl = (url, token) => {
  if (!url || !token) return url;

  try {
    const raw = String(url);
    const isAbsolute = /^[a-z][a-z\d+.-]*:\/\//i.test(raw);
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const parsed = new URL(raw, base);
    const keysToDelete = [];

    parsed.searchParams.forEach((value, key) => {
      if (shouldRemoveAuthQueryParam(key, value, token)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => parsed.searchParams.delete(key));

    return isAbsolute
      ? parsed.toString()
      : `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
};

const stripAuthQueryFromParams = (params, token) => {
  if (!params || !token) return params;

  if (params instanceof URLSearchParams) {
    const next = new URLSearchParams(params);
    Array.from(next.entries()).forEach(([key, value]) => {
      if (shouldRemoveAuthQueryParam(key, value, token)) {
        next.delete(key);
      }
    });
    return next;
  }

  if (typeof params !== 'object') return params;

  return Object.fromEntries(
    Object.entries(params).filter(([key, value]) => !shouldRemoveAuthQueryParam(key, value, token))
  );
};

const responseDataText = (data) => {
  if (!data) return '';
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
};

const getUrlPath = (url = '') => {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    return new URL(String(url || ''), base).pathname;
  } catch {
    return String(url || '').split('?')[0];
  }
};

export const isProtectedApiRequest = (url = '') => {
  const path = getUrlPath(url);
  return PROTECTED_API_PATH_RE.test(path) && !PUBLIC_AUTH_PATH_RE.test(path);
};

export const shouldRouteThroughManagerApi = (url = '') =>
  MANAGER_API_PATH_RE.test(getUrlPath(url));

const shouldSuppressResponseErrorLog = (error, config, status) => {
  if (shouldSuppressApiErrorLog(error)) return true;

  const expectedStatuses = Array.isArray(config?._expectedStatuses)
    ? config._expectedStatuses.map(Number)
    : [];

  return expectedStatuses.includes(Number(status));
};

export const isAuthRejectionError = (error) => {
  const status = error.response?.status;
  if (status === 401 || status === 419) return true;
  if (status !== 403) return false;
  return AUTH_REJECTION_RE.test(responseDataText(error.response?.data));
};

export const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  if (config.url && !config.url.startsWith('http')) {
    if (config.url.startsWith('/ext-api')) {
      config.url = buildExtApiUrl(config.url);
    } else if (shouldRouteThroughManagerApi(config.url)) {
      const resolvedUrl = config._nativeBrokerApi ? buildBrokerApiUrl(config.url) : buildManagerApiUrl(config.url);
      if (isElectronDesktop() && !isAbsoluteHttpUrl(resolvedUrl)) {
        expireMissingBrokerBackendSession();
        return Promise.reject(createSilentError(DESKTOP_BACKEND_MISSING_MESSAGE, {
          brokerBackendMissing: true,
        }));
      }
      config.url = resolvedUrl;
    } else if (config.url.startsWith('/')) {
      if (API_HOST && !shouldUseLocalDevProxy()) {
        config.url = `${API_HOST}${config.url}`;
      }
    }
  }

  const recoveredAuthState = ensureAuthStateFromStorage();

  if (validateAuthSession('auth_storage_invalid')) {
    return Promise.reject(new Error('Session expired. Please log in again.'));
  }

  const authState = useAuthStore.getState().accessToken
    ? useAuthStore.getState()
    : recoveredAuthState;
  let token = authState.accessToken;
  if (token && isTokenExpired(authState.tokenExpiresAt)) {
    // A passed local expiry renews the token before sending instead of
    // rejecting the request; refreshSession logs out only if it is refused.
    token = await refreshSession();
    if (!token) return Promise.reject(createRenewalError());
  }

  if (!token && isProtectedApiRequest(config.url)) {
    if (authState.isAuthenticated && !config._allowAuthFailure) {
      expireAuthSession('auth_storage_missing');
    }
    return Promise.reject(new Error(AUTH_TOKEN_MISSING_MESSAGE));
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    if (!config._preserveAuthQuery) {
      config.url = stripAuthQueryFromUrl(config.url, token);
      config.params = stripAuthQueryFromParams(config.params, token);
    }
  }

  if (import.meta.env?.DEV) {
    console.log(`%c[API Request] ${config.method?.toUpperCase()} ${redactUrlForLog(config.url)}`, 'color: #00bcd4; font-weight: bold;', {
      headers: redactForLog(config.headers),
      params: redactForLog(config.params),
      data: redactForLog(config.data)
    });
  }

  return config;
}, (error) => {
  console.error('[API Request Error]', redactForLog(error));
  return Promise.reject(error);
});

api.interceptors.response.use((response) => {
  useConnectionStore.getState().markOk();
  // Large account/position responses should go directly to the view in the
  // production app instead of copying their contents for debug logs.
  if (import.meta.env?.DEV) {
    console.log(`%c[API Response Success] ${response.config.method?.toUpperCase()} ${redactUrlForLog(response.config.url)}`, 'color: #2ebd59; font-weight: bold;', {
      status: response.status,
      data: redactForLog(response.data)
    });
  }
  return response;
}, async (error) => {
  const originalRequest = error.config;

  if (!shouldSuppressResponseErrorLog(error, originalRequest, error.response?.status)) {
    console.error(`%c[API Response Error] ${originalRequest?.method?.toUpperCase()} ${redactUrlForLog(originalRequest?.url)}`, 'color: #e53935; font-weight: bold;', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: redactForLog(error.response?.data),
      message: redactForLog(error.message)
    });
  }

  if (!shouldSuppressApiErrorLog(error) && (!error.response || error.response.status >= 500)) {
    useConnectionStore.getState().markError(
      error.response?.statusText || error.message || 'Network error'
    );
  }

  if (originalRequest?._allowAuthFailure && isAuthRejectionError(error)) {
    return Promise.reject(error);
  }

  // 401, or 403 "Not authenticated"/expired token (the manager backend's
  // answer for an expired access token): refresh once and retry. Other 403s
  // are permission denials and fall through untouched.
  if (isAuthRejectionError(error)) {
    if (!originalRequest || originalRequest._retry || originalRequest._noRetry) {
      expireAuthSession('token_rejected');
      return Promise.reject(error);
    }
    if (validateAuthSession('auth_storage_invalid')) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    const nextToken = await refreshSession({ rejectedToken: getBearerToken(originalRequest.headers) });
    if (!nextToken) {
      // refreshSession has already logged out if the refresh token was refused.
      return Promise.reject(error);
    }

    originalRequest.headers = originalRequest.headers || {};
    originalRequest.headers.Authorization = `Bearer ${nextToken}`;
    return api(originalRequest);
  }

  return Promise.reject(error);
});
