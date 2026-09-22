import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDummyGroup, createDummyGroupsSeed, deleteDummyFolder, deleteDummyGroup,
  duplicateDummyGroup, getDummyFolderChildren, getDummyGroupAccounts, getDummyGroupCount, getDummyParentPath,
  listDummyContainerPaths, makeDummyGroup, normalizeDummyPath, renameDummyFolder, restoreDummyGroups,
  updateDummyGroup, validateDummyGroup,
} from './dummyGroups.js';

test('seed builds the recorded three-level folder hierarchy and nine clearly identified examples', () => {
  const groups = createDummyGroupsSeed();
  assert.equal(groups.length, 9);
  assert.ok(groups.every(group => group.isDummy && group.source === 'dummy'));
  assert.deepEqual(getDummyFolderChildren(groups).map(node => [node.label, node.count]), [['Admin', 9]]);
  assert.deepEqual(getDummyFolderChildren(groups, 'Admin').map(node => [node.label, node.count]), [['contest', 4], ['demo', 4], ['real', 1]]);
  assert.deepEqual(getDummyFolderChildren(groups, 'Admin\\demo').map(node => [node.label, node.count]), [['4540', 4]]);
  const leaves = getDummyFolderChildren(groups, 'Admin\\demo\\4540');
  assert.deepEqual(leaves.map(node => node.label), ['Grp01', 'Grp02', 'Grp03', 'Grp04']);
  assert.ok(leaves.every(node => node.type === 'group' && node.groupName === node.group.path));
  assert.deepEqual(getDummyFolderChildren(groups, leaves[0].path), [], 'group records have properties, not account branches');
  assert.equal(getDummyGroupCount(groups, 'Admin\\demo'), 4);
  const recased = renameDummyFolder(groups, 'Admin\\demo', 'Admin\\DEMO');
  assert.ok(recased.filter(group => group.id.startsWith('dummy-group-demo')).every(group => group.path.startsWith('Admin\\DEMO\\')));
  assert.equal(getDummyGroupCount(groups, 'Admin\\dem'), 0);
  assert.equal(getDummyParentPath(leaves[0].path), 'Admin\\demo\\4540');
});

test('new records have detached defaults for all tabs, symbol overrides, and commission tiers', () => {
  const first = makeDummyGroup({ path: 'Admin\\Demo\\One' });
  const second = makeDummyGroup({ path: 'Admin\\Demo\\Two' });
  assert.deepEqual(Object.keys(first.settings), ['common', 'statistics', 'company', 'news', 'permissions', 'margin', 'reports']);
  first.settings.common.currency = 'EUR';
  first.symbols[0].rates.initialBuy.market = 50;
  first.commissions[0].tiers[0].commission = 99;
  assert.equal(second.settings.common.currency, 'USD');
  assert.equal(second.symbols[0].rates.initialBuy.market, 2);
  assert.equal(second.commissions[0].tiers[0].commission, 9);
});

test('local create and edit preserve identity, merge settings, and update table values', () => {
  const seed = createDummyGroupsSeed();
  const { groups, group } = addDummyGroup(seed, { path: 'admin/demo/0042/New group', currency: 'EUR' });
  assert.equal(group.path, 'Admin\\demo\\0042\\New group');
  assert.equal(group.name, group.path);
  assert.equal(group.settings.common.currency, 'EUR');
  assert.equal(seed.length, 9);
  const updated = updateDummyGroup(groups, group.id, {
    name: 'Admin\\real\\0042\\Renamed',
    settings: { common: { currency: 'GBP' }, margin: { marginCallLevel: 80 }, company: { description: 'Updated example' } },
  });
  assert.equal(updated.group.id, group.id);
  assert.equal(updated.group.path, 'Admin\\real\\0042\\Renamed');
  assert.equal(updated.group.currency, 'GBP');
  assert.equal(updated.group.marginCallLevel, 80);
  assert.equal(updated.group.stopOutLevel, 50);
  assert.equal(updated.group.description, 'Updated example');
  assert.equal(group.currency, 'EUR');
  assert.equal(group.settings.common.currency, 'EUR');
  const compact = updateDummyGroup(updated.groups, group.id, { currency: 'JPY', stopOutLevel: 20, description: 'Compact edit' });
  assert.equal(compact.group.settings.common.currency, 'JPY');
  assert.equal(compact.group.settings.margin.stopOutLevel, 20);
  assert.equal(compact.group.settings.company.description, 'Compact edit');
  assert.equal(updated.group.settings.common.currency, 'GBP');
  assert.throws(() => updateDummyGroup(compact.groups, group.id, { currency: 'invalid' }), /currency/);
  assert.equal(compact.group.settings.common.currency, 'JPY', 'failed compact edits cannot mutate persisted nested settings');
});

