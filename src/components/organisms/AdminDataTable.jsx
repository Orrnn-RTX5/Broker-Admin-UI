import React, { useState } from 'react';
import {
  terminalTableData,
  clientsAccountsTableData,
  symbolsTableData,
  managersTableData,
  paymentsTableData,
  automationsTableData,
  securityTableData
} from '../../data/terminalData.jsx';
import { useUsers, useGroups } from '../../hooks/useAdmin';
import { usePositions, useDealsSummary } from '../../hooks/usePositions';
import { useInstruments } from '../../hooks/useInstruments';
import { useAccounts } from '../../hooks/useAccounts';
import { ManagerService } from '../../services/manager.service';
import { Clock, CornerUpRight, Server, Calendar, Search, ChevronDown } from 'lucide-react';

import AdminContextMenu from './AdminContextMenu';
import NetworkCluster from './NetworkCluster';
import AllocationsView from './AllocationsView';
import PaymentsView from './PaymentsView';
import GatewaysView from './GatewaysView';
import ServerStatusPanel from './ServerStatusPanel';
import ServerPropertiesPopup from '../RIGHTCLICKJPOPUPS/ServerPropertiesPopup';
import CreateGroupPopup from '../RIGHTCLICKJPOPUPS/CreateGroupPopup';

import IntegrationsView from './IntegrationsView';
import AntiDDoSView from './AntiDDoSView';
import SupportCenterView from './SupportCenterView';
import ManagersView from './ManagersView';
import SwapFreeGroupsView from './SwapFreeGroupsView';
import LeveragesView from './LeveragesView';
import LeverageScheduleView from './LeverageScheduleView';
import HolidaysView from './HolidaysView';
import MarketDepthView from './MarketDepthView';
import SpreadsView from './SpreadsView';
import SessionOverridesView from './SessionOverridesView';
import CustomFieldsView from './CustomFieldsView';
import FeatureFlagsView from './FeatureFlagsView';
import SymbolVisibilityView from './SymbolVisibilityView';
import TradingTerminalConfigView from './TradingTerminalConfigView';
import ExposureView from './ExposureView';
import RiskEventsView from './RiskEventsView';
import RiskLimitsView from './RiskLimitsView';
import SuspiciousActivityView from './SuspiciousActivityView';
import RiskReportsView from './RiskReportsView';
import AnalyticsClientView from './AnalyticsClientView';
import AnalyticsTradingView from './AnalyticsTradingView';
import AnalyticsTradersView from './AnalyticsTradersView';
import AnalyticsRevenueView from './AnalyticsRevenueView';
import DataExportsView from './DataExportsView';
import RegulatoryReportsView from './RegulatoryReportsView';
import ComplaintsView from './ComplaintsView';
import ServerConfigView from './ServerConfigView';
import PaymentMethodsView from './PaymentMethodsView';
import DepositsView from './DepositsView';
import WithdrawalsView from './WithdrawalsView';
import TransactionHistoryView from './TransactionHistoryView';
import PaymentGatewayView from './PaymentGatewayView';
import PaymentReconciliationView from './PaymentReconciliationView';
import ChargebacksView from './ChargebacksView';
import CommunicationsView from './CommunicationsView';
import SecurityAccessView from './SecurityAccessView';
import MarketsView from './MarketsView';
import LPRoutingView from './LPRoutingView';

// Custom icons for MT5 style table
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

const OrangeSquareSIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#D97706" stroke="#B45309" strokeWidth="1" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="3" ry="3" />
    <text x="12" y="17" fontSize="13" fontWeight="bold" fill="white" stroke="none" textAnchor="middle" style={{ fontFamily: 'sans-serif' }}>S</text>
  </svg>
);

