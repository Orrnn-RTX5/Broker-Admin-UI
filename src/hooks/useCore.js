import { groupAccessKey } from '../utils/groupAccess.js';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/authStore';

const shouldSuppressFetchErrorLog = (error) => Boolean(error?.__rtx5SuppressLog);
const pendingFetches = new Map();
const responseCache = new Map();
let cacheGeneration = 0;
let lastInvalidationEvent;
export const invalidateDataFetchCaches = () => {
  cacheGeneration += 1;
  responseCache.clear();
  pendingFetches.clear();
};
const sessionIdentity = state => `${Boolean(state?.isAuthenticated)}:${state?.accessToken || ''}:${groupAccessKey(state?.user)}`;
let session = sessionIdentity(useAuthStore.getState());
useAuthStore.subscribe(state => {
  const next = sessionIdentity(state);
  if (next !== session) { session = next; invalidateDataFetchCaches(); }
});

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
  const keepPreviousData = options.keepPreviousData === true;
  const accessIdentity=useAuthStore(state => String(state.accessToken || '')+groupAccessKey(state.user));
  const fetchCacheKey = buildFetchCacheKey(options.requestKey ? accessIdentity+'|'+options.requestKey : null, paramsKey, depsKey);
  
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  useEffect(() => {
    paramsRef.current = params;
  }, [paramsKey, params]);

  const execute = useCallback(async ({ force = false } = {}) => {
    const isCurrentAccess = () => {
      const state=useAuthStore.getState();
      return String(state.accessToken || '')+groupAccessKey(state.user)===accessIdentity;
    };
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!isAuthenticated || !useAuthStore.getState().isAuthenticated || !enabled) {
      if (requestIdRef.current === requestId && isCurrentAccess()) { setData(null); setError(null); setLoading(false); }
      return null;
    }

    if (!force) {
      const cachedResult = readCachedResponse(fetchCacheKey);
      if (cachedResult !== undefined) {
        if (requestIdRef.current === requestId && isCurrentAccess()) {
          setData(cachedResult);
          setError(null);
          setLoading(false);
        }
        return cachedResult;
      }
    }

    const generation = cacheGeneration;
    let requestPromise;
    try {
      setLoading(true);
      setError(null);
      requestPromise = fetchCacheKey ? pendingFetches.get(fetchCacheKey) : null;

      if (!requestPromise) {
        requestPromise = Promise.resolve(fetchFnRef.current(paramsRef.current));
        if (fetchCacheKey) {
          pendingFetches.set(fetchCacheKey, requestPromise);
        }
      }

      const result = await requestPromise;
      if (generation !== cacheGeneration || !isCurrentAccess()) return null;
      if (requestIdRef.current === requestId) writeCachedResponse(fetchCacheKey, result, cacheTtlMs);

      if (requestIdRef.current === requestId && isCurrentAccess()) {
        setData(result);
      }
      return result;
    } catch (err) {
      if (generation === cacheGeneration && requestIdRef.current === requestId && isCurrentAccess()) {
        setData(null);
        responseCache.delete(fetchCacheKey);
        setError(err);
        if (!shouldSuppressFetchErrorLog(err)) {
          console.error('Fetch error:', err);
        }
      }
      return null;
    } finally {
      if (fetchCacheKey && pendingFetches.get(fetchCacheKey) === requestPromise) {
        pendingFetches.delete(fetchCacheKey);
      }
      if (requestIdRef.current === requestId && isCurrentAccess()) {
        setLoading(false);
      }
    }
  }, [accessIdentity, cacheTtlMs, fetchCacheKey, isAuthenticated, enabled]);

  useEffect(() => {
    setData(null);
    execute();
    return () => { requestIdRef.current += 1; };
  }, [execute, paramsKey, depsKey]);

  useEffect(() => {
    let knownSession = sessionIdentity(useAuthStore.getState());
    const unsubscribe = useAuthStore.subscribe(state => {
      const next = sessionIdentity(state);
      if (next === knownSession) return;
      knownSession = next;
      requestIdRef.current += 1;
      setData(null); setError(null); setLoading(false);
    });
    const refresh = event => {
      if (event !== lastInvalidationEvent) { lastInvalidationEvent = event; invalidateDataFetchCaches(); }
      if (!keepPreviousData) setData(null);
      execute({ force: true });
    };
    const target = typeof window === 'undefined' ? null : window;
    target?.addEventListener('admin:state-changed', refresh);
    return () => { unsubscribe(); target?.removeEventListener('admin:state-changed', refresh); };
  }, [execute, keepPreviousData]);

  const mutate = useCallback(() => execute({ force: true }), [execute]);

  return { data: enabled && isAuthenticated ? data : null, loading, error, mutate };
}
