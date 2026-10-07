import { refreshGroupMembership } from '../../services/groupMembershipRefresh.js';
import { sortToolbarRows } from '../../utils/toolbarActions';
import { formatDealActionLabel, formatDealEntryLabel } from '../../utils/dealDisplayLabels';
import React, { lazy, Suspense, useState } from 'react';
import GatewaysView from './GatewayWorkspace.jsx';
import { createPortal } from 'react-dom';
import {
  clientsAccountsTableData,
  automationsTableData,
  securityTableData
} from '../../data/terminalData.jsx';
import { useGroups } from '../../hooks/useAdmin';
import { usePositions, useOrders, useDealsSummary } from '../../hooks/usePositions';
import { useInstruments } from '../../hooks/useInstruments';
import { useAccounts } from '../../hooks/useAccounts';
import { useClientRowWindow } from '../../hooks/useClientRowWindow';
import { useDataFetch } from '../../hooks/useCore';
import { formatAccountAmount } from '../../utils/accountAmountDisplay';
import { formatOrderNumber, formatOrderTime } from '../../utils/orderDisplay';
import { ManagerService } from '../../services/manager.service';
import { PositionsService } from '../../services/positions.service';
import { InstrumentsService } from '../../services/instruments.service';
import { loadLpSymbols } from '../../utils/lpSymbols';
import { getUnconfiguredSymbolRows, mergeUnconfiguredSymbolPage } from '../../utils/lpSymbolLists';
import { useAuthStore } from '../../store/authStore';
import { normalizeArrayResponse, normalizePagedResponse, getApiErrorMessage } from '../../utils/apiShapes';
import {
  getCloseAllActionState,
  getCloseAllConfirmationPrompt,
  isCloseAllConfirmationAccepted,
} from '../../utils/closeAllAction';
import { canAccessView } from '../../utils/permissions';
import { useToast } from '../ui/useToast';
import {
  Clock,
  Search,
  ChevronDown,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Hash,
} from 'lucide-react';

import AdminContextMenu from './AdminContextMenu';
import OrderDateTimePicker from './OrderDateTimePicker';
import PositionSymbolPicker from './PositionSymbolPicker';
import './AdminDataTable.clients.css';
import './AdminDataTable.accounts.css';
import './AdminDataTable.orders.css';
import './AdminDataTable.positions.css';
import './AdminDataTable.symbols.css';
const DownstreamAccessView = lazy(() => import('./DownstreamAccessView'));
const GroupPropertiesPopup = lazy(() => import('../RIGHTCLICKJPOPUPS/GroupPropertiesPopup'));

// Optional workspaces load when selected so their charts, maps, and editors do
// not delay the first table or the independently mounted journal.
const NetworkCluster = lazy(() => import('./NetworkCluster'));
const AllocationsView = lazy(() => import('./AllocationsView'));
const ServerStatusPanel = lazy(() => import('./ServerStatusPanel'));
const FeedTenantsView = lazy(() => import('./FeedTenantsView'));
const IntegrationsView = lazy(() => import('./IntegrationsView'));
const TimeSettingsView = lazy(() => import('./TimeSettingsView'));
const AntiDDoSView = lazy(() => import('./AntiDDoSView'));
const SupportCenterView = lazy(() => import('./SupportCenterView'));
const ManagersView = lazy(() => import('./ManagersView'));
const SwapFreeGroupsView = lazy(() => import('./SwapFreeGroupsView'));
const LeveragesView = lazy(() => import('./LeveragesView'));
const LeverageScheduleView = lazy(() => import('./LeverageScheduleView'));
const HolidaysView = lazy(() => import('./HolidaysView'));
const MarketDepthView = lazy(() => import('./MarketDepthView'));
const SpreadsView = lazy(() => import('./SpreadsView'));
const SessionOverridesView = lazy(() => import('./SessionOverridesView'));
const CustomFieldsView = lazy(() => import('./CustomFieldsView'));
const FeatureFlagsView = lazy(() => import('./FeatureFlagsView'));
const SymbolVisibilityView = lazy(() => import('./SymbolVisibilityView'));
const TradingTerminalConfigView = lazy(() => import('./TradingTerminalConfigView'));
const ExposureView = lazy(() => import('./ExposureView'));
const RiskEventsView = lazy(() => import('./RiskEventsView'));
const RiskLimitsView = lazy(() => import('./RiskLimitsView'));
const SuspiciousActivityView = lazy(() => import('./SuspiciousActivityView'));
const RiskReportsView = lazy(() => import('./RiskReportsView'));
const AnalyticsClientView = lazy(() => import('./AnalyticsClientView'));
const AnalyticsTradingView = lazy(() => import('./AnalyticsTradingView'));
const AnalyticsTradersView = lazy(() => import('./AnalyticsTradersView'));
const AnalyticsRevenueView = lazy(() => import('./AnalyticsRevenueView'));
const DataExportsView = lazy(() => import('./DataExportsView'));
const RegulatoryReportsView = lazy(() => import('./RegulatoryReportsView'));
const ComplaintsView = lazy(() => import('./ComplaintsView'));
const ServerConfigView = lazy(() => import('./ServerConfigView'));
const PaymentMethodsView = lazy(() => import('./PaymentMethodsView'));
const DepositsView = lazy(() => import('./DepositsView'));
const WithdrawalsView = lazy(() => import('./WithdrawalsView'));
const TransactionHistoryView = lazy(() => import('./TransactionHistoryView'));
const PaymentGatewayView = lazy(() => import('./PaymentGatewayView'));
const PaymentReconciliationView = lazy(() => import('./PaymentReconciliationView'));
const ChargebacksView = lazy(() => import('./ChargebacksView'));
const CommunicationsView = lazy(() => import('./CommunicationsView'));
const SecurityAccessView = lazy(() => import('./SecurityAccessView'));
const MarketsView = lazy(() => import('./MarketsView'));
const LPRoutingView = lazy(() => import('./LPRoutingView'));
const ServerPropertiesPopup = lazy(() => import('../RIGHTCLICKJPOPUPS/ServerPropertiesPopup'));
const CreateGroupPopup = lazy(() => import('../RIGHTCLICKJPOPUPS/CreateGroupPopup'));

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

const COMING_SOON_VIEWS = new Set([
  'Utency Matching Engine', 'Ultency Matching Engine', 'Data Feeds', 'FCN',
  'Routing', 'Funds & ETF', 'Plugins', 'Reports', 'Providers', 'Subscriptions', 'Charts & Ticks',
  'Live Update', 'Mailbox',
]);

const FOLDER_ONLY_VIEWS = new Set([
  'Risk Management',
  'Communications',
]);

const DEFAULT_PAGE_SIZE = 100;
const PAGE_SIZE_OPTIONS = [50, 100, 250];
const PAGED_VIEW_TYPES = new Set(['Groups', 'Clients', 'Trading Accounts', 'Symbols', 'Orders', 'Positions', 'Deals']);
const ACCOUNT_EDIT_VIEW_TYPES = new Set(['Clients', 'Trading Accounts']);
const TRADE_DETAIL_VIEW_TYPES = new Set(['Orders', 'Positions', 'Deals']);
const NON_GROUP_LOOKUP_VIEWS = new Set([
  'Clients & Accounts',
  'Clients',
  'Trading Accounts',
  'Symbols',
  'Positions',
  'Orders',
  'Orders & Deals',
  'Deals',
  'Automations',
  'Security',
  'Time',
]);
const orderFilterSelectShellClassName = 'flex border border-[color:var(--border-strong)] bg-[color:var(--bg-surface-1)] h-[26px] items-center text-[color:var(--text-primary)] cursor-pointer hover:bg-[color:var(--bg-surface-3)] rounded-[2px]';
const orderFilterSelectClassName = 'bg-[color:var(--bg-surface-1)] border-none outline-none w-full h-full text-[11px] px-1 appearance-none cursor-pointer text-[color:var(--text-primary)]';
const orderFilterSelectOptionClassName = 'bg-[color:var(--bg-surface-2)] text-[color:var(--text-primary)]';
const orderFilterSelectOptionStyle = {
  backgroundColor: 'var(--bg-surface-2)',
  color: 'var(--text-primary)',
};
const paginationButtonClassName = 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface-1)] text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--bg-surface-3)] hover:text-[color:var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--accent-500)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-[color:var(--bg-surface-1)]';
const paginationFieldClassName = 'h-7 rounded-[2px] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface-1)] text-[11px] text-[color:var(--text-primary)] outline-none focus-visible:border-[color:var(--accent-500)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

const SUPPORT_CENTER_VIEWS = new Set([
  'Support Center', 'News', 'Articles', 'Orrnn Leads', 'Automation',
  'Sponsored VPS', 'Platform Documentation', 'API Documentation', 'Workshops',
  'Certification', 'Service Desk', 'Online Assistant', 'Search',
]);

const COMMUNICATIONS_VIEWS = new Set([
  'Communications', 'Auto Notification Rules', 'Email Campaigns',
  'Message Center', 'Push Notifications', 'SMS',
]);

const SECURITY_ACCESS_VIEWS = new Set([
  'IP Restrictions', 'Connection Throttle', 'Log Management',
  'Backup Schedules', 'Plugin Management',
]);

const SERVER_STATUS_VIEWS = new Set([
  'Main Trade Server', 'Access Server', 'History Server',
  'MainTrade Backup Server', 'Local Main Backup Server', 'Local Main Status Server',
]);

const IMPORTED_VIEW_TYPES = new Set([
  'Market Overview',
  'Symbols Browser',
  'Symbol Management',
  'Swap-Free Configs',
  'Leverages',
  'LP Routing',
  'Leverage Schedules',
  'Market Depth',
  'Holidays',
  'Session Overrides',
  'Spreads',
  'Custom Fields',
  'Feature Flags',
  'Symbol Visibility',
  'Trading Terminal Config',
  'Exposure',
  'Risk Events',
  'Risk Limits',
  'Suspicious Activity',
  'Risk Reports',
  'Client Analytics',
  'Trading Analytics',
  'Trader Rankings',
  'Revenue Forecast',
  'Data Exports',
  'Regulatory Reports',
  'Complaints',
  'Server Config',
  'Server Configuration',
  'Managers',
  'Network Cluster',
  'Allocations',
  'Integrations',
  'Anti DDoS Protection',
  'Payments',
  'Payment Methods',
  'Deposits',
  'Withdrawals',
  'Transaction History',
  'Payment Gateways',
  'Reconciliation',
  'Chargebacks',
  'Gateways',
  'Downstream access',
  'Feed Tenants',
]);

const isDelegatedAdminView = (viewType) => (
  FOLDER_ONLY_VIEWS.has(viewType) ||
  COMING_SOON_VIEWS.has(viewType) ||
  IMPORTED_VIEW_TYPES.has(viewType) ||
  SUPPORT_CENTER_VIEWS.has(viewType) ||
  COMMUNICATIONS_VIEWS.has(viewType) ||
  SECURITY_ACCESS_VIEWS.has(viewType) ||
  SERVER_STATUS_VIEWS.has(viewType)
);

const getGroupRow = (group, idx) => ({
  ...group,
  id: group.name || idx,
  group: group.name,
  server: 'Main Trade Server',
  company: group.description,
  type: group.accountType,
  auth: 'Normal',
  risk: group.executionMode,
  margin: `${group.marginCallLevel}% / ${group.stopOutLevel}%`,
  leverage: `1 : ${group.leverage}`,
  currency: group.currency,
  iconType: 'group'
});

const padDatePart = (value) => String(value).padStart(2, '0');

