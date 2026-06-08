// Central place for all network endpoints.
// Components should import from here instead of hardcoding a host.
import { getRuntimeValue } from './runtimeConfig.js';
import {
  isDirectBrokerBackendUrl,
  resolveBrokerBackendUrl,
  resolveBrokerExtApiUrl,
  resolveBrokerWsUrl,
} from './backendTarget.js';
import { appendWsAuthParams, readWsAuthContext } from '../utils/wsAuth.js';

const viteEnv = import.meta.env || {};
const trimTrailingSlash = (value = '') => String(value || '').replace(/\/+$/, '');

const DEFAULTS = {
  API_HOST: trimTrailingSlash(getRuntimeValue('API_HOST', 'VITE_API_HOST') || viteEnv.VITE_API_HOST || ''),
  WS_HOST: trimTrailingSlash(getRuntimeValue('WS_HOST', 'VITE_WS_HOST') || viteEnv.VITE_WS_HOST || ''),
  API_HOST_EXT: trimTrailingSlash(getRuntimeValue('API_HOST_EXT', 'VITE_API_HOST_EXT') || viteEnv.VITE_API_HOST_EXT || ''),
  DEFAULT_MT5_SERVER: getRuntimeValue('DEFAULT_MT5_SERVER', 'VITE_DEFAULT_MT5_SERVER') || viteEnv.VITE_DEFAULT_MT5_SERVER || '',
};

export let API_HOST = DEFAULTS.API_HOST;
export let WS_HOST = DEFAULTS.WS_HOST;
export let API_HOST_EXT = DEFAULTS.API_HOST_EXT;
export let DEFAULT_MT5_SERVER = DEFAULTS.DEFAULT_MT5_SERVER;

const readBrokerInfo = () => {
  if (typeof sessionStorage === 'undefined') return null;

  const raw = sessionStorage.getItem('broker_info');
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// normalizeBrokerBackendUrl
// Port 8091 is plain HTTP — no TLS. Force the protocol to http:// and ensure
// the port is explicitly set so no consumer accidentally dials https://:443.
// ---------------------------------------------------------------------------
const BROKER_HTTP_PORT = 8091;

const normalizeBrokerBackendUrl = (backendUrl = '') => {
  const trimmed = trimTrailingSlash(backendUrl);
  if (!trimmed) return trimmed;

  try {
    const url = new URL(trimmed);

    // If protocol is HTTPS and port is 443 or empty, keep it on HTTPS / 443 (no rewrite to 8091)
    if (url.protocol === 'https:' && (!url.port || url.port === '443')) {
      return trimmed;
    }

    // If no explicit port or port is the HTTPS default, set to broker port
    if (!url.port || url.port === '443') {
      url.port = String(BROKER_HTTP_PORT);
    }

    // Port 8091 is always plain HTTP
    if (url.port === String(BROKER_HTTP_PORT)) {
      url.protocol = 'http:';
    }

    return trimTrailingSlash(url.toString());
  } catch {
    if (/^https:/i.test(trimmed)) {
      return trimmed;
    }
    // Fallback: string-replace https with http and :443 with :8091
    return trimmed
      .replace(/:443(?=\/|$)/, `:${BROKER_HTTP_PORT}`)
      .replace(/^https(?=:\/\/)/, 'http');
  }
};

const buildWsHost = (backendUrl) => {
  const trimmed = trimTrailingSlash(backendUrl);
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    // http → ws,  https → wss  (after normalization above this will always be http→ws)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return trimTrailingSlash(url.toString());
  } catch {
    return trimmed.replace(/^https?:/i, (protocol) =>
      protocol.toLowerCase() === 'https:' ? 'wss:' : 'ws:'
    );
  }
};

const resolveMt5Server = (brokerInfo, backendUrl) => {
  if (brokerInfo?.server_ip) return brokerInfo.server_ip;
  if (brokerInfo?.host) return brokerInfo.host;

  try {
    return new URL(backendUrl).hostname;
  } catch {
    return backendUrl || '';
  }
};

