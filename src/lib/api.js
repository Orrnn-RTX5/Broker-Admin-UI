import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useConnectionStore } from '../store/connectionStore';

// Note: In development with Vite, we use the proxy set in vite.config.js
// so we don't need the full URL if running on localhost. The /api/v2 path is retained.
const API_URL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach Token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response Interceptor: Handle 401 & Refresh Token + connection health signal
api.interceptors.response.use((response) => {
  useConnectionStore.getState().markOk();
  return response;
}, async (error) => {
  const originalRequest = error.config;

  // Only flag network / 5xx as connection issues; 4xx auth flows below
  // shouldn't surface as a red connection dot.
  if (!error.response || error.response.status >= 500) {
    useConnectionStore.getState().markError(
      error.response?.statusText || error.message || 'Network error'
    );
  }

  if (error.response?.status === 401 && !originalRequest._retry) {
    originalRequest._retry = true;
    
    try {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // We call standard fetch/axios directly to avoid a loop in interceptor
      const res = await axios.post(`${API_URL}/api/v2/auth/refresh`, {
        refresh_token: refreshToken
      });

      const { access_token } = res.data;
      
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
