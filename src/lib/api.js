import axios from 'axios';
import { expireAuthSession, isTokenExpired, useAuthStore } from '../store/authStore';
import { useConnectionStore } from '../store/connectionStore';


import { API_HOST, buildExtApiUrl, buildManagerApiUrl } from '../config/endpoints';

const SECRET_KEY_RE = /(authorization|password|token|secret|api[_-]?key)/i;

const redactForLog = (value, seen = new WeakSet()) => {
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactForLog(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      SECRET_KEY_RE.test(key) ? '[REDACTED]' : redactForLog(entry, seen),
    ])
  );
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
    } else if (config.url.startsWith('/manager')) {
      config.url = buildManagerApiUrl(config.url);
    } else if (config.url.startsWith('/')) {
      if (API_HOST) {
        config.url = `${API_HOST}${config.url}`;
      }
    }
  }

  const authState = useAuthStore.getState();
  const token = authState.accessToken;
  if (token && isTokenExpired(authState.tokenExpiresAt)) {
    expireAuthSession('token_expired');
    return Promise.reject(new Error('Session expired. Please log in again.'));
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  console.log(`%c[API Request] ${config.method?.toUpperCase()} ${config.url}`, 'color: #00bcd4; font-weight: bold;', {
    headers: redactForLog(config.headers),
    data: redactForLog(config.data)
  });

  return config;
}, (error) => {
  console.error('[API Request Error]', error);
  return Promise.reject(error);
});

api.interceptors.response.use((response) => {
  useConnectionStore.getState().markOk();
  console.log(`%c[API Response Success] ${response.config.method?.toUpperCase()} ${response.config.url}`, 'color: #4caf50; font-weight: bold;', {
    status: response.status,
    data: response.data
  });
  return response;
}, async (error) => {
  const originalRequest = error.config;

  console.error(`%c[API Response Error] ${originalRequest?.method?.toUpperCase()} ${originalRequest?.url}`, 'color: #f44336; font-weight: bold;', {
    status: error.response?.status,
    statusText: error.response?.statusText,
    data: error.response?.data,
    message: error.message
  });

  if (!error.response || error.response.status >= 500) {
    useConnectionStore.getState().markError(
      error.response?.statusText || error.message || 'Network error'
    );
  }

  if (error.response?.status === 401 && !originalRequest._retry && !originalRequest._noRetry) {
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
      
      // Update store
      useAuthStore.getState().setToken(
        access_token,
        nextRefreshToken,
        res.data.expires_at || res.data.expiresAt || res.data.token_expires_at,
        res.data.expires_in || res.data.expiresIn
      );
      
      // Retry original request
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
