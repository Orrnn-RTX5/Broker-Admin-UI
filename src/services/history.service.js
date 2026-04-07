import { api } from '../lib/api';

export const HistoryService = {
  generateHistory: async (symbol, from, to) => {
    const res = await api.post(`/api/v2/admin/generate-history/${symbol}`, { from, to });
    return res.data;
  },

  generateAllHistory: async (from, to) => {
    const res = await api.post('/api/v2/admin/generate-history-all', { from, to });
    return res.data;
  }
};
