import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDealActionLabel, formatDealEntryLabel } from './dealDisplayLabels.js';

test('Deal action and entry enums get human-readable table labels', () => {
  assert.equal(formatDealActionLabel('deal_buy'), 'Buy');
  assert.equal(formatDealActionLabel('deal_sell'), 'Sell');
  assert.equal(formatDealEntryLabel('entry_in'), 'In');
  assert.equal(formatDealEntryLabel('entry_out'), 'Out');
});

test('Unknown and absent deal enums remain unchanged', () => {
  assert.equal(formatDealActionLabel('deal_balance'), 'deal_balance');
  assert.equal(formatDealEntryLabel('entry_inout'), 'entry_inout');
  assert.equal(formatDealActionLabel('constructor'), 'constructor');
  assert.equal(formatDealEntryLabel('toString'), 'toString');
  assert.equal(formatDealActionLabel(undefined), undefined);
  assert.equal(formatDealEntryLabel(null), null);
});
