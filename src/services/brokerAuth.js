import { buildManagerApiUrl, updateDynamicEndpoints } from '../config/endpoints.js';
import { getRuntimeValue } from '../config/runtimeConfig.js';
import { isDesktopBackendTarget, resolveBrokerBackendUrl, resolveBrokerExtApiUrl } from '../config/backendTarget.js';
import { redactForLog, redactUrlForLog } from '../lib/logRedaction.js';
import { normalizeTokenExpiresAt } from '../store/authStore.js';

const viteEnv = import.meta.env || {};
const BROKER_INFO_KEY = 'broker_info';
const AUTH_KEY = 'auth';
const RECENT_BROKERS_KEY = 'recent_brokers';
const ADMIN_LOGIN_PORT = 8091;
const DEFAULT_DISCOVERY_BASE_URL = 'https://backend.orrnn.com';
export const BROKER_DISCOVERY_PATH = '/api/v2/broker/servers';
const GTA_LOGIN_SERVER_HANDLE = 'broker-server-2';
const GTA_BROKER_ALIASES = new Set(['gta_broker', 'grow-trading-academy']);
const GTA_LOGIN_SERVER_MARKERS = [
  '103.91.186.142',
  'services.growtradingacademy.com',
  'grow trading academy',
];

export const RUNTIME_API_HOST =
  (getRuntimeValue('API_HOST', 'VITE_API_HOST') ||
  viteEnv.VITE_API_HOST ||
  '').replace(/\/+$/, '');

const normalizeDiscoveryBaseUrl = (value = '') => {
  const trimmed = String(value || '').replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_DISCOVERY_BASE_URL;
  if (/testbrokerbackend\.orrnn\.com|brokerbackend|:8091(?:\/|$)/i.test(trimmed)) {
    return DEFAULT_DISCOVERY_BASE_URL;
  }
  return trimmed;
};

export const DISCOVERY_BASE_URL = normalizeDiscoveryBaseUrl(
  getRuntimeValue('DISCOVERY_BASE_URL', 'VITE_DISCOVERY_BASE_URL') ||
  viteEnv.VITE_DISCOVERY_BASE_URL ||
  RUNTIME_API_HOST
);

// Set VITE_USE_MOCK_DISCOVERY=true in .env only when local mock data is needed.
const USE_MOCK_DISCOVERY =
  String(
    getRuntimeValue('USE_MOCK_DISCOVERY', 'VITE_USE_MOCK_DISCOVERY') ??
      viteEnv.VITE_USE_MOCK_DISCOVERY ??
      ''
  ) === 'true';

export const RUNTIME_BROKER_ID =
  (getRuntimeValue('BROKER_ID', 'VITE_BROKER_ID') ||
  viteEnv.VITE_BROKER_ID ||
  '').trim().toLowerCase();

export const RUNTIME_DEFAULT_MT5_SERVER =
  getRuntimeValue('DEFAULT_MT5_SERVER', 'VITE_DEFAULT_MT5_SERVER') ||
  viteEnv.VITE_DEFAULT_MT5_SERVER ||
  '';

// ---------------------------------------------------------------------------
// Mock broker list — mirrors what the real /api/v2/broker/servers returns.
// Each entry must have broker_id, name, status, backend_url, and opaque server.
// ---------------------------------------------------------------------------
const MOCK_BROKER_LIST = [
  {
    broker_id: 'testorrnn',
    name: 'Test Orrnn Broker (Demo)',
    status: 'active',
    server: 'testorrnn',
    backend_url: 'https://testbrokerbackend.orrnn.com',
    server_ip: 'testbrokerbackend.orrnn.com',
    server_port: 8091,
  },
  {
    broker_id: 'orrnn',
    name: 'Orrnn Broker',
    status: 'active',
    server: 'orrnn',
    backend_url: 'https://testbrokerbackend.orrnn.com',
    server_ip: 'testbrokerbackend.orrnn.com',
    server_port: 8091,
  },
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
const trimTrailingSlash = (value = '') => String(value || '').replace(/\/+$/, '');
const LICENSE_SECRET_KEY_RE = /^(license[_-]?(key|secret)|licence[_-]?(key|secret))$/i;

const stripLicenseSecrets = (value, seen = new WeakSet()) => {
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return value;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => stripLicenseSecrets(entry, seen));
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !LICENSE_SECRET_KEY_RE.test(key))
      .map(([key, entry]) => [key, stripLicenseSecrets(entry, seen)])
  );
};

