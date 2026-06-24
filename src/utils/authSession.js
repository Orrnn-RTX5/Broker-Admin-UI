const TOKEN_FIELDS = [
  'token',
  'access_token',
  'accessToken',
  'auth_token',
  'authToken',
  'bearer_token',
  'bearerToken',
  'session_token',
  'sessionToken',
  'session_id',
  'sessionId',
  'authorization',
  'authHeader',
  'jwt',
  'bearer',
];
const AMBIGUOUS_TOKEN_FIELDS = ['id'];
const REFRESH_TOKEN_FIELDS = ['refresh_token', 'refreshToken'];
const EXPIRES_AT_FIELDS = ['expires_at', 'expiresAt', 'token_expires_at', 'tokenExpiresAt'];
const EXPIRES_IN_FIELDS = ['expires_in', 'expiresIn'];
const WRAPPER_FIELDS = ['data', 'value', 'answer', 'result', 'payload', 'session', 'auth'];
const MAX_WRAPPER_DEPTH = 3;

const isObjectRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const normalizeFieldName = (value) => String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();

const firstPresent = (...values) =>
  values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') ?? null;

const getFieldValue = (record, fields) => {
  const exactValue = firstPresent(...fields.map((field) => record[field]));
  if (exactValue !== null) return exactValue;

  const normalizedFields = new Set(fields.map(normalizeFieldName));
  const matchedEntry = Object.entries(record).find(([key, value]) => (
    normalizedFields.has(normalizeFieldName(key)) &&
    value !== undefined &&
    value !== null &&
    String(value).trim() !== ''
  ));

  return matchedEntry?.[1] ?? null;
};

const normalizeTokenValue = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim().replace(/^Bearer\s+/i, '').trim();
  return normalized || null;
};

const isTokenLikeIdentifier = (value) => {
  const normalized = normalizeTokenValue(value);
  if (!normalized) return false;
  return normalized.length >= 20 || normalized.includes('-') || normalized.includes('.');
};

const getDirectTokenValue = (candidate) => {
  const tokenValue = normalizeTokenValue(getFieldValue(candidate, TOKEN_FIELDS));
  if (tokenValue) return tokenValue;

  const idValue = getFieldValue(candidate, AMBIGUOUS_TOKEN_FIELDS);
  return isTokenLikeIdentifier(idValue) ? normalizeTokenValue(idValue) : null;
};

export const getAuthPayloadCandidates = (payload = {}) => {
  const candidates = [];
  const addCandidate = (candidate, depth = 0) => {
    if (isObjectRecord(candidate) && !candidates.includes(candidate)) {
      candidates.push(candidate);
      if (depth >= MAX_WRAPPER_DEPTH) return;

      for (const field of WRAPPER_FIELDS) {
        addCandidate(getFieldValue(candidate, [field]), depth + 1);
      }
    }
  };

  addCandidate(payload);
  return candidates;
};

const getWrappedPrimitiveToken = (payload) => {
  const normalizedPayload = normalizeTokenValue(payload);
  if (isTokenLikeIdentifier(normalizedPayload)) return normalizedPayload;

  for (const candidate of getAuthPayloadCandidates(payload)) {
    for (const field of WRAPPER_FIELDS) {
      const value = getFieldValue(candidate, [field]);
      if (isObjectRecord(value)) continue;
      const normalizedValue = normalizeTokenValue(value);
      if (isTokenLikeIdentifier(normalizedValue)) return normalizedValue;
    }
  }

  return null;
};

export const getAuthSessionValue = (payload, fields, options = {}) => {
  for (const candidate of getAuthPayloadCandidates(payload)) {
    const value = getFieldValue(candidate, fields);
    const normalizedValue = options.normalize ? options.normalize(value) : value;
    if (normalizedValue !== null && normalizedValue !== undefined && String(normalizedValue).trim() !== '') {
      return normalizedValue;
    }
  }

  if (options.allowAmbiguousId) {
    for (const candidate of getAuthPayloadCandidates(payload)) {
      const value = getFieldValue(candidate, AMBIGUOUS_TOKEN_FIELDS);
      if (isTokenLikeIdentifier(value)) return normalizeTokenValue(value);
    }
  }

  if (options.allowWrappedPrimitiveToken) {
    const wrappedToken = getWrappedPrimitiveToken(payload);
    if (wrappedToken) return wrappedToken;
  }

  return null;
};

export const getAuthPrimaryPayload = (payload = {}) => (
  getAuthPayloadCandidates(payload).find((candidate) => getDirectTokenValue(candidate)) ||
  getAuthPayloadCandidates(payload)[0] ||
  {}
);

export const getAuthAccessToken = (payload) =>
  getAuthSessionValue(payload, TOKEN_FIELDS, {
    normalize: normalizeTokenValue,
    allowAmbiguousId: true,
    allowWrappedPrimitiveToken: true,
  });

export const getAuthRefreshToken = (payload) =>
  getAuthSessionValue(payload, REFRESH_TOKEN_FIELDS, { normalize: normalizeTokenValue });

export const getAuthExpiresAt = (payload) => getAuthSessionValue(payload, EXPIRES_AT_FIELDS);
export const getAuthExpiresIn = (payload) => getAuthSessionValue(payload, EXPIRES_IN_FIELDS);
