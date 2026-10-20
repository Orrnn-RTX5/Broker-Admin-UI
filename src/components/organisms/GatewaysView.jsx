import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Archive,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  GitBranch,
  ListChecks,
  Loader2,
  Plug,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Zap,
  X,
} from 'lucide-react';
import {
  gatewayApplyFeedConfig,
  gatewayGetFeedConfig,
  gatewaySaveFeedConfig,
} from '../../services/gateway.service';
import { buildFeedConfigPayload, normalizeFeedProvider } from '../../lib/feedConfigPayload';
import { isFixRelayEnabled, resolveGatewayTools } from '../../lib/fixRelayCapability';
import { useToast } from '../ui/useToast';
import NamedLPConnectionsPanel from './NamedLPConnectionsPanel';
import './gateways-view.css';

const gatewayPanel = loader => {
  const Component = React.lazy(loader);
  return function GatewayPanel(props) {
    return <React.Suspense fallback={<p className="gw-loading" role="status">Loading workspace…</p>}><Component {...props} /></React.Suspense>;
  };
};
const LPCleanupPolicyPanel = gatewayPanel(() => import('./LPCleanupPolicyPanel.jsx'));
const LPRecoveryPolicyPanel = gatewayPanel(() => import('./LPRecoveryPolicyPanel.jsx'));
const LPExactPendingModifyAdmissionPanel = gatewayPanel(() => import('./LPExactPendingModifyAdmissionPanel.jsx'));
const LPNativePendingEnablementPanel = gatewayPanel(() => import('./LPNativePendingEnablementPanel.jsx'));
const BrokerCapabilitiesPanel = gatewayPanel(() => import('./BrokerCapabilitiesPanel.jsx'));
const PrivateFIXReadinessPanel = gatewayPanel(() => import('./PrivateFIXReadinessPanel.jsx'));
const FixRelayConfigPanel = gatewayPanel(() => import('./FixRelayConfigPanel.jsx'));
const GatewaySymbolPicker = gatewayPanel(() => import('./GatewaySymbolPicker.jsx'));
const NamedLPRoutingPanel = gatewayPanel(() => import('./NamedLPRoutingPanel.jsx'));
const LPFeedsPanel = gatewayPanel(() => import('./LPFeedsPanel.jsx'));
const LPManagerPermissionsPanel = gatewayPanel(() => import('./LPManagerPermissionsPanel.jsx'));
const LPJournalPanel = gatewayPanel(() => import('./LPJournalPanel.jsx'));
const LPDemoMarketWorkspace = gatewayPanel(() => import('./LPDemoMarketWorkspace.jsx'));
const CalculationBaselineWorkspace = gatewayPanel(() => import('./CalculationBaselineWorkspace.jsx'));

// A visited workspace stays mounted to preserve its unsaved form drafts.
const GATEWAY_SECTIONS = [
  {
    id: 'connections',
    label: 'Connections',
    icon: Plug,
    description: 'Add and manage the FIX sessions that link this broker to each liquidity provider.',
  },
  {
    id: 'quotes',
    label: 'Quotes',
    icon: Activity,
    description: 'Choose which connection supplies prices for each symbol and check that quotes are arriving.',
  },
  {
    id: 'routing',
    label: 'Routing & execution',
    icon: GitBranch,
    description: 'Decide where client orders are sent and how failed, recovered or pending orders are handled.',
  },
  {
    id: 'journal',
    label: 'Journal & exposure',
    icon: BookOpen,
    description: 'Review what was sent to each provider, track exposure, place demo orders and manage calculation baselines.',
  },
  {
    id: 'permissions',
    label: 'Permissions',
    icon: ShieldCheck,
    description: 'Control which managers can view or change liquidity-provider settings.',
  },
  {
    id: 'readiness',
    label: 'Readiness',
    icon: ListChecks,
    description: 'Check which gateway features are switched on and whether each one is ready to use.',
  },
  {
    id: 'legacy',
    label: 'Legacy price feed',
    icon: Archive,
    tag: 'Legacy',
    description: 'The older single-LP market-data feed. Kept for existing setups; new providers belong under Connections.',
  },
];

const sectionDomId = (id) => `gw-section-${id}`;

