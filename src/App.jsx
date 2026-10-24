import React from 'react';
import { useAuthStore, validateAuthSession } from './store/authStore';
import useSymbolStore from './store/useSymbolStore';
import { createSharedFeedLease } from './utils/sharedFeedLease';
import { primeServerJournalStartup, discardServerJournalStartup } from './services/journalStartup';
import { clearServerJournalCache } from './services/serverJournalCache';
import { getServerStatusScope, primeServerStatus } from './services/serverConfig.service';
import { serverJournalSessionKey } from './utils/serverJournal';
import { buildUserFromAuthPayload } from './utils/sessionUser';
import { getAuthAccessToken, getAuthExpiresAt, getAuthExpiresIn, getAuthRefreshToken } from './utils/authSession';
import { buildNavigationTarget, readAppPath } from './lib/routerPath';
import { DEFAULT_WORKSPACE_LAYOUT } from './config/workspaceLayout';
import { primeAllocations } from './services/allocation.service';
import { primeOrders } from './services/orders.service';
import { primePositions, primeDeals } from './services/tradeLists.service';
import { getManagerDirectoryIdentity, primeManagerDirectory } from './services/managerDirectory.service';
import { createCacheIdentity } from './utils/cacheIdentity';
import { canAccessView } from './utils/permissions';
import { loadGatewayWorkspace } from './utils/gatewayWorkspace';
import { primeGatewayConnections } from './services/gatewayStartup';
import { AccountsService } from './services/accounts.service';
import WorkspaceStartup, { StartupLoadingScreen } from './components/organisms/WorkspaceStartup.jsx';
import { AuthService } from './services/auth.service';
import './styles/adminWorkspace.css';

let workspaceModule;
let workspaceRequest;
const loadAuthenticatedWorkspace = () => {
  if (!workspaceRequest) workspaceRequest = import('./AuthenticatedApp.jsx').then(module => {
    workspaceModule = module;
    return module;
  }).catch(error => {
    workspaceRequest = undefined;
    throw error;
  });
  return workspaceRequest;
};
const acquireMarketFeed = createSharedFeedLease({
  start: () => useSymbolStore.getState().initWebSocket(),
  stop: () => useSymbolStore.getState().disconnectWebSocket(),
});
const AdminLogin = React.lazy(() => import('./components/organisms/BrokerAuthScreens').then(module => ({ default: module.AdminLogin })));
const ManagerLogin = React.lazy(() => import('./components/organisms/BrokerAuthScreens').then(module => ({ default: module.ManagerLogin })));
const ManualBrokerEntry = React.lazy(() => import('./components/organisms/BrokerAuthScreens').then(module => ({ default: module.ManualBrokerEntry })));
const AUTH_PATHS = new Set([
  '/',
  '/manager-login',
  '/admin-login',
  '/broker-manual-entry',
]);

