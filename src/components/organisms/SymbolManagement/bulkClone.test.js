import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mergeLpSymbols } from '../../../utils/lpSymbols.js';
import {
  BULK_CLONE_MAX_SYMBOLS,
  applyToAllRows,
  buildBulkClonePayload,
  buildCloneCandidates,
  buildCloneRows,
  cloneGroupOf,
  cloneSuffixError,
  cloneSymbolName,
  eligibleSymbols,
  filterCloneCandidates,
  groupSelectionState,
  normalizeBulkCloneResult,
  normalizeCloneCategories,
  pruneSelection,
  selectionError,
  toggleGroupSelection,
  validateCloneCategoryForm,
  validateCloneRow,
  validateCloneRows,
} from './bulkClone.js';

const configured = [
  { symbol: 'EURUSD', category: 'Forex', symbolType: 'base', contractSize: 100000, minVolume: 0.01, maxVolume: 50, volumeStep: 0.01 },
  { symbol: 'GBPUSD', category: 'Forex', symbolType: 'base', contract_size: 100000, min_volume: 0.1, max_volume: 20, volume_step: 0.1 },
  { symbol: 'EURUSD.PRO', category: 'PRO', symbolType: 'derived', parentSymbol: 'EURUSD' },
  { symbol: 'XAUUSD', category: 'metals', symbolType: 'base', contractSize: 100 },
  { symbol: 'VERYLONGSYMBOLNAME1', category: '', symbolType: 'base' },
];
const entries = mergeLpSymbols(['EURUSD', 'GBPUSD', 'XAUUSD', 'BTCUSD', 'US30'], configured);

test('cloneSymbolName upper-cases base and suffix', () => {
  assert.equal(cloneSymbolName('eurusd', '.pro'), 'EURUSD.PRO');
  assert.equal(cloneSymbolName(' XAUUSD ', ' _x '), 'XAUUSD_X');
});

test('cloneSuffixError mirrors the backend suffix rule', () => {
  assert.equal(cloneSuffixError('.pro'), '');
  assert.equal(cloneSuffixError('-v2_x'), '');
  assert.match(cloneSuffixError(''), /required/);
  assert.match(cloneSuffixError('.'), /letter or digit/);
  assert.match(cloneSuffixError('._-'), /letter or digit/);
  assert.match(cloneSuffixError('.pro!'), /only contain/);
  assert.match(cloneSuffixError('.ABCDEFGHIJKL'), /at most 12/);
  assert.equal(cloneSuffixError('ABCDEFGHIJKL'), '');
});

test('validateCloneCategoryForm checks name and duplicate name/suffix', () => {
  const existing = [{ name: 'PRO', suffix: '.PRO' }];
  assert.deepEqual(validateCloneCategoryForm({ name: 'ECN', suffix: '.ecn' }, existing), {});
  assert.deepEqual(Object.keys(validateCloneCategoryForm({ name: ' ', suffix: '.ecn' }, existing)), ['name']);
  assert.match(validateCloneCategoryForm({ name: 'pro', suffix: '.x' }, existing).name, /already exists/);
  assert.match(validateCloneCategoryForm({ name: 'X', suffix: '.pro' }, existing).suffix, /already uses/);
});

test('normalizeCloneCategories reads the list response', () => {
  const rows = normalizeCloneCategories({ categories: [
    { id: 4, name: 'VIP', suffix: '.vip', symbol_count: 2 },
    { id: 3, name: 'PRO', suffix: '.PRO', description: 'Pro', symbol_count: 12 },
    { name: 'no id' },
  ] });
  assert.deepEqual(rows, [
    { id: 3, name: 'PRO', suffix: '.PRO', description: 'Pro', symbolCount: 12 },
    { id: 4, name: 'VIP', suffix: '.VIP', description: '', symbolCount: 2 },
  ]);
  assert.deepEqual(normalizeCloneCategories(null), []);
});

test('cloneGroupOf canonicalises the instrument category and falls back to inference', () => {
  assert.equal(cloneGroupOf({ symbol: 'XAUUSD', instrument: { category: 'metals' } }), 'Metals');
  assert.equal(cloneGroupOf({ symbol: 'BTCUSD', category: '' }), 'Crypto');
  assert.equal(cloneGroupOf({ symbol: 'ABC', instrument: { category: 'Majors' } }), 'Majors');
});

