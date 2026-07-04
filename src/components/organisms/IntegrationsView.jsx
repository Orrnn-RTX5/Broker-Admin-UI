import {
  AtSign,
  CheckCircle2,
  ExternalLink,
  Info,
  Server,
  XCircle,
} from 'lucide-react';

const serviceLogos = {
  finteza: {
    label: 'FZ',
    variant: 'analytics',
    background: 'linear-gradient(135deg, #0f766e 0%, #0369a1 54%, #111827 100%)',
    borderColor: 'rgba(56, 189, 248, 0.38)',
    accentColor: '#67e8f9',
    shadowColor: 'rgba(56, 189, 248, 0.22)',
  },
  vps: {
    label: 'VPS',
    variant: 'server',
    background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 45%, #0f172a 100%)',
    borderColor: 'rgba(147, 197, 253, 0.38)',
    accentColor: '#bfdbfe',
    shadowColor: 'rgba(59, 130, 246, 0.2)',
  },
  mail: {
    label: 'MAIL',
    variant: 'mail',
    background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 48%, #111827 100%)',
    borderColor: 'rgba(196, 181, 253, 0.36)',
    accentColor: '#ddd6fe',
    shadowColor: 'rgba(124, 58, 237, 0.2)',
  },
  sms: {
    label: 'SMS',
    variant: 'message',
    background: 'linear-gradient(135deg, #ea580c 0%, #f97316 46%, #111827 100%)',
    borderColor: 'rgba(253, 186, 116, 0.38)',
    accentColor: '#fed7aa',
    shadowColor: 'rgba(249, 115, 22, 0.2)',
  },
  messenger: {
    label: 'MSG',
    variant: 'chat',
    background: 'linear-gradient(135deg, #0891b2 0%, #2563eb 48%, #111827 100%)',
    borderColor: 'rgba(125, 211, 252, 0.38)',
    accentColor: '#bae6fd',
    shadowColor: 'rgba(14, 165, 233, 0.2)',
  },
  kyc: {
    label: 'KYC',
    variant: 'shield',
    background: 'linear-gradient(135deg, #15803d 0%, #16a34a 44%, #111827 100%)',
    borderColor: 'rgba(134, 239, 172, 0.36)',
    accentColor: '#bbf7d0',
    shadowColor: 'rgba(34, 197, 94, 0.18)',
  },
};

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

const ServiceLogo = ({ logo }) => {
  const sharedStyle = {
    background: logo.background,
    borderColor: logo.borderColor,
    boxShadow: `0 0 18px ${logo.shadowColor}`,
  };

  return (
    <div
      aria-hidden="true"
      className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[6px] border text-white ring-1 ring-white/10"
      style={sharedStyle}
    >
      <div className="absolute inset-x-1 top-1 h-px bg-white/35" />
      <div className="absolute -right-3 -top-3 h-7 w-7 rounded-full bg-white/20 blur-[1px]" />

      {logo.variant === 'analytics' && (
        <div className="relative flex h-6 items-end gap-[3px]">
          {[9, 14, 18, 12].map((height, index) => (
            <span
              key={`${logo.label}-${height}-${index}`}
              className="w-[4px] rounded-t-[2px] bg-white/85"
              style={{ height }}
            />
          ))}
        </div>
      )}

      {logo.variant === 'server' && (
        <div className="relative grid gap-[3px]">
          {[0, 1, 2].map((item) => (
            <span key={`${logo.label}-${item}`} className="flex h-[5px] w-6 items-center rounded-[2px] bg-white/85 px-1">
              <span className="h-[2px] w-[2px] rounded-full" style={{ backgroundColor: logo.accentColor }} />
            </span>
          ))}
        </div>
      )}

      {logo.variant === 'mail' && (
        <div className="relative h-[21px] w-7 rounded-[4px] border border-white/85 bg-white/10">
          <div className="absolute left-[5px] top-[4px] h-[12px] w-[12px] rotate-45 border-b border-r border-white/80" />
        </div>
      )}

      {logo.variant === 'message' && (
        <div className="relative flex h-6 w-7 items-center justify-center rounded-[6px] bg-white/90 text-[8px] font-bold text-[#111827]">
          {logo.label}
          <span className="absolute -bottom-[3px] left-2 h-2 w-2 rotate-45 bg-white/90" />
        </div>
      )}

      {logo.variant === 'chat' && (
        <div className="relative h-7 w-7">
          <span className="absolute left-0 top-1 h-[17px] w-[22px] rounded-[6px] bg-white/85" />
          <span className="absolute bottom-0 right-0 h-[17px] w-[22px] rounded-[6px] border border-white/80 bg-[#111827]/70" />
          <span className="absolute bottom-[7px] right-[7px] h-[3px] w-[3px] rounded-full bg-white" />
          <span className="absolute bottom-[7px] right-[12px] h-[3px] w-[3px] rounded-full bg-white" />
        </div>
      )}

      {logo.variant === 'shield' && (
        <div
          className="relative flex h-7 w-6 items-center justify-center bg-white/90"
          style={{ clipPath: 'polygon(50% 0%, 88% 15%, 80% 70%, 50% 100%, 20% 70%, 12% 15%)' }}
        >
          <span className="h-[9px] w-[14px] rotate-[-45deg] border-b-[3px] border-l-[3px] border-[#166534]" />
        </div>
      )}

      <span className="absolute bottom-1 right-1 rounded-[2px] bg-black/45 px-[3px] py-px text-[8px] font-bold leading-none text-white/95">
        {logo.label}
      </span>
    </div>
  );
};

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
  return (
    <div className={`grid min-h-[92px] grid-cols-[minmax(420px,1fr)_minmax(300px,420px)] border-b border-black/25 ${index % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} last:border-b-0`}>
      <div className="min-w-0 border-r border-black/25 px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <ServiceLogo logo={item.logo} />
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
