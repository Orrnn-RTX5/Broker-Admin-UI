// SUI-A2(a): the funding POST must resolve through the same-origin /ext-api
// proxy namespace via config (buildExtApiUrl in src/config/endpoints.js,
// applied by the api.js interceptor), never a hardcoded host.
// Run with: node --test src/services/payment.service.extApi.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./payment.service.js', import.meta.url), 'utf8');

test('deposit/withdrawal requests post through the /ext-api proxy namespace', () => {
  assert.match(src, /api\.post\('\/ext-api\/DepositRequestCreate'/);
  assert.match(src, /api\.post\('\/ext-api\/WithdrawalRequestCreate'/);
});

test('no absolute host or API_HOST_EXT literal in payment URLs', () => {
  assert.doesNotMatch(src, /https?:\/\//);
  assert.doesNotMatch(src, /API_HOST_EXT/);
});
