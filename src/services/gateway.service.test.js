import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../lib/api.js';
import { gatewayGetRoutingOptions } from './gateway.service.js';

test('LP choices use the manage_groups endpoint and preserve route metadata', async () => {
  const original = api.get;
  const data = { items: [{ name: 'ORRNN', routing_mode: 'b_book' }] };
  api.get = async (url, config) => {
    assert.equal(url, '/manager/LPRoutingOptions');
    assert.equal(config.timeout, 15000);
    return { data };
  };
  try { assert.deepEqual(await gatewayGetRoutingOptions(), data); }
  finally { api.get = original; }
});

test('API errors and malformed responses are not displayed as an empty successful list', async () => {
  const original = api.get;
  try {
    api.get = async () => ({ data: { message: 'Permission denied' } });
    await assert.rejects(gatewayGetRoutingOptions(), /Permission denied/);
    api.get = async () => ({ data: {} });
    await assert.rejects(gatewayGetRoutingOptions(), /Invalid LP routing options/);
    api.get = async () => { throw { response: { status: 403, data: { message: 'Forbidden' } } }; };
    await assert.rejects(gatewayGetRoutingOptions(), /Forbidden/);
    api.get = async () => ({ data: { items: [] } });
    assert.deepEqual(await gatewayGetRoutingOptions(), { items: [] });
  } finally { api.get = original; }
});
