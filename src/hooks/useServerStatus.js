import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useAuthStore } from '../store/authStore.js';
import { getServerStatusScope, peekServerStatus, ServerConfigService, subscribeServerStatus } from '../services/serverConfig.service.js';
import { getApiErrorMessage } from '../utils/apiShapes.js';

export const useServerStatus = (refreshTrigger = 0) => {
  const scope = useAuthStore(getServerStatusScope);
  const token = useAuthStore(state => state.accessToken);
  const getSnapshot = useCallback(() => peekServerStatus(scope), [scope]);
  const snapshot = useSyncExternalStore(subscribeServerStatus, getSnapshot, () => null);
  const [request, setRequest] = useState({ scope: '', loading: false, error: '' });
  const revision = useRef(0);
  const previousRefresh = useRef(refreshTrigger);
  const cancelPending = useCallback(() => { revision.current++; }, []);
  const load = useCallback(async ({ force = false } = {}) => {
    if (!scope) return;
    const id = ++revision.current;
    const current = () => revision.current === id && getServerStatusScope() === scope && useAuthStore.getState().accessToken === token;
    setRequest({ scope, loading: true, error: '' });
    try {
      await ServerConfigService.getServerStatus({ force });
      if (current()) setRequest({ scope, loading: false, error: '' });
    } catch (error) {
      if (current()) setRequest({ scope, loading: false, error: getApiErrorMessage(error, 'Server status failed to load.') });
    }
  }, [scope, token]);
  useEffect(() => {
    const force = previousRefresh.current !== refreshTrigger;
    previousRefresh.current = refreshTrigger;
    void load({ force });
    return cancelPending;
  }, [load, refreshTrigger, cancelPending]);
  const refresh = useCallback(() => { void load({ force: true }); }, [load]);
  return { data: snapshot?.data ?? null, lastUpdated: snapshot?.fetchedAt ?? null, saved: snapshot?.source === 'saved',
    loading: Boolean(scope) && (request.scope === scope ? request.loading : !snapshot),
    error: request.scope === scope ? request.error : '', refresh };
};