const GatewaySection = ({ section, active, mounted, children }) => {
  const Icon = section.icon;
  const headingId = `${sectionDomId(section.id)}-title`;
  return (
    <div id={sectionDomId(section.id)} data-gw-section={section.id} role="region" aria-labelledby={headingId} className="gw-section" hidden={!active}>
      <div className="gw-section-head">
        <span className="gw-section-icon" aria-hidden="true"><Icon size={15} /></span>
        <div className="min-w-0">
          <h2 id={headingId} tabIndex={-1} className="gw-section-title">{section.label}</h2>
          <p className="gw-section-desc">{section.description}</p>
        </div>
        {section.tag && <span className="gw-section-tag">{section.tag}</span>}
      </div>
      <div className="gw-section-body">{mounted && children}</div>
    </div>
  );
};

const SECTION_BY_ID = Object.fromEntries(GATEWAY_SECTIONS.map((section) => [section.id, section]));

const SETUP_STEPS = [
  { id: 'connections', title: 'Connect a provider', description: 'Add your quote and trade sessions.' },
  { id: 'quotes', title: 'Choose your prices', description: 'Check live quotes and assign a source.' },
  { id: 'routing', title: 'Set up order routing', description: 'Choose where client orders go.' },
];

const GATEWAY_TOOLS_BASE = [
  { section: 'connections', title: 'Provider connections', description: 'FIX sessions, credentials, connect and disconnect' },
  { section: 'quotes', title: 'Price sources & quotes', description: 'Symbol mappings, live prices and feed health' },
  { section: 'routing', title: 'Order routing', description: 'Execution routes, groups and symbol rules' },
  { section: 'routing', id: 'cleanup', title: 'Rejected-order cleanup', description: 'Partial execution and cleanup limits' },
  { section: 'routing', id: 'recovery', title: 'Recovery policies', description: 'Interrupted processing and FIX read limits' },
  { section: 'routing', id: 'pending-modify', title: 'Pending-order changes', description: 'Admission settings for pending modifications' },
  { section: 'routing', id: 'native-pending', title: 'Native pending orders', description: 'Provider pending orders and enablement' },
  { section: 'journal', title: 'Journal & exposure', description: 'Provider requests, history, positions and exposure' },
  { section: 'journal', id: 'demo', title: 'Demo order workspace', description: 'Demo market orders and execution' },
  { section: 'journal', id: 'baselines', title: 'Calculation baselines', description: 'Broker calculation settings and revisions' },
  { section: 'permissions', title: 'Manager permissions', description: 'Manager access, configuration and grants' },
  { section: 'readiness', title: 'Gateway readiness', description: 'B-book private FIX session health and capabilities' },
  { section: 'legacy', title: 'Legacy price feed', description: 'Single provider, market data credentials and SSL' },
];

// The Superadmin FIX relay panel is a runtime capability, not a build flag:
// visible iff the per-deployment feature switch enables it (runtime config,
// broker capability registry environment, then the build-time env as a
// fallback default). Unconfigured deployments stay closed.
const getGatewayTools = (enabled = isFixRelayEnabled()) =>
  resolveGatewayTools(GATEWAY_TOOLS_BASE, enabled);

// Opening a tool loads it once; closing it retains any unsaved draft.
const GatewayDetails = ({ id, title, description, children }) => {
  const [opened, setOpened] = useState(false);
  return <details id={`gw-tool-${id}`} className="gw-details" onToggle={event => { if (event.currentTarget.open) setOpened(true); }}>
    <summary>
      <span><span className="gw-details-title">{title}</span><span className="gw-details-desc">{description}</span></span>
      <ChevronDown size={16} aria-hidden="true" />
    </summary>
    <div className="gw-details-body">{opened && children}</div>
  </details>;
};

const PROVIDER_OPTIONS = [
  { value: 'rtxmd', label: 'RTX Market Data FIX' },
  { value: 't4b', label: 'T4B' },
  { value: 'equinix', label: 'Equinix FIX 4.4' },
];

const DEFAULT_FORM = {
  feed_provider: 'rtxmd',
  enabled: true,
  host: '',
  port: '',
  sender_comp_id: '',
  target_comp_id: '',
  username: '',
  password: '',
  use_ssl: true,
  all_symbols: true,
  symbols: '',
  catalog_file: '',
};

const providerLabel = (value) =>
  PROVIDER_OPTIONS.find((option) => option.value === normalizeFeedProvider(value))?.label ||
  normalizeFeedProvider(value) ||
  'RTX Market Data FIX';

