import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Mail,
  MessageSquare,
  MessagesSquare,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { StatusDot } from '../ui/Badge';
import './IntegrationsView.css';

const serviceIcons = {
  analytics: BarChart3,
  server: Server,
  mail: Mail,
  message: MessageSquare,
  chat: MessagesSquare,
  shield: ShieldCheck,
};

const integrationSections = [
  {
    id: 'finteza',
    title: 'Finteza Analytics',
    category: 'Analytics',
    icon: 'analytics',
    state: 'attention',
    statusLabel: 'Setup required',
    description: 'Use end-to-end brokerage analytics for RTX5.',
    metrics: [
      { label: 'MasterSite ID', value: 'Not specified', muted: true },
      { label: 'Data export', value: 'Not configured', muted: true },
    ],
    linkText: 'More about the service',
  },
  {
    id: 'vps',
    title: 'Sponsored VPS',
    category: 'Infrastructure',
    icon: 'server',
    state: 'attention',
    statusLabel: 'Setup required',
    description: 'Offer your traders free virtual hosting for round-the-clock trading.',
    metrics: [
      { label: 'Spent', value: '0 USD' },
      { label: 'Latency', value: 'Not available', muted: true },
    ],
    linkText: 'More about the service',
  },
  {
    id: 'mail',
    title: 'Mail Servers',
    category: 'Communication',
    icon: 'mail',
    state: 'active',
    statusLabel: 'Connected',
    description: 'Send newsletters and personal emails to your traders.',
    metrics: [
      { label: 'Mail accounts', value: '1' },
      { label: 'Mail servers', value: '1' },
    ],
    linkText: 'How to set up a mail server',
    activity: { successful: 51, unsuccessful: 510 },
  },
  {
    id: 'sms',
    title: 'SMS Gateways',
    category: 'Communication',
    icon: 'message',
    state: 'active',
    statusLabel: 'Connected',
    description: "Send automatic SMS to verify clients' contact details for newly opened accounts.",
    metrics: [
      { label: 'Providers', value: '1' },
      { label: 'Balance', value: '11 USD' },
      { label: 'Spent', value: '0 USD' },
      { label: 'Average price', value: '0.00 USD' },
    ],
    linkText: 'How to set up SMS verification',
    activity: { successful: 0, unsuccessful: 452 },
  },
  {
    id: 'messenger',
    title: 'Messenger Channels',
    category: 'Notifications',
    icon: 'chat',
    state: 'attention',
    statusLabel: 'Setup required',
    description: 'Receive platform performance data via messenger channels.',
    metrics: [
      { label: 'Channels', value: 'Telegram, Slack, Teams' },
    ],
    linkText: 'How to set up messenger channels',
    activity: { successful: 0, unsuccessful: 0 },
  },
  {
    id: 'kyc',
    title: 'KYC Checks',
    category: 'Compliance',
    icon: 'shield',
    state: 'attention',
    statusLabel: 'Setup required',
    description: 'Automatically check documents when opening live accounts.',
    metrics: [
      { label: 'Countries', value: '0' },
      { label: 'Groups', value: '0' },
      { label: 'Accounts checked', value: '0' },
    ],
    linkText: 'How to set up KYC checks',
  },
];

const statusTotals = integrationSections.reduce(
  (totals, item) => {
    if (item.state === 'active') totals.active += 1;
    else totals.attention += 1;
    return totals;
  },
  { active: 0, attention: 0 }
);

const filters = [
  { id: 'all', label: 'All services', count: integrationSections.length },
  { id: 'active', label: 'Connected', count: statusTotals.active },
  { id: 'attention', label: 'Needs setup', count: statusTotals.attention },
];

const ServiceLogo = ({ icon }) => {
  const Icon = serviceIcons[icon];

  return (
    <div className="integration-service-icon" aria-hidden="true">
      <Icon size={18} strokeWidth={1.6} />
    </div>
  );
};

const StatusBadge = ({ state, label }) => {
  const tone = state === 'active' ? 'success' : 'warning';

  return (
    <span className={`integration-status integration-status--${state}`}>
      <StatusDot tone={tone} />
      {label}
    </span>
  );
};

