/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { 
  Server, 
  Cloud, 
  Shield, 
  Clock, 
  Calendar, 
  Network, 
  Settings, 
  Settings2,
  Activity, 
  Database, 
  ShieldCheck, 
  Bell, 
  Globe, 
  Cpu, 
  Mail, 
  MessageSquare, 
  CreditCard, 
  UserCheck,
  Zap,
  Layout,
  BarChart,
  HardDrive,
  Link,
  LifeBuoy,
  ShoppingBag,
  TrendingUp,
  LineChart,
  Mailbox,
  RotateCcw,
  Hash,
  Users,
  Layers,
  Briefcase,
  IdCard,
  Wallet,
  ArrowLeftRight,
  Newspaper,
  FileText,
  Monitor,
  Award,
  Headset,
  Search,
  BarChart2,
  PieChart,
  TrendingDown,
  Download,
  Rss
} from 'lucide-react';

const BlueBookRedBookmarkIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
    <path d="M14 2v7l-2-2-2 2V2" fill="var(--danger-500)" stroke="var(--danger-500)"/>
  </svg>
);

const ApiIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" {...props}>
    <text x="0" y="16" fill="#ffffff" fontSize="11px" fontWeight="bold" fontFamily="sans-serif">API</text>
  </svg>
);

const OrangeNewsIcon = (props) => <Newspaper stroke="#d97706" {...props} />;
const BlueArticlesIcon = (props) => <FileText stroke="#3b82f6" {...props} />;
const BlueUsersIcon = (props) => <Users stroke="#3b82f6" {...props} />;
const BlueCloudIcon = (props) => <Cloud stroke="#3b82f6" {...props} />;
const BlueMonitorIcon = (props) => <Monitor stroke="#3b82f6" {...props} />;
const GreenAwardIcon = (props) => <Award stroke="var(--success-500)" {...props} />;
const BlueHeadsetIcon = (props) => <Headset stroke="#3b82f6" {...props} />;
const BlueMessageIcon = (props) => <MessageSquare stroke="#3b82f6" {...props} />;
const BlueSearchIcon = (props) => <Search stroke="#3b82f6" {...props} />;

// Custom icons for MT5 style
const YellowFolderIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#E8B339" stroke="#B38600" strokeWidth="1" {...props}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const BlueLayersIcon = (props) => <Layers stroke="#3b82f6" size={14} {...props} />;
const BlueClientIcon = (props) => <IdCard stroke="#3b82f6" size={14} {...props} />;
const BlueManagerIcon = (props) => <Briefcase stroke="#3b82f6" size={14} {...props} />;
const BlueAccountsIcon = (props) => <Wallet stroke="#3b82f6" size={14} {...props} />;
const BlueLinkIcon = (props) => <Link stroke="#3b82f6" size={14} {...props} />;
const BlueOrdersIcon = (props) => <FileText stroke="#3b82f6" size={14} {...props} />;
const BluePositionsIcon = (props) => <Activity stroke="#3b82f6" size={14} {...props} />;
const BlueDealsIcon = (props) => <ArrowLeftRight stroke="#3b82f6" size={14} {...props} />;

const GreenHexagonIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#238d3cff" strokeWidth="1.5" {...props}>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <path d="M12 22V12" /><path d="M12 12l8.5-5" /><path d="M12 12L3.5 7" />
  </svg>
);

const GreenServerIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success-500)" strokeWidth="1.5" {...props}>
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
    <line x1="6" y1="6" x2="6.01" y2="6"/><line x1="10" y1="6" x2="18" y2="6"/>
    <line x1="6" y1="18" x2="6.01" y2="18"/><line x1="10" y1="18" x2="18" y2="18"/>
  </svg>
);

const GreenDatabaseIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success-500)" strokeWidth="1.5" {...props}>
    <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12" />
  </svg>
);

const RedDatabaseIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--danger-500)" strokeWidth="1.5" {...props}>
    <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12" />
  </svg>
);

const GreenCandlesIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success-500)" strokeWidth="1.5" {...props}>
    <line x1="9" y1="2" x2="9" y2="22"/><rect x="6" y="6" width="6" height="10"/>
    <line x1="17" y1="2" x2="17" y2="22"/><rect x="14" y="10" width="6" height="8"/>
  </svg>
);

const GreenShieldIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success-500)" strokeWidth="1.5" {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <circle cx="12" cy="10" r="2" stroke="#F2711C"/>
    <path d="M9 16c0-1.66 1.34-3 3-3s3 1.34 3 3" stroke="#F2711C"/>
  </svg>
);

const GreenGearPlayIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
    <polygon points="10 9 15 12 10 15 10 9" />
  </svg>
);

const GrayFolderIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#808080" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const GreenShieldOutlineIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const GreenShieldSolidIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--success-500)" stroke="var(--success-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const GreenLockIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

export const sidebarData = [
  { label: 'Dashboard', icon: Layout },
  {
    label: "Servers",
    icon: Server,
    initiallyExpanded: true,
    children: [
      {
        label: "Server Configuration",
        icon: Settings,
        initiallyExpanded: true,
        children: [
          { label: "Server Config", icon: Activity },
        ]
      },
    ]
  },
  {
    label: "Administrator",
    icon: UserCheck,
    initiallyExpanded: true,
    children: [
      {
        label: "RTX5 Server",
            icon: Cpu,
            initiallyExpanded: true,
            active: true,
            children: [
              { 
                label: "Network Cluster", 
                icon: GreenHexagonIcon,
                initiallyExpanded: true,
                children: [
                   {
                     label: "Main Trade Server",
                     icon: GreenServerIcon,
                     initiallyExpanded: true,
                     children: [
                       { label: "MainTrade Backup Server", icon: GreenDatabaseIcon },
                       { label: "Local Main Status Server", icon: GreenDatabaseIcon },
                       { label: "TradeProcessor SQL_E", icon: RedDatabaseIcon },
                     ]
                   },
                   {
                     label: "History Server",
                     icon: GreenCandlesIcon,
                     initiallyExpanded: true,
                     children: [
                       { label: "History Backup Server", icon: GreenDatabaseIcon }
                     ]
                   },
                    { label: "Access Server", icon: GreenShieldIcon }
                ]
              },
              { label: "Integrations", icon: Network },
              { 
                label: "Automations", 
                icon: GreenGearPlayIcon,
                initiallyExpanded: true,
                children: [
                  { label: "Server Performance", icon: GrayFolderIcon },
                  { label: "Marketing", icon: GrayFolderIcon },
                  { label: "Trading", icon: GrayFolderIcon },
                  { label: "Security Audit", icon: GrayFolderIcon },
                  { label: "Configuration", icon: GrayFolderIcon }
                ]
              },
              {
                label: "Security",
                icon: GreenShieldOutlineIcon,
                initiallyExpanded: true,
                children: [
                  { label: "Certificates", icon: GreenLockIcon },
                  { label: "Firewall", icon: GreenShieldSolidIcon },
                  { label: "Anti DDoS Protection", icon: GreenShieldOutlineIcon },
                  { label: "IP Restrictions", icon: GreenShieldSolidIcon },
                  { label: "Connection Throttle", icon: GreenShieldOutlineIcon },
                  { label: "Log Management", icon: GreenLockIcon },
                  { label: "Backup Schedules", icon: GreenLockIcon },
                  { label: "Plugin Management", icon: GreenShieldOutlineIcon },
                ]
              },
              {
                label: "Platform Config",
                icon: Settings,
                initiallyExpanded: false,
                children: [
                  { label: "Custom Fields", icon: FileText },
                  { label: "Feature Flags", icon: Zap },
                  { label: "Symbol Visibility", icon: Monitor },
                  { label: "Trading Terminal Config", icon: Activity },
                ]
              },
              { label: "Time", icon: Clock },
              { label: "Holidays", icon: Calendar },
              { label: "Session Overrides", icon: Clock },
              { label: "Leverages", icon: Hash },
              { label: "LP Routing", icon: Network },
              { label: "Leverage Schedules", icon: Hash },
              { label: "Swap-Free Configs", icon: Settings },
              { 
                label: "Groups", 
                icon: YellowFolderIcon,
                initiallyExpanded: false,
                active: true,
                children: []
              },
              { 
                label: "Clients & Accounts", 
                icon: UserCheck,
                initiallyExpanded: true,
                children: [
                   { label: "Allocations", icon: BlueLayersIcon },
                   { label: "Clients", icon: BlueClientIcon },
                   { label: "Managers", icon: BlueManagerIcon },
                   { label: "Trading Accounts", icon: BlueAccountsIcon },
                   { label: "Corporate links", icon: BlueLinkIcon },
                ]
              },
              {
                label: "Orders & Deals",
                icon: Layout,
                initiallyExpanded: true,
                children: [
                   { label: "Orders", icon: BlueOrdersIcon },
                   { label: "Positions", icon: BluePositionsIcon },
                   { label: "Deals", icon: BlueDealsIcon },
                ]
              },
              {
                label: "Risk Management",
                icon: ShieldCheck,
                initiallyExpanded: false,
                children: [
                  { label: "Exposure", icon: Activity },
                  { label: "Risk Events", icon: Bell },
                  { label: "Risk Limits", icon: TrendingUp },
                  { label: "Suspicious Activity", icon: Search },
                  { label: "Risk Reports", icon: BarChart },
                ]
              },
              {
                label: "Analytics",
                icon: BarChart2,
                initiallyExpanded: false,
                children: [
                  { label: "Client Analytics", icon: PieChart },
                  { label: "Trading Analytics", icon: Activity },
                  { label: "Trader Rankings", icon: TrendingDown },
                  { label: "Revenue Forecast", icon: TrendingUp },
                  { label: "Data Exports", icon: Download },
                  { label: "Regulatory Reports", icon: FileText },
                  { label: "Complaints", icon: MessageSquare },
                ]
              },
              {
                label: "Communications",
                icon: MessageSquare,
                initiallyExpanded: false,
                children: [
                  { label: "Auto Notification Rules", icon: Bell },
                  { label: "Email Campaigns", icon: Mail },
                  { label: "Message Center", icon: MessageSquare },
                  { label: "Push Notifications", icon: Bell },
                  { label: "SMS", icon: Zap },
                ]
              },
              {
                label: "Payments",
                icon: CreditCard,
                children: [
                  { label: "Providers", icon: Globe },
                  { label: "Payment Methods", icon: CreditCard },
                  { label: "Deposits", icon: TrendingUp },
                  { label: "Withdrawals", icon: TrendingDown },
                  { label: "Transaction History", icon: Activity },
                  { label: "Payment Gateways", icon: Link },
                  { label: "Reconciliation", icon: RotateCcw },
                  { label: "Chargebacks", icon: Shield },
                ]
              },
              { label: "Gateways", icon: Link },
              { label: "Downstream access", icon: Network },
              { label: "Feed Tenants", icon: Rss },
              { label: "Utency Matching Engine", icon: Zap },
              { label: "Data Feeds", icon: Activity },
              { label: "Plugins", icon: HardDrive },
              { label: "Reports", icon: BarChart },
              { label: "FCN", icon: Globe },
              { label: "Routing", icon: TrendingUp },
              { label: "Funds & ETF", icon: Database },
              { 
                label: "Support Center", 
                icon: LifeBuoy,
                initiallyExpanded: true,
                children: [
                  { label: "News", icon: OrangeNewsIcon },
                  { label: "Articles", icon: BlueArticlesIcon },
                  { label: "Orrnn Leads", icon: BlueUsersIcon },
                  { label: "Automation", icon: GreenGearPlayIcon },
                  { label: "Sponsored VPS", icon: BlueCloudIcon },
                  { label: "Platform Documentation", icon: BlueBookRedBookmarkIcon },
                  { label: "API Documentation", icon: ApiIcon },
                  { label: "Workshops", icon: BlueMonitorIcon },
                  { label: "Certification", icon: GreenAwardIcon },
                  { label: "Service Desk", icon: BlueHeadsetIcon },
                  { label: "Online Assistant", icon: BlueMessageIcon },
                  { label: "Search", icon: BlueSearchIcon }
                ]
              },
              {
                label: "Market Overview",
                icon: TrendingUp,
                navigationOnly: true,
                initiallyExpanded: true,
                children: [
                  { label: "Symbols Browser", icon: BarChart2 },
                  { label: "Symbol Management", icon: Settings2 },
                ]
              },
              { label: "Symbols", icon: Hash },
              { label: "Market Depth", icon: Database },
              { label: "Spreads", icon: Activity },
              { label: "Charts & Ticks", icon: LineChart },
              { label: "Subscriptions", icon: Bell },
              { label: "Mailbox", icon: Mailbox },
              { label: "Live Update", icon: RotateCcw },
            ]
          }
        ]
      }
];

