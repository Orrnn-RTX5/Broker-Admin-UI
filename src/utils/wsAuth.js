import { getRuntimeValue } from '../config/runtimeConfig.js';

const viteEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

const getEnvValue = (...keys) => {
  for (const key of keys) {
    const val = getRuntimeValue(key) || viteEnv[key];
    if (val !== undefined && val !== null && val !== '') return val;
  }
  return null;
};

const FEED_TOKEN_KEYS = [
  'feed_broker_token',
  'feedBrokerToken',
  'FEED_BROKER_TOKEN',
  'VITE_FEED_BROKER_TOKEN',
  'broker_feed_token',
  'brokerFeedToken',
  'feed_token',
  'feedToken',
  'ws_feed_token',
  'wsFeedToken',
  'ws_token',
  'wsToken',
  'broker_token',
  'brokerToken',
  'broker_service_token',
  'brokerServiceToken',
];

const FEED_BROKER_ID_KEYS = [
  'feed_broker_id',
  'feedBrokerId',
  'FEED_BROKER_ID',
  'VITE_FEED_BROKER_ID',
  'broker_id',
  'brokerId',
  'BROKER_ID',
  'VITE_BROKER_ID',
  'id',
  'server_id',
  'serverId',
];

const safeJson = (raw) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const readStorageValue = (storageName, key) => {
  if (typeof globalThis === 'undefined') return null;
  const storage = globalThis[storageName];
  if (!storage?.getItem) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const firstValue = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== '') ?? null;

const findField = (source, fields) => {
  if (!source || typeof source !== 'object') return null;
  for (const key of fields) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
};

export const readWsAuthContext = () => {
  const brokerInfo =
    safeJson(readStorageValue('sessionStorage', 'broker_info')) ||
    safeJson(readStorageValue('localStorage', 'broker_info')) ||
    {};
  const authInfo = safeJson(readStorageValue('sessionStorage', 'auth')) || {};

  const brokerId = firstValue(
    findField(brokerInfo, FEED_BROKER_ID_KEYS),
    findField(brokerInfo?.env, FEED_BROKER_ID_KEYS),
    getEnvValue('FEED_BROKER_ID', 'VITE_FEED_BROKER_ID', 'BROKER_ID', 'VITE_BROKER_ID'),
    readStorageValue('localStorage', 'feedBrokerId'),
    readStorageValue('localStorage', 'feed_broker_id'),
    findField(authInfo, ['broker_id', 'brokerId']),
    readStorageValue('localStorage', 'brokerId'),
    readStorageValue('localStorage', 'broker_id')
  );

  // A dedicated feed token comes from runtime broker configuration or broker discovery.
  let token = firstValue(
    findField(brokerInfo, FEED_TOKEN_KEYS),
    findField(brokerInfo?.env, FEED_TOKEN_KEYS),
    getEnvValue('FEED_BROKER_TOKEN', 'VITE_FEED_BROKER_TOKEN', 'BROKER_FEED_TOKEN', 'VITE_BROKER_FEED_TOKEN', 'WS_FEED_TOKEN', 'VITE_WS_FEED_TOKEN'),
    readStorageValue('localStorage', 'feedBrokerToken'),
    readStorageValue('localStorage', 'feed_broker_token')
  );

  if (!token) {
    token = firstValue(
      findField(brokerInfo, ['session_token', 'sessionToken']),
      findField(authInfo, ['session_token', 'sessionToken', 'token', 'access_token']),
      readStorageValue('localStorage', 'authToken'),
      readStorageValue('localStorage', 'accessToken')
    );
  }

  return {
    token: token ? String(token) : null,
    brokerId: brokerId ? String(brokerId) : null,
  };
};

export const appendWsAuthParams = (
  rawUrl,
  {
    token,
    brokerId,
    tokenParam = 'token',
    brokerIdParam = 'broker_id',
    extraParams = {},
  } = {}
) => {
  const raw = String(rawUrl || '');
  if (!raw) return raw;

  const hashIndex = raw.indexOf('#');
  const withoutHash = hashIndex === -1 ? raw : raw.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : raw.slice(hashIndex);

  const queryIndex = withoutHash.indexOf('?');
  const base = queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
  const existingQuery = queryIndex === -1 ? '' : withoutHash.slice(queryIndex + 1);

  const params = new URLSearchParams(existingQuery);
  if (token && tokenParam) params.set(tokenParam, String(token));
  if (brokerId && brokerIdParam) params.set(brokerIdParam, String(brokerId));

  Object.entries(extraParams || {}).forEach(([key, value]) => {
    if (key && value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });

  const serialized = params.toString();
  return serialized ? `${base}?${serialized}${hash}` : `${base}${hash}`;
};