export const updateDynamicEndpoints = () => {
  try {
    const info = readBrokerInfo();
    const rawUrl = trimTrailingSlash(info?.backend_url || info?.api_url || info?.server_url || '');
    const targetUrl = resolveBrokerBackendUrl(info, rawUrl);

    if (targetUrl) {
      // Normalize: force https:// on HTTPS pages, or http:// on HTTP pages for port 8091
      const backendUrl = normalizeBrokerBackendUrl(targetUrl);
      API_HOST = backendUrl;
      WS_HOST = resolveBrokerWsUrl(info) || buildWsHost(backendUrl);
      API_HOST_EXT = resolveBrokerExtApiUrl(info, backendUrl);
      DEFAULT_MT5_SERVER = resolveMt5Server(info, backendUrl);
      return;
    }
  } catch (error) {
    console.error('Error updating dynamic endpoints:', error);
  }

  API_HOST = DEFAULTS.API_HOST;
  WS_HOST = DEFAULTS.WS_HOST;
  API_HOST_EXT = DEFAULTS.API_HOST_EXT;
  DEFAULT_MT5_SERVER = DEFAULTS.DEFAULT_MT5_SERVER;
};

updateDynamicEndpoints();

const joinUrl = (base, path = '') => {
  if (/^https?:\/\//i.test(path)) return path;
  if (!base) return path || '';

  const normalizedPath = String(path || '');
  if (!normalizedPath) return trimTrailingSlash(base);

  return `${trimTrailingSlash(base)}/${normalizedPath.replace(/^\/+/, '')}`;
};

export const buildManagerApiUrl = (endpoint = '') => {
  const raw = String(endpoint || '');
  if (/^https?:\/\//i.test(raw)) return raw;

  updateDynamicEndpoints();

  const path = raw
    .replace(/^\/api\/manager(?=\/|\?|$)/, '')
    .replace(/^\/manager(?=\/|\?|$)/, '');

  // For broker backend (103.91.186.142:8091), don't add /manager/ prefix
  // Just use the path directly (e.g., /GroupList, /ManagerOnline)
  const isBrokerBackend = API_HOST && isDirectBrokerBackendUrl(API_HOST, readBrokerInfo() || {});

  let managerPath;
  if (isBrokerBackend) {
    // Direct path without /manager/ prefix
    managerPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  } else {
    // Add /manager/ prefix for other backends (testbrokerbackend.orrnn.com, etc)
    managerPath = path
      ? `/manager${path.startsWith('/') || path.startsWith('?') ? path : `/${path}`}`
      : '/manager';
  }

  return joinUrl(API_HOST, managerPath);
};

export const buildExtApiUrl = (endpoint = '') => {
  const raw = String(endpoint || '');
  if (/^https?:\/\//i.test(raw)) return raw;

  const path = raw.replace(/^\/ext-api(?=\/|\?|$)/, '');
  const extPath = path
    ? path.startsWith('/') || path.startsWith('?') ? path : `/${path}`
    : '';

  return API_HOST_EXT ? joinUrl(API_HOST_EXT, extPath) : `/ext-api${extPath}`;
};

const getBaseWsHost = () => trimTrailingSlash(WS_HOST || buildWsHost(API_HOST));

export const buildFeedWsUrl = () => {
  const base = getBaseWsHost();
  const url = !base ? '/ws/feed' : (base.endsWith('/ws/feed') ? base : `${base}/ws/feed`);
  return appendWsAuthParams(url, readWsAuthContext());
};

export const buildMetricsWsUrl = (token, login) => {
  const authContext = readWsAuthContext();
  return appendWsAuthParams(`${getBaseWsHost()}/manager/OnAccountMetrics`, {
    token: token || authContext.token,
    brokerId: null,
    tokenParam: 'id',
    brokerIdParam: null,
    extraParams: { login },
  });
};
