import { useCallback, useEffect, useRef, useState } from 'react';
import { getClientRowWindow } from '../utils/clientRowWindow';

export const useClientRowWindow = (enabled, scope, count) => {
  const scrollRef = useRef(null);
  const lastElementRef = useRef(null);
  const frameRef = useRef(null);
  const [viewport, setViewport] = useState({ scope: null, scrollTop: 0, height: 600 });
  const measure = useCallback(() => {
    const element = scrollRef.current;
    if (!element || !enabled) return;
    const { scrollTop, clientHeight: height } = element;
    setViewport(previous => previous.scope === scope && previous.scrollTop === scrollTop && previous.height === height
      ? previous : { scope, scrollTop, height });
  }, [enabled, scope]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!enabled || !element) return undefined;
    // A newly mounted scroller already starts at zero. Writing scrollTop here
    // would force layout before the first client rows can be painted.
    if (lastElementRef.current === element) element.scrollTop = 0;
    lastElementRef.current = element;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [enabled, measure]);

  const onScroll = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      measure();
    });
  }, [measure]);

  return {
    ...getClientRowWindow(count, viewport.scope === scope ? viewport.scrollTop : 0, viewport.height),
    scrollRef, onScroll,
  };
};
