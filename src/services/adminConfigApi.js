import { api } from '../lib/api.js';
import { PaymentService } from './payment.service.js';
import { normalizeAccountConfig, withExpectedRevision } from '../utils/legacyConfig.js';

// Admin writes that go through the G8-guarded manager-backend paths.
//   - Account trading configuration (leverage, account mode) uses the Bearer
//     canonical PATCH /api/v1/manager/accounts/{login} with expected_revision.
//   - Customer account creation uses the canonical POST /api/v1/manager/accounts.
//   - Funding creates a deposit / withdrawal REQUEST in the existing ledger
//     workflow (the same PaymentService calls DepositsView / WithdrawalsView
//     use); approval there posts the ledger transaction. No direct balance edit.
export const createAdminConfigApi = (client = api, payments = PaymentService) => ({
  getAccountConfig: async (login) => {
    const res = await client.get('/manager/UserDetails', { params: { login } });
    return normalizeAccountConfig(res.data);
  },

  updateAccountTrading: async (login, changes, revision, reason) => {
    const body = withExpectedRevision({ ...changes }, revision);
    if (reason) body.reason = String(reason).slice(0, 500);
    const res = await client.patch(`/api/v1/manager/accounts/${encodeURIComponent(String(login))}`, body, { _noRetry: true });
    return normalizeAccountConfig(res.data);
  },

  createCustomerAccount: async (payload) => {
    const res = await client.post('/api/v1/manager/accounts', payload, { _noRetry: true });
    return res.data;
  },

  requestFunding: async (kind, payload) => {
    if (kind === 'deposit') return payments.createDeposit(payload);
    if (kind === 'withdrawal') return payments.createWithdrawal(payload);
    throw new TypeError(`Unsupported funding kind: ${kind}`);
  },
});

export const AdminConfigApi = createAdminConfigApi();

export default AdminConfigApi;
