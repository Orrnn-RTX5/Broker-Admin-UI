import { api } from '../lib/api';

// Manager-side proxy for the bridge multi-tenant FIX feed admin API.
// /api/v1/manager/feed/* proxies 1:1 to the bridge /api/v1/feed/* endpoints
// (RequireAdmin outside, internal X-API-Key inside).
const BASE = '/api/v1/manager/feed';

const extractData = (res) => res.data;

const handleError = (error) => {
  if (error.response) {
    const msg = error.response.data?.error || error.response.data?.message || `HTTP ${error.response.status}`;
    const err = new Error(msg);
    err.status = error.response.status;
    throw err;
  }
  throw error;
};

export const feedTenantsList = () =>
  api.get(`${BASE}/tenants`, { _noRetry: true }).then(extractData).catch(handleError);

// Create a tenant. The response relays the bridge's one-time credential
// payload UNCHANGED (show-once) — never persist it client-side.
export const feedTenantCreate = (payload) =>
  api.post(`${BASE}/tenants`, payload).then(extractData).catch(handleError);

export const feedTenantSuspend = (companyCode) =>
  api.put(`${BASE}/tenants/suspend`, { company_code: companyCode }).then(extractData).catch(handleError);

export const feedTenantActivate = (companyCode) =>
  api.put(`${BASE}/tenants/activate`, { company_code: companyCode }).then(extractData).catch(handleError);

// Rotate tenant credentials (write-only password).
export const feedTenantUpdateCredentials = ({ company_code, username, password }) =>
  api.put(`${BASE}/tenants/credentials`, { company_code, username, password }).then(extractData).catch(handleError);

export const feedTenantUpdateSymbols = ({ company_code, allowed_symbols, blocked_symbols }) =>
  api.put(`${BASE}/tenants/symbols`, { company_code, allowed_symbols, blocked_symbols }).then(extractData).catch(handleError);

export const feedSessions = () =>
  api.get(`${BASE}/sessions`, { _noRetry: true }).then(extractData).catch(handleError);

export const feedUsage = ({ company_code, days } = {}) =>
  api.get(`${BASE}/usage`, {
    _noRetry: true,
    params: {
      ...(company_code ? { company_code } : {}),
      ...(days ? { days } : {}),
    },
  }).then(extractData).catch(handleError);

export const feedReloadTenants = () =>
  api.post(`${BASE}/reload`).then(extractData).catch(handleError);
