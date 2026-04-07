import { useEffect } from 'react';
import { useDataFetch } from './useCore';
import { PositionsService } from '../services/positions.service';

export function usePositions(params = { page: 1, limit: 50 }, autoRefresh = true, refreshInterval = 2000, enabled = true) {
  const hook = useDataFetch(PositionsService.getPositions, params, [JSON.stringify(params)], enabled);

  useEffect(() => {
    if (!autoRefresh) return;
    
    // Polling logic for real-time updates
    const intervalId = setInterval(() => {
      hook.mutate();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, hook.mutate]);

  return hook;
}

export function useExposure(symbol = '', enabled = true) {
  return useDataFetch(PositionsService.getExposure, symbol || undefined, [], enabled);
}

export function useTopAccounts(limit = 10, sortBy = 'profit', order = 'desc', enabled = true) {
  return useDataFetch(PositionsService.getTopAccounts, { limit, sort_by: sortBy, order }, [limit, sortBy, order], enabled);
}

export function useDealsSummary(from, to, login, symbol, enabled = true) {
  return useDataFetch(PositionsService.getDealSummary, { from, to, login, symbol }, [from, to, login, symbol], enabled);
}