export const terminalTableData = [
  { id: 1, group: "ACH", server: "Main Trade Server", company: "Flexy Markets Limited", type: "Hedged", auth: "Normal", risk: "Retail Forex", margin: "50 / 30 %", leverage: "Crypto", currency: "USD", iconType: 'group' },
  { id: 2, group: "Demo", server: "Main Trade Server", company: "Flexy Markets Limited", type: "Hedged", auth: "Normal", risk: "Retail Forex", margin: "50 / 30 %", leverage: "Crypto", currency: "USD", iconType: 'group' },
  { id: 3, group: "Dev", server: "Main Trade Server", company: "Flexy Markets Limited", type: "Netting", auth: "Normal", risk: "Retail Forex", margin: "50 / 30 %", leverage: "Crypto", currency: "USD", iconType: 'group' },
  { id: 4, group: "Equiti", server: "Main Trade Server", company: "Flexy Markets Limited", type: "Netting", auth: "Normal", risk: "Retail Forex", margin: "50 / 30 %", leverage: "Crypto", currency: "USD", iconType: 'group' },
  { id: 5, group: "FYNEX", server: "Main Trade Server", company: "Flexy Markets Limited", type: "Netting", auth: "Normal", risk: "Retail Forex", margin: "50 / 30 %", leverage: "Crypto", currency: "USD", iconType: 'group' },
  { id: 6, group: "Flexy", server: "Main Trade Server", company: "Flexy Markets Limited", type: "Netting", auth: "Normal", risk: "Retail Forex", margin: "50 / 30 %", leverage: "Crypto", currency: "USD", iconType: 'group' },
  { id: 7, group: "FlexyA", server: "Main Trade Server", company: "Flexy Markets Limited", type: "Netting", auth: "Normal", risk: "Retail Forex", margin: "50 / 30 %", leverage: "Crypto", currency: "USD", iconType: 'group' },
  { id: 8, group: "FlexyB", server: "Main Trade Server", company: "Flexy Markets Limited", type: "Netting", auth: "Normal", risk: "Retail Forex", margin: "50 / 30 %", leverage: "Crypto", currency: "USD", iconType: 'group' },
  { id: 9, group: "Flexy/STP/STD", server: "Main Trade Server", company: "Flexy Markets Limited", type: "Hedged", auth: "Normal", risk: "Retail Forex", margin: "50 / 30 %", leverage: "Crypto", currency: "USD", iconType: 'user' },
  { id: 10, group: "preliminary", server: "Main Trade Server", company: "Flexy Markets Limited", type: "Hedged", auth: "Normal", risk: "Retail Forex", margin: "50 / 30 %", leverage: "Crypto", currency: "USD", iconType: 'user' },
  { id: 11, group: "YOFXM", server: "Main Trade Server", company: "Flexy Markets Limited", type: "Netting", auth: "Normal", risk: "Retail Forex", margin: "50 / 30 %", leverage: "Crypto", currency: "USD", iconType: 'user' },
  { id: 12, group: "Dev", server: "Main Trade Server", company: "Flexy Markets Limited", type: "Netting", auth: "Normal", risk: "Retail Forex", margin: "50 / 30 %", leverage: "Crypto", currency: "USD", iconType: 'user' },
];

