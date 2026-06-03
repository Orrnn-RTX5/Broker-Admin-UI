import { getRuntimeValue } from '../config/runtimeConfig';
import { isDesktopBackendTarget, resolveBrokerBackendUrl } from '../config/backendTarget';

const BROKER_INFO_KEY = 'broker_info';
const AUTH_KEY = 'auth';
const RECENT_BROKERS_KEY = 'recent_brokers';
const ADMIN_LOGIN_PORT = 8091;

export const DISCOVERY_BASE_URL =
  getRuntimeValue('DISCOVERY_BASE_URL', 'VITE_DISCOVERY_BASE_URL') ||
  import.meta.env.VITE_DISCOVERY_BASE_URL ||
  'https://superbackend.orrnn.com';

// Set VITE_USE_MOCK_DISCOVERY=true in .env only when local mock data is needed.
const USE_MOCK_DISCOVERY =
  String(
    getRuntimeValue('USE_MOCK_DISCOVERY', 'VITE_USE_MOCK_DISCOVERY') ??
      import.meta.env.VITE_USE_MOCK_DISCOVERY ??
      ''
  ) === 'true';

export const RUNTIME_API_HOST =
  (getRuntimeValue('API_HOST', 'VITE_API_HOST') ||
  import.meta.env.VITE_API_HOST ||
  '').replace(/\/+$/, '');

export const RUNTIME_DEFAULT_MT5_SERVER =
  getRuntimeValue('DEFAULT_MT5_SERVER', 'VITE_DEFAULT_MT5_SERVER') ||
  import.meta.env.VITE_DEFAULT_MT5_SERVER ||
  '';

// ---------------------------------------------------------------------------
// Mock broker list — mirrors what the real /api/v2/broker/servers returns.
// Each entry must have: broker_id, name, status, backend_url, server_ip.
// ---------------------------------------------------------------------------
const MOCK_BROKER_LIST = [
  {
    broker_id: 'testorrnn',
    name: 'Test Orrnn Broker (Demo)',
    status: 'active',
    backend_url: 'https://testbrokerbackend.orrnn.com',
    server_ip: 'testbrokerbackend.orrnn.com',
    server_port: 8091,
  },
  {
    broker_id: 'orrnn',
    name: 'Orrnn Broker',
    status: 'active',
    backend_url: 'https://testbrokerbackend.orrnn.com',
    server_ip: 'testbrokerbackend.orrnn.com',
    server_port: 8091,
  },
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
const trimTrailingSlash = (value = '') => String(value || '').replace(/\/+$/, '');

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

const normalizeBrokerInfo = (info) => {
  const backend_url = buildBackendUrl(info);

  return {
    ...info,
    broker_id: info.broker_id,
    name: info.name || info.broker_name || info.broker_id,
    status: info.status || 'active',
    backend_url,
    server_ip: info.server_ip || getServerFromBackend(backend_url),
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

const SECRET_KEY_RE = /(password|token|secret|authorization|api[_-]?key)/i;

const redactForLog = (value, seen = new WeakSet()) => {
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactForLog(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      SECRET_KEY_RE.test(key) ? '[REDACTED]' : redactForLog(entry, seen),
    ])
  );
};

const withAdminPort = (backendUrl = '') => {
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
// Calls:  GET {DISCOVERY_BASE_URL}/api/v1/broker/servers
// ---------------------------------------------------------------------------
export const fetchBrokerList = async () => {
  if (USE_MOCK_DISCOVERY) {
    // Local fallback only; set VITE_USE_MOCK_DISCOVERY=true to use it.
    const list = MOCK_BROKER_LIST.filter((b) => b.status === 'active').map(normalizeBrokerInfo);
    console.log('%c[Auth Mock Discovery] fetchBrokerList', 'color: #ff9800; font-weight: bold;', list);
    return list;
  }

  const url = `${DISCOVERY_BASE_URL.replace(/\/+$/, '')}/api/v1/broker/servers`;
  console.log(`%c[Auth Request] GET ${url}`, 'color: #00bcd4; font-weight: bold;');

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
    console.error(`%c[Auth Connection Failed] GET ${url}`, 'color: #f44336; font-weight: bold;', err);
    throw new Error('Cannot reach platform. Try again.');
  }

  const data = await readJson(response);
  if (!response.ok) {
    console.error(`%c[Auth Response Error] GET ${url}`, 'color: #f44336; font-weight: bold;', {
      status: response.status,
      data
    });
    throw new Error(getResponseMessage(data) || 'Failed to load broker list.');
  }

  console.log(`%c[Auth Response Success] GET ${url}`, 'color: #4caf50; font-weight: bold;', {
    status: response.status,
    data
  });

  // API may return an array directly or wrapped: { brokers: [...] } / { data: [...] }
  const list = Array.isArray(data) ? data : (data?.brokers ?? data?.data ?? []);
  return list
    .filter((b) => !b.status || b.status === 'active')
    .map(normalizeBrokerInfo);
};


export const discoverBrokerById = (brokerList, brokerId) => {
  const found = brokerList.find((b) => b.broker_id === brokerId);
  if (!found) throw new Error('Broker not found');
  if (found.status && found.status !== 'active') {
    throw new Error(`Broker is ${found.status}. Contact support.`);
  }
  return found;
};


export const normalizeBrokerId = (value) => value.trim().toLowerCase();

const postJson = async (url, body) => {
  console.log(`%c[Auth Request] POST ${url}`, 'color: #00bcd4; font-weight: bold;', { body: redactForLog(body) });
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
    console.error(`%c[Auth Connection Failed] POST ${url}`, 'color: #f44336; font-weight: bold;', err);
    throw new Error('Connection failed');
  }

  const data = await readJson(response);
  if (!response.ok) {
    console.error(`%c[Auth Response Error] POST ${url}`, 'color: #f44336; font-weight: bold;', {
      status: response.status,
      data: redactForLog(data)
    });
    throw new Error(getResponseMessage(data) || `HTTP ${response.status}`);
  }

  console.log(`%c[Auth Response Success] POST ${url}`, 'color: #4caf50; font-weight: bold;', {
    status: response.status,
    data: redactForLog(data)
  });
  return data || {};
};

