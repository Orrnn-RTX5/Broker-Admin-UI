import React from 'react';
import { AdminLogin, ManagerLogin, ManualBrokerEntry } from './components/organisms/BrokerAuthScreens';
import { SuperAdminAuthScreen } from './components/organisms/SuperAdminAuthScreen';
import { SuperAdminConsole } from './components/organisms/SuperAdminConsole';
import { useAuthStore } from './store/authStore';
import { buildUserFromAuthPayload } from './utils/sessionUser';
import { getAuthAccessToken, getAuthExpiresAt, getAuthExpiresIn, getAuthRefreshToken } from './utils/authSession';
import { buildNavigationTarget, readAppPath } from './lib/routerPath';
import { getSuperAdminSession, SUPER_ADMIN_SESSION_EVENT } from './services/superAdmin.service';

const AuthenticatedApp = React.lazy(() => import('./AuthenticatedApp.jsx'));
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

const App = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((state) => state.setUser);
  const { pathname, navigate } = useBrowserPath();

  const [superAdminSession, setSuperAdminSession] = React.useState(() => getSuperAdminSession());

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
      setToken(accessToken, refreshToken, expiresAt, expiresIn);
      setUser(buildUserFromAuthPayload(session));
      navigate(redirectPath, { replace: true });
    }
  }, [navigate, setToken, setUser]);

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
      <AuthenticatedApp navigate={navigate} />
    </React.Suspense>
  );
};


export default App;