const useBrowserPath = () => {
  const [pathname, setPathname] = React.useState(() => readAppPath());

  const navigate = React.useCallback((to, options = {}) => {
    const method = options.replace ? 'replaceState' : 'pushState';
    window.history[method](null, '', buildNavigationTarget(to));
    setPathname(readAppPath());
  }, []);

  React.useEffect(() => {
    const handleLocationChange = () => setPathname(readAppPath());

    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);

    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  return { pathname, navigate };
};

const AuthenticatedAppFallback = StartupLoadingScreen;

const AppRoutes = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((state) => state.setUser);
  const { pathname, navigate } = useBrowserPath();
  const [globalTheme, setGlobalTheme] = React.useState(DEFAULT_WORKSPACE_LAYOUT.theme);
  const [workspaceRevision, setWorkspaceRevision] = React.useState(0);
  const [readyWorkspaceRevision, setReadyWorkspaceRevision] = React.useState(null);
  const warmupReady = readyWorkspaceRevision === workspaceRevision;
  const handleWorkspaceReady = React.useCallback(() => setReadyWorkspaceRevision(workspaceRevision), [workspaceRevision]);
  const [loadedWorkspace, setLoadedWorkspace] = React.useState(() => workspaceModule);
  const [workspaceLoadError, setWorkspaceLoadError] = React.useState(null);
  const startupPrimed = React.useRef('');
  const journalSession = serverJournalSessionKey(user);
  const statusScope = getServerStatusScope();
  const allocationIdentity = createCacheIdentity({ user, accessToken, isAuthenticated });
  const managerIdentity = getManagerDirectoryIdentity({ user, accessToken, isAuthenticated });
  const canPreloadAllocations = canAccessView(user, 'Allocations');
  const canPreloadAccounts = canAccessView(user, 'Clients') || canAccessView(user, 'Trading Accounts');
  const canPreloadOrders = canAccessView(user, 'Orders');
  const canPreloadPositions = canAccessView(user, 'Positions');
  const canPreloadDeals = canAccessView(user, 'Deals');
  const canPreloadGateways = canAccessView(user, 'Gateways');
  const marketFeedEnabled = isAuthenticated && Boolean(accessToken);
  const marketFeedBrokerScope = String(
    user?.broker_id ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('brokerId') : '') ||
    ''
  ).trim().toLowerCase();
  const marketFeedScope = `${marketFeedBrokerScope}:${user?.login ?? user?.id ?? ''}`;

  React.useEffect(() => {
    // Open the live feed while the workspace downloads, rather than after its first render.
    if (!marketFeedEnabled || validateAuthSession()) {
      return undefined;
    }
    return acquireMarketFeed(marketFeedScope);
  }, [marketFeedEnabled, marketFeedScope]);

  React.useEffect(() => {
    if (!isAuthenticated || !accessToken || validateAuthSession()) return;
    void AuthService.primeStartupMe();
  }, [isAuthenticated, accessToken]);

  React.useEffect(() => {
    // Commit the shell as soon as its module is ready. Suspending the entire
    // workspace here lets urgent quote updates repeatedly postpone its commit.
    let active = true;
    void loadAuthenticatedWorkspace().then(module => {
      if (active) setLoadedWorkspace(module);
    }).catch(error => {
      if (active) setWorkspaceLoadError(error);
    });
    void import('./components/organisms/ServerConfigWorkspace.jsx').catch(() => {});
    return () => { active = false; };
  }, []);

  React.useEffect(() => {
    if (!warmupReady || !loadedWorkspace || !isAuthenticated) return undefined;
    // Give the landing view and live feed the first download/connection slots.
    // Less frequent workspaces warm after the initial render, as in Manager.
    const timer = setTimeout(() => {
      void import('./components/organisms/AdminDataTable.jsx').catch(() => {});
      void loadGatewayWorkspace().catch(() => {});
    }, 0);
    return () => clearTimeout(timer);
  }, [warmupReady, loadedWorkspace, isAuthenticated]);

  React.useEffect(() => {
    if (!warmupReady || !allocationIdentity || !canPreloadGateways || validateAuthSession()) return undefined;
    const timer = setTimeout(() => { void primeGatewayConnections(); }, 1000);
    return () => clearTimeout(timer);
  }, [warmupReady, allocationIdentity, canPreloadGateways]);

  React.useEffect(() => {
    if (!warmupReady || !allocationIdentity || !canPreloadAccounts || AUTH_PATHS.has(pathname) || validateAuthSession()) return;
    void AccountsService.getAccounts({ page: 1, limit: 100 }).catch(() => {});
  }, [warmupReady, allocationIdentity, canPreloadAccounts, pathname]);

  React.useEffect(() => {
    if (!warmupReady || !allocationIdentity || AUTH_PATHS.has(pathname) || !canPreloadAllocations || validateAuthSession()) return;
    const timer = setTimeout(() => {
      void primeAllocations();
      void import('./components/organisms/AllocationsView.jsx').catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [warmupReady, allocationIdentity, pathname, canPreloadAllocations]);

  React.useEffect(() => {
    if (!warmupReady || !managerIdentity || AUTH_PATHS.has(pathname) || validateAuthSession()) return;
    const timer = setTimeout(() => {
      void primeManagerDirectory();
      void import('./components/organisms/ManagersView.jsx').catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [warmupReady, managerIdentity, pathname]);

  React.useEffect(() => {
    if (!warmupReady || !allocationIdentity || !canPreloadOrders || validateAuthSession()) return;
    // Share this early first-page request with the Orders view when it opens.
    void primeOrders();
  }, [warmupReady, allocationIdentity, canPreloadOrders]);

  React.useEffect(() => {
    if (!warmupReady || !allocationIdentity || validateAuthSession()) return;
    if (canPreloadPositions) void primePositions();
    if (canPreloadDeals) void primeDeals();
  }, [warmupReady, allocationIdentity, canPreloadPositions, canPreloadDeals]);

  React.useEffect(() => {
    if (!statusScope || AUTH_PATHS.has(pathname) || validateAuthSession()) return;
    // Start the landing view's request while the workspace bundle downloads.
    // The mounted panel shares this request and restores its saved snapshot.
    void primeServerStatus().catch(() => {});
  }, [statusScope, accessToken, pathname]);

  React.useEffect(() => {
    if (!isAuthenticated) {
      startupPrimed.current = '';
      clearServerJournalCache();
      return undefined;
    }
    if (!accessToken || startupPrimed.current === journalSession
      || DEFAULT_WORKSPACE_LAYOUT.operationsTab !== 'Journal' || DEFAULT_WORKSPACE_LAYOUT.operationsCollapsed) return undefined;
    // Overlap the first server request with the workspace download. This is a
    // one-shot request handoff, so every reload still reads the current server.
    const timer = setTimeout(() => {
      if (validateAuthSession()) return;
      startupPrimed.current = journalSession;
      primeServerJournalStartup(journalSession);
    }, 0);
    return () => {
      clearTimeout(timer);
      discardServerJournalStartup(journalSession);
    };
  }, [accessToken, isAuthenticated, journalSession]);

  const resetWorkspaceLayout = React.useCallback(() => {
    setGlobalTheme(DEFAULT_WORKSPACE_LAYOUT.theme);
    setWorkspaceRevision((revision) => revision + 1);
  }, []);

  React.useLayoutEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      let resolved = globalTheme;
      if (globalTheme === 'system') resolved = mediaQuery.matches ? 'dark' : 'light';
      else if (globalTheme === 'auto-time') {
        const h = new Date().getHours();
        resolved = (h >= 6 && h < 18) ? 'light' : 'dark';
      }
      document.documentElement.setAttribute('data-theme', resolved);
    };
    applyTheme();
    const mqHandler = () => { if (globalTheme === 'system') applyTheme(); };
    mediaQuery.addEventListener('change', mqHandler);

    let timeTick;
    if (globalTheme === 'auto-time') {
      timeTick = setInterval(applyTheme, 60_000);
    }
    return () => {
      mediaQuery.removeEventListener('change', mqHandler);
      if (timeTick) clearInterval(timeTick);
    };
  }, [globalTheme]);

  const handleAuthSuccess = React.useCallback((session, redirectPath) => {
    const accessToken = getAuthAccessToken(session);
    const refreshToken = getAuthRefreshToken(session) || accessToken;
    const expiresAt = getAuthExpiresAt(session);
    const expiresIn = getAuthExpiresIn(session);

    if (accessToken) {
      const nextUser = buildUserFromAuthPayload(session);
      setToken(accessToken, refreshToken, expiresAt, expiresIn);
      setUser(nextUser);
      primeServerJournalStartup(serverJournalSessionKey(nextUser));
      resetWorkspaceLayout();
      navigate(redirectPath, { replace: true });
    }
  }, [navigate, resetWorkspaceLayout, setToken, setUser]);

  React.useEffect(() => {
    if (!isAuthenticated && !AUTH_PATHS.has(pathname)) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate, pathname]);

  if (!isAuthenticated) {
    if (pathname === '/manager-login') {
      return <ManagerLogin navigate={navigate} onLoginSuccess={handleAuthSuccess} />;
    }

    if (pathname === '/admin-login') {
      return <AdminLogin navigate={navigate} onLoginSuccess={handleAuthSuccess} />;
    }

    if (pathname === '/broker-manual-entry') {
      return <ManualBrokerEntry navigate={navigate} onLoginSuccess={handleAuthSuccess} />;
    }

    return <AdminLogin navigate={navigate} onLoginSuccess={handleAuthSuccess} />;
  }

  if (workspaceLoadError) throw workspaceLoadError;
  const AuthenticatedApp = loadedWorkspace?.default;
  return (
    <WorkspaceStartup key={workspaceRevision} onReady={handleWorkspaceReady}>
    <React.Suspense fallback={null}>
      {AuthenticatedApp && <AuthenticatedApp
        navigate={navigate}
        globalTheme={globalTheme}
        setGlobalTheme={setGlobalTheme}
        onResetLayout={resetWorkspaceLayout}
      />}
    </React.Suspense>
    </WorkspaceStartup>
  );
};


const App = () => (
  <React.Suspense fallback={<AuthenticatedAppFallback />}>
    <AppRoutes />
  </React.Suspense>
);

export default App;
