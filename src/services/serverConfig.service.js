import { api } from '../lib/api.js';
import { buildDemoAccountGroupSetBody } from '../utils/demoAccountGroup.js';
import { useAuthStore } from '../store/authStore.js';
import { canAccessView, normalizePermissions } from '../utils/permissions.js';
import { groupAccessKey } from '../utils/groupAccess.js';
import { createServerStatusCache } from './serverStatusCache.js';
import { buildExtApiUrl } from '../config/endpoints.js';

const EXT = '/ext-api';
const MANAGER = '/manager';
export const SERVER_CONFIG_READ_TIMEOUT_MS = 8000;

const getConfig = (path, config = {}) =>
  api.get(`${EXT}${path}`, { timeout: SERVER_CONFIG_READ_TIMEOUT_MS, ...config }).then(r => r.data);

export const getServerStatusScope = (state = useAuthStore.getState()) => {
  const user = state.user;
  if (!state.isAuthenticated || !state.accessToken || !user || !canAccessView(user, 'Server Config')) return '';
  let broker = '';
  try { broker = globalThis.localStorage?.getItem('brokerLogin') || ''; } catch { /* optional storage */ }
  return JSON.stringify([buildExtApiUrl('/ServerStatus'), broker, user.id, groupAccessKey(user), user.role, user.is_admin,
    [...(normalizePermissions(user.permissions) || [])].sort()]);
};
const statusCache = createServerStatusCache({ fetchStatus: config => getConfig('/ServerStatus', config) });
export const peekServerStatus = (scope = getServerStatusScope()) => statusCache.peek(scope);
export const subscribeServerStatus = statusCache.subscribe;
export const primeServerStatus = () => {
  const scope = getServerStatusScope();
  return scope ? statusCache.read(scope) : Promise.resolve(null);
};
useAuthStore.subscribe((state, previous) => {
  if (state.accessToken !== previous.accessToken || getServerStatusScope(state) !== getServerStatusScope(previous)) statusCache.clear();
});
if (!getServerStatusScope()) statusCache.clear();

export const ServerConfigService = {
  // --- Server Settings ---
  getServerSetting: (key) =>
    getConfig('/ServerSettingGet', { params: { key } }),

  listServerSettings: () =>
    getConfig('/ServerSettingList'),

  setServerSetting: (key, value) =>
    api.get(`${EXT}/ServerSettingSet`, { params: { key, value } }).then(r => r.data),

  // --- Server Status ---
  getServerStatus: (options) => statusCache.read(getServerStatusScope(), options),

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
