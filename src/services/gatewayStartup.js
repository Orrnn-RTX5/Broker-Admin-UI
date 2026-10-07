import { api } from '../lib/api.js';
import { buildBrokerApiUrl } from '../config/endpoints.js';
import { useAuthStore } from '../store/authStore.js';
import { canAccessView } from '../utils/permissions.js';
import { createCacheIdentity } from '../utils/cacheIdentity.js';
import { createGatewayConnectionsCache } from '../utils/gatewayConnectionsCache.js';

const path = '/api/v1/manager/lp-connections';
export const getGatewayConnectionsScope = (state = useAuthStore.getState()) => {
  const identity = createCacheIdentity(state);
  return identity && canAccessView(state.user, 'Gateways') ? JSON.stringify([identity, buildBrokerApiUrl(path)]) : '';
};
const cache = createGatewayConnectionsCache({
  fetchConnections: async ({ signal }) => (await api.get(path, { _noRetry: true, signal, timeout: 15000 })).data,
});
let owner = getGatewayConnectionsScope();
useAuthStore.subscribe(state => {
  const next = getGatewayConnectionsScope(state);
  if (next !== owner) { owner = next; cache.clear(); }
});
export const peekGatewayConnections = scope => cache.peek(scope);
export const readGatewayConnections = (scope, options) => cache.read(scope, options);
export const invalidateGatewayConnections = scope => cache.invalidate(scope);
export const primeGatewayConnections = () => {
  const scope = getGatewayConnectionsScope();
  return scope ? cache.read(scope).catch(() => {}) : Promise.resolve();
};