const ActivityMeter = ({ activity, isConfigured }) => {
  const successful = activity?.successful ?? 0;
  const unsuccessful = activity?.unsuccessful ?? 0;
  const total = successful + unsuccessful;

  if (!total) {
    return (
      <div className="integration-activity integration-activity--empty">
        <Activity size={14} strokeWidth={1.6} aria-hidden="true" />
        <span>{isConfigured ? 'No activity recorded' : 'Activity begins after setup'}</span>
      </div>
    );
  }

  const successWidth = (successful / total) * 100;
  const successRate = Math.round(successWidth);

  return (
    <div className="integration-activity">
      <div className="integration-activity-heading">
        <span>Recent activity</span>
        <strong>{successRate}% success</strong>
      </div>
      <div
        className="integration-activity-bar"
        role="img"
        aria-label={`${successful} successful and ${unsuccessful} unsuccessful events`}
      >
        {successful > 0 && (
          <span className="integration-activity-bar-success" style={{ width: `${successWidth}%` }} />
        )}
      </div>
      <div className="integration-activity-legend">
        <span><i className="integration-legend-dot integration-legend-dot--success" />Successful <b>{successful.toLocaleString()}</b></span>
        <span><i className="integration-legend-dot integration-legend-dot--failure" />Failed <b>{unsuccessful.toLocaleString()}</b></span>
      </div>
    </div>
  );
};

const ServiceLink = ({ linkText }) => (
  <a href="#" className="integration-service-link">
    <span>{linkText}</span>
    <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden="true" />
  </a>
);

const IntegrationCard = ({ item }) => (
  <article className={`integration-card integration-card--${item.state}`}>
    <div className="integration-card-header">
      <div className="integration-card-identity">
        <ServiceLogo icon={item.icon} />
        <div className="integration-card-title-wrap">
          <h3>{item.title}</h3>
          <span className="integration-card-category">{item.category}</span>
        </div>
      </div>
      <StatusBadge state={item.state} label={item.statusLabel} />
    </div>

    <p className="integration-card-description">{item.description}</p>

    <dl className="integration-metrics">
      {item.metrics.map((metric) => (
        <div key={`${item.id}-${metric.label}`}>
          <dt>{metric.label}</dt>
          <dd className={metric.muted ? 'is-muted' : undefined}>{metric.value}</dd>
        </div>
      ))}
    </dl>

    <ActivityMeter activity={item.activity} isConfigured={item.state === 'active'} />

    <footer className="integration-card-footer">
      <ServiceLink linkText={item.linkText} />
    </footer>
  </article>
);

const SummaryStat = ({ label, value, tone }) => (
  <div className="integration-summary-stat" data-tone={tone}>
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>
);

const IntegrationsView = () => {
  const [activeFilter, setActiveFilter] = useState('all');
  const visibleSections = useMemo(() => (
    activeFilter === 'all'
      ? integrationSections
      : integrationSections.filter((item) => item.state === activeFilter)
  ), [activeFilter]);

  return (
    <section aria-labelledby="integrations-title" className="integrations-view">
      <header className="integrations-header">
        <div className="integrations-header-inner">
          <div className="integrations-heading">
            <h1 id="integrations-title">Integrations</h1>
            <p>Connect essential services and monitor their operational health.</p>
          </div>

          <dl className="integration-summary" aria-label="Integration overview">
            <SummaryStat label="Total services" value={integrationSections.length} tone="neutral" />
            <SummaryStat label="Connected" value={statusTotals.active} tone="success" />
            <SummaryStat label="Setup required" value={statusTotals.attention} tone="warning" />
          </dl>
        </div>
      </header>

      <div className="integrations-content">
        <div className="integrations-toolbar">
          <div>
            <h2>Service catalog</h2>
            <p>Review configuration and delivery activity across your workspace.</p>
          </div>
          <div className="integration-filters" role="group" aria-label="Filter integrations">
            {filters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={activeFilter === filter.id ? 'is-active' : undefined}
                aria-pressed={activeFilter === filter.id}
                onClick={() => setActiveFilter(filter.id)}
              >
                {filter.label}
                <span>{filter.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="integration-grid" aria-live="polite">
          {visibleSections.map((item) => (
            <IntegrationCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default IntegrationsView;
