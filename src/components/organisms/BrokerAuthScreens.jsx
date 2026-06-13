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
  getRuntimeLockedBroker(list) ||
  list[0];

const hasRuntimeBrokerConstraint = () =>
  Boolean(String(RUNTIME_BROKER_ID || '').trim() || comparableHost(RUNTIME_DEFAULT_MT5_SERVER));

const isRuntimeLockedBroker = (broker) =>
  Boolean(broker && hasRuntimeBrokerConstraint() && brokerMatchesRuntime(broker));

const getRuntimeLockedBroker = (list = []) => {
  if (!hasRuntimeBrokerConstraint()) return null;
  return list.find(brokerMatchesRuntime) || null;
};

const RTX5_LOGO_SRC = `${import.meta.env.BASE_URL || './'}logo-full-light.avif`;

// ---------------------------------------------------------------------------
// Shell & shared UI primitives
// ---------------------------------------------------------------------------
const AuthLogo = () => (
  <img
    src={RTX5_LOGO_SRC}
    alt="RTX5"
    className="mx-auto h-auto w-[150px] sm:w-[158px]"
    draggable="false"
  />
);

const AuthShell = ({ children }) => (
  <div
    className="fixed inset-0 z-[9999] grid h-[100dvh] min-h-0 overflow-hidden bg-white font-sans text-[#111827] lg:grid-cols-[60%_40%]"
    style={{ fontFamily: 'var(--font-auth)' }}
  >
    <div className="relative hidden min-h-0 overflow-hidden bg-[#060b18] lg:block">
      <img
        src={authTradingVisual}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.05),rgba(2,6,23,0.04)_58%,rgba(2,6,23,0.22))]" />
    </div>

    <div className="h-full min-h-0 overflow-hidden bg-white">
      <div className="mx-auto flex h-full min-h-0 w-full items-center justify-center px-6 py-6 sm:px-8 sm:py-8">
        <div className="w-full max-w-[420px]">
          {children}
        </div>
      </div>
    </div>
  </div>
);

