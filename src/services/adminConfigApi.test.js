/* global Buffer */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const utilsUrl = new URL('../utils/legacyConfig.js', import.meta.url).href;
const source = (await readFile(new URL('./adminConfigApi.js', import.meta.url), 'utf8'))
  .replace("import { api } from '../lib/api.js';", 'const api={};')
  .replace("import { PaymentService } from './payment.service.js';", 'const PaymentService={};')
  .replace("from '../utils/legacyConfig.js';", `from '${utilsUrl}';`);
const { createAdminConfigApi } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const REV = 'lcr1:0123456789abcdef01234567';

const fakeClient = (data) => {
  const calls = [];
  const record = (method) => async (url, body, config) => {
    calls.push({ method, url, body, config });
    return { data };
  };
  return { calls, get: record('get'), patch: record('patch'), post: record('post') };
};

test('account trading goes through the guarded canonical PATCH with expected_revision', async () => {
  const client = fakeClient({ Login: 1001, Leverage: 500, AccountMode: 'netting', revision: REV });
  const api = createAdminConfigApi(client, {});
  const saved = await api.updateAccountTrading(1001, { leverage: 500 }, REV, 'client request');
  assert.equal(client.calls[0].method, 'patch');
  assert.equal(client.calls[0].url, '/api/v1/manager/accounts/1001');
  assert.deepEqual(client.calls[0].body, { leverage: 500, expected_revision: REV, reason: 'client request' });
  assert.equal(client.calls[0].config._noRetry, true, 'a guarded write is never retried blindly');
  assert.equal(saved.revision, REV);
  assert.equal(saved.accountMode, 'netting');

  const legacy = fakeClient({ Login: 1001 });
  await createAdminConfigApi(legacy, {}).updateAccountTrading(1001, { leverage: 50 }, '');
  assert.equal('expected_revision' in legacy.calls[0].body, false, 'older backend: no revision, legacy write');
});

test('account config reads UserDetails; creation uses the canonical account route', async () => {
  const client = fakeClient({ Login: 7, Group: 'g', Leverage: 100, AccountMode: 'hedging', revision: REV });
  const api = createAdminConfigApi(client, {});
  const config = await api.getAccountConfig(7);
  assert.deepEqual(client.calls[0], { method: 'get', url: '/manager/UserDetails', body: { params: { login: 7 } }, config: undefined });
  assert.equal(config.revision, REV);
  await api.createCustomerAccount({ Group: 'g', master_pass: 'Secret-123' });
  assert.equal(client.calls[1].method, 'post');
  assert.equal(client.calls[1].url, '/api/v1/manager/accounts');
});

test('funding creates deposit / withdrawal requests through PaymentService only', async () => {
  const seen = [];
  const payments = {
    createDeposit: async (p) => { seen.push(['deposit', p]); return { id: 1 }; },
    createWithdrawal: async (p) => { seen.push(['withdrawal', p]); return { id: 2 }; },
  };
  const client = fakeClient({});
  const api = createAdminConfigApi(client, payments);
  await api.requestFunding('deposit', { login: 1, amount: 5, currency: 'USD' });
  await api.requestFunding('withdrawal', { login: 1, amount: 5, currency: 'USD' });
  await assert.rejects(api.requestFunding('credit', {}), /Unsupported/);
  assert.deepEqual(seen.map(([kind]) => kind), ['deposit', 'withdrawal']);
  assert.equal(client.calls.length, 0, 'no direct balance route is called');
});

test('account mode edits are rejected locally without a write', async()=> { const client=fakeClient({}); const api=createAdminConfigApi(client,{}); for(const key of ['AccountMode','accountMode','account_mode','marginMode','margin_mode']) await assert.rejects(api.updateAccountTrading(1,{[key]:'netting'},REV),/fixed at creation/); assert.equal(client.calls.length,0); });
