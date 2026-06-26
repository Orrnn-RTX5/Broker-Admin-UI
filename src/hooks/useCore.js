import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/authStore';

const shouldSuppressFetchErrorLog = (error) => Boolean(error?.__rtx5SuppressLog);

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

export function useDataFetch(fetchFn, params = null, deps = [], enabled = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);
  const fetchFnRef = useRef(fetchFn);
  const paramsRef = useRef(params);
  const paramsKey = JSON.stringify(params);
  const depsKey = JSON.stringify(deps);
  
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  useEffect(() => {
    paramsRef.current = params;
  }, [paramsKey, params]);

  const execute = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!isAuthenticated || !enabled) {
      if (requestIdRef.current === requestId) setLoading(false);
      return null;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await fetchFnRef.current(paramsRef.current);
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
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [isAuthenticated, enabled]);

  useEffect(() => {
    execute();
  }, [execute, paramsKey, depsKey]);

  return { data, loading, error, mutate: execute };
}
