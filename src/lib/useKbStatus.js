import { useEffect, useState } from 'react';

/**
 * Track CapsLock / NumLock / ScrollLock state. Browser exposes this only via
 * KeyboardEvent.getModifierState, so we update on keydown/keyup. Initial state
 * stays unknown until the first key event.
 */
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
