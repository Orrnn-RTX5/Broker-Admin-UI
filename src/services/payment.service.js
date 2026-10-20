import { api } from '../lib/api.js';

// One UUIDv4 idempotency key per user click for the MoneyIdempotent-wrapped
// money routes (DepositRequestApprove, WithdrawalRequestApprove,
// PaymentRefundProcess). The backend reads the key from the `Idempotency-Key`
// header only and refuses a missing key with 400 IDEMPOTENCY_KEY_REQUIRED, so
// every approve/refund call below carries one. Callers mint the key at click
// time and pass it as `{ idempotencyKey }` so a same-click retry reuses the
// key; when no key is supplied the service mints one per call (never cached
// at module level, never reused across clicks).
export const newMoneyIdempotencyKey = () => {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const withIdempotencyKey = (options) => ({
  headers: { 'Idempotency-Key': options?.idempotencyKey || newMoneyIdempotencyKey() },
});

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
  approveDeposit: async (depositId, options) => {
    const res = await api.get('/ext-api/DepositRequestApprove', { params: { deposit_id: depositId }, ...withIdempotencyKey(options) });
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
  approveWithdrawal: async (withdrawalId, options) => {
    const res = await api.get('/ext-api/WithdrawalRequestApprove', { params: { withdrawal_id: withdrawalId }, ...withIdempotencyKey(options) });
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
  processRefund: async (transactionId, reason, options) => {
    const params = { transaction_id: transactionId };
    if (reason) params.reason = reason;
    const res = await api.get('/ext-api/PaymentRefundProcess', { params, ...withIdempotencyKey(options) });
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
