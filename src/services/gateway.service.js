import { api } from '../lib/api';

const BASE = '/api/v1/manager/gateway/lp';

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


export const gatewayGetRequiredFields = () =>
  api.get(`${BASE}/required-fields`).then(extractData).catch(handleError);


export const gatewayGetStatus = () =>
  api.get(`${BASE}/status`, { _noRetry: true }).then(extractData).catch(handleError);


export const gatewayGetCentralConfig = () =>
  api.get(`${BASE}/central/config`).then(extractData).catch(handleError);


export const gatewaySaveCentralConfig = (payload) =>
  api.post(`${BASE}/central/config`, payload).then(extractData).catch(handleError);


export const gatewayConnect = (payload) =>
  api.post(`${BASE}/connect`, payload).then(extractData).catch(handleError);


export const gatewayDisconnect = (role = 'both') =>
  api.post(`${BASE}/disconnect`, { role }).then(extractData).catch(handleError);

export const gatewayGetRoutingOptions = () =>
  api.get(`${BASE}/routing-options`).then(extractData).catch(handleError);

// ─── Market-data feed provider config (manager /gateway/feed contract) ────────
// GET  …/gateway/feed/config        → { feed_provider, enabled, cserver:{…}, password_set, updated_at }
// POST …/gateway/feed/config        → persists config (optional write-only "password")
// POST …/gateway/feed/config/apply  → hot-applies the provider on the bridge
const FEED_BASE = '/api/v1/manager/gateway/feed';

export const gatewayGetFeedConfig = () =>
  api.get(`${FEED_BASE}/config`, { _noRetry: true }).then(extractData).catch(handleError);

export const gatewaySaveFeedConfig = (payload) =>
  api.post(`${FEED_BASE}/config`, payload).then(extractData).catch(handleError);

export const gatewayApplyFeedConfig = () =>
  api.post(`${FEED_BASE}/config/apply`).then(extractData).catch(handleError);

const RELAY_BASE = '/api/v1/manager/gateway/fix-relay';
export const gatewayGetRelayConfig = () =>
  api.get(`${RELAY_BASE}/config`, { _noRetry: true }).then(extractData).catch(handleError);
export const gatewaySaveRelayConfig = (payload) =>
  api.put(`${RELAY_BASE}/config`, payload).then(extractData).catch(handleError);
export const gatewayApplyRelayConfig = () =>
  api.post(`${RELAY_BASE}/apply`, {}, { _noRetry: true }).then(extractData).catch(handleError);
export const gatewayGetRelayStatus = () =>
  api.get(`${RELAY_BASE}/status`, { _noRetry: true }).then(extractData).catch(handleError);
