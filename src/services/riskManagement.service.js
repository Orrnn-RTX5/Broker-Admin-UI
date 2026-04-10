import { api } from '../lib/api';

const EXT = '/ext-api';

export const RiskManagementService = {
  // --- Risk Limits ---
  listRiskLimits: (scope_type) =>
    api.get(`${EXT}/RiskLimitList`, { params: scope_type ? { scope_type } : {} }).then(r => r.data),

  createRiskLimit: (body) =>
    api.post(`${EXT}/RiskLimitCreate`, body).then(r => r.data),

  updateRiskLimit: (limit_id, body) =>
    api.post(`${EXT}/RiskLimitUpdate`, body, { params: { limit_id } }).then(r => r.data),

  deleteRiskLimit: (limit_id) =>
    api.get(`${EXT}/RiskLimitDelete`, { params: { limit_id } }).then(r => r.data),

  // --- Risk Events ---
  listRiskEvents: (params = {}) =>
    api.get(`${EXT}/RiskEventList`, { params }).then(r => r.data),

  ackRiskEvent: (event_id, comment) =>
    api.get(`${EXT}/RiskEventAck`, { params: { event_id, ...(comment ? { comment } : {}) } }).then(r => r.data),

  ackAllRiskEvents: () =>
    api.get(`${EXT}/RiskEventAckAll`).then(r => r.data),

  // --- Exposure ---
  getExposureBook: () =>
    api.get(`${EXT}/ExposureBook`).then(r => r.data),

  getExposureByGroup: (group) =>
    api.get(`${EXT}/ExposureByGroup`, { params: { group } }).then(r => r.data),

  getExposureByAccount: (login) =>
    api.get(`${EXT}/ExposureByAccount`, { params: { login } }).then(r => r.data),

  // --- Suspicious Activity ---
  listSuspicious: (params = {}) =>
    api.get(`${EXT}/SuspiciousList`, { params }).then(r => r.data),

  reviewSuspicious: (suspicious_id, action, notes) =>
    api.get(`${EXT}/SuspiciousReview`, { params: { suspicious_id, ...(action ? { action } : {}), ...(notes ? { notes } : {}) } }).then(r => r.data),

  getSuspiciousStats: () =>
    api.get(`${EXT}/SuspiciousStats`).then(r => r.data),

  // --- Reports ---
  getToxicFlowReport: (from, to) =>
    api.get(`${EXT}/ToxicFlowReport`, { params: { from, to } }).then(r => r.data),

  getBrokerPnL: (from, to) =>
    api.get(`${EXT}/BrokerPnL`, { params: { from, to } }).then(r => r.data),
};
