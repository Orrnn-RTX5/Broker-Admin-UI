import { getRuntimeValue } from './runtimeConfig';

const DEFAULT_BROKER_PORT = 8091;
const DESKTOP_TARGETS = new Set(['desktop', 'electron', 'local']);

const WEB_BACKEND_FIELDS = [
  'web_backend_url',
  'web_api_url',
  'public_backend_url',
  'public_api_url',
  'env.API_HOST',
  'env.VITE_API_HOST',
  'backend_url',
  'api_url',
  'server_url',
];

const WEB_DOMAIN_FIELDS = [
  'backend_domain',
  'api_domain',
  'service_domain',
  'services_domain',
  'web_backend_domain',
  'public_backend_domain',
];

const DESKTOP_BACKEND_FIELDS = [
  'desktop_backend_url',
  'desktop_api_url',
  'local_backend_url',
  'local_api_url',
  'ip_backend_url',
  'ip_api_url',
];

const DESKTOP_HOST_FIELDS = [
  'server_ip',
  'host',
  'ip',
  'backend_ip',
  'backend_host',
];

const PORT_FIELDS = ['server_port', 'backend_port', 'api_port'];

const WEB_EXT_FIELDS = [
  'web_ext_api_url',
  'public_ext_api_url',
  'ext_api_url',
  'env.API_HOST_EXT',
  'env.VITE_API_HOST_EXT',
];

const DESKTOP_EXT_FIELDS = [
  'desktop_ext_api_url',
  'local_ext_api_url',
  'ip_ext_api_url',
];

const WS_FIELDS = [
  'ws_url',
  'web_ws_url',
  'public_ws_url',
  'env.WS_HOST',
  'env.VITE_WS_HOST',
];

const GTA_LEGACY_MATCHES = [
  '103.91.186.142',
  'gta_broker',
  'grow-trading-academy',
  'services.growtradingacademy.com',
];

const GTA_LEGACY_WEB_BACKEND_URL = 'https://services.growtradingacademy.com';
const GTA_LEGACY_DESKTOP_BACKEND_URL = 'http://103.91.186.142:8091';

export const trimTrailingSlash = (value = '') => String(value || '').replace(/\/+$/, '');

const hasProtocol = (value = '') => /^[a-z][a-z\d+.-]*:\/\//i.test(value);

const getRuntimeBrokerId = () =>
  String(getRuntimeValue('BROKER_ID', 'VITE_BROKER_ID') || import.meta.env.VITE_BROKER_ID || '')
    .trim()
    .toLowerCase();

const getRuntimeDefaultServer = () =>
  String(
    getRuntimeValue('DEFAULT_MT5_SERVER', 'VITE_DEFAULT_MT5_SERVER') ||
      import.meta.env.VITE_DEFAULT_MT5_SERVER ||
      ''
  ).trim();

const getRuntimeApiHost = () =>
  trimTrailingSlash(getRuntimeValue('API_HOST', 'VITE_API_HOST') || import.meta.env.VITE_API_HOST || '');

const getRuntimeApiHostExt = () =>
  trimTrailingSlash(getRuntimeValue('API_HOST_EXT', 'VITE_API_HOST_EXT') || import.meta.env.VITE_API_HOST_EXT || '');

const getRuntimeWsHost = () =>
  trimTrailingSlash(getRuntimeValue('WS_HOST', 'VITE_WS_HOST') || import.meta.env.VITE_WS_HOST || '');

export const getBackendTarget = () =>
  String(
    getRuntimeValue('BACKEND_TARGET', 'VITE_BACKEND_TARGET', 'BACKEND_MODE', 'VITE_BACKEND_MODE') ||
      import.meta.env.VITE_BACKEND_TARGET ||
      import.meta.env.VITE_BACKEND_MODE ||
      'web'
  )
    .trim()
    .toLowerCase();

export const isDesktopBackendTarget = () => DESKTOP_TARGETS.has(getBackendTarget());

const getNestedValue = (source, path) =>
  String(path)
    .split('.')
    .reduce((value, key) => (value && value[key] !== undefined ? value[key] : undefined), source);

const getFirstValue = (source = {}, fields = []) => {
  for (const field of fields) {
    const value = getNestedValue(source, field);
    if (value !== undefined && value !== null && value !== '') return value;
  }

  return '';
};

const parsePort = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

const hasExplicitPort = (authority = '') => /:\d+$/.test(String(authority).split('/')[0]);

