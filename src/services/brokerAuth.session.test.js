import { test } from 'node:test';
import assert from 'node:assert/strict';

let importId = 0;

const createStorage = (values = {}) => {
  const store = new Map(Object.entries(values));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
};

const installBrowserGlobals = (runtimeConfig = {}) => {
  const registeredOrigins = [];
  const session = createStorage();
  const local = createStorage();
  globalThis.sessionStorage = session;
  globalThis.localStorage = local;
  globalThis.window = {
    __RTX5_RUNTIME_CONFIG__: { BACKEND_TARGET: 'web', ...runtimeConfig },
    location: { protocol: 'https:' },
    sessionStorage: session,
    localStorage: local,
    rtx5Electron: {
      registerBrokerOrigins: (origins) => registeredOrigins.push(...origins),
      clearBrokerOrigins: () => registeredOrigins.splice(0, registeredOrigins.length),
    },
  };

  return { registeredOrigins };
};

const importFreshBrokerAuth = () => import(`./brokerAuth.js?case=${++importId}`);

test('concurrent login discovery shares one read and retries after it settles', async () => {
  installBrowserGlobals({ DISCOVERY_BASE_URL: 'https://platform.example.com' });
  let calls = 0;
  const pending = [];
  globalThis.fetch = () => { calls++; return new Promise(resolve => pending.push(resolve)); };
  const auth = await importFreshBrokerAuth();
  const first = auth.fetchBrokerList();
  const second = auth.fetchBrokerList();
  assert.equal(first, second);
  assert.equal(calls, 1);
  pending.shift()({ ok: true, status: 200, text: async () => '[]' });
  await Promise.all([first, second]);
  const retry = auth.fetchBrokerList();
  assert.equal(calls, 2, 'A later refresh must read fresh discovery data');
  pending.shift()({ ok: true, status: 200, text: async () => '[]' });
  await retry;
});

for (const target of ['web', 'desktop']) {
  test(`discovered broker selection routes admin login to its HTTPS backend in ${target}`, async () => {
    installBrowserGlobals({ BACKEND_TARGET: target, DISCOVERY_BASE_URL: 'https://platform.example.com' });
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(options.method === 'GET' ? [{
          broker_id: 'acme',
          broker_name: 'Acme Markets',
          backend_url: 'https://acme.example.com',
          ws_url: 'wss://acme.example.com/ws/feed',
        }] : { token: 'test-token' }),
      };
    };
    const auth = await importFreshBrokerAuth();
    const brokers = await auth.fetchBrokerList();
    const acme = auth.discoverBrokerById(brokers, 'acme');
    assert.equal(acme.backend_url, 'https://acme.example.com');
    assert.equal(acme.ws_url, 'wss://acme.example.com/ws/feed');
    await auth.loginAdmin(acme, { user: 'test-admin', password: 'test-password' });
    assert.equal(calls[1].url, 'https://acme.example.com/manager/api/v2/admin/login');
  });
}

test('configured broker admin falls back to its env backend when discovery fails', async () => {
  installBrowserGlobals({ BROKER_ID: 'acme', API_HOST: 'https://acme.example.com' });
  globalThis.fetch = async () => { throw new Error('Discovery unavailable'); };
  const auth = await importFreshBrokerAuth();
  const brokers = await auth.fetchBrokerList();
  assert.equal(brokers.length, 1);
  assert.equal(brokers[0].broker_id, 'acme');
  assert.equal(brokers[0].backend_url, 'https://acme.example.com');
});

const CONFIGURED_BROKER_ENV = {
  BROKER_ID: 'acme',
  BROKER_NAME: 'Acme Markets',
  API_HOST: 'https://api.acme.example',
  API_HOST_EXT: 'https://api.acme.example',
  FEED_WS_URL: 'wss://feed.acme.example/ws/feed',
  FEED_STATUS_URL: 'https://feed.acme.example/ws/feed/status',
  DEFAULT_MT5_SERVER: '203.0.113.10',
  DISCOVERY_BASE_URL: 'https://platform.example.com',
};

