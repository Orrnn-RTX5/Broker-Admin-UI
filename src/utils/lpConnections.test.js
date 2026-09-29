import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyConnection, emptyCredentials, saveConnectionPayload, connectionResult, connectionError } from './lpConnections.js';
import { redactForLog } from '../lib/logRedaction.js';
const config = () => ({ ...emptyConnection(), id: 'primary-fix', name: 'Primary', revision: 3 });
const credentials = () => ({ quote: emptyCredentials(), trade: emptyCredentials() });
test('omitted credentials retain saved values and carry expected revision', () => {
  const payload = saveConnectionPayload(config(), credentials());
  assert.equal(payload.expected_revision, 3);
  assert.equal('quote_credentials' in payload, false);
  assert.equal('trade_credentials' in payload, false);
});
test('partial replacements and supplied edits are rejected', () => {
  const creds = credentials(); creds.trade.password = 'synthetic';
  assert.throws(() => saveConnectionPayload(config(), creds), /replacement requires/);
  assert.throws(() => saveConnectionPayload({ ...config(), origin: 'rtx_supplied' }, credentials()), /enable or disable only/);
});
test('all credential fields are redacted as one subtree', () => {
  const value = redactForLog({ quote_credentials: { sender_comp_id:'synthetic', username:'synthetic', account_id:'synthetic', password:'synthetic' }, trade_credentials:{ sender_sub_id:'synthetic' } });
  assert.deepEqual(value,{ quote_credentials:'[REDACTED]',trade_credentials:'[REDACTED]' });
});
test('saved with failed runtime remains saved and does not imply connected', () => {
  assert.match(connectionResult({ saved:true,saved_revision:4,applied_revision:3,connection_error_code:'CONNECTION_NOT_READY' }), /Saved revision 4.*Runtime revision 3.*requires attention/);
  assert.match(connectionResult({ test_kind:'connection_logon',orders_submitted:false }), /No orders submitted/);
  assert.doesNotMatch(connectionResult({ test_kind:'connection_logon',orders_submitted:true }), /No orders/);
});
test('revision conflicts require refresh and raw errors never reach UI', () => {
  assert.match(connectionError({response:{data:{error_code:'CONFIGURATION_CONFLICT'}}}),/Refresh/);
  assert.doesNotMatch(connectionError({response:{data:{error_code:'secret text',error:'secret text'}}}),/secret/);
});

test('atomic apply refusal distinguishes retained settings from uncertain commit', () => {
  assert.match(connectionError({response:{data:{error_code:'CONFIGURATION_APPLY_REJECTED'}}}), /not saved.*Previous saved settings/);
  assert.match(connectionError({response:{data:{error_code:'CONFIGURATION_RUNTIME_UNAVAILABLE'}}}), /not saved.*unavailable/);
  assert.match(connectionError({response:{data:{error_code:'CONFIGURATION_COMMIT_UNCERTAIN'}}}), /uncertain.*Refresh/);
});