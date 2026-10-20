// SUI-A2(a): the funding POST must resolve through the same-origin /ext-api
// proxy namespace via config, never a hardcoded host.
// Run with: node --test src/services/payment.service.extApi.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { api } from '../lib/api.js';
import { PaymentService } from './payment.service.js';

const src = readFileSync(new URL('./payment.service.js', import.meta.url), 'utf8');

async function withFakePost(fn) {
  const original = api.post;
  const calls = [];
  api.post = async (url, data) => {
    calls.push({ url, data });
    return { data: { ok: true } };
  };
  try {
    return await fn(calls);
  } finally {
    api.post = original;
  }
}

test('deposit/withdrawal requests post through the /ext-api proxy namespace', async () => {
  await withFakePost(async (calls) => {
    await PaymentService.createDeposit({ login: 990701, amount: 10, currency: 'USD' });
    await PaymentService.createWithdrawal({ login: 990701, amount: 10, currency: 'USD' });
    assert.deepEqual(
      calls.map((call) => call.url),
      ['/ext-api/DepositRequestCreate', '/ext-api/WithdrawalRequestCreate']
    );
    for (const call of calls) {
      assert.ok(!/^https?:\/\//i.test(call.url), `resolved URL must stay same-origin: ${call.url}`);
    }
  });
});

test('no absolute host or API_HOST_EXT literal in payment URLs', () => {
  assert.doesNotMatch(src, /https?:\/\//);
  assert.doesNotMatch(src, /API_HOST_EXT/);
});
