import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRelayConfig, relayFormFromConfig } from './fixRelayConfig.js';

const config = { enabled: true, host: 'relay.test', port: 15100, sender_comp_id: 'BROKER', target_comp_id: 'RELAY', username: 'broker', symbols: ['EURUSD'] };
test('loading configuration never copies a returned password into the form', () => {
  assert.equal(relayFormFromConfig({ ...config, password: 'must-not-render' }).password, '');
  assert.equal(relayFormFromConfig().enabled, false);
  assert.equal(relayFormFromConfig().use_tls, true);
});
test('blank password preserves saved credential; replacement is sent exactly', () => {
  const form = relayFormFromConfig(config);
  assert.equal(Object.hasOwn(buildRelayConfig(form, true), 'password'), false);
  assert.throws(() => buildRelayConfig(form, false), /password/);
  assert.equal(buildRelayConfig({ ...form, password: ' exact ' }, true).password, ' exact ');
});
test('explicit symbols and valid TCP port are required before saving enabled source', () => {
  const form = relayFormFromConfig(config);
  for (const port of ['0', '65536', '1.5', 'abc']) assert.throws(() => buildRelayConfig({ ...form, port }, true), /port/);
  assert.throws(() => buildRelayConfig({ ...form, symbols: '' }, true), /symbol/);
  assert.throws(() => buildRelayConfig({ ...form, symbols: 'EURUSD,*' }, true), /wildcard/);
  assert.deepEqual(buildRelayConfig({ ...form, symbols: 'EURUSD, EURUSD, XAUUSD' }, true).symbols, ['EURUSD', 'XAUUSD']);
});