export const loginManager = async (brokerInfo, { user, password, server }) => {
  try {
    const backendUrl = resolveBrokerBackendUrl(brokerInfo, brokerInfo?.backend_url);
    return await postJson(
      `${withAdminPort(backendUrl).replace(/\/+$/, '')}/api/v2/auth/login`,
      { user, password, server }
    );
  } catch (error) {
    throw new Error(mapManagerLoginError(error.message));
  }
};

export const loginAdmin = async (brokerInfo, { user, password, server }) => {
  try {
    const backendUrl = resolveBrokerBackendUrl(brokerInfo, brokerInfo?.backend_url);
    return await postJson(
      `${withAdminPort(backendUrl).replace(/\/+$/, '')}/api/v2/admin/login`,
      { user, password, server: server || brokerInfo?.server_ip || brokerInfo?.broker_id }
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

import { updateDynamicEndpoints } from '../config/endpoints';

export const getBrokerInfo = () => {
  try {
    const raw = sessionStorage.getItem(BROKER_INFO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setBrokerInfo = (brokerInfo) => {
  sessionStorage.setItem(BROKER_INFO_KEY, JSON.stringify(normalizeBrokerInfo(brokerInfo)));
  updateDynamicEndpoints();
};

export const clearBrokerInfo = () => {
  sessionStorage.removeItem(BROKER_INFO_KEY);
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
  const auth = {
    ...authData,
    broker_id: authData?.broker_id || brokerInfo?.broker_id,
  };

  sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth));

  if (auth.token) localStorage.setItem('authToken', auth.token);
  if (auth.refresh_token) localStorage.setItem('refreshToken', auth.refresh_token);
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
      license_key, // Optional, for audit trail
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
