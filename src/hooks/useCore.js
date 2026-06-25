import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // If we have an access token and user is null, we might need to fetch the user if not handled
    // The store automatically hydrates from localStorage.
    setIsInitializing(false);
  }, []);

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
  
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

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
      const result = await fetchFnRef.current(params);
      if (requestIdRef.current === requestId) {
        setData(result);
      }
      return result;
    } catch (err) {
      if (requestIdRef.current === requestId) {
        setError(err);
        console.error('Fetch error:', err);
      }
      return null;
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [isAuthenticated, enabled, JSON.stringify(params), ...deps]);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, mutate: execute };
}
