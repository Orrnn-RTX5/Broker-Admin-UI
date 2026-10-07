import { useCallback, useLayoutEffect, useState } from 'react';
import { defaultDockWidths, dockWidthRange, fitDockWidths, resizeDockPanel } from '../utils/workspaceDockWidths';

export function useWorkspaceDockResize(dockRef, marketWatchCollapsed, navigatorCollapsed) {
  const [widths, setWidths] = useState(() => defaultDockWidths(window.innerWidth));
  const [availableWidth, setAvailableWidth] = useState(window.innerWidth);

  useLayoutEffect(() => {
    const container = dockRef.current?.parentElement;
    if (!container) return undefined;
    const fit = () => {
      const width = container.clientWidth;
      setAvailableWidth(width);
      if (width <= 640) return;
      setWidths(current => {
        const next = fitDockWidths(current, width, { marketWatch: marketWatchCollapsed, navigator: navigatorCollapsed });
        return next.marketWatch === current.marketWatch && next.navigator === current.navigator ? current : next;
      });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [dockRef, marketWatchCollapsed, navigatorCollapsed]);

  const resize = useCallback((panel, width) => {
    setWidths(current => resizeDockPanel(panel, width, current, availableWidth, {
      marketWatch: marketWatchCollapsed, navigator: navigatorCollapsed,
    }));
  }, [availableWidth, marketWatchCollapsed, navigatorCollapsed]);

  const separatorProps = panel => ({
    value: widths[panel],
    ...dockWidthRange(panel, widths, availableWidth, { marketWatch: marketWatchCollapsed, navigator: navigatorCollapsed }),
    onResize: width => resize(panel, width),
    onReset: () => resize(panel, defaultDockWidths(window.innerWidth)[panel]),
  });

  return {
    style: {
      '--workspace-market-width': `${marketWatchCollapsed ? 32 : widths.marketWatch}px`,
      '--workspace-navigator-width': `${navigatorCollapsed ? 32 : widths.navigator}px`,
    },
    separatorProps,
  };
}
