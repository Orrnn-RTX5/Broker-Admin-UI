import { api } from '../lib/api';

export const PaymentService = {
  // --- PAYMENT METHODS ---
  getMethodList: async (params = {}) => {
    const res = await api.get('/ext-api/PaymentMethodList', { params });
    return res.data;
  },
  createMethod: async (data) => {
    const res = await api.post('/ext-api/PaymentMethodCreate', data);
    return res.data;
  },
  updateMethod: async (data) => {
    const res = await api.post('/ext-api/PaymentMethodUpdate', data);
    return res.data;
  },
  deleteMethod: async (methodId) => {
    const res = await api.get('/ext-api/PaymentMethodDelete', { params: { method_id: methodId } });
    return res.data;
  },

  // --- DEPOSIT REQUESTS ---
  getDepositList: async (params = {}) => {
    const res = await api.get('/ext-api/DepositRequestList', { params });
    return res.data;
  },
  createDeposit: async (data) => {
    const res = await api.post('/ext-api/DepositRequestCreate', data);
    return res.data;
  },
  approveDeposit: async (depositId) => {
    const res = await api.get('/ext-api/DepositRequestApprove', { params: { deposit_id: depositId } });
    return res.data;
  },
  rejectDeposit: async (depositId, reason) => {
    const params = { deposit_id: depositId };
    if (reason) params.reason = reason;
    const res = await api.get('/ext-api/DepositRequestReject', { params });
    return res.data;
  },

  // --- WITHDRAWAL REQUESTS ---
  getWithdrawalList: async (params = {}) => {
    const res = await api.get('/ext-api/WithdrawalRequestList', { params });
    return res.data;
  },
  createWithdrawal: async (data) => {
    const res = await api.post('/ext-api/WithdrawalRequestCreate', data);
    return res.data;
  },
  approveWithdrawal: async (withdrawalId) => {
    const res = await api.get('/ext-api/WithdrawalRequestApprove', { params: { withdrawal_id: withdrawalId } });
    return res.data;
  },
  rejectWithdrawal: async (withdrawalId, reason) => {
    const params = { withdrawal_id: withdrawalId };
    if (reason) params.reason = reason;
    const res = await api.get('/ext-api/WithdrawalRequestReject', { params });
    return res.data;
  },
  holdWithdrawal: async (withdrawalId) => {
    const res = await api.get('/ext-api/WithdrawalRequestHold', { params: { withdrawal_id: withdrawalId } });
    return res.data;
  },

  // --- TRANSACTION HISTORY ---
  getTransactionHistory: async (params = {}) => {
    const res = await api.get('/ext-api/TransactionHistoryList', { params });
    return res.data;
  },

  // --- GATEWAY ---
  getGatewayStatusList: async () => {
    const res = await api.get('/ext-api/PaymentGatewayStatusList');
    return res.data;
  },
  toggleGateway: async (gatewayId, enabled) => {
    const res = await api.get('/ext-api/PaymentGatewayToggle', { params: { gateway_id: gatewayId, enabled } });
    return res.data;
  },
  processCallback: async (params) => {
    const res = await api.get('/ext-api/PaymentCallbackProcess', { params });
    return res.data;
  },
  processRefund: async (transactionId, reason) => {
    const params = { transaction_id: transactionId };
    if (reason) params.reason = reason;
    const res = await api.get('/ext-api/PaymentRefundProcess', { params });
    return res.data;
  },

  // --- RECONCILIATION ---
  runReconciliation: async (gatewayId, date) => {
    const res = await api.get('/ext-api/PaymentReconciliationRun', { params: { gateway_id: gatewayId, date } });
    return res.data;
  },
  getReconciliationList: async (matched) => {
    const params = {};
    if (matched !== undefined) params.matched = matched;
    const res = await api.get('/ext-api/ReconciliationList', { params });
    return res.data;
  },
  matchReconciliation: async (id, depositId) => {
    const res = await api.post('/ext-api/ReconciliationMatch', { id, deposit_id: depositId });
    return res.data;
  },

  // --- CHARGEBACKS ---
  getChargebackList: async (status) => {
    const params = {};
    if (status) params.status = status;
    const res = await api.get('/ext-api/ChargebackList', { params });
    return res.data;
  },
  createChargeback: async (data) => {
    const res = await api.post('/ext-api/ChargebackCreate', data);
    return res.data;
  },
  resolveChargeback: async (chargebackId, status, resolution) => {
    const params = { chargeback_id: chargebackId, status };
    if (resolution) params.resolution = resolution;
    const res = await api.get('/ext-api/ChargebackResolve', { params });
    return res.data;
  },
};
