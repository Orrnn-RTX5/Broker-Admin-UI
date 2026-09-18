import {
  AtSign,
  BarChart3,
  Mail,
  MessageSquare,
  MessagesSquare,
  ShieldCheck,
  Network,
  CheckCircle2,
  ExternalLink,
  Info,
  Server,
  XCircle,
} from 'lucide-react';
import './IntegrationsView.css';

const serviceLogos = {
  finteza: { variant: 'analytics' },
  vps: { variant: 'server' },
  mail: { variant: 'mail' },
  sms: { variant: 'message' },
  messenger: { variant: 'chat' },
  kyc: { variant: 'shield' },
};

const toneClasses = {
  danger: {
    chip: 'border-[color:var(--danger-500)]/30 bg-[color:var(--danger-500)]/5 text-[color:var(--danger-500)]',
    icon: 'text-[color:var(--danger-500)]',
    value: 'text-[color:var(--danger-500)]',
  },
  info: {
    chip: 'border-[color:var(--accent-500)]/25 bg-[color:var(--accent-500)]/5 text-[color:var(--info-500)]',
    icon: 'text-[color:var(--accent-500)]',
    value: 'text-[color:var(--text-primary)]',
  },
  success: {
    chip: 'border-[color:var(--success-500)]/25 bg-[color:var(--success-500)]/5 text-[color:var(--success-500)]',
    icon: 'text-[color:var(--success-500)]',
    value: 'text-[color:var(--success-500)]',
  },
  neutral: {
    chip: 'border-[color:var(--border-default)] bg-[color:var(--bg-surface-1)] text-[color:var(--text-secondary)]',
    icon: 'text-[color:var(--text-muted)]',
    value: 'text-[color:var(--text-primary)]',
  },
};

const integrationSections = [
  {
    id: 'finteza',
    title: 'Finteza Analytics',
    logo: serviceLogos.finteza,
    statuses: [
      { label: 'Not Activated', icon: XCircle, tone: 'danger' },
      { label: 'MasterSite ID:', value: 'not specified', icon: Info, tone: 'info', valueTone: 'danger' },
      { label: 'Data:', value: 'no export', icon: Info, tone: 'info', valueTone: 'danger' },
    ],
    description: 'Use end-to-end brokerage analytics for RTX5.',
    linkText: 'More about the service',
  },
  {
    id: 'vps',
    title: 'Sponsored VPS',
    logo: serviceLogos.vps,
    statuses: [
      { label: 'Not Activated', icon: XCircle, tone: 'danger' },
      { label: 'Spent:', value: '0 USD', tone: 'neutral' },
      { label: 'Latency:', tone: 'neutral' },
    ],
    description: 'Offer your traders free virtual hosting for round-the-clock trading.',
    linkText: 'More about the service',
  },
  {
    id: 'mail',
    title: 'Mail Servers',
    logo: serviceLogos.mail,
    statuses: [
      { label: 'Used', icon: CheckCircle2, tone: 'success' },
      { label: 'Mail accounts:', value: '1', icon: AtSign, tone: 'neutral' },
      { label: 'Mail servers:', value: '1', icon: Server, tone: 'neutral' },
    ],
    description: 'Send newsletters and personal emails to your traders.',
    linkText: 'How to set up a mail server',
    activity: { successful: 51, unsuccessful: 510 },
  },
  {
    id: 'sms',
    title: 'SMS Gateways',
    logo: serviceLogos.sms,
    statuses: [
      { label: 'Providers:', value: '1', icon: CheckCircle2, tone: 'success' },
      { label: 'Balance:', value: '11 usd', tone: 'neutral', valueTone: 'success' },
      { label: 'Spent:', value: '0 usd', tone: 'neutral', valueTone: 'success' },
      { label: 'Average Price:', value: '0.00 usd', tone: 'neutral', valueTone: 'success' },
    ],
    description: "Send automatic SMS to verify clients' contact details for newly opened accounts.",
    linkText: 'How to set up SMS verification',
    activity: { successful: 0, unsuccessful: 452 },
  },
  {
    id: 'messenger',
    title: 'Messenger Channels',
    logo: serviceLogos.messenger,
    statuses: [
      { label: 'Not configured', icon: XCircle, tone: 'danger' },
    ],
    description: 'Receive platform performance data via messenger channels.',
    linkText: (
      <span>
        <a href="#" className="hover:underline">How to set up</a>{' '}
        <a href="#" className="hover:underline">Telegram</a>,{' '}
        <a href="#" className="hover:underline">Slack</a> and{' '}
        <a href="#" className="hover:underline">Teams</a>
      </span>
    ),
    activity: { successful: 0, unsuccessful: 0 },
  },
  {
    id: 'kyc',
    title: 'KYC Checks',
    logo: serviceLogos.kyc,
    statuses: [
      { label: 'Not configured', icon: XCircle, tone: 'danger' },
      { label: 'Countries:', value: '0', tone: 'neutral' },
      { label: 'Groups:', value: '0', tone: 'neutral' },
      { label: 'Accounts checked:', value: '0', tone: 'neutral' },
    ],
    description: 'Automatically check documents when opening live accounts.',
    linkText: 'How to set up KYC checks',
  },
];

const statusTotals = integrationSections.reduce(
  (totals, item) => {
    const primaryTone = item.statuses[0]?.tone;

    if (primaryTone === 'success') {
      totals.active += 1;
    } else {
      totals.attention += 1;
    }

    return totals;
  },
  { active: 0, attention: 0 }
);

const getTone = (tone = 'neutral') => toneClasses[tone] || toneClasses.neutral;

const serviceIcons = { analytics: BarChart3, server: Server, mail: Mail, message: MessageSquare, chat: MessagesSquare, shield: ShieldCheck };

