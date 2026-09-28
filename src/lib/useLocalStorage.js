import { useCallback, useEffect, useState } from 'react';


// storageName 'sessionStorage' keeps the value for the current tab only.
export function useLocalStorage(key, initial, storageName = 'localStorage') {
  const read = () => {
    try {
      const raw = window[storageName].getItem(key);
      return raw == null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  };

  const [value, setValue] = useState(read);

  useEffect(() => {
    try { window[storageName].setItem(key, JSON.stringify(value)); } catch { /* noop */ }
  }, [key, value, storageName]);

  const reset = useCallback(() => setValue(initial), [initial]);
  return [value, setValue, reset];
}