const AdminDataTable = ({ onRowDoubleClick, viewType, onAddClick, initialServerTab, refreshTrigger, searchQuery = '', onCountChange }) => {
  const [contextMenu, setContextMenu] = useState({ x: 0, y: 0, visible: false });
  const [serverPopupData, setServerPopupData] = useState(null);

  // Row count reporting. Hooks must run unconditionally, so we declare a ref
  // at the top and a single post-render effect. The render body below writes
  // counts into the ref right before the branch that returns JSX; the effect
  // then forwards them to the parent only when they change.
  const countsRef = React.useRef({ total: 0, filtered: 0 });
  const lastSentRef = React.useRef({ total: -1, filtered: -1 });
  React.useEffect(() => {
    const c = countsRef.current;
    if (c.total !== lastSentRef.current.total || c.filtered !== lastSentRef.current.filtered) {
      lastSentRef.current = { ...c };
      onCountChange?.(c);
    }
  });

  // When a delegated view renders (early return below) it has no row count to
  // report, so reset the ref so the parent breadcrumb clears its counter.
  countsRef.current = { total: 0, filtered: 0 };

  const { data: usersResponse, loading: usersLoading, mutate: refetchUsers } = useUsers(1, 100, '', '', viewType === 'Clients' || viewType === 'Managers');
  const { data: accountsResponse, loading: accountsLoading, mutate: refetchAccounts } = useAccounts(1, 100, '', '', '', viewType === 'Trading Accounts');
  const { data: symbolsResponse, loading: symbolsLoading, mutate: refetchSymbols } = useInstruments(1, 100, '', '', viewType === 'Symbols');
  const { data: positionsResponse, loading: positionsLoading, mutate: refetchPositions } = usePositions({ page: 1, limit: 100 }, true, 2000, viewType === 'Positions');

  const { data: groupsResponse, loading: groupsLoading, mutate: refetchGroups } = useGroups(true);

  React.useEffect(() => {
    if (!refreshTrigger) return;
    const map = {
      'Groups': refetchGroups,
      'Clients': refetchUsers,
      'Managers': refetchUsers,
      'Trading Accounts': refetchAccounts,
      'Symbols': refetchSymbols,
      'Positions': refetchPositions,
    };
    map[viewType]?.();
  }, [refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const [dealDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    to: new Date().toISOString()
  });
  const { data: dealsResponse, loading: dealsLoading, mutate: refetchDeals } = useDealsSummary(dealDateRange.from, dealDateRange.to, '', '', viewType === 'Deals');

  React.useEffect(() => {
    if (refreshTrigger && viewType === 'Deals') refetchDeals?.();
  }, [refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps


  const [editingGroup, setEditingGroup] = useState(null);

  React.useEffect(() => {
    setContextMenu({ visible: false });
  }, [viewType]);

  const handleContextMenu = (e, rowData) => {
    if (viewType === 'Groups') {
      e.preventDefault();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        visible: true,
        selectedGroup: rowData
      });
    }
  };

  const handleDeleteGroup = async () => {
    if (!contextMenu.selectedGroup) return;
    if (window.confirm(`Are you sure you want to delete group ${contextMenu.selectedGroup.name}?`)) {
      try {
        await ManagerService.deleteGroup(contextMenu.selectedGroup.name);
        refetchGroups();
      } catch (err) {
        alert(err.message || 'Error deleting group');
      }
    }
    setContextMenu({ ...contextMenu, visible: false });
  };

  // --- COMING SOON: sidebar views that have no backend yet ---
  // Renders a lightweight empty state so clicking these items doesn't show
  // a blank table. Remove an entry once that view gets wired to an API.
  const COMING_SOON = new Set([
    'Orders', 'Ultency Matching Engine', 'Data Feeds', 'FCN', 'Routing',
    'Funds & ETF', 'Plugins', 'Subscriptions', 'Charts & Ticks',
    'Live Update', 'Mailbox',
  ]);
  if (COMING_SOON.has(viewType)) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[color:var(--bg-app)] select-none">
        <div className="flex flex-col items-center gap-3 max-w-md text-center px-6">
          <div className="w-12 h-12 rounded-full bg-[color:var(--bg-surface-2)] border border-[color:var(--border-default)] flex items-center justify-center">
            <Clock size={20} className="text-[color:var(--text-muted)]" />
          </div>
          <div className="text-[14px] font-semibold text-[color:var(--text-primary)]">
            {viewType}
          </div>
          <div className="text-[12px] text-[color:var(--text-secondary)] leading-relaxed">
            Coming soon. This module isn't wired to a backend yet — when the API is
            ready, data will appear here automatically.
          </div>
          <span className="mt-2 inline-flex items-center h-5 px-2 rounded-[var(--radius-sm)] border border-[color:var(--border-default)] text-[10px] font-mono uppercase tracking-wider text-[color:var(--text-muted)]">
            No backend
          </span>
        </div>
      </div>
    );
  }

  // --- IMPORTED VIEWS ---
  if (viewType === 'Market Overview') {
    return <MarketsView />;
  }
  if (viewType === 'Swap-Free Configs') {
    return <SwapFreeGroupsView />;
  }
  if (viewType === 'Leverages') {
    return <LeveragesView />;
  }
  if (viewType === 'LP Routing') {
    return <LPRoutingView />;
  }
  if (viewType === 'Leverage Schedules') {
    return <LeverageScheduleView />;
  }
  if (viewType === 'Market Depth') {
    return <MarketDepthView />;
  }
  if (viewType === 'Holidays') {
    return <HolidaysView />;
  }
  if (viewType === 'Session Overrides') {
    return <SessionOverridesView />;
  }
  if (viewType === 'Spreads') {
    return <SpreadsView />;
  }
  if (viewType === 'Custom Fields') {
    return <CustomFieldsView />;
  }
  if (viewType === 'Feature Flags') {
    return <FeatureFlagsView />;
  }
  if (viewType === 'Symbol Visibility') {
    return <SymbolVisibilityView />;
  }
  if (viewType === 'Trading Terminal Config') {
    return <TradingTerminalConfigView />;
  }
  if (viewType === 'Exposure') {
    return <ExposureView />;
  }
  if (viewType === 'Risk Events') {
    return <RiskEventsView />;
  }
  if (viewType === 'Risk Limits') {
    return <RiskLimitsView />;
  }
  if (viewType === 'Suspicious Activity') {
    return <SuspiciousActivityView />;
  }
  if (viewType === 'Risk Reports') {
    return <RiskReportsView />;
  }
  if (viewType === 'Client Analytics') {
    return <AnalyticsClientView />;
  }
  if (viewType === 'Trading Analytics') {
    return <AnalyticsTradingView />;
  }
  if (viewType === 'Trader Rankings') {
    return <AnalyticsTradersView />;
  }
  if (viewType === 'Revenue Forecast') {
    return <AnalyticsRevenueView />;
  }
  if (viewType === 'Data Exports') {
    return <DataExportsView />;
  }
  if (viewType === 'Regulatory Reports') {
    return <RegulatoryReportsView />;
  }
  if (viewType === 'Complaints') {
    return <ComplaintsView />;
  }
  if (viewType === 'Server Config') {
    return <ServerConfigView />;
  }
  if (viewType === 'Managers') {
    return <ManagersView />;
  }

  // --- NETWORK CLUSTER INJECTION ---
  if (viewType === 'Network Cluster') {
    return <NetworkCluster />;
  }

  // --- ALLOCATIONS INJECTION ---
  if (viewType === 'Allocations') {
    return <AllocationsView />;
  }

  // --- INTEGRATIONS INJECTION ---
  if (viewType === 'Integrations') {
    return <IntegrationsView />;
  }

  // --- ANTI DDOS INJECTION ---
  if (viewType === 'Anti DDoS Protection') {
    return <AntiDDoSView />;
  }

  // --- SUPPORT CENTER INJECTION ---
  const supportCenterViews = ['Support Center', 'News', 'Articles', 'MetaQuotes Leads', 'Automation', 'Sponsored VPS', 'Platform Documentation', 'API Documentation', 'Workshops', 'Certification', 'Service Desk', 'Online Assistant', 'Search'];
  if (supportCenterViews.includes(viewType)) {
    return <SupportCenterView />;
  }

  // --- PAYMENTS INJECTION ---
  if (viewType === 'Providers') {
    return <PaymentsView />;
  }
  if (viewType === 'Payment Methods') {
    return <PaymentMethodsView />;
  }
  if (viewType === 'Deposits') {
    return <DepositsView />;
  }
  if (viewType === 'Withdrawals') {
    return <WithdrawalsView />;
  }
  if (viewType === 'Transaction History') {
    return <TransactionHistoryView />;
  }
  if (viewType === 'Payment Gateways') {
    return <PaymentGatewayView />;
  }
  if (viewType === 'Reconciliation') {
    return <PaymentReconciliationView />;
  }
  if (viewType === 'Chargebacks') {
    return <ChargebacksView />;
  }

  // --- COMMUNICATIONS INJECTION ---
  const communicationsViews = ['Communications', 'Auto Notification Rules', 'Email Campaigns', 'Message Center', 'Push Notifications', 'SMS'];
  if (communicationsViews.includes(viewType)) {
    return <CommunicationsView />;
  }

  // --- SECURITY & ACCESS INJECTION ---
  const securityAccessViews = ['IP Restrictions', 'Connection Throttle', 'Log Management', 'Backup Schedules', 'Plugin Management'];
  if (securityAccessViews.includes(viewType)) {
    return <SecurityAccessView initialTab={viewType} />;
  }

  // --- GATEWAYS INJECTION ---
  if (viewType === 'Gateways') {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <GatewaysView />
      </div>
    );
  }

  // --- SERVER STATUS INJECTION ---
  if (['Main Trade Server', 'Access Server', 'History Server', 'MainTrade Backup Server', 'Local Main Backup Server', 'Local Main Status Server'].includes(viewType)) {
    return <ServerStatusPanel serverName={viewType} initialTab={initialServerTab} onDoubleClick={() => setServerPopupData({ isOpen: true, target: viewType, id: 'SRV-001' })} />;
  }

  const groupColumns = [
    { label: 'Group', key: 'group', width: 'w-64' },
    { label: 'Server', key: 'server', width: 'w-48' },
    { label: 'Company', key: 'company', width: 'w-64' },
    { label: 'Type', key: 'type', width: 'w-32' },
    { label: 'Authentication', key: 'auth', width: 'w-40' },
    { label: 'Risk Management', key: 'risk', width: 'w-48' },
    { label: 'Margin', key: 'margin', width: 'w-32' },
    { label: 'Floating Leverage Profile', key: 'leverage', width: 'w-56' },
    { label: 'Currency', key: 'currency', width: 'w-24' },
  ];
 
  const clientsColumns = [
    { label: 'Name', key: 'name', width: 'w-64' },
    { label: 'Description', key: 'description', width: 'flex-1' },
  ];

  const symbolsColumns = [
    { label: 'Symbol', key: 'symbol', width: 'w-48' },
    { label: 'Description', key: 'description', width: 'w-72' },
    { label: 'Digits', key: 'digits', width: 'w-24' },
    { label: 'Type', key: 'type', width: 'w-32' },
    { label: 'Execution', key: 'execution', width: 'w-48' },
    { label: 'Expiration', key: 'expiration', width: 'w-32' },
    { label: 'Background', key: 'background', width: 'flex-1' },
  ];

  let columns = [];
  let data = [];
  let isClientsViewTemp = false;
  let isSymbolsViewTemp = false;
  let isPositionsViewTemp = false;
  let isAccountsViewTemp = false;
  let isLoading = false;

  if (viewType === 'Groups') {
    columns = groupColumns;
    if (groupsResponse) {
      const groupsList = Array.isArray(groupsResponse) ? groupsResponse : (groupsResponse.answer || []);
      data = groupsList.map((g, idx) => ({
        ...g,
        id: g.name || idx,
        group: g.name,
        server: 'Main Trade Server',
        company: g.description,
        type: g.accountType,
        auth: 'Normal',
        risk: g.executionMode,
        margin: `${g.marginCallLevel}% / ${g.stopOutLevel}%`,
        leverage: `1 : ${g.leverage}`,
        currency: g.currency,
        iconType: 'group'
      }));
    } else {
      data = terminalTableData; // Fallback to mock before loaded or if error
    }
    isLoading = groupsLoading;
  } else if (viewType === 'Clients & Accounts') {
    columns = clientsColumns;
    data = clientsAccountsTableData;
    isClientsViewTemp = true;
  } else if (viewType === 'Clients') {
    columns = clientsColumns;
    data = usersResponse?.users
      ? usersResponse.users.filter(u => !u.is_admin && u.role !== 'manager').map(u => ({ id: u.id, iconType: 'user', name: u.name, description: u.email }))
      : [];   


      
    isClientsViewTemp = true;
    isLoading = usersLoading;
  } else if (viewType === 'Trading Accounts') {
    columns = [
      { label: 'Login', key: 'login', width: 'w-32' },
      { label: 'Name', key: 'name', width: 'w-48' },
      { label: 'Group', key: 'group', width: 'w-48' },
      { label: 'Balance', key: 'balance', width: 'w-32' },
      { label: 'Equity', key: 'equity', width: 'w-32' },
      { label: 'Currency', key: 'currency', width: 'w-24' },
      { label: 'Status', key: 'status', width: 'w-32' },
    ];
    data = accountsResponse?.accounts
      ? accountsResponse.accounts.map(a => ({
        id: a.login, login: a.login, name: a.name, group: a.group,
        balance: a.balance, equity: a.equity, currency: a.currency, status: a.status
      }))
      : [];
    isAccountsViewTemp = true;
    isLoading = accountsLoading;
  } else if (viewType === 'Symbols') {
    columns = symbolsColumns;
    data = symbolsResponse?.instruments
      ? symbolsResponse.instruments.map((s, i) => ({ id: i, symbol: s.symbol, description: s.description, digits: s.digits, type: s.trade_mode, execution: s.enabled ? 'Enabled' : 'Disabled', expiration: 'GTC', background: '' }))
      : [];
    isSymbolsViewTemp = true;
    isLoading = symbolsLoading;
  } else if (viewType === 'Positions') {
    columns = [
      { label: 'Ticket', width: 'w-24' },
      { label: 'Login', width: 'w-24' },
      { label: 'Time', width: 'w-40' },
      { label: 'Symbol', width: 'w-32' },
      { label: 'Side', width: 'w-20' },
      { label: 'Volume', width: 'w-24' },
      { label: 'Price Open', width: 'w-32' },
      { label: 'Price Current', width: 'w-32' },
      { label: 'S/L', width: 'w-32' },
      { label: 'T/P', width: 'w-32' },
      { label: 'Swap', width: 'w-24' },
      { label: 'Profit', width: 'flex-1' }
    ];
    
    // Support either array or paginated object structure
    const dataList = Array.isArray(positionsResponse) ? positionsResponse : (positionsResponse?.data || []);
    
    data = dataList.map((p, idx) => ({
      id: p.ticket || idx,
      ticket: p.ticket,
      login: p.login,
      time: p.timeCreateFormatted || '',
      symbol: p.symbol,
      side: p.side === 'buy' ? 'Buy' : 'Sell',
      volume: p.volume,
      open_price: p.priceOpen,
      current_price: p.priceCurrent,
      sl: p.priceSl,
      tp: p.priceTp,
      swap: p.swap,
      profit: p.profit
    }));
    isPositionsViewTemp = true;
    isLoading = positionsLoading;
  } else if (viewType === 'Deals') {
    columns = [
      { label: 'Ticket', width: 'w-24' },
      { label: 'Order Ticket', width: 'w-24' },
      { label: 'Time', width: 'w-40' },
      { label: 'Login', width: 'w-24' },
      { label: 'Symbol', width: 'w-32' },
      { label: 'Action', width: 'w-24' },
      { label: 'Entry', width: 'w-24' },
      { label: 'Volume', width: 'w-24' },
      { label: 'Price', width: 'w-32' },
      { label: 'Commission', width: 'w-24' },
      { label: 'Fee', width: 'w-24' },
      { label: 'Profit', width: 'flex-1' }
    ];
    
    const dataList = Array.isArray(dealsResponse) ? dealsResponse : (dealsResponse?.data || []);
    
    data = dataList.map((d, idx) => ({
      id: d.ticket || idx,
      ticket: d.ticket,
      orderTicker: d.orderTicket,
      time: d.timeFormatted || '',
      login: d.login,
      symbol: d.symbol,
      action: d.action,
      entry: d.entry,
      volume: d.volume,
      price: d.price,
      commission: d.commission,
      fee: d.fee,
      profit: d.profit
    }));
    
    isPositionsViewTemp = true; // Use the same custom row renderer for Deals as Positions
    isLoading = dealsLoading;
  } else if (viewType === 'Payments' || viewType === 'Automations' || viewType === 'Security') {
    columns = clientsColumns; // Use generic Name/Description list UI
    if (viewType === 'Payments') data = paymentsTableData;
    else if (viewType === 'Automations') data = automationsTableData;
    else data = securityTableData;
    isClientsViewTemp = true;
  } else {
    // Check if the viewType matches a specific sub-group name inside the terminalTableData
    let matchingSubGroupData = terminalTableData.filter(item => item.group === viewType);

    if (matchingSubGroupData.length === 0 && groupsResponse) {
      const groupsList = Array.isArray(groupsResponse) ? groupsResponse : (groupsResponse.answer || []);
      const backendGroup = groupsList.find(g => g.name === viewType);
      if (backendGroup) {
        matchingSubGroupData = [{
          id: backendGroup.name,
          group: backendGroup.name,
          server: 'Main Trade Server',
          company: backendGroup.description,
          type: backendGroup.accountType,
          auth: 'Normal',
          risk: backendGroup.executionMode,
          margin: `${backendGroup.marginCallLevel}% / ${backendGroup.stopOutLevel}%`,
          leverage: `1 : ${backendGroup.leverage}`,
          currency: backendGroup.currency,
          iconType: 'group'
        }];
      }
    }

    if (matchingSubGroupData.length > 0) {
      columns = groupColumns;
      data = matchingSubGroupData;
    } else {
      // Empty state for all other strictly empty specific pages (Orders, Deals, Network Cluster, etc.)
      columns = [
        { label: 'Item Name', width: 'w-64' },
        { label: 'Status', width: 'w-32' },
        { label: 'Description', width: 'flex-1' },
      ];
      data = [];
    }
  }

  const isClientsView = isClientsViewTemp;
  const isSymbolsView = isSymbolsViewTemp;
  const isPositionsView = isPositionsViewTemp;
  const isAccountsView = isAccountsViewTemp;

  // Client-side filter: matches the search query against any string/number field
  // on each row. Empty query → no filtering.
  const totalCount = Array.isArray(data) ? data.length : 0;
  if (searchQuery && Array.isArray(data) && data.length) {
    const q = searchQuery.toLowerCase();
    data = data.filter((row) =>
      Object.values(row).some((v) => v != null && String(v).toLowerCase().includes(q))
    );
  }
  const filteredCount = Array.isArray(data) ? data.length : 0;

  // Update ref; the top-level effect forwards to parent post-commit.
  countsRef.current = { total: totalCount, filtered: filteredCount };

 
  if (viewType === 'Time') {
    const PropertyRow = ({ idx, icon: Icon, label, value }) => (
      <div className={`flex items-center text-[12px] border-b border-black/20 ${idx % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-blue-600/20 cursor-default`}>
        <div className="w-[320px] flex items-center gap-2 px-3 py-[3px] border-r border-black/20 shrink-0">
          <Icon size={13} className="text-[#3B82F6]" />
          <span className="text-[color:var(--text-primary)]">{label}</span>
        </div>
        <div className="flex-1 px-3 py-[3px] text-[color:var(--text-primary)]">
          {value}
        </div>
      </div>
    );

    const GroupHeader = ({ title }) => (
      <div className="flex border-b border-black/20 bg-[color:var(--bg-app)] cursor-default">
        <div className="w-[320px] px-3 py-1 text-[11px] font-bold text-white border-r border-black/20 shrink-0">
          {title}
        </div>
        <div className="flex-1"></div>
      </div>
    );

    return (
      <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden relative" onContextMenu={(e) => e.preventDefault()}>
        <div className="flex border-b border-black/40 bg-[color:var(--bg-surface-2)] sticky top-0 z-10 shadow-sm">
          <div className="w-[320px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 hover:bg-[color:var(--bg-surface-3)] cursor-default shrink-0">Property</div>
          <div className="flex-1 px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface-3)] cursor-default">Value</div>
        </div>
        <div className="flex-1 overflow-auto no-scrollbar bg-[color:var(--bg-app)]">
          <GroupHeader title="Common settings" />
          <PropertyRow idx={0} icon={Clock} label="Time zone" value="GMT+01:00" />
          <PropertyRow idx={1} icon={CornerUpRight} label="Daylight Saving time correction" value="Yes" />
          <PropertyRow idx={2} icon={Server} label="Time synchronization with" value="time.cloudflare.com, pool.ntp.org" />

          <GroupHeader title="Day settings" />
          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, idx) => (
            <PropertyRow key={day} idx={idx} icon={Calendar} label={day} value="00:00-24:00" />
          ))}

          {/* Placeholder fill */}
          {[...Array(25)].map((_, i) => (
            <div key={i} className={`flex border-b border-black/5 opacity-40 ${i % 2 !== 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'}`}>
              <div className="w-[320px] h-6 border-r border-black/10"></div>
              <div className="flex-1 h-6"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const showSearchFilters = viewType === 'Orders' || viewType === 'Deals' || viewType === 'Positions';

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden relative" onContextMenu={handleContextMenu}>
      {serverPopupData && (
        <ServerPropertiesPopup
          isOpen={serverPopupData.isOpen}
          onClose={() => setServerPopupData(null)}
          serverName={serverPopupData.target}
          serverId={serverPopupData.id}
        />
      )}
      {/* Search Filters Bar for Orders, Deals, Positions */}

      {showSearchFilters && (
        <div className="flex items-center px-2 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40 text-[11px] shrink-0 overflow-x-auto no-scrollbar whitespace-nowrap">
          <div className="flex border border-[color:var(--border-strong)] bg-transparent h-[22px] items-center text-[color:var(--text-muted)] mr-1">
            <div className="px-1.5"><Search size={10} /></div>
            <input
              type="text"
              placeholder="Group or Accounts [1,2,..,1000] or Orders (#1,#2,..#1000)"
              className="bg-transparent border-none outline-none w-[280px] text-[11px] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)]"
            />
            <div className="border-l border-[color:var(--border-strong)] px-1 hover:bg-white/10 cursor-pointer h-full flex items-center">
              <ChevronDown size={12} />
            </div>
          </div>

          <div className="flex border border-[color:var(--border-strong)] bg-transparent h-[22px] items-center text-[color:var(--text-primary)] w-[100px] mr-2">
            <select className="bg-transparent border-none outline-none w-full text-[11px] px-1 appearance-none cursor-pointer">
              <option>All Symbols</option>
            </select>
            <div className="px-1 pointer-events-none text-[color:var(--text-muted)]"><ChevronDown size={12} /></div>
          </div>

          <label className="flex items-center gap-1.5 text-[color:var(--text-primary)] cursor-pointer mr-2 border border-transparent hover:border-[color:var(--border-strong)] px-1 h-[22px] rounded-sm">
            <input type="checkbox" className="w-[11px] h-[11px] accent-[#3B82F6]" />
            Open only
          </label>

          <div className="flex border border-[color:var(--border-strong)] bg-transparent h-[22px] items-center text-[color:var(--text-primary)] w-[70px] mr-1">
            <select className="bg-transparent border-none outline-none w-full text-[11px] px-1 appearance-none cursor-pointer">
              <option>Today</option>
            </select>
            <div className="px-1 pointer-events-none text-[color:var(--text-muted)]"><ChevronDown size={12} /></div>
          </div>

          <div className="flex border border-[color:var(--border-strong)] bg-transparent h-[22px] items-center text-[color:var(--text-primary)] mr-1">
            <input type="text" defaultValue="2026.04.03 00:00" className="bg-transparent border-none outline-none w-[90px] text-[11px] pl-2" />
            <div className="border-l border-[color:var(--border-strong)] px-1.5 text-blue-400 hover:bg-white/10 cursor-pointer h-full flex items-center">
              <Calendar size={12} />
            </div>
          </div>

          <div className="flex border border-[color:var(--border-strong)] bg-transparent h-[22px] items-center text-[color:var(--text-primary)] mr-2">
            <input type="text" defaultValue="2026.04.03 23:59" className="bg-transparent border-none outline-none w-[90px] text-[11px] pl-2" />
            <div className="border-l border-[color:var(--border-strong)] px-1.5 text-blue-400 hover:bg-white/10 cursor-pointer h-full flex items-center">
              <Calendar size={12} />
            </div>
          </div>

          <div className="flex border border-[color:var(--border-strong)] bg-transparent h-[22px] items-center text-[color:var(--text-primary)] w-[120px] mr-1">
            <select className="bg-transparent border-none outline-none w-full text-[11px] px-1 appearance-none cursor-pointer">
              <option>Current database</option>
            </select>
            <div className="px-1 pointer-events-none text-[color:var(--text-muted)]"><ChevronDown size={12} /></div>
          </div>

          <button className="h-[22px] px-4 bg-transparent border border-[color:var(--border-strong)] rounded-[2px] text-[color:var(--text-primary)] hover:bg-white/10 hover:border-[#777777] transition-all">
            Request
          </button>
        </div>
      )}

      {/* Table Header */}
      <div className="flex border-b border-black/40 bg-[color:var(--bg-surface-2)] sticky top-0 z-10 shadow-sm">
        {columns.map((col, idx) => (
          <div
            key={idx}
            className={`${col.width} px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 hover:bg-[color:var(--bg-surface-3)] cursor-default flex items-center shrink-0`}
          >
            {col.label}
          </div>
        ))}
        {/* Fill remaining space if needed */}
        {viewType === 'Groups' && <div className="flex-1 border-b border-black/20 bg-[color:var(--bg-surface-2)]"></div>}
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto no-scrollbar bg-[color:var(--bg-app)]">
        {data.map((row, idx) => (
          <div
            key={row.id}
            onDoubleClick={() => onRowDoubleClick && onRowDoubleClick(row)}
            onContextMenu={(e) => { e.stopPropagation(); handleContextMenu(e, row); }}
            className={`flex cursor-pointer group border-b border-black/10 transition-colors ${idx % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-blue-600/20`}
          >
            {isClientsView ? (
              <>
                <div className="w-64 px-3 py-1 text-[12px] flex items-center gap-2 border-r border-black/10 shrink-0">
                  {row.iconType === 'group' ? <YellowFolderIcon /> : <BlueUserIcon />}
                  <span className="text-[color:var(--text-primary)] truncate font-normal">{row.name}</span>
                </div>
                <div className="flex-1 px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 truncate">{row.description}</div>
              </>
            ) : isSymbolsView ? (
              <>
                <div className="w-48 px-3 py-1 text-[12px] flex items-center gap-2 border-r border-black/10 shrink-0">
                  <OrangeSquareSIcon />
                  <span className="text-[color:var(--text-primary)] truncate font-normal">{row.symbol}</span>
                </div>
                <div className="w-72 px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate">{row.description}</div>
                <div className="w-24 px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate">{row.digits}</div>
                <div className="w-32 px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate">{row.type}</div>
                <div className="w-48 px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate">{row.execution}</div>
                <div className="w-32 px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate">{row.expiration}</div>
                <div className="flex-1 border-b border-white/5 bg-transparent"></div>
              </>
            ) : isPositionsView ? (
              <>
                {columns.map((col, cIdx) => {
                  // Map column key slightly based on column label
                  let val = '';
                  if (col.label === 'Ticket') val = row.ticket;
                  if (col.label === 'Order Ticket') val = row.orderTicker;
                  if (col.label === 'Login') val = row.login;
                  if (col.label === 'Time') val = row.time;
                  if (col.label === 'Symbol') val = row.symbol;
                  if (col.label === 'Side' || col.label === 'Action') val = row.side || row.action;
                  if (col.label === 'Volume') val = row.volume;
                  if (col.label === 'Price Open' || col.label === 'Price') val = row.open_price || row.price;
                  if (col.label === 'Price Current') val = row.current_price;
                  if (col.label === 'S/L') val = row.sl;
                  if (col.label === 'T/P') val = row.tp;
                  if (col.label === 'Swap') val = row.swap;
                  if (col.label === 'Entry') val = row.entry;
                  if (col.label === 'Commission') val = row.commission;
                  if (col.label === 'Fee') val = row.fee;
                  if (col.label === 'Profit') val = row.profit;

                  return (
                    <div key={cIdx} className={`${col.width} px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 ${col.label === 'Profit' && row.profit > 0 ? 'text-green-400' : ''} ${col.label === 'Profit' && row.profit < 0 ? 'text-red-400' : ''} truncate`}>
                       {val !== undefined ? val : '-'}
                    </div>
                  );
                })}
              </>
            ) : isAccountsView ? (
              <>
                <div className="w-32 px-3 py-1 text-[12px] flex items-center gap-2 border-r border-black/10 shrink-0">
                  <BlueUserIcon />
                  <span className="text-[color:var(--text-primary)] truncate font-normal">{row.login}</span>
                </div>
                <div className="w-48 px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate">{row.name}</div>
                <div className="w-48 px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate">{row.group}</div>
                <div className="w-32 px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate">{row.balance}</div>
                <div className="w-32 px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate">{row.equity}</div>
                <div className="w-24 px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate">{row.currency}</div>
                <div className="w-32 px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate">{row.status}</div>
                <div className="flex-1 border-b border-white/5 bg-transparent"></div>
              </>
            ) : (
              <>
                <div className="w-64 px-3 py-1 text-[12px] flex items-center gap-2 border-r border-black/10 shrink-0">
                  {row.iconType === 'group' ? <YellowFolderIcon /> : <BlueUserIcon />}
                  <span className="text-[color:var(--text-primary)] truncate font-normal">{row.group}</span>
                </div>
                <div className="w-48 px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate">{row.server}</div>
                <div className="w-64 px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate">{row.company}</div>
                <div className="w-32 px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0">{row.type}</div>
                <div className="w-40 px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0">{row.auth}</div>
                <div className="w-48 px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0">{row.risk}</div>
                <div className="w-32 px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0">{row.margin}</div>
                <div className="w-56 px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0">{row.leverage}</div>
                <div className="w-24 px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0">{row.currency}</div>
                <div className={`flex-1 border-b border-white/5 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-transparent'} group-hover:bg-blue-600/20`}></div>
              </>
            )}
          </div>
        ))}
        {isLoading && data.length === 0 && (
          <div className="p-4 text-[color:var(--text-muted)] text-[12px] italic">Loading data...</div>
        )}
        {!isLoading && data.length === 0 && (
          <div className="p-4 text-[color:var(--text-muted)] text-[12px] italic">No data available</div>
        )}
        {/* Placeholder Rows to fill screen */}
        {[...Array(30)].map((_, i) => (
          <div key={i} className={`flex border-b border-black/5 opacity-40 ${(data.length + i) % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'}`}>
            <div className="w-full h-6 border-r border-black/10"></div>
          </div>
        ))}
      </div>

      {/* Bottom Tab Bar (MT5 Style) */}
      <div className="h-7 bg-[color:var(--bg-surface-1)] border-t border-black/40 flex items-center px-1 gap-1">
        <div className="h-[22px] px-3 bg-[#3e3e3e] text-white text-[11px] flex items-center border border-black/40 rounded-sm shadow-sm cursor-default">
          {viewType === 'Clients & Accounts' ? 'Clients & Accounts' : (viewType === 'Groups' ? 'Groups (127)' : viewType)}
        </div>
        <div className="h-[22px] px-3 text-[#999999] hover:text-[color:var(--text-secondary)] text-[11px] flex items-center cursor-default transition-colors">
          All {viewType}
        </div>
      </div>
      {/* Context Menu Overlay */}
      {contextMenu.visible && viewType === 'Groups' && (
        <AdminContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          selectedRow={contextMenu.selectedGroup}
          onClose={() => setContextMenu({ ...contextMenu, visible: false })}
          onAdd={onAddClick}
          onEdit={() => { setEditingGroup(contextMenu.selectedGroup); setContextMenu({ ...contextMenu, visible: false }); }}
          onDelete={handleDeleteGroup}
        />
      )}
      {editingGroup && (
        <CreateGroupPopup
          initialData={editingGroup}
          onClose={() => setEditingGroup(null)}
          onCreated={() => { setEditingGroup(null); refetchGroups(); }}
        />
      )}
    </div>
  );
};

export default AdminDataTable;
