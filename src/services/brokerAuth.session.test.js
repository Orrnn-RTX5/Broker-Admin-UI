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

for (const target of ['web', 'desktop']) {
  test(`TEST discovery and admin login use the live backend's direct API in ${target}`, async () => {
    installBrowserGlobals({
      BACKEND_TARGET: target,
      BROKER_ID: 'TEST',
      API_HOST: 'https://fxtrustbrokerbackend.orrnn.com',
      DEFAULT_DISCOVERY_BASE_URL: 'https://fxtrustbrokerbackend.orrnn.com',
      DISCOVERY_BASE_URL: 'https://fxtrustbrokerbackend.orrnn.com',
    });
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(options.method === 'GET' ? [{
          broker_id: 'TEST',
          broker_name: 'RTX5-Local-Test-Broker',
          enabled: true,
          server: 'broker-server-5',
        }] : { token: 'test-admin-token' }),
      };
    };
    const auth = await importFreshBrokerAuth();
    const [broker] = await auth.fetchBrokerList();
    assert.equal(broker.broker_id, 'TEST');
    assert.equal(broker.server, 'broker-server-5');
    await auth.loginAdmin(broker, { user: '10018', password: 'test-password' });
    assert.equal(calls[0].url, 'https://fxtrustbrokerbackend.orrnn.com/api/v2/broker/servers');
    assert.equal(calls[1].url, 'https://fxtrustbrokerbackend.orrnn.com/api/v2/admin/login');
    assert.deepEqual(JSON.parse(calls[1].options.body), { user: '10018', password: 'test-password' });
  });
}

test('live discovery never fabricates TEST when it is missing or disabled', async () => {
  installBrowserGlobals({ BROKER_ID: 'TEST' });
  const auth = await importFreshBrokerAuth();
  for (const records of [[], [{ broker_id: 'TEST', enabled: false, server: 'broker-server-5' }]]) {
    globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(records) });
    assert.deepEqual(await auth.fetchBrokerList(), []);
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
        value: [
          {
            broker_id: 'gta_broker',
            broker_name: 'Grow Trading Academy',
            status: 'active',
            server: 'broker-server-42',
            backend_url: 'https://services.growtradingacademy.com',
            logo_url: 'https://superbackend.orrnn.com/api/v1/brokers/gta_broker/logo',
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

  assert.equal(requestedUrl, 'https://superbackend.orrnn.com/api/v2/broker/servers');
  assert.equal(list.length, 1);
  assert.equal(list[0].broker_id, 'gta_broker');
  assert.equal(list[0].name, 'Grow Trading Academy');
  assert.equal(list[0].logo_url, 'https://superbackend.orrnn.com/api/v1/brokers/gta_broker/logo');
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

  assert.equal(requestedUrl, 'https://superbackend.orrnn.com/api/v2/broker/servers');
});

test('fetchBrokerList ignores runtime discovery when it points at selected broker services host', async () => {
  installBrowserGlobals({
    API_HOST: 'https://services.growtradingacademy.com',
    API_HOST_EXT: 'https://services.growtradingacademy.com',
    DISCOVERY_BASE_URL: 'https://services.growtradingacademy.com',
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
  await brokerAuth.fetchBrokerList();

  assert.equal(requestedUrl, 'https://superbackend.orrnn.com/api/v2/broker/servers');
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

  assert.equal(postedUrl, 'https://services.growtradingacademy.com/manager/api/v2/admin/login');
  assert.deepEqual(postedBody, {
    user: '1000',
    password: 'secret',
  });
  assert.equal(response.token, 'admin-token');
});

test('loginAdmin preserves authorization header tokens when the body has no token', async () => {
  installBrowserGlobals();
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    headers: {
      get: (name) => (String(name).toLowerCase() === 'authorization' ? 'Bearer header-admin-token' : null),
    },
    text: async () => JSON.stringify({ broker_id: 'gta_broker' }),
  });

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

  const session = brokerAuth.setAuthSession(response, { broker_id: 'gta_broker' });

  assert.equal(response.authorization, 'Bearer header-admin-token');
  assert.equal(session.token, 'header-admin-token');
  assert.equal(localStorage.getItem('authToken'), 'header-admin-token');
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

  assert.equal(postedUrl, 'https://services.growtradingacademy.com/manager/api/v2/auth/login');
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
