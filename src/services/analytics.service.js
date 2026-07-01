import { api } from '../lib/api';

const EXT = '/ext-api';
export const ANALYTICS_READ_TIMEOUT_MS = 8000;

const getAnalytics = (path, config = {}) =>
  api.get(`${EXT}${path}`, { timeout: ANALYTICS_READ_TIMEOUT_MS, ...config }).then(r => r.data);

export const AnalyticsService = {
  // --- Client Analytics ---
  getCLV: () => getAnalytics('/AnalyticsCLV'),
  getChurnPrediction: () => getAnalytics('/AnalyticsChurnPrediction'),
  getRetention: () => getAnalytics('/AnalyticsRetention'),
  getDeposits: () => getAnalytics('/AnalyticsDeposits'),

  // --- Trading Analytics ---
  getPnL: () => getAnalytics('/AnalyticsPnL'),
  getVolume: () => getAnalytics('/AnalyticsVolume'),
  getTradingPatterns: () => getAnalytics('/AnalyticsTradingPatterns'),
  getMarginUtilization: () => getAnalytics('/AnalyticsMarginUtilization'),
  getGroupStats: () => getAnalytics('/AnalyticsGroupStats'),
  getSymbolStats: () => getAnalytics('/AnalyticsSymbolStats'),

  // --- Trader Rankings ---
  getTopTraders: () => getAnalytics('/AnalyticsTopTraders'),
  getWorstTraders: () => getAnalytics('/AnalyticsWorstTraders'),

  // --- Revenue ---
  getRevenueForecast: () => getAnalytics('/AnalyticsRevenueForecast'),

  // --- Exports ---
  getAuditExport: () => getAnalytics('/AuditExport', { responseType: 'blob' }),
  getReportExport: () => getAnalytics('/ReportExport', { responseType: 'blob' }),
};
