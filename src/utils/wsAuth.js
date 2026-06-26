const TOKEN_FIELDS = [
  'feed_token',
  'feedToken',
  'ws_token',
  'wsToken',
  'broker_token',
  'brokerToken',
  'service_token',
  'serviceToken',
  'broker_service_token',
  'brokerServiceToken',
  'session_token',
  'sessionToken',
  'access_token',
  'accessToken',
  'token',
];

const BROKER_ID_FIELDS = [
  'broker_id',
  'brokerId',
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

  const token = firstValue(
    findField(brokerInfo, TOKEN_FIELDS),
    findField(authInfo, TOKEN_FIELDS),
    readStorageValue('localStorage', 'authToken'),
    readStorageValue('localStorage', 'accessToken')
  );

  const brokerId = firstValue(
    findField(brokerInfo, BROKER_ID_FIELDS),
    findField(authInfo, ['broker_id', 'brokerId']),
    readStorageValue('localStorage', 'brokerId'),
    readStorageValue('localStorage', 'broker_id')
  );

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
  const url = String(rawUrl || '');
  if (!url) return url;

  const params = new URLSearchParams();
  if (token && tokenParam) params.set(tokenParam, String(token));
  if (brokerId && brokerIdParam) params.set(brokerIdParam, String(brokerId));

  Object.entries(extraParams || {}).forEach(([key, value]) => {
    if (key && value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });

  const serialized = params.toString();
  if (!serialized) return url;

  const hashIndex = url.indexOf('#');
  const base = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}${serialized}${hash}`;
};
