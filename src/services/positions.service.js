import { api } from '../lib/api';
import { buildCloseAllRequest } from '../utils/serviceContracts';

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
    const request = buildCloseAllRequest(filters);
    const res = await api.post(request.url, request.data);
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
