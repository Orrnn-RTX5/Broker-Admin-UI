// SUI-A1: per-click Idempotency-Key pass-through pins for the two views owned
// by commit 4669614 (WithdrawalsView, PaymentGatewayView). DepositsView is
// pinned separately in src/utils/legacyConfig.funding.test.js (SUI-A2/C3,
// key lines introduced by 500a055). Source-read pins follow that precedent:
// JSX views cannot run under node --test without a DOM, so these tests pin
// the contract that each click handler mints one key via
// newMoneyIdempotencyKey() inside the handler (never at module level, never
// reused across clicks) and passes it as `{ idempotencyKey }` to the
// MoneyIdempotent-wrapped service call.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const readSource = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

test('SUI-A1: withdrawal approve mints one key per click and passes it through', () => {
  const view = readSource('components/organisms/WithdrawalsView.jsx');
  assert.match(
    view,
    /import \{ PaymentService, newMoneyIdempotencyKey \} from '\.\.\/\.\.\/services\/payment\.service';/,
    'WithdrawalsView must import the per-click key minter'
  );
  assert.match(
    view,
    /const idempotencyKey = newMoneyIdempotencyKey\(\);/,
    'withdrawal approve must mint one idempotency key per click'
  );
  assert.match(
    view,
    /await PaymentService\.approveWithdrawal\(row\.id, \{ idempotencyKey \}\)/,
    'withdrawal approve must pass the click key through to the service'
  );
});

test('SUI-A1: refund submit mints one key per click and passes it through', () => {
  const view = readSource('components/organisms/PaymentGatewayView.jsx');
  assert.match(
    view,
    /import \{ PaymentService, newMoneyIdempotencyKey \} from '\.\.\/\.\.\/services\/payment\.service';/,
    'PaymentGatewayView must import the per-click key minter'
  );
  assert.match(
    view,
    /const idempotencyKey = newMoneyIdempotencyKey\(\);/,
    'refund submit must mint one idempotency key per click'
  );
  assert.match(
    view,
    /await PaymentService\.processRefund\(parseInt\(form\.transaction_id\), form\.reason \|\| undefined, \{ idempotencyKey \}\)/,
    'refund submit must pass the click key through to the service'
  );
});