const getOrigin = (url = '') => {
  const trimmed = trimTrailingSlash(url);
  if (!trimmed) return '';

  try {
    const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(url).origin;
  } catch {
    return '';
  }
};

const registerElectronBrokerOrigins = (brokerInfo = {}) => {
  if (typeof window === 'undefined') return;

  const bridge = window.rtx5Electron;
  if (!bridge?.registerBrokerOrigins) return;

  const backendUrl = resolveBrokerBackendUrl(brokerInfo, brokerInfo?.backend_url);
  const extUrl = resolveBrokerExtApiUrl(brokerInfo, backendUrl);
  const origins = [
    backendUrl,
    extUrl,
    brokerInfo.backend_url,
    brokerInfo.api_url,
    brokerInfo.server_url,
    brokerInfo.web_backend_url,
    brokerInfo.public_backend_url,
  ].map(getOrigin).filter(Boolean);

  if (origins.length > 0) bridge.registerBrokerOrigins([...new Set(origins)]);
};

const clearElectronBrokerOrigins = () => {
  if (typeof window === 'undefined') return;
  window.rtx5Electron?.clearBrokerOrigins?.();
};

const upgradeHttpForHttpsPage = (url = '') => {
  const trimmed = trimTrailingSlash(url);
  const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';

  if (!isDesktopBackendTarget() && isHttpsPage && /^http:\/\//i.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, 'https://');
  }

  return trimmed;
};

const buildBackendUrl = (info) => {
  const targetUrl = resolveBrokerBackendUrl(info);
  if (targetUrl) return upgradeHttpForHttpsPage(targetUrl);

  const explicitUrl = info.backend_url || info.api_url || info.server_url;
  if (explicitUrl) {
    // If it has protocol, keep it, but if it is http and the page is HTTPS, upgrade it to https!
    return upgradeHttpForHttpsPage(explicitUrl);
  }

  const host = info.server_ip || info.host;
  if (!host) return '';

  if (/^https?:\/\//i.test(host)) {
    return upgradeHttpForHttpsPage(host);
  }

  const port = Number(info.server_port);
  const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
  // Default to HTTPS if page is HTTPS, or if port is not 8091
  const protocol = info.protocol || (isHttpsPage ? 'https' : (port === 8091 ? 'http' : 'https'));
  const portSuffix = port && ![80, 443].includes(port) ? `:${port}` : '';

  return `${protocol}://${host}${portSuffix}`;
};

const firstPresent = (...values) =>
  values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');

export const getBrokerRecordId = (info = {}) =>
  String(firstPresent(info.broker_id, info.brokerId, info.id, info.server, info.server_id, '') || '').trim();

const normalizeLoginServerValue = (value = '') =>
  String(value || '').trim().toLowerCase();

const isOpaqueBrokerServerHandle = (value = '') =>
  /^broker-server-\d+$/i.test(String(value || '').trim());

const isGtaBrokerInfo = (info = {}) => {
  const idValues = [info.broker_id, info.brokerId, info.id]
    .map(normalizeLoginServerValue)
    .filter(Boolean);

  if (idValues.some((value) => GTA_BROKER_ALIASES.has(value))) return true;

  return [
    info.name,
    info.broker_name,
    info.brokerName,
    info.server,
    info.server_handle,
    info.server_id,
    info.login_server,
    info.server_ip,
    info.host,
    info.backend_url,
    info.api_url,
    info.server_url,
    info.public_backend_url,
    info.public_api_url,
  ]
    .map(normalizeLoginServerValue)
    .some((value) => GTA_LOGIN_SERVER_MARKERS.some((marker) => value.includes(marker)));
};

export const getBrokerLoginServer = (info = {}) => {
  const server = String(
    firstPresent(
      info.server,
      info.server_handle,
      info.server_id,
      info.login_server,
      info.broker_id,
      info.brokerId,
      info.id,
      info.server_ip,
      info.host,
      ''
    ) || ''
  ).trim();

  if (isGtaBrokerInfo(info) && !isOpaqueBrokerServerHandle(server)) {
    return GTA_LOGIN_SERVER_HANDLE;
  }

  return server;
};

