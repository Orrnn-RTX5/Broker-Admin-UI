import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canMoveSelectedSymbols,
  findSymbolMatch,
  getSymbolClipboardText,
  moveSelectedSymbols,
  rangeSymbolIds,
} from './symbolListActions.js';

const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(id => ({ id, path: id }));
const ids = rows => rows.map(row => row.id);

test('moving discontiguous selections preserves selected blocks and unselected order without mutating the list', () => {
  assert.deepEqual(ids(moveSelectedSymbols(items, ['b', 'c', 'f'], -1)), ['b', 'c', 'a', 'd', 'f', 'e', 'g']);
  assert.deepEqual(ids(moveSelectedSymbols(items, ['b', 'c', 'f'], 1)), ['a', 'd', 'b', 'c', 'e', 'g', 'f']);
  assert.deepEqual(ids(items), ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  assert.equal(moveSelectedSymbols(items, ['b'], -1)[0], items[1]);
});

test('movement is disabled for an empty selection, invalid direction, and either selected edge', () => {
  for (const [selected, direction] of [[[], -1], [['unknown'], 1], [['a', 'd'], -1], [['b', 'g'], 1], [['b'], 0]]) {
    assert.equal(canMoveSelectedSymbols(items, selected, direction), false);
    assert.equal(moveSelectedSymbols(items, selected, direction), items);
  }
  assert.equal(canMoveSelectedSymbols([], [], 1), false);
  assert.equal(canMoveSelectedSymbols(items, ['b', 'c', 'f'], -1), true);
  assert.equal(canMoveSelectedSymbols(items, ['b', 'c', 'f'], 1), true);
  assert.equal(canMoveSelectedSymbols(items, new Set(['unknown', 'b']), -1), true);
});

const searchable = [
  { id: 'all', path: '*' },
  { id: 'eur', path: 'forex\\EURUSD' },
  { id: 'gold', path: 'metals\\XAUUSD' },
  { id: 'gbp', path: 'forex\\GBPUSD' },
];

test('find is case insensitive, skips the current match, and wraps in either direction', () => {
  assert.equal(findSymbolMatch(searchable, ' FOREX ', 'eur'), 'gbp');
  assert.equal(findSymbolMatch(searchable, 'forex', 'gbp'), 'eur');
  assert.equal(findSymbolMatch(searchable, 'forex', 'eur', -1), 'gbp');
  assert.equal(findSymbolMatch(searchable, 'forex', 'gbp', -1), 'eur');
  assert.equal(findSymbolMatch(searchable, 'Xau', 'gold'), 'gold');
  assert.equal(findSymbolMatch(searchable, 'Xau', 'gold', -1), 'gold');
});

test('find starts at the directional edge without a current row and handles absent or empty queries', () => {
  assert.equal(findSymbolMatch(searchable, 'usd', null), 'eur');
  assert.equal(findSymbolMatch(searchable, 'usd', 'deleted', -1), 'gbp');
  assert.equal(findSymbolMatch(searchable, 'JPY', 'eur'), null);
  assert.equal(findSymbolMatch(searchable, ' ', 'eur'), null);
  assert.equal(findSymbolMatch([], 'usd', null), null);
});

test('copy exports only selected rows in visible order, including default and explicit zero margins as dummy data', () => {
  const rows = [
    { id: 'eur', path: 'forex\\EURUSD', margin: { useDefault: true, initial: 50, maintenance: 25 } },
    { id: 'ignored', path: 'forex\\GBPUSD' },
    { id: 'gold', path: 'metals\\XAUUSD', margin: { useDefault: false, initial: 0, maintenance: 125 } },
  ];
  assert.equal(getSymbolClipboardText(rows, ['gold', 'eur', 'missing']), [
    'Symbol\tInitial Margin\tMaintenance Margin',
    'forex\\EURUSD (Dummy)\tDefault (Dummy)\tDefault (Dummy)',
    'metals\\XAUUSD (Dummy)\t0 (Dummy)\t125 (Dummy)',
  ].join('\n'));
  assert.equal(getSymbolClipboardText(rows, []), 'Symbol\tInitial Margin\tMaintenance Margin');
});

test('copy uses default margins when settings are absent and keeps pasted cells on their own row', () => {
  assert.equal(getSymbolClipboardText([{ id: 'custom', path: 'custom\tname\nline' }], ['custom']),
    'Symbol\tInitial Margin\tMaintenance Margin\ncustom name line (Dummy)\tDefault (Dummy)\tDefault (Dummy)');
});

test('shift selection returns an inclusive range in list order, including reverse selections and stale anchors', () => {
  assert.deepEqual(rangeSymbolIds(items, 'b', 'e'), ['b', 'c', 'd', 'e']);
  assert.deepEqual(rangeSymbolIds(items, 'e', 'b'), ['b', 'c', 'd', 'e']);
  assert.deepEqual(rangeSymbolIds(items, 'c', 'c'), ['c']);
  assert.deepEqual(rangeSymbolIds(items, 'deleted', 'd'), ['d']);
  assert.deepEqual(rangeSymbolIds(items, 'b', 'deleted'), []);
  assert.deepEqual(rangeSymbolIds([], null, null), []);
});
