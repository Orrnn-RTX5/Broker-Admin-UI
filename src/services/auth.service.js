import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export const AuthService = {
  login: async (user, password, server) => {
    try {
      const response = await api.post(`/manager/api/v2/admin/login`, {
        user,
        password,
        server
      });
      
      // Handle the session token parsing depending on backend response format
      // It might be { session_token: ... }, { token: ... }, or just a raw string
      const access_token = response.data.session_token || response.data.token || response.data.access_token || (typeof response.data === 'string' ? response.data : null);
      const refresh_token = response.data.refresh_token || access_token; //Fallback to same token if no refresh token
      
      // Update store and parse user info directly from the Connect response
      if (access_token) {
        useAuthStore.getState().setToken(access_token, refresh_token);
        
        // Build user dynamically avoiding /me endpoint dependency
        const userInfo = {
           id: response.data.login || user,
           login: response.data.login || user,
           name: `Agent ${response.data.login || user}`,
           role: response.data.is_admin ? 'manager' : 'user',
           is_admin: !!response.data.is_admin,
           broker_id: response.data.broker_id || null,
        };
        useAuthStore.getState().setUser(userInfo);
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
