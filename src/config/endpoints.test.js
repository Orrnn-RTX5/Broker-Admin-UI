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

test('configured direct broker keeps login and flat manager paths inside the local proxy namespace', async () => {
  installWindow({ BACKEND_TARGET: 'web', USE_DEV_PROXY: 'true', DIRECT_MANAGER_ORIGINS: 'https://broker.example' });
  installStorage({ broker_info: JSON.stringify({ broker_id: 'demo', backend_url: 'https://broker.example' }) });
  const endpoints = await importFreshEndpoints();
  assert.equal(endpoints.buildManagerApiUrl('/api/v2/admin/login'), '/manager/api/v2/admin/login');
  assert.equal(endpoints.buildManagerApiUrl('/manager/api/v2/auth/me'), '/manager/api/v1/manager/auth/me');
  assert.equal(endpoints.buildManagerApiUrl('/api/v2/auth/login'), '/manager/api/v1/manager/auth/login');
  assert.equal(endpoints.buildManagerApiUrl('/api/v1/auth/refresh'), '/manager/api/v1/manager/auth/refresh');
  assert.equal(endpoints.buildManagerApiUrl('/manager/GroupList'), '/manager/GroupList');
  sessionStorage.setItem('broker_info', JSON.stringify({ broker_id: 'other', backend_url: 'https://other.example' }));
  assert.equal(endpoints.buildManagerApiUrl('/api/v2/admin/login'), '/manager/api/v2/admin/login');
  assert.equal(endpoints.buildManagerApiUrl('/api/v2/auth/me'), '/manager/api/v2/auth/me');
});

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

test('dynamic endpoints call discovered service-domain ext endpoints without ext-api prefix', async () => {
  installWindow({ BACKEND_TARGET: 'web' });
  installStorage({
    broker_info: JSON.stringify({
      broker_id: 'myprop-trade',
      server_url: 'https://services.myprop.trade',
      services_domain: 'services.myprop.trade',
      server_ip: '185.204.168.202',
    }),
  });

  const endpoints = await importFreshEndpoints();

  assert.equal(endpoints.API_HOST_EXT, 'https://services.myprop.trade');
  assert.equal(
    endpoints.buildExtApiUrl('/ext-api/ServerStatus'),
    'https://services.myprop.trade/ServerStatus'
  );
});

test('local web dev proxy keeps manager login on the Vite origin', async () => {
  const cookies = {};
  globalThis.document = {
    get cookie() {
      return Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
    },
    set cookie(value) {
      const [pair] = String(value).split(';');
      const separator = pair.indexOf('=');
      const key = pair.slice(0, separator).trim();
      const cookieValue = pair.slice(separator + 1);
      if (String(value).includes('Max-Age=0')) delete cookies[key];
      else cookies[key] = cookieValue;
    },
  };
  installWindow({
    BACKEND_TARGET: 'web',
    USE_DEV_PROXY: 'true',
  });
  globalThis.window.location = {
    protocol: 'http:',
    hostname: 'localhost',
    host: 'localhost:5174',
    origin: 'http://localhost:5174',
  };
  installStorage({
    broker_info: JSON.stringify({
      broker_id: 'gta_broker',
      server: 'broker-server-2',
      backend_url: 'https://services.growtradingacademy.com',
    }),
  });

  const endpoints = await importFreshEndpoints();

  assert.equal(endpoints.shouldUseLocalDevProxy(), true);
  assert.equal(endpoints.API_HOST, 'https://services.growtradingacademy.com');
  assert.equal(
    endpoints.buildManagerApiUrl('/api/v2/admin/login'),
    '/manager/api/v2/admin/login'
  );
  assert.equal(
    endpoints.buildExtApiUrl('/SessionOverrideSet'),
    '/ext-api/SessionOverrideSet'
  );
  assert.match(document.cookie, /rtx5_dev_backend=/);
  assert.match(decodeURIComponent(document.cookie), /https:\/\/services\.growtradingacademy\.com/);
});

test('GTA web services host keeps manager API calls on the manager proxy namespace', async () => {
  installWindow({
    BACKEND_TARGET: 'web',
    BROKER_ID: 'gta_broker',
    API_HOST: 'https://services.growtradingacademy.com',
    DEFAULT_MT5_SERVER: 'broker-server-2',
  });
  installStorage({
    broker_info: JSON.stringify({
      broker_id: 'gta_broker',
      server: 'broker-server-2',
      backend_url: 'https://services.growtradingacademy.com',
    }),
  });

  const endpoints = await importFreshEndpoints();

  assert.equal(
    endpoints.buildManagerApiUrl('/manager/api/v2/auth/me'),
    'https://services.growtradingacademy.com/manager/api/v2/auth/me'
  );
  assert.equal(
    endpoints.buildManagerApiUrl('/api/v2/admin/login'),
    'https://services.growtradingacademy.com/manager/api/v2/admin/login'
  );
});

test('runtime VITE_API_URL alias provides default manager API host', async () => {
  installWindow({
    BACKEND_TARGET: 'desktop',
    VITE_API_URL: 'https://services.myprop.trade',
    VITE_API_EXT_URL: 'https://services.myprop.trade',
  });
  installStorage({});

  const endpoints = await importFreshEndpoints();

  assert.equal(endpoints.API_HOST, 'https://services.myprop.trade');
  assert.equal(
    endpoints.buildManagerApiUrl('/manager/GroupList'),
    'https://services.myprop.trade/manager/GroupList'
  );
});

test('dynamic endpoints recover broker info from local storage after desktop restart', async () => {
  installWindow({ BACKEND_TARGET: 'desktop' });
  installStorage({});
  globalThis.localStorage = {
    getItem: (key) => key === 'broker_info'
      ? JSON.stringify({
          broker_id: 'myprop',
          backend_url: 'https://services.myprop.trade',
        })
      : null,
  };

  const endpoints = await importFreshEndpoints();

  assert.equal(endpoints.API_HOST, 'https://services.myprop.trade');
  assert.equal(
    endpoints.buildManagerApiUrl('/manager/GroupList'),
    'https://services.myprop.trade/manager/GroupList'
  );
});
