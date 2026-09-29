import { api } from '../lib/api.js';
const base = '/api/v1/manager/lp-connections';
const options = { _noRetry: true };
export const listLPConnections = async () => (await api.get(base, options)).data;
export const readLPRuntimeReadiness = async id => (await api.get(`${base}/${encodeURIComponent(id)}/runtime-readiness`, options)).data;
export const saveLPConnection = async payload => (await (payload.expected_revision
  ? api.put(`${base}/${encodeURIComponent(payload.config.id)}`, payload, options)
  : api.post(base, payload, options))).data;
export const enableLPConnection = async (config, enabled) => (await api.post(`${base}/${encodeURIComponent(config.id)}/enable`, { expected_revision: config.revision, enabled }, options)).data;
export const testLPConnection = async id => (await api.post(`${base}/${encodeURIComponent(id)}/test`, {}, options)).data;
