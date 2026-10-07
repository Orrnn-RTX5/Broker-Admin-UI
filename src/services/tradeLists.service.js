import { useAuthStore } from '../store/authStore';
import { ManagerService } from './manager.service';
import { createCacheIdentity } from '../utils/cacheIdentity';
import { canAccessView } from '../utils/permissions';
import { createTradeListFeed, createTradeListSnapshot, normalizePositionQuery, normalizeDealQuery, recentDealRange } from '../utils/tradeListFeed';

export const getTradeListIdentity = (view, state = useAuthStore.getState()) => canAccessView(state.user, view) ? createCacheIdentity(state) : null;
const positionFeed = createTradeListFeed({
  normalizeQuery: normalizePositionQuery,
  isDefaultQuery: query => query.page === 1 && query.limit === 100 && !query.logins.length,
  fetchPage: (query, signal) => query.logins.length
    ? ManagerService.getPositions(query.logins, query.page, query.limit, { signal })
    : ManagerService.getPositionsAll(query.page, query.limit, { signal }),
  snapshot: createTradeListSnapshot({ kind: 'positions' }),
  isCurrent: identity => identity === getTradeListIdentity('Positions'),
});
const dealFeed = createTradeListFeed({
  normalizeQuery: normalizeDealQuery,
  isDefaultQuery: query => query.page === 1 && query.limit === 100 && query.range === 'recent' && !query.login && !query.symbol && !query.search,
  fetchPage: (query, signal) => {
    const { range, ...params } = query;
    return ManagerService.getBrokerDeals({ ...params, ...(range === 'recent' ? recentDealRange() : {}) }, 50, { signal });
  },
  snapshot: createTradeListSnapshot({ kind: 'deals' }),
  isCurrent: identity => identity === getTradeListIdentity('Deals'),
});
export const peekPositions = positionFeed.peek;
export const subscribePositions = positionFeed.subscribe;
export const primePositions = (params = {}, options = {}) => positionFeed.read(getTradeListIdentity('Positions'), params, options);
export const refreshPositions = params => positionFeed.refresh(getTradeListIdentity('Positions'), params);
export const peekDeals = dealFeed.peek;
export const subscribeDeals = dealFeed.subscribe;
export const primeDeals = (params = { range: 'recent' }, options = {}) => dealFeed.read(getTradeListIdentity('Deals'), params, options);
export const refreshDeals = params => dealFeed.refresh(getTradeListIdentity('Deals'), params);

useAuthStore.subscribe((state, previous) => {
  for (const [view, feed] of [['Positions', positionFeed], ['Deals', dealFeed]]) {
    const before = getTradeListIdentity(view, previous);
    if (before && before !== getTradeListIdentity(view, state)) feed.clear(before);
  }
});
