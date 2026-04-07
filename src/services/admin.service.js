import { api } from '../lib/api';

export const AdminService = {
  getStats: async () => {
    const res = await api.get('/api/v2/admin/stats');
    return res.data;
  },
  
  getUsers: async (params) => {
    const res = await api.get('/api/v2/admin/users', { params });
    return res.data;
  },

  getUserById: async (id) => {
    const res = await api.get(`/api/v2/admin/users/${id}`);
    return res.data;
  },

  updateUser: async (id, data) => {
    const res = await api.put(`/api/v2/admin/users/${id}`, data);
    return res.data;
  },

  deleteUser: async (id) => {
    const res = await api.delete(`/api/v2/admin/users/${id}`);
    return res.data;
  },

  resetPassword: async (id, newPassword) => {
    const res = await api.post(`/api/v2/admin/users/${id}/reset-password`, { new_password: newPassword });
    return res.data;
  },

  regenerateKey: async (id) => {
    const res = await api.post(`/api/v2/admin/users/${id}/regenerate-key`);
    return res.data;
  }
};