const formFromSavedConfig = (config) => {
  const cserver = config?.cserver || {};
  const symbols = String(cserver.symbols || '').trim();

  return {
    ...DEFAULT_FORM,
    feed_provider: normalizeFeedProvider(config?.feed_provider) || DEFAULT_FORM.feed_provider,
    enabled: typeof config?.enabled === 'boolean' ? config.enabled : DEFAULT_FORM.enabled,
    host: String(cserver.host || ''),
    port: cserver.port ? String(cserver.port) : '',
    sender_comp_id: String(cserver.sender_comp_id || ''),
    target_comp_id: String(cserver.target_comp_id || ''),
    username: String(cserver.username || ''),
    password: '',
    use_ssl: typeof cserver.use_ssl === 'boolean' ? cserver.use_ssl : DEFAULT_FORM.use_ssl,
    all_symbols: symbols === '',
    symbols,
    catalog_file: String(cserver.catalog_file || ''),
  };
};

const Field = ({ label, required, hint, inputId, children }) => {
  const Wrapper = inputId ? 'div' : 'label';
  const Label = inputId ? 'label' : 'span';
  return <Wrapper className="flex flex-col gap-1.5">
    <Label htmlFor={inputId} className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">
      {label}{required && <span className="ml-0.5 text-red-400">*</span>}
    </Label>
    {children}
    {hint && <span className="gw-field-hint">{hint}</span>}
  </Wrapper>;
};

const Input = ({ type = 'text', value, onChange, placeholder, required, disabled, ...props }) => (
  <input
    {...props}
    type={type}
    className="ui-input ui-input-sm"
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    required={required}
    disabled={disabled}
  />
);

const Notice = ({ tone = 'info', children }) => {
  if (!children) return null;

  const isError = tone === 'error';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
      style={{
        background: isError
          ? 'color-mix(in srgb, var(--danger-500) 10%, transparent)'
          : 'color-mix(in srgb, var(--success-500) 10%, transparent)',
        color: isError ? 'var(--danger-500)' : 'var(--success-500)',
        border: `1px solid ${isError
          ? 'color-mix(in srgb, var(--danger-500) 25%, transparent)'
          : 'color-mix(in srgb, var(--success-500) 25%, transparent)'}`,
      }}
    >
      {isError ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
      <span>{children}</span>
    </div>
  );
};