const ensureUrl = (value = '', protocol = 'https') => {
  const trimmed = trimTrailingSlash(value);
  if (!trimmed) return '';
  return hasProtocol(trimmed) ? trimmed : `${protocol}://${trimmed}`;
};

const buildUrlFromHost = (hostValue = '', { protocol = 'https', port = 0 } = {}) => {
  const trimmed = trimTrailingSlash(hostValue);
  if (!trimmed) return '';
  if (hasProtocol(trimmed)) return trimmed;

  const [authority, ...pathParts] = trimmed.split('/');
  const path = pathParts.length ? `/${pathParts.join('/')}` : '';
  const portSuffix = port && !hasExplicitPort(authority) && ![80, 443].includes(port) ? `:${port}` : '';

  return `${protocol}://${authority}${portSuffix}${path}`;
};

const getUrlHost = (value = '') => {
  const trimmed = trimTrailingSlash(value);
  if (!trimmed) return '';

  try {
    return new URL(ensureUrl(trimmed)).hostname;
  } catch {
    return trimmed.replace(/^[a-z][a-z\d+.-]*:\/\//i, '').split('/')[0].split(':')[0];
  }
};

const getComparableHost = (value = '') => {
  const trimmed = trimTrailingSlash(value);
  if (!trimmed) return '';

  try {
    return new URL(ensureUrl(trimmed)).hostname.toLowerCase();
  } catch {
    return trimmed
      .replace(/^[a-z][a-z\d+.-]*:\/\//i, '')
      .split('/')[0]
      .split(':')[0]
      .toLowerCase();
  }
};

const brokerMatchesRuntimeDeployment = (brokerInfo = {}) => {
  const runtimeBrokerId = getRuntimeBrokerId();
  if (
    runtimeBrokerId &&
    [brokerInfo.broker_id, brokerInfo.id].some((value) => String(value || '').trim().toLowerCase() === runtimeBrokerId)
  ) {
    return true;
  }

  const runtimeServer = getComparableHost(getRuntimeDefaultServer());
  if (!runtimeServer) return false;

  return [
    brokerInfo.server_ip,
    brokerInfo.host,
    brokerInfo.ip,
    brokerInfo.backend_ip,
    brokerInfo.backend_host,
    brokerInfo.server,
    brokerInfo.server_url,
    brokerInfo.backend_url,
    brokerInfo.api_url,
    brokerInfo.market_api_url,
  ].some((value) => getComparableHost(value) === runtimeServer);
};

const hasLegacyGtaMatch = (...values) =>
  values
    .filter((value) => value !== undefined && value !== null)
    .some((value) => {
      const normalized = String(value).trim().toLowerCase();
      return GTA_LEGACY_MATCHES.some((match) => normalized.includes(match));
    });

const resolveLegacyGtaBackendUrl = (brokerInfo = {}, fallbackUrl = '') => {
  if (
    !hasLegacyGtaMatch(
      fallbackUrl,
      brokerInfo.broker_id,
      brokerInfo.id,
      brokerInfo.name,
      brokerInfo.server_ip,
      brokerInfo.host,
      brokerInfo.backend_url,
      brokerInfo.api_url,
      brokerInfo.server_url
    )
  ) {
    return '';
  }

  return isDesktopBackendTarget() ? GTA_LEGACY_DESKTOP_BACKEND_URL : GTA_LEGACY_WEB_BACKEND_URL;
};

const buildWebBackendUrl = (brokerInfo = {}) => {
  const explicitUrl = getFirstValue(brokerInfo, WEB_BACKEND_FIELDS);
  if (explicitUrl) return ensureUrl(explicitUrl, brokerInfo.https === false ? 'http' : 'https');

  const domain = getFirstValue(brokerInfo, WEB_DOMAIN_FIELDS);
  if (domain) return ensureUrl(domain, brokerInfo.https === false ? 'http' : 'https');

  return '';
};

const buildDesktopBackendUrl = (brokerInfo = {}) => {
  const explicitUrl = getFirstValue(brokerInfo, DESKTOP_BACKEND_FIELDS);
  if (explicitUrl) return ensureUrl(explicitUrl, 'http');

  const host = getFirstValue(brokerInfo, DESKTOP_HOST_FIELDS);
  if (!host) return '';

  const port = parsePort(getFirstValue(brokerInfo, PORT_FIELDS)) || DEFAULT_BROKER_PORT;
  const protocol =
    brokerInfo.desktop_protocol ||
    brokerInfo.backend_protocol ||
    brokerInfo.protocol ||
    (port === DEFAULT_BROKER_PORT ? 'http' : 'https');

  return buildUrlFromHost(host, { protocol, port });
};

export const resolveBrokerBackendUrl = (brokerInfo = {}, fallbackUrl = '') => {
  const info = brokerInfo && typeof brokerInfo === 'object' ? brokerInfo : {};
  const fallback = typeof brokerInfo === 'string' ? brokerInfo : fallbackUrl;

  if (!isDesktopBackendTarget() && brokerMatchesRuntimeDeployment(info)) {
    const runtimeApiHost = getRuntimeApiHost();
    if (runtimeApiHost) return ensureUrl(runtimeApiHost, 'https');
  }

  const targetUrl = isDesktopBackendTarget() ? buildDesktopBackendUrl(info) : buildWebBackendUrl(info);
  const legacyUrl = resolveLegacyGtaBackendUrl(info, fallback);

  if (legacyUrl && (!targetUrl || hasLegacyGtaMatch(targetUrl))) return legacyUrl;
  if (targetUrl) return targetUrl;
  if (legacyUrl) return legacyUrl;

  return trimTrailingSlash(fallback);
};

export const resolveBrokerExtApiUrl = (brokerInfo = {}, backendUrl = '') => {
  if (!isDesktopBackendTarget() && brokerMatchesRuntimeDeployment(brokerInfo)) {
    const runtimeApiHostExt = getRuntimeApiHostExt();
    if (runtimeApiHostExt) return ensureUrl(runtimeApiHostExt, 'https');
  }

  const explicitUrl = getFirstValue(
    brokerInfo,
    isDesktopBackendTarget() ? DESKTOP_EXT_FIELDS : WEB_EXT_FIELDS
  );

  if (explicitUrl) return ensureUrl(explicitUrl, isDesktopBackendTarget() ? 'http' : 'https');

  if (isDesktopBackendTarget()) {
    return resolveBrokerBackendUrl(brokerInfo, backendUrl);
  }

  const domainProxy = getFirstValue(brokerInfo, WEB_DOMAIN_FIELDS);
  if (domainProxy) {
    const webBackendUrl = buildWebBackendUrl(brokerInfo);
    if (webBackendUrl) return `${trimTrailingSlash(webBackendUrl)}/ext-api`;
  }

  return '';
};

export const resolveBrokerWsUrl = (brokerInfo = {}) => {
  if (isDesktopBackendTarget()) return '';

  if (brokerMatchesRuntimeDeployment(brokerInfo)) {
    const runtimeWsHost = getRuntimeWsHost();
    if (runtimeWsHost) {
      const trimmed = trimTrailingSlash(runtimeWsHost);
      return /^wss?:\/\//i.test(trimmed) ? trimmed : ensureUrl(trimmed, 'wss').replace(/^https?:/i, 'wss:');
    }
  }

  const explicitUrl = getFirstValue(brokerInfo, WS_FIELDS);
  if (!explicitUrl) return '';

  const trimmed = trimTrailingSlash(explicitUrl);
  if (/^wss?:\/\//i.test(trimmed)) return trimmed;

  return ensureUrl(trimmed, 'wss').replace(/^https?:/i, 'wss:');
};

const readBoolean = (value) => {
  if (value === true || value === false) return value;
  if (value === undefined || value === null || value === '') return undefined;

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'direct'].includes(normalized)) return true;
  if (['false', '0', 'no', 'manager', 'manager-prefix'].includes(normalized)) return false;

  return undefined;
};

export const isDirectBrokerBackendUrl = (backendUrl = '', brokerInfo = {}) => {
  const directFlag =
    readBoolean(brokerInfo.direct_manager_paths) ??
    readBoolean(brokerInfo.direct_paths) ??
    readBoolean(brokerInfo.manager_path_mode);

  if (directFlag !== undefined) return directFlag;

  const trimmed = trimTrailingSlash(backendUrl);
  if (!trimmed) return false;

  try {
    const url = new URL(ensureUrl(trimmed));
    if (url.port === String(DEFAULT_BROKER_PORT) && isDesktopBackendTarget()) return true;
    if (url.hostname === 'localhost' && url.port === String(DEFAULT_BROKER_PORT)) return true;
  } catch {
    if (/localhost.*:8091/i.test(trimmed)) return true;
  }

  return hasLegacyGtaMatch(trimmed, getUrlHost(trimmed));
};
