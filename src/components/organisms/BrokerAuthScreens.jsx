import React from 'react';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  RefreshCw,
  Server,
  ShieldCheck,
  User,
} from 'lucide-react';
import authTradingVisual from '../../assets/auth-trading-visual.png';
import {
  clearBrokerInfo,
  discoverBrokerById,
  fetchBrokerList,
  getBrokerDisplayServer,
  getBrokerLoginServer,
  getBrokerInfo,
  loginAdmin,
  loginManager,
  rememberBroker,
  requireAdminAuthSessionToken,
  setAuthSession,
  setBrokerInfo,
  validateBrokerCredentials,
  RUNTIME_BROKER_ID,
  RUNTIME_DEFAULT_MT5_SERVER,
} from '../../services/brokerAuth';

const comparableHost = (value = '') => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  try {
    return new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`).hostname.toLowerCase();
  } catch {
    return trimmed
      .replace(/^[a-z][a-z\d+.-]*:\/\//i, '')
      .split('/')[0]
      .split(':')[0]
      .toLowerCase();
  }
};

const brokerMatchesRuntime = (broker) => {
  const runtimeBrokerId = String(RUNTIME_BROKER_ID || '').trim().toLowerCase();
  if (
    runtimeBrokerId &&
    [broker.broker_id, broker.id].some((value) => String(value || '').trim().toLowerCase() === runtimeBrokerId)
  ) {
    return true;
  }

  const runtimeServer = comparableHost(RUNTIME_DEFAULT_MT5_SERVER);
  if (!runtimeServer) return false;

  return [
    broker.server_ip,
    broker.host,
    broker.server,
    broker.server_url,
    broker.backend_url,
    broker.api_url,
  ].some((value) => comparableHost(value) === runtimeServer);
};

const getDefaultBroker = (list = []) =>
  list.find(brokerMatchesRuntime) ||
  list[0];

// ---------------------------------------------------------------------------
// Shell & shared UI primitives
// ---------------------------------------------------------------------------
const AuthShell = ({ children }) => (
  <div className="fixed inset-0 z-[9999] grid min-h-screen bg-[#f4f7fb] font-sans lg:grid-cols-[60%_40%]">
    <div className="relative hidden min-h-0 overflow-hidden bg-slate-950 lg:block">
      <img
        src={authTradingVisual}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.08),rgba(2,6,23,0.02)_48%,rgba(2,6,23,0.38))]" />
      <div className="absolute inset-y-0 right-0 w-28 bg-[linear-gradient(90deg,rgba(2,6,23,0),rgba(15,23,42,0.42))]" />
    </div>

    <div className="relative flex min-h-screen min-w-0 items-center justify-center overflow-hidden bg-[#f7f9fc] px-4 py-8 sm:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(37,99,235,0.08),transparent_28%),linear-gradient(180deg,#ffffff_0%,#f6f8fb_100%)]" />
      <div className="relative w-full max-w-[472px] rounded-[8px] border border-[#dfe5ee] bg-white px-8 py-9 shadow-[0_28px_80px_-46px_rgba(15,23,42,0.55)] sm:px-9 sm:py-10">
        {children}
      </div>
    </div>
  </div>
);

const Header = ({ icon, title, subtitle, tone = 'manager', broker }) => {
  const Icon = icon;
  const isAdmin = tone === 'admin';

  return (
    <div className="pb-8">
      <div className="flex items-center gap-4">
        <div
          className={
            isAdmin
              ? 'h-12 w-12 rounded-[8px] flex items-center justify-center bg-[#f7fbff] text-blue-700 border border-[#d8e2ef] shadow-[0_8px_18px_-14px_rgba(15,23,42,0.65)]'
              : 'h-12 w-12 rounded-[8px] flex items-center justify-center bg-[color:var(--accent-50)] text-[color:var(--accent-500)] border border-[color:var(--accent-100)] shadow-[0_8px_18px_-14px_rgba(15,23,42,0.65)]'
          }
        >
          {broker ? <BrokerLogo broker={broker} size={44} fallback={Icon} /> : <Icon size={26} aria-hidden="true" />}
        </div>
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold leading-6 text-[color:var(--text-primary)] truncate">{title}</h1>
          <p className="mt-0.5 text-[14px] leading-5 text-[color:var(--text-muted)]">{subtitle}</p>
        </div>
      </div>
    </div>
  );
};

const InlineError = ({ children }) => {
  if (!children) return null;
  return (
    <div
      className="flex items-start gap-2 px-3 py-2 text-[12px] rounded-[4px] border border-red-200 bg-red-50 text-red-700"
      role="alert"
    >
      <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
};

const SpinnerLabel = ({ children }) => (
  <>
    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
    {children}
  </>
);

const BrokerLogo = ({ broker, size = 32, fallback = Building2 }) => {
  const [failed, setFailed] = React.useState(false);
  const src = broker?.logo_url;

  if (src && !failed) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center overflow-hidden bg-[color:var(--bg-app)] border border-[color:var(--border-default)]"
        style={{ width: size, height: size, borderRadius: 4 }}
      >
        <img
          src={src}
          alt=""
          className="h-full w-full object-contain p-1"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center bg-[color:var(--accent-50)] text-[color:var(--accent-500)] border border-[color:var(--accent-100)]"
      style={{ width: size, height: size, borderRadius: 4 }}
    >
      {React.createElement(fallback, {
        size: Math.max(14, Math.round(size * 0.45)),
        'aria-hidden': 'true',
      })}
    </span>
  );
};

const BrokerDropdown = ({ brokers, selectedId, disabled, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef(null);
  const selectedBroker = brokers.find((broker) => broker.broker_id === selectedId);

  React.useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        id="broker-select"
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="w-full min-h-11 min-w-0 bg-white border border-[#d5dbe5] text-[color:var(--text-primary)] px-3 pr-9 py-2 outline-none focus:border-[color:var(--accent-500)] focus:ring-2 focus:ring-blue-100 rounded-[6px] disabled:opacity-50 cursor-pointer flex items-center gap-3 text-left shadow-[0_1px_0_rgba(15,23,42,0.03)]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <BrokerLogo broker={selectedBroker} size={30} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold leading-5">
            {selectedBroker?.name || 'Select broker'}
          </span>
        </span>
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-labelledby="broker-select"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-64 overflow-y-auto rounded-[6px] border border-[color:var(--border-default)] bg-[color:var(--bg-surface-1)] shadow-lg"
        >
          {brokers.map((broker) => {
            const selected = broker.broker_id === selectedId;
            return (
              <button
                key={broker.broker_id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(broker.broker_id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-[color:var(--bg-surface-2)]"
                style={{ background: selected ? 'var(--bg-surface-2)' : undefined }}
              >
                <BrokerLogo broker={broker} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-[color:var(--text-primary)]">{broker.name}</span>
                </span>
                {selected && <Check size={13} className="text-[color:var(--accent-500)]" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// BrokerSelector — fetches broker list from API, shows dropdown
// ---------------------------------------------------------------------------
export const BrokerSelector = ({ navigate }) => {
  const [brokerList, setBrokerList] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState('');
  const [listError, setListError] = React.useState('');
  const [listLoading, setListLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [loadingRole, setLoadingRole] = React.useState('');
  const [manualEntry, setManualEntry] = React.useState(false);

  // Load broker list on mount
  React.useEffect(() => {
    let cancelled = false;

    fetchBrokerList()
      .then((list) => {
        if (cancelled) return;
        setBrokerList(list);
        if (list.length > 0) {
          setSelectedId(getDefaultBroker(list)?.broker_id || list[0].broker_id);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setListError(err.message || 'Failed to load brokers.');
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const retryLoad = () => {
    setListLoading(true);
    setListError('');
    fetchBrokerList()
      .then((list) => {
        setBrokerList(list);
        if (list.length > 0) {
          setSelectedId(getDefaultBroker(list)?.broker_id || list[0].broker_id);
        }
      })
      .catch((err) => setListError(err.message || 'Failed to load brokers.'))
      .finally(() => setListLoading(false));
  };

  const submit = async (role) => {
    if (!selectedId) {
      setError('Please select a broker.');
      return;
    }

    setLoadingRole(role);
    setError('');

    try {
      const brokerInfo = discoverBrokerById(brokerList, selectedId);
      setBrokerInfo(brokerInfo);
      rememberBroker(selectedId);
      navigate(role === 'admin' ? '/admin-login' : '/manager-login');
    } catch (err) {
      setError(err.message || 'Connection failed');
    } finally {
      setLoadingRole('');
    }
  };

  if (manualEntry) {
    return (
      <AuthShell>
        <Header icon={Building2} title="RTX 5 Admin Terminal" subtitle="Register broker" />
        <div className="p-5">
          <InlineError>{error}</InlineError>

          <form
            className="mt-2 flex flex-col gap-4"
            onSubmit={(e) => { e.preventDefault(); navigate('/broker-manual-entry'); }}
          >
            <p className="text-[12px] text-[color:var(--text-muted)] mb-2">
              Enter broker credentials received from your broker provider.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="submit"
                className="h-8 inline-flex items-center justify-center gap-2 bg-[color:var(--accent-500)] text-[color:var(--accent-contrast)] text-[12px] font-medium rounded-[3px]"
              >
                <ArrowRight size={13} /> Enter Credentials
              </button>
              <button
                type="button"
                onClick={() => setManualEntry(false)}
                className="h-8 inline-flex items-center justify-center gap-2 bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] text-[color:var(--text-primary)] text-[12px] font-medium rounded-[3px]"
              >
                &larr; Back
              </button>
            </div>
          </form>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Header icon={Building2} title="RTX 5 Admin Terminal" subtitle="Select broker" />
      <div className="p-5">
        <InlineError>{error}</InlineError>

        {/* Broker list loading state */}
        {listLoading && (
          <div className="flex items-center gap-2 py-3 text-[12px] text-[color:var(--text-muted)]">
            <Loader2 size={13} className="animate-spin" />
            Loading brokers…
          </div>
        )}

        {/* Broker list error */}
        {!listLoading && listError && (
          <div className="py-2">
            <div className="flex items-start gap-2 px-3 py-2 text-[12px] rounded-[4px] border border-red-200 bg-red-50 text-red-700 mb-2" role="alert">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{listError}</span>
            </div>
            <button
              type="button"
              onClick={retryLoad}
              className="flex items-center gap-1.5 text-[11px] text-[color:var(--accent-500)] hover:text-[color:var(--accent-700)]"
            >
              <RefreshCw size={11} /> Retry
            </button>
          </div>
        )}

        {/* Dropdown form */}
        {!listLoading && !listError && (
          <form
            className="mt-2 flex flex-col gap-4"
            onSubmit={(e) => { e.preventDefault(); submit('admin'); }}
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="broker-select" className="text-[11px] text-[color:var(--text-muted)]">
                Broker
              </label>
              <BrokerDropdown
                brokers={brokerList}
                selectedId={selectedId}
                disabled={!!loadingRole}
                onChange={(brokerId) => { setSelectedId(brokerId); setError(''); }}
              />
              <div className="hidden" aria-hidden="true">
                <select
                  id="broker-select-native"
                  value={selectedId}
                  onChange={(e) => { setSelectedId(e.target.value); setError(''); }}
                  disabled={!!loadingRole}
                  className="w-full h-8 appearance-none bg-[color:var(--bg-app)] border border-[color:var(--border-default)] text-[color:var(--text-primary)] text-[12px] px-2 pr-7 outline-none focus:border-[color:var(--accent-500)] rounded-[3px] disabled:opacity-50 cursor-pointer"
                >
                  {brokerList.map((broker) => (
                    <option key={broker.broker_id} value={broker.broker_id}>
                      {broker.name} ({broker.broker_id})
                    </option>
                  ))}
                </select>
                <span className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-[color:var(--text-muted)]">
                  <ChevronDown size={13} />
                </span>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={!!loadingRole || brokerList.length === 0}
                className="h-8 w-full inline-flex items-center justify-center gap-2 bg-[color:var(--accent-500)] text-[color:var(--accent-contrast)] text-[12px] font-medium rounded-[3px] disabled:opacity-50"
              >
                {loadingRole === 'admin' ? <SpinnerLabel>Checking</SpinnerLabel> : 'Continue as Admin'}
              </button>
            </div>

            <div className="pt-3 border-t border-[color:var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setManualEntry(true)}
                className="text-[12px] text-[color:var(--accent-500)] hover:text-[color:var(--accent-700)]"
              >
                + Register new broker
              </button>
            </div>
          </form>
        )}
      </div>
    </AuthShell>
  );
};

// ---------------------------------------------------------------------------
// ManagerLogin
// ---------------------------------------------------------------------------
export const ManagerLogin = ({ navigate, onLoginSuccess }) => {
  const [brokerInfo] = React.useState(() => getBrokerInfo());
  const [user, setUser] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [server, setServer] = React.useState(() => getBrokerDisplayServer(getBrokerInfo() || {}));
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!brokerInfo) {
      navigate('/', { replace: true });
    }
  }, [brokerInfo, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const loginServer = getBrokerLoginServer(brokerInfo || {});
    if (!user || !password || !loginServer) {
      setError('Login, password, and broker server are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const auth = await loginManager(brokerInfo, { user, password, server: loginServer });
      const session = setAuthSession(auth, brokerInfo);
      onLoginSuccess(session, '/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!brokerInfo) return null;

  return (
    <LoginScreen
      brokerInfo={brokerInfo}
      subtitle="Manager Login"
      tone="manager"
      error={error}
      loading={loading}
      onSubmit={handleSubmit}
      onSwitchBroker={() => { clearBrokerInfo(); navigate('/', { replace: true }); }}
      switchToLabel="Admin login"
      onSwitchRole={() => navigate('/admin-login')}
    >
      <Field id="manager-login" label="Login" type="number" icon={User} value={user} onChange={setUser} required />
      <PasswordField id="manager-password" value={password} onChange={setPassword} />
      <Field id="manager-server" label="Broker Server" icon={Server} value={server} onChange={setServer} readOnly required />
    </LoginScreen>
  );
};

// ---------------------------------------------------------------------------
// AdminLogin
// ---------------------------------------------------------------------------
export const AdminLogin = ({ navigate, onLoginSuccess }) => {
  const initialBrokerInfo = React.useMemo(() => getBrokerInfo(), []);
  const [brokerList, setBrokerList] = React.useState(() => (initialBrokerInfo ? [initialBrokerInfo] : []));
  const [selectedId, setSelectedId] = React.useState(() => initialBrokerInfo?.broker_id || '');
  const [selectedBroker, setSelectedBroker] = React.useState(() => initialBrokerInfo);
  const [listError, setListError] = React.useState('');
  const [listLoading, setListLoading] = React.useState(!initialBrokerInfo);
  const [user, setUser] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [server, setServer] = React.useState(() => getBrokerDisplayServer(initialBrokerInfo || {}));
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    setListLoading(true);
    setListError('');

    fetchBrokerList()
      .then((list) => {
        if (cancelled) return;

        setBrokerList(list);

        const preferredBroker =
          (initialBrokerInfo?.broker_id && list.find((broker) => broker.broker_id === initialBrokerInfo.broker_id)) ||
          getDefaultBroker(list);

        if (preferredBroker) {
          setSelectedId(preferredBroker.broker_id);
          setSelectedBroker(preferredBroker);
          setServer(getBrokerDisplayServer(preferredBroker));
        }
      })
      .catch((err) => {
        if (cancelled) return;

        if (initialBrokerInfo) {
          setBrokerList([initialBrokerInfo]);
          setSelectedId(initialBrokerInfo.broker_id);
          setSelectedBroker(initialBrokerInfo);
          setServer(getBrokerDisplayServer(initialBrokerInfo));
          return;
        }

        setListError(err.message || 'Failed to load brokers.');
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });

    return () => { cancelled = true; };
  }, [initialBrokerInfo]);

  const retryLoad = () => {
    setListLoading(true);
    setListError('');

    fetchBrokerList()
      .then((list) => {
        setBrokerList(list);

        const preferredBroker = getDefaultBroker(list);
        if (preferredBroker) {
          setSelectedId(preferredBroker.broker_id);
          setSelectedBroker(preferredBroker);
          setServer(getBrokerDisplayServer(preferredBroker));
        }
      })
      .catch((err) => setListError(err.message || 'Failed to load brokers.'))
      .finally(() => setListLoading(false));
  };

  const handleBrokerChange = (brokerId) => {
    try {
      const nextBroker = discoverBrokerById(brokerList, brokerId);
      setSelectedId(nextBroker.broker_id);
      setSelectedBroker(nextBroker);
      setServer(getBrokerDisplayServer(nextBroker));
      setBrokerInfo(nextBroker);
      rememberBroker(nextBroker.broker_id);
      setError('');
    } catch (err) {
      setError(err.message || 'Broker not found');
    }
  };

  const handleSwitchBroker = () => {
    clearBrokerInfo();
    setSelectedId('');
    setSelectedBroker(null);
    setServer('');
    setError('');
    navigate('/', { replace: true });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedId) {
      setError('Please select a broker.');
      return;
    }

    let brokerInfo;
    try {
      brokerInfo = selectedBroker || discoverBrokerById(brokerList, selectedId);
    } catch (err) {
      setError(err.message || 'Broker not found');
      return;
    }

    if (!brokerInfo) {
      setError('Please select a broker.');
      return;
    }
    if (!user || !password) {
      setError('Login and password are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setBrokerInfo(brokerInfo);
      rememberBroker(brokerInfo.broker_id);
      const auth = await loginAdmin(brokerInfo, { user, password });
      const session = setAuthSession(auth, brokerInfo);
      requireAdminAuthSessionToken(session);
      onLoginSuccess(session, '/admin-dashboard');
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginScreen
      brokerInfo={selectedBroker}
      subtitle="Admin Login"
      tone="admin"
      error={error}
      loading={loading}
      submitDisabled={listLoading || !!listError || brokerList.length === 0 || !selectedId}
      onSubmit={handleSubmit}
      onSwitchBroker={handleSwitchBroker}
      onRegisterBroker={() => navigate('/broker-manual-entry')}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="broker-select" className="text-[13px] font-medium leading-5 text-[color:var(--text-muted)]">
          Broker
        </label>
        {listLoading && (
          <div className="flex h-11 items-center gap-2 rounded-[6px] border border-[#d8dee8] bg-white px-3 text-[13px] text-[color:var(--text-muted)]">
            <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            Loading brokers...
          </div>
        )}
        {!listLoading && listError && (
          <div className="space-y-2">
            <InlineError>{listError}</InlineError>
            <button
              type="button"
              onClick={retryLoad}
              className="inline-flex items-center gap-1.5 text-[11px] text-[color:var(--accent-500)] hover:text-[color:var(--accent-700)]"
            >
              <RefreshCw size={11} aria-hidden="true" /> Retry
            </button>
          </div>
        )}
        {!listLoading && !listError && (
          <BrokerDropdown
            brokers={brokerList}
            selectedId={selectedId}
            disabled={loading}
            onChange={handleBrokerChange}
          />
        )}
      </div>
      <Field id="admin-login" label="Login" type="number" icon={User} value={user} onChange={setUser} required />
      <PasswordField id="admin-password" value={password} onChange={setPassword} />
      <Field id="admin-server" label="Broker Server" icon={Server} value={server} onChange={setServer} readOnly />
    </LoginScreen>
  );
};

// ---------------------------------------------------------------------------
// Shared LoginScreen layout
// ---------------------------------------------------------------------------
const LoginScreen = ({
  brokerInfo,
  subtitle,
  tone,
  error,
  loading,
  submitDisabled = false,
  onSubmit,
  onSwitchBroker,
  onRegisterBroker,
  switchToLabel,
  onSwitchRole,
  children,
}) => (
  <AuthShell>
    <Header
      icon={tone === 'admin' ? Building2 : Lock}
      title={brokerInfo?.name || brokerInfo?.broker_id || 'Alpha FX Markets'}
      subtitle={subtitle}
      tone={tone}
      broker={brokerInfo}
    />
    <div>
      <InlineError>{error}</InlineError>
      <form onSubmit={onSubmit} className="mt-1 flex flex-col gap-4">
        {children}
        <button
          type="submit"
          disabled={loading || submitDisabled}
          className="mt-3 h-11 inline-flex items-center justify-center gap-2 bg-[color:var(--accent-500)] text-[color:var(--accent-contrast)] text-[14px] font-semibold rounded-[6px] shadow-[0_14px_28px_-18px_rgba(37,99,235,0.95)] transition-colors hover:bg-[color:var(--accent-600)] focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50 disabled:hover:bg-[color:var(--accent-500)]"
        >
          {loading ? <SpinnerLabel>Signing in</SpinnerLabel> : 'Sign in'}
        </button>
      </form>

      <div className="mt-7 border-t border-[color:var(--border-subtle)] pt-5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onSwitchBroker} className="text-[13px] font-medium text-[color:var(--accent-500)] hover:text-[color:var(--accent-700)]">
          &larr; Switch broker
        </button>
        {onRegisterBroker && (
          <button
            type="button"
            onClick={onRegisterBroker}
            className="text-[13px] font-medium text-[color:var(--accent-500)] hover:text-[color:var(--accent-700)]"
          >
            + Register new broker
          </button>
        )}
        {switchToLabel && onSwitchRole && (
          <button
            type="button"
            onClick={onSwitchRole}
            className="inline-flex items-center gap-1 text-[12px] text-[color:var(--accent-500)] hover:text-[color:var(--accent-700)]"
          >
            {switchToLabel} <ArrowRight size={13} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  </AuthShell>
);

// ---------------------------------------------------------------------------
// Shared form field components
// ---------------------------------------------------------------------------
const Field = ({ id, label, icon: Icon, value, onChange, type = 'text', readOnly = false, required = false, placeholder = '' }) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className="text-[13px] font-medium leading-5 text-[color:var(--text-muted)]">
      {label}
    </label>
    <div className="relative">
      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[color:var(--text-muted)]">
        {React.createElement(Icon, { size: 18, 'aria-hidden': 'true' })}
      </span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        required={required}
        placeholder={placeholder}
        className="w-full h-11 bg-white border border-[#d5dbe5] text-[color:var(--text-primary)] text-[14px] pl-11 pr-3 outline-none focus:border-[color:var(--accent-500)] focus:ring-2 focus:ring-blue-100 rounded-[6px] placeholder:text-[color:var(--text-muted)] read-only:bg-[#f8fafc] shadow-[0_1px_0_rgba(15,23,42,0.03)]"
      />
    </div>
  </div>
);

const PasswordField = ({ id, value, onChange }) => {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium leading-5 text-[color:var(--text-muted)]">
        Password
      </label>
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[color:var(--text-muted)]">
          <Lock size={18} aria-hidden="true" />
        </span>
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          className="w-full h-11 bg-white border border-[#d5dbe5] text-[color:var(--text-primary)] text-[14px] pl-11 pr-11 outline-none focus:border-[color:var(--accent-500)] focus:ring-2 focus:ring-blue-100 rounded-[6px] shadow-[0_1px_0_rgba(15,23,42,0.03)]"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
          tabIndex={-1}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ManualBrokerEntry — Direct credential entry (License Key, Login, Password, Server)
// ---------------------------------------------------------------------------
export const ManualBrokerEntry = ({ navigate, onLoginSuccess }) => {
  const [licenseKey, setLicenseKey] = React.useState('');
  const [brokerId, setBrokerId] = React.useState('');
  const [user, setUser] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [server, setServer] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [step, setStep] = React.useState('credentials'); // credentials | confirm

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (step === 'credentials') {
      if (!brokerId || !user || !password || !server) {
        setError('All fields are required (License Key is optional).');
        return;
      }
      setLoading(true);
      setError('');

      try {
        // Validate and get broker info from server
        const brokerInfo = await validateBrokerCredentials({
          broker_id: brokerId,
          license_key: licenseKey,
          server,
        });

        // Store broker info
        setBrokerInfo(brokerInfo);
        rememberBroker(brokerId);

        // Move to confirm step
        setStep('confirm');
        setLoading(false);
      } catch (err) {
        setError(err.message || 'Broker validation failed.');
        setLoading(false);
      }
      return;
    }

    // Step 2: Login with confirmed credentials
    setLoading(true);
    setError('');

    try {
      const brokerInfo = getBrokerInfo();
      if (!brokerInfo) {
        throw new Error('Broker info not found. Please restart.');
      }
      const auth = await loginManager(brokerInfo, { user, password, server: getBrokerLoginServer(brokerInfo) });
      const session = setAuthSession(auth, brokerInfo);
      onLoginSuccess(session, '/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed.');
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'confirm') {
      setStep('credentials');
      setError('');
    } else {
      clearBrokerInfo();
      navigate('/', { replace: true });
    }
  };

  return (
    <AuthShell>
      <Header
        icon={Server}
        title="Register Broker"
        subtitle={step === 'credentials' ? 'Enter credentials' : 'Confirm details'}
        tone="manager"
      />
      <div className="p-5">
        <InlineError>{error}</InlineError>

        {step === 'credentials' ? (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            <Field
              id="broker-id"
              label="Broker ID"
              icon={Building2}
              value={brokerId}
              onChange={setBrokerId}
              required
            />
            <Field
              id="license-key"
              label="License Key (Optional)"
              icon={ShieldCheck}
              value={licenseKey}
              onChange={setLicenseKey}
            />
            <Field
              id="manager-login"
              label="Manager Login #"
              icon={User}
              value={user}
              onChange={setUser}
              required
            />
            <PasswordField id="manual-password" value={password} onChange={setPassword} />
            <Field
              id="broker-server"
              label="Server URL/IP"
              icon={Server}
              value={server}
              onChange={setServer}
              placeholder="e.g., https://broker.example.com"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="mt-2 h-8 inline-flex items-center justify-center gap-2 bg-[color:var(--accent-500)] text-[color:var(--accent-contrast)] text-[12px] font-medium rounded-[3px] disabled:opacity-50"
            >
              {loading ? <SpinnerLabel>Validating</SpinnerLabel> : 'Validate & Continue'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            <div className="p-3 bg-[color:var(--bg-surface-2)] border border-[color:var(--border-subtle)] rounded-[4px] text-[12px] space-y-2">
              <div>
                <span className="text-[color:var(--text-muted)]">Broker ID: </span>
                <span className="font-mono text-[color:var(--text-primary)]">{brokerId}</span>
              </div>
              <div>
                <span className="text-[color:var(--text-muted)]">Manager Login: </span>
                <span className="font-mono text-[color:var(--text-primary)]">{user}</span>
              </div>
              <div>
                <span className="text-[color:var(--text-muted)]">Server: </span>
                <span className="font-mono text-[color:var(--text-primary)]">{server}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 h-8 inline-flex items-center justify-center gap-2 bg-[color:var(--accent-500)] text-[color:var(--accent-contrast)] text-[12px] font-medium rounded-[3px] disabled:opacity-50"
            >
              {loading ? <SpinnerLabel>Signing in</SpinnerLabel> : 'Sign In'}
            </button>
          </form>
        )}

        <div className="mt-5 pt-4 border-t border-[color:var(--border-subtle)]">
          <button
            type="button"
            onClick={handleBack}
            className="text-[12px] text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
          >
            &larr; {step === 'credentials' ? 'Back to brokers' : 'Back to entry'}
          </button>
        </div>
      </div>
    </AuthShell>
  );
};
