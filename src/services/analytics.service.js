import { api } from '../lib/api';

const EXT = '/ext-api';

export const AnalyticsService = {
  // --- Client Analytics ---
  getCLV: () => api.get(`${EXT}/AnalyticsCLV`).then(r => r.data),
  getChurnPrediction: () => api.get(`${EXT}/AnalyticsChurnPrediction`).then(r => r.data),
  getRetention: () => api.get(`${EXT}/AnalyticsRetention`).then(r => r.data),
  getDeposits: () => api.get(`${EXT}/AnalyticsDeposits`).then(r => r.data),

  // --- Trading Analytics ---
  getPnL: () => api.get(`${EXT}/AnalyticsPnL`).then(r => r.data),
  getVolume: () => api.get(`${EXT}/AnalyticsVolume`).then(r => r.data),
  getTradingPatterns: () => api.get(`${EXT}/AnalyticsTradingPatterns`).then(r => r.data),
  getMarginUtilization: () => api.get(`${EXT}/AnalyticsMarginUtilization`).then(r => r.data),
  getGroupStats: () => api.get(`${EXT}/AnalyticsGroupStats`).then(r => r.data),
  getSymbolStats: () => api.get(`${EXT}/AnalyticsSymbolStats`).then(r => r.data),

  // --- Trader Rankings ---
  getTopTraders: () => api.get(`${EXT}/AnalyticsTopTraders`).then(r => r.data),
  getWorstTraders: () => api.get(`${EXT}/AnalyticsWorstTraders`).then(r => r.data),

  // --- Revenue ---
  getRevenueForecast: () => api.get(`${EXT}/AnalyticsRevenueForecast`).then(r => r.data),

  // --- Exports ---
  getAuditExport: () => api.get(`${EXT}/AuditExport`, { responseType: 'blob' }).then(r => r.data),
  getReportExport: () => api.get(`${EXT}/ReportExport`, { responseType: 'blob' }).then(r => r.data),
};
