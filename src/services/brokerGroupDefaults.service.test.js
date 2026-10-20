// Broker group-defaults service: exact contract paths/bodies and typed errors.
// Run with: node --test src/services/brokerGroupDefaults.service.test.js
import test from 'node:test';
import assert from 'node:assert/strict';

const records = new Map();
globalThis.localStorage = { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, String(value)), removeItem: key => records.delete(key) };
globalThis.sessionStorage = globalThis.localStorage;

const {
  BROKER_GROUP_DEFAULTS_PATH,
  BROKER_GROUP_DEFAULTS_READ_TIMEOUT_MS,
  brokerGroupDefaultsError,
  createBrokerGroupDefaultsApi,
} = await import('./brokerGroupDefaults.service.js');
const { api } = await import('../lib/api.js');
const { useAuthStore } = await import('../store/authStore.js');

const backendError = (status, code, message) => {
  const error = new Error(`Request failed with status code ${status}`);
  error.response = { status, data: { code, message: message ?? `${code}: pq: raw driver detail`, stackTrace: null } };
  return error;
};

const fakeClient = (impl) => {
  const calls = [];
  const wrap = (method) => async (url, a, b) => {
    const call = method === 'get' ? { method, url, config: a } : { method, url, body: a, config: b };
    calls.push(call);
    return impl(call, calls.length);
  };
  return { calls, get: wrap('get'), put: wrap('put'), post: wrap('post') };
};

test('path is the full manager route (same convention as close-counterparts)', () => {
  assert.equal(BROKER_GROUP_DEFAULTS_PATH, '/api/v1/manager/broker/group-defaults');
});

test('get: GET exact path, no params / broker_id, normalized body', async () => {
  const client = fakeClient(async () => ({ data: { broker_id: 'broker-a', group_default_leverage: 300 } }));
  const result = await createBrokerGroupDefaultsApi(client).get();
  assert.equal(client.calls.length, 1);
  assert.equal(client.calls[0].method, 'get');
  assert.equal(client.calls[0].url, BROKER_GROUP_DEFAULTS_PATH);
  assert.equal(client.calls[0].config.params, undefined, 'tenant session never sends broker_id');
  assert.equal(client.calls[0].config.timeout, BROKER_GROUP_DEFAULTS_READ_TIMEOUT_MS);
  assert.deepEqual(result, { brokerId: 'broker-a', defaultLeverage: 300 });
});

test('get: null default normalizes to null (unset)', async () => {
  const client = fakeClient(async () => ({ data: { broker_id: 'broker-a', group_default_leverage: null } }));
  assert.deepEqual(await createBrokerGroupDefaultsApi(client).get(), { brokerId: 'broker-a', defaultLeverage: null });
});

test('get: malformed 200 body is an error, not a default', async () => {
  const client = fakeClient(async () => ({ data: { broker_id: 'broker-a', group_default_leverage: 0 } }));
  await assert.rejects(createBrokerGroupDefaultsApi(client).get(), /broker defaults response/i);
});

test('save: PUT exact path with exactly { group_default_leverage: int }, then re-reads', async () => {
  const client = fakeClient(async (call) => ({ data: { broker_id: 'broker-a', group_default_leverage: call.method === 'put' ? call.body.group_default_leverage : 250 } }));
  const result = await createBrokerGroupDefaultsApi(client).save('250');
  assert.equal(client.calls[0].method, 'put');
  assert.equal(client.calls[0].url, BROKER_GROUP_DEFAULTS_PATH);
  assert.deepEqual(client.calls[0].body, { group_default_leverage: 250 });
  assert.equal(client.calls[0].config._noRetry, true);
  assert.equal(client.calls[1].method, 'get');
  assert.equal(client.calls[1].url, BROKER_GROUP_DEFAULTS_PATH);
  assert.deepEqual(result, { brokerId: 'broker-a', defaultLeverage: 250 });
});

test('save: blank clears with null (never 0)', async () => {
  const client = fakeClient(async () => ({ data: { broker_id: 'broker-a', group_default_leverage: null } }));
  const result = await createBrokerGroupDefaultsApi(client).save('  ');
  assert.deepEqual(client.calls[0].body, { group_default_leverage: null });
  assert.equal(result.defaultLeverage, null);
});

