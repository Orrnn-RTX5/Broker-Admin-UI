import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useDataFetch } from './useCore';
import { useAuthStore } from '../store/authStore';
import { createCacheIdentity } from '../utils/cacheIdentity';
import { normalizeOrderQuery } from '../utils/orderFeed';
import { canAccessView } from '../utils/permissions';
import { peekOrders, primeOrders, subscribeOrders } from '../services/orders.service';
import { getTradeListIdentity, peekPositions, primePositions, refreshPositions, subscribePositions, peekDeals, primeDeals, refreshDeals, subscribeDeals } from '../services/tradeLists.service';
import { normalizePositionQuery, normalizeDealQuery } from '../utils/tradeListFeed';

const positionSource = { normalize: normalizePositionQuery, peek: peekPositions, prime: primePositions, refresh: refreshPositions, subscribe: subscribePositions };
const dealSource = { normalize: normalizeDealQuery, peek: peekDeals, prime: primeDeals, refresh: refreshDeals, subscribe: subscribeDeals };
function useTradeList(view, params, enabled, autoRefresh, refreshInterval, source) {
  const identity = useAuthStore(state => getTradeListIdentity(view, state));
  const queryKey = JSON.stringify(source.normalize(params));
  const query = useMemo(() => JSON.parse(queryKey), [queryKey]);
  const state = useSyncExternalStore(source.subscribe, () => source.peek(enabled ? identity : null, query));
  const mutate = useCallback(() => enabled && identity ? source.refresh(query) : Promise.resolve(null), [enabled, identity, query, source]);
  useEffect(() => {
    if (!enabled || !identity) return undefined;
    void source.prime(query);
    const refreshVisible = () => {
      if (document.visibilityState !== 'hidden') void source.prime(query, { force: true });
    };
    const interval = autoRefresh ? window.setInterval(refreshVisible, refreshInterval) : null;
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    window.addEventListener('admin:state-changed', mutate);
    return () => {
      if (interval !== null) window.clearInterval(interval);
      window.removeEventListener('focus', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
      window.removeEventListener('admin:state-changed', mutate);
    };
  }, [autoRefresh, enabled, identity, mutate, query, refreshInterval, source]);
  return { ...state, mutate };
}

export function usePositions(params = { page: 1, limit: 100, logins: [] }, autoRefresh = true, refreshInterval = 2000, enabled = true) {
  return useTradeList('Positions', params, enabled, autoRefresh, refreshInterval, positionSource);
}

// Exposure and Top Accounts are visual widgets that we cannot fetch natively using page limits natively right now
// I am disabling real APIs for them and sending back empty arrays 
// to prevent breaking the dashboard until a dedicated backend graph API is implemented
export function useExposure(symbol = '', enabled = true) {
  return useDataFetch(async () => [], symbol || undefined, [], enabled);
}

export function useTopAccounts(limit = 10, sortBy = 'profit', order = 'desc', enabled = true) {
  return useDataFetch(async () => [], { limit, sort_by: sortBy, order }, [limit, sortBy, order], enabled);
}

export function useDealsSummary(from, to, login, symbol, enabled = true, options = {}) {
  return useTradeList('Deals', { from, to, login, symbol, ...options }, enabled, true, 2000, dealSource);
}

export function useOrders(params = { limit: 100, offset: 0, logins: [] }, enabled = true) {
  const identity = useAuthStore(state => canAccessView(state.user, 'Orders') ? createCacheIdentity(state) : null);
  const queryKey = JSON.stringify(normalizeOrderQuery(params));
  const query = useMemo(() => JSON.parse(queryKey), [queryKey]);
  const matches = params.matches;
  const state = useSyncExternalStore(subscribeOrders, () => peekOrders(enabled ? identity : null, query));
  const mutate = useCallback(() => enabled && identity
    ? primeOrders(query, { matches, force: true }) : Promise.resolve(null), [enabled, identity, query, matches]);

  useEffect(() => {
    if (!enabled || !identity) return undefined;
    void primeOrders(query, { matches });
    const refreshVisible = () => {
      if (document.visibilityState !== 'hidden') void mutate();
    };
    const interval = window.setInterval(refreshVisible, 2000);
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    window.addEventListener('admin:state-changed', mutate);
    window.addEventListener('rtx:pending-placement-changed', mutate);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
      window.removeEventListener('admin:state-changed', mutate);
      window.removeEventListener('rtx:pending-placement-changed', mutate);
    };
  }, [enabled, identity, matches, mutate, query]);
  return { ...state, mutate };
}