test('environment-configured broker keeps its discovery handle but uses .env hosts', async () => {
  installBrowserGlobals(CONFIGURED_BROKER_ENV);
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(url);
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify(options.method === 'GET' ? [{
        broker_id: 'acme',
        broker_name: 'Acme Markets',
        server: '203.0.113.10:443',
        server_url: 'https://203.0.113.10:443',
        ws_url: 'ws://203.0.113.10/ws/feed',
      }] : { token: 'test-token' }),
    };
  };
  const auth = await importFreshBrokerAuth();
  const [broker, ...rest] = await auth.fetchBrokerList();
  assert.equal(calls[0], 'https://platform.example.com/api/v2/broker/servers');
  assert.equal(rest.length, 0);
  assert.equal(broker.broker_id, 'acme');
  assert.equal(broker.name, 'Acme Markets');
  assert.equal(broker.server, '203.0.113.10:443');
  assert.equal(broker.backend_url, 'https://api.acme.example');
  assert.equal(broker.server_url, 'https://api.acme.example');
  assert.equal(broker.feed_ws_url, 'wss://feed.acme.example/ws/feed');

  // A previously stored record for the same broker cannot redirect login.
  await auth.loginAdmin(
    { broker_id: 'acme', backend_url: 'https://203.0.113.10:443', env: { API_HOST: 'https://old.example.com' } },
    { user: 'test-admin', password: 'test-password' }
  );
  assert.equal(calls[1], 'https://api.acme.example/manager/api/v2/admin/login');
});

test('environment-configured broker stays available when discovery is unreachable', async () => {
  installBrowserGlobals(CONFIGURED_BROKER_ENV);
  globalThis.fetch = async () => { throw new Error('offline'); };
  const auth = await importFreshBrokerAuth();
  const brokers = await auth.fetchBrokerList();
  assert.equal(brokers.length, 1);
  assert.equal(brokers[0].broker_id, 'acme');
  assert.equal(brokers[0].server, '203.0.113.10');
  assert.equal(brokers[0].backend_url, 'https://api.acme.example');
});

test('discovery preserves platform handles and respects disabled records', async () => {
  installBrowserGlobals({ DISCOVERY_BASE_URL: 'https://platform.example.com' });
  const auth = await importFreshBrokerAuth();
  for (const enabled of [true, false]) {
    globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify([
      { broker_id: 'acme', server: 'broker-server-acme', backend_url: 'https://acme.example.com', enabled },
    ]) });
    const brokers = await auth.fetchBrokerList();
    assert.equal(brokers.length, enabled ? 1 : 0);
    if (enabled) {
      assert.equal(brokers[0].server, 'broker-server-acme');
      assert.equal(brokers[0].backend_url, 'https://acme.example.com');
    }
  }
});

for (const target of ['web', 'desktop']) {
  test(`configured direct-origin broker discovery and admin login use direct API in ${target}`, async () => {
    installBrowserGlobals({
      BACKEND_TARGET: target,
      BROKER_ID: 'direct_broker',
      API_HOST: 'https://direct.example.com',
      DIRECT_MANAGER_ORIGINS: 'https://direct.example.com',
      DEFAULT_DISCOVERY_BASE_URL: 'https://platform.example.com',
      DISCOVERY_BASE_URL: 'https://platform.example.com',
    });
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(options.method === 'GET' ? [{
          broker_id: 'direct_broker',
          broker_name: 'Direct Broker',
          enabled: true,
          server: 'broker-server-5',
          direct_manager_paths: true,
        }] : { token: 'test-admin-token' }),
      };
    };
    const auth = await importFreshBrokerAuth();
    const [broker] = await auth.fetchBrokerList();
    assert.equal(broker.broker_id, 'direct_broker');
    assert.equal(broker.server, 'broker-server-5');
    await auth.loginAdmin(broker, { user: '10018', password: 'test-password' });
    assert.equal(calls[0].url, 'https://platform.example.com/api/v2/broker/servers');
    assert.equal(calls[1].url, 'https://direct.example.com/api/v2/admin/login');
    assert.deepEqual(JSON.parse(calls[1].options.body), { user: '10018', password: 'test-password' });
  });
}

test('live discovery never fabricates brokers when records are empty or disabled', async () => {
  installBrowserGlobals({ BROKER_ID: 'TEST', DISCOVERY_BASE_URL: 'https://platform.example.com' });
  const auth = await importFreshBrokerAuth();
  for (const records of [[], [{ broker_id: 'TEST', enabled: false, server: 'broker-server-5' }]]) {
    globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(records) });
    assert.deepEqual((await auth.fetchBrokerList()).map((broker) => broker.broker_id), []);
  }
});

