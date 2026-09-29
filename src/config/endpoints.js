// Central place for all network endpoints.
// Components should import from here instead of hardcoding a host.
import { getRuntimeValue } from './runtimeConfig.js';
import {
  isDesktopBackendTarget,
  isDirectBrokerBackendUrl,
  resolveBrokerBackendUrl,
  resolveBrokerExtApiUrl,
  resolveBrokerWsUrl,
} from './backendTarget.js';
import {
  DEV_PROXY_BACKEND_COOKIE,
  DEV_PROXY_EXT_COOKIE,
  DEV_PROXY_DIRECT_MANAGER_COOKIE,
  isLocalWebHostname,
  parseDevProxyTarget,
} from './devProxy.js';
import { appendWsAuthParams, readWsAuthContext } from '../utils/wsAuth.js';

const viteEnv = import.meta.env || {};
const trimTrailingSlash = (value = '') => String(value || '').replace(/\/+$/, '');

const DEFAULTS = {
  API_HOST: trimTrailingSlash(
    getRuntimeValue('API_HOST', 'VITE_API_HOST', 'API_URL', 'VITE_API_URL') ||
      viteEnv.VITE_API_HOST ||
      viteEnv.VITE_API_URL ||
      viteEnv.API_HOST ||
      viteEnv.API_URL ||
      ''
  ),
  WS_HOST: trimTrailingSlash(getRuntimeValue('WS_HOST', 'VITE_WS_HOST') || viteEnv.VITE_WS_HOST || ''),
  API_HOST_EXT: trimTrailingSlash(
    getRuntimeValue('API_HOST_EXT', 'VITE_API_HOST_EXT', 'API_EXT_URL', 'VITE_API_EXT_URL') ||
      viteEnv.VITE_API_HOST_EXT ||
      viteEnv.VITE_API_EXT_URL ||
      viteEnv.API_HOST_EXT ||
      viteEnv.API_EXT_URL ||
      ''
  ),
  DEFAULT_MT5_SERVER: getRuntimeValue('DEFAULT_MT5_SERVER', 'VITE_DEFAULT_MT5_SERVER') || viteEnv.VITE_DEFAULT_MT5_SERVER || '',
};

export let API_HOST = DEFAULTS.API_HOST;
export let WS_HOST = DEFAULTS.WS_HOST;
export let API_HOST_EXT = DEFAULTS.API_HOST_EXT;
export let DEFAULT_MT5_SERVER = DEFAULTS.DEFAULT_MT5_SERVER;

