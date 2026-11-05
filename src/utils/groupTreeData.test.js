import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findNavigationGroupByName, loadGroupTreePages, normalizeNavigationAccounts, normalizeNavigationGroups } from './groupTreeData.js';

test('group folders come from backend names and preserve full paths, without duplicates', () => {
  const original = { name: 'real\\standard', currency: 'USD' };
  const result = normalizeNavigationGroups([
    original, 'demo', { Name: 'contest' }, { group: 'Group 10' }, { Group: 'Group 2' },
    { group_name: 'ecn' }, { groupName: 'vip' }, { name: ' REAL\\STANDARD ' },
    {}, null, '', { name: false }, { name: {} },
  ]);
  // Names are exact: the space-padded and upper-case spellings are separate groups, not duplicates.
  assert.deepEqual(result.map((item) => item.label).sort(), [' REAL\\STANDARD ', 'Group 10', 'Group 2', 'contest', 'demo', 'ecn', 'real\\standard', 'vip']);
  assert.deepEqual(result.find((item) => item.label === 'real\\standard'), {
    id: 'group:real\\standard', groupName: 'real\\standard', label: 'real\\standard', group: original,
  });
  assert.deepEqual(result.find((item) => item.label === ' REAL\\STANDARD '), {
    id: 'group: REAL\\STANDARD ', groupName: ' REAL\\STANDARD ', label: ' REAL\\STANDARD ', group: { name: ' REAL\\STANDARD ' },
  });
  assert.deepEqual(normalizeNavigationGroups(null), []);
});

test('case and space twins stay separate groups, and an exact duplicate still collapses', () => {
  const rows = [{ name: 'Orrnn/demo-std' }, { name: 'orrnn/demo-std' }, { name: 'Orrnn/demo-std ' }, { name: 'Orrnn/demo-std' }];
  assert.deepEqual(normalizeNavigationGroups(rows).map((item) => item.groupName).sort(), ['Orrnn/demo-std', 'Orrnn/demo-std ', 'orrnn/demo-std']);
});

test('a group is found only by its exact name; case and space twins are never returned for another spelling', () => {
  const groups = normalizeNavigationGroups([{ name: 'Arijit' }, { name: 'ARIJIT' }, { name: 'Foo ' }, { name: 'Bar' }, { name: ' Bar' }]);
  assert.equal(findNavigationGroupByName(groups, 'ARIJIT').groupName, 'ARIJIT');
  assert.equal(findNavigationGroupByName(groups, 'Foo ').groupName, 'Foo ');
  assert.equal(findNavigationGroupByName(groups, 'Bar'), groups.find((group) => group.groupName === 'Bar'));
  assert.equal(findNavigationGroupByName(groups, 'Foo'), null, 'a space-only twin is not the trimmed match');
  assert.equal(findNavigationGroupByName(groups, 'arijit'), null, 'a case twin is never returned for another spelling');
  assert.equal(findNavigationGroupByName(groups, 'aRIJIT'), null, 'no case-folded match');
  assert.equal(findNavigationGroupByName(groups, ' Bar '), null, 'no trimmed match for a padded name');
  assert.equal(findNavigationGroupByName(normalizeNavigationGroups([{ name: 'Baz ' }]), 'Baz'), null, 'a single space twin is still no match');
  assert.equal(findNavigationGroupByName(groups, ''), null);
  assert.equal(findNavigationGroupByName(null, 'Bar'), null);
});

test('accounts require exact explicit group membership and preserve login strings', () => {
  const raw = { Login: '0002', Group: 'real', Name: 'Alice' };
  const rows = [
    raw, { login: 10, group: 'real' }, { account_login: '3', group_name: 'real' },
    { accountLogin: '4', groupName: 'real' }, { login: 5, account_group: 'real' },
    { login: 6, accountGroup: 'real' }, { login: 7, accountGroupName: 'real' },
    { login: 8, AccountGroup: 'real' }, { login: '0002', group: 'real' },
    { login: 1, group: 'demo' }, { login: 11, group: 'real-pro' },
    { login: 12, group: 'real\\standard' }, { login: 13 },
    { group: 'real' }, { login: null, group: 'real' }, { login: {}, group: 'real' },
    { login: false, group: 'real' }, { login: ' ', group: 'real' }, null,
    { login: 14, group: 'Real' }, { login: 15, group: ' real' }, { login: 16, group: 'REAL' },
  ];
  const result = normalizeNavigationAccounts(rows, 'real');
  assert.deepEqual(result.map((item) => item.label), ['0002', '3', '4', '5', '6', '7', '8', '10']);
  assert.deepEqual(normalizeNavigationAccounts(rows, 'Real').map((item) => item.label), ['14'], 'a case twin keeps only its own accounts');
  assert.deepEqual(normalizeNavigationAccounts(rows, ' real').map((item) => item.label), ['15'], 'a space twin keeps only its own accounts');
  assert.deepEqual(normalizeNavigationAccounts(rows, 'REAL').map((item) => item.label), ['16'], 'an upper-case twin keeps only its own accounts');
  assert.deepEqual(result[0].account, { ...raw, login: '0002', group: 'real', raw });
  assert.equal(result[0].groupName, 'real');
  assert.equal(new Set(result.map((item) => item.id)).size, result.length);
  assert.deepEqual(normalizeNavigationAccounts(rows, ''), []);
  assert.deepEqual(normalizeNavigationAccounts(null, 'real'), []);
  assert.notEqual(
    normalizeNavigationAccounts([{ login: 10, group: 'real' }], 'real')[0].id,
    normalizeNavigationAccounts([{ login: 10, group: 'demo' }], 'demo')[0].id,
  );
});

