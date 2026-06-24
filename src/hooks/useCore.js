import { useState, useEffect, useCallback } from 'react';
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
  
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const execute = useCallback(async () => {
    if (!isAuthenticated || !enabled) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await fetchFn(params);
      setData(result);
    } catch (err) {
      setError(err);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, enabled, fetchFn, JSON.stringify(params), ...deps]);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, mutate: execute };
}
