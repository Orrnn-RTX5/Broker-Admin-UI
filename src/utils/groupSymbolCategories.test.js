import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGroupSymbolCategories, toggleGroupSymbolCategory } from './groupSymbolCategories.js';

const entries = [
  { symbol: 'EURUSD', category: 'Forex', configured: true },
  { symbol: 'GBPUSD', category: 'forex', configured: false },
  { symbol: 'BTCUSD', category: 'Crypto', configured: true },
  { symbol: 'ETHUSD', category: 'Crypto', configured: false },
  { symbol: 'EURUSD.PRO', category: ' Forex\\ Majors ', configured: true },
  { symbol: 'GBPUSD.PRO', category: 'forex/Majors', configured: true },
];

test('categories merge casing and path separators without merging different broker folders', () => {
  const categories = buildGroupSymbolCategories(entries, 'eurusd, EUR*');
  assert.deepEqual(categories.map(category => [category.category, category.label, category.symbols.length, category.selectedCount]), [
    ['Crypto', 'Crypto', 2, 0], ['Forex', 'Forex', 2, 1], ['Forex/Majors', 'Forex / Majors', 2, 0],
  ]);
  assert.equal(categories[1].symbols[1].configured, false);
});

test('bulk selection restores missing members once and keeps other symbols and patterns', () => {
  const forex = buildGroupSymbolCategories(entries, 'eurusd, BTCUSD, EUR*').find(category => category.category === 'Forex');
  const next = toggleGroupSymbolCategory('eurusd, BTCUSD, EUR*', forex);
  assert.equal(next, 'eurusd, BTCUSD, EUR*, GBPUSD');
  const selected = buildGroupSymbolCategories(entries, next).find(category => category.category === 'Forex');
  assert.equal(selected.selectedCount, 2);
  assert.equal(selected.addable, 0);
  assert.equal(toggleGroupSymbolCategory(next, selected), 'BTCUSD, EUR*');
});

test('removing one selected symbol produces a partial category that can be restored', () => {
  const partial = buildGroupSymbolCategories(entries, 'GBPUSD, BTCUSD').find(category => category.category === 'Forex');
  assert.equal(partial.selectedCount, 1);
  assert.equal(toggleGroupSymbolCategory('GBPUSD, BTCUSD', partial), 'GBPUSD, BTCUSD, EURUSD');
});

test('category bulk additions skip repeated case-insensitive member names', () => {
  assert.equal(toggleGroupSymbolCategory('', { symbols: [{ symbol: 'EURUSD' }, { symbol: 'eurusd' }, { symbol: 'GBPUSD' }] }), 'EURUSD, GBPUSD');
});

test('Select all adds every fetched member once and clearing it preserves manual symbols and patterns', () => {
  const all = { symbols: entries };
  const selected = toggleGroupSymbolCategory('eurusd, CUSTOM, EUR*', all);
  assert.equal(selected, 'eurusd, CUSTOM, EUR*, GBPUSD, BTCUSD, ETHUSD, EURUSD.PRO, GBPUSD.PRO');
  assert.equal(toggleGroupSymbolCategory(selected, all), 'CUSTOM, EUR*');
});