const Header = ({ title, subtitle }) => (
  <div className="mb-8 text-center">
    <AuthLogo />
    <div className="mt-7">
      <h1 className="text-[28px] font-bold leading-tight text-[#0f172a]">{title}</h1>
      {subtitle && (
        <p className="mt-2 text-[15px] font-medium leading-6 text-[#6b7280]">
          {subtitle}
        </p>
      )}
    </div>
  </div>
);

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
        className="inline-flex shrink-0 items-center justify-center overflow-hidden border border-[#dcf7f0] bg-[#effdf9]"
        style={{ width: size, height: size, borderRadius: 8 }}
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
      className="inline-flex shrink-0 items-center justify-center border border-[#c9f2e8] bg-[#e9fbf7] text-[#21bfa4]"
      style={{ width: size, height: size, borderRadius: 8 }}
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
        className="relative flex min-h-[56px] w-full min-w-0 cursor-pointer items-center gap-3 rounded-[8px] border border-[#dce3ec] bg-white px-4 py-2.5 pr-11 text-left text-[#111827] outline-none transition-colors focus:border-[#2563eb] focus:ring-2 focus:ring-[#dbeafe] disabled:cursor-not-allowed disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <BrokerLogo broker={selectedBroker} size={34} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold leading-5">
            {selectedBroker?.name || 'Select broker'}
          </span>
        </span>
        <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6b7280]" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-labelledby="broker-select"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-64 overflow-y-auto rounded-[8px] border border-[#e1e5ea] bg-white py-1 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.7)]"
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
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[#f8fafc]"
                style={{ background: selected ? '#f8fafc' : undefined }}
              >
                <BrokerLogo broker={broker} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-[#111827]">{broker.name}</span>
                </span>
                {selected && <Check size={15} className="text-[#2563eb]" aria-hidden="true" />}
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
const LockedBrokerDisplay = ({ broker }) => (
  <div
    id="broker-select"
    className="flex min-h-[56px] w-full min-w-0 items-center gap-3 rounded-[8px] border border-[#dce3ec] bg-[#f8fafc] px-4 py-2.5 text-left text-[#111827]"
    aria-label={`Locked broker: ${broker?.name || 'Selected broker'}`}
  >
    <BrokerLogo broker={broker} size={34} />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[15px] font-semibold leading-5">
        {broker?.name || 'Selected broker'}
      </span>
    </span>
  </div>
);

export const BrokerSelector = ({ navigate }) => {
  const [brokerList, setBrokerList] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState('');
  const [listError, setListError] = React.useState('');
  const [listLoading, setListLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [loadingRole, setLoadingRole] = React.useState('');
  const [manualEntry, setManualEntry] = React.useState(false);
  const runtimeLockedBroker = React.useMemo(() => getRuntimeLockedBroker(brokerList), [brokerList]);

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
    if (!runtimeLockedBroker && !selectedId) {
      setError('Please select a broker.');
      return;
    }

    setLoadingRole(role);
    setError('');

    try {
      const brokerInfo = runtimeLockedBroker || discoverBrokerById(brokerList, selectedId);
      setBrokerInfo(brokerInfo);
      rememberBroker(brokerInfo.broker_id);
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
              {runtimeLockedBroker ? (
                <LockedBrokerDisplay broker={runtimeLockedBroker} />
              ) : (
                <BrokerDropdown
                  brokers={brokerList}
                  selectedId={selectedId}
                  disabled={!!loadingRole}
                  onChange={(brokerId) => { setSelectedId(brokerId); setError(''); }}
                />
              )}
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
              {!runtimeLockedBroker && (
                <button
                  type="button"
                  onClick={() => setManualEntry(true)}
                  className="text-[12px] text-[color:var(--accent-500)] hover:text-[color:var(--accent-700)]"
                >
                  + Register new broker
                </button>
              )}
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
  const brokerLocked = React.useMemo(() => isRuntimeLockedBroker(brokerInfo), [brokerInfo]);

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
      brokerLocked={brokerLocked}
      onSwitchBroker={() => {
        if (brokerLocked) return;
        clearBrokerInfo();
        navigate('/', { replace: true });
      }}
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
  const runtimeBrokerConstrained = hasRuntimeBrokerConstraint();
  const initialBrokerLocked = React.useMemo(() => isRuntimeLockedBroker(initialBrokerInfo), [initialBrokerInfo]);
  const [brokerList, setBrokerList] = React.useState(() => (initialBrokerInfo ? [initialBrokerInfo] : []));
  const [selectedId, setSelectedId] = React.useState(() => initialBrokerInfo?.broker_id || '');
  const [selectedBroker, setSelectedBroker] = React.useState(() => initialBrokerInfo);
  const [listError, setListError] = React.useState('');
  const [listLoading, setListLoading] = React.useState(!initialBrokerInfo || (runtimeBrokerConstrained && !initialBrokerLocked));
  const [user, setUser] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [server, setServer] = React.useState(() => getBrokerDisplayServer(initialBrokerInfo || {}));
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const runtimeLockedBroker = React.useMemo(() => getRuntimeLockedBroker(brokerList), [brokerList]);

  React.useEffect(() => {
    let cancelled = false;

    setListLoading(true);
    setListError('');

    fetchBrokerList()
      .then((list) => {
        if (cancelled) return;

        setBrokerList(list);

        const lockedBroker = getRuntimeLockedBroker(list);
        const preferredBroker =
          lockedBroker ||
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

        if (initialBrokerInfo && (!runtimeBrokerConstrained || initialBrokerLocked)) {
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
  }, [initialBrokerInfo, initialBrokerLocked, runtimeBrokerConstrained]);

  const retryLoad = () => {
    setListLoading(true);
    setListError('');

    fetchBrokerList()
      .then((list) => {
        setBrokerList(list);

        const preferredBroker = getRuntimeLockedBroker(list) || getDefaultBroker(list);
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
    if (runtimeLockedBroker) {
      setSelectedId(runtimeLockedBroker.broker_id);
      setSelectedBroker(runtimeLockedBroker);
      setServer(getBrokerDisplayServer(runtimeLockedBroker));
      setBrokerInfo(runtimeLockedBroker);
      rememberBroker(runtimeLockedBroker.broker_id);
      setError('');
      return;
    }

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
    if (runtimeLockedBroker) return;

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
      brokerInfo = runtimeLockedBroker || selectedBroker || discoverBrokerById(brokerList, selectedId);
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
      submitDisabled={listLoading || !!listError || brokerList.length === 0 || (!runtimeLockedBroker && !selectedId)}
      onSubmit={handleSubmit}
      onSwitchBroker={handleSwitchBroker}
      brokerLocked={!!runtimeLockedBroker}
      onRegisterBroker={runtimeLockedBroker ? undefined : () => navigate('/broker-manual-entry')}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="broker-select" className="text-[13px] font-semibold leading-5 text-[#334155]">
          Broker
        </label>
        {listLoading && (
          <div className="flex h-[56px] items-center gap-2 rounded-[8px] border border-[#dce3ec] bg-white px-4 text-[14px] text-[#6b7280]">
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
          runtimeLockedBroker ? (
            <LockedBrokerDisplay broker={runtimeLockedBroker} />
          ) : (
            <BrokerDropdown
              brokers={brokerList}
              selectedId={selectedId}
              disabled={loading}
              onChange={handleBrokerChange}
            />
          )
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
const getLoginSubtitle = (tone, fallback) => {
  if (tone === 'admin') return 'Sign in to access your admin dashboard';
  if (tone === 'manager') return 'Sign in to access your manager dashboard';
  return fallback;
};

const LoginScreen = ({
  subtitle,
  tone,
  error,
  loading,
  submitDisabled = false,
  onSubmit,
  onSwitchBroker,
  brokerLocked = false,
  onRegisterBroker,
  switchToLabel,
  onSwitchRole,
  children,
}) => {
  const supportSubtitle = getLoginSubtitle(tone, subtitle);
  const showFooterActions =
    (!brokerLocked && Boolean(onSwitchBroker || onRegisterBroker)) ||
    Boolean(switchToLabel && onSwitchRole);

  return (
    <AuthShell>
      <Header title="Welcome Back!" subtitle={supportSubtitle} />
      <div>
        <InlineError>{error}</InlineError>
        <form onSubmit={onSubmit} className="flex flex-col gap-[18px]">
          {children}
          <div className="flex items-center justify-between gap-4 pt-0.5">
            <div className="flex items-center gap-2.5 text-[13px] font-semibold text-[#374151]">
              <span className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] bg-[#2563eb] text-white" aria-hidden="true">
                <Check size={13} strokeWidth={3} />
              </span>
              <span>Remember me</span>
            </div>
            <span className="shrink-0 text-[13px] font-semibold text-[#2563eb]">
              Forgot password?
            </span>
          </div>
          <button
            type="submit"
            disabled={loading || submitDisabled}
            className="relative mt-1 inline-flex h-[56px] items-center justify-center rounded-[7px] bg-[#0b5cff] px-5 text-[16px] font-bold text-white transition-colors hover:bg-[#0050e6] focus:outline-none focus:ring-2 focus:ring-[#bfdbfe] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-[#0b5cff]"
          >
            {loading ? <SpinnerLabel>Signing in</SpinnerLabel> : 'Sign in'}
            {!loading && <ArrowRight size={23} className="absolute right-5 top-1/2 -translate-y-1/2" aria-hidden="true" />}
          </button>
        </form>

        {showFooterActions && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0f4] pt-6">
            {!brokerLocked && onSwitchBroker && (
              <button type="button" onClick={onSwitchBroker} className="text-[13px] font-semibold text-[#2563eb] hover:text-[#1d4ed8]">
                &larr; Switch broker
              </button>
            )}
            {!brokerLocked && onRegisterBroker && (
              <button
                type="button"
                onClick={onRegisterBroker}
                className="text-[13px] font-semibold text-[#2563eb] hover:text-[#1d4ed8]"
              >
                + Register new broker
              </button>
            )}
            {switchToLabel && onSwitchRole && (
              <button
                type="button"
                onClick={onSwitchRole}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#2563eb] hover:text-[#1d4ed8]"
              >
                {switchToLabel} <ArrowRight size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </AuthShell>
  );
};

// ---------------------------------------------------------------------------
// Shared form field components
// ---------------------------------------------------------------------------
const Field = ({ id, label, icon: Icon, value, onChange, type = 'text', readOnly = false, required = false, placeholder = '' }) => {
  const resolvedPlaceholder = placeholder || (label === 'Login' ? 'Enter your login' : '');

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-semibold leading-5 text-[#334155]">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#6b7280]">
          {React.createElement(Icon, { size: 21, strokeWidth: 1.9, 'aria-hidden': 'true' })}
        </span>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          readOnly={readOnly}
          required={required}
          placeholder={resolvedPlaceholder}
          className="h-[56px] w-full rounded-[8px] border border-[#dce3ec] bg-white pl-[54px] pr-4 text-[14px] font-medium text-[#111827] outline-none transition-colors placeholder:text-[#b8c0cc] focus:border-[#2563eb] focus:ring-2 focus:ring-[#dbeafe] read-only:bg-white"
        />
      </div>
    </div>
  );
};

const PasswordField = ({ id, value, onChange }) => {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-semibold leading-5 text-[#334155]">
        Password
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#6b7280]">
          <Lock size={21} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          placeholder="Enter your password"
          className="h-[56px] w-full rounded-[8px] border border-[#dce3ec] bg-white pl-[54px] pr-[54px] text-[14px] font-medium text-[#111827] outline-none transition-colors placeholder:text-[#b8c0cc] focus:border-[#2563eb] focus:ring-2 focus:ring-[#dbeafe]"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#6b7280] hover:text-[#111827]"
          tabIndex={-1}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff size={20} strokeWidth={1.9} aria-hidden="true" /> : <Eye size={20} strokeWidth={1.9} aria-hidden="true" />}
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
