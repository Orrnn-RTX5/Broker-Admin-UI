import { useEffect } from 'react';
import { useDataFetch } from './useCore';
import { ManagerService } from '../services/manager.service';

// Basic timestamp converter that safely parses a Unix stamp to a localized string or returns a fallback
const formatUnix = (timestamp) => {
  if (!timestamp || timestamp === 0) return '-';
  const dateObj = new Date(timestamp * 1000);
  return Number.isNaN(dateObj.getTime()) ? '-' : dateObj.toLocaleString();
};

export function usePositions(params = { page: 1, limit: 100, logins: [] }, autoRefresh = true, refreshInterval = 2000, enabled = true) {
  const fetcher = async () => {
    const rawData = params.logins && params.logins.length > 0 
      ? await ManagerService.getPositions(params.logins, params.page, params.limit)
      : await ManagerService.getPositionsAll(params.page, params.limit);
      
    // If it's an array, map the timestamps natively
    if (Array.isArray(rawData)) {
      return rawData.map(pos => ({
        ...pos,
        timeCreateFormatted: formatUnix(pos.timeCreate),
        timeUpdateFormatted: formatUnix(pos.timeUpdate)
      }));
    }
    
    // If paginated shape
    if (rawData?.data && Array.isArray(rawData.data)) {
      rawData.data = rawData.data.map(pos => ({
        ...pos,
        timeCreateFormatted: formatUnix(pos.timeCreate),
        timeUpdateFormatted: formatUnix(pos.timeUpdate)
      }));
    }
    
    return rawData;
  };

  const hook = useDataFetch(fetcher, null, [JSON.stringify(params)], enabled);

  useEffect(() => {
    if (!autoRefresh) return;
    const intervalId = setInterval(() => {
      hook.mutate();
    }, refreshInterval);
    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, hook.mutate]);

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

export function useDealsSummary(from, to, login, symbol, enabled = true) {
  const fetcher = async () => {
    const rawData = await ManagerService.getBrokerDeals(1, 100);
    if (Array.isArray(rawData)) {
      return rawData.map(deal => ({
        ...deal,
        timeFormatted: formatUnix(deal.time)
      }));
    }
    return rawData;
  };
  return useDataFetch(fetcher, { from, to, login, symbol }, [from, to, login, symbol], enabled);
}

export function useOrders(params = { page: 1, limit: 100, logins: [] }, enabled = true) {
  const fetcher = async () => {
    const rawData = params.logins && params.logins.length > 0 
      ? await ManagerService.getOrders(params.logins)
      : await ManagerService.getBrokerOrders(params.page, params.limit);
      
    if (Array.isArray(rawData)) {
      return rawData.map(order => ({
        ...order,
        timeSetupFormatted: formatUnix(order.timeSetup),
        timeDoneFormatted: formatUnix(order.timeDone),
        timeExpiryFormatted: formatUnix(order.timeExpiry)
      }));
    }
    return rawData;
  };
  return useDataFetch(fetcher, null, [JSON.stringify(params)], enabled);
}

