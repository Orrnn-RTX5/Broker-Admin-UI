import { useAuthStore } from '../store/authStore.js';
import { ManagerService } from './manager.service.js';
import { AccountsService } from './accounts.service.js';
import { createCacheIdentity } from '../utils/cacheIdentity.js';
import { canAccessView } from '../utils/permissions.js';
import { createAllocationLoader } from '../utils/allocationLoader.js';
import { countAccountsByGroup } from '../utils/allocations.js';
import { clearAllocationCache, initialAllocationState, writeAllocationCache } from '../utils/allocationCache.js';
import { GROUP_LIST_ARRAY_KEYS, invalidateGroupListCache, loadGroupList, peekGroupList } from '../utils/groupListCache.js';
import { loadGroupTreePages } from '../utils/groupTreeData.js';

export const getAllocationIdentity = () => createCacheIdentity(useAuthStore.getState());
const loader = createAllocationLoader({
  readInitial: identity => initialAllocationState({ identity }),
  save: writeAllocationCache,
  clearSaved: identity => clearAllocationCache({ identity }),
  isCurrent: identity => identity === getAllocationIdentity() && canAccessView(useAuthStore.getState().user, 'Allocations'),
  fetchGroups: (identity, { force }) => loadGroupList(() => loadGroupTreePages(ManagerService.getGroupList, {
    arrayKeys: GROUP_LIST_ARRAY_KEYS, limit: 500,
  }), { identity, force }),
  fetchCounts: async (_identity, { force }) => {
    if (!canAccessView(useAuthStore.getState().user, 'Trading Accounts')) return null;
    if (force) AccountsService.invalidateCache({ keepDisplaySnapshot: true });
    return countAccountsByGroup(await AccountsService.getAllAccounts());
  },
});

export const peekAllocations = loader.peek;
export const subscribeAllocations = loader.subscribe;
export const primeAllocations = (options = {}) => {
  const identity = getAllocationIdentity();
  const state = loader.peek(identity);
  // A successful group mutation invalidates the shared full-record cache.
  // Reopening allocations must observe it even within the table's short TTL.
  const invalidated = !state.syncing && state.rows.length > 0 && !peekGroupList(identity);
  return loader.read(identity, { ...options, force: options.force || invalidated });
};

// Cached rows are compact summaries. Editors need the complete server record.
export const getAllocationGroupRecord = async name => {
  const identity = getAllocationIdentity();
  const groups = await loadGroupList(() => loadGroupTreePages(ManagerService.getGroupList, {
    arrayKeys: GROUP_LIST_ARRAY_KEYS, limit: 500,
  }), { identity });
  if (identity !== getAllocationIdentity()) throw new Error('Group access changed while loading.');
  const record = groups.find(group => group.groupName.toLowerCase() === name.toLowerCase())?.group;
  if (!record || typeof record !== 'object') throw new Error(`Group "${name}" could not be loaded.`);
  return record;
};

useAuthStore.subscribe((state, previous) => {
  const before = createCacheIdentity(previous);
  if (before && before !== createCacheIdentity(state)) {
    loader.clear(before);
    invalidateGroupListCache({ identity: before, clearSnapshot: true });
  }
});
