import LPCleanupPolicyPanel from './LPCleanupPolicyPanel.jsx';
import LPRecoveryPolicyPanel from './LPRecoveryPolicyPanel.jsx';
import LPExactPendingModifyAdmissionPanel from './LPExactPendingModifyAdmissionPanel.jsx';
import LPNativePendingEnablementPanel from './LPNativePendingEnablementPanel.jsx';
import BrokerCapabilitiesPanel from './BrokerCapabilitiesPanel.jsx';
import PrivateFIXReadinessPanel from './PrivateFIXReadinessPanel.jsx';
import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Archive,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  GitBranch,
  ListChecks,
  Loader2,
  Plug,
  RefreshCw,
  Save,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  gatewayApplyFeedConfig,
  gatewayGetFeedConfig,
  gatewaySaveFeedConfig,
} from '../../services/gateway.service';
import { buildFeedConfigPayload, normalizeFeedProvider } from '../../lib/feedConfigPayload';
import { useToast } from '../ui/useToast';
import FixRelayConfigPanel from './FixRelayConfigPanel';
import NamedLPConnectionsPanel from './NamedLPConnectionsPanel';
import NamedLPRoutingPanel from './NamedLPRoutingPanel';
import LPFeedsPanel from './LPFeedsPanel';
import LPManagerPermissionsPanel from './LPManagerPermissionsPanel';
import LPJournalPanel from './LPJournalPanel';
import LPDemoMarketWorkspace from './LPDemoMarketWorkspace.jsx';
import CalculationBaselineWorkspace from './CalculationBaselineWorkspace.jsx';
import './gateways-view.css';

// Page sections, in scroll order. Every section stays mounted; the nav only scrolls.
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

const GatewaySection = ({ section, children }) => {
  const Icon = section.icon;
  const headingId = `${sectionDomId(section.id)}-title`;
  return (
    <div id={sectionDomId(section.id)} data-gw-section={section.id} role="region" aria-labelledby={headingId} className="gw-section">
      <div className="gw-section-head">
        <span className="gw-section-icon" aria-hidden="true"><Icon size={15} /></span>
        <div className="min-w-0">
          <h2 id={headingId} tabIndex={-1} className="gw-section-title">{section.label}</h2>
          <p className="gw-section-desc">{section.description}</p>
        </div>
        {section.tag && <span className="gw-section-tag">{section.tag}</span>}
      </div>
      <div className="gw-section-body">{children}</div>
    </div>
  );
};

const SECTION_BY_ID = Object.fromEntries(GATEWAY_SECTIONS.map((section) => [section.id, section]));

const SETUP_STEPS = [
  { id: 'connections', title: 'Connect a provider', description: 'Add your quote and trade sessions.' },
  { id: 'quotes', title: 'Choose your prices', description: 'Check live quotes and assign a source.' },
  { id: 'routing', title: 'Set up order routing', description: 'Choose where client orders go.' },
];

// Native disclosures keep form drafts mounted while reducing the initial page length.
const GatewayDetails = ({ title, description, children }) => (
  <details className="gw-details">
    <summary>
      <span><span className="gw-details-title">{title}</span><span className="gw-details-desc">{description}</span></span>
      <ChevronDown size={16} aria-hidden="true" />
    </summary>
    <div className="gw-details-body">{children}</div>
  </details>
);

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

const Field = ({ label, required, hint, children }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">
      {label}{required && <span className="ml-0.5 text-red-400">*</span>}
    </span>
    {children}
    {hint && <span className="gw-field-hint">{hint}</span>}
  </label>
);

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
      {isError ? <AlertCircle size={13} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={13} className="mt-0.5 shrink-0" />}
      <span>{children}</span>
    </div>
  );
};

