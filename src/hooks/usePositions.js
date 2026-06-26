import { useCallback, useEffect, useRef } from 'react';
import { useDataFetch } from './useCore';
import { ManagerService } from '../services/manager.service';

export function usePositions(params = { page: 1, limit: 100, logins: [] }, autoRefresh = true, refreshInterval = 2000, enabled = true) {
  const refreshInFlightRef = useRef(false);
  const fetcher = async () => {
    return params.logins && params.logins.length > 0
      ? await ManagerService.getPositions(params.logins, params.page, params.limit)
      : await ManagerService.getPositionsAll(params.page, params.limit);
  };

  const hook = useDataFetch(
    fetcher,
    null,
    [JSON.stringify(params)],
    enabled,
    { requestKey: 'manager:positions' }
  );
  const mutatePositions = hook.mutate;

  useEffect(() => {
    if (!autoRefresh || !enabled) return undefined;
    const intervalId = setInterval(async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (refreshInFlightRef.current) return;

      refreshInFlightRef.current = true;
      try {
        await mutatePositions();
      } finally {
        refreshInFlightRef.current = false;
      }
    }, refreshInterval);
    return () => clearInterval(intervalId);
  }, [autoRefresh, enabled, mutatePositions, refreshInterval]);

  return hook;
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
  const page = options.page ?? 1;
  const limit = options.limit ?? 100;
  const search = options.search ?? '';

  const fetcher = async () => {
    return ManagerService.getBrokerDeals({
      page,
      limit,
      from,
      to,
      login,
      symbol,
      search,
    });
  };
  return useDataFetch(
    fetcher,
    { from, to, login, symbol, page, limit, search },
    [from, to, login, symbol, page, limit, search],
    enabled,
    { requestKey: 'manager:deals' }
  );
}

export function useOrders(params = { limit: 100, offset: 0, logins: [] }, enabled = true) {
  const limitParam = params.limit ?? 100;
  const offsetParam = params.offset ?? 0;
  const search = params.search ?? '';
  const symbol = params.symbol ?? '';
  const from = params.from ?? '';
  const to = params.to ?? '';
  const openOnly = Boolean(params.openOnly);
  const loginsKey = JSON.stringify(params.logins ?? []);

  const fetcher = useCallback(async () => {
    const logins = JSON.parse(loginsKey);
    if (logins.length > 0) {
      return ManagerService.getOrders(logins);
    }

    const limit = Number(limitParam);
    const startOffset = Number(offsetParam);

    return ManagerService.getBrokerOrders({
      limit,
      offset: startOffset,
      search,
      symbol,
      from,
      to,
      openOnly,
    });
  }, [from, limitParam, loginsKey, offsetParam, openOnly, search, symbol, to]);
  return useDataFetch(
    fetcher,
    null,
    [from, limitParam, loginsKey, offsetParam, openOnly, search, symbol, to],
    enabled,
    { requestKey: 'manager:orders' }
  );
}