const resolveBrokerLoginServer = (brokerInfo = {}, server = '') =>
  getBrokerLoginServer(server ? { ...brokerInfo, server } : brokerInfo);

const normalizeBrokerInfo = (info) => {
  const safeInfo = stripLicenseSecrets(info || {});
  const brokerId = getBrokerRecordId(safeInfo);
  const server = getBrokerLoginServer({ ...safeInfo, broker_id: brokerId });
  const backend_url = buildBackendUrl(safeInfo);

  return {
    ...safeInfo,
    broker_id: brokerId,
    server,
    name: safeInfo.name || safeInfo.broker_name || safeInfo.brokerName || brokerId,
    status: safeInfo.status || 'active',
    backend_url,
    server_ip: safeInfo.server_ip || safeInfo.host || '',
  };
};

const getServerFromBackend = (backendUrl) => {
  try {
    return new URL(backendUrl).host;
  } catch {
    return backendUrl || '';
  }
};

const readJson = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const getResponseMessage = (data) =>
  data?.error?.message ||
  data?.error ||
  data?.message ||
  data?.detail ||
  data?.title ||
  '';

export const withAdminPort = (backendUrl = '') => {
  const trimmed = trimTrailingSlash(backendUrl);
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);

    // If protocol is HTTPS and port is 443 or empty, keep it on HTTPS / 443 (no rewrite to 8091)
    if (url.protocol === 'https:' && (!url.port || url.port === '443')) {
      return trimmed;
    }

    if (!url.port || url.port === '443') {
      url.port = String(ADMIN_LOGIN_PORT);
    }
    // Port 8091 is plain HTTP — no TLS. Force protocol to http.
    if (url.port === String(ADMIN_LOGIN_PORT)) {
      url.protocol = 'http:';
    }
    return trimTrailingSlash(url.toString());
  } catch {
    if (/^https:/i.test(trimmed)) {
      return trimmed;
    }
    return trimmed
      .replace(/:443(?=\/|$)/, `:${ADMIN_LOGIN_PORT}`)
      .replace(/^https(?=:\/\/)/, 'http');
  }
};

// ---------------------------------------------------------------------------
// fetchBrokerList — returns array of broker objects (name + id visible, ip hidden)
// Calls:  GET {DISCOVERY_BASE_URL}/api/v2/broker/servers
// ---------------------------------------------------------------------------
export const fetchBrokerList = async () => {
  if (USE_MOCK_DISCOVERY) {
    // Local fallback only; set VITE_USE_MOCK_DISCOVERY=true to use it.
    const list = MOCK_BROKER_LIST.filter((b) => b.status === 'active').map(normalizeBrokerInfo);
    console.log('%c[Auth Mock Discovery] fetchBrokerList', 'color: #ff9800; font-weight: bold;', redactForLog(list));
    return list;
  }

  const url = `${DISCOVERY_BASE_URL.replace(/\/+$/, '')}${BROKER_DISCOVERY_PATH}`;
  console.log(`%c[Auth Request] GET ${redactUrlForLog(url)}`, 'color: #00bcd4; font-weight: bold;');

  let response;
  try {
    response = await fetch(
      url,
      {
        method: 'GET',
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      }
    );
  } catch (err) {
    console.error(`%c[Auth Connection Failed] GET ${redactUrlForLog(url)}`, 'color: #f44336; font-weight: bold;', redactForLog(err));
    throw new Error('Cannot reach platform. Try again.');
  }

  const data = await readJson(response);
  if (!response.ok) {
    console.error(`%c[Auth Response Error] GET ${redactUrlForLog(url)}`, 'color: #f44336; font-weight: bold;', {
      status: response.status,
      data: redactForLog(data)
    });
    throw new Error(getResponseMessage(data) || 'Failed to load broker list.');
  }

  console.log(`%c[Auth Response Success] GET ${redactUrlForLog(url)}`, 'color: #4caf50; font-weight: bold;', {
    status: response.status,
    data: redactForLog(data)
  });

  // API may return an array directly or wrapped: { servers: [...] } / { brokers: [...] } / { data: [...] }
  const list = Array.isArray(data) ? data : (data?.servers ?? data?.brokers ?? data?.data ?? []);
  return list
    .filter((b) => !b.status || b.status === 'active')
    .map(normalizeBrokerInfo)
    .filter((broker) => broker.broker_id && broker.server);
};