test('buildCloneCandidates groups bases with eligibility per suffix', () => {
  const groups = buildCloneCandidates(entries, '.pro');
  const byName = Object.fromEntries(groups.map((group) => [group.name, group]));
  // Derived clones are not bases.
  assert.ok(!groups.some((group) => group.items.some((item) => item.symbol === 'EURUSD.PRO')));
  assert.deepEqual(byName.Forex.items.map((item) => [item.symbol, item.status, item.cloneName]), [
    ['EURUSD', 'cloned', 'EURUSD.PRO'],
    ['GBPUSD', 'eligible', 'GBPUSD.PRO'],
  ]);
  assert.equal(byName.Forex.eligible, 1);
  assert.equal(byName.Metals.items[0].status, 'eligible');
  assert.equal(byName.Crypto.items[0].status, 'unconfigured');
  const long = groups.flatMap((group) => group.items).find((item) => item.symbol === 'VERYLONGSYMBOLNAME1');
  assert.equal(long.status, 'too_long');
  assert.equal(groups[0].name, 'Forex', 'known market groups come first in a fixed order');
  assert.deepEqual(eligibleSymbols(groups).sort(), ['GBPUSD', 'XAUUSD']);

  // Another suffix: EURUSD becomes eligible again.
  const vip = buildCloneCandidates(entries, '.vip');
  assert.ok(eligibleSymbols(vip).includes('EURUSD'));
});

test('filterCloneCandidates narrows items and drops empty groups', () => {
  const groups = buildCloneCandidates(entries, '.pro');
  const filtered = filterCloneCandidates(groups, 'usd');
  assert.ok(filtered.length > 0);
  const gbp = filterCloneCandidates(groups, 'gbp');
  assert.deepEqual(gbp.map((group) => group.name), ['Forex']);
  assert.deepEqual(gbp[0].items.map((item) => item.symbol), ['GBPUSD']);
  assert.equal(filterCloneCandidates(groups, ''), groups);
});

test('group select all only touches eligible items', () => {
  const groups = buildCloneCandidates(entries, '.pro');
  const forex = groups.find((group) => group.name === 'Forex');
  let selected = new Set();
  assert.equal(groupSelectionState(forex, selected), 'none');
  selected = toggleGroupSelection(selected, forex, true);
  assert.deepEqual([...selected], ['GBPUSD']);
  assert.equal(groupSelectionState(forex, selected), 'all');
  selected = toggleGroupSelection(selected, forex, false);
  assert.equal(selected.size, 0);

  const metals = groups.find((group) => group.name === 'Metals');
  const both = toggleGroupSelection(toggleGroupSelection(new Set(), forex, true), metals, true);
  assert.equal(groupSelectionState({ items: [...forex.items, ...metals.items] }, new Set(['GBPUSD'])), 'some');
  assert.equal(both.size, 2);
});

test('pruneSelection drops symbols no longer eligible and keeps identity otherwise', () => {
  const groups = buildCloneCandidates(entries, '.pro');
  const selected = new Set(['GBPUSD', 'XAUUSD']);
  assert.equal(pruneSelection(selected, groups), selected);
  const pruned = pruneSelection(new Set(['EURUSD', 'GBPUSD', 'BTCUSD']), groups);
  assert.deepEqual([...pruned], ['GBPUSD']);
});

test('selectionError enforces 1..max symbols', () => {
  assert.match(selectionError(new Set()), /at least one/);
  assert.equal(selectionError(new Set(['A'])), '');
  const many = new Set(Array.from({ length: BULK_CLONE_MAX_SYMBOLS + 1 }, (_, index) => `S${index}`));
  assert.match(selectionError(many), /At most 500/);
});

test('buildCloneRows prefills from the source and keeps edited rows', () => {
  const rows = buildCloneRows(new Set(['XAUUSD', 'GBPUSD']), entries, '.pro');
  assert.deepEqual(rows, [
    { baseSymbol: 'GBPUSD', newSymbol: 'GBPUSD.PRO', spreadMarkupPips: '0', contractSize: '100000', minVolume: '0.1', maxVolume: '20', volumeStep: '0.1' },
    { baseSymbol: 'XAUUSD', newSymbol: 'XAUUSD.PRO', spreadMarkupPips: '0', contractSize: '100', minVolume: '', maxVolume: '', volumeStep: '' },
  ]);
  const edited = rows.map((row) => (row.baseSymbol === 'GBPUSD' ? { ...row, spreadMarkupPips: '1.5' } : row));
  const next = buildCloneRows(['GBPUSD', 'EURUSD'], entries, '.vip', edited);
  assert.deepEqual(next.map((row) => [row.baseSymbol, row.newSymbol, row.spreadMarkupPips]), [
    ['EURUSD', 'EURUSD.VIP', '0'],
    ['GBPUSD', 'GBPUSD.VIP', '1.5'],
  ]);
  assert.equal(next[0].maxVolume, '50');
});

