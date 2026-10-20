// SUI-A2 (REVIEW-B C1/C3): funding validation errors surface at the top
// level, and the deposit form uses app validation + per-click idempotency.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildFundingRequest, fundingErrorsToMessage } from './legacyConfig.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const readSource = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

test('SUI-A2/C1: fundingErrorsToMessage joins in field order without empties', () => {
  assert.equal(
    fundingErrorsToMessage({ amount: 'Bad amount.', login: 'Bad login.' }),
    'Bad login. Bad amount.'
  );
  assert.equal(fundingErrorsToMessage({}), '');
  assert.equal(fundingErrorsToMessage(null), '');
  assert.equal(fundingErrorsToMessage({ login: '', amount: undefined, currency: null }), '');
});

test('SUI-A2/C1: an invalid login produces the top-level login error', () => {
  const { payload, errors } = buildFundingRequest('deposit', 'not-a-login', {
    amount: '10', currency: 'USD', note: '',
  });
  assert.equal(payload, null);
  assert.equal(errors.login, 'A valid account login is required.');
  assert.match(fundingErrorsToMessage(errors), /valid account login/);
});

test('SUI-A2/C1: FundingPopup routes validation errors to top-level setError', () => {
  const popup = readSource('components/RIGHTCLICKJPOPUPS/FundingPopup.jsx');
  assert.match(
    popup,
    /setError\(fundingErrorsToMessage\(nextErrors\)\)/,
    'validation failure must set the top-level error, not just field errors'
  );
  assert.match(
    popup,
    /error=\{errors\.amount\}/,
    'the login error must no longer render under Amount'
  );
  assert.ok(!popup.match(/error=\{errors\.amount \|\| errors\.login\}/));
});

test('SUI-A2/C3: New Deposit form uses app validation, not native tooltips', () => {
  const view = readSource('components/organisms/DepositsView.jsx');
  assert.match(view, /<form onSubmit=\{handleSubmit\} noValidate/);
});

test('SUI-A2/C3: deposit approve mints one key per click and passes it through', () => {
  const view = readSource('components/organisms/DepositsView.jsx');
  assert.match(view, /const idempotencyKey = newMoneyIdempotencyKey\(\);/);
  assert.match(view, /await PaymentService\.approveDeposit\(row\.id, \{ idempotencyKey \}\)/);
});