export const clientsAccountsTableData = [
  { id: 1, name: "Allocations", description: "Manage groups in which clients are able to open demo accounts via terminals", iconType: 'group' },
  { id: 2, name: "Clients", description: "Manage client data on the server: contacts, documents, client and trading status", iconType: 'user' },
  { id: 3, name: "Managers", description: "Configure manager's rights", iconType: 'user' },
  { id: 4, name: "Trading Accounts", description: "Manage accounts on the server: trading status, personal data, trading settings and security", iconType: 'user' },
  { id: 5, name: "Corporate links", description: "Corporate links", iconType: 'user' },
];

export const symbolsTableData = [
  { id: 1, symbol: "Trading", description: "", digits: "", type: "", execution: "", expiration: "", background: "" },
  { id: 2, symbol: "TradingFL", description: "", digits: "", type: "", execution: "", expiration: "", background: "" },
  { id: 3, symbol: "PMTrade", description: "", digits: "", type: "", execution: "", expiration: "", background: "" },
  { id: 4, symbol: "ACH", description: "", digits: "", type: "", execution: "", expiration: "", background: "" },
  { id: 5, symbol: "HFT", description: "", digits: "", type: "", execution: "", expiration: "", background: "" },
  { id: 6, symbol: "Cent", description: "", digits: "", type: "", execution: "", expiration: "", background: "" },
  { id: 7, symbol: "TradingA", description: "", digits: "", type: "", execution: "", expiration: "", background: "" },
  { id: 8, symbol: "TradeS", description: "", digits: "", type: "", execution: "", expiration: "", background: "" },
];

