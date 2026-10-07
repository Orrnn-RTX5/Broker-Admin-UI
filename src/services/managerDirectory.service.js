import { api } from '../lib/api.js';
import { useAuthStore } from '../store/authStore.js';
import { createCacheIdentity } from '../utils/cacheIdentity.js';
import { canAccessView } from '../utils/permissions.js';
import { createManagerDirectoryLoader, MANAGER_DIRECTORY_KINDS } from '../utils/managerDirectoryCache.js';

export const getManagerDirectoryIdentity = (state = useAuthStore.getState()) => {
  return canAccessView(state.user, 'Managers') ? createCacheIdentity(state) : null;
};
const loader = createManagerDirectoryLoader({
  fetchers: Object.fromEntries([['managers', 'ManagerList'], ['roles', 'ManagerRoleList'], ['online', 'ManagerOnline']]
    .map(([kind, endpoint]) => [kind, async () => (await api.get('/manager/' + endpoint)).data])),
  isCurrent: identity => identity === getManagerDirectoryIdentity(),
});
export const peekManagerDirectory = loader.peek;
export const subscribeManagerDirectory = loader.subscribe;
export const readManagerDirectory = (kind, options = {}) => loader.read(getManagerDirectoryIdentity(), kind, options);
export const primeManagerDirectory = (options = {}) => Promise.all(MANAGER_DIRECTORY_KINDS.map(kind => readManagerDirectory(kind, options)));
export const invalidateManagerDirectory = (identity, kinds = MANAGER_DIRECTORY_KINDS) => {
  loader.invalidate(identity, kinds);
  if (identity && identity === getManagerDirectoryIdentity()) void Promise.all(kinds.map(kind => loader.read(identity, kind)));
};

useAuthStore.subscribe((state, previous) => {
  const before = createCacheIdentity(previous);
  if (before && before !== createCacheIdentity(state)) loader.clear(before);
});
