/* global Buffer */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// The service talks to the shared Bearer `api` client; tests inject a fake
// client so no network, session, or store is needed.
const source = (await readFile(new URL('./closeCounterparts.service.js', import.meta.url), 'utf8'))
  .replace("import { api } from '../lib/api.js';", 'const api = {};');
const {
  createCloseCounterpartsApi,
  closeCounterpartsError,
  isCanonicalCloseCounterpartPurpose,
  isCanonicalCloseCounterpartScope,
  normalizeCloseCounterpartsView,
  CLOSE_COUNTERPARTS_PATH,
  CLOSE_COUNTERPART_PURPOSE_KEYS,
} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const POLICY_VERSION_ID = '11111111-1111-1111-1111-111111111111';
const fixtureRow = (overrides = {}) => ({
  broker_id: 'broker-a',
  tenant_id: 'broker-a',
  legal_entity_id: 'entity-a',
  policy_version_id: POLICY_VERSION_ID,
  profit_purpose: 'PROFIT_A',
  swap_purpose: 'SWAP_A',
  commission_purpose: 'COMMISSION_A',
  fee_purpose: 'FEE_A',
  enabled: true,
  updated_by: 7,
  updated_at: '2026-10-18T12:34:56.123456Z',
  ...overrides,
});

const backendError = (status, code, message) => {
  const error = new Error(message || code);
  error.response = { status, data: { code, message: message || code } };
  return error;
};

const fakeClient = (impl) => {
  const calls = [];
  const wrap = (method) => async (url, body, config) => {
    calls.push({ method, url, body, config });
    return impl({ method, url, body, config });
  };
  return { calls, get: wrap('get'), put: wrap('put') };
};

const draft = () => ({
  tenantId: 'broker-a',
  legalEntityId: 'entity-a',
  purposes: {
    profit_purpose: 'PROFIT_A',
    swap_purpose: 'SWAP_A',
    commission_purpose: 'COMMISSION_A',
    fee_purpose: 'FEE_A',
  },
  enabled: true,
});

test('get reads one tenant mapping by legal entity only, never naming a broker', async () => {
  const client = fakeClient(async () => ({ data: fixtureRow() }));
  const row = await createCloseCounterpartsApi(client).get('entity-a');
  assert.equal(client.calls[0].method, 'get');
  assert.equal(client.calls[0].url, CLOSE_COUNTERPARTS_PATH);
  // client.get(url, config): the recorder stores config as `body`.
  assert.deepEqual(client.calls[0].body.params, { legal_entity_id: 'entity-a' });
  assert.ok(!('broker_id' in (client.calls[0].body.params || {})), 'tenant scope: no broker_id in query');
  assert.deepEqual(client.calls[0].body._expectedStatuses, [404]);
  assert.equal(row.policy_version_id, POLICY_VERSION_ID);
});

test('get resolves null on typed 404 unconfigured (empty state, not an error)', async () => {
  const client = fakeClient(async () => { throw backendError(404, 'CLOSE_COUNTERPARTS_UNCONFIGURED'); });
  assert.equal(await createCloseCounterpartsApi(client).get('entity-a'), null);
});

test('get throws operator-facing errors for other failures', async () => {
  for (const [status, code, match] of [
    [400, 'CLOSE_COUNTERPARTS_ENTITY_REQUIRED', /legal entity/],
    [403, 'CLOSE_COUNTERPARTS_TENANT_FORBIDDEN', /own broker/],
    [503, 'CLOSE_COUNTERPARTS_MIGRATION_MISSING', /migration 516/],
    [503, 'CLOSE_COUNTERPARTS_UNAVAILABLE', /temporarily unavailable/],
  ]) {
    const client = fakeClient(async () => { throw backendError(status, code); });
    await assert.rejects(createCloseCounterpartsApi(client).get('entity-a'), match, code);
  }
  const other404 = fakeClient(async () => { throw backendError(404, 'CLOSE_COUNTERPARTS_BROKER_UNKNOWN'); });
  await assert.rejects(createCloseCounterpartsApi(other404).get('entity-a'), /does not exist/);
});

test('save PUTs the tenant body without broker_id, then verifies with a re-read', async () => {
  const stored = fixtureRow();
  const client = fakeClient(async () => ({ data: stored }));
  const { stored: got, verified } = await createCloseCounterpartsApi(client).save(draft());
  assert.equal(client.calls[0].method, 'put');
  assert.equal(client.calls[0].url, CLOSE_COUNTERPARTS_PATH);
  assert.deepEqual(client.calls[0].body, {
    tenant_id: 'broker-a',
    legal_entity_id: 'entity-a',
    profit_purpose: 'PROFIT_A',
    swap_purpose: 'SWAP_A',
    commission_purpose: 'COMMISSION_A',
    fee_purpose: 'FEE_A',
    enabled: true,
  });
  assert.ok(!('broker_id' in client.calls[0].body), 'tenant scope: broker_id is never sent');
  assert.equal(client.calls[0].config._noRetry, true, 'a guarded write is never retried blindly');
  assert.equal(client.calls[1].method, 'get', 'verify step re-reads the effective row');
  assert.equal(got.policy_version_id, POLICY_VERSION_ID);
  assert.equal(verified.policy_version_id, POLICY_VERSION_ID);
});