test('save: invalid input is refused locally with no request', async () => {
  for (const bad of [0, '0', '10001', '-5', '1.5', 'abc']) {
    const client = fakeClient(async () => { throw new Error('must not be called'); });
    await assert.rejects(createBrokerGroupDefaultsApi(client).save(bad), (error) => error.code === 'GROUP_POLICY_DEFAULT_INVALID' && /1.*10000/.test(error.message));
    assert.equal(client.calls.length, 0, `no request for ${JSON.stringify(bad)}`);
  }
});

test('save: re-read mismatch is reported', async () => {
  const client = fakeClient(async (call) => ({ data: { broker_id: 'broker-a', group_default_leverage: call.method === 'put' ? 250 : 400 } }));
  await assert.rejects(createBrokerGroupDefaultsApi(client).save('250'), (error) => error.code === 'GROUP_DEFAULTS_VERIFY_MISMATCH');
});

test('typed backend codes map to operator text (never raw driver text)', async () => {
  const codes = [
    [400, 'GROUP_POLICY_DEFAULT_INVALID', /1.*10000/],
    [403, 'MT_RET_ERR_PERMISSIONS', /permission/i],
    [403, 'GROUP_DEFAULTS_TENANT_FORBIDDEN', /own broker/i],
    [404, 'GROUP_DEFAULTS_BROKER_UNKNOWN', /broker/i],
    [503, 'GROUP_DEFAULTS_MIGRATION_MISSING', /migration/i],
    [503, 'GROUP_DEFAULTS_UNAVAILABLE', /temporarily unavailable/i],
  ];
  for (const [status, code, text] of codes) {
    for (const op of ['get', 'save']) {
      const client = fakeClient(async () => { throw backendError(status, code); });
      const run = createBrokerGroupDefaultsApi(client);
      await assert.rejects(op === 'get' ? run.get() : run.save('200'), (error) => {
        assert.equal(error.code, code);
        assert.equal(error.status, status);
        assert.match(error.message, text);
        assert.doesNotMatch(error.message, /pq:|driver|stack/i);
        return true;
      });
    }
    assert.match(brokerGroupDefaultsError(code), text);
  }
});

test('unknown codes and network failures use a generic fallback, not the backend text', async () => {
  const unknown = fakeClient(async () => { throw backendError(500, 'SOMETHING_NEW', 'pq: relation does not exist'); });
  await assert.rejects(createBrokerGroupDefaultsApi(unknown).get(), (error) => !/pq:/.test(error.message) && /broker defaults/i.test(error.message));
  const offline = fakeClient(async () => { throw new Error('Network Error'); });
  await assert.rejects(createBrokerGroupDefaultsApi(offline).save('10'), (error) => /default leverage/i.test(error.message));
});

test('default client: the real api client sends GET/PUT to the group-defaults route', async () => {
  useAuthStore.setState({ user: { id: 1, login: 1, broker_id: 'broker-a', role: 'manager', permissions: ['server_admin'] }, isAuthenticated: true, accessToken: 'synthetic-token' });
  const seen = [];
  const id = api.interceptors.request.use((config) => ({ ...config, adapter: async (request) => {
    seen.push({ method: request.method, url: request.url, data: request.data, params: request.params });
    return { data: { broker_id: 'broker-a', group_default_leverage: 75 }, status: 200, statusText: 'OK', headers: {}, config: request };
  } }));
  try {
    const service = createBrokerGroupDefaultsApi();
    assert.deepEqual(await service.get(), { brokerId: 'broker-a', defaultLeverage: 75 });
    await service.save(75);
  } finally {
    api.interceptors.request.eject(id);
  }
  assert.deepEqual(seen.map((r) => r.method), ['get', 'put', 'get']);
  for (const request of seen) {
    assert.match(request.url, /\/api\/v1\/manager\/broker\/group-defaults$/);
    assert.equal(request.params, undefined);
  }
  assert.deepEqual(JSON.parse(seen[1].data), { group_default_leverage: 75 });
});