test('setBrokerInfo strips raw license secrets and registers selected broker origins', async () => {
  const { registeredOrigins } = installBrowserGlobals();
  const brokerAuth = await importFreshBrokerAuth();

  brokerAuth.setBrokerInfo({
    broker_id: 'demo',
    name: 'Demo',
    backend_url: 'https://broker.example.com',
    web_ext_api_url: 'broker.example.com:8091',
    license_key: 'raw-license',
    nested: { license_secret: 'raw-secret' },
  });

  const stored = JSON.parse(sessionStorage.getItem('broker_info'));
  const persisted = JSON.parse(localStorage.getItem('broker_info'));

  assert.equal(stored.license_key, undefined);
  assert.equal(stored.nested.license_secret, undefined);
  assert.deepEqual(persisted, stored);
  assert.deepEqual(new Set(registeredOrigins), new Set([
    'https://broker.example.com',
    'http://broker.example.com:8091',
  ]));
});

test('getBrokerInfo recovers selected broker from local storage after desktop restart', async () => {
  installBrowserGlobals();
  localStorage.setItem('broker_info', JSON.stringify({
    broker_id: 'myprop',
    backend_url: 'https://services.myprop.trade',
  }));

  const brokerAuth = await importFreshBrokerAuth();
  const brokerInfo = brokerAuth.getBrokerInfo();

  assert.equal(brokerInfo.broker_id, 'myprop');
  assert.equal(brokerInfo.backend_url, 'https://services.myprop.trade');
});

test('fetchBrokerList uses v2 discovery and keeps sanitized broker server handles', async () => {
  installBrowserGlobals({ DISCOVERY_BASE_URL: 'https://platform.example.com' });
  let requestedUrl = '';
  globalThis.fetch = async (url, options) => {
    requestedUrl = url;
    assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'omit');

    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        value: [
          {
            broker_id: 'acme_broker',
            broker_name: 'Acme Markets',
            status: 'active',
            server: 'broker-server-42',
            backend_url: 'https://services.acme.example.com',
            logo_url: 'https://platform.example.com/api/v1/brokers/acme_broker/logo',
          },
          {
            broker_id: 'disabled',
            enabled: false,
            server: 'broker-server-99',
            backend_url: 'https://disabled.example.com',
          },
        ],
      }),
    };
  };

  const brokerAuth = await importFreshBrokerAuth();
  const list = await brokerAuth.fetchBrokerList();

  assert.equal(requestedUrl, 'https://platform.example.com/api/v2/broker/servers');
  assert.equal(list.length, 1);
  assert.equal(list[0].broker_id, 'acme_broker');
  assert.equal(list[0].name, 'Acme Markets');
  assert.equal(list[0].logo_url, 'https://platform.example.com/api/v1/brokers/acme_broker/logo');
  assert.equal(list[0].server, 'broker-server-42');
  assert.equal(list[0].backend_url, 'https://services.acme.example.com');
  assert.equal(list[0].server_ip, '');
  assert.equal(brokerAuth.getBrokerLoginServer(list[0]), 'broker-server-42');
});

test('fetchBrokerList preserves discovered server handle without hardcoded broker rewrites', async () => {
  installBrowserGlobals({ DISCOVERY_BASE_URL: 'https://platform.example.com' });
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      servers: [
        {
          broker_id: 'acme_broker',
          broker_name: 'Acme Markets',
          status: 'active',
          server: 'services.acme.example.com:443',
          server_ip: '203.0.113.142',
          backend_url: 'https://services.acme.example.com',
        },
      ],
    }),
  });

  const brokerAuth = await importFreshBrokerAuth();
  const list = await brokerAuth.fetchBrokerList();

  assert.equal(list.length, 1);
  assert.equal(list[0].broker_id, 'acme_broker');
  assert.equal(list[0].server, 'services.acme.example.com:443');
  assert.equal(brokerAuth.getBrokerDisplayServer(list[0]), '203.0.113.142');
  assert.equal(brokerAuth.getBrokerLoginServer(list[0]), 'services.acme.example.com:443');
});

test('fetchBrokerList keeps discovered handle for login while displaying runtime server for configured broker', async () => {
  installBrowserGlobals({
    BROKER_ID: 'acme_broker',
    DEFAULT_MT5_SERVER: '203.0.113.142',
    DISCOVERY_BASE_URL: 'https://platform.example.com',
  });
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      servers: [
        {
          broker_id: 'acme_broker',
          broker_name: 'Acme Markets',
          status: 'active',
          server: 'broker-server-2',
        },
      ],
    }),
  });

  const brokerAuth = await importFreshBrokerAuth();
  const list = await brokerAuth.fetchBrokerList();

  assert.equal(list[0].server, 'broker-server-2');
  assert.equal(brokerAuth.getBrokerLoginServer(list[0]), 'broker-server-2');
  assert.equal(brokerAuth.getBrokerDisplayServer(list[0]), '203.0.113.142');
});

