import { api } from '../lib/api';

const BASE = '/api/v1/manager/gateway/lp';

const extractData = (res) => res.data;

const handleError = (error) => {
  if (error.response && error.response.data) {
    throw new Error(error.response.data.error || error.response.data.message || `HTTP ${error.response.status}`);
  }
  throw error;
};


export const gatewayGetRequiredFields = () =>
  api.get(`${BASE}/required-fields`).then(extractData).catch(handleError);


export const gatewayGetStatus = () =>
  api.get(`${BASE}/status`, { _noRetry: true }).then(extractData).catch(handleError);


export const gatewayConnect = (payload) =>
  api.post(`${BASE}/connect`, payload).then(extractData).catch(handleError);


export const gatewayDisconnect = (role = 'both') =>
  api.post(`${BASE}/disconnect`, { role }).then(extractData).catch(handleError);
