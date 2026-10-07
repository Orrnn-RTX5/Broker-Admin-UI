import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAllocationLoader } from './allocationLoader.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const navigation = names => names.map(name => ({ groupName: name, group: { name, currency: 'USD' } }));
const empty = () => ({ loading: true, syncing: false, rows: [], accountsKnown: false, updatedAt: null, error: '' });
const setup = (overrides = {}) => {
  const saved = [], cleared = [];
  const loader = createAllocationLoader({
    fetchGroups: async () => navigation(['Real', 'Demo']),
    fetchCounts: async () => new Map([['real', 3]]),
    readInitial: empty, save: snapshot => saved.push(snapshot), clearSaved: identity => cleared.push(identity),
    ...overrides,
  });
  return { ...loader, saved, cleared };
};
const tick = () => new Promise(resolve => setImmediate(resolve));

test('groups and census start together, columns publish before the census completes', async () => {
  const groups = deferred(), counts = deferred(), started = [];
  const loader = setup({ fetchGroups: () => { started.push('groups'); return groups.promise; },
    fetchCounts: () => { started.push('counts'); return counts.promise; } });
  const task = loader.read('broker');
  await tick();
  assert.deepEqual(started, ['groups', 'counts']);
  groups.resolve(navigation(['Real']));
  await tick();
  assert.equal(loader.peek('broker').rows[0].name, 'Real');
  assert.equal(loader.peek('broker').rows[0].accounts, null);
  assert.equal(loader.peek('broker').syncing, true);
  counts.resolve(new Map([['real', 3]]));
  await task;
  assert.equal(loader.peek('broker').rows[0].accounts, 3);
  assert.equal(loader.peek('broker').syncing, false);
});

test('startup, mount and warm reopening share one request until freshness expires', async () => {
  let groupCalls = 0, countCalls = 0, time = 1000;
  const loader = setup({ now: () => time, fetchGroups: async () => { groupCalls++; return navigation(['Real']); },
    fetchCounts: async () => { countCalls++; return new Map(); } });
  await Promise.all([loader.read('broker'), loader.read('broker')]);
  await loader.read('broker');
  assert.equal(groupCalls, 1);
  assert.equal(countCalls, 1);
  time += 60_001;
  await loader.read('broker');
  assert.equal(groupCalls, 2);
});

test('a forced refresh supersedes an earlier response and never saves its older rows', async () => {
  const old = deferred();
  let calls = 0;
  const loader = setup({ fetchGroups: () => ++calls === 1 ? old.promise : Promise.resolve(navigation(['Fresh'])) });
  const first = loader.read('broker');
  await tick();
  await loader.read('broker', { force: true });
  old.resolve(navigation(['Outdated']));
  await first;
  assert.equal(loader.peek('broker').rows[0].name, 'Fresh');
  assert(!loader.saved.some(snapshot => snapshot.rows.some(row => row.name === 'Outdated')));
});

test('a late response after a change of user cannot publish or persist', async () => {
  const groups = deferred();
  let current = 'A';
  const loader = setup({ fetchGroups: () => groups.promise, isCurrent: identity => identity === current });
  const task = loader.read('A');
  await tick();
  current = 'B';
  loader.clear('A');
  groups.resolve(navigation(['Private']));
  await task;
  assert.equal(loader.saved.length, 0);
  assert.equal(loader.peek('B').rows.length, 0);
});

test('saved totals remain visible, but new groups have unknown totals until the census answers', async () => {
  const counts = deferred();
  const loader = setup({ readInitial: () => ({ ...empty(), loading: false, rows: [{ name: 'Real', accounts: 7 }] }),
    fetchCounts: () => counts.promise });
  const task = loader.read('broker');
  await tick();
  assert.equal(loader.peek('broker').rows[0].accounts, 7);
  assert.equal(loader.peek('broker').rows[1].accounts, null);
  assert.equal(loader.peek('broker').accountsKnown, false);
  counts.resolve(new Map([['real', 8]]));
  await task;
  assert.equal(loader.peek('broker').rows[1].accounts, 0);
  assert.equal(loader.peek('broker').accountsKnown, true);
});

test('group permission denial removes saved rows; temporary failure retains them with an error', async () => {
  const initial = () => ({ ...empty(), loading: false, rows: [{ name: 'Private', accounts: 7 }] });
  const failure = status => Object.assign(new Error('Unavailable'), { response: { status } });
  const refused = setup({ readInitial: initial, fetchGroups: async () => { throw failure(403); } });
  await refused.read('broker');
  assert.equal(refused.peek('broker').rows.length, 0);
  assert.deepEqual(refused.cleared, ['broker']);
  const temporary = setup({ readInitial: initial, fetchGroups: async () => { throw failure(503); } });
  await temporary.read('broker');
  assert.equal(temporary.peek('broker').rows.length, 1);
  assert.equal(temporary.peek('broker').error, 'Unavailable');
});

test('account denial clears previous totals even when it answers before the group request', async () => {
  const groups = deferred();
  const loader = setup({ readInitial: () => ({ ...empty(), loading: false, rows: [{ name: 'Real', accounts: 7 }] }),
    fetchGroups: () => groups.promise,
    fetchCounts: async () => { throw Object.assign(new Error('No account access'), { response: { status: 403 } }); } });
  const task = loader.read('broker');
  await tick();
  groups.resolve(navigation(['Real']));
  await task;
  assert.equal(loader.peek('broker').rows[0].accounts, null);
  assert.equal(loader.peek('broker').accountsKnown, false);
  assert.equal(loader.saved.at(-1).rows[0].accounts, null);
});

test('counts that arrive first are included in the first published table', async () => {
  const groups = deferred();
  const loader = setup({ fetchGroups: () => groups.promise });
  const task = loader.read('broker');
  await tick();
  groups.resolve(navigation(['Real', 'Empty']));
  await task;
  assert.deepEqual(loader.peek('broker').rows.map(row => row.accounts), [3, 0]);
  assert.equal(loader.peek('broker').accountsKnown, true);
});
