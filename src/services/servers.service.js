import { api } from '../lib/api';

export const ServersService = {
  getServers: async () => {
    const res = await api.get('/api/v2/admin/broker-servers');
    return res.data;
  },

  addServer: async (data) => {
    const res = await api.post('/api/v2/admin/broker-servers', data);
    return res.data;
  },

  removeServer: async (id) => {
    const res = await api.delete(`/api/v2/admin/broker-servers/${id}`);
    return res.data;
  }
};
