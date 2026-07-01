import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiErrorMessage } from '../utils/apiShapes';

export const CACHED_TAB_REQUEST_TIMEOUT_MS = 5000;

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export const hasCachedTabResult = hasOwn;

const createTimeoutError = (timeoutMs) => {
  const error = new Error(`Request timed out after ${timeoutMs}ms.`);
  error.code = 'ECONNABORTED';
  return error;
};

const withTimeout = (promise, timeoutMs) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = globalThis.setTimeout(() => reject(createTimeoutError(timeoutMs)), timeoutMs);
  });

  return Promise.race([Promise.resolve(promise), timeout])
    .finally(() => globalThis.clearTimeout(timeoutId));
};

export const useCachedTabRequest = (activeKey, loaders, options = {}) => {
  const fallback = options.fallback || 'Failed to load data.';
  const timeoutMs = options.timeoutMs ?? CACHED_TAB_REQUEST_TIMEOUT_MS;
  const [results, setResults] = useState({});
  const [loadingByKey, setLoadingByKey] = useState({});
  const [errorsByKey, setErrorsByKey] = useState({});
  const resultsRef = useRef(results);
  const requestTokensRef = useRef({});
  const mountedRef = useRef(true);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (key, loadOptions = {}) => {
    const loader = loaders[key];
    if (!loader) return;
    if (!loadOptions.force && hasOwn(resultsRef.current, key)) return;

    const token = Symbol(String(key));
    requestTokensRef.current[key] = token;
    setLoadingByKey((current) => ({ ...current, [key]: true }));
    setErrorsByKey((current) => ({ ...current, [key]: '' }));

    try {
      const response = await withTimeout(loader(), timeoutMs);
      if (!mountedRef.current || requestTokensRef.current[key] !== token) return;

      setResults((current) => {
        const next = { ...current, [key]: response ?? [] };
        resultsRef.current = next;
        return next;
      });
    } catch (error) {
      if (!mountedRef.current || requestTokensRef.current[key] !== token) return;

      setErrorsByKey((current) => ({
        ...current,
        [key]: getApiErrorMessage(error, fallback),
      }));
      setResults((current) => {
        const next = { ...current, [key]: [] };
        resultsRef.current = next;
        return next;
      });
    } finally {
      if (!mountedRef.current || requestTokensRef.current[key] !== token) return;

      delete requestTokensRef.current[key];
      setLoadingByKey((current) => ({ ...current, [key]: false }));
    }
  }, [fallback, loaders, timeoutMs]);

  const refresh = useCallback(() => {
    setResults((current) => {
      const next = { ...current };
      delete next[activeKey];
      resultsRef.current = next;
      return next;
    });
    setErrorsByKey((current) => ({ ...current, [activeKey]: '' }));
    load(activeKey, { force: true });
  }, [activeKey, load]);

  useEffect(() => {
    load(activeKey);
  }, [activeKey, load]);

  return {
    data: hasOwn(results, activeKey) ? results[activeKey] : null,
    loading: Boolean(loadingByKey[activeKey]),
    error: errorsByKey[activeKey] || '',
    refresh,
    load,
  };
};
