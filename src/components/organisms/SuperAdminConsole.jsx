import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownUp,
  ArrowRight,
  Boxes,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Copy,
  Cpu,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Flame,
  Globe,
  HardDrive,
  Key,
  Layers,
  Link,
  ListFilter,
  Loader2,
  Lock,
  LogOut,
  Maximize2,
  Minimize2,
  Monitor,
  MoreVertical,
  Network,
  Play,
  Plus,
  Power,
  PowerOff,
  Radio,
  RefreshCw,
  Search,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Trash2,
  Unlock,
  Upload,
  User,
  Users,
  Wifi,
  WifiOff,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  getSuperAdminSession,
  clearSuperAdminSession,
  executeSuperAdminOperation,
  getSuperAdminBaseUrl,
  getSuperAdminOrigin,
  checkSuperAdminHealth,
  checkSuperAdminReadiness,
  startSuperAdminStream,
} from '../../services/superAdmin.service';
import {
  SUPER_ADMIN_API_SECTIONS,
  SUPER_ADMIN_API_CATALOG,
  getSuperAdminOperation,
  extractPathParams,
} from '../../config/superAdminApiCatalog';

// Badge Component
const StatusBadge = ({ status, active, text }) => {
  const isGood = active || ['active', 'ok', 'online', 'healthy', 'connected', 'ready'].includes(String(status).toLowerCase());
  const isBad = ['suspended', 'error', 'failed', 'down', 'disconnected', 'terminated'].includes(String(status).toLowerCase());
  const isWarn = ['warning', 'degraded', 'provisioning', 'pending'].includes(String(status).toLowerCase());

  let bg = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  let dot = 'bg-slate-400';

  if (isGood) {
    bg = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    dot = 'bg-emerald-400';
  } else if (isBad) {
    bg = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    dot = 'bg-rose-400';
  } else if (isWarn) {
    bg = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    dot = 'bg-amber-400';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {text || status}
    </span>
  );
};

