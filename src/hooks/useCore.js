import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/authStore';

const shouldSuppressFetchErrorLog = (error) => Boolean(error?.__rtx5SuppressLog);
const pendingFetches = new Map();
const responseCache = new Map();

const getPositiveNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : fallback;
};

const buildFetchCacheKey = (requestKey, paramsKey, depsKey) => (
  requestKey ? `${requestKey}|params:${paramsKey}|deps:${depsKey}` : null
);

const readCachedResponse = (cacheKey) => {
  if (!cacheKey) return undefined;

  const cached = responseCache.get(cacheKey);
  if (!cached) return undefined;

  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(cacheKey);
    return undefined;
  }

  return cached.data;
};

const writeCachedResponse = (cacheKey, data, ttlMs) => {
  if (!cacheKey || ttlMs <= 0) return;

  responseCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
};

export function useAuth() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const isInitializing = false;

  return {
    user,
    isAuthenticated,
    isInitializing,
    logout,
  };
}

export function useDataFetch(fetchFn, params = null, deps = [], enabled = true, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);
  const fetchFnRef = useRef(fetchFn);
  const paramsRef = useRef(params);
  const paramsKey = JSON.stringify(params);
  const depsKey = JSON.stringify(deps);
  const cacheTtlMs = getPositiveNumber(options.cacheTtlMs);
  const fetchCacheKey = buildFetchCacheKey(options.requestKey, paramsKey, depsKey);
  
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  useEffect(() => {
    paramsRef.current = params;
  }, [paramsKey, params]);

  const execute = useCallback(async ({ force = false } = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!isAuthenticated || !enabled) {
      if (requestIdRef.current === requestId) setLoading(false);
      return null;
    }

    if (!force) {
      const cachedResult = readCachedResponse(fetchCacheKey);
      if (cachedResult !== undefined) {
        if (requestIdRef.current === requestId) {
          setData(cachedResult);
          setError(null);
          setLoading(false);
        }
        return cachedResult;
      }
    }

    try {
      setLoading(true);
      setError(null);
      let requestPromise = fetchCacheKey ? pendingFetches.get(fetchCacheKey) : null;

      if (!requestPromise) {
        requestPromise = Promise.resolve(fetchFnRef.current(paramsRef.current));
        if (fetchCacheKey) {
          pendingFetches.set(fetchCacheKey, requestPromise);
        }
      }

      const result = await requestPromise;
      writeCachedResponse(fetchCacheKey, result, cacheTtlMs);

      if (requestIdRef.current === requestId) {
        setData(result);
      }
      return result;
    } catch (err) {
      if (requestIdRef.current === requestId) {
        setError(err);
        if (!shouldSuppressFetchErrorLog(err)) {
          console.error('Fetch error:', err);
        }
      }
      return null;
    } finally {
      if (fetchCacheKey) {
        pendingFetches.delete(fetchCacheKey);
      }
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [cacheTtlMs, fetchCacheKey, isAuthenticated, enabled]);

  useEffect(() => {
    execute();
  }, [execute, paramsKey, depsKey]);

  const mutate = useCallback(() => execute({ force: true }), [execute]);

  return { data, loading, error, mutate };
}
