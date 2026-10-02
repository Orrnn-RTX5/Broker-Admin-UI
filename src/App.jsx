import React from 'react';
import { useAuthStore, validateAuthSession } from './store/authStore';
import { primeServerJournalStartup, discardServerJournalStartup } from './services/journalStartup';
import { clearServerJournalCache } from './services/serverJournalCache';
import { getServerStatusScope, primeServerStatus } from './services/serverConfig.service';
import { serverJournalSessionKey } from './utils/serverJournal';
import { buildUserFromAuthPayload } from './utils/sessionUser';
import { getAuthAccessToken, getAuthExpiresAt, getAuthExpiresIn, getAuthRefreshToken } from './utils/authSession';
import { buildNavigationTarget, readAppPath } from './lib/routerPath';
import { DEFAULT_WORKSPACE_LAYOUT } from './config/workspaceLayout';
import { getSuperAdminSession, SUPER_ADMIN_SESSION_EVENT } from './services/superAdmin.service';

const AuthenticatedApp = React.lazy(() => import('./AuthenticatedApp.jsx'));
const AdminLogin = React.lazy(() => import('./components/organisms/BrokerAuthScreens').then(module => ({ default: module.AdminLogin })));
const ManagerLogin = React.lazy(() => import('./components/organisms/BrokerAuthScreens').then(module => ({ default: module.ManagerLogin })));
const ManualBrokerEntry = React.lazy(() => import('./components/organisms/BrokerAuthScreens').then(module => ({ default: module.ManualBrokerEntry })));
const SuperAdminAuthScreen = React.lazy(() => import('./components/organisms/SuperAdminAuthScreen').then(module => ({ default: module.SuperAdminAuthScreen })));
const SuperAdminConsole = React.lazy(() => import('./components/organisms/SuperAdminConsole').then(module => ({ default: module.SuperAdminConsole })));
const AUTH_PATHS = new Set([
  '/',
  '/manager-login',
  '/admin-login',
  '/broker-manual-entry',
  '/super-admin-login',
  '/super-admin',
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

const AuthenticatedAppFallback = () => (
  <div className="h-screen w-screen bg-[color:var(--bg-app)]" aria-hidden="true" />
);

const AppRoutes = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((state) => state.setUser);
  const { pathname, navigate } = useBrowserPath();
  const [globalTheme, setGlobalTheme] = React.useState(DEFAULT_WORKSPACE_LAYOUT.theme);
  const [workspaceRevision, setWorkspaceRevision] = React.useState(0);
  const startupPrimed = React.useRef(false);
  const journalSession = serverJournalSessionKey(user);
  const statusScope = getServerStatusScope();

  React.useEffect(() => {
    if (!statusScope || AUTH_PATHS.has(pathname) || validateAuthSession()) return;
    // Start the landing view's request while the workspace bundle downloads.
    // The mounted panel shares this request and restores its saved snapshot.
    void primeServerStatus().catch(() => {});
  }, [statusScope, accessToken, pathname]);

  React.useEffect(() => {
    if (!isAuthenticated) {
      startupPrimed.current = false;
      clearServerJournalCache();
      return undefined;
    }
    if (!accessToken || pathname.startsWith('/super-admin') || startupPrimed.current
      || DEFAULT_WORKSPACE_LAYOUT.operationsTab !== 'Journal' || DEFAULT_WORKSPACE_LAYOUT.operationsCollapsed) return undefined;
    // Overlap the first server request with the workspace download. This is a
    // one-shot request handoff, so every reload still reads the current server.
    const timer = setTimeout(() => {
      if (validateAuthSession()) return;
      startupPrimed.current = true;
      primeServerJournalStartup(journalSession);
    }, 0);
    return () => {
      clearTimeout(timer);
      discardServerJournalStartup(journalSession);
    };
  }, [accessToken, isAuthenticated, journalSession, pathname]);

  const resetWorkspaceLayout = React.useCallback(() => {
    setGlobalTheme(DEFAULT_WORKSPACE_LAYOUT.theme);
    setWorkspaceRevision((revision) => revision + 1);
  }, []);

  const [superAdminSession, setSuperAdminSession] = React.useState(() => getSuperAdminSession());

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

  React.useEffect(() => {
    const handleSuperAdminSessionChange = (e) => {
      setSuperAdminSession(e.detail || getSuperAdminSession());
    };
    window.addEventListener(SUPER_ADMIN_SESSION_EVENT, handleSuperAdminSessionChange);
    return () => {
      window.removeEventListener(SUPER_ADMIN_SESSION_EVENT, handleSuperAdminSessionChange);
    };
  }, []);

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

  // Direct Super Admin routes take precedence
  if (pathname === '/super-admin-login') {
    return (
      <SuperAdminAuthScreen
        navigate={navigate}
        onLoginSuccess={() => navigate('/super-admin', { replace: true })}
        onSwitchToBrokerLogin={() => navigate('/admin-login')}
      />
    );
  }

  if (pathname === '/super-admin') {
    if (superAdminSession.isAuthenticated) {
      return (
        <SuperAdminConsole
          onClose={() => navigate(isAuthenticated ? '/admin-dashboard' : '/')}
          onNavigateBrokerLogin={() => navigate('/admin-login')}
        />
      );
    }
    return (
      <SuperAdminAuthScreen
        navigate={navigate}
        onLoginSuccess={() => navigate('/super-admin', { replace: true })}
        onSwitchToBrokerLogin={() => navigate('/admin-login')}
      />
    );
  }

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

  return (
    <React.Suspense fallback={<AuthenticatedAppFallback />}>
      <AuthenticatedApp
        key={workspaceRevision}
        navigate={navigate}
        globalTheme={globalTheme}
        setGlobalTheme={setGlobalTheme}
        onResetLayout={resetWorkspaceLayout}
      />
    </React.Suspense>
  );
};


const App = () => (
  <React.Suspense fallback={<AuthenticatedAppFallback />}>
    <AppRoutes />
  </React.Suspense>
);

export default App;
