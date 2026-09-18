import axios from 'axios';
import {
  ensureAuthStateFromStorage,
  expireAuthSession,
  isTokenExpired,
  useAuthStore,
  validateAuthSession,
} from '../store/authStore.js';
import { useConnectionStore } from '../store/connectionStore.js';
import { redactForLog, redactUrlForLog } from './logRedaction.js';


import { API_HOST, buildExtApiUrl, buildManagerApiUrl, shouldUseLocalDevProxy } from '../config/endpoints.js';

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

api.interceptors.request.use((config) => {
  if (config.url && !config.url.startsWith('http')) {
    if (config.url.startsWith('/ext-api')) {
      config.url = buildExtApiUrl(config.url);
    } else if (shouldRouteThroughManagerApi(config.url)) {
      const resolvedUrl = buildManagerApiUrl(config.url);
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
  const token = authState.accessToken;
  if (token && isTokenExpired(authState.tokenExpiresAt)) {
    expireAuthSession('token_expired');
    return Promise.reject(new Error('Session expired. Please log in again.'));
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

  console.log(`%c[API Request] ${config.method?.toUpperCase()} ${redactUrlForLog(config.url)}`, 'color: #00bcd4; font-weight: bold;', {
    headers: redactForLog(config.headers),
    params: redactForLog(config.params),
    data: redactForLog(config.data)
  });

  return config;
}, (error) => {
  console.error('[API Request Error]', redactForLog(error));
  return Promise.reject(error);
});

api.interceptors.response.use((response) => {
  useConnectionStore.getState().markOk();
  console.log(`%c[API Response Success] ${response.config.method?.toUpperCase()} ${redactUrlForLog(response.config.url)}`, 'color: #4caf50; font-weight: bold;', {
    status: response.status,
    data: redactForLog(response.data)
  });
  return response;
}, async (error) => {
  const originalRequest = error.config;

  if (!shouldSuppressResponseErrorLog(error, originalRequest, error.response?.status)) {
    console.error(`%c[API Response Error] ${originalRequest?.method?.toUpperCase()} ${redactUrlForLog(originalRequest?.url)}`, 'color: #f44336; font-weight: bold;', {
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

  if (isAuthRejectionError(error) && error.response?.status !== 401) {
    expireAuthSession('token_rejected');
    return Promise.reject(error);
  }

  if (error.response?.status === 401 && !originalRequest) {
    expireAuthSession('token_rejected');
    return Promise.reject(error);
  }

  if (error.response?.status === 401 && (originalRequest._retry || originalRequest._noRetry)) {
    expireAuthSession('token_rejected');
    return Promise.reject(error);
  }

  if (error.response?.status === 401 && !originalRequest._retry && !originalRequest._noRetry) {
    if (validateAuthSession('auth_storage_invalid')) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    
    try {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }


      const res = await axios.post(buildManagerApiUrl('/api/v1/auth/refresh'), {
        refresh_token: refreshToken
      });

      const access_token = res.data.token || res.data.access_token || res.data.session_token;
      const nextRefreshToken = res.data.refresh_token || refreshToken;
      if (!access_token) {
        throw new Error('Refresh response did not include access token');
      }
      
      // Update store
      useAuthStore.getState().setToken(
        access_token,
        nextRefreshToken,
        res.data.expires_at || res.data.expiresAt || res.data.token_expires_at,
        res.data.expires_in || res.data.expiresIn
      );
      
      // Retry original request
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${access_token}`;
      return api(originalRequest);
    } catch (refreshError) {
      console.error('Session expired. Please log in again.');
      expireAuthSession('refresh_failed');
      return Promise.reject(refreshError);
    }
  }

  return Promise.reject(error);
});
