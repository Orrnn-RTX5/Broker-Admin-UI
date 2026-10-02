import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  User,
  ArrowRight,
  Loader2,
  AlertCircle,
  Building2,
  Activity,
  CheckCircle2,
  Eye,
  EyeOff,
  Server,
} from 'lucide-react';
import {
  loginSuperAdmin,
  checkSuperAdminHealth,
  getSuperAdminOrigin,
} from '../../services/superAdmin.service';

export const SuperAdminAuthScreen = ({ navigate, onLoginSuccess, onSwitchToBrokerLogin }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [healthStatus, setHealthStatus] = useState({ loading: true, ok: false, message: '' });

  const backendOrigin = getSuperAdminOrigin();

  useEffect(() => {
    let active = true;
    checkSuperAdminHealth()
      .then((res) => {
        if (active) {
          setHealthStatus({
            loading: false,
            ok: res.ok,
            message: res.ok ? 'Online (200 OK)' : (res.error || 'Offline'),
          });
        }
      })
      .catch(() => {
        if (active) {
          setHealthStatus({ loading: false, ok: false, message: 'Unreachable' });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const session = await loginSuperAdmin({ username: username.trim(), password });
      if (onLoginSuccess) {
        onLoginSuccess(session, '/super-admin');
      } else if (navigate) {
        navigate('/super-admin', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Super Admin authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex h-[100dvh] items-center justify-center overflow-y-auto bg-[color:var(--bg-app)] p-4 font-sans select-none">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[color:var(--accent-500)]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-[color:var(--accent-500)]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="z-10 my-auto w-full max-w-md space-y-6 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-1)] p-6 shadow-2xl sm:p-8">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[color:var(--accent-500)]/10 border border-[color:var(--accent-500)]/20 text-[color:var(--text-primary)] mb-1 shadow-inner">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-xl font-bold text-[color:var(--text-primary)] tracking-tight">RTX5 Technology Admin</h1>
          <p className="text-xs text-[color:var(--text-secondary)]">
            Dedicated Super Admin Control Plane Authentication
          </p>
        </div>

        {/* Backend Connectivity Status Bar */}
        <div className="p-3 rounded-lg bg-[color:var(--bg-app)] border border-[color:var(--border-subtle)] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Server size={13} className="text-[color:var(--text-muted)]" />
            <span className="text-[color:var(--text-secondary)] truncate max-w-[200px]" title={backendOrigin}>
              {backendOrigin}
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px]" role="status" aria-live="polite">
            {healthStatus.loading ? (
              <span className="text-[color:var(--text-secondary)] flex items-center gap-1">
                <Loader2 size={11} className="animate-spin" />
                <span>Checking...</span>
              </span>
            ) : healthStatus.ok ? (
              <span className="text-[color:var(--text-primary)] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Online</span>
              </span>
            ) : (
              <span className="text-[color:var(--danger-text)] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Offline</span>
              </span>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[color:var(--danger-text)] text-xs flex items-start gap-2 animate-in fade-in" role="alert">
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-[color:var(--danger-text)]" />
            <span className="break-words">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="super-admin-username" className="text-sm font-semibold text-[color:var(--text-primary)] block">Admin Username</label>
            <div className="relative">
              <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]" />
              <input
                id="super-admin-username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--bg-app)] py-2.5 pl-9 pr-3 font-mono text-sm text-[color:var(--text-primary)] placeholder-[color:var(--text-placeholder)] transition-colors focus:border-[color:var(--accent-500)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-500)]/30"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="super-admin-password" className="text-sm font-semibold text-[color:var(--text-primary)] block">Admin Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]" />
              <input
                id="super-admin-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="SuperAdmin password"
                className="w-full rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--bg-app)] py-2.5 pl-9 pr-10 font-mono text-sm text-[color:var(--text-primary)] placeholder-[color:var(--text-placeholder)] transition-colors focus:border-[color:var(--accent-500)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-500)]/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-500)]"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--accent-500)] py-2.5 text-sm font-semibold text-[color:var(--accent-contrast)] shadow-lg shadow-[color:var(--accent-500)]/25 transition-all hover:bg-[color:var(--accent-600)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-500)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg-surface-1)] disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Authenticating Super Admin...</span>
              </>
            ) : (
              <>
                <span>Sign In as Super Admin</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Switch back to Broker Login */}
        <div className="pt-4 border-t border-[color:var(--border-subtle)] flex flex-col items-center gap-3 text-center">
          <p className="text-[11px] text-[color:var(--text-secondary)]">
            Need to manage a specific broker trading group or client accounts?
          </p>
          <button
            type="button"
            onClick={() => {
              if (onSwitchToBrokerLogin) onSwitchToBrokerLogin();
              else if (navigate) navigate('/admin-login');
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-surface-2)] py-2 text-sm font-medium text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--bg-surface-3)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-500)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg-surface-1)]"
          >
            <Building2 size={14} className="text-[color:var(--text-secondary)]" />
            <span>Switch to Broker Admin Login</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminAuthScreen;
