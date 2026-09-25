import { api } from '../lib/api';
import { buildDemoAccountGroupSetBody } from '../utils/demoAccountGroup';

const EXT = '/ext-api';
const MANAGER = '/manager';
export const SERVER_CONFIG_READ_TIMEOUT_MS = 8000;

const getConfig = (path, config = {}) =>
  api.get(`${EXT}${path}`, { timeout: SERVER_CONFIG_READ_TIMEOUT_MS, ...config }).then(r => r.data);

export const ServerConfigService = {
  // --- Server Settings ---
  getServerSetting: (key) =>
    getConfig('/ServerSettingGet', { params: { key } }),

  listServerSettings: () =>
    getConfig('/ServerSettingList'),

  setServerSetting: (key, value) =>
    api.get(`${EXT}/ServerSettingSet`, { params: { key, value } }).then(r => r.data),

  // --- Server Status ---
  getServerStatus: () =>
    getConfig('/ServerStatus'),

  // --- Swap Rates ---
  getSwapRate: (symbol) =>
    getConfig('/SwapRateGet', { params: { symbol } }),

  listSwapRates: () =>
    getConfig('/SwapRateList'),

  setSwapRate: (symbol, long, short) =>
    api.get(`${EXT}/SwapRateSet`, { params: { symbol, ...(long != null ? { long } : {}), ...(short != null ? { short } : {}) } }).then(r => r.data),

  // --- Trading Halt ---
  setTradingHalt: (symbol, enabled, reason) =>
    api.get(`${EXT}/TradingHalt`, { params: { symbol, enabled, ...(reason ? { reason } : {}) } }).then(r => r.data),

  // --- Demo Accounts (global demo account group for web-terminal demo signup) ---
  getDemoAccountGroup: () =>
    api.get(`${MANAGER}/DemoAccountGroupGet`, { timeout: SERVER_CONFIG_READ_TIMEOUT_MS }).then(r => r.data),

  // setDemoAccountGroup({ group?, signupEnabled? }) sends only the provided keys.
  // group === '' clears the setting (back to the automatic default).
  setDemoAccountGroup: (changes) =>
    api.post(`${MANAGER}/DemoAccountGroupSet`, buildDemoAccountGroupSetBody(changes)).then(r => r.data),
};
