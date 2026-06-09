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

const getBrokerSecondaryLabel = (broker) => {
  if (!broker) return 'No broker';

  const brokerId = String(broker.broker_id || '').trim();
  const server = String(broker.server || '').trim();
  const host = String(broker.server_ip || broker.host || '').trim();
  const detail = server && server !== brokerId ? server : host;

  return detail ? `${brokerId} / ${detail}` : brokerId || server || 'No broker';
};

// ---------------------------------------------------------------------------
// Shell & shared UI primitives
// ---------------------------------------------------------------------------
const AuthShell = ({ children }) => (
  <div className="fixed inset-0 z-[9999] bg-[color:var(--bg-app)] flex items-center justify-center font-sans px-4">
    <div className="w-full max-w-[380px] bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] shadow-lg rounded-[6px]">
      {children}
    </div>
  </div>
);

const Header = ({ icon, title, subtitle, tone = 'manager', broker }) => {
  const Icon = icon;
  const isAdmin = tone === 'admin';

  return (
    <div className="p-5 border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-2)] rounded-t-[6px]">
      <div className="flex items-center gap-3">
        <div
          className={
            isAdmin
              ? 'h-9 w-9 rounded-[4px] flex items-center justify-center bg-blue-50 text-blue-700 border border-blue-100'
              : 'h-9 w-9 rounded-[4px] flex items-center justify-center bg-[color:var(--accent-50)] text-[color:var(--accent-500)] border border-[color:var(--accent-100)]'
          }
        >
          {broker ? <BrokerLogo broker={broker} size={36} fallback={Icon} /> : <Icon size={18} aria-hidden="true" />}
        </div>
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-[color:var(--text-primary)] truncate">{title}</h1>
          <p className="text-[12px] text-[color:var(--text-muted)]">{subtitle}</p>
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
        className="w-full min-h-10 bg-[color:var(--bg-app)] border border-[color:var(--border-default)] text-[color:var(--text-primary)] px-2 pr-7 py-1.5 outline-none focus:border-[color:var(--accent-500)] rounded-[3px] disabled:opacity-50 cursor-pointer flex items-center gap-2 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <BrokerLogo broker={selectedBroker} size={28} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-medium">
            {selectedBroker?.name || 'Select broker'}
          </span>
          <span className="block truncate text-[10px] font-mono text-[color:var(--text-muted)]">
            {getBrokerSecondaryLabel(selectedBroker)}
          </span>
        </span>
        <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-labelledby="broker-select"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-64 overflow-y-auto rounded-[4px] border border-[color:var(--border-default)] bg-[color:var(--bg-surface-1)] shadow-lg"
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
                className="w-full flex items-center gap-2 px-2 py-2 text-left hover:bg-[color:var(--bg-surface-2)]"
                style={{ background: selected ? 'var(--bg-surface-2)' : undefined }}
              >
                <BrokerLogo broker={broker} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-[color:var(--text-primary)]">{broker.name}</span>
                  <span className="block truncate text-[10px] font-mono text-[color:var(--text-muted)]">
                    {getBrokerSecondaryLabel(broker)}
                  </span>
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
      const auth = await loginAdmin(brokerInfo, { user, password, server: loginServer });
      const session = setAuthSession(auth, brokerInfo);
      onLoginSuccess(session, '/admin-dashboard');
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
      subtitle="Admin Login"
      tone="admin"
      error={error}
      loading={loading}
      onSubmit={handleSubmit}
      onSwitchBroker={() => { clearBrokerInfo(); navigate('/', { replace: true }); }}
    >
      <Field id="admin-login" label="Login" type="number" icon={User} value={user} onChange={setUser} required />
      <PasswordField id="admin-password" value={password} onChange={setPassword} />
      <Field id="admin-server" label="Broker Server" icon={Server} value={server} onChange={setServer} readOnly required />
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
  onSubmit,
  onSwitchBroker,
  switchToLabel,
  onSwitchRole,
  children,
}) => (
  <AuthShell>
    <Header
      icon={tone === 'admin' ? ShieldCheck : Lock}
      title={brokerInfo.name || brokerInfo.broker_id}
      subtitle={subtitle}
      tone={tone}
      broker={brokerInfo}
    />
    <div className="p-5">
      <InlineError>{error}</InlineError>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
        {children}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 h-8 inline-flex items-center justify-center gap-2 bg-[color:var(--accent-500)] text-[color:var(--accent-contrast)] text-[12px] font-medium rounded-[3px] disabled:opacity-50"
        >
          {loading ? <SpinnerLabel>Signing in</SpinnerLabel> : 'Sign in'}
        </button>
      </form>

      <div className="mt-5 pt-4 border-t border-[color:var(--border-subtle)] flex items-center justify-between">
        <button type="button" onClick={onSwitchBroker} className="text-[12px] text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]">
          &larr; Switch broker
        </button>
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
    <label htmlFor={id} className="text-[11px] text-[color:var(--text-muted)]">
      {label}
    </label>
    <div className="relative">
      <span className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-[color:var(--text-muted)]">
        {React.createElement(Icon, { size: 14, 'aria-hidden': 'true' })}
      </span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        required={required}
        placeholder={placeholder}
        className="w-full h-8 bg-[color:var(--bg-app)] border border-[color:var(--border-default)] text-[color:var(--text-primary)] text-[12px] pl-8 pr-2 outline-none focus:border-[color:var(--accent-500)] rounded-[3px] placeholder:text-[color:var(--text-muted)]"
      />
    </div>
  </div>
);

const PasswordField = ({ id, value, onChange }) => {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[11px] text-[color:var(--text-muted)]">
        Password
      </label>
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-[color:var(--text-muted)]">
          <Lock size={14} aria-hidden="true" />
        </span>
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          className="w-full h-8 bg-[color:var(--bg-app)] border border-[color:var(--border-default)] text-[color:var(--text-primary)] text-[12px] pl-8 pr-8 outline-none focus:border-[color:var(--accent-500)] rounded-[3px]"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute inset-y-0 right-0 pr-2 flex items-center text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
          tabIndex={-1}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
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