export const SuperAdminConsole = ({ onClose, onNavigateBrokerLogin }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [session, setSession] = useState(() => getSuperAdminSession());
  const [healthStatus, setHealthStatus] = useState({ loading: true, ok: false, data: null });
  const [readinessStatus, setReadinessStatus] = useState({ loading: true, ok: false, data: null });
  const [stats, setStats] = useState({ loading: false, data: null, error: '' });
  const [auditLog, setAuditLog] = useState({ loading: false, data: [], error: '' });

  // Brokers Tab State
  const [brokers, setBrokers] = useState({ loading: false, list: [], error: '' });
  const [selectedBroker, setSelectedBroker] = useState(null);
  const [brokerDetailsModal, setBrokerDetailsModal] = useState(null);
  const [createBrokerModalOpen, setCreateBrokerModalOpen] = useState(false);
  const [managerCredsModal, setManagerCredsModal] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [brokerSearch, setBrokerSearch] = useState('');
  const [actionLoading, setActionLoading] = useState({});

  // Licenses Tab State
  const [licensePlans, setLicensePlans] = useState({ loading: false, list: [], error: '' });
  const [expiringLicenses, setExpiringLicenses] = useState({ loading: false, list: [], error: '' });
  const [createPlanModalOpen, setCreatePlanModalOpen] = useState(false);

  // Servers Tab State
  const [servers, setServers] = useState({ loading: false, list: [], error: '' });
  const [bulkHealth, setBulkHealth] = useState({ loading: false, data: null });

  // Market Data State
  const [centralLP, setCentralLP] = useState({ loading: false, data: null, error: '' });
  const [lps, setLps] = useState({ loading: false, list: [], error: '' });
  const [brokerFixAccounts, setBrokerFixAccounts] = useState({ loading: false, list: [], error: '' });
  const [fixSessions, setFixSessions] = useState({ loading: false, list: [], error: '' });
  const [failoverEvents, setFailoverEvents] = useState({ loading: false, list: [], error: '' });
  const [gatewayStatus, setGatewayStatus] = useState({ loading: false, data: null, error: '' });

  // MD Monitoring & Live Candles State
  const [liveSymbols, setLiveSymbols] = useState({ loading: false, list: [], error: '' });
  const [candleStorage, setCandleStorage] = useState({ loading: false, data: null, error: '' });
  const [streamTicket, setStreamTicket] = useState('');

  // API Explorer State
  const [selectedApiId, setSelectedApiId] = useState('system.stats');
  const [apiPathParams, setApiPathParams] = useState({});
  const [apiQueryParams, setApiQueryParams] = useState({});
  const [apiRequestBody, setApiRequestBody] = useState('{}');
  const [apiExecution, setApiExecution] = useState({ loading: false, response: null, error: null, timeMs: 0 });
  const [apiFilterQuery, setApiFilterQuery] = useState('');
  const [apiFilterSection, setApiFilterSection] = useState('all');

  // Copy helper
  const [copiedKey, setCopiedKey] = useState('');
  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  // Check initial health
  const refreshSystemHealth = useCallback(async () => {
    setHealthStatus((s) => ({ ...s, loading: true }));
    setReadinessStatus((s) => ({ ...s, loading: true }));
    const health = await checkSuperAdminHealth();
    setHealthStatus({ loading: false, ok: health.ok, data: health.data || health.error });
    const ready = await checkSuperAdminReadiness();
    setReadinessStatus({ loading: false, ok: ready.ok, data: ready.data || ready.error });
  }, []);

  const loadStats = useCallback(async () => {
    setStats((s) => ({ ...s, loading: true, error: '' }));
    try {
      const res = await executeSuperAdminOperation('system.stats');
      setStats({ loading: false, data: res.data, error: '' });
    } catch (err) {
      setStats({ loading: false, data: null, error: err.message });
    }
  }, []);

  const loadAuditLog = useCallback(async () => {
    setAuditLog((s) => ({ ...s, loading: true, error: '' }));
    try {
      const res = await executeSuperAdminOperation('system.audit-log');
      const list = Array.isArray(res.data) ? res.data : (res.data?.items || res.data?.logs || []);
      setAuditLog({ loading: false, data: list, error: '' });
    } catch (err) {
      setAuditLog({ loading: false, data: [], error: err.message });
    }
  }, []);

  // Brokers Loader
  const loadBrokers = useCallback(async () => {
    setBrokers((s) => ({ ...s, loading: true, error: '' }));
    try {
      const res = await executeSuperAdminOperation('brokers.list');
      const list = Array.isArray(res.data) ? res.data : (res.data?.brokers || res.data?.items || []);
      setBrokers({ loading: false, list, error: '' });
    } catch (err) {
      setBrokers({ loading: false, list: [], error: err.message });
    }
  }, []);

  // Licenses Loader
  const loadLicenses = useCallback(async () => {
    setLicensePlans((s) => ({ ...s, loading: true, error: '' }));
    setExpiringLicenses((s) => ({ ...s, loading: true, error: '' }));
    try {
      const [plansRes, expRes] = await Promise.all([
        executeSuperAdminOperation('license-management.plans-list'),
        executeSuperAdminOperation('license-management.expiring'),
      ]);
      setLicensePlans({
        loading: false,
        list: Array.isArray(plansRes.data) ? plansRes.data : (plansRes.data?.plans || []),
        error: '',
      });
      setExpiringLicenses({
        loading: false,
        list: Array.isArray(expRes.data) ? expRes.data : (expRes.data?.expiring || []),
        error: '',
      });
    } catch (err) {
      setLicensePlans((s) => ({ ...s, loading: false, error: err.message }));
      setExpiringLicenses((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  // Servers Loader
  const loadServers = useCallback(async () => {
    setServers((s) => ({ ...s, loading: true, error: '' }));
    try {
      const res = await executeSuperAdminOperation('server-monitoring.list');
      const list = Array.isArray(res.data) ? res.data : (res.data?.servers || []);
      setServers({ loading: false, list, error: '' });
    } catch (err) {
      setServers({ loading: false, list: [], error: err.message });
    }
  }, []);

  // Market Data Loader
  const loadMarketData = useCallback(async () => {
    setCentralLP((s) => ({ ...s, loading: true, error: '' }));
    setLps((s) => ({ ...s, loading: true, error: '' }));
    setBrokerFixAccounts((s) => ({ ...s, loading: true, error: '' }));
    setFixSessions((s) => ({ ...s, loading: true, error: '' }));
    setFailoverEvents((s) => ({ ...s, loading: true, error: '' }));
    setGatewayStatus((s) => ({ ...s, loading: true, error: '' }));

    try {
      const [centralRes, lpsRes, fixAccRes, fixSessRes, failoverRes, gwRes] = await Promise.allSettled([
        executeSuperAdminOperation('market-data-hub.central-lp-get'),
        executeSuperAdminOperation('market-data-hub.lps-list'),
        executeSuperAdminOperation('market-data-hub.fix-accounts-list'),
        executeSuperAdminOperation('market-data-hub.fix-sessions-list'),
        executeSuperAdminOperation('market-data-hub.failover-events'),
        executeSuperAdminOperation('lp-gateway.status'),
      ]);

      if (centralRes.status === 'fulfilled') setCentralLP({ loading: false, data: centralRes.value.data, error: '' });
      else setCentralLP({ loading: false, data: null, error: centralRes.reason?.message });

      if (lpsRes.status === 'fulfilled') {
        const l = Array.isArray(lpsRes.value.data) ? lpsRes.value.data : (lpsRes.value.data?.lps || []);
        setLps({ loading: false, list: l, error: '' });
      } else setLps({ loading: false, list: [], error: lpsRes.reason?.message });

      if (fixAccRes.status === 'fulfilled') {
        const a = Array.isArray(fixAccRes.value.data) ? fixAccRes.value.data : (fixAccRes.value.data?.accounts || []);
        setBrokerFixAccounts({ loading: false, list: a, error: '' });
      } else setBrokerFixAccounts({ loading: false, list: [], error: fixAccRes.reason?.message });

      if (fixSessRes.status === 'fulfilled') {
        const s = Array.isArray(fixSessRes.value.data) ? fixSessRes.value.data : (fixSessRes.value.data?.sessions || []);
        setFixSessions({ loading: false, list: s, error: '' });
      } else setFixSessions({ loading: false, list: [], error: fixSessRes.reason?.message });

      if (failoverRes.status === 'fulfilled') {
        const f = Array.isArray(failoverRes.value.data) ? failoverRes.value.data : (failoverRes.value.data?.events || []);
        setFailoverEvents({ loading: false, list: f, error: '' });
      } else setFailoverEvents({ loading: false, list: [], error: failoverRes.reason?.message });

      if (gwRes.status === 'fulfilled') setGatewayStatus({ loading: false, data: gwRes.value.data, error: '' });
      else setGatewayStatus({ loading: false, data: null, error: gwRes.reason?.message });
    } catch {
      // Handled in settled
    }
  }, []);

  // MD Monitoring & Candles Loader
  const loadCandlesAndMonitoring = useCallback(async () => {
    setLiveSymbols((s) => ({ ...s, loading: true, error: '' }));
    setCandleStorage((s) => ({ ...s, loading: true, error: '' }));

    try {
      const [symRes, storageRes] = await Promise.allSettled([
        executeSuperAdminOperation('market-data-monitoring.live-symbols'),
        executeSuperAdminOperation('market-data-monitoring.candle-storage'),
      ]);

      if (symRes.status === 'fulfilled') {
        const l = Array.isArray(symRes.value.data) ? symRes.value.data : (symRes.value.data?.symbols || []);
        setLiveSymbols({ loading: false, list: l, error: '' });
      } else setLiveSymbols({ loading: false, list: [], error: symRes.reason?.message });

      if (storageRes.status === 'fulfilled') {
        setCandleStorage({ loading: false, data: storageRes.value.data, error: '' });
      } else setCandleStorage({ loading: false, data: null, error: storageRes.reason?.message });
    } catch {
      // Handled in settled
    }
  }, []);

  // Initial load based on tab
  useEffect(() => {
    refreshSystemHealth();
  }, [refreshSystemHealth]);

  useEffect(() => {
    if (activeTab === 'overview') {
      loadStats();
      loadAuditLog();
    } else if (activeTab === 'brokers') {
      loadBrokers();
    } else if (activeTab === 'licenses') {
      loadLicenses();
    } else if (activeTab === 'servers') {
      loadServers();
    } else if (activeTab === 'market-data') {
      loadMarketData();
    } else if (activeTab === 'monitoring') {
      loadCandlesAndMonitoring();
    }
  }, [activeTab, loadStats, loadAuditLog, loadBrokers, loadLicenses, loadServers, loadMarketData, loadCandlesAndMonitoring]);

  // Handle Action Operations
  const handleBrokerAction = async (brokerId, action) => {
    const key = `${brokerId}-${action}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));

    try {
      if (action === 'suspend') {
        await executeSuperAdminOperation('brokers.suspend', { pathParams: { broker_id: brokerId } });
        await loadBrokers();
      } else if (action === 'activate') {
        await executeSuperAdminOperation('brokers.activate', { pathParams: { broker_id: brokerId } });
        await loadBrokers();
      } else if (action === 'manager-credentials') {
        const res = await executeSuperAdminOperation('brokers.manager-credentials', { pathParams: { broker_id: brokerId } });
        setManagerCredsModal({ brokerId, creds: res.data });
      } else if (action === 'reset-manager-password') {
        if (!confirm(`Are you sure you want to reset the admin manager password for broker "${brokerId}"?`)) {
          return;
        }
        const res = await executeSuperAdminOperation('brokers.manager-credentials-reset', { pathParams: { broker_id: brokerId } });
        setManagerCredsModal({ brokerId, creds: res.data });
      } else if (action === 'license-sync') {
        await executeSuperAdminOperation('brokers.license-sync-enqueue', { pathParams: { broker_id: brokerId } });
        alert(`License sync enqueued for broker ${brokerId}`);
      } else if (action === 'regenerate-key') {
        if (!confirm(`WARNING: Regenerating the license key will require updating broker's .env. Proceed for "${brokerId}"?`)) {
          return;
        }
        const res = await executeSuperAdminOperation('license-management.regenerate-key', { pathParams: { broker_id: brokerId } });
        alert(`New License Key: ${res.data?.license_key || JSON.stringify(res.data)}`);
        await loadBrokers();
      } else if (action === 'terminate') {
        if (!confirm(`CAUTION: Terminate broker "${brokerId}"? This will disable its operations.`)) return;
        await executeSuperAdminOperation('brokers.terminate', { pathParams: { broker_id: brokerId } });
        await loadBrokers();
      } else if (action === 'purge') {
        const entered = prompt(`CRITICAL: Type "${brokerId}" to permanently purge this broker and all associated data:`);
        if (entered !== brokerId) {
          alert('Broker purge cancelled: confirmation did not match.');
          return;
        }
        await executeSuperAdminOperation('brokers.purge', { pathParams: { broker_id: brokerId } });
        await loadBrokers();
      } else if (action === 'details') {
        const res = await executeSuperAdminOperation('brokers.get', { pathParams: { broker_id: brokerId } });
        setBrokerDetailsModal(res.data);
      }
    } catch (err) {
      alert(`Action "${action}" failed: ${err.message}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleBulkServerHealth = async () => {
    setBulkHealth({ loading: true, data: null });
    try {
      const res = await executeSuperAdminOperation('server-monitoring.health');
      setBulkHealth({ loading: false, data: res.data });
    } catch (err) {
      setBulkHealth({ loading: false, data: { error: err.message } });
    }
  };

  const handlePingServer = async (brokerId, serverId) => {
    const key = `ping-${serverId}`;
    setActionLoading((p) => ({ ...p, [key]: true }));
    try {
      const res = await executeSuperAdminOperation('server-monitoring.ping', {
        pathParams: { broker_id: brokerId, server_id: serverId },
      });
      alert(`Server Ping Response: ${JSON.stringify(res.data)}`);
    } catch (err) {
      alert(`Ping failed: ${err.message}`);
    } finally {
      setActionLoading((p) => ({ ...p, [key]: false }));
    }
  };

  // API Explorer Runner
  const currentOp = useMemo(() => getSuperAdminOperation(selectedApiId), [selectedApiId]);
  const pathPlaceholders = useMemo(() => extractPathParams(currentOp?.path || ''), [currentOp]);

  const handleRunApiExplorer = async (e) => {
    e?.preventDefault();
    if (!currentOp) return;

    setApiExecution({ loading: true, response: null, error: null, timeMs: 0 });
    const startTime = performance.now();

    try {
      let bodyData;
      if (['POST', 'PUT', 'PATCH'].includes(currentOp.method) && apiRequestBody.trim()) {
        try {
          bodyData = JSON.parse(apiRequestBody);
        } catch {
          throw new Error('Request body must be valid JSON');
        }
      }

      const res = await executeSuperAdminOperation(currentOp, {
        pathParams: apiPathParams,
        query: apiQueryParams,
        body: bodyData,
      });

      const elapsed = Math.round(performance.now() - startTime);
      setApiExecution({
        loading: false,
        response: {
          status: res.status,
          headers: res.headers,
          data: res.data,
          requestUrl: res.requestUrl,
        },
        error: null,
        timeMs: elapsed,
      });
    } catch (err) {
      const elapsed = Math.round(performance.now() - startTime);
      setApiExecution({
        loading: false,
        response: err.data ? { status: err.status, data: err.data, requestUrl: err.requestUrl } : null,
        error: err.message,
        timeMs: elapsed,
      });
    }
  };

  const filteredCatalog = useMemo(() => {
    return SUPER_ADMIN_API_CATALOG.filter((item) => {
      const matchesSection = apiFilterSection === 'all' || item.id.startsWith(apiFilterSection);
      const q = apiFilterQuery.toLowerCase();
      const matchesQuery = !q || item.id.toLowerCase().includes(q)
        || item.label.toLowerCase().includes(q)
        || item.path.toLowerCase().includes(q)
        || item.method.toLowerCase().includes(q);
      return matchesSection && matchesQuery;
    });
  }, [apiFilterSection, apiFilterQuery]);

  const filteredBrokers = useMemo(() => {
    if (!brokerSearch.trim()) return brokers.list;
    const q = brokerSearch.toLowerCase();
    return brokers.list.filter(
      (b) => String(b.broker_id || b.id || '').toLowerCase().includes(q)
        || String(b.name || '').toLowerCase().includes(q)
        || String(b.plan || '').toLowerCase().includes(q)
    );
  }, [brokers.list, brokerSearch]);

  const handleLogout = () => {
    clearSuperAdminSession();
    setSession({ isAuthenticated: false, user: null, token: '' });
    if (onClose) onClose();
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0b0f17] text-slate-200 select-none overflow-hidden font-sans">
      {/* Top Super Admin Header */}
      <header className="h-14 shrink-0 bg-[#121824] border-b border-slate-800 flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-semibold text-sm">
            <ShieldCheck size={18} className="text-indigo-400" />
            <span>RTX5 Super Admin</span>
          </div>
          <span className="text-xs text-slate-400 font-mono hidden md:inline">
            Control Plane · {getSuperAdminOrigin()}
          </span>
          <div className="flex items-center gap-2 ml-2 pl-3 border-l border-slate-700">
            <span
              className={`w-2 h-2 rounded-full ${healthStatus.ok ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}
              title={healthStatus.ok ? 'Control Plane Online' : 'Health check failed'}
            />
            <span className="text-xs text-slate-300 font-medium">
              {healthStatus.loading ? 'Checking...' : healthStatus.ok ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={refreshSystemHealth}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Refresh System Status"
          >
            <RefreshCw size={15} />
          </button>

          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs">
            <User size={13} className="text-slate-400" />
            <span className="text-slate-200 font-medium">
              {session.user?.username || session.user?.login || 'admin'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono uppercase">
              Super Admin
            </span>
          </div>

          {onNavigateBrokerLogin && (
            <button
              type="button"
              onClick={onNavigateBrokerLogin}
              className="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Building2 size={13} />
              <span>Broker Admin</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="text-xs px-2.5 py-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-colors flex items-center gap-1.5"
            title="Sign Out Super Admin"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Logout</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              title="Close Super Admin View"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <aside className="w-60 shrink-0 bg-[#0e1420] border-r border-slate-800 flex flex-col justify-between overflow-y-auto">
          <nav className="p-3 space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-1">
              Platform Modules
            </div>

            {[
              { id: 'overview', label: 'Platform & Health', icon: Activity, count: null },
              { id: 'brokers', label: 'Brokers Registry', icon: Building2, count: brokers.list.length || null },
              { id: 'licenses', label: 'License Management', icon: Key, count: licensePlans.list.length || null },
              { id: 'servers', label: 'Server Monitoring', icon: Server, count: servers.list.length || null },
              { id: 'market-data', label: 'Market Data Hub', icon: Database, count: null },
              { id: 'monitoring', label: 'Candles & Symbols', icon: Radio, count: null },
              { id: 'gateway', label: 'LP Gateway', icon: Layers, count: null },
              { id: 'explorer', label: 'API Explorer (91)', icon: Code2, count: 91 },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== null && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer Info */}
          <div className="p-3 border-t border-slate-800/80 text-[11px] text-slate-500 space-y-1 bg-[#0b0f17]">
            <div className="flex items-center justify-between">
              <span>Readiness:</span>
              <span className={`font-mono ${readinessStatus.ok ? 'text-emerald-400' : 'text-amber-400'}`}>
                {readinessStatus.ok ? 'Ready' : 'Checking'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>API Total:</span>
              <span className="font-mono text-slate-400">91 Endpoints</span>
            </div>
            <div className="text-[10px] text-slate-600 truncate mt-1" title={getSuperAdminOrigin()}>
              {getSuperAdminOrigin()}
            </div>
          </div>
        </aside>

        {/* Content Panel */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#0b0f17] overflow-y-auto">
          {/* TAB 1: OVERVIEW & SYSTEM HEALTH */}
          {activeTab === 'overview' && (
            <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">System & Platform Health</h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Global metrics, active cluster nodes, deployment readiness and admin audit activity.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { refreshSystemHealth(); loadStats(); loadAuditLog(); }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw size={13} />
                  <span>Refresh Overview</span>
                </button>
              </div>

              {/* Status Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-[#121824] border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Process Liveness</span>
                    <Activity size={16} className={healthStatus.ok ? 'text-emerald-400' : 'text-rose-400'} />
                  </div>
                  <div className="mt-2 text-2xl font-bold font-mono text-white">
                    {healthStatus.loading ? 'Checking...' : healthStatus.ok ? 'HEALTHY' : 'DOWN'}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 font-mono">
                    GET /health · 200 OK
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#121824] border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>SuperAdmin Readiness</span>
                    <ShieldCheck size={16} className={readinessStatus.ok ? 'text-emerald-400' : 'text-amber-400'} />
                  </div>
                  <div className="mt-2 text-2xl font-bold font-mono text-white">
                    {readinessStatus.loading ? 'Checking...' : readinessStatus.ok ? 'READY' : 'PENDING'}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 font-mono">
                    GET /readiness · Control Plane
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#121824] border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Active Brokers</span>
                    <Building2 size={16} className="text-indigo-400" />
                  </div>
                  <div className="mt-2 text-2xl font-bold font-mono text-white">
                    {stats.data?.active_brokers ?? stats.data?.brokers_count ?? brokers.list.length ?? '—'}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Total registered: {stats.data?.total_brokers ?? brokers.list.length ?? '—'}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#121824] border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Platform Trading Accounts</span>
                    <Users size={16} className="text-emerald-400" />
                  </div>
                  <div className="mt-2 text-2xl font-bold font-mono text-white">
                    {stats.data?.total_accounts ?? stats.data?.traders_count ?? 'Active'}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Across all licensed broker nodes
                  </div>
                </div>
              </div>

              {/* Platform Statistics Detailed Panel */}
              <div className="p-5 rounded-xl bg-[#121824] border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Cpu size={16} className="text-indigo-400" />
                    <span>Platform Statistics</span>
                    <span className="text-xs text-slate-500 font-mono font-normal">GET /api/v1/admin/stats</span>
                  </h2>
                  {stats.data && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(stats.data, 'stats')}
                      className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
                    >
                      {copiedKey === 'stats' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copiedKey === 'stats' ? 'Copied' : 'Copy JSON'}</span>
                    </button>
                  )}
                </div>

                {stats.loading ? (
                  <div className="py-6 flex justify-center text-slate-400 text-xs gap-2 items-center">
                    <Loader2 size={16} className="animate-spin text-indigo-400" />
                    <span>Loading platform statistics...</span>
                  </div>
                ) : stats.error ? (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                    {stats.error}
                  </div>
                ) : stats.data ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(stats.data).map(([key, value]) => (
                      <div key={key} className="p-3 rounded-lg bg-[#0b0f17] border border-slate-800">
                        <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
                          {key.replace(/_/g, ' ')}
                        </div>
                        <div className="text-sm font-semibold font-mono text-white mt-1 break-words">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">No platform stats received yet.</div>
                )}
              </div>

              {/* Admin Audit Log */}
              <div className="p-5 rounded-xl bg-[#121824] border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Clock size={16} className="text-amber-400" />
                    <span>Admin Audit Log</span>
                    <span className="text-xs text-slate-500 font-mono font-normal">GET /api/v1/admin/audit-log</span>
                  </h2>
                  <button
                    type="button"
                    onClick={loadAuditLog}
                    className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
                  >
                    <RefreshCw size={12} />
                    <span>Refresh</span>
                  </button>
                </div>

                {auditLog.loading ? (
                  <div className="py-6 flex justify-center text-slate-400 text-xs gap-2 items-center">
                    <Loader2 size={16} className="animate-spin text-indigo-400" />
                    <span>Loading audit log entries...</span>
                  </div>
                ) : auditLog.data.length === 0 ? (
                  <div className="text-xs text-slate-500 italic py-4 text-center">
                    No recent audit events logged.
                  </div>
                ) : (
                  <div className="border border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-[#0b0f17] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="px-3 py-2 font-medium">Timestamp</th>
                          <th className="px-3 py-2 font-medium">Admin</th>
                          <th className="px-3 py-2 font-medium">Action</th>
                          <th className="px-3 py-2 font-medium">Resource</th>
                          <th className="px-3 py-2 font-medium">IP Address</th>
                          <th className="px-3 py-2 font-medium">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {auditLog.data.slice(0, 20).map((log, idx) => (
                          <tr key={log.id || idx} className="hover:bg-slate-800/40">
                            <td className="px-3 py-2 whitespace-nowrap text-slate-400">
                              {log.created_at || log.timestamp || log.time || '—'}
                            </td>
                            <td className="px-3 py-2 font-semibold text-indigo-300">
                              {log.admin_username || log.user || log.actor || 'admin'}
                            </td>
                            <td className="px-3 py-2 text-slate-200">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                {log.action || log.event || '—'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-300">
                              {log.resource_type || log.target || '—'} {log.resource_id ? `(${log.resource_id})` : ''}
                            </td>
                            <td className="px-3 py-2 text-slate-400">
                              {log.ip_address || log.ip || '—'}
                            </td>
                            <td className="px-3 py-2 text-slate-400 truncate max-w-xs" title={JSON.stringify(log.details || log)}>
                              {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || log.message || '—')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: BROKERS REGISTRY */}
          {activeTab === 'brokers' && (
            <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Brokers Registry & Lifecycle</h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Register, suspend, activate, monitor license usage, and inspect broker manager credentials.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={loadBrokers}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
                  >
                    <RefreshCw size={13} />
                    <span>Refresh</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateBrokerModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-lg shadow-indigo-600/20"
                  >
                    <Plus size={14} />
                    <span>Register New Broker</span>
                  </button>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search brokers by ID, name, plan..."
                    value={brokerSearch}
                    onChange={(e) => setBrokerSearch(e.target.value)}
                    className="w-full bg-[#121824] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <span className="text-xs text-slate-400">
                  Showing {filteredBrokers.length} of {brokers.list.length} brokers
                </span>
              </div>

              {/* Brokers Table */}
              <div className="bg-[#121824] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                {brokers.loading ? (
                  <div className="py-12 flex flex-col justify-center items-center gap-3 text-slate-400 text-xs">
                    <Loader2 size={24} className="animate-spin text-indigo-400" />
                    <span>Loading registered brokers from SuperAdmin...</span>
                  </div>
                ) : brokers.error ? (
                  <div className="p-6 text-center space-y-3">
                    <AlertCircle size={24} className="text-rose-400 mx-auto" />
                    <p className="text-sm text-rose-300">{brokers.error}</p>
                    <button
                      type="button"
                      onClick={loadBrokers}
                      className="px-3 py-1.5 rounded bg-slate-800 text-xs text-slate-300 hover:bg-slate-700"
                    >
                      Retry
                    </button>
                  </div>
                ) : filteredBrokers.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs space-y-2">
                    <Building2 size={28} className="mx-auto text-slate-600" />
                    <p>No brokers found matching your criteria.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-[#0b0f17] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-3 font-medium">Broker ID & Name</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">License Plan</th>
                          <th className="px-4 py-3 font-medium">Servers</th>
                          <th className="px-4 py-3 font-medium">License Key</th>
                          <th className="px-4 py-3 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {filteredBrokers.map((broker) => {
                          const brokerId = broker.broker_id || broker.id;
                          const isSuspended = String(broker.status).toLowerCase() === 'suspended';
                          return (
                            <tr key={brokerId} className="hover:bg-slate-800/30 transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-semibold text-white flex items-center gap-2">
                                  <span>{broker.name || brokerId}</span>
                                  <span className="font-mono text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                                    {brokerId}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  {broker.company_name || broker.admin_email || '—'}
                                </div>
                              </td>

                              <td className="px-4 py-3">
                                <StatusBadge status={broker.status || 'active'} active={!isSuspended} />
                              </td>

                              <td className="px-4 py-3 font-mono text-[11px]">
                                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                  {broker.plan || broker.license_plan || 'standard'}
                                </span>
                              </td>

                              <td className="px-4 py-3 font-mono text-slate-400">
                                {Array.isArray(broker.servers) ? broker.servers.length : (broker.server_count || '1')} nodes
                              </td>

                              <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                                {broker.license_key ? (
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(broker.license_key, `lk-${brokerId}`)}
                                    className="flex items-center gap-1 hover:text-white group"
                                    title="Click to copy full key"
                                  >
                                    <span className="truncate max-w-[120px]">{broker.license_key}</span>
                                    {copiedKey === `lk-${brokerId}` ? (
                                      <Check size={12} className="text-emerald-400" />
                                    ) : (
                                      <Copy size={12} className="opacity-0 group-hover:opacity-100" />
                                    )}
                                  </button>
                                ) : (
                                  '—'
                                )}
                              </td>

                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleBrokerAction(brokerId, 'details')}
                                    className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                                    title="Broker Details & Servers"
                                  >
                                    <Eye size={14} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleBrokerAction(brokerId, 'manager-credentials')}
                                    className="p-1.5 rounded hover:bg-slate-700 text-amber-400 hover:text-amber-300"
                                    title="Reveal Manager Credentials"
                                  >
                                    <Key size={14} />
                                  </button>

                                  {isSuspended ? (
                                    <button
                                      type="button"
                                      disabled={actionLoading[`${brokerId}-activate`]}
                                      onClick={() => handleBrokerAction(brokerId, 'activate')}
                                      className="p-1.5 rounded hover:bg-emerald-500/20 text-emerald-400"
                                      title="Reactivate Broker"
                                    >
                                      {actionLoading[`${brokerId}-activate`] ? (
                                        <Loader2 size={14} className="animate-spin" />
                                      ) : (
                                        <Play size={14} />
                                      )}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={actionLoading[`${brokerId}-suspend`]}
                                      onClick={() => handleBrokerAction(brokerId, 'suspend')}
                                      className="p-1.5 rounded hover:bg-amber-500/20 text-amber-400"
                                      title="Suspend Broker"
                                    >
                                      {actionLoading[`${brokerId}-suspend`] ? (
                                        <Loader2 size={14} className="animate-spin" />
                                      ) : (
                                        <PowerOff size={14} />
                                      )}
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleBrokerAction(brokerId, 'license-sync')}
                                    className="p-1.5 rounded hover:bg-slate-700 text-indigo-400 hover:text-indigo-300"
                                    title="Enqueue License Sync"
                                  >
                                    <RefreshCw size={14} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleBrokerAction(brokerId, 'terminate')}
                                    className="p-1.5 rounded hover:bg-rose-500/20 text-rose-400 hover:text-rose-300"
                                    title="Terminate Broker"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: LICENSE MANAGEMENT */}
          {activeTab === 'licenses' && (
            <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">License Plans & Expiry</h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tiered license plans, expiration tracking, and key regeneration controls.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadLicenses}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
                  >
                    <RefreshCw size={13} />
                    <span>Refresh</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatePlanModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Plus size={14} />
                    <span>Create License Plan</span>
                  </button>
                </div>
              </div>

              {/* Expiring Licenses Monitor */}
              <div className="p-5 rounded-xl bg-[#121824] border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Clock size={16} className="text-amber-400" />
                    <span>Brokers with Expiring Licenses</span>
                    <span className="text-xs text-slate-500 font-mono font-normal">GET /api/v1/admin/licenses/expiring</span>
                  </h2>
                </div>

                {expiringLicenses.loading ? (
                  <div className="py-4 text-center text-xs text-slate-400">Checking expiring licenses...</div>
                ) : expiringLicenses.list.length === 0 ? (
                  <div className="py-4 text-center text-xs text-emerald-400 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                    No brokers currently nearing license expiration. All runtime licenses healthy.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {expiringLicenses.list.map((item, idx) => (
                      <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-semibold text-white">{item.broker_id || item.id}</span>
                          <span className="ml-2 text-slate-400">Expires: {item.expires_at || item.expiry || 'Soon'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const days = prompt('Extend license by how many days?', '30');
                            if (!days) return;
                            try {
                              await executeSuperAdminOperation('license-management.extend', {
                                pathParams: { broker_id: item.broker_id || item.id },
                                body: { days: parseInt(days, 10) },
                              });
                              alert('License extended successfully!');
                              loadLicenses();
                            } catch (e) {
                              alert(`Extend failed: ${e.message}`);
                            }
                          }}
                          className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                        >
                          Extend License
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* License Plans List */}
              <div className="p-5 rounded-xl bg-[#121824] border border-slate-800 space-y-3">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Key size={16} className="text-indigo-400" />
                  <span>Configured License Plans</span>
                  <span className="text-xs text-slate-500 font-mono font-normal">GET /api/v1/admin/licenses/plans</span>
                </h2>

                {licensePlans.loading ? (
                  <div className="py-6 text-center text-xs text-slate-400">Loading license plans...</div>
                ) : licensePlans.list.length === 0 ? (
                  <div className="text-xs text-slate-500 italic py-4 text-center">No license plans returned from backend.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {licensePlans.list.map((plan) => (
                      <div key={plan.id || plan.plan_id || plan.name} className="p-4 rounded-xl bg-[#0b0f17] border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">{plan.name || plan.plan_id}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-mono">
                            {plan.id || plan.plan_id}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{plan.description || 'Standard platform tier'}</p>
                        <div className="text-xs space-y-1 pt-2 border-t border-slate-800 font-mono text-slate-300">
                          <div>Max Accounts: <span className="text-white">{plan.max_accounts ?? 'Unlimited'}</span></div>
                          <div>Max Servers: <span className="text-white">{plan.max_servers ?? '1'}</span></div>
                          <div>Feed Enabled: <span className="text-emerald-400">{plan.feed_enabled ? 'Yes' : 'No'}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SERVER MONITORING */}
          {activeTab === 'servers' && (
            <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Broker Servers & Fleet Health</h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live endpoint health checks, latency monitoring, and active broker host mappings.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={loadServers}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700"
                  >
                    <RefreshCw size={13} />
                    <span>Refresh</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkServerHealth}
                    disabled={bulkHealth.loading}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    {bulkHealth.loading ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
                    <span>Bulk Health Check</span>
                  </button>
                </div>
              </div>

              {/* Bulk Health Result banner */}
              {bulkHealth.data && (
                <div className="p-4 rounded-xl bg-[#121824] border border-emerald-500/30 text-xs space-y-1">
                  <div className="font-semibold text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    <span>Bulk Health Check Completed</span>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto max-h-40">
                    {JSON.stringify(bulkHealth.data, null, 2)}
                  </pre>
                </div>
              )}

              {/* All Servers Table */}
              <div className="bg-[#121824] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                {servers.loading ? (
                  <div className="py-12 flex justify-center items-center gap-2 text-slate-400 text-xs">
                    <Loader2 size={20} className="animate-spin text-indigo-400" />
                    <span>Polling all active broker servers...</span>
                  </div>
                ) : servers.list.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs space-y-2">
                    <Server size={28} className="mx-auto text-slate-600" />
                    <p>No active broker servers reported in fleet registry.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-[#0b0f17] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3 font-medium">Server Address</th>
                        <th className="px-4 py-3 font-medium">Broker</th>
                        <th className="px-4 py-3 font-medium">Type / Role</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Ping</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
                      {servers.list.map((srv, i) => (
                        <tr key={srv.server_id || srv.id || i} className="hover:bg-slate-800/30">
                          <td className="px-4 py-3 font-semibold text-white">
                            {srv.host || srv.ip || srv.address}:{srv.port || '80'}
                          </td>
                          <td className="px-4 py-3 text-indigo-400 font-sans">
                            {srv.broker_id || srv.broker || '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            {srv.role || srv.type || 'gateway'}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={srv.status || (srv.is_active ? 'online' : 'disabled')} />
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            {srv.latency ? `${srv.latency}ms` : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handlePingServer(srv.broker_id, srv.server_id || srv.id)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                            >
                              Ping
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: MARKET DATA HUB */}
          {activeTab === 'market-data' && (
            <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Market Data Hub & Liquidity</h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Central LP configuration, broker FIX accounts, active FIX sessions, and failover monitoring.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadMarketData}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw size={13} />
                  <span>Refresh Hub</span>
                </button>
              </div>

              {/* Central LP Status & Controls */}
              <div className="p-5 rounded-xl bg-[#121824] border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Radio size={16} className="text-emerald-400" />
                    <span>Central Liquidity Provider (LP) Configuration</span>
                    <span className="text-xs text-slate-500 font-mono font-normal">GET /api/v1/admin/market-data/central-lp</span>
                  </h2>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await executeSuperAdminOperation('market-data-hub.central-lp-test');
                        alert(`Central LP Test Result: ${JSON.stringify(res.data)}`);
                      } catch (e) {
                        alert(`Test failed: ${e.message}`);
                      }
                    }}
                    className="px-3 py-1 rounded bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium hover:bg-emerald-600/30"
                  >
                    Test Central LP Connection
                  </button>
                </div>

                {centralLP.loading ? (
                  <div className="py-4 text-xs text-slate-400">Loading Central LP state...</div>
                ) : centralLP.error ? (
                  <div className="text-xs text-rose-400">{centralLP.error}</div>
                ) : (
                  <pre className="p-3 bg-[#0b0f17] border border-slate-800 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto max-h-48">
                    {JSON.stringify(centralLP.data || { status: 'idle', config: 'default' }, null, 2)}
                  </pre>
                )}
              </div>

              {/* Liquidity Providers (LPs) */}
              <div className="p-5 rounded-xl bg-[#121824] border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Database size={16} className="text-indigo-400" />
                    <span>Liquidity Providers Registry</span>
                    <span className="text-xs text-slate-500 font-mono font-normal">GET /api/v1/admin/market-data/lps</span>
                  </h2>
                </div>

                {lps.loading ? (
                  <div className="py-4 text-xs text-slate-400">Loading LPs...</div>
                ) : lps.list.length === 0 ? (
                  <div className="text-xs text-slate-500 italic py-2">No liquidity providers configured yet.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {lps.list.map((lp) => (
                      <div key={lp.id || lp.lp_id} className="p-3 rounded-lg bg-[#0b0f17] border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">{lp.name || lp.id}</span>
                          <StatusBadge status={lp.status || (lp.enabled ? 'active' : 'disabled')} />
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">Host: {lp.host || '—'}:{lp.port || '—'}</div>
                        <div className="text-[11px] font-mono text-slate-400">Protocol: {lp.protocol || 'FIX 4.4'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Broker FIX Sessions */}
              <div className="p-5 rounded-xl bg-[#121824] border border-slate-800 space-y-3">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Wifi size={16} className="text-amber-400" />
                  <span>Active Broker FIX Market Data Sessions</span>
                  <span className="text-xs text-slate-500 font-mono font-normal">GET /api/v1/admin/market-data/fix-sessions</span>
                </h2>

                {fixSessions.loading ? (
                  <div className="py-4 text-xs text-slate-400">Polling active FIX sessions...</div>
                ) : fixSessions.list.length === 0 ? (
                  <div className="text-xs text-slate-500 italic py-2">No active FIX sessions currently connected.</div>
                ) : (
                  <div className="border border-slate-800 rounded-lg overflow-hidden font-mono text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-[#0b0f17] text-slate-400 uppercase text-[10px]">
                        <tr>
                          <th className="px-3 py-2">Session ID</th>
                          <th className="px-3 py-2">Broker</th>
                          <th className="px-3 py-2">Target Comp ID</th>
                          <th className="px-3 py-2">Connected At</th>
                          <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {fixSessions.list.map((sess) => (
                          <tr key={sess.session_id || sess.id} className="hover:bg-slate-800/30">
                            <td className="px-3 py-2 text-white">{sess.session_id || sess.id}</td>
                            <td className="px-3 py-2 text-indigo-300">{sess.broker_id || '—'}</td>
                            <td className="px-3 py-2 text-slate-400">{sess.target_comp_id || '—'}</td>
                            <td className="px-3 py-2 text-slate-400">{sess.connected_at || '—'}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!confirm(`Disconnect FIX session ${sess.session_id}?`)) return;
                                  await executeSuperAdminOperation('market-data-hub.fix-sessions-disconnect', {
                                    pathParams: { session_id: sess.session_id || sess.id },
                                  });
                                  loadMarketData();
                                }}
                                className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-[11px]"
                              >
                                Disconnect
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: CANDLES & SYMBOLS MONITORING */}
          {activeTab === 'monitoring' && (
            <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Market Data Monitoring & Candles</h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live symbol feeds, candle storage fleet health, gap scanning, and backfill job controls.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await executeSuperAdminOperation('market-data-monitoring.stream-ticket');
                        setStreamTicket(res.data?.ticket || JSON.stringify(res.data));
                      } catch (e) {
                        alert(`Ticket error: ${e.message}`);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5"
                  >
                    <Key size={13} />
                    <span>Create Stream Ticket</span>
                  </button>
                  <button
                    type="button"
                    onClick={loadCandlesAndMonitoring}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700"
                  >
                    <RefreshCw size={13} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {streamTicket && (
                <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs font-mono text-indigo-300 flex items-center justify-between">
                  <span>Stream Ticket: {streamTicket}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(streamTicket, 'ticket')}
                    className="text-xs text-indigo-400 hover:text-white"
                  >
                    Copy
                  </button>
                </div>
              )}

              {/* Live Symbols Overview */}
              <div className="p-5 rounded-xl bg-[#121824] border border-slate-800 space-y-3">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Radio size={16} className="text-emerald-400" />
                  <span>Live Market Data Symbols</span>
                  <span className="text-xs text-slate-500 font-mono font-normal">GET /api/v1/admin/market-data/live-symbols</span>
                </h2>

                {liveSymbols.loading ? (
                  <div className="py-4 text-xs text-slate-400">Loading symbols...</div>
                ) : liveSymbols.list.length === 0 ? (
                  <div className="text-xs text-slate-500 italic py-2">No live symbols currently broadcasting.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {liveSymbols.list.map((sym, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded bg-[#0b0f17] border border-slate-800 text-xs font-mono text-slate-200"
                      >
                        {typeof sym === 'object' ? (sym.symbol || sym.name) : sym}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Candle Storage Fleet Status */}
              <div className="p-5 rounded-xl bg-[#121824] border border-slate-800 space-y-3">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <HardDrive size={16} className="text-indigo-400" />
                  <span>Candle Storage Fleet Status</span>
                  <span className="text-xs text-slate-500 font-mono font-normal">GET /api/v1/admin/market-data/candle-storage</span>
                </h2>

                <pre className="p-3 bg-[#0b0f17] border border-slate-800 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto max-h-56">
                  {JSON.stringify(candleStorage.data || { status: 'fleet_idle' }, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 7: LP GATEWAY */}
          {activeTab === 'gateway' && (
            <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">LP Gateway (Feed-Only)</h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Dedicated market data feed gateway connection controls.
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-[#121824] border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Gateway Connection Status</h2>
                    <p className="text-xs text-slate-400">GET /api/v1/admin/gateway/lp/status</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await executeSuperAdminOperation('lp-gateway.connect');
                          alert('Gateway connect dispatched successfully.');
                        } catch (e) {
                          alert(`Connect error: ${e.message}`);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
                    >
                      Connect Gateway
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm('Disconnect feed-only LP gateway?')) return;
                        try {
                          await executeSuperAdminOperation('lp-gateway.disconnect');
                          alert('Gateway disconnected.');
                        } catch (e) {
                          alert(`Disconnect error: ${e.message}`);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium"
                    >
                      Disconnect Gateway
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-[#0b0f17] border border-slate-800 rounded-lg text-xs font-mono text-slate-300">
                  {JSON.stringify(gatewayStatus.data || { state: 'ready' }, null, 2)}
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: INTERACTIVE API EXPLORER (ALL 91 ENDPOINTS) */}
          {activeTab === 'explorer' && (
            <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Terminal size={20} className="text-indigo-400" />
                    <span>Interactive Super Admin API Explorer</span>
                  </h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Execute, test, and inspect real-time responses from all 91 Super Admin endpoints directly against the live backend.
                  </p>
                </div>
                <div className="text-xs font-mono text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                  Target: {getSuperAdminBaseUrl()}
                </div>
              </div>

              {/* Endpoint Picker Toolbar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-[#121824] border border-slate-800 rounded-xl">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    API Section
                  </label>
                  <select
                    value={apiFilterSection}
                    onChange={(e) => setApiFilterSection(e.target.value)}
                    className="w-full bg-[#0b0f17] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">All 10 Sections (91 Endpoints)</option>
                    {SUPER_ADMIN_API_SECTIONS.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.label} ({sec.endpoints.length})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Search or Choose Endpoint
                  </label>
                  <select
                    value={selectedApiId}
                    onChange={(e) => {
                      setSelectedApiId(e.target.value);
                      setApiExecution({ loading: false, response: null, error: null, timeMs: 0 });
                    }}
                    className="w-full bg-[#0b0f17] border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  >
                    {filteredCatalog.map((ep) => (
                      <option key={ep.id} value={ep.id}>
                        [{ep.method}] {ep.path} — {ep.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Selected Endpoint Execution Card */}
              {currentOp && (
                <div className="p-5 bg-[#121824] border border-slate-800 rounded-xl space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                          currentOp.method === 'GET'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : currentOp.method === 'POST'
                            ? 'bg-indigo-500/20 text-indigo-400'
                            : currentOp.method === 'PUT'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {currentOp.method}
                      </span>
                      <span className="font-mono text-sm text-white font-semibold">{currentOp.path}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{currentOp.label}</span>
                      {currentOp.auth ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                          Bearer Auth
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                          Public
                        </span>
                      )}
                    </div>
                  </div>

                  <form onSubmit={handleRunApiExplorer} className="space-y-4">
                    {/* Dynamic Path Parameters */}
                    {pathPlaceholders.length > 0 && (
                      <div className="space-y-2 p-3 bg-[#0b0f17] rounded-lg border border-slate-800">
                        <span className="text-xs font-semibold text-slate-300 block">Path Parameters:</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {pathPlaceholders.map((param) => (
                            <div key={param}>
                              <label className="text-[10px] font-mono text-slate-400 block mb-1">
                                {`{${param}}`} *
                              </label>
                              <input
                                type="text"
                                required
                                value={apiPathParams[param] || ''}
                                onChange={(e) =>
                                  setApiPathParams((p) => ({ ...p, [param]: e.target.value }))
                                }
                                placeholder={`Enter ${param}`}
                                className="w-full bg-[#121824] border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Request Body Editor for POST / PUT */}
                    {['POST', 'PUT', 'PATCH'].includes(currentOp.method) && !currentOp.fileUpload && (
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-300 block">
                          Request Body (JSON):
                        </label>
                        <textarea
                          rows={4}
                          value={apiRequestBody}
                          onChange={(e) => setApiRequestBody(e.target.value)}
                          className="w-full bg-[#0b0f17] border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                          placeholder='{"key": "value"}'
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-slate-500 font-mono">
                        {currentOp.destructive && (
                          <span className="text-rose-400 font-semibold flex items-center gap-1">
                            <AlertTriangle size={13} />
                            Destructive Action
                          </span>
                        )}
                      </span>

                      <button
                        type="submit"
                        disabled={apiExecution.loading}
                        className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                      >
                        {apiExecution.loading ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Play size={14} />
                        )}
                        <span>Execute API Request</span>
                      </button>
                    </div>
                  </form>

                  {/* Response Section */}
                  {(apiExecution.response || apiExecution.error) && (
                    <div className="pt-4 border-t border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">Response</span>
                          {apiExecution.response && (
                            <span
                              className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                                apiExecution.response.status >= 200 && apiExecution.response.status < 300
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-rose-500/20 text-rose-400'
                              }`}
                            >
                              HTTP {apiExecution.response.status}
                            </span>
                          )}
                          <span className="text-slate-400 font-mono text-[11px]">
                            {apiExecution.timeMs}ms
                          </span>
                        </div>

                        {apiExecution.response && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(apiExecution.response.data, 'api-res')}
                            className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                          >
                            {copiedKey === 'api-res' ? (
                              <Check size={12} className="text-emerald-400" />
                            ) : (
                              <Copy size={12} />
                            )}
                            <span>{copiedKey === 'api-res' ? 'Copied' : 'Copy Data'}</span>
                          </button>
                        )}
                      </div>

                      {apiExecution.error && (
                        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                          {apiExecution.error}
                        </div>
                      )}

                      {apiExecution.response && (
                        <pre className="p-4 bg-[#0b0f17] border border-slate-800 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto max-h-96">
                          {typeof apiExecution.response.data === 'object'
                            ? JSON.stringify(apiExecution.response.data, null, 2)
                            : String(apiExecution.response.data)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* MODAL: REVEAL / RESET MANAGER CREDENTIALS */}
      {managerCredsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-[#121824] border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <Key size={16} className="text-amber-400" />
                <span>Broker Manager Credentials</span>
              </div>
              <button
                type="button"
                onClick={() => setManagerCredsModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 bg-[#0b0f17] rounded border border-slate-800">
                <span className="text-[10px] uppercase text-slate-500 block mb-1">Broker ID</span>
                <span className="text-white font-semibold">{managerCredsModal.brokerId}</span>
              </div>

              <div className="p-3 bg-[#0b0f17] rounded border border-slate-800">
                <span className="text-[10px] uppercase text-slate-500 block mb-1">Manager Login ID</span>
                <span className="text-indigo-400 font-bold text-sm">
                  {managerCredsModal.creds?.manager_login || managerCredsModal.creds?.login || '10001'}
                </span>
              </div>

              <div className="p-3 bg-[#0b0f17] rounded border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase text-slate-500 block mb-1">Manager Password</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    {showPassword ? (managerCredsModal.creds?.manager_password || managerCredsModal.creds?.password || '••••••••') : '••••••••••••'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-400 hover:text-white"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => handleBrokerAction(managerCredsModal.brokerId, 'reset-manager-password')}
                className="text-xs text-rose-400 hover:underline"
              >
                Reset Manager Password
              </button>
              <button
                type="button"
                onClick={() => setManagerCredsModal(null)}
                className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BROKER DETAILS DRAWER */}
      {brokerDetailsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#121824] border border-slate-800 rounded-xl p-6 max-w-2xl w-full space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <Building2 size={18} className="text-indigo-400" />
                <span>Broker Details: {brokerDetailsModal.broker_id || brokerDetailsModal.id}</span>
              </div>
              <button
                type="button"
                onClick={() => setBrokerDetailsModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 font-mono text-xs">
              <pre className="p-4 bg-[#0b0f17] rounded-lg border border-slate-800 text-slate-300 overflow-x-auto">
                {JSON.stringify(brokerDetailsModal, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER NEW BROKER */}
      {createBrokerModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#121824] border border-slate-800 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <Plus size={18} className="text-indigo-400" />
                <span>Register New Broker (POST /api/v1/admin/brokers)</span>
              </div>
              <button
                type="button"
                onClick={() => setCreateBrokerModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const payload = {
                  broker_id: formData.get('broker_id'),
                  name: formData.get('name'),
                  company_name: formData.get('company_name'),
                  admin_email: formData.get('admin_email'),
                  plan: formData.get('plan') || 'standard',
                };
                try {
                  const res = await executeSuperAdminOperation('brokers.create', { body: payload });
                  alert(`Broker registered successfully!\nLicense Key: ${res.data?.license_key || 'Generated'}`);
                  setCreateBrokerModalOpen(false);
                  loadBrokers();
                } catch (err) {
                  alert(`Registration failed: ${err.message}`);
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Broker Identifier (broker_id) *</label>
                <input
                  name="broker_id"
                  required
                  placeholder="e.g. gta_broker or my_broker"
                  className="w-full bg-[#0b0f17] border border-slate-700 rounded px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">Display Name *</label>
                <input
                  name="name"
                  required
                  placeholder="e.g. GTA Global Markets"
                  className="w-full bg-[#0b0f17] border border-slate-700 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">Company Legal Name</label>
                <input
                  name="company_name"
                  placeholder="e.g. GTA Markets LLC"
                  className="w-full bg-[#0b0f17] border border-slate-700 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">Admin Email</label>
                <input
                  name="admin_email"
                  type="email"
                  placeholder="admin@broker.com"
                  className="w-full bg-[#0b0f17] border border-slate-700 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-300 block mb-1">License Plan</label>
                <select
                  name="plan"
                  className="w-full bg-[#0b0f17] border border-slate-700 rounded px-3 py-2 text-white font-mono"
                >
                  <option value="standard">Standard</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="pro">Professional</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateBrokerModalOpen(false)}
                  className="px-4 py-2 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  Create Broker & Generate Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminConsole;
