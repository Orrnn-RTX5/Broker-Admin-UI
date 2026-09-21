import axios from 'axios';
import { getRuntimeValue } from '../config/runtimeConfig.js';
import { SUPER_ADMIN_API_OPERATIONS, getSuperAdminOperation } from '../config/superAdminApiCatalog.js';

export const SUPER_ADMIN_TOKEN_KEY = 'rtx5-super-admin-token';
export const SUPER_ADMIN_USER_KEY = 'rtx5-super-admin-user';
export const SUPER_ADMIN_SESSION_EVENT = 'super-admin:session-changed';

const viteEnv = import.meta.env || {};
const DEFAULT_SUPER_ADMIN_ORIGIN = 'https://fxtrustsuperbackned.orrnn.com';

const trimTrailingSlash = (value = '') => String(value || '').replace(/\/+$/, '');
const isLocalWeb = () => typeof window !== 'undefined'
  && ['localhost', '127.0.0.1', '::1'].includes(window.location?.hostname)
  && !window.rtx5Electron;

export const getSuperAdminOrigin = () => trimTrailingSlash(
  getRuntimeValue('SUPER_ADMIN_API_HOST', 'VITE_SUPER_ADMIN_API_HOST')
    || viteEnv.VITE_SUPER_ADMIN_API_HOST
    || DEFAULT_SUPER_ADMIN_ORIGIN
);

export const getSuperAdminBaseUrl = () => isLocalWeb()
  ? '/super-admin-api'
  : getSuperAdminOrigin();

const readSessionValue = (key) => {
  if (typeof sessionStorage === 'undefined') return '';
  return sessionStorage.getItem(key) || '';
};

export const getSuperAdminSession = () => {
  const token = readSessionValue(SUPER_ADMIN_TOKEN_KEY);
  let user = null;
  try {
    user = JSON.parse(readSessionValue(SUPER_ADMIN_USER_KEY) || 'null');
  } catch {
    user = null;
  }
  return { token, user, isAuthenticated: Boolean(token) };
};

const dispatchSessionChange = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SUPER_ADMIN_SESSION_EVENT, { detail: getSuperAdminSession() }));
  }
};

const saveSession = ({ token, user }) => {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(SUPER_ADMIN_TOKEN_KEY, token);
  if (user) sessionStorage.setItem(SUPER_ADMIN_USER_KEY, JSON.stringify(user));
  dispatchSessionChange();
};

export const clearSuperAdminSession = () => {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(SUPER_ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(SUPER_ADMIN_USER_KEY);
  }
  dispatchSessionChange();
};

export const logoutSuperAdmin = () => {
  clearSuperAdminSession();
};

const client = axios.create({
  headers: { Accept: 'application/json' },
  timeout: 30_000,
});

const extractAccessToken = (payload = {}) => payload.access_token
  || payload.token
  || payload.session_token
  || payload.data?.access_token
  || payload.data?.token
  || payload.result?.access_token
  || '';

const extractUser = (payload = {}) => payload.user
  || payload.admin
  || payload.data?.user
  || payload.data?.admin
  || null;

const interpolatePath = (path, pathParams = {}) => path.replace(/\{([^}]+)\}/g, (_, key) => {
  const value = pathParams[key];
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error(`Missing required path parameter: ${key}`);
  }
  return encodeURIComponent(String(value).trim());
});

const authHeaders = (operation, headers = {}) => {
  if (operation.auth === false) return headers;
  const token = getSuperAdminSession().token;
  if (!token) throw new Error('Sign in to the Super Admin API before running this operation.');
  return { ...headers, Authorization: `Bearer ${token}` };
};

const normalizeError = (error) => {
  const message = error.response?.data?.detail
    || error.response?.data?.message
    || error.response?.data?.error
    || error.message
    || 'Super Admin request failed.';
  const normalized = new Error(typeof message === 'string' ? message : JSON.stringify(message));
  normalized.status = error.response?.status;
  normalized.data = error.response?.data;
  normalized.requestUrl = error.config?.url;
  return normalized;
};

