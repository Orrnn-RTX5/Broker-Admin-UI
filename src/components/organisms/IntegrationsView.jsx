import { useMemo, useState } from 'react';
import {
  Activity,
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
    description: 'Use end-to-end brokerage analytics.',
    metrics: [
      { label: 'MasterSite ID', value: 'Not specified', muted: true },
      { label: 'Data export', value: 'Not configured', muted: true },
    ],
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
      { label: 'Supported channels', value: 'Telegram, Slack, Teams' },
    ],
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

const connectedServices = integrationSections.filter((item) => item.state === 'active');
const setupServices = integrationSections.filter((item) => item.state === 'attention');

const getSuccessRate = ({ successful = 0, unsuccessful = 0 } = {}) => {
  const total = successful + unsuccessful;
  return total ? Math.round((successful / total) * 100) : 0;
};

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
  const successRate = getSuccessRate(activity);

  return (
    <div className="integration-activity">
      <div className="integration-activity-heading">
        <span>Recorded activity</span>
        <strong>{successRate}% success</strong>
      </div>
      <div
        className="integration-activity-bar"
        role="img"
        aria-label={`${successful} successful and ${unsuccessful} failed events`}
      >
        {successful > 0 && (
          <span className="integration-activity-bar-success" style={{ width: `${successWidth}%` }} />
        )}
        {unsuccessful > 0 && (
          <span className="integration-activity-bar-failure" style={{ width: `${100 - successWidth}%` }} />
        )}
      </div>
      <div className="integration-activity-legend">
        <span><i className="integration-legend-dot integration-legend-dot--success" />Successful <b>{successful.toLocaleString()}</b></span>
        <span><i className="integration-legend-dot integration-legend-dot--failure" />Failed <b>{unsuccessful.toLocaleString()}</b></span>
      </div>
    </div>
  );
};

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
  </article>
);

const OperationsOverview = () => (
  <section className="integration-operations" aria-label="Integration operations">
    <section className="integration-operations-panel" aria-labelledby="integration-delivery-title">
      <div className="integration-operations-heading">
        <div>
          <h2 id="integration-delivery-title">Delivery outcomes</h2>
          <p>Recorded results from connected services</p>
        </div>
        <span className="integration-operations-count">{connectedServices.length} connected</span>
      </div>
      <div className="integration-delivery-list">
        {connectedServices.map((item) => {
          const { successful = 0, unsuccessful = 0 } = item.activity ?? {};
          const successRate = getSuccessRate(item.activity);
          const hasActivity = successful + unsuccessful > 0;
          return (
            <div className="integration-delivery-row" key={item.id}>
              <span className="integration-delivery-name">{item.title}</span>
              <div
                className="integration-delivery-meter"
                role="img"
                aria-label={`${item.title}: ${successful} successful and ${unsuccessful} failed events`}
              >
                {successful > 0 && <span className="integration-delivery-success" style={{ width: `${successRate}%` }} />}
                {unsuccessful > 0 && <span className="integration-delivery-failure" style={{ width: `${100 - successRate}%` }} />}
              </div>
              <span className="integration-delivery-total">{successful} successful · {unsuccessful} failed</span>
              <strong className="integration-delivery-rate">{hasActivity ? `${successRate}%` : '—'}</strong>
            </div>
          );
        })}
      </div>
    </section>

    <section className="integration-operations-panel" aria-labelledby="integration-setup-title">
      <div className="integration-operations-heading">
        <div>
          <h2 id="integration-setup-title">Configuration required</h2>
          <p>Services awaiting setup</p>
        </div>
        <span className="integration-operations-count">{setupServices.length} services</span>
      </div>
      <div className="integration-setup-list">
        {setupServices.map((item) => (
          <div className="integration-setup-item" key={item.id}>
            <span className="integration-setup-name">{item.title}</span>
            <span className="integration-setup-category">{item.category}</span>
          </div>
        ))}
      </div>
    </section>
  </section>
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

        <OperationsOverview />
      </div>
    </section>
  );
};

export default IntegrationsView;
