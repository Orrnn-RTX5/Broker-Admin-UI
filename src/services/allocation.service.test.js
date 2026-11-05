// Behaviour guard for the Allocations editor's record lookup (getAllocationGroupRecord). The real module is loaded, with the
// group list supplied by a stub on ManagerService. The twin row is listed first, so a case-folded lookup returns the wrong record.
// Run with: node --test src/services/allocation.service.test.js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('../../test-support/resolveExtensionless.mjs', import.meta.url);
const { getAllocationGroupRecord } = await import('./allocation.service.js');
const { ManagerService } = await import('./manager.service.js');
const { invalidateGroupListCache } = await import('../utils/groupListCache.js');

const originalGetGroupList = ManagerService.getGroupList;
const serveGroups = (rows) => {
  ManagerService.getGroupList = async (params = {}) => (params.page === 1 ? { groups: rows } : { groups: [] });
};

beforeEach(() => { invalidateGroupListCache({ clearSnapshot: true }); });
test.after(() => { ManagerService.getGroupList = originalGetGroupList; });

test('the editor loads the exact group record, never a case or space twin that happens to be listed first', async () => {
  serveGroups([{ name: 'foo', marker: 'lower' }, { name: 'Foo', marker: 'exact' }, { name: 'Foo ', marker: 'spaced' }]);
  assert.equal((await getAllocationGroupRecord('Foo')).marker, 'exact');
  assert.equal((await getAllocationGroupRecord('foo')).marker, 'lower');
  assert.equal((await getAllocationGroupRecord('Foo ')).marker, 'spaced');
});

test('a group with no exact record is not loaded from a case or space twin', async () => {
  serveGroups([{ name: 'foo', marker: 'lower' }]);
  await assert.rejects(getAllocationGroupRecord('FOO'), /could not be loaded/);
  invalidateGroupListCache({ clearSnapshot: true });
  serveGroups([{ name: 'Baz ', marker: 'spaced' }]);
  await assert.rejects(getAllocationGroupRecord('Baz'), /could not be loaded/);
});
