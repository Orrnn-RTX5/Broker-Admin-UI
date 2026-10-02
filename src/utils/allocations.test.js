import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countAccountsByGroup, filterAllocationGroups, normalizeAllocationGroups } from './allocations.js';

test('groups carry live fields and case-insensitive account counts', () => {
  const counts = countAccountsByGroup([{ group: 'orrnn/demo-std' }, { Group: 'Orrnn/demo-std' }, { group: 'Arijit' }]);
  const [group, real] = normalizeAllocationGroups([
    { name: 'Orrnn/demo-std', description: 'Standard', currency: 'usd', leverage: '500', executionMode: 'market', marginCallLevel: 100, stopOutLevel: 50, tradeAllowed: true },
    { name: 'Arijit', demo: false, tradeAllowed: 'false' },
    { name: 'arijit' },
  ], counts);
  assert.deepEqual(
    [group.type, group.currency, group.leverage, group.execution, group.marginCall, group.stopOut, group.accounts, group.tradeAllowed],
    ['Demo', 'USD', 500, 'Market', 100, 50, 2, true]
  );
  assert.deepEqual([real.type, real.accounts, real.tradeAllowed, real.leverage], ['Real', 1, false, null]);
});

test('filters and sorting keep empty values last in both directions', () => {
  const groups = normalizeAllocationGroups([
    { name: 'b', leverage: 100, currency: 'USD' },
    { name: 'a', currency: 'EUR' },
    { name: 'demo\\c', leverage: 500, currency: 'USD' },
  ]);
  assert.deepEqual(filterAllocationGroups(groups, { sortKey: 'leverage' }).map(g => g.name), ['b', 'demo\\c', 'a']);
  assert.deepEqual(filterAllocationGroups(groups, { sortKey: 'leverage', sortDirection: 'desc' }).map(g => g.name), ['demo\\c', 'b', 'a']);
  assert.deepEqual(filterAllocationGroups(groups, { type: 'Demo' }).map(g => g.name), ['demo\\c']);
  assert.deepEqual(filterAllocationGroups(groups, { currency: 'USD', query: 'B' }).map(g => g.name), ['b']);
});