test('fetchBrokerList does not use the selected broker backend as discovery host', async () => {
  installBrowserGlobals({ API_HOST: 'https://backend.acme.example', DISCOVERY_BASE_URL: 'https://platform.example.com' });
  let requestedUrl = '';
  globalThis.fetch = async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ servers: [] }),
    };
  };

  const brokerAuth = await importFreshBrokerAuth();
  await brokerAuth.fetchBrokerList();

  assert.equal(requestedUrl, 'https://platform.example.com/api/v2/broker/servers');
});

test('fetchBrokerList ignores runtime discovery when it points at selected broker services host', async () => {
  installBrowserGlobals({
    API_HOST: 'https://services.acme.example.com',
    API_HOST_EXT: 'https://services.acme.example.com',
    DISCOVERY_BASE_URL: 'https://services.acme.example.com',
  });
  let requestedUrl = '';
  globalThis.fetch = async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ servers: [] }),
    };
  };

  const brokerAuth = await importFreshBrokerAuth();
  await assert.rejects(
    brokerAuth.fetchBrokerList(),
    (error) => error?.message === brokerAuth.DISCOVERY_NOT_CONFIGURED_ERROR
  );

  assert.equal(requestedUrl, '', 'self-referential discovery must fail closed without any fetch');
});

test('unconfigured discovery with no pinned broker fails closed with a clear error', async () => {
  installBrowserGlobals();
  let requestedUrl = '';
  globalThis.fetch = async (url) => {
    requestedUrl = url;
    return { ok: true, status: 200, text: async () => '[]' };
  };

  const brokerAuth = await importFreshBrokerAuth();
  await assert.rejects(
    brokerAuth.fetchBrokerList(),
    (error) => error?.message === brokerAuth.DISCOVERY_NOT_CONFIGURED_ERROR
  );

  assert.equal(requestedUrl, '', 'no discovery host configured means no request is issued');
});

test('loginAdmin omits server when the caller does not explicitly supply one', async () => {
  installBrowserGlobals();
  let postedUrl = '';
  let postedBody = null;
  globalThis.fetch = async (url, options) => {
    postedUrl = url;
    postedBody = JSON.parse(options.body);

    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ token: 'admin-token', broker_id: 'acme_broker' }),
    };
  };

  const brokerAuth = await importFreshBrokerAuth();
  const response = await brokerAuth.loginAdmin(
    {
      broker_id: 'acme_broker',
      name: 'Acme Markets',
      server: 'broker-server-42',
      backend_url: 'https://services.acme.example.com',
    },
    { user: '1000', password: 'secret' }
  );

  assert.equal(postedUrl, 'https://services.acme.example.com/manager/api/v2/admin/login');
  assert.deepEqual(postedBody, {
    user: '1000',
    password: 'secret',
  });
  assert.equal(response.token, 'admin-token');
});

test('loginAdmin uses the local Vite proxy path on localhost web', async () => {
  installBrowserGlobals({ USE_DEV_PROXY: 'true' });
  globalThis.window.location = {
    protocol: 'http:',
    hostname: 'localhost',
    host: 'localhost:5174',
    origin: 'http://localhost:5174',
  };
  let postedUrl = '';
  globalThis.fetch = async (url, options) => {
    postedUrl = url;
    assert.equal(options.credentials, 'same-origin');
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ token: 'admin-token', broker_id: 'acme_broker' }),
    };
  };

  const brokerAuth = await importFreshBrokerAuth();
  await brokerAuth.loginAdmin(
    {
      broker_id: 'acme_broker',
      name: 'Acme Markets',
      backend_url: 'https://services.acme.example.com',
    },
    { user: '10015', password: 'secret' }
  );

  assert.equal(postedUrl, '/manager/api/v2/admin/login');
});

