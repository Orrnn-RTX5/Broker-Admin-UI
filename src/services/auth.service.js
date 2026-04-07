import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export const AuthService = {
  login: async (user, password, server) => {
    try {
      const response = await api.get(`/manager/Connect`, {
        params: { user, password, server },
        headers: { 'accept': 'text/plain' }
      });
      
      // Handle the session token parsing depending on backend response format
      // It might be { session_token: ... }, { token: ... }, or just a raw string
      const access_token = response.data.session_token || response.data.token || response.data.access_token || (typeof response.data === 'string' ? response.data : null);
      const refresh_token = response.data.refresh_token || access_token; // Fallback to same token if no refresh token
      
      // Update store
      if (access_token) {
        useAuthStore.getState().setToken(access_token, refresh_token);
      }
      
      // Fetch user info gracefully — won't crash if /me isn't implemented
      try {
        await AuthService.getMe();
      } catch (e) {
        console.warn('Could not fetch /me data, but login succeeded.', e);
      }
      
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Login failed' };
    }
  },

  getMe: async () => {
    try {
      const response = await api.get('/api/v2/auth/me');
      useAuthStore.getState().setUser(response.data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: 'Failed to fetch user data' };
    }
  },

  logout: () => {
    useAuthStore.getState().logout();
  }
};