const formatOrderDateInput = (date) => (
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`
);

const getOrderDateRangeForPreset = (preset) => {
  if (preset === 'all') {
    return {
      from: '',
      to: '',
    };
  }

  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (preset === 'last7') {
    start.setDate(start.getDate() - 6);
  } else if (preset === 'month') {
    start.setDate(1);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return {
    from: formatOrderDateInput(start),
    to: formatOrderDateInput(end),
  };
};

const createDefaultOrderFilters = () => ({
  query: '',
  symbol: '',
  openOnly: false,
  rangePreset: 'all',
  ...getOrderDateRangeForPreset('all'),
  database: 'current',
});

const parseOrderDateInput = (value) => {
  const normalizedValue = String(value || '').trim().replace('T', ' ');
  const match = normalizedValue.match(/^(\d{4})[.-](\d{2})[.-](\d{2})(?:\s+(\d{2}):(\d{2})(?::\d{2})?)?$/);
  if (!match) return null;

  const [, year, month, day, hour = '0', minute = '0'] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, 0);
  date.setFullYear(Number(year));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)
    || Number(hour) > 23 || Number(minute) > 59) return null;
  return Number.isNaN(date.getTime()) ? null : date.getTime();
};

const getOrderTimestampMs = (order) => {
  const candidates = [
    order.timeSetup,
    order.TimeSetup,
    order.timeDone,
    order.TimeDone,
    order.time,
    order.Time,
    order.openTime,
    order.OpenTime,
    order.closeTime,
    order.CloseTime,
  ];
  for (const candidate of candidates) {
    if (candidate == null || candidate === '') continue;
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric > 1000000000000 ? numeric : numeric * 1000;
    }

    const parsed = Date.parse(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const pickDefined = (source, keys, fallback = '') => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
};

const formatTradeTimestamp = (value) => {
  if (value === undefined || value === null || value === '') return '';

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    const timestampMs = numeric > 1000000000000 ? numeric : numeric * 1000;
    const date = new Date(timestampMs);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }

  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) return new Date(parsed).toLocaleString();

  return String(value);
};

const getTradeSideLabel = (value) => {
  if (value === 0 || String(value).toLowerCase() === '0') return 'Buy';
  if (value === 1 || String(value).toLowerCase() === '1') return 'Sell';

  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'buy') return 'Buy';
  if (normalized === 'sell') return 'Sell';
  return String(value);
};

const renderTableValue = (value) => (
  value === undefined || value === null || value === '' ? '-' : value
);
const NUMERIC_COLUMN_LABELS = new Set([
  'Volume', 'Price Open', 'Price Current', 'Price', 'S/L', 'T/P',
  'Swap', 'Profit', 'Commission', 'Fee', 'Balance', 'Equity', 'Margin',
]);

const getOrderRow = (order, idx) => ({
  id: pickDefined(order, ['ticket_text', 'order_ticket_text', 'ticket', 'Ticket', 'order', 'Order', 'orderTicket', 'OrderTicket'], idx),
  raw: order,
  ticket: pickDefined(order, ['ticket_text', 'order_ticket_text', 'ticket', 'Ticket', 'order', 'Order', 'orderTicket', 'OrderTicket']),
  login: pickDefined(order, ['login', 'Login', 'accountLogin', 'account_login']),
  time: formatTradeTimestamp(pickDefined(order, ['timeSetupFormatted', 'timeDoneFormatted', 'timeSetup', 'TimeSetup', 'timeDone', 'TimeDone', 'time', 'Time', 'openTime', 'OpenTime', 'closeTime', 'CloseTime'])),
  timeMs: getOrderTimestampMs(order),
  symbol: pickDefined(order, ['symbol', 'Symbol']),
  side: pickDefined(order, ['side', 'Side', 'action', 'Action', 'type', 'Type', 'cmd', 'Cmd']),
  volume: pickDefined(order, ['volume', 'Volume', 'lots', 'Lots', 'volumeExt', 'VolumeExt']),
  open_price: pickDefined(order, ['priceOpen', 'PriceOpen', 'price_open', 'openPrice', 'OpenPrice', 'price', 'Price']),
  sl: pickDefined(order, ['priceSl', 'PriceSl', 'priceSL', 'PriceSL', 'sl', 'SL']),
  tp: pickDefined(order, ['priceTp', 'PriceTp', 'priceTP', 'PriceTP', 'tp', 'TP']),
  status: pickDefined(order, ['status', 'Status', 'state', 'State']),
  comment: pickDefined(order, ['comment', 'Comment']),
});

const getPositionRow = (position, idx) => {
  const ticket = pickDefined(position, ['position_ticket_text', 'ticket_text', 'ticket', 'positionTicket', 'Position', 'position', 'id'], idx);
  const rawTime = pickDefined(position, ['timeCreateFormatted', 'timeCreate', 'TimeCreate', 'time', 'Time', 'openTime', 'OpenTime']);

  return {
    id: ticket,
    raw: position,
    ticket,
    login: pickDefined(position, ['login', 'Login', 'accountLogin', 'account_login']),
    time: position.timeCreateFormatted || formatTradeTimestamp(rawTime),
    timeMs: getOrderTimestampMs({ time: rawTime }),
    symbol: pickDefined(position, ['symbol', 'Symbol']),
    side: getTradeSideLabel(pickDefined(position, ['side', 'Side', 'action', 'Action', 'type', 'Type', 'cmd', 'Cmd'])),
    volume: pickDefined(position, ['volume', 'Volume', 'lots', 'Lots', 'volumeExt', 'VolumeExt']),
    open_price: pickDefined(position, ['priceOpen', 'PriceOpen', 'openPrice', 'OpenPrice', 'Price', 'price']),
    current_price: pickDefined(position, ['priceCurrent', 'PriceCurrent', 'currentPrice', 'CurrentPrice']),
    sl: pickDefined(position, ['priceSl', 'PriceSl', 'priceSL', 'PriceSL', 'sl', 'SL']),
    tp: pickDefined(position, ['priceTp', 'PriceTp', 'priceTP', 'PriceTP', 'tp', 'TP']),
    swap: pickDefined(position, ['swap', 'Swap', 'storage', 'Storage']),
    profit: pickDefined(position, ['profit', 'Profit']),
  };
};

const getDealRow = (deal, idx) => {
  const ticket = pickDefined(deal, ['ticket', 'Ticket', 'deal', 'Deal', 'id'], idx);
  const rawTime = pickDefined(deal, ['timeFormatted', 'time', 'Time', 'timeMsc', 'TimeMsc', 'time_msc', 'createdAt']);

  return {
    id: ticket,
    raw: deal,
    ticket,
    orderTicker: pickDefined(deal, ['orderTicket', 'OrderTicket', 'order', 'Order']),
    time: deal.timeFormatted || formatTradeTimestamp(rawTime),
    login: pickDefined(deal, ['login', 'Login', 'accountLogin', 'account_login']),
    symbol: pickDefined(deal, ['symbol', 'Symbol']),
    action: getTradeSideLabel(pickDefined(deal, ['action', 'Action', 'side', 'Side', 'type', 'Type'])),
    entry: pickDefined(deal, ['entry', 'Entry']),
    volume: pickDefined(deal, ['volume', 'Volume', 'lots', 'Lots', 'volumeExt', 'VolumeExt']),
    price: pickDefined(deal, ['price', 'Price']),
    commission: pickDefined(deal, ['commission', 'Commission']),
    fee: pickDefined(deal, ['fee', 'Fee']),
    profit: pickDefined(deal, ['profit', 'Profit']),
  };
};

const CLOSED_ORDER_STATUSES = new Set([
  'closed',
  'done',
  'cancelled',
  'canceled',
  'deleted',
  'expired',
  'rejected',
]);

const isOpenOrderRow = (row) => {
  const status = String(row.status ?? '').trim().toLowerCase();
  if (!status) return true;
  return !CLOSED_ORDER_STATUSES.has(status);
};

const normalizeOrderSearchToken = (value) => (
  String(value || '')
    .trim()
    .replace(/^#+/, '')
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .toLowerCase()
);

const getOrderDisplayStatus = (row) => (
  isOpenOrderRow(row) ? 'open' : row.status
);

const getOrderDisplayRow = (row) => ({
  ...row,
  status: getOrderDisplayStatus(row),
});

const orderMatchesQuery = (row, query) => {
  const rawQuery = String(query || '').trim();
  const tokens = rawQuery
    .split(/[\s,]+/)
    .map(normalizeOrderSearchToken)
    .filter(Boolean);

  if (!tokens.length) return true;

  const searchableValues = [
    row.ticket,
    row.login,
    row.symbol,
    row.side,
    row.status,
    getOrderDisplayStatus(row),
    row.comment,
  ].map((value) => String(value ?? '').toLowerCase());

  const matcher = (token) => searchableValues.some((value) => value.includes(token));
  const isListSearch = rawQuery.includes(',') || rawQuery.includes('[') || rawQuery.includes(']') || rawQuery.includes('#');
  return isListSearch ? tokens.some(matcher) : tokens.every(matcher);
};

const getOrderSymbolOptions = (rows) => (
  Array.from(new Set(rows.map((row) => row.symbol).filter(Boolean))).sort()
);

const filterOrderRows = (rows, filters) => {
  const fromMs = parseOrderDateInput(filters.from);
  const toMs = parseOrderDateInput(filters.to);
  const inclusiveToMs = toMs == null ? null : toMs + 59999;

  return rows.filter((row) => {
    if (filters.openOnly && !isOpenOrderRow(row)) return false;
    if (filters.symbol && row.symbol !== filters.symbol) return false;
    if (!orderMatchesQuery(row, filters.query)) return false;
    if ((fromMs != null || inclusiveToMs != null) && row.timeMs == null) return false;
    if (fromMs != null && row.timeMs != null && row.timeMs < fromMs) return false;
    if (inclusiveToMs != null && row.timeMs != null && row.timeMs > inclusiveToMs) return false;
    return true;
  });
};

const hasActiveOrderFilter = (filters) => Boolean(
  String(filters.query || '').trim() ||
  filters.symbol ||
  filters.openOnly ||
  filters.from ||
  filters.to
);

const matchesRecordSearch = (record, query) => {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) return true;

  return Object.values(record || {}).some((value) => (
    value !== undefined &&
    value !== null &&
    String(value).toLowerCase().includes(normalizedQuery)
  ));
};

const getBrokerClientRow = (account, idx) => {
  const id = pickDefined(account, ['id', 'ID', 'login', 'Login', 'account_login', 'accountLogin', 'email', 'Email', 'phone', 'Phone'], idx);
  const login = pickDefined(account, ['login', 'Login', 'account_login', 'accountLogin']);
  const name = pickDefined(account, ['name', 'Name', 'client_name', 'clientName', 'full_name', 'fullName', 'user_name', 'userName'], login);
  const email = pickDefined(account, ['email', 'Email']);
  const phone = pickDefined(account, ['phone', 'Phone']);
  const group = pickDefined(account, ['group', 'Group', 'group_name', 'groupName', 'account_group', 'accountGroup', 'accountGroupName']);
  const explicitStatus = pickDefined(account, ['status', 'Status'], null);
  const enabled = pickDefined(account, ['enabled', 'Enabled'], null);
  const enabledText = String(enabled).toLowerCase();
  const status = explicitStatus ?? (
    enabledText === 'true' || enabledText === '1' ? 'active'
      : enabledText === 'false' || enabledText === '0' ? 'disabled' : 'unknown'
  );

  return {
    id,
    raw: account,
    login,
    email,
    phone,
    group,
    status,
    iconType: 'user',
    name,
  };
};

const getClientStatusTone = (status) => {
  const normalized = String(status ?? '').trim().toLowerCase();
  if (normalized === 'active' || normalized === 'enabled') return 'active';
  if (normalized.replace(/[\s_-]+/g, '') === 'readonly') return 'readonly';
  if (normalized === 'pending' || normalized === 'in review' || normalized === 'under review') return 'pending';
  if (normalized === 'inactive' || normalized === 'disabled' || normalized === 'blocked') return 'inactive';
  return 'neutral';
};

const formatClientStatus = (status) => {
  if (getClientStatusTone(status) === 'readonly') return 'Read only';
  const value = String(status ?? 'unknown').trim().replaceAll('_', ' ');
  return value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : 'Unknown';
};

const renderClientField = (value) => (
  value !== undefined && value !== null && value !== ''
    ? value
    : <span className="admin-client-empty">—</span>
);
const getAccountRow = (account, idx) => ({
  id: pickDefined(account, ['login', 'Login', 'account_login', 'accountLogin'], idx),
  raw: account,
  login: pickDefined(account, ['login', 'Login', 'account_login', 'accountLogin']),
  name: pickDefined(account, ['name', 'Name', 'client_name', 'clientName', 'full_name', 'fullName', 'user_name', 'userName']),
  group: pickDefined(account, ['group', 'Group', 'group_name', 'groupName', 'account_group', 'accountGroup', 'accountGroupName']),
  balance: pickDefined(account, ['balance', 'Balance']),
  equity: pickDefined(account, ['equity', 'Equity']),
  currency: pickDefined(account, ['currency', 'Currency']),
  status: pickDefined(account, ['status', 'Status'], account.enabled === false || account.Enabled === false ? 'disabled' : 'active'),
});

const getSymbolRow = (symbol, idx) => ({
  id: symbol.id || symbol.symbol || idx,
  symbol: symbol.symbol || symbol.name || '',
  description: symbol.description || symbol.path || symbol.category || '',
  digits: symbol.digits ?? symbol.digits_currency ?? '',
  type: symbol.trade_mode ?? symbol.type ?? symbol.mode ?? '',
  execution: symbol.enabled === false ? 'Disabled' : (symbol.execution || 'Enabled'),
  expiration: symbol.expiration || 'GTC',
  background: symbol.background || '',
});

const getPagedMappedRows = ({ response, keys, page, pageSize, search, filterFn, mapFn }) => {
  const normalizedSearch = String(search || '').trim();
  const combinedFilter = (record, index) => (
    (!filterFn || filterFn(record, index)) &&
    matchesRecordSearch(record, normalizedSearch)
  );
  const paged = normalizePagedResponse(response, {
    arrayKeys: keys,
    page,
    limit: pageSize,
    filterFn: filterFn || normalizedSearch ? combinedFilter : undefined,
  });

  return {
    ...paged,
    rows: paged.rows.map(mapFn),
  };
};

const getOrderRecordFilter = (filters) => (order, index) => {
  const row = getOrderRow(order, index);
  return filterOrderRows([row], filters).length > 0;
};

const clampPage = (page, totalPages) => {
  const nextPage = Number(page);
  if (!Number.isFinite(nextPage) || nextPage < 1) return 1;
  if (Number.isFinite(totalPages)) return Math.min(Math.floor(nextPage), totalPages);
  return Math.floor(nextPage);
};

const formatCount = (value) => (
  Number.isFinite(value) ? new Intl.NumberFormat().format(value) : ''
);

const estimateJsonBytes = (value) => {
  try {
    const json = JSON.stringify(value ?? []);
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(json).length;
    }
    return json.length;
  } catch {
    return 0;
  }
};

const GROUP_COLUMNS = [
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

const CLIENTS_COLUMNS = [
  { label: 'Name', key: 'name', width: 'w-64' },
  { label: 'Description', key: 'description', width: 'flex-1' },
];

const BROKER_CLIENT_COLUMNS = [
  { label: 'Name', key: 'name' },
  { label: 'Login', key: 'login' },
  { label: 'Email', key: 'email' },
  { label: 'Phone', key: 'phone' },
  { label: 'Group', key: 'group' },
  { label: 'Status', key: 'status' },
];

const ACCOUNT_COLUMNS = [
  { label: 'Login', key: 'login', width: 'w-32' },
  { label: 'Name', key: 'name', width: 'w-48' },
  { label: 'Group', key: 'group', width: 'w-48' },
  { label: 'Balance', key: 'balance', width: 'w-32' },
  { label: 'Equity', key: 'equity', width: 'w-32' },
  { label: 'Currency', key: 'currency', width: 'w-24' },
  { label: 'Status', key: 'status', width: 'w-32' },
];

const SYMBOL_COLUMNS = [
  { label: 'Symbol', key: 'symbol', width: 'w-48' },
  { label: 'Description', key: 'description', width: 'w-72' },
  { label: 'Digits', key: 'digits', width: 'w-24' },
  { label: 'Trade mode', key: 'type', width: 'w-32' },
  { label: 'Execution', key: 'execution', width: 'w-48' },
  { label: 'Expiration', key: 'expiration', width: 'w-32' },
];

const POSITION_COLUMNS = [
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
  { label: 'Profit', width: 'flex-1' },
];

const ORDER_COLUMNS = [
  { label: 'Ticket', width: 'w-24' },
  { label: 'Login', width: 'w-24' },
  { label: 'Time', width: 'w-40' },
  { label: 'Symbol', width: 'w-32' },
  { label: 'Side', width: 'w-20' },
  { label: 'Volume', width: 'w-24' },
  { label: 'Price Open', width: 'w-32' },
  { label: 'S/L', width: 'w-32' },
  { label: 'T/P', width: 'w-32' },
  { label: 'Status', width: 'w-32' },
  { label: 'Comment', width: 'flex-1' },
];

const DEAL_COLUMNS = [
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
  { label: 'Profit', width: 'flex-1' },
];

const PaginationIconButton = ({ 'aria-label': ariaLabel, onClick, disabled, children }) => (
  <button
    type="button"
    aria-label={ariaLabel}
    title={ariaLabel}
    onClick={onClick}
    disabled={disabled}
    className={paginationButtonClassName}
  >
    {children}
  </button>
);

const OrderFilterPlacement = ({ host, children }) => host ? createPortal(children, host) : children;

const AdminDataTableContent = ({
  onRowDoubleClick,
  viewType,
  orderFilterHost,
  onAddClick,
  onGroupsChanged,
  initialServerTab,
  refreshTrigger,
  searchQuery = '',
  sortDirection = '',
  onCountChange,
  onRowsChange,
  onEditableTargetSelect,
  selectedEditableTargetId,
  selectedEditableTargetType,
}) => {
  const [contextMenu, setContextMenu] = useState({ x: 0, y: 0, visible: false });
  const [serverPopupData, setServerPopupData] = useState(null);
  const [closeAllSymbol, setCloseAllSymbol] = useState('');
  const [closeAllBusy, setCloseAllBusy] = useState(false);
  const [closeAllNotice, setCloseAllNotice] = useState(null);
  const [symbolSelection, setSymbolSelection] = useState({ scope: null, id: null });
  const [orderFilters, setOrderFilters] = useState(() => createDefaultOrderFilters());
  const [page, setPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  const [debouncedOrderQuery, setDebouncedOrderQuery] = useState(orderFilters.query);
  const currentUser = useAuthStore((state) => state.user);
  const { notify } = useToast();
  const closeAllAction = getCloseAllActionState({
    user: currentUser,
    symbol: closeAllSymbol,
    busy: closeAllBusy,
  });

  // Row count reporting is committed after render so delegated views can clear
  // the breadcrumb counter without render-time ref writes.
  const lastSentRef = React.useRef({ total: -1, filtered: -1 });

  React.useEffect(() => {
    const timerId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => window.clearTimeout(timerId);
  }, [searchQuery]);

  React.useEffect(() => {
    const timerId = window.setTimeout(() => {
      setDebouncedOrderQuery(orderFilters.query);
    }, 300);

    return () => window.clearTimeout(timerId);
  }, [orderFilters.query]);

  const canLoadGroups = canAccessView(currentUser, 'Groups');
  const isPotentialGroupLookup = !isDelegatedAdminView(viewType) && !NON_GROUP_LOOKUP_VIEWS.has(viewType);
  const shouldLoadGroups = canLoadGroups && (viewType === 'Groups' || isPotentialGroupLookup);
  const groupSearch = viewType === 'Groups' ? debouncedSearchQuery : (isPotentialGroupLookup ? viewType : '');
  const orderSearch = debouncedOrderQuery || debouncedSearchQuery;
  const effectiveOrderFilters = React.useMemo(() => ({
    query: orderSearch,
    symbol: orderFilters.symbol,
    openOnly: orderFilters.openOnly,
    rangePreset: orderFilters.rangePreset,
    from: orderFilters.from,
    to: orderFilters.to,
    database: orderFilters.database,
  }), [
    orderFilters.database,
    orderFilters.from,
    orderFilters.openOnly,
    orderFilters.rangePreset,
    orderFilters.symbol,
    orderFilters.to,
    orderSearch,
  ]);
  const orderRecordFilter = React.useMemo(() => getOrderRecordFilter(effectiveOrderFilters), [effectiveOrderFilters]);
  const fromMs = parseOrderDateInput(orderFilters.from);
  const toMs = parseOrderDateInput(orderFilters.to);
  const orderDateRangeError = fromMs != null && toMs != null && fromMs > toMs ? 'From must be earlier than or equal to To.' : '';
  const pagingScopeKey = React.useMemo(() => JSON.stringify([
    viewType,
    pageSize,
    debouncedSearchQuery,
    debouncedOrderQuery,
    orderFilters.symbol,
    orderFilters.openOnly,
    orderFilters.rangePreset,
    orderFilters.from,
    orderFilters.to,
    orderFilters.database,
  ]), [
    viewType,
    pageSize,
    debouncedSearchQuery,
    debouncedOrderQuery,
    orderFilters.symbol,
    orderFilters.openOnly,
    orderFilters.rangePreset,
    orderFilters.from,
    orderFilters.to,
    orderFilters.database,
  ]);
  const pagingScopeRef = React.useRef(pagingScopeKey);
  const activePage = pagingScopeRef.current === pagingScopeKey ? page : 1;

  React.useEffect(() => {
    if (pagingScopeRef.current === pagingScopeKey) return;
    pagingScopeRef.current = pagingScopeKey;
    setPage(1);
  }, [pagingScopeKey]);

  React.useEffect(() => {
    setPageInputValue(String(activePage));
  }, [activePage]);

  const usesAccountDetailsMany = viewType === 'Clients' || viewType === 'Trading Accounts';
  const { data: accountsResponse, loading: accountsLoading, error: accountsError, mutate: refetchAccounts } = useAccounts(activePage, pageSize, debouncedSearchQuery, '', '', usesAccountDetailsMany);
  const { data: symbolsResponse, loading: symbolsLoading, error: symbolsError, mutate: refetchSymbols } = useInstruments(activePage, pageSize, debouncedSearchQuery, '', viewType === 'Symbols');
  // The Symbols grid also lists LP symbols that have no configured instrument yet.
  const [lpSymbolEntries, setLpSymbolEntries] = useState([]);
  const lpSymbolsRefreshRef = React.useRef(refreshTrigger);
  const isSymbolsGrid = viewType === 'Symbols';
  React.useEffect(() => {
    if (!isSymbolsGrid) return undefined;
    const force = lpSymbolsRefreshRef.current !== refreshTrigger;
    lpSymbolsRefreshRef.current = refreshTrigger;
    let cancelled = false;
    loadLpSymbols(InstrumentsService, { force })
      .then((entries) => { if (!cancelled) setLpSymbolEntries(entries); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isSymbolsGrid, refreshTrigger]);
  const { data: positionsResponse, loading: positionsLoading, error: positionsError, verified: positionsVerified, mutate: refetchPositions } = usePositions({ page: activePage, limit: pageSize }, true, 2000, viewType === 'Positions');
  const { data: ordersResponse, loading: ordersLoading, error: ordersError, mutate: refetchOrders } = useOrders({
    limit: pageSize,
    offset: (activePage - 1) * pageSize,
    search: orderSearch,
    symbol: orderFilters.symbol,
    from: orderFilters.from,
    to: orderFilters.to,
    openOnly: orderFilters.openOnly,
    matches: orderRecordFilter,
  }, viewType === 'Orders' && !orderDateRangeError);
  const { data: orderSymbolCatalog } = useDataFetch(InstrumentsService.getMarketSymbols, null, [], viewType === 'Orders', { requestKey: 'manager:order-symbols', cacheTtlMs: 30000 });

  const { data: groupsResponse, loading: groupsLoading, error: groupsError, mutate: refetchGroups } = useGroups(activePage, pageSize, groupSearch, shouldLoadGroups);

  React.useEffect(() => {
    if (!refreshTrigger) return;
    const map = {
      'Groups': refetchGroups,
      'Clients': refetchAccounts,
      'Trading Accounts': refetchAccounts,
      'Symbols': refetchSymbols,
      'Positions': refetchPositions,
      'Orders': refetchOrders,
    };
    map[viewType]?.();
  }, [refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: dealsResponse, loading: dealsLoading, error: dealsError, mutate: refetchDeals } = useDealsSummary(
    '',
    '',
    '',
    '',
    viewType === 'Deals',
    { page: activePage, limit: pageSize, search: debouncedSearchQuery, range: 'recent' }
  );

  React.useEffect(() => {
    if (refreshTrigger && viewType === 'Deals') refetchDeals?.();
  }, [refreshTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const [editingGroup, setEditingGroup] = useState(null);

  React.useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      setContextMenu({ visible: false });
    }, 0);

    return () => window.clearTimeout(resetTimer);
  }, [viewType]);

  React.useEffect(() => {
    if (viewType !== 'Positions') {
      const resetTimer = window.setTimeout(() => {
        setCloseAllSymbol('');
        setCloseAllNotice(null);
        setCloseAllBusy(false);
      }, 0);

      return () => window.clearTimeout(resetTimer);
    }
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

  const handleDeleteGroup = () => {
    if (!contextMenu.selectedGroup) return;
    setEditingGroup({ ...contextMenu.selectedGroup, initialTab: 'Migration' });
    setContextMenu({ ...contextMenu, visible: false });
  };

  const handleCloseAllBySymbol = async () => {
    if (!positionsVerified) return;
    const action = getCloseAllActionState({
      user: currentUser,
      symbol: closeAllSymbol,
      busy: closeAllBusy,
    });

    if (!action.canSubmit) {
      setCloseAllNotice({ tone: 'error', message: action.disabledReason });
      return;
    }

    const symbol = action.normalizedSymbol;
    const promptMessage = [
      getCloseAllConfirmationPrompt(symbol),
      'This will close every open position for that symbol in your admin scope.',
    ].join('\n\n');
    const confirmation = typeof window !== 'undefined'
      ? window.prompt(promptMessage, '')
      : null;

    if (!isCloseAllConfirmationAccepted(symbol, confirmation)) {
      setCloseAllNotice({ tone: 'warning', message: 'Close-all cancelled. Symbol confirmation did not match.' });
      return;
    }

    setCloseAllBusy(true);
    setCloseAllNotice({ tone: 'info', message: `Closing all ${symbol} positions...` });

    try {
      const result = await PositionsService.closeAll({ symbol });
      const closedCount = Number(result?.positions_closed ?? result?.closed ?? result?.count);
      const message = Number.isFinite(closedCount)
        ? `Closed ${closedCount} position${closedCount === 1 ? '' : 's'} for ${symbol}.`
        : `Close-all completed for ${symbol}.`;

      setCloseAllNotice({ tone: 'success', message });
      notify({ tone: 'success', title: 'Close all complete', description: message });
      refetchPositions?.();
    } catch (err) {
      const message = getApiErrorMessage(err, `Failed to close all positions for ${symbol}.`);
      setCloseAllNotice({ tone: 'error', message });
      notify({ tone: 'danger', title: 'Close all failed', description: message });
    } finally {
      setCloseAllBusy(false);
    }
  };

  const handleOrderStatusChange = (event) => {
    const openOnly = event.target.value === 'open';
    setOrderFilters((current) => ({
      ...current,
      openOnly,
    }));
  };

  const handleOrderRangePresetChange = (event) => {
    const rangePreset = event.target.value;
    setOrderFilters((current) => ({
      ...current,
      rangePreset,
      ...(rangePreset === 'custom' ? {} : getOrderDateRangeForPreset(rangePreset)),
    }));
  };

  const handleOrderRequest = () => {
    if (orderFilters.query !== debouncedOrderQuery) setDebouncedOrderQuery(orderFilters.query);
    else refetchOrders?.();
  };

  const handleOrderFilterSelectMouseDown = (event) => {
    if (event.target?.tagName === 'SELECT') return;

    const select = event.currentTarget.querySelector('select');
    if (!select || select.disabled) return;

    event.preventDefault();
    select.focus();

    if (typeof select.showPicker === 'function') {
      select.showPicker();
    }
  };

  const tableState = React.useMemo(() => {
    let columns = [];
    let data = [];
    let isClientsViewTemp = false;
    let isSymbolsViewTemp = false;
    let isPositionsViewTemp = false;
    let isAccountsViewTemp = false;
    let isGroupLookupViewTemp = false;
    let isLoading = false;
    let orderSymbolOptions = [];
    let pagination = null;

    if (viewType === 'Groups') {
      const pageData = getPagedMappedRows({
        response: groupsResponse,
        keys: ['answer', 'groups', 'data', 'items', 'rows'],
        page: activePage,
        pageSize,
        search: debouncedSearchQuery,
        mapFn: getGroupRow,
      });

      columns = GROUP_COLUMNS;
      data = pageData.rows;
      pagination = pageData;
      isGroupLookupViewTemp = true;
      isLoading = groupsLoading;
    } else if (viewType === 'Clients & Accounts') {
      columns = CLIENTS_COLUMNS;
      data = debouncedSearchQuery
        ? clientsAccountsTableData.filter((row) => matchesRecordSearch(row, debouncedSearchQuery))
        : clientsAccountsTableData;
      isClientsViewTemp = true;
    } else if (viewType === 'Clients') {
      const pageData = getPagedMappedRows({
        response: accountsResponse,
        keys: ['accounts', 'data', 'answer', 'items', 'rows'],
        page: activePage,
        pageSize,
        search: debouncedSearchQuery,
        mapFn: getBrokerClientRow,
      });

      columns = BROKER_CLIENT_COLUMNS;
      data = pageData.rows;
      pagination = pageData;
      isClientsViewTemp = true;
      isLoading = accountsLoading;
    } else if (viewType === 'Trading Accounts') {
      const pageData = getPagedMappedRows({
        response: accountsResponse,
        keys: ['accounts', 'data', 'answer', 'items', 'rows'],
        page: activePage,
        pageSize,
        search: debouncedSearchQuery,
        mapFn: getAccountRow,
      });

      columns = ACCOUNT_COLUMNS;
      data = pageData.rows;
      pagination = pageData;
      isAccountsViewTemp = true;
      isLoading = accountsLoading;
    } else if (viewType === 'Symbols') {
      const configuredPage = getPagedMappedRows({
        response: symbolsResponse,
        keys: ['instruments', 'symbols', 'data', 'answer', 'items', 'rows', 'value'],
        page: activePage,
        pageSize,
        search: debouncedSearchQuery,
        mapFn: getSymbolRow,
      });
      const pageData = symbolsResponse
        ? mergeUnconfiguredSymbolPage({
          paged: configuredPage,
          unconfiguredRows: getUnconfiguredSymbolRows(lpSymbolEntries, debouncedSearchQuery),
          page: activePage,
          pageSize,
          fallbackConfiguredTotal: lpSymbolEntries.filter((entry) => entry.configured).length,
        })
        : configuredPage;

      columns = SYMBOL_COLUMNS;
      data = pageData.rows;
      pagination = pageData;
      isSymbolsViewTemp = true;
      isLoading = symbolsLoading;
    } else if (viewType === 'Positions') {
      const pageData = getPagedMappedRows({
        response: positionsResponse,
        keys: ['data', 'positions', 'answer', 'items', 'rows'],
        page: activePage,
        pageSize,
        search: debouncedSearchQuery,
        mapFn: getPositionRow,
      });

      columns = POSITION_COLUMNS;
      data = pageData.rows;
      pagination = pageData;
      isPositionsViewTemp = true;
      isLoading = positionsLoading;
    } else if (viewType === 'Orders') {
      const applyLocalOrderFilter = hasActiveOrderFilter(effectiveOrderFilters);
      const pageData = getPagedMappedRows({
        response: ordersResponse,
        keys: ['data', 'orders', 'answer', 'items', 'rows'],
        page: activePage,
        pageSize,
        filterFn: applyLocalOrderFilter && !ordersResponse?.clientFiltered ? orderRecordFilter : undefined,
        mapFn: (order, idx) => getOrderDisplayRow(getOrderRow(order, idx)),
      });

      columns = ORDER_COLUMNS;
      data = pageData.rows;
      pagination = ordersResponse?.clientFiltered ? { ...pageData, hasNextPage: ordersResponse.hasNextPage } : pageData;
      orderSymbolOptions = getOrderSymbolOptions([
        ...normalizeArrayResponse(ordersResponse, ['data', 'orders', 'answer', 'items', 'rows']).map(order => getOrderRow(order, 0)),
        ...(Array.isArray(orderSymbolCatalog) ? orderSymbolCatalog.map(symbol => ({ symbol })) : []),
        { symbol: orderFilters.symbol },
      ]);
      isPositionsViewTemp = true;
      isLoading = ordersLoading;
    } else if (viewType === 'Deals') {
      const pageData = getPagedMappedRows({
        response: dealsResponse,
        keys: ['data', 'deals', 'answer', 'items', 'rows'],
        page: activePage,
        pageSize,
        search: debouncedSearchQuery,
        mapFn: getDealRow,
      });

      columns = DEAL_COLUMNS;
      data = pageData.rows;
      pagination = pageData;
      isPositionsViewTemp = true;
      isLoading = dealsLoading;
    } else if (viewType === 'Automations' || viewType === 'Security') {
      columns = CLIENTS_COLUMNS;
      if (viewType === 'Automations') data = automationsTableData;
      else data = securityTableData;
      if (debouncedSearchQuery) {
        data = data.filter((row) => matchesRecordSearch(row, debouncedSearchQuery));
      }
      isClientsViewTemp = true;
    } else {
      const pageData = getPagedMappedRows({
        response: groupsResponse,
        keys: ['answer', 'groups', 'data', 'items', 'rows'],
        page: activePage,
        pageSize,
        search: viewType,
        mapFn: getGroupRow,
      });
      const matchingGroup = pageData.rows.find((row) => row.group === viewType);

      isGroupLookupViewTemp = true;
      if (!groupsResponse && groupsLoading) {
        isLoading = true;
      }

      if (matchingGroup) {
        columns = GROUP_COLUMNS;
        data = [matchingGroup];
      } else {
        columns = [
          { label: 'Item Name', width: 'w-64' },
          { label: 'Status', width: 'w-32' },
          { label: 'Description', width: 'flex-1' },
        ];
        data = [];
      }
    }

    return {
      columns,
      data,
      isClientsView: isClientsViewTemp,
      isSymbolsView: isSymbolsViewTemp,
      isPositionsView: isPositionsViewTemp,
      isAccountsView: isAccountsViewTemp,
      isGroupLookupView: isGroupLookupViewTemp,
      isLoading,
      orderSymbolOptions,
      pagination,
    };
  }, [
    accountsLoading,
    accountsResponse,
    debouncedSearchQuery,
    dealsLoading,
    dealsResponse,
    effectiveOrderFilters,
    groupsLoading,
    groupsResponse,
    lpSymbolEntries,
    orderFilters.symbol,
    orderRecordFilter,
    orderSymbolCatalog,
    ordersLoading,
    ordersResponse,
    activePage,
    pageSize,
    positionsLoading,
    positionsResponse,
    symbolsLoading,
    symbolsResponse,
    viewType,
  ]);

  const {
    columns,
    data: unsortedData,
    isClientsView,
    isSymbolsView,
    isPositionsView,
    isAccountsView,
    isGroupLookupView,
    isLoading,
    orderSymbolOptions,
    pagination,
  } = tableState;
  const data = React.useMemo(() => sortToolbarRows(unsortedData, sortDirection, viewType), [unsortedData, sortDirection, viewType]);
  const windowedRows = ['Clients', 'Trading Accounts', 'Symbols', 'Orders', 'Positions', 'Deals'].includes(viewType);
  const rowHeight = viewType === 'Clients' ? 37 : viewType === 'Orders' ? 42 : 34;
  const clientWindow = useClientRowWindow(windowedRows, `${pagingScopeKey}|${activePage}`, data.length, {
    rowHeight, headerHeight: viewType === 'Clients' ? 33 : viewType === 'Orders' ? 36 : viewType === 'Deals' ? 30 : 34,
  });
  const rowsToRender = React.useMemo(() => windowedRows
    ? data.slice(clientWindow.start, clientWindow.end) : data,
  [data, windowedRows, clientWindow.start, clientWindow.end]);

  const knownTotalCount = pagination?.hasKnownTotal ? pagination.total : undefined;
  const renderedTotalCount = Number.isFinite(knownTotalCount) ? knownTotalCount : data.length;
  const renderedFilteredCount = renderedTotalCount;
  const mountedRowBytes = React.useMemo(() => estimateJsonBytes(data), [data]);
  const totalPages = pagination?.hasKnownTotal ? pagination.totalPages : undefined;
  const isAccountEditView = ACCOUNT_EDIT_VIEW_TYPES.has(viewType);
  const isGroupEditView = viewType === 'Groups' || isGroupLookupView;
  const isTradeDetailView = TRADE_DETAIL_VIEW_TYPES.has(viewType);
  const selectedEditableTargetKey = selectedEditableTargetId === undefined || selectedEditableTargetId === null
    ? ''
    : String(selectedEditableTargetId);

  const getRowEditTargetType = React.useCallback((row) => {
    if (!row) return null;
    if (isAccountEditView) return 'account';
    if (isTradeDetailView) return 'trade';
    if (isGroupEditView && row.iconType === 'group') return 'group';
    return null;
  }, [isAccountEditView, isGroupEditView, isTradeDetailView]);

  React.useEffect(() => {
    if (Number.isFinite(totalPages) && activePage > totalPages) {
      setPage(totalPages);
    }
  }, [activePage, totalPages]);

  React.useEffect(() => {
    if (!selectedEditableTargetType) return;
    const activeTypes = new Set([
      isAccountEditView ? 'account' : null,
      isGroupEditView ? 'group' : null,
      isTradeDetailView ? 'trade' : null,
    ].filter(Boolean));
    if (!activeTypes.has(selectedEditableTargetType)) {
      onEditableTargetSelect?.(null);
    }
  }, [isAccountEditView, isGroupEditView, isTradeDetailView, onEditableTargetSelect, selectedEditableTargetType]);

  React.useEffect(() => {
    if (!selectedEditableTargetKey || !selectedEditableTargetType) return;
    if (!data.some((row) => String(row.id) === selectedEditableTargetKey && getRowEditTargetType(row) === selectedEditableTargetType)) {
      onEditableTargetSelect?.(null);
    }
  }, [data, getRowEditTargetType, onEditableTargetSelect, selectedEditableTargetKey, selectedEditableTargetType]);

  React.useEffect(() => {
    if (
      renderedTotalCount !== lastSentRef.current.total ||
      renderedFilteredCount !== lastSentRef.current.filtered ||
      data.length !== lastSentRef.current.visible ||
      mountedRowBytes !== lastSentRef.current.bytes
    ) {
      const nextCounts = {
        total: renderedTotalCount,
        filtered: renderedFilteredCount,
        visible: data.length,
        bytes: mountedRowBytes,
      };
      lastSentRef.current = nextCounts;
      onCountChange?.(nextCounts);
    }
  }, [data.length, mountedRowBytes, renderedTotalCount, renderedFilteredCount, onCountChange]);

  React.useEffect(() => {
    onRowsChange?.(data);
  }, [data, onRowsChange]);

  // --- COMING SOON: sidebar views that have no backend yet ---
  // Renders a lightweight empty state so clicking these items doesn't show
  // a blank table. Remove an entry once that view gets wired to an API.
  if (COMING_SOON_VIEWS.has(viewType)) {
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

  if (FOLDER_ONLY_VIEWS.has(viewType)) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[color:var(--bg-app)] select-none">
        <div className="flex flex-col items-center gap-3 max-w-md text-center px-6">
          <div className="w-12 h-12 rounded-full bg-[color:var(--bg-surface-2)] border border-[color:var(--border-default)] flex items-center justify-center">
            <ShieldAlert size={20} className="text-[color:var(--text-muted)]" />
          </div>
          <div className="text-[14px] font-semibold text-[color:var(--text-primary)]">
            {viewType}
          </div>
          <div className="text-[12px] text-[color:var(--text-secondary)] leading-relaxed">
            This is a folder. Open one of the connected child pages from the sidebar.
          </div>
          <span className="mt-2 inline-flex items-center h-5 px-2 rounded-[var(--radius-sm)] border border-[color:var(--border-default)] text-[10px] font-mono uppercase tracking-wider text-[color:var(--text-muted)]">
            Folder only
          </span>
        </div>
      </div>
    );
  }

  // --- IMPORTED VIEWS ---
  if (viewType === 'Market Overview' || viewType === 'Symbols Browser') {
    return <MarketsView />;
  }
  if (viewType === 'Symbol Management') {
    return <MarketsView section="management" />;
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
  if (viewType === 'Analytics' || viewType === 'Client Analytics') {
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
  if (viewType === 'Server Config' || viewType === 'Server Configuration') {
    return <ServerConfigView />;
  }
  if (viewType === 'Managers') {
    return <ManagersView refreshTrigger={refreshTrigger} searchQuery={searchQuery} sortDirection={sortDirection} />;
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
  if (SUPPORT_CENTER_VIEWS.has(viewType)) {
    return <SupportCenterView />;
  }

  // --- PAYMENTS INJECTION ---
  if (viewType === 'Payments' || viewType === 'Payment Methods') {
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
  if (COMMUNICATIONS_VIEWS.has(viewType)) {
    return <CommunicationsView initialTab={viewType} />;
  }

  // --- SECURITY & ACCESS INJECTION ---
  if (SECURITY_ACCESS_VIEWS.has(viewType)) {
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

  // --- C09 DOWNSTREAM ACCESS INJECTION (broker Admin only) ---
  if (viewType === 'Downstream access') {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <DownstreamAccessView />
      </div>
    );
  }

  // --- FEED TENANTS INJECTION ---
  if (viewType === 'Feed Tenants') {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <FeedTenantsView />
      </div>
    );
  }

  // --- SERVER STATUS INJECTION ---
  if (SERVER_STATUS_VIEWS.has(viewType)) {
    return <ServerStatusPanel key={viewType} serverName={viewType} initialTab={initialServerTab} onDoubleClick={() => setServerPopupData({ isOpen: true, target: viewType, id: 'SRV-001' })} />;
  }

  const activeError = {
    'Groups': groupsError,
    'Clients': accountsError,
    'Trading Accounts': accountsError,
    'Symbols': symbolsError,
    'Positions': positionsError,
    'Orders': ordersError,
    'Deals': dealsError,
  }[viewType] || (isGroupLookupView && groupsError && !groupsLoading ? groupsError : null);
  const activeErrorMessage = activeError
    ? getApiErrorMessage(activeError, `Failed to load ${viewType}.`)
    : '';

  const isPagedView = PAGED_VIEW_TYPES.has(viewType);
  const isBrokerClientsView = viewType === 'Clients';
  const isTradingAccountsView = viewType === 'Trading Accounts';
  const isAccountDirectoryView = isBrokerClientsView || isTradingAccountsView;
  const totalCount = renderedTotalCount;
  const activeFooterTabLabel = viewType === 'Clients & Accounts'
    ? 'Clients & Accounts'
    : (viewType === 'Groups' && totalCount > 0 ? `Groups (${totalCount})` : viewType);
  const pageStart = pagination?.pageStart ?? (data.length ? 1 : 0);
  const pageEnd = pagination?.pageEnd ?? data.length;
  const hasKnownPaginationTotal = Boolean(pagination?.hasKnownTotal);
  const canGoPreviousPage = isPagedView && !isLoading && activePage > 1;
  const canGoNextPage = isPagedView && !isLoading && Boolean(pagination?.hasNextPage);
  const canGoLastPage = isPagedView && !isLoading && hasKnownPaginationTotal && activePage < totalPages;
  const paginationRangeLabel = data.length
    ? `${formatCount(pageStart)}-${formatCount(pageEnd)}${hasKnownPaginationTotal ? ` of ${formatCount(pagination.total)}` : ''}`
    : (isLoading ? 'Loading...' : 'No rows');
  const paginationRangeAriaLabel = data.length ? `Rows ${paginationRangeLabel}` : paginationRangeLabel;
  const showAccountPageNavigation = activePage > 1 || Boolean(pagination?.hasNextPage) || (hasKnownPaginationTotal && totalPages > 1);

  const goToPage = (nextPage) => {
    setPage((currentPage) => {
      const resolvedPage = typeof nextPage === 'function' ? nextPage(currentPage) : nextPage;
      return clampPage(resolvedPage, totalPages);
    });
  };

  const commitPageInput = () => {
    if (pageInputValue.trim() === '') {
      setPageInputValue(String(activePage));
      return;
    }
    const nextPage = clampPage(pageInputValue, totalPages);
    setPageInputValue(String(nextPage));
    goToPage(nextPage);
  };

  const handlePageInputChange = (event) => {
    const nextValue = event.target.value;
    if (/^\d*$/.test(nextValue)) {
      setPageInputValue(nextValue);
    }
  };

  const handlePageInputKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitPageInput();
    } else if (event.key === 'Escape') {
      setPageInputValue(String(activePage));
      event.currentTarget.blur();
    }
  };

  const handlePageSizeChange = (event) => {
    const nextPageSize = Number(event.target.value);
    setPageSize(PAGE_SIZE_OPTIONS.includes(nextPageSize) ? nextPageSize : DEFAULT_PAGE_SIZE);
    setPage(1);
  };

  const handleRowClick = (row) => {
    if (isSymbolsView) {
      setSymbolSelection({ scope: `${pagingScopeKey}|${activePage}`, id: String(row.id) });
      return;
    }
    if (isPositionsView && row.symbol) {
      setCloseAllSymbol(row.symbol);
      setCloseAllNotice(null);
    }

    const targetType = getRowEditTargetType(row);
    onEditableTargetSelect?.(targetType
      ? { type: targetType, row, viewType, id: row.id }
      : null);
  };

  const isSelectedEditableRow = (row) => isSymbolsView
    ? symbolSelection.scope === `${pagingScopeKey}|${activePage}` && symbolSelection.id === String(row.id)
    : (
    selectedEditableTargetKey &&
    selectedEditableTargetType === getRowEditTargetType(row) &&
    String(row.id) === selectedEditableTargetKey
  );

  const closeAllSymbolOptions = isPositionsView
    ? Array.from(new Set(data.map((row) => row.symbol).filter(Boolean))).sort()
    : [];

  const closeAllNoticeClass = {
    success: 'text-[color:var(--success-500)]',
    error: 'text-[color:var(--danger-500)]',
    warning: 'text-[color:var(--warning-500)]',
    info: 'text-[color:var(--text-secondary)]',
  }[closeAllNotice?.tone] || 'text-[color:var(--text-secondary)]';

 
  if (viewType === 'Time') {
    return <TimeSettingsView />;
  }

  return (
    <div className={`flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden relative ${viewType === 'Orders' ? 'admin-orders-view' : viewType === 'Positions' ? 'admin-positions-view' : viewType === 'Symbols' ? 'admin-symbols-view' : ''}`} onContextMenu={handleContextMenu}>
      {serverPopupData && (
        <Suspense fallback={null}>
          <ServerPropertiesPopup
            isOpen={serverPopupData.isOpen}
            onClose={() => setServerPopupData(null)}
            serverName={serverPopupData.target}
            serverId={serverPopupData.id}
          />
        </Suspense>
      )}
      {viewType === 'Orders' && (
        <OrderFilterPlacement host={orderFilterHost}>
        <div className="admin-orders-filters" role="search" aria-label="Order filters">
          <div className="admin-orders-search">
            <div><Search size={13} aria-hidden="true" /></div>
            <input
              type="text"
              aria-label="Search orders by group, account, or ticket"
              value={viewType === 'Orders' ? orderFilters.query : ''}
              onChange={(event) => {
                if (viewType !== 'Orders') return;
                setOrderFilters((current) => ({
                  ...current,
                  query: event.target.value,
                }));
              }}
              onKeyDown={(event) => {
                if (viewType === 'Orders' && event.key === 'Enter') handleOrderRequest();
              }}
              placeholder="Search account, ticket, or symbol…"
              className="bg-transparent border-none outline-none text-[color:var(--text-primary)]"
            />
          </div>

          <div
            className={`${orderFilterSelectShellClassName} admin-orders-select admin-orders-select--symbol`}
            onMouseDown={handleOrderFilterSelectMouseDown}
          >
            <select
              aria-label="Order symbol"
              value={viewType === 'Orders' ? orderFilters.symbol : ''}
              onChange={(event) => {
                if (viewType !== 'Orders') return;
                setOrderFilters((current) => ({
                  ...current,
                  symbol: event.target.value,
                }));
              }}
              className={orderFilterSelectClassName}
            >
              <option value="" className={orderFilterSelectOptionClassName} style={orderFilterSelectOptionStyle}>All Symbols</option>
              {viewType === 'Orders' && orderSymbolOptions.map((symbol) => (
                <option key={symbol} value={symbol} className={orderFilterSelectOptionClassName} style={orderFilterSelectOptionStyle}>{symbol}</option>
              ))}
            </select>
            <div className="px-1 pointer-events-none text-[color:var(--text-muted)]"><ChevronDown size={12} /></div>
          </div>

          <div className={`${orderFilterSelectShellClassName} admin-orders-select admin-orders-select--status`} onMouseDown={handleOrderFilterSelectMouseDown}>
            <select aria-label="Order status" value={orderFilters.openOnly ? 'open' : 'all'} onChange={handleOrderStatusChange} className={orderFilterSelectClassName}>
              <option value="all" className={orderFilterSelectOptionClassName} style={orderFilterSelectOptionStyle}>All orders</option>
              <option value="open" className={orderFilterSelectOptionClassName} style={orderFilterSelectOptionStyle}>Open orders</option>
            </select>
            <div className="px-1 pointer-events-none text-[color:var(--text-muted)]"><ChevronDown size={12} /></div>
          </div>

          <div
            className={`${orderFilterSelectShellClassName} admin-orders-select admin-orders-select--range`}
            onMouseDown={handleOrderFilterSelectMouseDown}
          >
            <select
              aria-label="Order date range"
              value={viewType === 'Orders' ? orderFilters.rangePreset : 'all'}
              onChange={viewType === 'Orders' ? handleOrderRangePresetChange : undefined}
              className={orderFilterSelectClassName}
            >
              <option value="all" className={orderFilterSelectOptionClassName} style={orderFilterSelectOptionStyle}>All</option>
              <option value="today" className={orderFilterSelectOptionClassName} style={orderFilterSelectOptionStyle}>Today</option>
              <option value="last7" className={orderFilterSelectOptionClassName} style={orderFilterSelectOptionStyle}>Last 7</option>
              <option value="month" className={orderFilterSelectOptionClassName} style={orderFilterSelectOptionStyle}>Month</option>
              <option value="custom" className={orderFilterSelectOptionClassName} style={orderFilterSelectOptionStyle}>Custom</option>
            </select>
            <div className="px-1 pointer-events-none text-[color:var(--text-muted)]"><ChevronDown size={12} /></div>
          </div>

          <div className="admin-orders-date-range">
            <OrderDateTimePicker
              label="From" boundary="from" value={orderFilters.from}
              onChange={from => setOrderFilters(current => ({ ...current, from, rangePreset: 'custom' }))}
            />
            <OrderDateTimePicker
              label="To" boundary="to" value={orderFilters.to}
              onChange={to => setOrderFilters(current => ({ ...current, to, rangePreset: 'custom' }))}
            />
          </div>

          {orderDateRangeError && <span className="admin-orders-filter-error" role="alert">{orderDateRangeError}</span>}
        </div>
        </OrderFilterPlacement>
      )}

      {viewType === 'Positions' && (
        <div className="admin-positions-toolbar">
          <span className="admin-positions-toolbar-label">Open positions</span>
          {positionsResponse && !positionsVerified && <span role="status" className="text-xs text-[color:var(--text-muted)]">Updating positions…</span>}
          <div className="admin-positions-close-controls">
              <label htmlFor="positions-close-symbol">Close by symbol</label>
              <PositionSymbolPicker
                value={closeAllSymbol}
                onChange={(symbol) => {
                  setCloseAllSymbol(symbol);
                  setCloseAllNotice(null);
                }}
                options={closeAllSymbolOptions}
                disabled={!closeAllAction.hasClosePermission || closeAllBusy}
                title={closeAllAction.hasClosePermission ? 'Symbol to close' : closeAllAction.disabledReason}
              />
              <button
                type="button"
                onClick={handleCloseAllBySymbol}
                disabled={!closeAllAction.canSubmit || !positionsVerified}
                title={closeAllAction.disabledReason || `Close all positions for ${closeAllAction.normalizedSymbol}`}
                className="admin-positions-close-button"
              >
                <ShieldAlert size={12} />
                {closeAllBusy ? 'Closing…' : 'Close All'}
              </button>
          </div>
          {closeAllNotice && (
            <div className={`admin-positions-notice ${closeAllNoticeClass}`} data-tone={closeAllNotice.tone} role={closeAllNotice.tone === 'error' ? 'alert' : 'status'}>
              <span>{closeAllNotice.message}</span>
              <button type="button" aria-label="Dismiss position message" onClick={() => setCloseAllNotice(null)}><X size={12} aria-hidden="true" /></button>
            </div>
          )}
        </div>
      )}

      {/* Header and rows share one scroll surface so columns stay aligned. */}
      <div
        ref={windowedRows ? clientWindow.scrollRef : undefined}
        onScroll={windowedRows ? clientWindow.onScroll : undefined}
        className="flex-1 min-h-0 overflow-auto bg-[color:var(--bg-app)]"
      >
        <div className={isSymbolsView ? 'admin-symbols-grid' : isTradingAccountsView ? 'admin-trading-grid' : viewType === 'Orders' ? 'admin-orders-grid' : viewType === 'Positions' ? 'admin-positions-grid' : isBrokerClientsView ? 'w-full min-w-[1160px]' : 'w-max min-w-full'}>
      <div data-export-header="true" className={isSymbolsView ? 'admin-symbols-header' : isTradingAccountsView ? 'admin-trading-header' : isBrokerClientsView ? 'admin-clients-header sticky top-0 z-10' : 'sticky top-0 z-10 flex h-[30px] w-full items-center border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-2)] shadow-sm'}>
        {columns.map((col, idx) => (
          <div
            key={idx}
            className={isSymbolsView ? 'admin-column-header admin-symbols-column' : isTradingAccountsView ? `admin-column-header admin-trading-column ${NUMERIC_COLUMN_LABELS.has(col.label) ? 'admin-trading-number' : ''}` : isBrokerClientsView ? 'admin-column-header admin-client-column' : `admin-column-header ${col.width} px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] hover:bg-[color:var(--bg-surface-3)] cursor-default flex items-center shrink-0 ${NUMERIC_COLUMN_LABELS.has(col.label) ? 'justify-end tabular-nums text-right' : ''}`}
          >
            {col.label}
          </div>
        ))}
        {/* Fill remaining space if needed */}
        {viewType === 'Groups' && <div className="flex-1 border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-2)]"></div>}
      </div>

        {windowedRows && clientWindow.before > 0 && <div aria-hidden="true" style={{ height: clientWindow.before }} />}
        {rowsToRender.map((row, idx) => (
          <div
            key={row.id}
            data-export-row="true"
            data-row-index={windowedRows ? clientWindow.start + idx : undefined}
            onClick={() => handleRowClick(row)}
            onDoubleClick={() => onRowDoubleClick && onRowDoubleClick(row)}
            onContextMenu={(e) => { e.stopPropagation(); handleContextMenu(e, row); }}
            onKeyDown={isAccountDirectoryView || isSymbolsView ? (event) => {
              if (isSymbolsView) {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleRowClick(row); }
                return;
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                handleRowClick(row);
                onRowDoubleClick?.(row);
              } else if (event.key === ' ') {
                event.preventDefault();
                handleRowClick(row);
              }
            } : undefined}
            role={isAccountDirectoryView || isSymbolsView ? 'button' : undefined}
            tabIndex={isAccountDirectoryView || isSymbolsView ? 0 : undefined}
            aria-label={isSymbolsView ? `Select ${row.symbol} symbol` : isAccountDirectoryView ? `Select ${row.name || row.login || 'client'} account; press Enter to edit` : undefined}
            aria-pressed={isAccountDirectoryView || isSymbolsView ? Boolean(isSelectedEditableRow(row)) : undefined}
            data-selected={isAccountDirectoryView || isSymbolsView || viewType === 'Orders' || viewType === 'Positions' ? Boolean(isSelectedEditableRow(row)) : undefined}
            data-stripe={windowedRows ? ((clientWindow.start + idx) % 2 === 0 ? 'even' : 'odd') : undefined}
            className={isSymbolsView ? 'admin-symbols-row' : isTradingAccountsView ? 'admin-trading-row' : isBrokerClientsView ? 'admin-clients-row' : `flex min-h-[var(--row-h)] w-full cursor-pointer group border-b border-[color:var(--border-subtle)] transition-colors ${isSelectedEditableRow(row) ? 'bg-[color:var(--bg-surface-2)] text-[color:var(--text-primary)]' : (idx % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]')} hover:bg-[color:var(--bg-surface-3)]`}
            style={{ ...(windowedRows ? { height: rowHeight, minHeight: rowHeight, flexShrink: 0 } : {}), ...(!isBrokerClientsView && isSelectedEditableRow(row) ? { boxShadow: 'inset 2px 0 0 var(--accent-500)' } : {}) }}
          >
            {isBrokerClientsView ? (
              <>
                <div className="admin-client-cell admin-client-cell--name" title={String(row.name ?? '')}>
                  <span className="admin-client-name">{renderClientField(row.name)}</span>
                </div>
                <div className="admin-client-cell admin-client-cell--login" title={String(row.login ?? '')}><span className="admin-client-value">{renderClientField(row.login)}</span></div>
                <div className="admin-client-cell admin-client-cell--email" title={String(row.email ?? '')}><span className="admin-client-value">{renderClientField(row.email)}</span></div>
                <div className="admin-client-cell admin-client-cell--phone" title={String(row.phone ?? '')}><span className="admin-client-value">{renderClientField(row.phone)}</span></div>
                <div className="admin-client-cell admin-client-cell--group" title={String(row.group ?? '')}>
                  <span className="admin-client-value">{renderClientField(row.group)}</span>
                </div>
                <div className="admin-client-cell admin-client-cell--status">
                  <span className="admin-client-status" data-tone={getClientStatusTone(row.status)} title={String(row.status ?? '')}>{formatClientStatus(row.status)}</span>
                </div>
              </>
            ) : isClientsView ? (
              <>
                <div className="w-64 px-3 py-1.5 text-[12px] flex items-center gap-2 border-r border-[color:var(--border-subtle)] shrink-0">
                  {row.iconType === 'group' ? <YellowFolderIcon /> : <BlueUserIcon />}
                  <span className="text-[color:var(--text-primary)] truncate font-normal">{row.name}</span>
                </div>
                <div className="flex-1 px-3 py-1.5 text-[12px] text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] truncate">{row.description}</div>
              </>
            ) : isSymbolsView ? (
              <>
                <div className="admin-symbols-cell admin-symbols-code" title={row.symbol}>
                  <Hash size={12} strokeWidth={1.5} aria-hidden="true" />
                  <span className="admin-symbols-name">{row.symbol}</span>
                </div>
                <div className="admin-symbols-cell admin-symbols-description" title={String(row.description || '')}>{row.description || <span className="admin-symbols-empty">—</span>}</div>
                <div className="admin-symbols-cell admin-symbols-number">{row.digits === '' || row.digits == null ? <span className="admin-symbols-empty">—</span> : row.digits}</div>
                <div className="admin-symbols-cell">{row.type === '' || row.type == null ? <span className="admin-symbols-empty">—</span> : row.type}</div>
                <div className="admin-symbols-cell" title={row.notConfigured ? 'Available from the feed; instrument setup is required before trading.' : String(row.execution || '')}>
                  <span className="admin-symbols-execution" data-tone={row.notConfigured ? 'pending' : String(row.execution).toLowerCase() === 'enabled' ? 'enabled' : String(row.execution).toLowerCase() === 'disabled' ? 'disabled' : 'neutral'}>
                    <span aria-hidden="true" />{row.execution || '—'}
                  </span>
                </div>
                <div className="admin-symbols-cell admin-symbols-expiration">{row.expiration || <span className="admin-symbols-empty">—</span>}</div>
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
                  if (col.label === 'Side' || col.label === 'Action') val = row.side ?? row.action;
                  if (col.label === 'Volume') val = row.volume;
                  if (col.label === 'Price Open' || col.label === 'Price') val = row.open_price ?? row.price;
                  if (col.label === 'Price Current') val = row.current_price;
                  if (col.label === 'S/L') val = row.sl;
                  if (col.label === 'T/P') val = row.tp;
                  if (col.label === 'Swap') val = row.swap;
                  if (col.label === 'Entry') val = row.entry;
                  if (col.label === 'Commission') val = row.commission;
                  if (col.label === 'Fee') val = row.fee;
                  if (col.label === 'Profit') val = row.profit;
                  if (col.label === 'Status') val = row.status;
                  if (col.label === 'Comment') val = row.comment;

                  const rawValue = val;
                  if (viewType === 'Orders') {
                    const priceDigits = row.raw?.digits ?? row.raw?.Digits ?? row.raw?.price_digits ?? row.raw?.PriceDigits;
                    if (['Price Open', 'S/L', 'T/P'].includes(col.label)) val = formatOrderNumber(val, priceDigits);
                    if (col.label === 'Volume') val = formatOrderNumber(val, row.raw?.volume_digits ?? row.raw?.VolumeDigits, 2);
                    if (col.label === 'Time') val = formatOrderTime(row.timeMs, row.time);
                    if (col.label === 'Side') val = getTradeSideLabel(val);
                    if (col.label === 'Status') val = String(val || '—').replace(/^./, char => char.toUpperCase());
                  }
                  if (viewType === 'Positions') {
                    const priceDigits = row.raw?.digits ?? row.raw?.Digits ?? row.raw?.price_digits ?? row.raw?.PriceDigits;
                    if (['Price Open', 'Price Current', 'S/L', 'T/P'].includes(col.label)) {
                      val = ['S/L', 'T/P'].includes(col.label) && Number(val) === 0 ? '—' : formatOrderNumber(val, priceDigits);
                    }
                    if (col.label === 'Volume') val = formatOrderNumber(val, row.raw?.volume_digits ?? row.raw?.VolumeDigits, 2);
                    if (['Swap', 'Profit'].includes(col.label)) val = formatOrderNumber(val, row.raw?.currency_digits ?? row.raw?.digits_currency ?? row.raw?.CurrencyDigits ?? 2);
                    if (col.label === 'Time') val = formatOrderTime(row.timeMs, row.time);
                  }

                  const displayVal = viewType === 'Deals' && col.label === 'Action'
                    ? formatDealActionLabel(val)
                    : viewType === 'Deals' && col.label === 'Entry'
                      ? formatDealEntryLabel(val)
                      : val;
                  const isSideCol = col.label === 'Side' || col.label === 'Action';
                  const sideIsBuy = isSideCol && String(displayVal).toLowerCase() === 'buy';
                  const sideIsSell = isSideCol && String(displayVal).toLowerCase() === 'sell';
                  const isNumeric = NUMERIC_COLUMN_LABELS.has(col.label);
                  const cellToneClass = col.label === 'Profit' && row.profit > 0
                    ? 'text-[color:var(--market-profit)]'
                    : col.label === 'Profit' && row.profit < 0
                      ? 'text-[color:var(--market-loss)]'
                      : sideIsBuy
                        ? 'text-[color:var(--success-500)]'
                        : sideIsSell
                          ? 'text-[color:var(--danger-500)]'
                          : 'text-[color:var(--text-primary)]';

                  return (
                    <div key={cIdx} title={String(renderTableValue(viewType === 'Deals' ? displayVal : rawValue))} data-order-tone={viewType === 'Orders' ? (isSideCol ? String(val).toLowerCase() : col.label === 'Status' ? (isOpenOrderRow(row) ? 'open' : 'closed') : undefined) : undefined} data-position-tone={viewType === 'Positions' ? (isSideCol ? String(displayVal).toLowerCase() : col.label === 'Profit' ? (Number(row.profit) > 0 ? 'profit' : Number(row.profit) < 0 ? 'loss' : 'neutral') : undefined) : undefined} className={`${col.width} px-3 py-1.5 text-[11px] ${cellToneClass} border-r border-[color:var(--border-subtle)] shrink-0 ${isNumeric ? 'text-right tabular-nums' : ''} truncate`}>
                       {renderTableValue(displayVal)}
                    </div>
                  );
                })}
              </>
            ) : isAccountsView ? (
              <>
                <div className="admin-trading-cell admin-trading-login" title={String(row.login ?? '')}><span className="admin-trading-value">{renderClientField(row.login)}</span></div>
                <div className="admin-trading-cell admin-trading-name" title={String(row.name ?? '')}><span className="admin-trading-value">{renderClientField(row.name)}</span></div>
                <div className="admin-trading-cell" title={String(row.group ?? '')}><span className="admin-trading-value">{renderClientField(row.group)}</span></div>
                {['balance', 'equity'].map(key => (
                  <div key={key} title={String(row[key] ?? '')} className="admin-trading-cell admin-trading-number">
                    <span className="admin-trading-value">{formatAccountAmount(row[key], row.currency, row.raw?.currency_digits ?? row.raw?.digits_currency ?? row.raw?.CurrencyDigits)}</span>
                  </div>
                ))}
                <div className="admin-trading-cell" title={String(row.currency ?? '')}>{renderClientField(row.currency)}</div>
                <div className="admin-trading-cell"><span className="admin-client-status" data-tone={getClientStatusTone(row.status)} title={String(row.status ?? '')}>{formatClientStatus(row.status)}</span></div>
              </>
            ) : (
              <>
                <div className="w-64 px-3 py-1.5 text-[12px] flex items-center gap-2 border-r border-[color:var(--border-subtle)] shrink-0">
                  {row.iconType !== 'group' && <BlueUserIcon />}
                  <span className="text-[color:var(--text-primary)] truncate font-normal">{row.group}</span>
                </div>
                <div className="w-48 px-3 py-1.5 text-[12px] text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] shrink-0 truncate">{row.server}</div>
                <div className="w-64 px-3 py-1.5 text-[12px] text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] shrink-0 truncate">{row.company}</div>
                <div className="w-32 px-3 py-1.5 text-[12px] text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] shrink-0">{row.type}</div>
                <div className="w-40 px-3 py-1.5 text-[12px] text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] shrink-0">{row.auth}</div>
                <div className="w-48 px-3 py-1.5 text-[12px] text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] shrink-0">{row.risk}</div>
                <div title={String(row.margin ?? '')} className="w-32 px-3 py-1.5 text-right tabular-nums text-[12px] text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] shrink-0">{row.margin}</div>
                <div className="w-56 px-3 py-1.5 text-[12px] text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] shrink-0">{row.leverage}</div>
                <div className="w-24 px-3 py-1.5 text-[12px] text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] shrink-0">{row.currency}</div>
                <div className="flex-1 bg-transparent"></div>
              </>
            )}
          </div>
        ))}
        {windowedRows && clientWindow.after > 0 && <div aria-hidden="true" style={{ height: clientWindow.after }} />}
        {isLoading && data.length === 0 && (
          <div role="status" className="m-4 w-fit rounded-[4px] border border-[color:var(--border-default)] bg-[color:var(--bg-surface-1)] px-4 py-3 text-[12px] text-[color:var(--text-secondary)]">
            Loading {viewType.toLowerCase()}...
          </div>
        )}
        {!isLoading && activeError && (
          <div role="alert" className="m-4 w-fit max-w-[540px] rounded-[4px] border border-[color:var(--danger-500)]/30 bg-[color:var(--danger-500)]/10 px-4 py-3 text-[12px] text-[color:var(--danger-500)]">
            {activeErrorMessage}
          </div>
        )}
        {!isLoading && !activeError && data.length === 0 && (
          <div role="status" className="m-4 w-fit rounded-[4px] border border-[color:var(--border-default)] bg-[color:var(--bg-surface-1)] px-4 py-3 text-[12px] text-[color:var(--text-secondary)]">
            No {viewType.toLowerCase()} to show.
          </div>
        )}
        </div>
      </div>

      {/* Bottom Tab Bar (MT5 Style) */}
      {viewType === 'Orders' ? (
        <footer className="admin-orders-footer" aria-label="Orders pagination">
          <span className="admin-orders-range" aria-live="polite" aria-label={paginationRangeAriaLabel}>
              {data.length ? `Rows ${paginationRangeLabel}` : isLoading ? 'Loading orders…' : activeError ? 'Orders unavailable' : 'No orders'}
          </span>
          <div className="admin-orders-pagination">
            {showAccountPageNavigation && (
              <nav className="admin-orders-page-nav" aria-label="Order pages">
                <PaginationIconButton aria-label="Previous page" onClick={() => goToPage(current => current - 1)} disabled={!canGoPreviousPage}><ChevronLeft size={14} aria-hidden="true" /></PaginationIconButton>
                <label className="admin-orders-page-number">
                  <span>Page</span>
                  <input aria-label="Page number" type="text" inputMode="numeric" pattern="[0-9]*" value={pageInputValue} onChange={handlePageInputChange} onBlur={commitPageInput} onKeyDown={handlePageInputKeyDown} disabled={isLoading} />
                  {hasKnownPaginationTotal && <span>of {formatCount(totalPages)}</span>}
                </label>
                <PaginationIconButton aria-label="Next page" onClick={() => goToPage(current => current + 1)} disabled={!canGoNextPage}><ChevronRight size={14} aria-hidden="true" /></PaginationIconButton>
              </nav>
            )}
            <label className="admin-orders-page-size">
              <span>Rows per page</span>
              <select aria-label="Rows per page" value={pageSize} onChange={handlePageSizeChange} disabled={isLoading}>
                {PAGE_SIZE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>
        </footer>
      ) : viewType === 'Positions' ? (
        <footer className="admin-positions-footer" aria-label="Positions pagination">
          <span className="admin-positions-scope">Open positions</span>
          <div className="admin-positions-pagination">
            <span className="admin-positions-range" aria-live="polite" aria-label={paginationRangeAriaLabel}>
              {data.length ? `Rows ${paginationRangeLabel}` : isLoading ? 'Loading positions…' : activeError ? 'Positions unavailable' : 'No open positions'}
            </span>
            {showAccountPageNavigation && (
              <nav className="admin-positions-page-nav" aria-label="Position pages">
                <PaginationIconButton aria-label="Previous page" onClick={() => goToPage(current => current - 1)} disabled={!canGoPreviousPage}><ChevronLeft size={14} aria-hidden="true" /></PaginationIconButton>
                <label className="admin-positions-page-number">
                  <span>Page</span>
                  <input aria-label="Page number" type="text" inputMode="numeric" pattern="[0-9]*" value={pageInputValue} onChange={handlePageInputChange} onBlur={commitPageInput} onKeyDown={handlePageInputKeyDown} disabled={isLoading} />
                  {hasKnownPaginationTotal && <span>of {formatCount(totalPages)}</span>}
                </label>
                <PaginationIconButton aria-label="Next page" onClick={() => goToPage(current => current + 1)} disabled={!canGoNextPage}><ChevronRight size={14} aria-hidden="true" /></PaginationIconButton>
              </nav>
            )}
            <label className="admin-positions-page-size">
              <span>Rows per page</span>
              <select aria-label="Rows per page" value={pageSize} onChange={handlePageSizeChange} disabled={isLoading}>
                {PAGE_SIZE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>
        </footer>
      ) : isSymbolsView ? (
        <footer className="admin-symbols-footer" aria-label="Symbols pagination">
          <span className="admin-symbols-range" aria-live="polite">
            {data.length ? `Showing ${paginationRangeLabel} symbols` : isLoading ? 'Loading symbols…' : activeError ? 'Symbols unavailable' : 'No symbols'}
          </span>
          <div className="admin-symbols-page-controls">
            {showAccountPageNavigation && (
              <nav className="admin-symbols-page-nav" aria-label="Symbol pages">
                <PaginationIconButton aria-label="Previous page" onClick={() => goToPage(current => current - 1)} disabled={!canGoPreviousPage}><ChevronLeft size={14} aria-hidden="true" /></PaginationIconButton>
                <label className="admin-symbols-page-number">
                  <span>Page</span>
                  <input aria-label="Page number" type="text" inputMode="numeric" pattern="[0-9]*" value={pageInputValue} onChange={handlePageInputChange} onBlur={commitPageInput} onKeyDown={handlePageInputKeyDown} disabled={isLoading} />
                  {hasKnownPaginationTotal && <span>of {formatCount(totalPages)}</span>}
                </label>
                <PaginationIconButton aria-label="Next page" onClick={() => goToPage(current => current + 1)} disabled={!canGoNextPage}><ChevronRight size={14} aria-hidden="true" /></PaginationIconButton>
              </nav>
            )}
            <label className="admin-symbols-page-size">
              <span>Rows per page</span>
              <select aria-label="Rows per page" value={pageSize} onChange={handlePageSizeChange} disabled={isLoading}>
                {PAGE_SIZE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>
        </footer>
      ) : isTradingAccountsView ? (
        <footer className="admin-trading-footer" aria-label="Trading accounts pagination">
          <span className="admin-trading-range" aria-live="polite">
            {data.length ? `Showing ${paginationRangeLabel} ${hasKnownPaginationTotal && pagination.total === 1 ? 'account' : 'accounts'}` : isLoading ? 'Loading accounts…' : activeError ? 'Accounts unavailable' : 'No accounts'}
          </span>
          <div className="admin-trading-page-controls">
            <label className="admin-trading-page-size">
              <span>Rows per page</span>
              <select aria-label="Rows per page" value={pageSize} onChange={handlePageSizeChange} disabled={isLoading}>
                {PAGE_SIZE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            {showAccountPageNavigation && (
              <nav aria-label="Account pages" className="admin-trading-page-nav">
                <PaginationIconButton aria-label="Previous page" onClick={() => goToPage(current => current - 1)} disabled={!canGoPreviousPage}><ChevronLeft size={14} aria-hidden="true" /></PaginationIconButton>
                <label className="admin-trading-page-number">
                  <span>Page</span>
                  <input aria-label="Page number" type="text" inputMode="numeric" pattern="[0-9]*" value={pageInputValue} onChange={handlePageInputChange} onBlur={commitPageInput} onKeyDown={handlePageInputKeyDown} disabled={isLoading} />
                  {hasKnownPaginationTotal && <span>of {formatCount(totalPages)}</span>}
                </label>
                <PaginationIconButton aria-label="Next page" onClick={() => goToPage(current => current + 1)} disabled={!canGoNextPage}><ChevronRight size={14} aria-hidden="true" /></PaginationIconButton>
              </nav>
            )}
          </div>
        </footer>
      ) : (
      <div className="min-h-10 bg-[color:var(--bg-surface-1)] border-t border-[color:var(--border-default)] flex flex-wrap items-center gap-1.5 px-2 py-1.5 shadow-[var(--shadow-sm)]">
        <div className="flex min-w-0 shrink-0 items-center gap-1 overflow-hidden">
            <>
              <div
                className="h-8 max-w-[220px] truncate px-3 bg-[color:var(--accent-500)]/18 text-[color:var(--text-primary)] text-[11px] flex items-center border border-[color:var(--accent-500)]/45 rounded-[3px] shadow-sm cursor-default"
                title={activeFooterTabLabel}
              >
                <span className="truncate">{activeFooterTabLabel}</span>
              </div>
              {!isBrokerClientsView && (
                <div className="hidden h-8 max-w-[160px] truncate px-2 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] text-[11px] sm:flex items-center cursor-default transition-colors">
                  All {viewType}
                </div>
              )}
            </>
        </div>
        {isPagedView && (
          <div className="ml-auto flex min-w-0 max-w-full items-center justify-end gap-1.5 overflow-x-auto no-scrollbar whitespace-nowrap text-[11px] text-[color:var(--text-muted)]">
            <div
              className="flex h-7 min-w-[132px] shrink-0 items-center gap-1.5 rounded-[2px] border border-[color:var(--border-default)] bg-[color:var(--bg-surface-1)] px-2"
              aria-live="polite"
              aria-label={paginationRangeAriaLabel}
            >
              <span className="text-[11px] font-semibold uppercase text-[color:var(--text-muted)]">{data.length ? 'Rows' : 'Status'}</span>
              <span className="font-mono tabular-nums tracking-tight text-[color:var(--text-secondary)]">{paginationRangeLabel}</span>
            </div>
            <PaginationIconButton
              aria-label="First page"
              onClick={() => goToPage(1)}
              disabled={!canGoPreviousPage}
            >
              <ChevronsLeft size={14} strokeWidth={1.8} aria-hidden="true" />
            </PaginationIconButton>
            <PaginationIconButton
              aria-label="Previous page"
              onClick={() => goToPage((current) => current - 1)}
              disabled={!canGoPreviousPage}
            >
              <ChevronLeft size={14} strokeWidth={1.8} aria-hidden="true" />
            </PaginationIconButton>
            <label className="flex h-7 shrink-0 items-center gap-1.5 rounded-[2px] border border-[color:var(--border-default)] bg-[color:var(--bg-surface-1)] px-1.5 text-[color:var(--text-muted)]">
              <span className="text-[11px]">Page</span>
              <input
                aria-label="Page number"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pageInputValue}
                onChange={handlePageInputChange}
                onBlur={commitPageInput}
                onKeyDown={handlePageInputKeyDown}
                disabled={isLoading}
                className={`${paginationFieldClassName} w-14 px-1 text-center font-mono tabular-nums`}
              />
              {hasKnownPaginationTotal && (
                <span className="font-mono tabular-nums text-[color:var(--text-muted)]">/ {formatCount(totalPages)}</span>
              )}
            </label>
            <PaginationIconButton
              aria-label="Next page"
              onClick={() => goToPage((current) => current + 1)}
              disabled={!canGoNextPage}
            >
              <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />
            </PaginationIconButton>
            <PaginationIconButton
              aria-label="Last page"
              onClick={() => goToPage(totalPages)}
              disabled={!canGoLastPage}
            >
              <ChevronsRight size={14} strokeWidth={1.8} aria-hidden="true" />
            </PaginationIconButton>
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={handlePageSizeChange}
              disabled={isLoading}
              className={`${paginationFieldClassName} shrink-0 px-2 font-mono tabular-nums`}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option} rows</option>
              ))}
            </select>
          </div>
        )}
      </div>
      )}
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
        <Suspense fallback={null}>
        <GroupPropertiesPopup
          group={editingGroup}
          initialTab={editingGroup.initialTab}
          onClose={() => setEditingGroup(null)}
          onSaved={result => { if (result?.action) { if (!onGroupsChanged) refreshGroupMembership(result); onEditableTargetSelect?.(null); setContextMenu({ visible: false }); } else refetchGroups(); onGroupsChanged?.(result); }}
        />
        </Suspense>
      )}
    </div>
  );
};

const AdminDataTable = (props) => (
  <Suspense fallback={(
    <div
      role="status"
      aria-live="polite"
      className="flex-1 min-h-0 flex items-center justify-center bg-[color:var(--bg-app)] text-[12px] text-[color:var(--text-secondary)]"
    >
      Loading {props.viewType || 'workspace'}...
    </div>
  )}>
    <AdminDataTableContent {...props} />
  </Suspense>
);

export default AdminDataTable;
