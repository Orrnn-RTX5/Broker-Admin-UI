import { useDataFetch } from './useCore';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccountsService, getAccountCacheIdentity } from '../services/accounts.service';
import { useAuthStore } from '../store/authStore';

export function useAccounts(page = 1, limit = 20, search = '', group = '', status = '', enabled = true) {
  const identity = useAuthStore(getAccountCacheIdentity);
  const authenticated = useAuthStore(state => state.isAuthenticated);
  const params = useMemo(() => ({ page, limit, search, group, status }), [page, limit, search, group, status]);
  const key = JSON.stringify([identity, params]);
  const [result, setResult] = useState({ key: null, data: null, loading: false, error: null });
  const requestId = useRef(0);
  const active = authenticated && enabled;
  const snapshot = active ? AccountsService.peekAccounts(params, { allowStale: true }) : null;
  const current = result.key === key ? result : null;
  const data = active ? (snapshot ?? current?.data) : null;

  const execute = useCallback(async ({ force = false } = {}) => {
    if (!authenticated || !enabled) return null;
    const id = ++requestId.current;
    const isCurrent = () => requestId.current === id && getAccountCacheIdentity() === identity;
    if (!force) {
      const ready = AccountsService.peekAccounts(params);
      if (ready) {
        setResult(previous => previous.key === key && previous.data === ready && !previous.loading && !previous.error
          ? previous : { key, data: ready, loading: false, error: null });
        return ready;
      }
    }
    const cached = AccountsService.peekAccounts(params, { allowStale: true });
    if (force) AccountsService.invalidateCache();
    setResult(previous => ({
      key, data: previous.key === key ? (previous.data ?? cached) : cached, loading: true, error: null,
    }));
    try {
      const response = await AccountsService.getAccounts(params);
      if (!isCurrent()) return null;
      setResult({ key, data: response, loading: false, error: null });
      return response;
    } catch (error) {
      if (isCurrent()) setResult(previous => ({ ...previous, key, loading: false, error }));
      return null;
    }
  }, [authenticated, enabled, identity, key, params]);

  useEffect(() => {
    void execute();
    return () => { requestId.current += 1; };
  }, [execute]);

  const mutate = useCallback(() => execute({ force: true }), [execute]);
  return {
    data,
    loading: Boolean(active && !data && (current?.loading ?? true)),
    refreshing: Boolean(active && data && current?.loading),
    error: active ? (current?.error ?? null) : null,
    mutate,
  };
}

export function useAccountDetail(login, enabled = true) {
  return useDataFetch(
    AccountsService.getAccount,
    login,
    [login],
    enabled,
    { requestKey: 'manager:account-detail' }
  );
}
