import { useCallback, useEffect, useState } from 'react';

/**
 * Persisted useState. Value syncs to localStorage under `key`.
 * SSR-safe; returns `initial` if localStorage is unavailable.
 */
export function useLocalStorage(key, initial) {
  const read = () => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw == null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  };

  const [value, setValue] = useState(read);

  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
  }, [key, value]);

  const reset = useCallback(() => setValue(initial), [initial]);
  return [value, setValue, reset];
}