export const loginSuperAdmin = async (credentials = {}) => {
  const payload = {
    username: credentials.username || credentials.user || '',
    password: credentials.password || '',
  };
  try {
    const response = await client.post(
      `${getSuperAdminBaseUrl()}/api/v1/admin/auth/login`,
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    );
    const token = extractAccessToken(response.data);
    if (!token) throw new Error('Login succeeded without an access token in the response.');
    saveSession({
      token,
      user: extractUser(response.data) || { username: payload.username, role: 'super_admin' },
    });
    return response.data;
  } catch (error) {
    throw error.response ? normalizeError(error) : error;
  }
};

export const checkSuperAdminHealth = async () => {
  try {
    const response = await client.get(`${getSuperAdminBaseUrl()}/health`, { timeout: 10_000 });
    return { ok: true, data: response.data };
  } catch (error) {
    return { ok: false, error: normalizeError(error).message };
  }
};

export const checkSuperAdminReadiness = async () => {
  try {
    const response = await client.get(`${getSuperAdminBaseUrl()}/readiness`, { timeout: 10_000 });
    return { ok: true, data: response.data };
  } catch (error) {
    return { ok: false, error: normalizeError(error).message };
  }
};

export const loadCurrentSuperAdmin = async () => {
  const result = await executeSuperAdminOperation('auth_me');
  const session = getSuperAdminSession();
  saveSession({ token: session.token, user: result.data?.user || result.data?.admin || result.data });
  return result.data;
};


export const executeSuperAdminOperation = async (operationOrId, options = {}) => {
  const operation = typeof operationOrId === 'string'
    ? getSuperAdminOperation(operationOrId)
    : operationOrId;
  if (!operation) throw new Error(`Unknown Super Admin operation: ${operationOrId}`);

  const path = interpolatePath(operation.path, options.pathParams);
  const requestUrl = `${getSuperAdminBaseUrl()}${path}`;
  const headers = authHeaders(operation, options.headers);
  let data = options.body;

  if (operation.fileUpload) {
    if (!options.file) throw new Error('Choose a file before uploading.');
    const form = new FormData();
    form.append(options.fileField || 'file', options.file);
    data = form;
  } else if (data !== undefined && !(data instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await client.request({
      method: operation.method,
      url: requestUrl,
      params: options.query,
      data,
      headers,
      responseType: operation.fileDownload ? 'blob' : 'json',
      timeout: operation.stream ? 0 : (options.timeout || 30_000),
    });
    return {
      operation,
      status: response.status,
      headers: response.headers,
      data: response.data,
      requestUrl,
    };
  } catch (error) {
    if (error.response?.status === 401 && operation.auth !== false) clearSuperAdminSession();
    throw normalizeError(error);
  }
};

export const startSuperAdminStream = async (operationId, options = {}, onEvent = () => {}) => {
  const operation = getSuperAdminOperation(operationId);
  if (!operation?.stream) throw new Error('The selected operation is not a stream.');
  const path = interpolatePath(operation.path, options.pathParams);
  const url = new URL(`${getSuperAdminBaseUrl()}${path}`, window.location.origin);
  Object.entries(options.query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });
  const controller = new AbortController();
  const response = await fetch(url, {
    headers: authHeaders(operation, { Accept: 'text/event-stream' }),
    signal: controller.signal,
  });
  if (!response.ok || !response.body) throw new Error(`Stream failed with HTTP ${response.status}.`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const consume = async () => {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split(/\r?\n\r?\n/);
      buffer = chunks.pop() || '';
      chunks.forEach((chunk) => onEvent(chunk));
    }
  };
  consume().catch((error) => {
    if (error.name !== 'AbortError') onEvent(`error: ${error.message}`);
  });
  return () => controller.abort();
};

export { SUPER_ADMIN_API_OPERATIONS };