test('loginAdmin preserves authorization header tokens when the body has no token', async () => {
  installBrowserGlobals();
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: {
      get: (name) => (String(name).toLowerCase() === 'authorization' ? 'Bearer header-admin-token' : null),
    },
    text: async () => JSON.stringify({ broker_id: 'acme_broker' }),
  });

  const brokerAuth = await importFreshBrokerAuth();
  const response = await brokerAuth.loginAdmin(
    {
      broker_id: 'acme_broker',
      name: 'Acme Markets',
      server: 'broker-server-42',
      backend_url: 'https://services.acme.example.com',
    },
    { user: '1000', password: 'secret' }
  );

  const session = brokerAuth.setAuthSession(response, { broker_id: 'acme_broker' });

  assert.equal(response.authorization, 'Bearer header-admin-token');
  assert.equal(session.token, 'header-admin-token');
  assert.equal(localStorage.getItem('authToken'), 'header-admin-token');
});

test('loginAdmin passes explicit caller server handle unchanged', async () => {
  installBrowserGlobals();
  let postedBody = null;
  globalThis.fetch = async (url, options) => {
    postedBody = JSON.parse(options.body);

    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ token: 'admin-token', broker_id: 'acme_broker' }),
    };
  };

  const brokerAuth = await importFreshBrokerAuth();
  await brokerAuth.loginAdmin(
    {
      broker_id: 'acme_broker',
      name: 'Acme Markets',
      server: 'broker-server-42',
      backend_url: 'https://services.acme.example.com',
    },
    { user: '1000', password: 'secret', server: 'broker-server-42' }
  );

  assert.deepEqual(postedBody, {
    user: '1000',
    password: 'secret',
    server: 'broker-server-42',
  });
});

test('desktop loginAdmin uses public service URL instead of raw IP when both are discovered', async () => {
  installBrowserGlobals({ BACKEND_TARGET: 'desktop' });
  let postedUrl = '';
  globalThis.fetch = async (url) => {
    postedUrl = url;

    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ token: 'admin-token', broker_id: 'myprop' }),
    };
  };

  const brokerAuth = await importFreshBrokerAuth();
  await brokerAuth.loginAdmin(
    {
      broker_id: 'myprop',
      name: 'MyProp',
      server_url: 'https://services.myprop.trade',
      services_domain: 'services.myprop.trade',
      server_ip: '185.204.168.202',
      server_port: 443,
    },
    { user: '10017', password: 'secret' }
  );

  assert.equal(postedUrl, 'https://services.myprop.trade/manager/api/v2/admin/login');
});

test('loginManager sends the opaque server handle when discovery does not expose server_ip', async () => {
  installBrowserGlobals();
  let postedUrl = '';
  let postedBody = null;
  globalThis.fetch = async (url, options) => {
    postedUrl = url;
    postedBody = JSON.parse(options.body);

    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ token: 'manager-token', broker_id: 'acme_broker' }),
    };
  };

  const brokerAuth = await importFreshBrokerAuth();
  const response = await brokerAuth.loginManager(
    {
      broker_id: 'acme_broker',
      name: 'Acme Markets',
      server: 'broker-server-42',
      backend_url: 'https://services.acme.example.com',
    },
    { user: '2000', password: 'secret' }
  );

  assert.equal(postedUrl, 'https://services.acme.example.com/manager/api/v2/auth/login');
  assert.deepEqual(postedBody, {
    user: '2000',
    password: 'secret',
    server: 'broker-server-42',
  });
  assert.equal(response.token, 'manager-token');
});

test('public broker admin login uses the manager proxy prefix', async () => {
  installBrowserGlobals();
  let postedUrl = '';
  globalThis.fetch = async (url) => {
    postedUrl = url;
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ token: 'admin-token', broker_id: 'acme-test' }),
    };
  };

  const brokerAuth = await importFreshBrokerAuth();
  await brokerAuth.loginAdmin(
    {
      broker_id: 'acme-test',
      name: 'Acme Test Broker',
      server: 'acme-test',
      backend_url: 'https://backend.acme.example',
    },
    { user: '990701', password: 'secret', server: 'acme-test' }
  );

  assert.equal(postedUrl, 'https://backend.acme.example/manager/api/v2/admin/login');
});

test('public broker manager login uses the manager proxy prefix', async () => {
  installBrowserGlobals();
  let postedUrl = '';
  globalThis.fetch = async (url) => {
    postedUrl = url;
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ token: 'manager-token', broker_id: 'acme-test' }),
    };
  };

  const brokerAuth = await importFreshBrokerAuth();
  await brokerAuth.loginManager(
    {
      broker_id: 'acme-test',
      name: 'Acme Test Broker',
      server: 'acme-test',
      backend_url: 'https://backend.acme.example',
    },
    { user: '990702', password: 'secret', server: 'acme-test' }
  );

  assert.equal(postedUrl, 'https://backend.acme.example/manager/api/v2/auth/login');
});

