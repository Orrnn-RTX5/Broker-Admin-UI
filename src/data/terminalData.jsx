import React from 'react';
import { 
  Server, 
  Cloud, 
  Shield, 
  Clock, 
  Calendar, 
  Network, 
  Settings, 
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
  Users
} from 'lucide-react';

// Custom icons for MT5 style
const YellowFolderIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#E8B339" stroke="#B38600" strokeWidth="1" {...props}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const BlueUserIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="1" {...props}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const sidebarData = [
  {
    label: "Administrator",
    icon: UserCheck,
    initiallyExpanded: true,
    children: [
      {
        label: "Servers",
        icon: Server,
        initiallyExpanded: true,
        children: [
          {
            label: "MetaTrader Server",
            icon: Cpu,
            initiallyExpanded: true,
            active: true,
            children: [
              { label: "Network Cluster", icon: Cloud },
              { label: "Integrations", icon: Network },
              { label: "Automations", icon: Settings },
              { label: "Security", icon: Shield },
              { label: "Time", icon: Clock },
              { label: "Holidays", icon: Calendar },
              { label: "Leverages", icon: Hash },
              { 
                label: "Groups", 
                count: 127, 
                icon: YellowFolderIcon,
                initiallyExpanded: true,
                active: true,
                children: [
                   { label: "ACH", count: 2, icon: BlueUserIcon },
                   { label: "Demo", count: 3, icon: BlueUserIcon },
                   { label: "Dev", count: 3, icon: BlueUserIcon },
                   { label: "Equiti", count: 3, icon: BlueUserIcon },
                   { label: "FYNEX", count: 4, icon: BlueUserIcon },
                   { label: "Flexy", count: 8, icon: BlueUserIcon },
                ]
              },
              { 
                label: "Clients & Accounts", 
                count: 812, 
                icon: UserCheck,
                initiallyExpanded: true,
                children: [
                   { label: "Allocations", icon: BlueUserIcon },
                   { label: "Clients", icon: BlueUserIcon },
                   { label: "Managers", icon: BlueUserIcon },
                   { label: "Trading Accounts", icon: BlueUserIcon },
                   { label: "Corporate links", icon: BlueUserIcon },
                ]
              },
              { 
                label: "Orders & Deals", 
                icon: Layout,
                initiallyExpanded: true,
                children: [
                   { label: "Orders", icon: BlueUserIcon },
                   { label: "Positions", icon: BlueUserIcon },
                   { label: "Deals", icon: BlueUserIcon },
                ]
              },
              { label: "Payments", icon: CreditCard },
              { label: "Gateways", icon: Link },
              { label: "Utency Matching Engine", icon: Zap },
              { label: "Data Feeds", icon: Activity },
              { label: "Plugins", icon: HardDrive },
              { label: "Reports", icon: BarChart },
              { label: "FCN", icon: Globe },
              { label: "Routing", icon: TrendingUp },
              { label: "Funds & ETF", icon: Database },
              { label: "Symbols", count: 696, icon: Hash },
              { label: "Spreads", icon: Activity },
              { label: "Charts & Ticks", icon: LineChart },
              { label: "Subscriptions", icon: Bell },
              { label: "Mailbox", count: 1, icon: Mailbox },
              { label: "Live Update", icon: RotateCcw },
            ]
          }
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
