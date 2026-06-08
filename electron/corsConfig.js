import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

const ORIGIN_LIST_KEYS = [
  'RTX5_BROKER_ORIGINS',
  'RTX5_ALLOWED_BROKER_ORIGINS',
  'VITE_BROKER_ORIGINS',
  'VITE_ALLOWED_BROKER_ORIGINS',
];

const SINGLE_ORIGIN_KEYS = [
  'RTX5_API_ORIGIN',
  'RTX5_EXT_ORIGIN',
  'API_HOST',
  'API_HOST_EXT',
  'VITE_API_HOST',
  'VITE_API_HOST_EXT',
  'DISCOVERY_BASE_URL',
  'VITE_DISCOVERY_BASE_URL',
];

const DEFAULT_CORS_HEADERS = {
  'Access-Control-Allow-Origin': ['null'],
  'Access-Control-Allow-Headers': [
    'Authorization, Content-Type, Accept, X-Requested-With, X-Broker-Id, X-Request-Id, Idempotency-Key',
  ],
  'Access-Control-Allow-Methods': ['GET, POST, PUT, PATCH, DELETE, OPTIONS'],
  'Access-Control-Max-Age': ['86400'],
};

export const normalizeOrigin = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const url = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(url).origin.replace(/\/+$/, '');
  } catch {
    return raw.replace(/\/+$/, '');
  }
};

export const getOriginFromUrl = (value = '') => {
  try {
    return new URL(String(value || '')).origin.replace(/\/+$/, '');
  } catch {
    return '';
  }
};

export const parseOriginList = (value = '') =>
  String(value || '')
    .split(/[,\s]+/)
    .map(normalizeOrigin)
    .filter(Boolean);

export const collectBrokerOrigins = (env = process.env, extraOrigins = []) => {
  const origins = new Set();

  for (const key of ORIGIN_LIST_KEYS) {
    parseOriginList(env[key]).forEach((origin) => origins.add(origin));
  }

  for (const key of SINGLE_ORIGIN_KEYS) {
    const origin = normalizeOrigin(env[key]);
    if (origin) origins.add(origin);
  }

  parseOriginList(extraOrigins.join(',')).forEach((origin) => origins.add(origin));

  return [...origins];
};

export const loadElectronEnv = ({
  cwd = process.cwd(),
  appRoot = '',
  resourcesPath = process.resourcesPath || '',
  exePath = process.execPath || '',
  envFileNames = ['.env', '.env.local'],
  config = dotenv.config,
} = {}) => {
  const dirs = [
    cwd,
    appRoot,
    resourcesPath,
    exePath ? path.dirname(exePath) : '',
  ].filter(Boolean);

  const loaded = [];
  const seen = new Set();

  for (const dir of dirs) {
    for (const name of envFileNames) {
      const filePath = path.resolve(dir, name);
      const normalized = filePath.toLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      if (!fs.existsSync(filePath)) continue;
      config({ path: filePath, override: false });
      loaded.push(filePath);
    }
  }

  return loaded;
};

export const createCorsHeaders = (responseHeaders = {}) => {
  const nextHeaders = {};

  for (const [key, value] of Object.entries(responseHeaders || {})) {
    if (!/^access-control-/i.test(key)) {
      nextHeaders[key] = value;
    }
  }

  return {
    ...nextHeaders,
    ...DEFAULT_CORS_HEADERS,
  };
};

export const shouldApplyCorsHeaders = (details = {}, allowedOrigins = []) => {
  const origin = getOriginFromUrl(details.url);
  if (!origin) return false;

  return new Set(allowedOrigins.map(normalizeOrigin).filter(Boolean)).has(origin);
};

export const getExtApiRedirectUrl = (url = '', apiOrigin = '', extOrigin = '') => {
  const normalizedApiOrigin = normalizeOrigin(apiOrigin);
  const normalizedExtOrigin = normalizeOrigin(extOrigin);
  if (!normalizedApiOrigin || !normalizedExtOrigin || normalizedApiOrigin === normalizedExtOrigin) return '';

  const origin = getOriginFromUrl(url);
  if (origin !== normalizedApiOrigin) return '';

  try {
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith('/ext-api')) return '';

    const nextPath = parsed.pathname.replace(/^\/ext-api(?=\/|$)/, '') || '/';
    return `${normalizedExtOrigin}${nextPath}${parsed.search}${parsed.hash}`.replace(/\/$/, '');
  } catch {
    return '';
  }
};
