// Run with: node --test src/utils/groupSymbolOverrides.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyStagedOverride,
  buildGroupSymbolOverrideChanges,
  filterGroupSymbolRows,
  isGroupSymbolEditable,
  normalizeGroupSymbolOverrides,
  summarizeGroupSymbols,
  toggleStagedOverride,
} from './groupSymbolOverrides.js';

const response = {
  group: 'VIP',
  legacy_allow_list: false,
  allow_list_count: 0,
  blocked: [],
  feed_scoped: false,
  symbols: [
    { symbol: 'AAPL.US', category: 'stock', global_enabled: false, group_override: null, effective: false, status: 'disabled_globally' },
    { symbol: 'BTCUSD', category: 'crypto', global_enabled: true, group_override: null, effective: true, status: 'global' },
    { symbol: 'EURUSD', category: 'forex', global_enabled: true, group_override: 'off', effective: false, status: 'override_off' },
    { symbol: 'XAUUSD', category: 'metal', global_enabled: true, group_override: null, effective: false, status: 'not_in_allow_list' },
  ],
};

const rows = () => normalizeGroupSymbolOverrides(response).rows;
const bySymbol = (list, symbol) => list.find((row) => row.symbol === symbol);

test('normalizes the Get response', () => {
  const view = normalizeGroupSymbolOverrides(response);
  assert.equal(view.rows.length, 4);
  assert.equal(view.legacyAllowList, false);
  assert.deepEqual(bySymbol(view.rows, 'EURUSD'), { symbol: 'EURUSD', category: 'forex', globalEnabled: true, override: 'off', status: 'override_off', effective: false });
  assert.deepEqual(normalizeGroupSymbolOverrides(null).rows, []);
});

test('only global and override rows are editable', () => {
  const list = rows();
  assert.equal(isGroupSymbolEditable(bySymbol(list, 'BTCUSD')), true);
  assert.equal(isGroupSymbolEditable(bySymbol(list, 'EURUSD')), true);
  assert.equal(isGroupSymbolEditable(bySymbol(list, 'AAPL.US')), false);
  assert.equal(isGroupSymbolEditable(bySymbol(list, 'XAUUSD')), false);
});

test('turning a symbol off stages trade_allowed=false', () => {
  const list = rows();
  const staged = toggleStagedOverride(new Map(), bySymbol(list, 'BTCUSD'));
  assert.deepEqual(buildGroupSymbolOverrideChanges(staged), [{ symbol: 'BTCUSD', trade_allowed: false }]);
  const shown = applyStagedOverride(bySymbol(list, 'BTCUSD'), staged);
  assert.equal(shown.effective, false);
  assert.equal(shown.status, 'override_off');
  assert.equal(shown.staged, true);
});

test('clearing an override stages trade_allowed=true and follows global', () => {
  const list = rows();
  const staged = toggleStagedOverride(new Map(), bySymbol(list, 'EURUSD'));
  assert.deepEqual(buildGroupSymbolOverrideChanges(staged), [{ symbol: 'EURUSD', trade_allowed: true }]);
  const shown = applyStagedOverride(bySymbol(list, 'EURUSD'), staged);
  assert.equal(shown.effective, true);
  assert.equal(shown.status, 'global');
});

test('toggling twice leaves nothing to save', () => {
  const row = bySymbol(rows(), 'BTCUSD');
  const once = toggleStagedOverride(new Map(), row);
  const twice = toggleStagedOverride(once, row);
  assert.equal(twice.size, 0);
  assert.deepEqual(buildGroupSymbolOverrideChanges(twice), []);
});

test('rows blocked above the group cannot be toggled', () => {
  const list = rows();
  assert.equal(toggleStagedOverride(new Map(), bySymbol(list, 'AAPL.US')).size, 0);
  assert.equal(toggleStagedOverride(new Map(), bySymbol(list, 'XAUUSD')).size, 0);
  const staged = new Map([['AAPL.US', null]]);
  assert.equal(applyStagedOverride(bySymbol(list, 'AAPL.US'), staged).effective, false);
});

test('filters and summary', () => {
  const list = rows();
  assert.deepEqual(filterGroupSymbolRows(list, 'usd', 'all').map((r) => r.symbol), ['BTCUSD', 'EURUSD', 'XAUUSD']);
  assert.deepEqual(filterGroupSymbolRows(list, 'crypto', 'all').map((r) => r.symbol), ['BTCUSD']);
  assert.deepEqual(filterGroupSymbolRows(list, '', 'on').map((r) => r.symbol), ['BTCUSD']);
  assert.deepEqual(filterGroupSymbolRows(list, '', 'overrides').map((r) => r.symbol), ['EURUSD']);
  assert.deepEqual(summarizeGroupSymbols(list), { total: 4, tradeable: 1, overrides: 1 });
});