test('invalid names, duplicate paths, and folder/group collisions cannot corrupt the tree', () => {
  const groups = createDummyGroupsSeed();
  for (const path of ['', 'Admin\\\\group', 'Admin\\..\\group', 'Admin\\bad*name', `Admin\\${'x'.repeat(125)}`]) {
    assert.throws(() => addDummyGroup(groups, { path }));
  }
  const adminGroup = addDummyGroup(groups, { path: 'Admin' });
  assert.deepEqual(getDummyFolderChildren(adminGroup.groups).map(node => [node.type, node.label, node.count]), [['group', 'Admin', 9]], 'a main group may own the folder of the same name');
  assert.equal(addDummyGroup(groups, { path: 'Other\\group' }).group.path, 'Other\\group', 'folders may sit beside Admin');
  assert.equal(addDummyGroup(groups, { path: 'Top' }).group.path, 'Top', 'groups may sit directly under the Groups root');
  assert.equal(normalizeDummyPath(' admin / demo / 0042 / First '), 'Admin\\demo\\0042\\First');
  assert.throws(() => addDummyGroup(groups, { path: groups[0].path.toUpperCase() }), /already exists/);
  const container = addDummyGroup(groups, { path: 'Admin\\demo' });
  const demo = getDummyFolderChildren(container.groups, 'Admin').find(node => node.label === 'demo');
  assert.equal(demo.type, 'group', 'a group may own a folder of subgroups');
  assert.equal(demo.count, 4);
  const child = addDummyGroup(container.groups, { path: `${groups[0].path}\\Child` });
  assert.deepEqual(getDummyFolderChildren(child.groups, groups[0].path).map(node => node.label), ['Child']);
  assert.deepEqual(listDummyContainerPaths(groups).slice(0, 4), ['Admin', 'Admin\\contest', 'Admin\\contest\\4540', 'Admin\\contest\\4540\\Grp01']);
  assert.throws(() => validateDummyGroup({ path: 'Admin\\New', currency: 'usd' }), /currency/);
  assert.throws(() => validateDummyGroup({ path: 'Admin\\New', stopOutLevel: -1 }), /non-negative/);
  assert.throws(() => validateDummyGroup({ path: 'Admin\\New', symbols: {} }), /list/);
  assert.equal(groups.length, 9);
});

test('duplicate creates independent rules and an unused name; delete touches only the requested group', () => {
  const groups = createDummyGroupsSeed();
  const first = duplicateDummyGroup(groups, groups[0].id);
  const second = duplicateDummyGroup(first.groups, groups[0].id);
  assert.equal(first.group.path, `${groups[0].path} Copy`);
  assert.equal(second.group.path, `${groups[0].path} Copy 2`);
  assert.notEqual(first.group.id, groups[0].id);
  first.group.commissions[0].tiers[0].commission = 100;
  assert.equal(groups[0].commissions[0].tiers[0].commission, 9);
  const remaining = deleteDummyGroup(second.groups, first.group.id);
  assert.equal(remaining.length, 10);
  assert.ok(remaining.some(group => group.id === groups[0].id));
  assert.throws(() => deleteDummyGroup(remaining, 'missing'), /no longer exists/);
});

test('moving folders retains descendant identity and prevents cycles or path collisions', () => {
  const groups = createDummyGroupsSeed();
  const moved = renameDummyFolder(groups, 'Admin\\demo', 'Admin\\sandbox');
  assert.equal(getDummyGroupCount(moved, 'Admin\\demo'), 0);
  assert.equal(getDummyGroupCount(moved, 'Admin\\sandbox'), 4);
  assert.deepEqual(moved.map(group => group.id), groups.map(group => group.id));
  assert.equal(getDummyGroupCount(groups, 'Admin\\demo'), 4);
  assert.throws(() => renameDummyFolder(groups, 'Admin', 'Admin\\other'), /root/);
  assert.throws(() => renameDummyFolder(groups, 'Admin\\demo', 'Admin\\demo\\child'), /inside itself/);
  assert.throws(() => renameDummyFolder(groups, 'Admin\\demo', 'Admin\\real'), /destination/);
  const deleted = deleteDummyFolder(moved, 'Admin\\sandbox');
  assert.equal(deleted.length, 5);
  assert.throws(() => deleteDummyFolder(groups, 'Admin'), /root/);
  assert.equal(getDummyFolderChildren([], '')[0].path, 'Admin');
});

test('storage restoration preserves valid edits and empty datasets while resetting invalid data', () => {
  const groups = createDummyGroupsSeed();
  groups[0].settings.company.description = 'Saved in this browser';
  assert.equal(restoreDummyGroups(groups)[0].description, 'Saved in this browser');
  assert.deepEqual(restoreDummyGroups([]), []);
  for (const corrupt of [null, {}, [{ name: 'Bad*name' }], [groups[0], groups[0]], [{ ...groups[0], symbols: null }]]) {
    assert.equal(restoreDummyGroups(corrupt).length, 9);
  }
});

test('example accounts are deterministic per group and follow its statistics', () => {
  const [group] = createDummyGroupsSeed();
  const accounts = getDummyGroupAccounts(group);
  assert.equal(accounts.length, group.settings.statistics.accountCount);
  assert.deepEqual(accounts, getDummyGroupAccounts(group));
  assert.equal(new Set(accounts.map(account => account.login)).size, accounts.length);
  assert.ok(accounts.every(account => account.group === group.path && account.currency === group.currency && account.isDummy && account.balance >= 0));
  assert.deepEqual(getDummyGroupAccounts(makeDummyGroup({ path: 'Top', settings: { statistics: { accountCount: 0 } } })), []);
});

test('renaming or deleting a group that has subgroups carries the subgroups with it', () => {
  const { groups, group } = addDummyGroup(createDummyGroupsSeed(), { path: 'Admin\\demo' });
  const renamed = updateDummyGroup(groups, group.id, { name: 'Admin\\sandbox' });
  assert.equal(renamed.group.path, 'Admin\\sandbox');
  assert.equal(getDummyGroupCount(renamed.groups, 'Admin\\sandbox'), 5);
  assert.equal(getDummyGroupCount(renamed.groups, 'Admin\\demo'), 0);
  assert.throws(() => updateDummyGroup(renamed.groups, group.id, { name: 'Admin\\sandbox\\inner' }), /inside itself/);
  assert.throws(() => updateDummyGroup(renamed.groups, group.id, { name: 'Admin\\contest' }), /destination/);
  assert.equal(deleteDummyFolder(renamed.groups, 'Admin\\sandbox').length, 5);
  assert.equal(renameDummyFolder(renamed.groups, 'Admin\\sandbox', 'Admin\\moved').filter(item => item.path.startsWith('Admin\\moved')).length, 5);
});
