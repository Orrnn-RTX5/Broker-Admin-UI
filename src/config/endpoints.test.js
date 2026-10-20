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

test('local feed status follows the actual feed host and carries no websocket token', async t => {
  const previousDocument = globalThis.document;
  t.after(() => { if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument; });
  globalThis.document = { cookie: '' };
  installWindow({ BACKEND_TARGET: 'web', USE_DEV_PROXY: 'true', FEED_WS_URL: 'wss://selected-feed.example/ws/feed' });
  window.location = { origin: 'http://localhost:5173', href: 'http://localhost:5173/', protocol: 'http:', hostname: 'localhost' };
  installStorage({ broker_info: JSON.stringify({ broker_id: 'selected', backend_url: 'https://api.example' }), token: 'fixture-token' });
  const endpoints = await importFreshEndpoints();
  assert.equal(endpoints.buildFeedStatusUrl(), 'http://localhost:5173/ws/feed/status');
  assert.equal(document.cookie, 'rtx5_dev_feed=https%3A%2F%2Fselected-feed.example; Path=/; SameSite=Lax');
  window.__RTX5_RUNTIME_CONFIG__.FEED_STATUS_URL = 'https://status-feed.example/ws/feed/status';
  assert.equal(endpoints.buildFeedStatusUrl(), 'http://localhost:5173/ws/feed/status');
  assert.match(document.cookie, /status-feed\.example/);
});

test('production feed status stays on the configured HTTPS origin', async () => {
  installWindow({ BACKEND_TARGET: 'web', USE_DEV_PROXY: 'false', FEED_STATUS_URL: 'https://feed.example/status?scope=public' });
  installStorage({});
  const endpoints = await importFreshEndpoints();
  assert.equal(endpoints.buildFeedStatusUrl(), 'https://feed.example/status?scope=public');
});

test('native journal uses the selected broker root without the legacy manager prefix', async () => {
  installWindow({ BACKEND_TARGET: 'web', USE_DEV_PROXY: 'false' });
  installStorage({ broker_info: JSON.stringify({ broker_id: 'a', backend_url: 'https://broker-a.example' }) });
  const endpoints = await importFreshEndpoints();
  assert.equal(endpoints.buildBrokerApiUrl('/api/v1/manager/journal?limit=200'), 'https://broker-a.example/api/v1/manager/journal?limit=200');
  assert.equal(endpoints.buildManagerApiUrl('/manager/GroupList'), 'https://broker-a.example/manager/GroupList');
  sessionStorage.setItem('broker_info', JSON.stringify({ broker_id: 'b', backend_url: 'https://broker-b.example' }));
  assert.equal(endpoints.buildBrokerApiUrl('/api/v1/manager/journal?limit=200'), 'https://broker-b.example/api/v1/manager/journal?limit=200');
});

test('native journal stays on the canonical versioned Vite proxy route', async () => {
  installWindow({ BACKEND_TARGET: 'web', USE_DEV_PROXY: 'true' });
  installStorage({ broker_info: JSON.stringify({ broker_id: 'a', backend_url: 'https://broker-a.example' }) });
  const endpoints = await importFreshEndpoints();
  assert.equal(endpoints.buildBrokerApiUrl('/api/v1/manager/journal?limit=200'), '/api/v1/manager/journal?limit=200');
});

test('desktop native journal follows discovered broker backend', async () => {
  installWindow({ BACKEND_TARGET: 'desktop', USE_DEV_PROXY: 'true' });
  installStorage({ broker_info: JSON.stringify({ broker_id: 'a', backend_url: 'https://broker-a.example' }) });
  const endpoints = await importFreshEndpoints();
  assert.equal(endpoints.buildBrokerApiUrl('/api/v1/manager/journal?limit=200'), 'https://broker-a.example/api/v1/manager/journal?limit=200');
});

test('state feed uses an opaque ticket and the current direct manager route', async () => {
  installWindow({ BACKEND_TARGET: 'direct', USE_DEV_PROXY: 'false' });
  window.location.href = 'http://127.0.0.1:5173/';
  window.location.protocol = 'http:';
  installStorage({ broker_info: JSON.stringify({backend_url:'http://127.0.0.1:8091',direct_manager_paths:true}) });
  const endpoints = await importFreshEndpoints();
  const url = new URL(endpoints.buildAdminStateWsUrl('opaque-ticket'));
  assert.equal(url.protocol,'ws:');
  assert.equal(url.pathname,'/OnPositionUpdate');
  assert.equal(url.search,'?ticket=opaque-ticket');
  assert.throws(()=>endpoints.buildAdminStateWsUrl(''));
});

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

test('dynamic endpoints keep web ext calls on the same-origin proxy namespace', async () => {
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
    '/ext-api/SessionOverrideSet'
  );
});

test('discovered service-domain ext endpoints stay on the same-origin proxy namespace', async () => {
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
    '/ext-api/ServerStatus'
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

test('feed WebSocket omits session token when broker feed does not require it', async () => {
  installWindow({
    BACKEND_TARGET: 'web',
    FEED_WS_URL: 'wss://feed.example/ws/feed',
    FEED_SEND_TOKEN: 'false',
  });
  installStorage({
    broker_info: JSON.stringify({ broker_id: 'demo', feed_token: 'private-feed-token' }),
  });

  const endpoints = await importFreshEndpoints();
  const url = new URL(endpoints.buildFeedWsUrl());
  assert.equal(url.origin, 'wss://feed.example');
  assert.equal(url.searchParams.get('broker_id'), 'demo');
  assert.equal(url.searchParams.has('token'), false);
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

test('SUI-A2: ext API posts stay same-origin/proxied in every web environment', async () => {
  const environments = [
    { name: 'dev proxy', config: { BACKEND_TARGET: 'web', USE_DEV_PROXY: 'true' } },
    {
      name: 'production proxy with baked ext host',
      config: { BACKEND_TARGET: 'web', USE_DEV_PROXY: 'false', API_HOST_EXT: 'https://ext-host.example' },
    },
    {
      name: 'production proxy with broker ext field',
      config: { BACKEND_TARGET: 'web', USE_DEV_PROXY: 'false' },
      extField: true,
    },
    { name: 'production proxy with no ext host', config: { BACKEND_TARGET: 'web', USE_DEV_PROXY: 'false' } },
  ];

  for (const env of environments) {
    installWindow(env.config);
    installStorage({
      broker_info: JSON.stringify({
        broker_id: 'demo-broker',
        backend_url: 'https://backend-host.example',
        ...(env.extField ? { web_ext_api_url: 'ext-host.example:8091' } : {}),
      }),
    });

    const endpoints = await importFreshEndpoints();

    for (const input of ['/ext-api/DepositRequestCreate', '/DepositRequestCreate', 'DepositRequestCreate']) {
      const url = endpoints.buildExtApiUrl(input);
      assert.equal(url, '/ext-api/DepositRequestCreate', `${env.name}: ${input}`);
      assert.doesNotMatch(url, /^https?:\/\//, `${env.name}: never absolute/cross-origin`);
    }
  }
});

test('SUI-A2: desktop target keeps the configured absolute ext host (no serving proxy)', async () => {
  installWindow({ BACKEND_TARGET: 'desktop' });
  installStorage({
    broker_info: JSON.stringify({ broker_id: 'demo-broker', backend_url: 'http://203.0.113.21:8091' }),
  });

  const endpoints = await importFreshEndpoints();

  assert.equal(
    endpoints.buildExtApiUrl('/ext-api/DepositRequestCreate'),
    'http://203.0.113.21:8091/DepositRequestCreate'
  );
});
