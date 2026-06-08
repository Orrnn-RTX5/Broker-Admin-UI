import { test } from 'node:test';
import assert from 'node:assert/strict';

let importId = 0;

const installStorage = (values = {}) => {
  const store = new Map(Object.entries(values));
  globalThis.sessionStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
};

const installWindow = (config = {}) => {
  globalThis.window = {
    __RTX5_RUNTIME_CONFIG__: config,
    location: { protocol: 'https:' },
  };
};

const importFreshEndpoints = () => import(`./endpoints.js?case=${++importId}`);

test('dynamic endpoints do not derive ext host from discovered HTTPS 443 server_url', async () => {
  installWindow({ BACKEND_TARGET: 'web' });
  installStorage({
    broker_info: JSON.stringify({
      broker_id: 'demo',
      server_url: 'https://203.0.113.20:443',
      server_ip: '203.0.113.20',
    }),
  });

  const endpoints = await importFreshEndpoints();

  assert.equal(endpoints.API_HOST, 'https://203.0.113.20:443');
  assert.equal(endpoints.API_HOST_EXT, '');
  assert.equal(endpoints.buildExtApiUrl('/SessionOverrideSet'), '/ext-api/SessionOverrideSet');
});

test('dynamic endpoints use explicit broker ext API fields when supplied', async () => {
  installWindow({ BACKEND_TARGET: 'web' });
  installStorage({
    broker_info: JSON.stringify({
      broker_id: 'demo',
      server_url: 'https://203.0.113.21:443',
      server_ip: '203.0.113.21',
      web_ext_api_url: '203.0.113.21:8091',
    }),
  });

  const endpoints = await importFreshEndpoints();

  assert.equal(endpoints.API_HOST_EXT, 'http://203.0.113.21:8091');
  assert.equal(
    endpoints.buildExtApiUrl('/SessionOverrideSet'),
    'http://203.0.113.21:8091/SessionOverrideSet'
  );
});
