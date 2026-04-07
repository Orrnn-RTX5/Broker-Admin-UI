import { api } from '../lib/api';

export const PositionsService = {
  getPositions: async (params) => {
    const res = await api.get('/api/v2/admin/positions', { params });
    return res.data;
  },

  getExposure: async (symbol) => {
    const res = await api.get('/api/v2/admin/exposure', { params: { symbol } });
    return res.data;
  },

  closeAll: async (filters) => {
    const res = await api.post('/api/v2/admin/close-all', filters);
    return res.data;
  },

  getTopAccounts: async (params) => {
    const res = await api.get('/api/v2/admin/top-accounts', { params });
    return res.data;
  },

  getDealSummary: async (params) => {
    const res = await api.get('/api/v2/admin/deals/summary', { params });
    return res.data;
  }
};
