import {
  AtSign,
  BarChart3,
  CheckCircle2,
  Cloud,
  ExternalLink,
  Info,
  MessageSquare,
  Server,
  ShieldCheck,
  Smartphone,
  XCircle,
} from 'lucide-react';

const toneClasses = {
  danger: {
    chip: 'border-[#ef4444]/30 bg-[#ef4444]/5 text-[#f87171]',
    icon: 'text-[#ef4444]',
    value: 'text-[#fca5a5]',
  },
  info: {
    chip: 'border-[#3b82f6]/25 bg-[#3b82f6]/5 text-[#60a5fa]',
    icon: 'text-[#3b82f6]',
    value: 'text-[color:var(--text-primary)]',
  },
  success: {
    chip: 'border-[#22c55e]/25 bg-[#22c55e]/5 text-[#4ade80]',
    icon: 'text-[#22c55e]',
    value: 'text-[#4ade80]',
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
    icon: BarChart3,
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
    icon: Cloud,
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
    icon: AtSign,
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
    icon: Smartphone,
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
    icon: MessageSquare,
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
    icon: ShieldCheck,
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

const StatusChip = ({ status }) => {
  const tone = getTone(status.tone);
  const Icon = status.icon;
  const valueTone = status.valueTone ? getTone(status.valueTone) : tone;

  return (
    <span className={`inline-flex h-[22px] max-w-full items-center gap-1.5 rounded-[2px] border px-2 text-[11px] leading-none ${tone.chip}`}>
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
        <div className="h-[7px] overflow-hidden rounded-[2px] border border-[#3b82f6]/40 bg-[color:var(--bg-surface-2)]">
          <div className="h-full bg-[#3b82f6]" style={{ width: successWidth }} />
        </div>
        <span className="text-right font-mono text-[10.5px] text-[color:var(--text-primary)]">{activity.successful}</span>
      </div>
      <div className="grid grid-cols-[88px_1fr_52px] items-center gap-2">
        <span className="text-[10.5px] text-[color:var(--text-muted)]">Unsuccessful</span>
        <div className="h-[7px] overflow-hidden rounded-[2px] border border-[#ef4444]/40 bg-[color:var(--bg-surface-2)]">
          <div className="h-full bg-[#ef4444]" style={{ width: failedWidth }} />
        </div>
        <span className="text-right font-mono text-[10.5px] text-[color:var(--text-primary)]">{activity.unsuccessful}</span>
      </div>
    </div>
  );
};

const ServiceLink = ({ linkText }) => {
  if (typeof linkText !== 'string') {
    return <div className="text-[11.5px] text-[#3b82f6]">{linkText}</div>;
  }

  return (
    <a href="#" className="inline-flex w-max items-center gap-1 text-[11.5px] text-[#3b82f6] hover:text-blue-300 hover:underline">
      {linkText}
      <ExternalLink size={11} />
    </a>
  );
};

const IntegrationRow = ({ item, index }) => {
  const Icon = item.icon;

  return (
    <div className={`grid min-h-[92px] grid-cols-[minmax(420px,1fr)_minmax(300px,420px)] border-b border-black/25 ${index % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} last:border-b-0`}>
      <div className="min-w-0 border-r border-black/25 px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] border border-[color:var(--border-default)] bg-[color:var(--bg-surface-2)] text-[#3b82f6]">
            <Icon size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="truncate text-[14px] font-semibold text-[color:var(--text-primary)]">{item.title}</h3>
              <div className="flex min-w-0 flex-wrap gap-1.5">
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

      <div className="min-w-0 px-4 py-3">
        <ActivityMeter activity={item.activity} />
      </div>
    </div>
  );
};

const IntegrationsView = () => {
  return (
    <div className="flex-1 min-h-0 overflow-auto bg-[color:var(--bg-app)] text-[color:var(--text-primary)] no-scrollbar">
      <div className="border-b border-black/40 bg-[color:var(--bg-surface-1)] px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[20px] font-semibold tracking-tight text-[color:var(--text-primary)]">Integration</h1>
            <a href="https://www.mql5.com" className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-[#3b82f6] hover:text-blue-300 hover:underline">
              www.mql5.com
              <ExternalLink size={11} />
            </a>
          </div>
          <div className="grid min-w-[300px] grid-cols-3 overflow-hidden rounded-[2px] border border-[color:var(--border-default)] bg-[color:var(--bg-app)]">
            <div className="border-r border-black/25 px-3 py-2">
              <div className="text-[10px] uppercase text-[color:var(--text-muted)]">Services</div>
              <div className="mt-0.5 font-mono text-[13px] text-[color:var(--text-primary)]">{integrationSections.length}</div>
            </div>
            <div className="border-r border-black/25 px-3 py-2">
              <div className="text-[10px] uppercase text-[color:var(--text-muted)]">Used</div>
              <div className="mt-0.5 font-mono text-[13px] text-[#4ade80]">{statusTotals.active}</div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[10px] uppercase text-[color:var(--text-muted)]">Attention</div>
              <div className="mt-0.5 font-mono text-[13px] text-[#f87171]">{statusTotals.attention}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="min-w-[900px] overflow-hidden rounded-[2px] border border-black/40 bg-[color:var(--bg-app)]">
          <div className="grid h-[30px] grid-cols-[minmax(420px,1fr)_minmax(300px,420px)] border-b border-black/40 bg-[color:var(--bg-surface-2)] text-[11px] font-medium text-[color:var(--text-primary)]">
            <div className="flex items-center border-r border-black/25 px-4">Service</div>
            <div className="flex items-center px-4">Recent activity</div>
          </div>

          {integrationSections.map((item, index) => (
            <IntegrationRow key={item.id} item={item} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default IntegrationsView;