const GatewaysView = () => {
  const { notify } = useToast();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [savedForm, setSavedForm] = useState(DEFAULT_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [configRefresh, setConfigRefresh] = useState(0);
  const loadedConfigRevision = useRef(null);
  const [passwordSet, setPasswordSet] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const disabled = saving || applying || loadingConfig || Boolean(loadError);
  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);

  const scrollRef = useRef(null);
  const legacyFormRef = useRef(null);
  const searchRef = useRef(null);
  const focusFrame = useRef(0);
  const [activeSection, setActiveSection] = useState(GATEWAY_SECTIONS[0].id);
  const [visitedSections, setVisitedSections] = useState(['connections']);
  const [search, setSearch] = useState('');
  const searchTerms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const gatewayTools = getGatewayTools();
  const searchResults = searchTerms.length ? gatewayTools.filter((tool) => {
    const text = `${tool.title} ${tool.description} ${SECTION_BY_ID[tool.section].label}`.toLowerCase();
    return searchTerms.every((term) => text.includes(term));
  }) : [];

  useEffect(() => () => cancelAnimationFrame(focusFrame.current), []);

  const jumpToSection = (id, toolId) => (event) => {
    event.preventDefault();
    event.currentTarget.closest('.gw-setup')?.removeAttribute('open');
    setActiveSection(id);
    setVisitedSections(previous => previous.includes(id) ? previous : [...previous, id]);
    setSearch('');
    setShowPassword(false);
    cancelAnimationFrame(focusFrame.current);
    focusFrame.current = requestAnimationFrame(() => {
      const root = scrollRef.current;
      const node = root?.querySelector(`#${sectionDomId(id)}`);
      if (!node) return;
      const tool = toolId ? node.querySelector(`#gw-tool-${toolId}`) : null;
      if (tool) tool.open = true;
      const target = tool || node;
      const toolbarHeight = (root.querySelector('.gw-header')?.offsetHeight || 0)
        + (root.querySelector('.gw-sidebar')?.offsetHeight || 0) + 12;
      const top = tool ? root.scrollTop + target.getBoundingClientRect().top - root.getBoundingClientRect().top - toolbarHeight : 0;
      root.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
      (tool?.querySelector('summary') || node.querySelector('.gw-section-title'))?.focus({ preventScroll: true });
    });
  };

  useEffect(() => {
    if (activeSection !== 'legacy' || loadedConfigRevision.current === configRefresh) return undefined;
    let mounted = true;
    setLoadingConfig(true);
    setLoadError('');
    setError('');
    gatewayGetFeedConfig()
      .then((config) => {
        if (!mounted) return;
        loadedConfigRevision.current = configRefresh;
        const loaded = formFromSavedConfig(config);
        setForm(loaded);
        setSavedForm(loaded);
        setPasswordSet(Boolean(config?.password_set));
      })
      .catch((err) => {
        if (!mounted) return;
        const message = err.message || 'Failed to load saved LP credentials.';
        setLoadError(message);
      })
      .finally(() => {
        if (mounted) setLoadingConfig(false);
      });

    return () => { mounted = false; };
  }, [configRefresh, activeSection]);

  const setField = (key) => (event) => {
    const { checked, type, value } = event.target;
    setForm((current) => {
      const next = { ...current, [key]: type === 'checkbox' ? checked : value };
      if (key === 'all_symbols' && checked) next.symbols = '';
      return next;
    });
    setError('');
    setNotice('');
  };

  const validateForm = () => {
    if (form.enabled) {
      const missing = [
        ['Host', form.host],
        ['Port', form.port],
        ['Sender CompID', form.sender_comp_id],
        ['Target CompID', form.target_comp_id],
        ['Username', form.username],
        ['Password', passwordSet || form.password],
      ].filter(([, value]) => !String(value || '').trim());

      if (missing.length > 0) {
        return `${missing.map(([label]) => label).join(', ')} required when LP credentials are enabled.`;
      }

      if (!form.all_symbols && !form.symbols.trim()) {
        return 'Select at least one symbol or enable "Subscribe to all symbols".';
      }
    }

    if (form.port && !Number.isInteger(Number(form.port))) {
      return 'Port must be a whole number.';
    }

    if (form.port && (Number(form.port) <= 0 || Number(form.port) > 65535)) {
      return 'Port must be between 1 and 65535.';
    }

    if (form.enabled && !form.all_symbols && !form.symbols.trim()) {
      return 'Enter at least one symbol, or turn on “Subscribe to all symbols”.';
    }

    return '';
  };

  const validateBeforeSave = () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      const inputs = Array.from(legacyFormRef.current?.querySelectorAll('input[required], input[type="number"]') || []);
      inputs.find((input) => !input.disabled && (!input.validity.valid || (input.required && !input.value.trim())))?.focus();
      return false;
    }
    return true;
  };

  const saveCurrentCredentials = async ({ announce = true } = {}) => {
    const payload = buildFeedConfigPayload(form);
    await gatewaySaveFeedConfig(payload);
    const saved = { ...form, password: '' };
    setForm(saved);
    setSavedForm(saved);
    setPasswordSet(Boolean(payload.password || passwordSet));
    if (announce) {
      setNotice(`${providerLabel(payload.feed_provider)} LP credentials saved.`);
      notify({ title: 'LP credentials saved', tone: 'success' });
    }
    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (disabled) return;
    setError('');
    setNotice('');
    if (!validateBeforeSave()) return;
    setSaving(true);
    try {
      await saveCurrentCredentials();
    } catch (err) {
      const message = err.message || 'Failed to save LP credentials.';
      setError(message);
      notify({ title: 'Save failed', description: message, tone: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  const handleApply = async () => {
    if (disabled) return;
    setError('');
    setNotice('');
    if (!validateBeforeSave()) return;
    setApplying(true);
    let credentialsSaved = false;

    try {
      const payload = await saveCurrentCredentials({ announce: false });
      credentialsSaved = true;
      setNotice('Settings saved. Activating the feed…');
      const result = await gatewayApplyFeedConfig();
      const activeProvider = result?.feed_provider || result?.provider || form.feed_provider;
      setNotice(`${providerLabel(payload.feed_provider)} LP credentials saved and applied.`);
      notify({ title: 'LP credentials applied', description: providerLabel(activeProvider), tone: 'success' });
    } catch (err) {
      const detail = err.message || 'Failed to apply LP credentials.';
      const message = credentialsSaved ? `Settings were saved, but the feed could not be activated. ${detail}` : detail;
      setNotice('');
      setError(message);
      notify({ title: 'Apply failed', description: message, tone: 'danger' });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div
      ref={scrollRef}
      className="gw-view flex-1 min-h-0 bg-[color:var(--bg-app)] overflow-y-auto overflow-x-hidden text-[color:var(--text-primary)]"
    >
      <header className="gw-header">
        <div className="gw-shell">
          <div className="gw-heading"><span className="gw-heading-icon" aria-hidden="true"><Plug size={15} /></span><div className="gw-heading-copy">
          <h1 className="gw-title">Gateways</h1>
          <p className="gw-subtitle">
            Liquidity connections, price sources & execution
          </p>
          </div></div>
          <details className="gw-setup">
            <summary>Setup guide <ChevronDown size={13} aria-hidden="true" /></summary>
            <div className="gw-setup-content" role="group" aria-label="Gateway setup shortcuts">
            <div className="gw-setup-label">Gateway setup<span>Connect a provider, verify quotes, then configure routing.</span></div>
            <ol className="gw-setup-list">
              {SETUP_STEPS.map((step, index) => (
                <li key={step.id}>
                  <a href={`#${sectionDomId(step.id)}`} onClick={jumpToSection(step.id)} className="gw-setup-link">
                    <span className="gw-step-number" aria-hidden="true">{index + 1}</span>
                    <span><strong>{step.title}</strong><span>{step.description}</span></span>
                    <ArrowRight size={15} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ol>
            </div>
          </details>
        </div>
      </header>

      <div className="gw-shell gw-workspace">
      <aside className="gw-sidebar">
        <div className="gw-search">
          <label htmlFor="gw-search">Find a gateway tool</label>
          <div className="gw-search-input">
            <Search size={16} aria-hidden="true" />
            <input ref={searchRef} id="gw-search" type="search" placeholder="Search tools…" value={search} onChange={(event) => setSearch(event.target.value)} autoComplete="off" aria-describedby={searchTerms.length ? 'gw-search-count' : undefined} />
            {search && <button type="button" aria-label="Clear tool search" onClick={() => { setSearch(''); searchRef.current?.focus(); }}><X size={14} /></button>}
          </div>
        </div>
        {searchTerms.length > 0 && <div className="gw-search-results">
          <p id="gw-search-count" role="status">{searchResults.length ? `${searchResults.length} tool${searchResults.length === 1 ? '' : 's'} found` : 'No tools found. Try “quotes”, “routing” or “permissions”.'}</p>
          <ul>{searchResults.map((tool) => <li key={tool.id || tool.section}>
            <a href={`#${tool.id ? `gw-tool-${tool.id}` : sectionDomId(tool.section)}`} onClick={jumpToSection(tool.section, tool.id)}>
              <strong>{tool.title}</strong><span>{SECTION_BY_ID[tool.section].label}</span>
            </a>
          </li>)}</ul>
        </div>}
        <nav className="gw-nav" aria-label="Gateway sections">
          <ul className="gw-nav-list">
            {GATEWAY_SECTIONS.map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.id;
              return (
                <li key={section.id}>
                  <a
                    href={`#${sectionDomId(section.id)}`}
                    data-gw-target={section.id}
                    className="gw-nav-btn"
                    aria-current={active ? 'location' : undefined}
                    onClick={jumpToSection(section.id)}
                  >
                    <Icon size={14} aria-hidden="true" />
                    <span>{section.label}</span>
                    {section.id === 'legacy' && dirty && <span className="gw-draft-dot" aria-label="Unsaved changes" />}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div className="gw-body">
        <GatewaySection section={SECTION_BY_ID.connections} active={activeSection === 'connections'} mounted={visitedSections.includes('connections')}>
          <NamedLPConnectionsPanel />
        </GatewaySection>

        <GatewaySection section={SECTION_BY_ID.quotes} active={activeSection === 'quotes'} mounted={visitedSections.includes('quotes')}>
          <LPFeedsPanel />
        </GatewaySection>

        <GatewaySection section={SECTION_BY_ID.routing} active={activeSection === 'routing'} mounted={visitedSections.includes('routing')}>
          <NamedLPRoutingPanel />
          <div className="gw-tools-label">Advanced execution settings</div>
          <GatewayDetails id="cleanup" title="Rejected-order cleanup" description="Set limits for cleaning up partial execution of rejected orders.">
            <LPCleanupPolicyPanel />
          </GatewayDetails>
          <GatewayDetails id="recovery" title="Recovery policies" description="Configure how interrupted order processing can recover.">
            <LPRecoveryPolicyPanel />
          </GatewayDetails>
          <GatewayDetails id="pending-modify" title="Pending-order changes" description="Review admission settings for exact pending-order modifications.">
            <LPExactPendingModifyAdmissionPanel />
          </GatewayDetails>
          <GatewayDetails id="native-pending" title="Native pending orders" description="Review provider-side pending-order enablement and readiness.">
            <LPNativePendingEnablementPanel />
          </GatewayDetails>
        </GatewaySection>

        <GatewaySection section={SECTION_BY_ID.journal} active={activeSection === 'journal'} mounted={visitedSections.includes('journal')}>
          <LPJournalPanel />
          <GatewayDetails id="demo" title="Demo order workspace" description="Inspect demo execution and place demo market orders.">
            <LPDemoMarketWorkspace />
          </GatewayDetails>
          <GatewayDetails id="baselines" title="Calculation baselines" description="Review and manage the calculation baseline used by the broker.">
            <CalculationBaselineWorkspace />
          </GatewayDetails>
        </GatewaySection>

        <GatewaySection section={SECTION_BY_ID.permissions} active={activeSection === 'permissions'} mounted={visitedSections.includes('permissions')}>
          <LPManagerPermissionsPanel />
        </GatewaySection>

        <GatewaySection section={SECTION_BY_ID.readiness} active={activeSection === 'readiness'} mounted={visitedSections.includes('readiness')}>
          <PrivateFIXReadinessPanel /><BrokerCapabilitiesPanel />
          {isFixRelayEnabled() && <GatewayDetails id="relay" title="Superadmin FIX relay" description="Configure the separate FIX relay and inspect its connection status."><FixRelayConfigPanel /></GatewayDetails>}
        </GatewaySection>

        <GatewaySection section={SECTION_BY_ID.legacy} active={activeSection === 'legacy'} mounted={visitedSections.includes('legacy')}>
          <form
            ref={legacyFormRef}
            noValidate
            onSubmit={handleSubmit}
            className="gw-legacy-form flex w-full flex-col gap-4 rounded-lg border p-4"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2, var(--surface))' }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--border-3)' }}>
              <div>
                <div className="text-sm font-semibold text-[color:var(--text-primary)]">Legacy feed settings</div>
                <div className="mt-1 text-[12px] text-[color:var(--text-muted)]">
                  Save the FIX quote-session credentials that the broker backend should use for upstream market data.
                </div>
              </div>
              <div
                className="gw-provider-badge"
              >
                {providerLabel(form.feed_provider)}
              </div>
            </div>

            <Notice tone="error">{error}</Notice>
            <Notice>{notice}</Notice>
            {!loadingConfig && !loadError && <p className={`gw-draft-status${dirty ? ' is-dirty' : ''}`} role="status">{dirty ? 'You have unsaved feed settings.' : 'Showing saved feed settings.'}</p>}
            {loadingConfig && <p className="gw-loading" role="status"><Loader2 size={15} className="animate-spin" /> Loading saved feed settings…</p>}
            {loadError && <div className="gw-load-error"><Notice tone="error">{loadError}</Notice><button type="button" className="ui-btn ui-btn-secondary" onClick={() => setConfigRefresh((value) => value + 1)}><RefreshCw size={14} /> Retry loading settings</button></div>}

            <fieldset className="gw-form-group">
              <legend>Feed & security</legend>
              <div className="gw-form-grid">
              <Field label="Provider">
                <select className="ui-select ui-input-sm" value={form.feed_provider} onChange={setField('feed_provider')} disabled={disabled}>
                  {PROVIDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </Field>

                <label className="gw-toggle">
                  <input type="checkbox" checked={form.enabled} onChange={setField('enabled')} disabled={disabled} className="accent-blue-500" />
                  Enable this feed
                </label>

                <label className="gw-toggle">
                  <input type="checkbox" checked={form.use_ssl} onChange={setField('use_ssl')} disabled={disabled} className="accent-blue-500" />
                  Use a secure connection (SSL / TLS)
                </label>
              </div>
            </fieldset>
            <fieldset className="gw-form-group">
              <legend>Connection credentials</legend>
              <p className="gw-field-hint">Use the quote-session details supplied by your liquidity provider. Fields marked * are required when the feed is enabled.</p>
              <div className="gw-form-grid">

              <Field label="Host" required={form.enabled}>
                <Input required={form.enabled} value={form.host} onChange={setField('host')} placeholder="Enter LP host" disabled={disabled} />
              </Field>

              <Field label="Port" required={form.enabled}>
                <Input required={form.enabled} type="number" min={1} max={65535} step={1} value={form.port} onChange={setField('port')} placeholder="Enter LP port" disabled={disabled} />
              </Field>

              <Field label="Sender CompID" required={form.enabled}>
                <Input required={form.enabled} value={form.sender_comp_id} onChange={setField('sender_comp_id')} placeholder="Enter sender CompID" disabled={disabled} />
              </Field>

              <Field label="Target CompID" required={form.enabled}>
                <Input required={form.enabled} value={form.target_comp_id} onChange={setField('target_comp_id')} placeholder="Enter target CompID" disabled={disabled} />
              </Field>

              <Field label="Username" required={form.enabled}>
                <Input required={form.enabled} value={form.username} onChange={setField('username')} placeholder="Enter LP username" disabled={disabled} />
              </Field>

              <Field label="Password" inputId="gw-feed-password" required={form.enabled && !passwordSet} hint={passwordSet ? 'A password is saved. Leave this blank to keep it.' : 'Enter the password supplied by your provider.'}>
                <span className="gw-password-input"><Input
                  id="gw-feed-password"
                  type={showPassword ? 'text' : 'password'}
                  required={form.enabled && !passwordSet}
                  value={form.password}
                  onChange={setField('password')}
                  placeholder={passwordSet ? 'Keep saved password' : 'Enter LP password'}
                  autoComplete="new-password"
                  disabled={disabled}
                /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} disabled={disabled} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span>
              </Field>
              </div>
            </fieldset>
            <fieldset className="gw-form-group">
              <legend>Symbols</legend>
              <div className="gw-form-grid">

                <label className="gw-toggle">
                  <input type="checkbox" checked={form.all_symbols} onChange={setField('all_symbols')} disabled={disabled} className="accent-blue-500" />
                  Subscribe to all symbols
                </label>

              <Field label="Selected symbols" hint="Turn off “all symbols” to enter a comma-separated list.">
                <GatewaySymbolPicker value={form.symbols} onChange={(symbols) => setForm((current) => ({ ...current, symbols }))} disabled={disabled || form.all_symbols} allSymbols={form.all_symbols} />
              </Field>

              <Field label="Catalog file (optional)">
                <Input value={form.catalog_file} onChange={setField('catalog_file')} placeholder="Optional catalog file path" disabled={disabled} />
              </Field>
              </div>
            </fieldset>

            <div className="gw-save-help"><strong>Save</strong> stores these settings. <strong>Save & Apply</strong> also activates them on the running feed.</div>
            <div className="gw-form-actions">
              <button type="button" disabled={disabled || !dirty} className="ui-btn ui-btn-secondary" onClick={() => { setForm(savedForm); setShowPassword(false); setError(''); setNotice('Draft discarded. Showing saved feed settings.'); }}>Discard changes</button>
              <button type="button" onClick={handleApply} disabled={disabled} className="ui-btn ui-btn-secondary ui-btn-sm gap-1.5">
                {applying ? <><Loader2 size={12} className="animate-spin" /> Applying</> : <><Zap size={12} /> Save & Apply</>}
              </button>
              <button type="submit" disabled={disabled} className="ui-btn ui-btn-primary ui-btn-sm gap-1.5">
                {saving || loadingConfig ? <><Loader2 size={12} className="animate-spin" /> {loadingConfig ? 'Loading' : 'Saving'}</> : <><Save size={12} /> Save settings</>}
              </button>
            </div>
          </form>
        </GatewaySection>
      </div>
      </div>
    </div>
  );
};

export default GatewaysView;
