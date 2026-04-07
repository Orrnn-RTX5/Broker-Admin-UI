import { api } from '../lib/api';

export const InstrumentsService = {
  getInstruments: async (params) => {
    const res = await api.get('/api/v2/admin/instruments', { params });
    return res.data;
  },

  createInstrument: async (data) => {
    const res = await api.post('/api/v2/admin/instruments', data);
    return res.data;
  },

  updateInstrument: async (symbol, data) => {
    const res = await api.put(`/api/v2/admin/instruments/${symbol}`, data);
    return res.data;
  },

  toggleInstrument: async (symbol, enabled) => {
    const res = await api.post(`/api/v2/admin/instruments/${symbol}/toggle`, { enabled });
    return res.data;
  }
};
