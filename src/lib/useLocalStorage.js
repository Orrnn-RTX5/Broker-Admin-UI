import { useCallback, useEffect, useState } from 'react';


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
