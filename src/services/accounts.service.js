import { api } from '../lib/api';

export const AccountsService = {
  getAccount: async (login) => {
    const res = await api.get(`/api/v2/account/${login}`);
    return res.data;
  },

  getAccounts: async (params) => {
    const res = await api.get('/api/v2/accounts', { params });
    return res.data;
  },

  deposit: async (login, amount, comment) => {
    const res = await api.post(`/api/v2/accounts/${login}/deposit`, { amount, comment });
    return res.data;
  },

  withdraw: async (login, amount, comment) => {
    const res = await api.post(`/api/v2/accounts/${login}/withdraw`, { amount, comment });
    return res.data;
  },

  credit: async (login, amount, comment, expiration) => {
    const res = await api.post(`/api/v2/accounts/${login}/credit`, { amount, comment, expiration });
    return res.data;
  },

  suspend: async (login, reason) => {
    const res = await api.post(`/api/v2/accounts/${login}/suspend`, { reason });
    return res.data;
  },

  activate: async (login, reason) => {
    const res = await api.post(`/api/v2/accounts/${login}/activate`, { reason });
    return res.data;
  },

  setReadonly: async (login, readonly, reason) => {
    const res = await api.post(`/api/v2/accounts/${login}/readonly`, { readonly, reason });
    return res.data;
  }
};
