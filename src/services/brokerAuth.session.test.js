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

  assert.equal(stored.license_key, undefined);
  assert.equal(stored.nested.license_secret, undefined);
  assert.deepEqual(new Set(registeredOrigins), new Set([
    'https://broker.example.com',
    'http://broker.example.com:8091',
  ]));
});

test('fetchBrokerList uses v2 discovery and keeps sanitized broker server handles', async () => {
  installBrowserGlobals();
  let requestedUrl = '';
  globalThis.fetch = async (url, options) => {
    requestedUrl = url;
    assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'omit');

    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        servers: [
          {
            broker_id: 'gta_broker',
            broker_name: 'Grow Trading Academy',
            status: 'active',
            server: 'broker-server-42',
            backend_url: 'https://services.growtradingacademy.com',
          },
          {
            broker_id: 'disabled',
            status: 'disabled',
            server: 'broker-server-99',
            backend_url: 'https://disabled.example.com',
          },
        ],
      }),
    };
  };

  const brokerAuth = await importFreshBrokerAuth();
  const list = await brokerAuth.fetchBrokerList();

  assert.equal(requestedUrl, 'https://backend.orrnn.com/api/v2/broker/servers');
  assert.equal(list.length, 1);
  assert.equal(list[0].broker_id, 'gta_broker');
  assert.equal(list[0].name, 'Grow Trading Academy');
  assert.equal(list[0].server, 'broker-server-42');
  assert.equal(list[0].backend_url, 'https://services.growtradingacademy.com');
  assert.equal(list[0].server_ip, '');
  assert.equal(brokerAuth.getBrokerLoginServer(list[0]), 'broker-server-42');
});

test('fetchBrokerList maps GTA public SuperAdmin server to the broker server handle', async () => {
  installBrowserGlobals({ DISCOVERY_BASE_URL: 'https://superbackend.orrnn.com' });
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      servers: [
        {
          broker_id: 'gta_broker',
          broker_name: 'Grow Trading Academy',
          status: 'active',
          server: 'services.growtradingacademy.com:443',
          server_ip: '103.91.186.142',
          backend_url: 'https://services.growtradingacademy.com',
        },
      ],
    }),
  });

  const brokerAuth = await importFreshBrokerAuth();
  const list = await brokerAuth.fetchBrokerList();

  assert.equal(list.length, 1);
  assert.equal(list[0].broker_id, 'gta_broker');
  assert.equal(list[0].server, 'broker-server-2');
  assert.equal(brokerAuth.getBrokerDisplayServer(list[0]), '103.91.186.142');
  assert.equal(brokerAuth.getBrokerLoginServer(list[0]), 'broker-server-2');
});

test('fetchBrokerList keeps GTA local handle for login while displaying runtime server', async () => {
  installBrowserGlobals({
    BROKER_ID: 'gta_broker',
    DEFAULT_MT5_SERVER: '103.91.186.142',
    DISCOVERY_BASE_URL: 'https://services.growtradingacademy.com',
  });
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      servers: [
        {
          broker_id: 'gta_broker',
          broker_name: 'Grow Trading Academy',
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
  assert.equal(brokerAuth.getBrokerDisplayServer(list[0]), '103.91.186.142');
});

test('fetchBrokerList does not use the selected broker backend as discovery host', async () => {
  installBrowserGlobals({ API_HOST: 'https://testbrokerbackend.orrnn.com' });
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

  assert.equal(requestedUrl, 'https://backend.orrnn.com/api/v2/broker/servers');
});

test('loginAdmin sends the opaque server handle when discovery does not expose server_ip', async () => {
  installBrowserGlobals();
  let postedUrl = '';
  let postedBody = null;
  globalThis.fetch = async (url, options) => {
    postedUrl = url;
    postedBody = JSON.parse(options.body);

    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ token: 'admin-token', broker_id: 'gta_broker' }),
    };
  };

  const brokerAuth = await importFreshBrokerAuth();
  const response = await brokerAuth.loginAdmin(
    {
      broker_id: 'gta_broker',
      name: 'Grow Trading Academy',
      server: 'broker-server-42',
      backend_url: 'https://services.growtradingacademy.com',
    },
    { user: '1000', password: 'secret' }
  );

  assert.equal(postedUrl, 'https://services.growtradingacademy.com/api/v2/admin/login');
  assert.deepEqual(postedBody, {
    user: '1000',
    password: 'secret',
    server: 'broker-server-42',
  });
  assert.equal(response.token, 'admin-token');
});

test('loginAdmin maps GTA stale public server values to the accepted broker server handle', async () => {
  installBrowserGlobals();
  let postedBody = null;
  globalThis.fetch = async (url, options) => {
    postedBody = JSON.parse(options.body);

    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ token: 'admin-token', broker_id: 'gta_broker' }),
    };
  };

  const brokerAuth = await importFreshBrokerAuth();
  await brokerAuth.loginAdmin(
    {
      broker_id: 'gta_broker',
      name: 'Grow Trading Academy',
      server: 'services.growtradingacademy.com:443',
      server_ip: '103.91.186.142',
      backend_url: 'https://services.growtradingacademy.com',
    },
    { user: '1000', password: 'secret', server: '103.91.186.142' }
  );

  assert.deepEqual(postedBody, {
    user: '1000',
    password: 'secret',
    server: 'broker-server-2',
  });
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
      text: async () => JSON.stringify({ token: 'manager-token', broker_id: 'gta_broker' }),
    };
  };

  const brokerAuth = await importFreshBrokerAuth();
  const response = await brokerAuth.loginManager(
    {
      broker_id: 'gta_broker',
      name: 'Grow Trading Academy',
      server: 'broker-server-42',
      backend_url: 'https://services.growtradingacademy.com',
    },
    { user: '2000', password: 'secret' }
  );

  assert.equal(postedUrl, 'https://services.growtradingacademy.com/api/v2/auth/login');
  assert.deepEqual(postedBody, {
    user: '2000',
    password: 'secret',
    server: 'broker-server-42',
  });
  assert.equal(response.token, 'manager-token');
});

test('ORRNN public broker admin login uses the manager proxy prefix', async () => {
  installBrowserGlobals();
  let postedUrl = '';
  globalThis.fetch = async (url) => {
    postedUrl = url;
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ token: 'admin-token', broker_id: 'testorrnn' }),
    };
  };

  const brokerAuth = await importFreshBrokerAuth();
  await brokerAuth.loginAdmin(
    {
      broker_id: 'testorrnn',
      name: 'Test Orrnn Broker',
      server: 'testorrnn',
      backend_url: 'https://testbrokerbackend.orrnn.com',
    },
    { user: '990701', password: 'secret', server: 'testorrnn' }
  );

  assert.equal(postedUrl, 'https://testbrokerbackend.orrnn.com/manager/api/v2/admin/login');
});

test('ORRNN public broker manager login uses the manager proxy prefix', async () => {
  installBrowserGlobals();
  let postedUrl = '';
  globalThis.fetch = async (url) => {
    postedUrl = url;
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ token: 'manager-token', broker_id: 'testorrnn' }),
    };
  };

  const brokerAuth = await importFreshBrokerAuth();
  await brokerAuth.loginManager(
    {
      broker_id: 'testorrnn',
      name: 'Test Orrnn Broker',
      server: 'testorrnn',
      backend_url: 'https://testbrokerbackend.orrnn.com',
    },
    { user: '990702', password: 'secret', server: 'testorrnn' }
  );

  assert.equal(postedUrl, 'https://testbrokerbackend.orrnn.com/manager/api/v2/auth/login');
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