test('validateBrokerCredentials preserves validation state without returning raw license key', async () => {
  installBrowserGlobals();
  const brokerAuth = await importFreshBrokerAuth();

  const brokerInfo = await brokerAuth.validateBrokerCredentials({
    broker_id: 'demo',
    license_key: 'raw-license',
    server: 'https://broker.example.com',
  });

  assert.equal(brokerInfo.license_key, undefined);
  assert.equal(brokerInfo.license_key_set, true);
});

test('setAuthSession strips license secrets before writing auth session storage', async () => {
  installBrowserGlobals();
  const brokerAuth = await importFreshBrokerAuth();

  const auth = brokerAuth.setAuthSession(
    {
      token: 'session-token',
      refresh_token: 'refresh-token',
      licenseKey: 'raw-license',
      nested: { licenceSecret: 'raw-secret' },
    },
    { broker_id: 'demo' }
  );
  const stored = JSON.parse(sessionStorage.getItem('auth'));

  assert.equal(auth.licenseKey, undefined);
  assert.equal(auth.nested.licenceSecret, undefined);
  assert.equal(stored.licenseKey, undefined);
  assert.equal(stored.nested.licenceSecret, undefined);
});

test('setAuthSession clears stale expiry keys when login response has no expiry', async () => {
  installBrowserGlobals();
  localStorage.setItem('tokenExpiresAt', '1');
  localStorage.setItem('token_expires_at', '1');
  const brokerAuth = await importFreshBrokerAuth();

  brokerAuth.setAuthSession(
    {
      token: 'session-token',
      refresh_token: 'refresh-token',
    },
    { broker_id: 'demo' }
  );

  assert.equal(localStorage.getItem('tokenExpiresAt'), null);
  assert.equal(localStorage.getItem('token_expires_at'), null);
});

test('setAuthSession unwraps common token response shapes before storage', async () => {
  installBrowserGlobals();
  const brokerAuth = await importFreshBrokerAuth();

  const auth = brokerAuth.setAuthSession(
    {
      data: {
        accessToken: 'wrapped-access-token',
        refreshToken: 'wrapped-refresh-token',
        expiresIn: 3600,
        broker_id: 'myprop-trade',
      },
    },
    { broker_id: 'fallback-broker' }
  );
  const stored = JSON.parse(sessionStorage.getItem('auth'));

  assert.equal(auth.token, 'wrapped-access-token');
  assert.equal(auth.access_token, 'wrapped-access-token');
  assert.equal(auth.session_token, 'wrapped-access-token');
  assert.equal(auth.refresh_token, 'wrapped-refresh-token');
  assert.equal(auth.broker_id, 'myprop-trade');
  assert.equal(stored.token, 'wrapped-access-token');
  assert.equal(localStorage.getItem('authToken'), 'wrapped-access-token');
});

test('requireAdminAuthSessionToken accepts recognized admin token fields', async () => {
  installBrowserGlobals();
  const brokerAuth = await importFreshBrokerAuth();

  assert.equal(brokerAuth.requireAdminAuthSessionToken({ token: 'token-value' }).token, 'token-value');
  assert.equal(
    brokerAuth.requireAdminAuthSessionToken({ access_token: 'access-token-value' }).access_token,
    'access-token-value'
  );
  assert.equal(
    brokerAuth.requireAdminAuthSessionToken({ accessToken: 'access-token-camel' }).accessToken,
    'access-token-camel'
  );
  assert.equal(
    brokerAuth.requireAdminAuthSessionToken({ session_token: 'session-token-value' }).session_token,
    'session-token-value'
  );
  assert.deepEqual(
    brokerAuth.requireAdminAuthSessionToken({ value: { token: 'wrapped-token' } }),
    { value: { token: 'wrapped-token' } }
  );
});

test('requireAdminAuthSessionToken rejects setAuthSession results without a usable token', async () => {
  installBrowserGlobals();
  const brokerAuth = await importFreshBrokerAuth();

  const emptySession = brokerAuth.setAuthSession({}, { broker_id: 'gta_broker' });
  const blankSession = brokerAuth.setAuthSession({ token: '   ' }, { broker_id: 'gta_broker' });

  assert.throws(
    () => brokerAuth.requireAdminAuthSessionToken(emptySession),
    /did not return an access token/
  );
  assert.throws(
    () => brokerAuth.requireAdminAuthSessionToken(blankSession),
    /did not return an access token/
  );
});
