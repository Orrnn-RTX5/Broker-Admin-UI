import React, { useState } from 'react';
import {
  clientsAccountsTableData,
  automationsTableData,
  securityTableData
} from '../../data/terminalData.jsx';
import { useGroups } from '../../hooks/useAdmin';
import { usePositions, useOrders, useDealsSummary } from '../../hooks/usePositions';
import { useInstruments } from '../../hooks/useInstruments';
import { useAccounts } from '../../hooks/useAccounts';
import { ManagerService } from '../../services/manager.service';
import { PositionsService } from '../../services/positions.service';
import { useAuthStore } from '../../store/authStore';
import { normalizePagedResponse, getApiErrorMessage } from '../../utils/apiShapes';
import {
  getCloseAllActionState,
  getCloseAllConfirmationPrompt,
  isCloseAllConfirmationAccepted,
} from '../../utils/closeAllAction';
import { canAccessView } from '../../utils/permissions';
import { useToast } from '../ui/useToast';
import {
  Clock,
  CornerUpRight,
  Server,
  Calendar,
  Search,
  ChevronDown,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

import AdminContextMenu from './AdminContextMenu';
import NetworkCluster from './NetworkCluster';
import AllocationsView from './AllocationsView';
import GatewaysView from './GatewaysView';
import ServerStatusPanel from './ServerStatusPanel';
import ServerPropertiesPopup from '../RIGHTCLICKJPOPUPS/ServerPropertiesPopup';
import CreateGroupPopup from '../RIGHTCLICKJPOPUPS/CreateGroupPopup';

import FeedTenantsView from './FeedTenantsView';
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
const orderFilterSelectShellClassName = 'flex border border-[color:var(--border-strong)] bg-transparent h-[22px] items-center text-[color:var(--text-primary)] cursor-pointer hover:bg-white/10';
const orderFilterSelectClassName = 'bg-[color:var(--bg-surface-1)] border-none outline-none w-full h-full text-[11px] px-1 appearance-none cursor-pointer text-[color:var(--text-primary)] [color-scheme:dark]';
const orderFilterSelectOptionClassName = 'bg-[color:var(--bg-surface-2)] text-[color:var(--text-primary)]';
const orderFilterSelectOptionStyle = {
  backgroundColor: 'var(--bg-surface-2)',
  color: 'var(--text-primary)',
};
const paginationButtonClassName = 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] border border-[color:var(--border-strong)] bg-[color:var(--bg-app)] text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--bg-surface-3)] hover:text-[color:var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--accent-500)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-[color:var(--bg-app)]';
const paginationFieldClassName = 'h-7 rounded-[3px] border border-[color:var(--border-strong)] bg-[color:var(--bg-app)] text-[11px] text-[color:var(--text-primary)] outline-none focus-visible:border-[color:var(--accent-500)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

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

