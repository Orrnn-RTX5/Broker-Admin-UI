import { test } from 'node:test';
import assert from 'node:assert/strict';

const browserStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => browserStorage.get(key) ?? null,
  setItem: (key, value) => browserStorage.set(key, value),
  removeItem: (key) => browserStorage.delete(key),
};

const {
  countsFromAllocationRows, forgetAllocationMemory, initialAllocationState, readAllocationCache, writeAllocationCache,
} = await import('./allocationCache.js');

const sampleRows = (count = 10) => Array.from({ length: count }, (_, index) => ({
  id: `Group ${index}`,
  name: `Group ${index}`,
  description: 'Desk',
  type: index % 2 ? 'Demo' : 'Real',
  currency: 'USD',
  leverage: 100,
  marginCall: 50,
  stopOut: 20,
  tradeAllowed: true,
  accounts: index,
  record: { name: `Group ${index}`, symbols: 'x'.repeat(5000) },
}));

test('a cold start reads the saved allocation rows in well under 20ms', () => {
  browserStorage.set('brokerLogin', '9001');
  writeAllocationCache({ rows: sampleRows(10), accountsKnown: true, at: 1000 });
  forgetAllocationMemory();

  const started = performance.now();
  const cached = readAllocationCache();
  const elapsed = performance.now() - started;

  assert.equal(cached.rows.length, 10);
  assert.equal(cached.accountsKnown, true);
  assert.equal(cached.rows[0].record, undefined);
  assert.ok(elapsed < 20, `saved rows took ${elapsed}ms`);
  assert.equal(initialAllocationState().loading, false);
  assert.equal(initialAllocationState().rows[3].accounts, 3);
});

test('account counts already on screen are reused by group name', () => {
  const counts = countsFromAllocationRows([
    { name: 'Orrnn/demo-std', accounts: 9 },
    { name: 'Arijit', accounts: 1 },
  ]);
  assert.equal(counts.get('orrnn/demo-std'), 9);
  assert.equal(countsFromAllocationRows([{ name: 'Arijit', accounts: null }]), null);
});

test('the navigation group list can paint allocations before its own snapshot exists', () => {
  browserStorage.delete('rtx5-admin-allocations:9001');
  forgetAllocationMemory();
  browserStorage.set('rtx5-admin-group-list:9001', JSON.stringify({
    groups: [{ groupName: 'YoPips/demo', group: { name: 'YoPips/demo', currency: 'usd', leverage: 100 } }],
  }));
  const state = initialAllocationState();
  assert.equal(state.loading, false);
  assert.equal(state.rows[0].name, 'YoPips/demo');
  assert.equal(state.rows[0].currency, 'USD');
  assert.equal(state.accountsKnown, false);
});
