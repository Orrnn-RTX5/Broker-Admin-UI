import { createContext, useContext, useLayoutEffect } from 'react';

export const WorkspaceStartupContext = createContext(null);

export function useWorkspaceStartupReady(part, ready = true) {
  const markReady = useContext(WorkspaceStartupContext);
  useLayoutEffect(() => {
    markReady?.(part, ready);
  }, [markReady, part, ready]);
}
