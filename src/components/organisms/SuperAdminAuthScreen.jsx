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
  getSuperAdminBaseUrl,
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
    <div className="min-h-screen w-screen bg-[#070b12] flex items-center justify-center p-4 select-none font-sans relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-2xl p-8 shadow-2xl z-10 space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 mb-1 shadow-inner">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">RTX5 Technology Admin</h1>
          <p className="text-xs text-slate-400">
            Dedicated Super Admin Control Plane Authentication
          </p>
        </div>

        {/* Backend Connectivity Status Bar */}
        <div className="p-3 rounded-lg bg-[#070b12] border border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Server size={13} className="text-slate-400" />
            <span className="text-slate-400 truncate max-w-[200px]" title={backendOrigin}>
              {backendOrigin}
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            {healthStatus.loading ? (
              <span className="text-slate-500 flex items-center gap-1">
                <Loader2 size={11} className="animate-spin" />
                <span>Checking...</span>
              </span>
            ) : healthStatus.ok ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Online</span>
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Offline</span>
              </span>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
            <span className="break-words">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Admin Username</span>
              <span className="text-[10px] text-slate-500 font-mono">POST /api/v1/admin/auth/login</span>
            </label>
            <div className="relative">
              <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full bg-[#070b12] border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Admin Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="SuperAdmin password"
                className="w-full bg-[#070b12] border border-slate-800 rounded-lg pl-9 pr-9 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/25"
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
        <div className="pt-4 border-t border-slate-800/80 flex flex-col items-center gap-3 text-center">
          <p className="text-[11px] text-slate-400">
            Need to manage a specific broker trading group or client accounts?
          </p>
          <button
            type="button"
            onClick={() => {
              if (onSwitchToBrokerLogin) onSwitchToBrokerLogin();
              else if (navigate) navigate('/admin-login');
            }}
            className="w-full py-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Building2 size={14} className="text-slate-400" />
            <span>Switch to Broker Admin Login</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminAuthScreen;
