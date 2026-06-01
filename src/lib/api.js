import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useConnectionStore } from '../store/connectionStore';


import { API_HOST, buildExtApiUrl, buildManagerApiUrl } from '../config/endpoints';

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

  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  console.log(`%c[API Request] ${config.method?.toUpperCase()} ${config.url}`, 'color: #00bcd4; font-weight: bold;', {
    headers: config.headers,
    data: config.data
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

      const access_token = res.data.token || res.data.access_token;
      
      // Update store
      useAuthStore.getState().setToken(access_token, refreshToken);
      
      // Retry original request
      originalRequest.headers.Authorization = `Bearer ${access_token}`;
      return api(originalRequest);
    } catch (refreshError) {
      console.error('Session expired. Please log in again.');
      useAuthStore.getState().logout();
      return Promise.reject(refreshError);
    }
  }

  return Promise.reject(error);
});