export const discoverBrokerById = (brokerList, brokerId) => {
  const selected = String(brokerId || '').trim();
  const found = brokerList.find((b) => b.broker_id === selected || b.server === selected);
  if (!found) throw new Error('Broker not found');
  if (found.status && found.status !== 'active') {
    throw new Error(`Broker is ${found.status}. Contact support.`);
  }
  return found;
};


export const normalizeBrokerId = (value) => String(value || '').trim().toLowerCase();

const postJson = async (url, body) => {
  console.log(`%c[Auth Request] POST ${redactUrlForLog(url)}`, 'color: #00bcd4; font-weight: bold;', { body: redactForLog(body) });
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`%c[Auth Connection Failed] POST ${redactUrlForLog(url)}`, 'color: #f44336; font-weight: bold;', redactForLog(err));
    throw new Error('Connection failed');
  }

  const data = await readJson(response);
  if (!response.ok) {
    console.error(`%c[Auth Response Error] POST ${redactUrlForLog(url)}`, 'color: #f44336; font-weight: bold;', {
      status: response.status,
      data: redactForLog(data)
    });
    throw new Error(getResponseMessage(data) || `HTTP ${response.status}`);
  }

  console.log(`%c[Auth Response Success] POST ${redactUrlForLog(url)}`, 'color: #4caf50; font-weight: bold;', {
    status: response.status,
    data: redactForLog(data)
  });
  return data || {};
};

export const loginManager = async (brokerInfo, { user, password, server }) => {
  try {
    const normalizedBrokerInfo = normalizeBrokerInfo(brokerInfo);
    const backendUrl = resolveBrokerBackendUrl(normalizedBrokerInfo, normalizedBrokerInfo?.backend_url);
    if (!backendUrl) throw new Error('Broker backend URL is not configured.');
    setBrokerInfo(normalizedBrokerInfo);
    const loginServer = resolveBrokerLoginServer(normalizedBrokerInfo, server);
    return await postJson(
      buildManagerApiUrl('/api/v2/auth/login'),
      { user, password, server: loginServer }
    );
  } catch (error) {
    throw new Error(mapManagerLoginError(error.message));
  }
};

export const loginAdmin = async (brokerInfo, { user, password, server }) => {
  try {
    const normalizedBrokerInfo = normalizeBrokerInfo(brokerInfo);
    const backendUrl = resolveBrokerBackendUrl(normalizedBrokerInfo, normalizedBrokerInfo?.backend_url);
    if (!backendUrl) throw new Error('Broker backend URL is not configured.');
    setBrokerInfo(normalizedBrokerInfo);
    const loginServer = resolveBrokerLoginServer(normalizedBrokerInfo, server);
    return await postJson(
      buildManagerApiUrl('/api/v2/admin/login'),
      { user, password, server: loginServer }
    );
  } catch (error) {
    throw new Error(mapAdminLoginError(error.message));
  }
};

const mapManagerLoginError = (message = '') => {
  if (message.includes('Account is disabled')) {
    return 'Your account is disabled. Contact your broker admin.';
  }
  if (message.includes('Invalid login or password')) {
    return 'Wrong login or password.';
  }
  if (message.includes('Account temporarily locked')) return message;
  if (message.includes('Broker license')) return message;
  if (message.includes('Server not authorized')) {
    return 'Server mismatch - please switch broker.';
  }
  return message || 'Login failed.';
};

const mapAdminLoginError = (message = '') => {
  if (message.includes('Invalid credentials')) {
    return 'Wrong login or password, or account is not an admin.';
  }
  return message || 'Login failed.';
};

