import React from 'react';
import useSymbolStore from '../../store/useSymbolStore';
import { WorkspaceStartupContext, useWorkspaceStartupReady } from '../../hooks/useWorkspaceStartup';
import { getBrokerBranding } from '../../utils/branding';
const STARTUP_DATA_WAIT_MS = 4500;

export function StartupLoadingScreen() {
  const [logoFailed, setLogoFailed] = React.useState(false);
  const { productName, logoUrl } = getBrokerBranding();
  const fallbackIcon = `${import.meta.env.BASE_URL || '/'}admin-symbol.png`;

  return (
    <div className="workspace-loading-screen" role="status" aria-live="polite" aria-label="Loading admin workspace">
      <div className="workspace-loading-content">
        <div className="workspace-loading-brand">
          <img
            src={logoUrl && !logoFailed ? logoUrl : fallbackIcon}
            alt=""
            onError={() => setLogoFailed(true)}
          />
          <span>{productName}</span>
        </div>
        <span className="workspace-loading-spinner" aria-hidden="true" />
        <p className="workspace-loading-message">Preparing your workspace…</p>
      </div>
    </div>
  );
}

function FeedStartupReady() {
  const ready = useSymbolStore(state => Boolean(state.feedError) || (state.isConnected
    && Object.values(state.symbols).some(quote => quote.live && quote.lastUpdate)));
  useWorkspaceStartupReady('feed', ready);
  return null;
}

export function WorkspaceViewReady() {
  useWorkspaceStartupReady('view');
  return null;
}

export default function WorkspaceStartup({ children, onReady }) {
  const [startup, setStartup] = React.useState(() => ({ parts: new Set(), finished: false }));
  const markReady = React.useCallback((part, ready = true) => {
    setStartup(current => {
      if (current.finished || current.parts.has(part) === ready) return current;
      const parts = new Set(current.parts);
      if (ready) parts.add(part);
      else parts.delete(part);
      const finished = parts.has('shell') && (parts.has('deadline')
        || ['identity', 'view', 'terminal', 'feed'].every(required => parts.has(required)));
      return { parts, finished };
    });
  }, []);
  const revealed = startup.finished;

  React.useEffect(() => {
    if (revealed) onReady?.();
  }, [revealed, onReady]);

  React.useEffect(() => {
    if (revealed) return undefined;
    // One slow or unavailable data source must not lock users out of the shell.
    const timer = setTimeout(() => markReady('deadline'), STARTUP_DATA_WAIT_MS);
    return () => clearTimeout(timer);
  }, [markReady, revealed]);

  return (
    <WorkspaceStartupContext.Provider value={markReady}>
      {!revealed && <FeedStartupReady />}
      <div className="workspace-startup-content" data-startup-ready={[...startup.parts].join(' ')} aria-hidden={!revealed} inert={!revealed} aria-busy={!revealed}>
        {children}
      </div>
      {!revealed && <StartupLoadingScreen />}
    </WorkspaceStartupContext.Provider>
  );
}