test('loads more than 100 records across all metadata pages and forwards group filters', async () => {
  const source = Array.from({ length: 237 }, (_, index) => ({ Login: index + 1, Group: 'real' }));
  const calls = [];
  let activeRequests = 0;
  const result = await loadGroupTreePages(async (params) => {
    calls.push(params);
    activeRequests += 1;
    assert.equal(activeRequests, 1, 'page requests must run sequentially');
    await Promise.resolve();
    activeRequests -= 1;
    const start = (params.page - 1) * params.limit;
    return { answer: source.slice(start, start + params.limit), pagination: { total: source.length } };
  }, { group: 'real' });
  assert.deepEqual(result, source);
  assert.deepEqual(calls, [
    { group: 'real', page: 1, limit: 100 },
    { group: 'real', page: 2, limit: 100 },
    { group: 'real', page: 3, limit: 100 },
  ]);
});

test('legacy full-array responses are returned intact in one request', async () => {
  const source = Array.from({ length: 245 }, (_, index) => `Group ${index}`);
  let requests = 0;
  assert.deepEqual(await loadGroupTreePages(async () => { requests += 1; return source; }), source);
  assert.equal(requests, 1);
});

test('metadata identifies a server-enforced smaller page size without losing records', async () => {
  const source = Array.from({ length: 137 }, (_, index) => ({ name: `Group ${index}` }));
  const calls = [];
  const result = await loadGroupTreePages(async (params) => {
    calls.push(params);
    const effectiveLimit = Math.min(40, params.limit);
    const start = (params.page - 1) * effectiveLimit;
    return { data: { groups: source.slice(start, start + effectiveLimit), meta: { totalCount: '137' } } };
  });
  assert.deepEqual(result, source);
  assert.deepEqual(calls.map(({ page, limit }) => [page, limit]), [[1, 100], [2, 40], [3, 40], [4, 40]]);
});

test('without totals, pagination continues until the final short or empty page', async () => {
  const source = Array.from({ length: 200 }, (_, index) => ({ login: index }));
  const calls = [];
  const result = await loadGroupTreePages(async ({ page, limit }) => {
    calls.push(page);
    return { rows: source.slice((page - 1) * limit, page * limit) };
  });
  assert.deepEqual(result, source);
  assert.deepEqual(calls, [1, 2, 3]);
  assert.deepEqual(await loadGroupTreePages(async () => ({ rows: [], total: 0 })), []);
});

test('accepts configured array wrappers and does not treat null totals as zero', async () => {
  let requests = 0;
  const result = await loadGroupTreePages(async ({ page }) => {
    requests += 1;
    return { custom: page === 1 ? [{ name: 'a' }, { name: 'b' }] : [{ name: 'c' }], total: null };
  }, { arrayKeys: ['custom'], limit: 2 });
  assert.equal(result.length, 3);
  assert.equal(requests, 2);
});

test('explicit nested totals take precedence over a count of the current page', async () => {
  const source = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
  const result = await loadGroupTreePages(async ({ page, limit }) => {
    const rows = source.slice((page - 1) * limit, page * limit);
    return { rows, count: rows.length, pagination: { total: source.length } };
  }, { limit: 2 });
  assert.deepEqual(result, source);
});

test('repeated pages fail instead of claiming an incomplete collection is complete', async () => {
  const rows = Array.from({ length: 100 }, (_, index) => ({ name: `Group ${index}` }));
  let requests = 0;
  await assert.rejects(loadGroupTreePages(async () => {
    requests += 1;
    return { groups: rows, total: 300 };
  }), /repeated page/);
  assert.equal(requests, 2);
  await assert.rejects(loadGroupTreePages(async () => rows), /repeated page/);
});

test('empty and changing-size pages reject when an advertised total remains incomplete', async () => {
  await assert.rejects(loadGroupTreePages(async ({ page }) => ({
    rows: page === 1 ? [{ name: 'a' }] : [], total: 3,
  })), /empty page/);
  await assert.rejects(loadGroupTreePages(async ({ page }) => ({
    rows: page === 1 ? [{ name: 'a' }, { name: 'b' }] : [{ name: 'c' }], total: 10,
  }), { limit: 2 }), /page size changed/);
});

test('failed or malformed responses are surfaced for a retry instead of empty folders', async () => {
  const failure = new Error('Server unavailable');
  await assert.rejects(loadGroupTreePages(async () => { throw failure; }), (error) => error === failure);
  await assert.rejects(loadGroupTreePages(async () => ({ error: 'Denied' })), /invalid list response/);
});
