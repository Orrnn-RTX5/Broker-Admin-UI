import { ManagerService } from './manager.service.js';
import { useAuthStore } from '../store/authStore.js';
import { createCacheIdentity } from '../utils/cacheIdentity.js';
import { canAccessView } from '../utils/permissions.js';
import { createOrderSnapshot } from '../utils/orderSnapshot.js';
import { createOrderFeed } from '../utils/orderFeed.js';

export const getOrdersIdentity = () => {
  const state = useAuthStore.getState();
  return canAccessView(state.user, 'Orders') ? createCacheIdentity(state) : null;
};
const feed = createOrderFeed({
  fetchPage: (query, signal) => ManagerService.getBrokerOrders(query, 0, { signal }),
  fetchLogins: (logins, signal) => ManagerService.getOrders(logins, { signal }),
  snapshot: createOrderSnapshot(),
  isCurrent: identity => identity === getOrdersIdentity(),
});
export const peekOrders = feed.peek;
export const subscribeOrders = feed.subscribe;
export const primeOrders = (params = {}, options = {}) => feed.read(getOrdersIdentity(), params, options);

useAuthStore.subscribe((state, previous) => {
  const before = createCacheIdentity(previous);
  if (before && (before !== createCacheIdentity(state) || !canAccessView(state.user, 'Orders'))) feed.clear(before);
});
