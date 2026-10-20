import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../lib/api.js';
import { PaymentService, newMoneyIdempotencyKey } from './payment.service.js';

// Backend contract (read-only): the legacy money routes DepositRequestApprove,
// WithdrawalRequestApprove and PaymentRefundProcess are wrapped by
// MoneyIdempotent (main.go:1284,1288,1295), which reads the key from the
// `Idempotency-Key` header only and refuses a missing key with
// 400 IDEMPOTENCY_KEY_REQUIRED (money_idempotency.go:186-188). Keys must match
// ^[A-Za-z0-9._:-]{8,128}$ (money_idempotency.go:109); a UUIDv4 satisfies it.
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONEY_KEY_RE = /^[A-Za-z0-9._:-]{8,128}$/;

const headerOf = (config) => config?.headers?.['Idempotency-Key'];

async function withFakeTransport(fn) {
  const original = api.get;
  const calls = [];
  api.get = async (url, config) => {
    calls.push({ url, config });
    return { data: { ok: true } };
  };
  try {
    return await fn(calls);
  } finally {
    api.get = original;
  }
}

test('approveDeposit carries a fresh Idempotency-Key on every call', async () => {
  await withFakeTransport(async (calls) => {
    await PaymentService.approveDeposit(101);
    await PaymentService.approveDeposit(101);
    assert.equal(calls.length, 2);
    for (const call of calls) {
      assert.equal(call.url, '/ext-api/DepositRequestApprove');
      assert.deepEqual(call.config.params, { deposit_id: 101 });
      assert.match(headerOf(call.config), UUID_V4_RE);
    }
    assert.notEqual(headerOf(calls[0].config), headerOf(calls[1].config));
  });
});

test('approveWithdrawal carries a fresh Idempotency-Key on every call', async () => {
  await withFakeTransport(async (calls) => {
    await PaymentService.approveWithdrawal(202);
    await PaymentService.approveWithdrawal(202);
    assert.equal(calls.length, 2);
    for (const call of calls) {
      assert.equal(call.url, '/ext-api/WithdrawalRequestApprove');
      assert.deepEqual(call.config.params, { withdrawal_id: 202 });
      assert.match(headerOf(call.config), UUID_V4_RE);
    }
    assert.notEqual(headerOf(calls[0].config), headerOf(calls[1].config));
  });
});

test('processRefund carries a fresh Idempotency-Key and keeps transaction params', async () => {
  await withFakeTransport(async (calls) => {
    await PaymentService.processRefund(303, 'Duplicate charge');
    await PaymentService.processRefund(304);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, '/ext-api/PaymentRefundProcess');
    assert.deepEqual(calls[0].config.params, { transaction_id: 303, reason: 'Duplicate charge' });
    assert.deepEqual(calls[1].config.params, { transaction_id: 304 });
    assert.match(headerOf(calls[0].config), UUID_V4_RE);
    assert.match(headerOf(calls[1].config), UUID_V4_RE);
    assert.notEqual(headerOf(calls[0].config), headerOf(calls[1].config));
  });
});

test('same-click retry reuses the caller-supplied key', async () => {
  await withFakeTransport(async (calls) => {
    const idempotencyKey = newMoneyIdempotencyKey();
    await PaymentService.approveDeposit(101, { idempotencyKey });
    await PaymentService.approveDeposit(101, { idempotencyKey });
    await PaymentService.approveWithdrawal(202, { idempotencyKey });
    await PaymentService.processRefund(303, 'Duplicate charge', { idempotencyKey });
    assert.equal(calls.length, 4);
    for (const call of calls) {
      assert.equal(headerOf(call.config), idempotencyKey);
    }
  });
});

test('idempotency keys satisfy the backend money-key pattern', async () => {
  await withFakeTransport(async (calls) => {
    await PaymentService.approveDeposit(101);
    await PaymentService.approveWithdrawal(202);
    await PaymentService.processRefund(303, 'Duplicate charge');
    assert.equal(calls.length, 3);
    for (const call of calls) {
      assert.match(headerOf(call.config), UUID_V4_RE);
      assert.match(headerOf(call.config), MONEY_KEY_RE);
    }
  });
});

test('newMoneyIdempotencyKey mints unique UUIDv4 keys (never reused across clicks)', () => {
  const seen = new Set();
  for (let i = 0; i < 50; i += 1) {
    const key = newMoneyIdempotencyKey();
    assert.match(key, UUID_V4_RE);
    assert.match(key, MONEY_KEY_RE);
    assert.ok(!seen.has(key), 'idempotency key must never repeat');
    seen.add(key);
  }
});
