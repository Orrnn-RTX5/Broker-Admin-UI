// SUI-A2(a): the funding POST must resolve through the same-origin /ext-api
// proxy namespace via config (buildExtApiUrl in src/config/endpoints.js,
// applied by the api.js interceptor), never a hardcoded host. Positive URL
// assertions execute below; the negative hardcoding guard stays source-grep.
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
    assert.deepStrictEqual(
      calls.map((call) => call.url),
      ['/ext-api/DepositRequestCreate', '/ext-api/WithdrawalRequestCreate']
    );
    assert.deepStrictEqual(calls[0].data, { login: 990701, amount: 10, currency: 'USD' });
    assert.deepStrictEqual(calls[1].data, { login: 990701, amount: 10, currency: 'USD' });
    for (const call of calls) {
      assert.ok(!/^https?:\/\//i.test(call.url), `resolved URL must stay same-origin: ${call.url}`);
    }
  });
});

test('funding POST rejections propagate fail-closed, never resolve silently', async () => {
  const original = api.post;
  api.post = async () => {
    throw new Error('network down');
  };
  try {
    await assert.rejects(
      PaymentService.createDeposit({ login: 990701, amount: 10, currency: 'USD' }),
      (error) => error?.message === 'network down'
    );
    await assert.rejects(
      PaymentService.createWithdrawal({ login: 990701, amount: 10, currency: 'USD' }),
      (error) => error?.message === 'network down'
    );
  } finally {
    api.post = original;
  }
});

test('no absolute host or API_HOST_EXT literal in payment URLs', () => {
  assert.doesNotMatch(src, /https?:\/\//);
  assert.doesNotMatch(src, /API_HOST_EXT/);
});

test('funding POST URLs stay same-origin through the ext-api resolver in production web', async () => {
  // End-to-end pin for SUI-A2(a): PaymentService emits /ext-api URLs and the
  // api.js interceptor resolves them via buildExtApiUrl. In production web
  // with a broker ext field configured, the old resolver returned an absolute
  // cross-origin host; it must stay on the same-origin proxy namespace.
  const previousWindow = globalThis.window;
  const previousSessionStorage = globalThis.sessionStorage;
  globalThis.window = {
    __RTX5_RUNTIME_CONFIG__: { BACKEND_TARGET: 'web', USE_DEV_PROXY: 'false' },
    location: { protocol: 'https:' },
  };
  const store = new Map(Object.entries({
    broker_info: JSON.stringify({
      broker_id: 'demo-broker',
      backend_url: 'https://backend-host.example',
      web_ext_api_url: 'ext-host.example:8091',
    }),
  }));
  globalThis.sessionStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  try {
    await withFakePost(async (calls) => {
      await PaymentService.createDeposit({ login: 990701, amount: 10, currency: 'USD' });
      await PaymentService.createWithdrawal({ login: 990701, amount: 10, currency: 'USD' });
      const endpoints = await import(`../config/endpoints.js?pay-case=${Date.now()}`);
      assert.equal(calls.length, 2);
      for (const call of calls) {
        assert.equal(endpoints.buildExtApiUrl(call.url), call.url);
        assert.doesNotMatch(endpoints.buildExtApiUrl(call.url), /^https?:\/\//);
      }
    });
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousSessionStorage === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = previousSessionStorage;
  }
});
