import { api } from '../lib/api';

const EXT = '/ext-api';
const toUnix = (s) => s ? Math.floor(new Date(s).getTime() / 1000) : undefined;

export const ReportsService = {
  // --- Data Exports ---
  getReportExport: (report, format, from, to) =>
    api.get(`${EXT}/ReportExport`, {
      params: { report, format, ...(from ? { from: toUnix(from) } : {}), ...(to ? { to: toUnix(to) } : {}) },
      responseType: format === 'csv' ? 'blob' : 'json',
    }).then(r => r.data),

  getAuditExport: (from, to, format, manager_login) =>
    api.get(`${EXT}/AuditExport`, {
      params: { from: toUnix(from), to: toUnix(to), format, ...(manager_login ? { manager_login } : {}) },
      responseType: format === 'csv' ? 'blob' : 'json',
    }).then(r => r.data),

  getKYCReport: (verified) =>
    api.get(`${EXT}/KYCReport`, { params: { verified } }).then(r => r.data),

  // --- Regulatory Reports ---
  getTradeReportEMIR: (from, to) =>
    api.get(`${EXT}/TradeReportEMIR`, { params: { from: toUnix(from), to: toUnix(to) } }).then(r => r.data),

  getTradeReportMiFID: (from, to) =>
    api.get(`${EXT}/TradeReportMiFID`, { params: { from: toUnix(from), to: toUnix(to) } }).then(r => r.data),

  getClientMoneyReconciliation: (date) =>
    api.get(`${EXT}/ClientMoneyReconciliation`, { params: { date: toUnix(date) } }).then(r => r.data),

  getTransactionReportDaily: (date) =>
    api.get(`${EXT}/TransactionReportDaily`, { params: { date: toUnix(date) } }).then(r => r.data),

  generateTransactionReport: (type, from, to) =>
    api.get(`${EXT}/TransactionReportGenerate`, { params: { type, from: toUnix(from), to: toUnix(to) } }).then(r => r.data),

  getBestExecutionReport: (from, to, login) =>
    api.get(`${EXT}/BestExecutionReport`, { params: { from: toUnix(from), to: toUnix(to), ...(login ? { login } : {}) } }).then(r => r.data),

  // --- Complaints ---
  listComplaints: (params = {}) =>
    api.get(`${EXT}/ComplaintList`, { params }).then(r => r.data),

  createComplaint: (body) =>
    api.post(`${EXT}/ComplaintCreate`, body).then(r => r.data),

  updateComplaint: (body) =>
    api.post(`${EXT}/ComplaintUpdate`, body).then(r => r.data),

  resolveComplaint: (complaint_id, resolution) =>
    api.get(`${EXT}/ComplaintResolve`, { params: { complaint_id, ...(resolution ? { resolution } : {}) } }).then(r => r.data),
};
