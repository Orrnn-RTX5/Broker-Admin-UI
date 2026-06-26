import { test } from 'node:test';
import assert from 'node:assert/strict';

let importId = 0;

const installWindowConfig = (config = {}) => {
  globalThis.window = {
    __RTX5_RUNTIME_CONFIG__: config,
  };
};

const importFreshBackendTarget = () => import(`./backendTarget.js?case=${++importId}`);

test('resolveBrokerExtApiUrl does not synthesize https host:8091 from web server_url', async () => {
  installWindowConfig({ BACKEND_TARGET: 'web' });
  const { resolveBrokerBackendUrl, resolveBrokerExtApiUrl } = await importFreshBackendTarget();
  const broker = {
    broker_id: 'demo',
    server_url: 'https://203.0.113.10:443',
    server_ip: '203.0.113.10',
  };

  const backendUrl = resolveBrokerBackendUrl(broker, broker.server_url);

  assert.equal(backendUrl, 'https://203.0.113.10:443');
  assert.equal(resolveBrokerExtApiUrl(broker, backendUrl), '');
});

test('resolveBrokerExtApiUrl prefers explicit ext fields and infers HTTP for bare 8091 ext hosts', async () => {
  installWindowConfig({ BACKEND_TARGET: 'web' });
  const { resolveBrokerExtApiUrl } = await importFreshBackendTarget();

  assert.equal(
    resolveBrokerExtApiUrl({
      broker_id: 'demo',
      server_url: 'https://203.0.113.10:443',
      web_ext_api_url: '203.0.113.10:8091',
    }),
    'http://203.0.113.10:8091'
  );
});

test('resolveBrokerExtApiUrl uses discovered services domain as direct ext API origin', async () => {
  installWindowConfig({ BACKEND_TARGET: 'web' });
  const { resolveBrokerExtApiUrl } = await importFreshBackendTarget();

  assert.equal(
    resolveBrokerExtApiUrl({
      broker_id: 'myprop-trade',
      services_domain: 'services.myprop.trade',
      server_url: 'https://services.myprop.trade',
    }),
    'https://services.myprop.trade'
  );
});

test('desktop backend uses discovered services domain before raw IP fallback', async () => {
  installWindowConfig({ BACKEND_TARGET: 'desktop' });
  const { resolveBrokerBackendUrl } = await importFreshBackendTarget();

  assert.equal(
    resolveBrokerBackendUrl({
      broker_id: 'myprop',
      services_domain: 'services.myprop.trade',
      server_url: 'https://services.myprop.trade',
      server_ip: '185.204.168.202',
      server_port: 443,
    }),
    'https://services.myprop.trade'
  );
});

test('desktop backend keeps service URL when stale normalized backend_url contains raw IP', async () => {
  installWindowConfig({ BACKEND_TARGET: 'desktop' });
  const { resolveBrokerBackendUrl } = await importFreshBackendTarget();

  assert.equal(
    resolveBrokerBackendUrl({
      broker_id: 'myprop',
      server_url: 'https://services.myprop.trade',
      backend_url: 'https://185.204.168.202',
      server_ip: '185.204.168.202',
      server_port: 443,
    }),
    'https://services.myprop.trade'
  );
});

test('runtime VITE_API_URL alias can identify the current web deployment', async () => {
  installWindowConfig({
    BACKEND_TARGET: 'web',
    BROKER_ID: 'myprop',
    VITE_API_URL: 'https://services.myprop.trade',
  });
  const { resolveBrokerBackendUrl } = await importFreshBackendTarget();

  assert.equal(
    resolveBrokerBackendUrl({
      broker_id: 'myprop',
      server_url: 'https://stale.example.com',
    }),
    'https://services.myprop.trade'
  );
});
