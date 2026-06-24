import { useCallback, useEffect } from 'react';
import { useDataFetch } from './useCore';
import { ManagerService } from '../services/manager.service';
import { normalizeArrayResponse } from '../utils/apiShapes';

// Basic timestamp converter that safely parses a Unix stamp to a localized string or returns a fallback
const formatUnix = (timestamp) => {
  if (!timestamp || timestamp === 0) return '-';
  const dateObj = new Date(timestamp * 1000);
  return Number.isNaN(dateObj.getTime()) ? '-' : dateObj.toLocaleString();
};

const formatOrderTimestamps = (order) => ({
  ...order,
  timeSetupFormatted: formatUnix(order.timeSetup),
  timeDoneFormatted: formatUnix(order.timeDone),
  timeExpiryFormatted: formatUnix(order.timeExpiry)
});

const ORDER_RESPONSE_KEYS = ['data', 'orders', 'answer', 'items'];
const ORDER_MAX_PAGES = 50;

const formatOrdersPayload = (rawData) => {
  if (Array.isArray(rawData)) {
    return rawData.map(formatOrderTimestamps);
  }

  for (const key of ORDER_RESPONSE_KEYS) {
    if (rawData?.[key] && Array.isArray(rawData[key])) {
      return {
        ...rawData,
        [key]: rawData[key].map(formatOrderTimestamps)
      };
    }
  }

  return rawData;
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

const getOrderPageKey = (order, index) => (
  order.ticket ?? order.order ?? order.orderTicket ?? `${order.login ?? ''}:${order.symbol ?? ''}:${order.timeSetup ?? ''}:${order.timeDone ?? ''}:${index}`
);

export function useOrders(params = { limit: 100, offset: 0, logins: [], allPages: false }, enabled = true) {
  const limitParam = params.limit ?? 100;
  const offsetParam = params.offset ?? 0;
  const allPages = Boolean(params.allPages);
  const loginsKey = JSON.stringify(params.logins ?? []);

  const fetcher = useCallback(async () => {
    const logins = JSON.parse(loginsKey);
    if (logins.length > 0) {
      return formatOrdersPayload(await ManagerService.getOrders(logins));
    }

    const limit = Number(limitParam);
    const startOffset = Number(offsetParam);

    if (allPages) {
      const allRows = [];
      const seenOrderKeys = new Set();
      const seenPageSignatures = new Set();
      let offset = startOffset;

      for (let page = 0; page < ORDER_MAX_PAGES; page += 1) {
        const rawPage = await ManagerService.getBrokerOrders(limit, offset);
        const pageRows = normalizeArrayResponse(rawPage, ORDER_RESPONSE_KEYS);
        const pageSignature = pageRows.map(getOrderPageKey).join('|');

        if (seenPageSignatures.has(pageSignature)) break;
        seenPageSignatures.add(pageSignature);

        pageRows.forEach((order, index) => {
          const orderKey = getOrderPageKey(order, index);
          if (seenOrderKeys.has(orderKey)) return;
          seenOrderKeys.add(orderKey);
          allRows.push(order);
        });

        if (pageRows.length < limit) break;
        offset += limit;
      }

      return allRows.map(formatOrderTimestamps);
    }

    return formatOrdersPayload(await ManagerService.getBrokerOrders(limit, startOffset));
  }, [allPages, limitParam, loginsKey, offsetParam]);
  return useDataFetch(fetcher, null, [allPages, limitParam, loginsKey, offsetParam], enabled);
}

