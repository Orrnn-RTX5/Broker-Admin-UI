// Run with: node --test src/utils/groupSymbolOverrides.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyStagedOverride,
  buildGroupSymbolOverrideChanges,
  filterGroupSymbolRows,
  isGroupSymbolEditable,
  normalizeGroupSymbolOverrides,
  stageGroupSymbolStopsOverride,
  summarizeGroupSymbols,
  toggleStagedOverride,
  validateGroupSymbolStopsOverride,
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
  assert.deepEqual(bySymbol(view.rows, 'EURUSD'), { symbol: 'EURUSD', category: 'forex', globalEnabled: true, override: 'off', status: 'override_off', effective: false, groupTrading: true });
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

test('group trading off: nothing becomes effective, overrides can still be staged', () => {
  const view = normalizeGroupSymbolOverrides({ ...response, group_trading: false });
  assert.equal(view.groupTrading, false);
  const btc = bySymbol(view.rows, 'BTCUSD');
  const eur = bySymbol(view.rows, 'EURUSD');
  assert.equal(isGroupSymbolEditable(btc), true);
  const staged = toggleStagedOverride(new Map(), eur);
  assert.equal(applyStagedOverride(eur, staged).effective, false, 'reset does not make it tradeable while group trading is off');
  assert.equal(applyStagedOverride(eur, staged).status, 'global');
  assert.equal(normalizeGroupSymbolOverrides(response).groupTrading, true, 'absent flag defaults to on');
});

test('stops_level_points override normalization, staging, reset to null, and compound changes', () => {
  const view = normalizeGroupSymbolOverrides({
    ...response,
    symbols: [
      { symbol: 'BTCUSD', category: 'crypto', global_enabled: true, group_override: null, effective: true, status: 'global', stops_level_points: null, instrument_stops_level_points: 15 },
      { symbol: 'EURUSD', category: 'forex', global_enabled: true, group_override: 'off', effective: false, status: 'override_off', stops_level_points: 30, instrument_stops_level_points: 10 },
    ],
  });
  const btc = bySymbol(view.rows, 'BTCUSD');
  const eur = bySymbol(view.rows, 'EURUSD');
  assert.equal(btc.stopsLevelPoints, null);
  assert.equal(btc.instrumentStopsLevelPoints, 15);
  assert.equal(eur.stopsLevelPoints, 30);
  assert.equal(eur.instrumentStopsLevelPoints, 10);

  let staged = stageGroupSymbolStopsOverride(new Map(), btc, 25);
  assert.deepEqual(buildGroupSymbolOverrideChanges(staged), [
    { symbol: 'BTCUSD', stops_level_points: 25 },
  ]);
  const shownBtc = applyStagedOverride(btc, staged);
  assert.equal(shownBtc.stopsLevelPoints, 25);
  assert.equal(shownBtc.staged, true);

  // Compound change: also toggle trading off on BTCUSD while keeping stops_level_points=25
  const compound = toggleStagedOverride(staged, shownBtc);
  assert.deepEqual(buildGroupSymbolOverrideChanges(compound), [
    { symbol: 'BTCUSD', trade_allowed: false, stops_level_points: 25 },
  ]);

  // Revert stops back to original null on staged -> removes staged entry
  staged = stageGroupSymbolStopsOverride(staged, shownBtc, null);
  assert.equal(staged.size, 0);

  // Reset EURUSD stops override to null while leaving trade_allowed untouched
  const stagedReset = stageGroupSymbolStopsOverride(new Map(), eur, null);
  assert.deepEqual(buildGroupSymbolOverrideChanges(stagedReset), [
    { symbol: 'EURUSD', stops_level_points: null },
  ]);

  assert.deepEqual(validateGroupSymbolStopsOverride(''), { value: null, error: null });
  assert.deepEqual(validateGroupSymbolStopsOverride('0'), { value: 0, error: null });
  assert.deepEqual(validateGroupSymbolStopsOverride('50'), { value: 50, error: null });
  assert.ok(validateGroupSymbolStopsOverride('-1').error);
  assert.ok(validateGroupSymbolStopsOverride('1.5').error);
});
