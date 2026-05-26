import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useConnectionStore } from '../store/connectionStore';


const API_URL = import.meta.env.VITE_API_HOST || '';
const EXT_API_URL = import.meta.env.VITE_API_HOST_EXT || '';

export const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (config.url && !config.url.startsWith('http')) {
    if (config.url.startsWith('/ext-api')) {
      if (EXT_API_URL) {
        config.url = `${EXT_API_URL}${config.url.replace(/^\/ext-api/, '')}`;
      }
    } else if (config.url.startsWith('/')) {
      if (API_URL) {
        config.url = `${API_URL}${config.url}`;
      }
    }
  }

  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use((response) => {
  useConnectionStore.getState().markOk();
  return response;
}, async (error) => {
  const originalRequest = error.config;


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


      const res = await axios.post(`${API_URL}/manager/api/v1/auth/refresh`, {
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
