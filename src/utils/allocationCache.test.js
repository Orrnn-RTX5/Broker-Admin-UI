import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

const browserStorage = new Map();
const sessionStorage = new Map();
const storageFrom = (values) => ({
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
});
globalThis.localStorage = storageFrom(browserStorage);
globalThis.sessionStorage = storageFrom(sessionStorage);

const {
  ALLOCATION_CACHE_SIZE_LIMIT, ALLOCATION_CACHE_TTL_MS, ALLOCATION_CACHE_VERSION,
  clearAllocationCache, countsFromAllocationRows, forgetAllocationMemory,
  initialAllocationState, readAllocationCache, writeAllocationCache,
} = await import('./allocationCache.js');
const { createCacheIdentity, getStoredCacheIdentity } = await import('./cacheIdentity.js');
const { writeGroupListSnapshot } = await import('./groupListCache.js');

const user = {
  broker_id: 'broker-a', login: 9001, role: 'admin', is_admin: true,
  permissions: ['view_groups', 'manage_groups'], group_access_mode: 'all_within_broker',
  authorization_version: 1, operational_ready: true,
};
const signIn = (nextUser = user, token = 'session-token') => {
  browserStorage.set('rtx5-auth-storage', JSON.stringify({ state: {
    user: nextUser, accessToken: token, isAuthenticated: true,
  } }));
  browserStorage.set('authToken', token);
  browserStorage.set('brokerId', nextUser.broker_id);
  browserStorage.set('brokerLogin', String(nextUser.login));
  sessionStorage.set('auth', JSON.stringify({ token, login: nextUser.login, broker_id: nextUser.broker_id }));
};
const sampleRows = (count = 12) => Array.from({ length: count }, (_, index) => ({
  id: `Group ${index}`, name: `Group ${index}`, description: 'Desk',
  type: index % 2 ? 'Demo' : 'Real', currency: 'USD', leverage: 100,
  execution: 'Market', marginCall: 50, stopOut: 20, tradeAllowed: true, accounts: index,
  record: { name: `Group ${index}`, symbols: 'x'.repeat(5000), privateSetting: 'backend-only' },
}));
const savedEntry = () => [...browserStorage.entries()].find(([key]) => key.startsWith('rtx5-admin-allocations:'));

beforeEach(() => {
  browserStorage.clear();
  sessionStorage.clear();
  forgetAllocationMemory();
  signIn();
});

test('case and space twin groups are saved and restored as separate rows, each with its own count', () => {
  const twin = (name, accounts) => ({ ...sampleRows(1)[0], id: name, name, accounts });
  writeAllocationCache({ rows: [twin('Arijit', 2), twin('arijit', 0), twin('Arijit ', 1)], accountsKnown: true });
  forgetAllocationMemory();
  const state = initialAllocationState();
  assert.equal(state.loading, false, 'the twin snapshot is accepted, not refused as a duplicate');
  assert.deepEqual(state.rows.map(row => [row.name, row.accounts]), [['Arijit', 2], ['arijit', 0], ['Arijit ', 1]]);
});

test('a version-2 allocation snapshot from the folded code is rejected, so the live list loads at once', () => {
  writeAllocationCache({ rows: [{ ...sampleRows(1)[0], id: 'Arijit', name: 'Arijit', accounts: 2 }], accountsKnown: true });
  const [key, serialized] = savedEntry();
  assert.equal(JSON.parse(serialized).version, ALLOCATION_CACHE_VERSION);
  assert.equal(ALLOCATION_CACHE_VERSION, 3);
  browserStorage.set(key, JSON.stringify({ ...JSON.parse(serialized), version: 2 }));
  forgetAllocationMemory();
  assert.equal(readAllocationCache(), null, 'the version-2 snapshot is not read');
  const state = initialAllocationState();
  assert.equal(state.loading, true, 'no snapshot: the live list is requested');
  assert.equal(state.rows.length, 0);
});

test('countsFromAllocationRows keys each count by the exact group name', () => {
  const counts = countsFromAllocationRows([{ name: 'Arijit', accounts: 2 }, { name: 'arijit', accounts: 0 }, { name: 'Arijit ', accounts: 1 }]);
  assert.deepEqual([...counts.entries()], [['Arijit', 2], ['arijit', 0], ['Arijit ', 1]]);
});

