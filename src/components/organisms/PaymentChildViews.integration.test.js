import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const gatewaySrc = readFileSync(new URL('./PaymentGatewayView.jsx', import.meta.url), 'utf8');
const reconciliationSrc = readFileSync(new URL('./PaymentReconciliationView.jsx', import.meta.url), 'utf8');
const chargebacksSrc = readFileSync(new URL('./ChargebacksView.jsx', import.meta.url), 'utf8');
const withdrawalsSrc = readFileSync(new URL('./WithdrawalsView.jsx', import.meta.url), 'utf8');
const tableSrc = readFileSync(new URL('./AdminDataTable.jsx', import.meta.url), 'utf8');
const capabilitiesSrc = readFileSync(new URL('../../config/viewCapabilities.js', import.meta.url), 'utf8');

test('unsupported payment child views stay visible but locked from navigation', () => {
  assert.match(tableSrc, /if \(viewType === 'Withdrawals'\) \{\s*return <WithdrawalsView \/>;/);
  assert.match(tableSrc, /if \(viewType === 'Payment Gateways'\) \{\s*return <PaymentGatewayView \/>;/);
  assert.match(tableSrc, /if \(viewType === 'Reconciliation'\) \{\s*return <PaymentReconciliationView \/>;/);
  assert.match(tableSrc, /if \(viewType === 'Chargebacks'\) \{\s*return <ChargebacksView \/>;/);

  assert.match(capabilitiesSrc, /Withdrawals: capability\(\s*LOCKED_NO_API,/);
  assert.match(capabilitiesSrc, /'Payment Gateways': capability\(\s*LOCKED_NO_API,/);
  assert.match(capabilitiesSrc, /Reconciliation: capability\(\s*LOCKED_NO_API,/);
  assert.match(capabilitiesSrc, /Chargebacks: capability\(\s*LOCKED_NO_API,/);
});

test('payment child list views normalize wrapped API responses and show load errors', () => {
  assert.match(withdrawalsSrc, /normalizeArrayResponse\(res, \['withdrawals', 'requests', 'data', 'answer', 'items'\]\)/);
  assert.match(gatewaySrc, /normalizeArrayResponse\(res, \['gateways', 'gateway_status', 'statuses', 'data', 'answer', 'items', 'rows'\]\)\.map\(normalizeGatewayRow\)/);
  assert.match(reconciliationSrc, /normalizeArrayResponse\(res, \['reconciliations', 'records', 'data', 'answer', 'items', 'rows'\]\)\.map\(normalizeReconciliationRow\)/);
  assert.match(chargebacksSrc, /normalizeArrayResponse\(res, \['chargebacks', 'disputes', 'data', 'answer', 'items', 'rows'\]\)\.map\(normalizeChargebackRow\)/);

  assert.match(withdrawalsSrc, /getApiErrorMessage\(err, 'Failed to load withdrawal requests\.'\)/);
  assert.match(gatewaySrc, /getApiErrorMessage\(err, 'Failed to load payment gateways\.'\)/);
  assert.match(reconciliationSrc, /getApiErrorMessage\(err, 'Failed to load reconciliation records\.'\)/);
  assert.match(chargebacksSrc, /getApiErrorMessage\(err, 'Failed to load chargebacks\.'\)/);
});