const getOrderRow = (order, idx) => ({
  id: pickDefined(order, ['ticket', 'Ticket', 'order', 'Order', 'orderTicket', 'OrderTicket'], idx),
  ticket: pickDefined(order, ['ticket', 'Ticket', 'order', 'Order', 'orderTicket', 'OrderTicket']),
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
  const ticket = pickDefined(position, ['ticket', 'positionTicket', 'Position', 'position', 'id'], idx);
  const rawTime = pickDefined(position, ['timeCreateFormatted', 'timeCreate', 'TimeCreate', 'time', 'Time', 'openTime', 'OpenTime']);

  return {
    id: ticket,
    ticket,
    login: pickDefined(position, ['login', 'Login', 'accountLogin', 'account_login']),
    time: position.timeCreateFormatted || formatTradeTimestamp(rawTime),
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
  const name = pickDefined(account, ['name', 'Name', 'client_name', 'clientName', 'full_name', 'fullName', 'user_name', 'userName'], login || '-');
  const email = pickDefined(account, ['email', 'Email']);
  const phone = pickDefined(account, ['phone', 'Phone']);
  const group = pickDefined(account, ['group', 'Group', 'group_name', 'groupName', 'account_group', 'accountGroup', 'accountGroupName']);
  const status = pickDefined(account, ['status', 'Status'], account.enabled === false || account.Enabled === false ? 'disabled' : 'active');

  return {
    id,
    iconType: 'user',
    name,
    description: [
      email,
      phone,
      group ? `Group: ${group}` : '',
      status ? `Status: ${status}` : '',
    ].filter(Boolean).join(' | '),
  };
};

const getAccountRow = (account, idx) => ({
  id: pickDefined(account, ['login', 'Login', 'account_login', 'accountLogin'], idx),
  login: pickDefined(account, ['login', 'Login', 'account_login', 'accountLogin']),
  name: pickDefined(account, ['name', 'Name', 'client_name', 'clientName', 'full_name', 'fullName', 'user_name', 'userName']),
  group: pickDefined(account, ['group', 'Group', 'group_name', 'groupName', 'account_group', 'accountGroup', 'accountGroupName']),
  balance: pickDefined(account, ['balance', 'Balance'], 0),
  equity: pickDefined(account, ['equity', 'Equity'], 0),
  currency: pickDefined(account, ['currency', 'Currency']),
  status: pickDefined(account, ['status', 'Status'], account.enabled === false || account.Enabled === false ? 'disabled' : 'active'),
});

const getSymbolRow = (symbol, idx) => ({
  id: symbol.id || symbol.symbol || idx,
  symbol: symbol.symbol || symbol.name || '',
  description: symbol.description || symbol.path || symbol.category || '',
  digits: symbol.digits ?? symbol.digits_currency ?? '',
  type: symbol.trade_mode || symbol.type || symbol.mode || '',
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
  { label: 'Type', key: 'type', width: 'w-32' },
  { label: 'Execution', key: 'execution', width: 'w-48' },
  { label: 'Expiration', key: 'expiration', width: 'w-32' },
  { label: 'Background', key: 'background', width: 'flex-1' },
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

const TimePropertyRow = ({ idx, icon, label, value }) => (
  <div className={`flex items-center text-[12px] border-b border-black/20 ${idx % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-blue-600/20 cursor-default`}>
    <div className="w-[320px] flex items-center gap-2 px-3 py-[3px] border-r border-black/20 shrink-0">
      {React.createElement(icon, { size: 13, className: 'text-[#3B82F6]' })}
      <span className="text-[color:var(--text-primary)]">{label}</span>
    </div>
    <div className="flex-1 px-3 py-[3px] text-[color:var(--text-primary)]">
      {value}
    </div>
  </div>
);

const TimeGroupHeader = ({ title }) => (
  <div className="flex border-b border-black/20 bg-[color:var(--bg-app)] cursor-default">
    <div className="w-[320px] px-3 py-1 text-[11px] font-bold text-white border-r border-black/20 shrink-0">
      {title}
    </div>
    <div className="flex-1"></div>
  </div>
);

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

const AdminDataTable = ({ onRowDoubleClick, viewType, onAddClick, initialServerTab, refreshTrigger, searchQuery = '', onCountChange }) => {
  const [contextMenu, setContextMenu] = useState({ x: 0, y: 0, visible: false });
  const [serverPopupData, setServerPopupData] = useState(null);
  const [closeAllSymbol, setCloseAllSymbol] = useState('');
  const [closeAllBusy, setCloseAllBusy] = useState(false);
  const [closeAllNotice, setCloseAllNotice] = useState(null);
  const [ordersMode, setOrdersMode] = useState('all');
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
  const orderFromDateInputRef = React.useRef(null);
  const orderToDateInputRef = React.useRef(null);

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
  const pagingScopeKey = React.useMemo(() => JSON.stringify([
    viewType,
    pageSize,
    debouncedSearchQuery,
    debouncedOrderQuery,
    ordersMode,
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
    ordersMode,
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
  const { data: positionsResponse, loading: positionsLoading, error: positionsError, mutate: refetchPositions } = usePositions({ page: activePage, limit: pageSize }, true, 2000, viewType === 'Positions');
  const { data: ordersResponse, loading: ordersLoading, error: ordersError, mutate: refetchOrders } = useOrders({
    limit: pageSize,
    offset: (activePage - 1) * pageSize,
    search: orderSearch,
    symbol: orderFilters.symbol,
    from: orderFilters.from,
    to: orderFilters.to,
    openOnly: orderFilters.openOnly,
  }, viewType === 'Orders');

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

  const [dealDateRange] = useState(() => {
    const now = Date.now();
    return {
      from: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
      to: new Date(now).toISOString()
    };
  });
  const { data: dealsResponse, loading: dealsLoading, error: dealsError, mutate: refetchDeals } = useDealsSummary(
    dealDateRange.from,
    dealDateRange.to,
    '',
    '',
    viewType === 'Deals',
    { page: activePage, limit: pageSize, search: debouncedSearchQuery }
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

  const handleCloseAllBySymbol = async () => {
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

  const handleOrderModeChange = (mode) => {
    setOrdersMode(mode);
    setOrderFilters((current) => ({
      ...current,
      openOnly: mode !== 'all',
    }));
  };

  const handleOrderOpenOnlyChange = (event) => {
    const openOnly = event.target.checked;
    setOrdersMode(openOnly ? 'open' : 'all');
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
    refetchOrders?.();
  };

  const openOrderDatePicker = (inputRef) => {
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.focus();
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

      columns = CLIENTS_COLUMNS;
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
      const pageData = getPagedMappedRows({
        response: symbolsResponse,
        keys: ['instruments', 'symbols', 'data', 'answer', 'items', 'rows', 'value'],
        page: activePage,
        pageSize,
        search: debouncedSearchQuery,
        mapFn: getSymbolRow,
      });

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
        filterFn: applyLocalOrderFilter ? getOrderRecordFilter(effectiveOrderFilters) : undefined,
        mapFn: (order, idx) => getOrderDisplayRow(getOrderRow(order, idx)),
      });

      columns = ORDER_COLUMNS;
      data = pageData.rows;
      pagination = pageData;
      orderSymbolOptions = getOrderSymbolOptions(data);
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
    data,
    isClientsView,
    isSymbolsView,
    isPositionsView,
    isAccountsView,
    isGroupLookupView,
    isLoading,
    orderSymbolOptions,
    pagination,
  } = tableState;

  const knownTotalCount = pagination?.hasKnownTotal ? pagination.total : undefined;
  const renderedTotalCount = Number.isFinite(knownTotalCount) ? knownTotalCount : data.length;
  const renderedFilteredCount = renderedTotalCount;
  const mountedRowBytes = React.useMemo(() => estimateJsonBytes(data), [data]);
  const totalPages = pagination?.hasKnownTotal ? pagination.totalPages : undefined;

  React.useEffect(() => {
    if (Number.isFinite(totalPages) && activePage > totalPages) {
      setPage(totalPages);
    }
  }, [activePage, totalPages]);

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
    goToPage(pageInputValue);
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

  const closeAllSymbolOptions = isPositionsView
    ? Array.from(new Set(data.map((row) => row.symbol).filter(Boolean))).sort()
    : [];

  const closeAllNoticeClass = {
    success: 'text-[#4ec9b0]',
    error: 'text-[#f48771]',
    warning: 'text-[#dcdcaa]',
    info: 'text-[color:var(--text-secondary)]',
  }[closeAllNotice?.tone] || 'text-[color:var(--text-secondary)]';

 
  if (viewType === 'Time') {
    return (
      <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden relative" onContextMenu={(e) => e.preventDefault()}>
        <div className="flex border-b border-black/40 bg-[color:var(--bg-surface-2)] sticky top-0 z-10 shadow-sm">
          <div className="w-[320px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 hover:bg-[color:var(--bg-surface-3)] cursor-default shrink-0">Property</div>
          <div className="flex-1 px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface-3)] cursor-default">Value</div>
        </div>
        <div className="flex-1 overflow-auto no-scrollbar bg-[color:var(--bg-app)]">
          <TimeGroupHeader title="Common settings" />
          <TimePropertyRow idx={0} icon={Clock} label="Time zone" value="GMT+01:00" />
          <TimePropertyRow idx={1} icon={CornerUpRight} label="Daylight Saving time correction" value="Yes" />
          <TimePropertyRow idx={2} icon={Server} label="Time synchronization with" value="time.cloudflare.com, pool.ntp.org" />

          <TimeGroupHeader title="Day settings" />
          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, idx) => (
            <TimePropertyRow key={day} idx={idx} icon={Calendar} label={day} value="00:00-24:00" />
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
              placeholder="Group or Accounts [1,2,..,1000] or Orders (#1,#2,..#1000)"
              className="bg-transparent border-none outline-none w-[280px] text-[11px] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)]"
            />
            <div className="border-l border-[color:var(--border-strong)] px-1 hover:bg-white/10 cursor-pointer h-full flex items-center">
              <ChevronDown size={12} />
            </div>
          </div>

          <div
            className={`${orderFilterSelectShellClassName} w-[100px] mr-2`}
            onMouseDown={handleOrderFilterSelectMouseDown}
          >
            <select
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

          <label className="flex items-center gap-1.5 text-[color:var(--text-primary)] cursor-pointer mr-2 border border-transparent hover:border-[color:var(--border-strong)] px-1 h-[22px] rounded-sm">
            <input
              type="checkbox"
              checked={viewType === 'Orders' ? orderFilters.openOnly : false}
              onChange={viewType === 'Orders' ? handleOrderOpenOnlyChange : undefined}
              className="w-[11px] h-[11px] accent-[#3B82F6]"
            />
            Open only
          </label>

          <div
            className={`${orderFilterSelectShellClassName} w-[70px] mr-1`}
            onMouseDown={handleOrderFilterSelectMouseDown}
          >
            <select
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

          <div className="flex border border-[color:var(--border-strong)] bg-transparent h-[22px] items-center text-[color:var(--text-primary)] mr-1">
            <input
              ref={orderFromDateInputRef}
              type="datetime-local"
              step="60"
              aria-label="Orders from date"
              value={viewType === 'Orders' ? orderFilters.from : ''}
              onChange={(event) => {
                if (viewType !== 'Orders') return;
                setOrderFilters((current) => ({
                  ...current,
                  from: event.target.value,
                  rangePreset: 'custom',
                }));
              }}
              className="order-date-input bg-transparent border-none outline-none w-[140px] text-[11px] pl-2"
            />
            <button
              type="button"
              onClick={() => openOrderDatePicker(orderFromDateInputRef)}
              className="border-l border-[color:var(--border-strong)] px-1.5 text-blue-400 hover:bg-white/10 cursor-pointer h-full flex items-center"
              aria-label="Select orders from date"
            >
              <Calendar size={12} />
            </button>
          </div>

          <div className="flex border border-[color:var(--border-strong)] bg-transparent h-[22px] items-center text-[color:var(--text-primary)] mr-2">
            <input
              ref={orderToDateInputRef}
              type="datetime-local"
              step="60"
              aria-label="Orders to date"
              value={viewType === 'Orders' ? orderFilters.to : ''}
              onChange={(event) => {
                if (viewType !== 'Orders') return;
                setOrderFilters((current) => ({
                  ...current,
                  to: event.target.value,
                  rangePreset: 'custom',
                }));
              }}
              className="order-date-input bg-transparent border-none outline-none w-[140px] text-[11px] pl-2"
            />
            <button
              type="button"
              onClick={() => openOrderDatePicker(orderToDateInputRef)}
              className="border-l border-[color:var(--border-strong)] px-1.5 text-blue-400 hover:bg-white/10 cursor-pointer h-full flex items-center"
              aria-label="Select orders to date"
            >
              <Calendar size={12} />
            </button>
          </div>

          <div
            className={`${orderFilterSelectShellClassName} w-[120px] mr-1`}
            onMouseDown={handleOrderFilterSelectMouseDown}
          >
            <select
              value={viewType === 'Orders' ? orderFilters.database : 'current'}
              onChange={(event) => {
                if (viewType !== 'Orders') return;
                setOrderFilters((current) => ({
                  ...current,
                  database: event.target.value,
                }));
              }}
              className={orderFilterSelectClassName}
            >
              <option value="current" className={orderFilterSelectOptionClassName} style={orderFilterSelectOptionStyle}>Current database</option>
            </select>
            <div className="px-1 pointer-events-none text-[color:var(--text-muted)]"><ChevronDown size={12} /></div>
          </div>

          {viewType === 'Positions' && (
            <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-[color:var(--border-strong)]">
              <input
                type="text"
                value={closeAllSymbol}
                onChange={(event) => {
                  setCloseAllSymbol(event.target.value);
                  setCloseAllNotice(null);
                }}
                disabled={!closeAllAction.hasClosePermission || closeAllBusy}
                list="close-all-symbol-options"
                aria-label="Close all positions symbol"
                placeholder="Symbol"
                className="bg-[color:var(--bg-app)] border border-[color:var(--border-strong)] text-[color:var(--text-primary)] text-[11px] h-[22px] px-2 rounded-[2px] outline-none w-[110px] focus:border-[#777777] disabled:opacity-50"
                title={closeAllAction.hasClosePermission ? 'Symbol to close' : closeAllAction.disabledReason}
              />
              <datalist id="close-all-symbol-options">
                {closeAllSymbolOptions.map((symbol) => (
                  <option key={symbol} value={symbol} />
                ))}
              </datalist>
              <button
                type="button"
                onClick={handleCloseAllBySymbol}
                disabled={!closeAllAction.canSubmit}
                title={closeAllAction.disabledReason || `Close all positions for ${closeAllAction.normalizedSymbol}`}
                className="inline-flex items-center gap-1 h-[22px] px-2.5 bg-[#3a1f1f] border border-[#7f3b34] rounded-[2px] text-[#f48771] hover:bg-[#4a2727] hover:border-[#a44b42] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ShieldAlert size={12} />
                {closeAllBusy ? 'Closing' : 'Close All'}
              </button>
              {closeAllNotice && (
                <span
                  role={closeAllNotice.tone === 'error' ? 'alert' : 'status'}
                  className={`max-w-[360px] truncate ${closeAllNoticeClass}`}
                  title={closeAllNotice.message}
                >
                  {closeAllNotice.message}
                </span>
              )}
            </div>
          )}
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
            onClick={() => {
              if (isPositionsView && row.symbol) {
                setCloseAllSymbol(row.symbol);
                setCloseAllNotice(null);
              }
            }}
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
                  if (col.label === 'Status') val = row.status;
                  if (col.label === 'Comment') val = row.comment;

                  return (
                    <div key={cIdx} className={`${col.width} px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 ${col.label === 'Profit' && row.profit > 0 ? 'text-green-400' : ''} ${col.label === 'Profit' && row.profit < 0 ? 'text-red-400' : ''} truncate`}>
                       {renderTableValue(val)}
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
        {!isLoading && activeError && (
          <div className="p-4 text-[#f48771] text-[12px] bg-[#f48771]/10 border-b border-[#f48771]/20">
            {activeErrorMessage}
          </div>
        )}
        {!isLoading && !activeError && data.length === 0 && (
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
      <div className="min-h-9 bg-[color:var(--bg-surface-1)] border-t border-black/40 flex flex-wrap items-center gap-1.5 px-1.5 py-1">
        <div className="flex min-w-0 shrink-0 items-center gap-1 overflow-hidden">
          {viewType === 'Orders' ? (
            <>
              <button
                type="button"
                onClick={() => handleOrderModeChange('open')}
                className={`h-7 shrink-0 px-3 text-[11px] flex items-center border border-black/40 rounded-[3px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--accent-500)] ${ordersMode !== 'all' ? 'bg-[#3e3e3e] text-white shadow-sm' : 'text-[#999999] hover:text-[color:var(--text-secondary)] hover:bg-white/5'}`}
              >
                Orders
              </button>
              <button
                type="button"
                onClick={() => handleOrderModeChange('all')}
                className={`h-7 shrink-0 px-3 text-[11px] flex items-center border border-black/40 rounded-[3px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--accent-500)] ${ordersMode === 'all' ? 'bg-[#3e3e3e] text-white shadow-sm' : 'text-[#999999] hover:text-[color:var(--text-secondary)] hover:bg-white/5'}`}
              >
                All Orders
              </button>
            </>
          ) : (
            <>
              <div
                className="h-7 max-w-[220px] truncate px-3 bg-[#3e3e3e] text-white text-[11px] flex items-center border border-black/40 rounded-[3px] shadow-sm cursor-default"
                title={activeFooterTabLabel}
              >
                <span className="truncate">{activeFooterTabLabel}</span>
              </div>
              <div className="hidden h-7 max-w-[160px] truncate px-2 text-[#999999] hover:text-[color:var(--text-secondary)] text-[11px] sm:flex items-center cursor-default transition-colors">
                All {viewType}
              </div>
            </>
          )}
        </div>
        {isPagedView && (
          <div className="ml-auto flex min-w-0 max-w-full items-center justify-end gap-1.5 overflow-x-auto no-scrollbar whitespace-nowrap text-[11px] text-[color:var(--text-muted)]">
            <div
              className="flex h-7 min-w-[132px] shrink-0 items-center gap-1.5 rounded-[3px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-app)] px-2"
              aria-live="polite"
              aria-label={paginationRangeAriaLabel}
            >
              <span className="text-[9px] font-semibold uppercase text-[color:var(--text-muted)]">{data.length ? 'Rows' : 'Status'}</span>
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
            <label className="flex h-7 shrink-0 items-center gap-1.5 rounded-[3px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-app)] px-1.5 text-[color:var(--text-muted)]">
              <span className="text-[10px]">Page</span>
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