test('a hard reload restores 12 allocation rows in under 20ms with complete display metadata', () => {
  writeAllocationCache({ rows: sampleRows(), accountsKnown: true });
  const [key, serialized] = savedEntry();
  assert.ok(!key.includes('session-token'));
  assert.equal(serialized.includes('backend-only'), false);
  assert.equal(serialized.includes('xxxxx'), false);
  assert.equal(JSON.parse(serialized).version, ALLOCATION_CACHE_VERSION);
  forgetAllocationMemory();

  const started = performance.now();
  const state = initialAllocationState();
  const elapsed = performance.now() - started;
  assert.equal(state.loading, false);
  assert.equal(state.accountsKnown, true);
  assert.equal(state.rows.length, 12);
  assert.equal(state.rows[3].accounts, 3);
  assert.equal(state.rows[0].record.name, 'Group 0');
  assert.equal(state.rows[0].record._allocationSummary, true);
  assert.equal(state.rows[0].record.symbols, undefined);
  assert.ok(elapsed < 20, `restoring the saved table took ${elapsed}ms`);
});

test('successful empty results restore as loaded, including known zero accounts', () => {
  writeAllocationCache({ rows: [], accountsKnown: true });
  forgetAllocationMemory();
  const state = initialAllocationState();
  assert.equal(state.loading, false);
  assert.equal(state.accountsKnown, true);
  assert.deepEqual(state.rows, []);
});

test('snapshots isolate broker, login and authorization changes', () => {
  writeAllocationCache({ rows: sampleRows(), accountsKnown: true });
  for (const change of [
    { broker_id: 'broker-b' }, { login: 9002 }, { role: 'manager' }, { is_admin: false },
    { permissions: ['view_groups'] }, { allowed_groups: ['Group 0'], group_access_mode: 'restricted' },
    { access_fingerprint: 'revised-rights' }, { operational_ready: false }, { authorization_version: 2 },
  ]) {
    signIn({ ...user, ...change });
    assert.equal(readAllocationCache(), null, `scope change ${JSON.stringify(change)} reused rows`);
    forgetAllocationMemory();
    assert.equal(readAllocationCache(), null);
  }
  signIn(user);
  assert.equal(readAllocationCache().rows.length, 12);
});

test('a late request writes to its captured identity and cannot overwrite a new session', () => {
  const previousIdentity = getStoredCacheIdentity();
  const nextUser = { ...user, login: 9002 };
  signIn(nextUser, 'next-token');
  const nextRows = sampleRows(1).map(row => ({ ...row, name: 'New group', id: 'New group' }));
  writeAllocationCache({ rows: nextRows, accountsKnown: true });
  writeAllocationCache({ identity: previousIdentity, rows: sampleRows(), accountsKnown: true });
  assert.equal(readAllocationCache().rows[0].name, 'New group');
  forgetAllocationMemory();
  assert.equal(readAllocationCache().rows[0].name, 'New group');
  assert.equal(readAllocationCache({ identity: previousIdentity }).rows.length, 12);
});

test('scope identity is stable through token rotation and permission ordering', () => {
  const identity = getStoredCacheIdentity();
  signIn({ ...user, permissions: [...user.permissions].reverse() }, 'rotated-token');
  assert.equal(getStoredCacheIdentity(), identity);
  assert.equal(createCacheIdentity({ ...user, allowed_groups: ['b', 'a'] }),
    createCacheIdentity({ ...user, allowed_groups: ['a', 'b'] }));
  assert.equal(createCacheIdentity({ user, accessToken: null, isAuthenticated: false }), null);
});

test('missing or inconsistent authenticated identity never uses a shared or legacy snapshot', () => {
  writeAllocationCache({ rows: sampleRows(), accountsKnown: true });
  browserStorage.set('rtx5-admin-allocations:shared', JSON.stringify({ rows: sampleRows(), accountsKnown: true }));
  browserStorage.set('rtx5-admin-allocations:9001', JSON.stringify({ rows: sampleRows(), accountsKnown: true }));
  browserStorage.delete('rtx5-auth-storage');
  browserStorage.delete('authToken');
  sessionStorage.clear();
  assert.equal(readAllocationCache(), null);
  assert.equal(initialAllocationState().loading, true);
  assert.equal(writeAllocationCache({ rows: sampleRows(), accountsKnown: true }), null);

  signIn();
  sessionStorage.set('auth', JSON.stringify({ token: 'other-token', login: 9002, broker_id: user.broker_id }));
  assert.equal(getStoredCacheIdentity(), null);
  assert.equal(readAllocationCache(), null);
});

