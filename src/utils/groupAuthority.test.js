import test from 'node:test';
import assert from 'node:assert/strict';
import { accountCreationWarning, groupFieldState, inheritedFieldReset, subgroupCreatePayload } from './groupAuthority.js';

const revision = 'lcr1:0123456789abcdef01234567';
test('child creation preserves continuous inheritance instead of freezing parent defaults', () => {
  const defaults = { name: 'real\\child', leverage: 100, currency: 'USD', symbolsAllowed: ['EURUSD'], groupPurpose: 'coverage' };
  assert.deepEqual(subgroupCreatePayload(defaults, 'real'), { name: 'real\\child', parentGroup: 'real', overriddenFields: [] });
  assert.deepEqual(subgroupCreatePayload({ ...defaults, leverage: 200, symbolsAllowed: ['GBPUSD'] }, 'real', ['leverage', 'symbolsAllowed', 'leverage', 'broker_id']), {
    name: 'real\\child', parentGroup: 'real', overriddenFields: ['leverage', 'symbolsAllowed'], leverage: 200, symbolsAllowed: ['GBPUSD'],
  });
  assert.deepEqual(defaults.symbolsAllowed, ['EURUSD']);
});
test('reset sends only the chosen override and current revision, never an old parent snapshot', () => {
  const child = { parentGroup: 'real', overriddenFields: ['symbolsAllowed'], revision };
  assert.match(groupFieldState(child, 'leverage'), /Inherited from real/);
  assert.equal(groupFieldState(child, 'symbolsAllowed'), 'Override');
  assert.deepEqual(inheritedFieldReset(child, 'symbolsAllowed'), { inheritFields: ['symbolsAllowed'], expected_revision: revision });
  assert.throws(() => inheritedFieldReset({ ...child, revision: '' }, 'symbolsAllowed'), /Reload/);
  assert.throws(() => inheritedFieldReset({ ...child, parentGroup: null }, 'leverage'));
});
test('creation keeps the exact missing-route warning visible without inventing one', () => {
  assert.equal(accountCreationWarning({ login: 7, routing_warning: 'no routing rule found' }), 'no routing rule found');
  assert.equal(accountCreationWarning({ login: 7 }), '');
});
