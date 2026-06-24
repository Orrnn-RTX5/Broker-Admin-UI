import { api } from '../lib/api.js';

const normalizeRecords = (data) => {
  if (Array.isArray(data)) return data;
  return data?.accounts || data?.answer || data?.data || data?.items || [];
};

const firstValue = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== '') ?? '';

const mapTradingAccount = (account = {}, index = 0) => ({
  id: firstValue(account.login, account.Login, account.account_login, account.accountLogin, index),
  login: firstValue(account.login, account.Login, account.account_login, account.accountLogin),
  name: firstValue(account.name, account.Name, account.accountName, account.AccountName),
  group: firstValue(account.group, account.Group, account.accountGroup, account.AccountGroup),
  balance: firstValue(account.balance, account.Balance, 0),
  equity: firstValue(account.equity, account.Equity, 0),
  currency: firstValue(account.currency, account.Currency),
  status: firstValue(account.status, account.Status, account.enabled === false ? 'disabled' : 'active'),
});

export const AccountsService = {
  getAccount: async (login) => {
    const res = await api.get(`/api/v2/account/${login}`);
    return res.data;
  },

  getAccounts: async () => {
    const res = await api.get('/manager/AccountDetailsMany', { _allowAuthFailure: true });
    return normalizeRecords(res.data).map(mapTradingAccount);
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