test('version, timestamp and malformed row validation reject unsafe snapshots', () => {
  writeAllocationCache({ rows: sampleRows(1), accountsKnown: true });
  const [key, saved] = savedEntry();
  const valid = JSON.parse(saved);
  const corruptions = [
    { version: ALLOCATION_CACHE_VERSION - 1 }, { identity: 'another-user' },
    { at: Date.now() - ALLOCATION_CACHE_TTL_MS - 1 }, { at: Date.now() + 60_000 },
    { at: 0 }, { accountsKnown: 'true' },
    { rows: [{ ...valid.rows[0], accounts: -1 }] },
    { rows: [{ ...valid.rows[0], accounts: 0.5 }] },
    { rows: [{ ...valid.rows[0], leverage: '100' }] },
    { rows: [{ ...valid.rows[0], name: '' }] },
    { rows: [{ ...valid.rows[0], tradeAllowed: 'true' }] },
    { rows: [valid.rows[0], { ...valid.rows[0] }] },
  ];
  for (const change of corruptions) {
    browserStorage.set(key, JSON.stringify({ ...valid, ...change }));
    forgetAllocationMemory();
    assert.equal(readAllocationCache(), null, `accepted ${JSON.stringify(change)}`);
  }
  browserStorage.set(key, '{invalid');
  assert.equal(readAllocationCache(), null);
  browserStorage.set(key, ' '.repeat(ALLOCATION_CACHE_SIZE_LIMIT + 1));
  assert.equal(readAllocationCache(), null);
});

test('invalid counts and oversized records are refused before persistence', () => {
  assert.equal(writeAllocationCache({ rows: sampleRows(5001), accountsKnown: true }), null);
  assert.equal(writeAllocationCache({ rows: [{ ...sampleRows(1)[0], accounts: NaN }], accountsKnown: true }), null);
  assert.equal(writeAllocationCache({ rows: [{ ...sampleRows(1)[0], accounts: null }], accountsKnown: true }), null);
  assert.equal(writeAllocationCache({ rows: [{ ...sampleRows(1)[0], description: 'x'.repeat(5000) }] }), null);
  assert.equal(readAllocationCache(), null);
});

test('denial cleanup removes memory and disk for only the refused identity', () => {
  const previousIdentity = getStoredCacheIdentity();
  writeAllocationCache({ rows: sampleRows(), accountsKnown: true });
  signIn({ ...user, login: 9002 }, 'next-token');
  writeAllocationCache({ rows: sampleRows(1), accountsKnown: true });
  clearAllocationCache({ identity: previousIdentity });
  assert.equal(readAllocationCache({ identity: previousIdentity }), null);
  assert.equal(readAllocationCache().rows.length, 1);
  forgetAllocationMemory();
  assert.equal(readAllocationCache({ identity: previousIdentity }), null);
  assert.equal(readAllocationCache().rows.length, 1);
});

test('memory keeps the backend group record for immediate editing in this session', () => {
  const rows = sampleRows(1);
  writeAllocationCache({ rows, accountsKnown: true });
  assert.equal(readAllocationCache().rows[0].record, rows[0].record);
  assert.equal(readAllocationCache().rows[0].record._allocationSummary, undefined);
});

test('navigation snapshots can paint allocations with unknown account counts', () => {
  writeGroupListSnapshot([
    { groupName: 'YoPips/demo', group: { name: 'YoPips/demo', currency: 'usd', leverage: 100 } },
  ], getStoredCacheIdentity());
  const state = initialAllocationState();
  assert.equal(state.loading, false);
  assert.equal(state.rows[0].name, 'YoPips/demo');
  assert.equal(state.rows[0].currency, 'USD');
  assert.equal(state.accountsKnown, false);
});

test('account counts already on screen are reused by group name only when valid', () => {
  const counts = countsFromAllocationRows([
    { name: 'Orrnn/demo-std', accounts: 9 }, { name: 'Arijit', accounts: 1 },
  ]);
  assert.equal(counts.get('Orrnn/demo-std'), 9);
  assert.equal(counts.get('orrnn/demo-std'), undefined, 'a case twin has no carried count');
  for (const accounts of [null, NaN, -1, 0.5, Infinity]) {
    assert.equal(countsFromAllocationRows([{ name: 'Arijit', accounts }]), null);
  }
});