export const managersTableData = [
  { id: 1, login: "900546", name: "Propfirm", groups: "demo\\Propfirm", status: "Active" },
  { id: 2, login: "123456", name: "John Doe", groups: "Demo\\admin", status: "Active" },
  { id: 3, login: "789012", name: "Jane Smith", groups: "demo\\managers", status: "Inactive" }
];

export const paymentsTableData = [
  { id: 1, name: "Providers", description: "Select the required payment providers for your traders and activate them", iconType: 'group' },
  { id: 2, name: "Active", description: "Manage active payments and integrations", iconType: 'user' },
  { id: 3, name: "History", description: "View the history of all payment transactions", iconType: 'user' },
  { id: 4, name: "Accounts", description: "Manage internal accounts connected to payment gateways", iconType: 'user' },
  { id: 5, name: "Wallets", description: "Client digital wallets administration", iconType: 'user' },
  { id: 6, name: "Deposit Rules", description: "Configure custom deposit rules and limits", iconType: 'user' },
  { id: 7, name: "Withdrawal Rules", description: "Configure custom withdrawal rules and limits", iconType: 'user' },
];

export const automationsTableData = [
  { id: 1, name: "Server Performance", description: "Automated scripts for monitoring server resources", iconType: 'group' },
  { id: 2, name: "Marketing", description: "Campaign and newsletter automation rules", iconType: 'group' },
  { id: 3, name: "Trading", description: "Robots, expert advisors, and algorithmic parameters", iconType: 'group' },
  { id: 4, name: "Security Audit", description: "Daily checks and automatic IP ban lists", iconType: 'group' },
  { id: 5, name: "Configuration", description: "Platform configuration synchronization and backup scripts", iconType: 'group' }
];

export const securityTableData = [
  { id: 1, name: "Certificates", description: "Manage SSL/TLS certificates for encrypted server connections", iconType: 'group' },
  { id: 2, name: "Firewall", description: "Configure IP whitelists, blocklists, and network filtering rules", iconType: 'group' },
  { id: 3, name: "Anti DDoS Protection", description: "Settings and thresholds for distributed denial of service mitigation", iconType: 'group' }
];
