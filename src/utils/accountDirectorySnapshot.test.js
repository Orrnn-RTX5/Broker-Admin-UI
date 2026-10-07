import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountDirectorySnapshot } from './accountDirectorySnapshot.js';

const storage = () => {
  const values = new Map();
  return { values, getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};
const account = { Login: 200001, Name: 'Backend Client', Equity: 209944.02000000002, ReadOnly: true };

test('reload display handoff retains live values and excludes unrelated private settings', () => {
  const disk = storage(), snapshots = createAccountDirectorySnapshot({ storage: () => disk });
  snapshots.write('scope-a', { accounts: [{ ...account, password: 'secret', ip_whitelist: ['private'], token: 'secret', permissions: ['*'] }], total: 55 });
  const restored = snapshots.read('scope-a');
  assert.equal(restored.total, 55);
  assert.equal(restored.accounts[0].Equity, account.Equity);
  assert.equal(restored.accounts[0].ReadOnly, true);
  assert.equal(restored.accounts[0]._accountDirectorySummary, true);
  for (const field of ['password', 'token', 'permissions', 'ip_whitelist']) assert(!Object.hasOwn(restored.accounts[0], field));
  assert.equal(snapshots.read('scope-b'), null);
});

test('expiry follows the original response time and clearing removes restored data', () => {
  const disk = storage(); let at = 1000;
  const snapshots = createAccountDirectorySnapshot({ storage: () => disk, now: () => at });
  snapshots.write('scope', [account], at);
  at += 299_000; assert.equal(snapshots.read('scope').accounts.length, 1);
  at += 1000; assert.equal(snapshots.read('scope'), null);
  snapshots.write('scope', [account], 1000); assert.equal(snapshots.read('scope'), null);
  snapshots.write('scope', [], at); assert.deepEqual(snapshots.read('scope').accounts, []);
  snapshots.clear('scope'); assert.equal(snapshots.read('scope'), null);
});

test('corrupt, future, duplicated, wrong-scope and malformed rows are rejected', () => {
  const disk = storage(), snapshots = createAccountDirectorySnapshot({ storage: () => disk, now: () => 1000 });
  snapshots.write('scope', [account]);
  const key = [...disk.values.keys()][0], original = JSON.parse(disk.getItem(key));
  for (const override of [{ at: 1001 }, { identity: 'another' }, { rows: [account, account] }, { total: -1 }, { rows: [{ Login: 1, password: 'secret' }] }]) {
    disk.setItem(key, JSON.stringify({ ...original, ...override })); assert.equal(snapshots.read('scope'), null);
  }
  disk.setItem(key, 'broken json'); assert.equal(snapshots.read('scope'), null);
});

test('unknown totals stay unknown and invalid responses do not replace a valid snapshot', () => {
  const snapshots = createAccountDirectorySnapshot({ storage: () => storage() });
  const disk = storage(), usable = createAccountDirectorySnapshot({ storage: () => disk });
  usable.write('scope', { accounts: [account] });
  assert(!Object.hasOwn(usable.read('scope'), 'total'));
  usable.write('scope', { success: false });
  assert.equal(usable.read('scope').accounts[0].Login, account.Login);
  assert.equal(snapshots.read(null), null);
});