const ServiceLogo = ({ logo }) => {
  const Icon = serviceIcons[logo.variant];
  return <div aria-hidden="true" className="integration-service-icon"><Icon size={20} strokeWidth={1.6} /></div>;
};

const StatusChip = ({ status }) => {
  const tone = getTone(status.tone);
  const Icon = status.icon;
  const valueTone = status.valueTone ? getTone(status.valueTone) : tone;

  return (
    <span className={`inline-flex h-[22px] max-w-full items-center gap-1.5 rounded-md border px-2 text-[11px] leading-none ${tone.chip}`}>
      {Icon && <Icon size={12} className={`${tone.icon} shrink-0`} />}
      <span className="truncate">{status.label}</span>
      {status.value && <span className={`${valueTone.value} truncate font-medium`}>{status.value}</span>}
    </span>
  );
};

const ActivityMeter = ({ activity }) => {
  if (!activity) {
    return (
      <div className="flex h-full min-h-[54px] items-center text-[11px] text-[color:var(--text-muted)]">
        No activity
      </div>
    );
  }

  const maximum = Math.max(activity.successful, activity.unsuccessful, 1);
  const successWidth = `${Math.max((activity.successful / maximum) * 100, activity.successful > 0 ? 6 : 0)}%`;
  const failedWidth = `${Math.max((activity.unsuccessful / maximum) * 100, activity.unsuccessful > 0 ? 6 : 0)}%`;

  return (
    <div className="grid gap-2 py-1.5">
      <div className="grid grid-cols-[88px_1fr_52px] items-center gap-2">
        <span className="text-[10.5px] text-[color:var(--text-muted)]">Successful</span>
        <div className="h-[7px] overflow-hidden rounded-[2px] border border-[color:var(--accent-500)]/40 bg-[color:var(--bg-surface-2)]">
          <div className="h-full bg-[color:var(--accent-500)]" style={{ width: successWidth }} />
        </div>
        <span className="text-right font-mono text-[10.5px] text-[color:var(--text-primary)]">{activity.successful}</span>
      </div>
      <div className="grid grid-cols-[88px_1fr_52px] items-center gap-2">
        <span className="text-[10.5px] text-[color:var(--text-muted)]">Unsuccessful</span>
        <div className="h-[7px] overflow-hidden rounded-[2px] border border-[color:var(--danger-500)]/40 bg-[color:var(--bg-surface-2)]">
          <div className="h-full bg-[color:var(--danger-500)]" style={{ width: failedWidth }} />
        </div>
        <span className="text-right font-mono text-[10.5px] text-[color:var(--text-primary)]">{activity.unsuccessful}</span>
      </div>
    </div>
  );
};

const ServiceLink = ({ linkText }) => {
  if (typeof linkText !== 'string') {
    return <div className="text-[11.5px] text-[color:var(--accent-500)]">{linkText}</div>;
  }

  return (
    <a href="#" className="inline-flex w-max items-center gap-1 text-[11.5px] text-[color:var(--accent-500)] hover:text-blue-300 hover:underline">
      {linkText}
      <ExternalLink size={11} />
    </a>
  );
};

const IntegrationRow = ({ item }) => {
  return (
    <div className="integration-row grid grid-cols-[minmax(420px,1fr)_minmax(300px,420px)]">
      <div className="min-w-0 px-4 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <ServiceLogo logo={item.logo} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="truncate text-[14px] font-semibold text-[color:var(--text-primary)]">{item.title}</h3>
              <div className="flex w-full min-w-0 flex-wrap gap-1.5">
                {item.statuses.map((status) => (
                  <StatusChip key={`${item.id}-${status.label}-${status.value || ''}`} status={status} />
                ))}
              </div>
            </div>
            <p className="mt-2 max-w-[760px] text-[11.5px] leading-5 text-[color:var(--text-secondary)]">
              {item.description}
            </p>
            <div className="mt-1">
              <ServiceLink linkText={item.linkText} />
            </div>
          </div>
        </div>
      </div>

      <div className="integration-activity min-w-0 px-4 py-4">
        <ActivityMeter activity={item.activity} />
      </div>
    </div>
  );
};

const IntegrationsView = () => {
  return (
    <section aria-labelledby="integrations-title" className="integrations-view flex-1 min-h-0 overflow-auto text-[color:var(--text-primary)]">
      <header className="integrations-header">
        <div className="flex min-w-0 items-center gap-3">
          <Network size={20} className="text-[color:var(--text-muted)] shrink-0" />
          <div>
            <h1 id="integrations-title" className="font-semibold text-[color:var(--text-primary)]">Integrations</h1>
            <p className="mt-1 text-[11.5px] text-[color:var(--text-muted)]">Manage connected services and monitor activity.</p>
          </div>
        </div>
        <dl className="integration-summary">
          <div><dt>Services</dt><dd>{integrationSections.length}</dd></div>
          <div><dt>Active</dt><dd className="text-[color:var(--success-500)]">{statusTotals.active}</dd></div>
          <div><dt>Needs setup</dt><dd className="text-[color:var(--warning-500)]">{statusTotals.attention}</dd></div>
        </dl>
      </header>
      <div className="p-4">
        <div className="integration-table overflow-hidden">
          <div className="integration-columns grid h-9 grid-cols-[minmax(420px,1fr)_minmax(300px,420px)] text-[11px] font-medium text-[color:var(--text-muted)]">
            <div className="flex items-center px-4">Service</div>
            <div className="flex items-center px-4">Recent activity</div>
          </div>
          {integrationSections.map((item) => (
            <IntegrationRow key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default IntegrationsView;