const readBrokerInfo = () => {
  const readStorage = (storage) => {
    if (!storage?.getItem) return null;

    const raw = storage.getItem('broker_info');
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  if (typeof sessionStorage !== 'undefined') {
    const sessionBroker = readStorage(sessionStorage);
    if (sessionBroker) return sessionBroker;
  }

  if (typeof localStorage !== 'undefined') {
    return readStorage(localStorage);
  }

  return null;
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

const readDevProxyFlag = () =>
  String(
    getRuntimeValue('USE_DEV_PROXY', 'VITE_USE_DEV_PROXY') ?? viteEnv.VITE_USE_DEV_PROXY ?? ''
  )
    .trim()
    .toLowerCase();

export const shouldUseLocalDevProxy = () => {
  if (isDesktopBackendTarget()) return false;

  const flag = readDevProxyFlag();
  if (['false', '0', 'no', 'off'].includes(flag)) return false;
  if (['true', '1', 'yes', 'on'].includes(flag)) return true;

  const isViteDev = viteEnv.DEV === true || viteEnv.MODE === 'development';
  if (!isViteDev || typeof window === 'undefined') return false;

  return isLocalWebHostname(window.location?.hostname);
};

const writeDevProxyCookie = (name, value) => {
  if (typeof document === 'undefined') return;

  const target = parseDevProxyTarget(value);
  if (!target) {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    return;
  }

  document.cookie = `${name}=${encodeURIComponent(target)}; Path=/; SameSite=Lax`;
};

const syncDevProxyCookies = () => {
  if (!shouldUseLocalDevProxy()) return;
  writeDevProxyCookie(DEV_PROXY_BACKEND_COOKIE, API_HOST);
  writeDevProxyCookie(DEV_PROXY_EXT_COOKIE, API_HOST_EXT || API_HOST);
  writeDevProxyCookie(DEV_PROXY_DIRECT_MANAGER_COOKIE,
    isDirectBrokerBackendUrl(API_HOST, readBrokerInfo() || {}) ? API_HOST : '');
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
      syncDevProxyCookies();
      return;
    }
  } catch (error) {
    console.error('Error updating dynamic endpoints:', error);
  }

  API_HOST = DEFAULTS.API_HOST;
  WS_HOST = DEFAULTS.WS_HOST;
  API_HOST_EXT = DEFAULTS.API_HOST_EXT;
  DEFAULT_MT5_SERVER = DEFAULTS.DEFAULT_MT5_SERVER;
  syncDevProxyCookies();
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

  let path = raw
    .replace(/^\/api\/manager(?=\/|\?|$)/, '')
    .replace(/^\/manager(?=\/|\?|$)/, '');

  // For broker backend (103.91.186.142:8091), don't add /manager/ prefix
  // Just use the path directly (e.g., /GroupList, /ManagerOnline)
  const isBrokerBackend = API_HOST && isDirectBrokerBackendUrl(API_HOST, readBrokerInfo() || {});
  if (isBrokerBackend) {
    // The public gateway owns /api/v2/auth/me for trader JWTs. Manager sessions
    // must use their canonical namespace on backends exposing root routes.
    path = path.replace(/^\/api\/v[12]\/auth\/(login|me|refresh)(?=\?|$)/,
      '/api/v1/manager/auth/$1');
  }

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

  if (shouldUseLocalDevProxy()) {
    // Keep flat manager routes (e.g. GroupList) inside Vite's proxy namespace.
    // The origin-bound routing cookie tells Vite when to strip this prefix.
    return path
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

  if (shouldUseLocalDevProxy()) {
    return `/ext-api${extPath}`;
  }

  return API_HOST_EXT ? joinUrl(API_HOST_EXT, extPath) : `/ext-api${extPath}`;
};

const getBaseWsHost = () => trimTrailingSlash(WS_HOST || buildWsHost(API_HOST));

const isLocalFeedDevFlagOn = (runtimeKey, viteKey) => {
  const isDev = viteEnv.DEV === true || viteEnv.MODE === 'development';
  if (!isDev || typeof window === 'undefined') return false;
  const explicit = String(getRuntimeValue(runtimeKey, viteKey) ?? viteEnv[viteKey] ?? 'false').toLowerCase();
  return explicit === 'true' && isLocalWebHostname(window.location?.hostname);
};

export const shouldUseFeedDevProxy = () =>
  isLocalFeedDevFlagOn('FEED_USE_DEV_PROXY', 'VITE_FEED_USE_DEV_PROXY');

// Only the status fetch is subject to CORS; the feed WebSocket is not, and some
// brokers reject it when the proxy rewrites its Origin. This proxies the status
// request alone for brokers whose status endpoint omits CORS for localhost.
export const shouldUseFeedStatusDevProxy = () =>
  shouldUseFeedDevProxy() ||
  isLocalFeedDevFlagOn('FEED_STATUS_USE_DEV_PROXY', 'VITE_FEED_STATUS_USE_DEV_PROXY');

export const toLocalDevFeedProxyUrl = (
  feedUrl = '',
  useProxy = shouldUseFeedDevProxy(),
  localOrigin = typeof window !== 'undefined' ? window.location?.origin : ''
) => {
  if (!useProxy || !localOrigin) return feedUrl;

  try {
    const upstream = new URL(feedUrl, localOrigin);
    const local = new URL(localOrigin);
    local.pathname = upstream.pathname;
    local.search = upstream.search;
    local.hash = '';
    return local.toString();
  } catch {
    return feedUrl;
  }
};

export const buildFeedWsUrl = () => {
  updateDynamicEndpoints();
  const brokerInfo = readBrokerInfo();
  const explicitWsUrl = getRuntimeValue('FEED_WS_URL', 'VITE_FEED_WS_URL') ||
    brokerInfo?.feed_ws_url ||
    brokerInfo?.ws_url ||
    brokerInfo?.env?.FEED_WS_URL ||
    brokerInfo?.env?.VITE_FEED_WS_URL ||
    viteEnv.VITE_FEED_WS_URL;
  const base = explicitWsUrl || getBaseWsHost() || 'wss://nexa.orrnn.com/ws/feed';
  const rawUrl = base.endsWith('/ws/feed') ? base : `${base}/ws/feed`;
  const authContext = readWsAuthContext();
  const sendToken = String(
    getRuntimeValue('FEED_SEND_TOKEN', 'VITE_FEED_SEND_TOKEN') ?? viteEnv.VITE_FEED_SEND_TOKEN ?? 'true'
  ).toLowerCase() !== 'false';
  const authenticatedUrl = appendWsAuthParams(rawUrl, {
    ...authContext,
    token: sendToken ? authContext.token : null,
  });
  const proxiedUrl = shouldUseFeedDevProxy() ? toLocalDevFeedProxyUrl(authenticatedUrl) : authenticatedUrl;
  try {
    const url = new URL(proxiedUrl, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
    if (url.protocol === 'https:') url.protocol = 'wss:';
    if (url.protocol === 'http:') url.protocol = 'ws:';
    return url.toString();
  } catch {
    return proxiedUrl.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
  }
};

export const buildFeedStatusUrl = () => {
  updateDynamicEndpoints();
  const explicitStatusUrl = getRuntimeValue('FEED_STATUS_URL', 'VITE_FEED_STATUS_URL') || viteEnv.VITE_FEED_STATUS_URL;
  if (explicitStatusUrl) {
    return toLocalDevFeedProxyUrl(explicitStatusUrl, shouldUseFeedStatusDevProxy());
  }
  if (shouldUseLocalDevProxy()) {
    return '/ws/feed/status';
  }
  const wsUrl = buildFeedWsUrl();
  try {
    const url = new URL(wsUrl, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
    if (!/\/status\/?$/i.test(url.pathname)) {
      url.pathname = `${url.pathname.replace(/\/$/, '')}/status`;
    }
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return '/ws/feed/status';
  }
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

