import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGroupImport, sortToolbarRows } from './toolbarActions.js';

test('group import accepts configuration fields and excludes unrelated payload fields', () => {
  assert.deepEqual(parseGroupImport(JSON.stringify({ name: ' Demo ', symbolsAllowed: ['EURUSD', 'GBPUSD'], demo: false, token: 'ignored', id: 123 })), {
    name: 'Demo', symbolsAllowed: 'EURUSD, GBPUSD', demo: false,
  });
});
test('group import rejects table exports and invalid boolean or nested values', () => {
  for (const input of [{ rows: [] }, [], { name: 'Demo', demo: 'false' }, { name: 'Demo', currency: {} }]) {
    assert.throws(() => parseGroupImport(JSON.stringify(input)));
  }
});
test('toolbar sort uses numeric login ordering and preserves original rows', () => {
  const rows = [{ login: 10 }, { login: 2 }, { login: 1 }];
  assert.deepEqual(sortToolbarRows(rows, 'asc', 'Managers').map((row) => row.login), [1, 2, 10]);
  assert.deepEqual(sortToolbarRows(rows, 'desc', 'Managers').map((row) => row.login), [10, 2, 1]);
  assert.deepEqual(rows.map((row) => row.login), [10, 2, 1]);
  assert.equal(sortToolbarRows(rows, '', 'Managers'), rows);
});
test('toolbar sort uses the primary displayed group and symbol fields', () => {
  assert.equal(sortToolbarRows([{ name: 'Zulu' }, { name: 'Alpha' }], 'asc', 'Groups')[0].name, 'Alpha');
  assert.equal(sortToolbarRows([{ symbol: 'GBPUSD' }, { symbol: 'EURUSD' }], 'asc', 'Symbols')[0].symbol, 'EURUSD');
});