export const getBrokerInfo = () => {
  try {
    const raw = sessionStorage.getItem(BROKER_INFO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setBrokerInfo = (brokerInfo) => {
  const normalized = normalizeBrokerInfo(brokerInfo);
  sessionStorage.setItem(BROKER_INFO_KEY, JSON.stringify(normalized));
  registerElectronBrokerOrigins(normalized);
  updateDynamicEndpoints();
};

export const clearBrokerInfo = () => {
  sessionStorage.removeItem(BROKER_INFO_KEY);
  clearElectronBrokerOrigins();
  updateDynamicEndpoints();
};

export const getRecentBrokers = () => {
  try {
    const raw = localStorage.getItem(RECENT_BROKERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
};

export const rememberBroker = (brokerId) => {
  const normalized = normalizeBrokerId(brokerId);
  const next = [normalized, ...getRecentBrokers().filter((id) => id !== normalized)].slice(0, 5);
  localStorage.setItem(RECENT_BROKERS_KEY, JSON.stringify(next));
  return next;
};

export const setAuthSession = (authData, brokerInfo) => {
  const accessToken = authData?.token || authData?.access_token || authData?.session_token;
  const refreshToken = authData?.refresh_token || accessToken;
  const tokenExpiresAt = normalizeTokenExpiresAt(
    authData?.expires_at || authData?.expiresAt || authData?.token_expires_at,
    authData?.expires_in || authData?.expiresIn
  );
  const auth = {
    ...stripLicenseSecrets(authData || {}),
    token: accessToken,
    refresh_token: refreshToken,
    tokenExpiresAt,
    broker_id: authData?.broker_id || brokerInfo?.broker_id,
  };

  sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth));

  if (accessToken) localStorage.setItem('authToken', accessToken);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
  if (tokenExpiresAt) {
    localStorage.setItem('tokenExpiresAt', String(tokenExpiresAt));
    localStorage.setItem('token_expires_at', String(tokenExpiresAt));
  }
  if (auth.login) localStorage.setItem('brokerLogin', String(auth.login));
  if (auth.broker_id) localStorage.setItem('brokerId', auth.broker_id);

  return auth;
};

// ---------------------------------------------------------------------------
// validateBrokerCredentials — Validate broker license and credentials
// Used when registering a new broker with manual credentials entry
// ---------------------------------------------------------------------------
export const validateBrokerCredentials = async ({ broker_id, license_key, server }) => {
  try {
    const backendUrl = normalizeBackendUrl(server);

    // Extract port from backend URL for proper reconstruction
    let serverPort = 8091;
    try {
      const url = new URL(backendUrl);
      serverPort = url.port ? parseInt(url.port) : 8091;
    } catch {
      serverPort = 8091;
    }

    // Construct broker info for validation
    const brokerInfo = {
      broker_id: normalizeBrokerId(broker_id),
      name: broker_id,
      status: 'active',
      backend_url: backendUrl,
      server_ip: getServerFromBackend(backendUrl),
      server_port: serverPort,  // IMPORTANT: Set port so buildBackendUrl uses it
      license_key_set: Boolean(license_key),
    };

    // Validate that we can reach the broker backend
    console.log(
      `%c[Auth Validate] Checking broker connectivity to ${backendUrl}`,
      'color: #00bcd4; font-weight: bold;'
    );

    return normalizeBrokerInfo(brokerInfo);
  } catch (error) {
    console.error('Broker validation failed:', error);
    throw new Error('Invalid broker server URL or connection failed.');
  }
};

const normalizeBackendUrl = (server = '') => {
  const trimmed = String(server).trim();
  if (!trimmed) throw new Error('Server URL is required.');

  // If it already has protocol, return as-is (but upgrade to https if page is HTTPS)
  if (/^https?:\/\//i.test(trimmed)) {
    return upgradeHttpForHttpsPage(trimmed);
  }

  // Extract port if present
  const portMatch = trimmed.match(/:(\d+)$/);
  const port = portMatch ? portMatch[1] : null;
  const host = portMatch ? trimmed.replace(/:(\d+)$/, '') : trimmed;

  // Validate host format (IP, domain, or hostname)
  if (!host || !/^[a-z0-9.-]+(\.[a-z0-9.-]+)*$|^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/i.test(host)) {
    throw new Error('Invalid server URL format.');
  }

  // Determine final port and protocol
  let finalPort = port ? parseInt(port) : 8091;  // Default to 8091
  const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
  // Default to HTTPS if page is HTTPS, or if port is not 8091
  const protocol = isHttpsPage ? 'https' : (finalPort === 8091 ? 'http' : 'https');

  // Build URL with explicit port
  let url = `${protocol}://${host}:${finalPort}`;

  return url;
};