test('save omits tenant_id when the session broker is unknown and disables explicitly', async () => {
  const stored = fixtureRow({ enabled: false });
  const client = fakeClient(async () => ({ data: stored }));
  const input = draft();
  delete input.tenantId;
  input.enabled = false;
  await createCloseCounterpartsApi(client).save(input);
  assert.ok(!('tenant_id' in client.calls[0].body), 'tenant_id is optional for a tenant session');
  assert.equal(client.calls[0].body.enabled, false, 'disable keeps the row and audit history');
});

test('save rejects bad purpose text locally without a write', async () => {
  for (const bad of ['', '  ', 'has space', 'lower space x', 'x'.repeat(129), 'ünïcode', 'TAB\there']) {
    const client = fakeClient(async () => ({ data: fixtureRow() }));
    const input = draft();
    input.purposes.profit_purpose = bad;
    await assert.rejects(createCloseCounterpartsApi(client).save(input), /non-empty printable text/, JSON.stringify(bad));
    assert.equal(client.calls.length, 0, 'no request leaves the browser for invalid input');
  }
});

test('save maps typed backend refusals and writes nothing on purpose/policy failures', async () => {
  for (const [status, code, match] of [
    [400, 'CLOSE_COUNTERPARTS_PURPOSE_UNKNOWN', /SYSTEM-scoped/],
    [409, 'CLOSE_COUNTERPARTS_NO_ACTIVE_POLICY', /no active canonical policy/],
    [409, 'CLOSE_COUNTERPARTS_POLICY_AMBIGUOUS', /ambiguous/],
    [409, 'CLOSE_COUNTERPARTS_POLICY_CHANGED', /changed while validating/],
    [403, 'CLOSE_COUNTERPARTS_TENANT_FORBIDDEN', /own broker/],
  ]) {
    const client = fakeClient(async ({ method }) => {
      if (method === 'put') throw backendError(status, code);
      return { data: fixtureRow() };
    });
    const error = await createCloseCounterpartsApi(client).save(draft()).catch((e) => e);
    assert.match(error.message, match, code);
    assert.equal(error.code, code);
    assert.equal(client.calls.filter((c) => c.method === 'put').length, 1);
  }
});

test('save raises a verify mismatch when the re-read differs', async () => {
  const client = fakeClient(async ({ method }) => ({
    data: method === 'put' ? fixtureRow() : fixtureRow({ profit_purpose: 'PROFIT_CHANGED' }),
  }));
  const error = await createCloseCounterpartsApi(client).save(draft()).catch((e) => e);
  assert.equal(error.code, 'CLOSE_COUNTERPARTS_VERIFY_MISMATCH');
});

test('validators mirror the backend canonical-text rules', () => {
  assert.equal(isCanonicalCloseCounterpartPurpose('PROFIT_A'), true);
  assert.equal(isCanonicalCloseCounterpartPurpose('  PROFIT_A  '.trim()), true);
  assert.equal(isCanonicalCloseCounterpartPurpose(''), false);
  assert.equal(isCanonicalCloseCounterpartPurpose('HAS SPACE'), false);
  assert.equal(isCanonicalCloseCounterpartPurpose('x'.repeat(129)), false);
  assert.equal(isCanonicalCloseCounterpartScope('entity-a'), true);
  assert.equal(isCanonicalCloseCounterpartScope(''), false);
  assert.equal(CLOSE_COUNTERPART_PURPOSE_KEYS.length, 4);
});

test('normalize rejects malformed rows and maps every typed code', () => {
  assert.throws(() => normalizeCloseCounterpartsView(null), /Invalid/);
  assert.throws(() => normalizeCloseCounterpartsView(fixtureRow({ enabled: 'yes' })), /Invalid/);
  assert.match(closeCounterpartsError('CLOSE_COUNTERPARTS_UNCONFIGURED', 'x'), /onboarding will keep failing/);
  assert.match(closeCounterpartsError('ACCOUNT_ONBOARDING_CONFIG_MISSING', 'x'), /refused until/);
  assert.equal(closeCounterpartsError('SOME_FUTURE_CODE', 'fallback-here'), 'fallback-here');
});
