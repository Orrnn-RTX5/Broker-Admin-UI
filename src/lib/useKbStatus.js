import { useEffect, useState } from 'react';

export function useKbStatus() {
  const [state, setState] = useState({ caps: false, num: false, scroll: false });

  useEffect(() => {
    const sync = (e) => {
      setState({
        caps:   e.getModifierState?.('CapsLock')   ?? false,
        num:    e.getModifierState?.('NumLock')    ?? false,
        scroll: e.getModifierState?.('ScrollLock') ?? false,
      });
    };
    window.addEventListener('keydown', sync);
    window.addEventListener('keyup', sync);
    return () => {
      window.removeEventListener('keydown', sync);
      window.removeEventListener('keyup', sync);
    };
  }, []);

  return state;
}