const GatewaysView = () => {
  const { notify } = useToast();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [configRefresh, setConfigRefresh] = useState(0);
  const [passwordSet, setPasswordSet] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const disabled = saving || applying || loadingConfig || Boolean(loadError);

  const scrollRef = useRef(null);
  const navRef = useRef(null);
  const navLockUntil = useRef(0);
  const [activeSection, setActiveSection] = useState(GATEWAY_SECTIONS[0].id);

  // Track scrolling and expanding panels without unmounting any unsaved forms.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return undefined;

    const nodes = GATEWAY_SECTIONS
      .map((section) => root.querySelector(`#${sectionDomId(section.id)}`))
      .filter(Boolean);

    const pick = () => {
      if (Date.now() < navLockUntil.current) return;
      const rootTop = root.getBoundingClientRect().top;
      const navHeight = navRef.current?.offsetHeight || 0;
      const line = rootTop + navHeight + Math.min(160, root.clientHeight * 0.25);
      const atBottom = root.scrollTop > 0 && root.scrollTop + root.clientHeight >= root.scrollHeight - 4;
      let next = GATEWAY_SECTIONS[0].id;
      if (atBottom) {
        next = nodes[nodes.length - 1]?.dataset.gwSection || next;
      } else {
        nodes.forEach((node) => {
          if (node.getBoundingClientRect().top <= line) next = node.dataset.gwSection;
        });
      }
      setActiveSection((current) => (current === next ? current : next));
    };

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        pick();
      });
    };

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
      root.style.setProperty('--gw-nav-offset', `${(navRef.current?.offsetHeight || 0) + 16}px`);
      schedule();
    }) : null;
    [root, navRef.current, ...nodes].filter(Boolean).forEach((node) => observer?.observe(node));
    root.addEventListener('scroll', schedule, { passive: true });
    schedule();

    return () => {
      observer?.disconnect();
      root.removeEventListener('scroll', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Keep the active pill visible when the nav is scrolled sideways on narrow screens.
  useEffect(() => {
    const list = navRef.current?.querySelector('.gw-nav-list');
    const link = list?.querySelector(`[data-gw-target="${activeSection}"]`);
    if (!list || !link || list.scrollWidth <= list.clientWidth) return;
    const left = link.offsetLeft - list.offsetLeft;
    if (left < list.scrollLeft || left + link.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = Math.max(0, left - 16);
    }
  }, [activeSection]);

  const jumpToSection = (id) => (event) => {
    event.preventDefault();
    const node = scrollRef.current?.querySelector(`#${sectionDomId(id)}`);
    if (!node) return;
    const reduceMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    navLockUntil.current = Date.now() + (reduceMotion ? 100 : 800);
    setActiveSection(id);
    const root = scrollRef.current;
    const top = root.scrollTop + node.getBoundingClientRect().top - root.getBoundingClientRect().top
      - (navRef.current?.offsetHeight || 0) - 16;
    root.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
    node.querySelector('.gw-section-title')?.focus({ preventScroll: true });
  };

  useEffect(() => {
    let mounted = true;
    setLoadingConfig(true);
    setLoadError('');
    setError('');
    gatewayGetFeedConfig()
      .then((config) => {
        if (!mounted) return;
        setForm(formFromSavedConfig(config));
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
  }, [configRefresh]);

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
    }

    if (form.port && !Number.isInteger(Number(form.port))) {
      return 'Port must be a whole number.';
    }

    if (form.port && (Number(form.port) <= 0 || Number(form.port) > 65535)) {
      return 'Port must be between 1 and 65535.';
    }

    return '';
  };

  const saveCurrentCredentials = async ({ announce = true } = {}) => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return null;
    }

    const payload = buildFeedConfigPayload(form);
    await gatewaySaveFeedConfig(payload);
    setForm((current) => ({ ...current, password: '' }));
    setPasswordSet(Boolean(payload.password || passwordSet));
    if (announce) {
      setNotice(`${providerLabel(payload.feed_provider)} LP credentials saved.`);
      notify({ title: 'LP credentials saved', tone: 'success' });
    }
    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
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
    setError('');
    setNotice('');
    setApplying(true);

    try {
      const payload = await saveCurrentCredentials({ announce: false });
      if (!payload) return;
      const result = await gatewayApplyFeedConfig();
      const activeProvider = result?.feed_provider || result?.provider || form.feed_provider;
      setNotice(`${providerLabel(payload.feed_provider)} LP credentials saved and applied.`);
      notify({ title: 'LP credentials applied', description: providerLabel(activeProvider), tone: 'success' });
    } catch (err) {
      const message = err.message || 'Failed to apply LP credentials.';
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
          <div className="gw-heading"><span className="gw-heading-icon" aria-hidden="true"><Plug size={22} /></span><div>
          <h1 className="gw-title">Gateways</h1>
          <p className="gw-subtitle">
            Connect liquidity providers, choose where prices come from, and control how orders are routed.
          </p>
          </div></div>
          <div className="gw-setup" role="group" aria-label="Gateway setup shortcuts">
            <div className="gw-setup-label">Setting up a gateway?<span>Start with these three steps.</span></div>
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
        </div>
      </header>

      <nav ref={navRef} className="gw-nav" aria-label="Gateway sections">
        <div className="gw-shell">
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
                    <Icon size={13} aria-hidden="true" />
                    {section.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <div className="gw-shell gw-body">
        <GatewaySection section={SECTION_BY_ID.connections}>
          <NamedLPConnectionsPanel />
        </GatewaySection>

        <GatewaySection section={SECTION_BY_ID.quotes}>
          <LPFeedsPanel />
        </GatewaySection>

        <GatewaySection section={SECTION_BY_ID.routing}>
          <NamedLPRoutingPanel />
          <div className="gw-tools-label">Advanced execution settings</div>
          <GatewayDetails title="Rejected-order cleanup" description="Set limits for cleaning up partial execution of rejected orders.">
            <LPCleanupPolicyPanel />
          </GatewayDetails>
          <GatewayDetails title="Recovery policies" description="Configure how interrupted order processing can recover.">
            <LPRecoveryPolicyPanel />
          </GatewayDetails>
          <GatewayDetails title="Pending-order changes" description="Review admission settings for exact pending-order modifications.">
            <LPExactPendingModifyAdmissionPanel />
          </GatewayDetails>
          <GatewayDetails title="Native pending orders" description="Review provider-side pending-order enablement and readiness.">
            <LPNativePendingEnablementPanel />
          </GatewayDetails>
        </GatewaySection>

        <GatewaySection section={SECTION_BY_ID.journal}>
          <LPJournalPanel />
          <GatewayDetails title="Demo order workspace" description="Inspect demo execution and place demo market orders.">
            <LPDemoMarketWorkspace />
          </GatewayDetails>
          <GatewayDetails title="Calculation baselines" description="Review and manage the calculation baseline used by the broker.">
            <CalculationBaselineWorkspace />
          </GatewayDetails>
        </GatewaySection>

        <GatewaySection section={SECTION_BY_ID.permissions}>
          <LPManagerPermissionsPanel />
        </GatewaySection>

        <GatewaySection section={SECTION_BY_ID.readiness}>
          <PrivateFIXReadinessPanel /><BrokerCapabilitiesPanel />
          {import.meta.env.VITE_FIX_RELAY_ENABLED === 'true' && <FixRelayConfigPanel />}
        </GatewaySection>

        <GatewaySection section={SECTION_BY_ID.legacy}>
          <form
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
                className="rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
                style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}
              >
                {providerLabel(form.feed_provider)}
              </div>
            </div>

            <Notice tone="error">{error}</Notice>
            <Notice>{notice}</Notice>
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
                <Input value={form.host} onChange={setField('host')} placeholder="Enter LP host" disabled={disabled} />
              </Field>

              <Field label="Port" required={form.enabled}>
                <Input type="number" min={1} max={65535} step={1} value={form.port} onChange={setField('port')} placeholder="Enter LP port" disabled={disabled} />
              </Field>

              <Field label="Sender CompID" required={form.enabled}>
                <Input value={form.sender_comp_id} onChange={setField('sender_comp_id')} placeholder="Enter sender CompID" disabled={disabled} />
              </Field>

              <Field label="Target CompID" required={form.enabled}>
                <Input value={form.target_comp_id} onChange={setField('target_comp_id')} placeholder="Enter target CompID" disabled={disabled} />
              </Field>

              <Field label="Username" required={form.enabled}>
                <Input value={form.username} onChange={setField('username')} placeholder="Enter LP username" disabled={disabled} />
              </Field>

              <Field label="Password" required={form.enabled && !passwordSet} hint={passwordSet ? 'A password is saved. Leave this blank to keep it.' : 'Enter the password supplied by your provider.'}>
                <Input
                  type="password"
                  value={form.password}
                  onChange={setField('password')}
                  placeholder={passwordSet ? 'Keep saved password' : 'Enter LP password'}
                  autoComplete="new-password"
                  disabled={disabled}
                />
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
                <Input
                  value={form.symbols}
                  onChange={setField('symbols')}
                  placeholder="EURUSD, GBPUSD, XAUUSD"
                  disabled={disabled || form.all_symbols}
                />
              </Field>

              <Field label="Catalog file (optional)">
                <Input value={form.catalog_file} onChange={setField('catalog_file')} placeholder="Optional catalog file path" disabled={disabled} />
              </Field>
              </div>
            </fieldset>

            <div className="gw-save-help"><strong>Save</strong> stores these settings. <strong>Save & Apply</strong> also activates them on the running feed.</div>
            <div className="gw-form-actions">
              <button type="button" onClick={handleApply} disabled={disabled} className="ui-btn ui-btn-secondary ui-btn-sm gap-1.5">
                {applying ? <><Loader2 size={12} className="animate-spin" /> Applying</> : <><Zap size={12} /> Save & Apply</>}
              </button>
              <button type="submit" disabled={disabled} className="ui-btn ui-btn-primary ui-btn-sm gap-1.5">
                {saving || loadingConfig ? <><Loader2 size={12} className="animate-spin" /> {loadingConfig ? 'Loading' : 'Saving'}</> : <><Save size={12} /> Save LP Credentials</>}
              </button>
            </div>
          </form>
        </GatewaySection>
      </div>
    </div>
  );
};

export default GatewaysView;
