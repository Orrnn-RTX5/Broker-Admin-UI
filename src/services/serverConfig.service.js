import { api } from '../lib/api';

const EXT = '/ext-api';

export const ServerConfigService = {
  // --- Server Settings ---
  getServerSetting: (key) =>
    api.get(`${EXT}/ServerSettingGet`, { params: { key } }).then(r => r.data),

  listServerSettings: () =>
    api.get(`${EXT}/ServerSettingList`).then(r => r.data),

  setServerSetting: (key, value) =>
    api.get(`${EXT}/ServerSettingSet`, { params: { key, value } }).then(r => r.data),

  // --- Server Status ---
  getServerStatus: () =>
    api.get(`${EXT}/ServerStatus`).then(r => r.data),

  // --- Swap Rates ---
  getSwapRate: (symbol) =>
    api.get(`${EXT}/SwapRateGet`, { params: { symbol } }).then(r => r.data),

  listSwapRates: () =>
    api.get(`${EXT}/SwapRateList`).then(r => r.data),

  setSwapRate: (symbol, long, short) =>
    api.get(`${EXT}/SwapRateSet`, { params: { symbol, ...(long != null ? { long } : {}), ...(short != null ? { short } : {}) } }).then(r => r.data),

  // --- Trading Halt ---
  setTradingHalt: (symbol, enabled, reason) =>
    api.get(`${EXT}/TradingHalt`, { params: { symbol, enabled, ...(reason ? { reason } : {}) } }).then(r => r.data),
};