test('applyToAllRows sets one field on every row', () => {
  const rows = buildCloneRows(['GBPUSD', 'XAUUSD'], entries, '.pro');
  const applied = applyToAllRows(rows, 'spreadMarkupPips', ' 0.5 ');
  assert.deepEqual(applied.map((row) => row.spreadMarkupPips), ['0.5', '0.5']);
  assert.deepEqual(applied.map((row) => row.contractSize), ['100000', '100']);
  assert.equal(applyToAllRows(rows, 'newSymbol', 'X'), rows, 'names are not editable');
});

test('validateCloneRow checks numbers, min/max and name length', () => {
  const base = { baseSymbol: 'EURUSD', newSymbol: 'EURUSD.PRO', spreadMarkupPips: '0', contractSize: '100000', minVolume: '0.01', maxVolume: '100', volumeStep: '0.01' };
  assert.deepEqual(validateCloneRow(base), {});
  assert.deepEqual(validateCloneRow({ ...base, contractSize: '', minVolume: '', maxVolume: '', volumeStep: '' }), {}, 'empty = copied from base');
  assert.deepEqual(Object.keys(validateCloneRow({ ...base, spreadMarkupPips: '-1' })), ['spreadMarkupPips']);
  assert.deepEqual(Object.keys(validateCloneRow({ ...base, contractSize: '0' })), ['contractSize']);
  assert.deepEqual(Object.keys(validateCloneRow({ ...base, volumeStep: 'abc' })), ['volumeStep']);
  assert.deepEqual(Object.keys(validateCloneRow({ ...base, minVolume: '5', maxVolume: '1' })), ['maxVolume']);
  assert.deepEqual(Object.keys(validateCloneRow({ ...base, newSymbol: 'ABCDEFGHIJKLMNOP.PRO1' })), ['newSymbol']);

  const result = validateCloneRows([base, { ...base, baseSymbol: 'GBPUSD', minVolume: '0' }]);
  assert.equal(result.valid, false);
  assert.equal(result.invalidCount, 1);
  assert.deepEqual(Object.keys(result.errors), ['GBPUSD']);
  assert.equal(validateCloneRows([]).valid, false);
  assert.equal(validateCloneRows([base]).valid, true);
});

test('buildBulkClonePayload converts numbers and omits empty fields', () => {
  const payload = buildBulkClonePayload(3, [
    { baseSymbol: 'eurusd', newSymbol: 'EURUSD.PRO', spreadMarkupPips: '0.5', contractSize: '100000', minVolume: '0.01', maxVolume: '100', volumeStep: '0.01' },
    { baseSymbol: 'XAUUSD', newSymbol: 'XAUUSD.PRO', spreadMarkupPips: '0', contractSize: '', minVolume: '', maxVolume: '', volumeStep: '' },
  ]);
  assert.deepEqual(payload, {
    category_id: 3,
    symbols: [
      { base_symbol: 'EURUSD', spread_markup_pips: 0.5, contract_size: 100000, min_volume: 0.01, max_volume: 100, volume_step: 0.01 },
      { base_symbol: 'XAUUSD', spread_markup_pips: 0 },
    ],
  });
});

test('normalizeBulkCloneResult reads created and skipped', () => {
  const result = normalizeBulkCloneResult({
    category: 'PRO',
    suffix: '.PRO',
    created: [{ symbol: 'EURUSD.PRO', base_symbol: 'EURUSD' }],
    skipped: [{ symbol: 'GBPUSD.PRO', base_symbol: 'GBPUSD', reason: 'already exists' }],
  });
  assert.deepEqual(result, {
    category: 'PRO',
    suffix: '.PRO',
    created: [{ symbol: 'EURUSD.PRO', baseSymbol: 'EURUSD', reason: '' }],
    skipped: [{ symbol: 'GBPUSD.PRO', baseSymbol: 'GBPUSD', reason: 'already exists' }],
  });
  assert.deepEqual(normalizeBulkCloneResult(undefined), { category: '', suffix: '', created: [], skipped: [] });
});
