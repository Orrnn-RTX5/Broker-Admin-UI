import { lazy, memo, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowDownRight, ArrowUpRight, ChartNoAxesCombined, ChevronUp, ChevronDown, Minus,
  Folder, Search, Info, PanelLeftOpen, X,
} from 'lucide-react';
import {
  MarketWatchContextMenu,
  MarketWatchSymbolsModal,
} from './MarketWatchSymbolMenu';
import {
  DEFAULT_MW_COLUMNS,
  buildMt5SymbolContextMenuItems,
  buildMt5TickChartContextMenuItems,
  exportMarketWatchCsv,
  exportTickChartImage,
  matchesSymbolProfile,
} from './marketWatchSymbolMenuModel';
import useSymbolStore from '../../store/useSymbolStore';
import { InstrumentsService } from '../../services/instruments.service';
import { buildBrokerApiUrl } from '../../config/endpoints';
import { getRuntimeValue } from '../../config/runtimeConfig';
import { DEFAULT_WORKSPACE_LAYOUT } from '../../config/workspaceLayout';
import { useWorkspaceDockResize } from '../../hooks/useWorkspaceDockResize';
import {
  MT5_DOCK_MODES,
  MT5_DOCK_PANELS,
  applyMt5DockPlacement,
  createInitialMt5DockArrangement,
} from '../../utils/mt5DockLayout';
import Mt5SmartDockGuide from './Mt5SmartDockGuide';
import WorkspaceColumnResizer from './WorkspaceColumnResizer';
import {
  formatMarketPrice,
  formatMarketSpread,
  getAdminMarketTickBuffer,
  isMarketQuoteFresh,
  readMarketWatchViewCache,
  seedMarketTickHistory,
  validMarketPrice,
  writeMarketWatchViewCache,
  resolveSymbolQuote,
} from '../../utils/marketWatch';
import {
  buildTickChartCrosshair,
  buildTickChartGeometry,
  MARKET_WATCH_TICK_CHART_LIMIT,
} from './tickChartGeometry';
import {
  buildMarketWatchSymbolDetails,
  formatDailyChange,
  formatMarketWatchDetailsNumber,
  formatMarketWatchDetailsPrice,
  readInstrumentDescription,
  readMarketWatchSymbolSpecification,
} from './marketWatchSymbolDetailsModel';
import './MarketWatchDock.css';
import './market-watch-views.css';

const MARKET_WATCH_CACHE_WRITE_MS = 250;
const FALLBACK_CHART_SIZE = { width: 280, height: 220, fontSize: 11 };
const LPFeedsPanel = lazy(() => import('./LPFeedsPanel.jsx'));

const getConfiguredBrokerTimeZone = () => {
  const configured = getRuntimeValue('BROKER_TIMEZONE', 'VITE_BROKER_TIMEZONE', 'SERVER_TIMEZONE', 'VITE_SERVER_TIMEZONE');
  return configured && String(configured).trim() ? String(configured).trim() : 'UTC';
};

const dateFormatterCache = new Map();
const timeFormatterCache = new Map();

const getDateFormatter = (timeZone = 'UTC') => {
  let fmt = dateFormatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dateFormatterCache.set(timeZone, fmt);
  }
  return fmt;
};

const getTimeFormatter = (timeZone = 'UTC') => {
  let fmt = timeFormatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    timeFormatterCache.set(timeZone, fmt);
  }
  return fmt;
};

const formatServerDate = (epochMs, timeZone = 'UTC') => {
  const safeMs = Number.isFinite(epochMs) && epochMs > 0 ? epochMs : Date.now();
  try {
    const parts = getDateFormatter(timeZone).formatToParts(new Date(safeMs));
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (year && month && day) return `${year}.${month}.${day}`;
  } catch {
    // Fall back to UTC ISO slice if an invalid timezone is configured.
  }
  return new Date(safeMs).toISOString().slice(0, 10).replace(/-/g, '.');
};

const formatServerTime = (epochMs, timeZone = 'UTC') => {
  const safeMs = Number.isFinite(epochMs) && epochMs > 0 ? epochMs : Date.now();
  try {
    return getTimeFormatter(timeZone).format(new Date(safeMs));
  } catch {
    return new Date(safeMs).toISOString().slice(11, 19);
  }
};

const normalizeHistoryTimestampMs = (row) => {
  if (!row || typeof row !== 'object') return undefined;
  const raw = row.timestamp ?? row.time_msc ?? row.timeMs ?? row.time ?? row.quote_time ?? row.datetime ?? row.server_time ?? row.serverTime ?? row.lastUpdate;
  if (raw === undefined || raw === null || raw === '') return undefined;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) {
    if (numeric >= 100_000_000_000_000_000) return Math.floor(numeric / 1_000_000);
    if (numeric >= 100_000_000_000_000) return Math.floor(numeric / 1_000);
    if (numeric >= 100_000_000_000) return Math.floor(numeric);
    return Math.floor(numeric * 1_000);
  }
  const parsed = typeof raw === 'string' ? Date.parse(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
};

const parseRemoteTickHistory = (payload, symbol) => {
  const target = String(symbol || '').trim().toUpperCase();
  const rows = Array.isArray(payload)
    ? payload
    : (payload?.ticks ?? payload?.data ?? payload?.answer ?? []);
  if (!Array.isArray(rows)) return [];
  const points = [];
  rows.forEach((row) => {
    if (!row || typeof row !== 'object') return;
    if (row.symbol && String(row.symbol).trim().toUpperCase() !== target) return;
    const timestamp = normalizeHistoryTimestampMs(row);
    const bid = Number(row.bid ?? row.Bid);
    const ask = Number(row.ask ?? row.Ask);
    const last = Number(row.last ?? row.Last ?? row.price_last ?? row.priceLast);
    if (!timestamp || !Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0) return;
    points.push({
      timestamp,
      bid,
      ask,
      ...(Number.isFinite(last) && last > 0 ? { last } : {}),
    });
  });
  return points.sort((a, b) => a.timestamp - b.timestamp);
};

const extractServerTimeMs = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  const candidates = [
    payload.server_time,
    payload.serverTime,
    payload.timestamp,
    payload.data?.server_time,
    payload.data?.serverTime,
  ];
  for (const candidate of candidates) {
    const parsed = normalizeHistoryTimestampMs({ timestamp: candidate });
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
};

const useLastChangeDirection = (identity, value, initial = 'none') => {
  const [state, setState] = useState(() => ({ identity, value, direction: initial }));
  if (state.identity !== identity) {
    setState({ identity, value, direction: initial });
    return initial;
  }
  if (value !== state.value) {
    const direction = value !== null && state.value !== null
      ? (value > state.value ? 'up' : 'down')
      : state.direction;
    setState({ identity, value, direction });
    return direction;
  }
  return state.direction;
};

const DirectionMarker = ({ direction }) => {
  if (direction !== 'up' && direction !== 'down') return null;
  return (
    <span className="rtx-market-watch-details__marker" data-direction={direction} aria-hidden="true">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {direction === 'up'
          ? <path d="M2 8L8 2M4 2h4v4" />
          : <path d="M2 2l6 6M8 4v4H4" />}
      </svg>
    </span>
  );
};

const MarketWatchServerClock = memo(function MarketWatchServerClock({
  offsetMs = 0,
  timeZone = 'UTC',
  onClose,
  onTitleMouseDown,
  onPopOut,
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const serverNowMs = nowMs + (Number.isFinite(offsetMs) ? offsetMs : 0);
  const formattedTime = formatServerTime(serverNowMs, timeZone);

  return (
    <header
      className="admin-dock-heading rtx-market-watch-header"
      data-dock-titlebar="true"
      onMouseDown={onTitleMouseDown}
      title="Drag or click to move and dock Market Watch"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '20px',
        minHeight: '20px',
        padding: '0 6px',
        background: 'var(--bg-secondary, var(--mw-bg-2, #131316))',
        borderBottom: '1px solid var(--border-primary, var(--mw-border, #28282e))',
        color: 'var(--text-secondary, var(--mw-text-secondary, #a0a0ab))',
        fontSize: '11px',
        fontWeight: 500,
        textTransform: 'none',
        letterSpacing: 'normal',
        lineHeight: 1,
        userSelect: 'none',
        cursor: typeof onTitleMouseDown === 'function' ? 'grab' : 'default',
      }}
    >
      <span id="admin-market-watch-title" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {`Market Watch: ${formattedTime}`}
      </span>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
        {typeof onPopOut === 'function' && (
          <button
            type="button"
            onClick={onPopOut}
            aria-label="Move or dock Market Watch"
            title="Move / Dock Market Watch"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '16px',
              height: '16px',
              padding: 0,
              border: 0,
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '11px',
              lineHeight: 1,
            }}
          >
            ⧉
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Collapse Market Watch"
          title="Collapse Market Watch"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '16px',
            height: '16px',
            padding: 0,
            border: 0,
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: '13px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    </header>
  );
});

const SymbolSpecificationModal = memo(function SymbolSpecificationModal({
  symbol,
  instrument,
  quote,
  onClose,
}) {
  if (!symbol) return null;
  const spec = readMarketWatchSymbolSpecification(instrument, quote);
  const description = readInstrumentDescription(instrument) || readInstrumentDescription(quote);
  const rows = [
    { label: 'Symbol', value: symbol },
    { label: 'Description', value: description || '—' },
    { label: 'Digits', value: spec.digits !== null ? String(spec.digits) : '—' },
    { label: 'Tick Size', value: formatMarketWatchDetailsNumber(spec.tickSize) ?? '—' },
    { label: 'Tick Value', value: formatMarketWatchDetailsNumber(spec.tickValue) ?? '—' },
    { label: 'Category', value: instrument?.category || quote?.category || '—' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Symbol specification for ${symbol}`}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.52)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(420px, 92vw)',
          background: 'var(--mw-bg-1, #1e1e22)',
          border: '1px solid var(--mw-border, #383842)',
          borderRadius: '4px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.48)',
          color: 'var(--mw-text, #e4e4e7)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            background: 'var(--mw-bg-2, #27272a)',
            borderBottom: '1px solid var(--mw-border, #383842)',
            fontWeight: 600,
            fontSize: '12px',
          }}
        >
          <span>{description ? `${symbol}, ${description}` : symbol} — Specification</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close specification"
            style={{
              border: 0,
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '14px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '10px 12px' }}>
          <dl style={{ margin: 0, display: 'grid', gap: '6px' }}>
            {rows.map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '3px 0',
                  borderBottom: '1px solid var(--mw-border-subtle, rgba(255, 255, 255, 0.06))',
                  fontSize: '12px',
                }}
              >
                <dt style={{ color: 'var(--mw-text-secondary, #a1a1aa)' }}>{item.label}</dt>
                <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
});

const MarketWatchSymbolDetails = memo(function MarketWatchSymbolDetails({
  symbol,
  instrument,
  quote,
  isLive,
  showGrid,
  onToggleGrid,
  onOpenSpecification,
  onOpenTickChart,
  onContextMenu,
}) {
  const [selectedRowKey, setSelectedRowKey] = useState('tickSize');
  const rowRefs = useRef([]);

  const details = useMemo(() => buildMarketWatchSymbolDetails({
    symbol,
    instrument,
    tick: isLive ? quote : null,
    lastPrice: quote,
  }), [symbol, instrument, quote, isLive]);

  const quoteIdentity = `${symbol}\u0000${details.hasLiveQuote ? 'live' : 'fallback'}`;
  const bidDirection = useLastChangeDirection(quoteIdentity, details.bid, 'none');
  const bidHighDirection = useLastChangeDirection(quoteIdentity, details.bidHigh, 'none');
  const bidLowDirection = useLastChangeDirection(quoteIdentity, details.bidLow, 'none');
  const askDirection = useLastChangeDirection(quoteIdentity, details.ask, 'none');
  const askHighDirection = useLastChangeDirection(quoteIdentity, details.askHigh, 'none');
  const askLowDirection = useLastChangeDirection(quoteIdentity, details.askLow, 'none');

  const dailyChangePriceDirection = details.dailyChangePrice === null || details.dailyChangePrice === 0
    ? 'none'
    : (details.dailyChangePrice > 0 ? 'up' : 'down');
  const dailyChangeDirection = details.dailyChange === null || details.dailyChange === 0
    ? 'none'
    : (details.dailyChange > 0 ? 'up' : 'down');

  const formatPriceCell = useCallback((val) => (
    formatMarketWatchDetailsPrice(val, details.digits) ?? '—'
  ), [details.digits]);

  const rows = useMemo(() => [
    {
      key: 'tickSize',
      label: 'Tick Size',
      value: formatMarketWatchDetailsNumber(details.tickSize) ?? '—',
      direction: 'static',
    },
    {
      key: 'tickValue',
      label: 'Tick Value',
      value: formatMarketWatchDetailsNumber(details.tickValue) ?? '—',
      direction: 'static',
    },
    {
      key: 'bid',
      label: 'Bid',
      value: formatPriceCell(details.bid),
      direction: bidDirection,
    },
    {
      key: 'bidHigh',
      label: 'Bid High',
      value: formatPriceCell(details.bidHigh),
      direction: bidHighDirection,
    },
    {
      key: 'bidLow',
      label: 'Bid Low',
      value: formatPriceCell(details.bidLow),
      direction: bidLowDirection,
    },
    {
      key: 'ask',
      label: 'Ask',
      value: formatPriceCell(details.ask),
      direction: askDirection,
    },
    {
      key: 'askHigh',
      label: 'Ask High',
      value: formatPriceCell(details.askHigh),
      direction: askHighDirection,
    },
    {
      key: 'askLow',
      label: 'Ask Low',
      value: formatPriceCell(details.askLow),
      direction: askLowDirection,
    },
    {
      key: 'dailyChangePrice',
      label: 'Change',
      value: formatDailyChange(details.dailyChangePrice, details.digits ?? 2, false),
      direction: dailyChangePriceDirection,
    },
    {
      key: 'dailyChange',
      label: 'Change %',
      value: formatDailyChange(details.dailyChange, 2, true),
      direction: dailyChangeDirection,
    },
    {
      key: 'open',
      label: 'Open Price',
      value: formatPriceCell(details.open),
      direction: 'static',
    },
    {
      key: 'close',
      label: 'Close Price',
      value: formatPriceCell(details.close),
      direction: 'static',
    },
  ], [
    details,
    formatPriceCell,
    bidDirection,
    bidHighDirection,
    bidLowDirection,
    askDirection,
    askHighDirection,
    askLowDirection,
    dailyChangePriceDirection,
    dailyChangeDirection,
  ]);

  const handleRowKeyDown = useCallback((event, index) => {
    if (event.key === 'g' || event.key === 'G') {
      event.preventDefault();
      onToggleGrid?.();
      return;
    }
    let nextIndex = null;
    if (event.key === 'ArrowDown') {
      nextIndex = Math.min(rows.length - 1, index + 1);
    } else if (event.key === 'ArrowUp') {
      nextIndex = Math.max(0, index - 1);
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = rows.length - 1;
    }
    if (nextIndex !== null && rows[nextIndex]) {
      event.preventDefault();
      setSelectedRowKey(rows[nextIndex].key);
      rowRefs.current[nextIndex]?.focus();
    }
  }, [rows, onToggleGrid]);

  const displaySymbol = symbol || quote?.symbol || '';
  const symbolDescription = readInstrumentDescription(instrument) || readInstrumentDescription(quote);
  const headerText = symbolDescription ? `${displaySymbol}, ${symbolDescription}` : displaySymbol;

  return (
    <section
      className="rtx-market-watch-details"
      data-live={isLive}
      data-grid={showGrid}
      onContextMenu={(event) => onContextMenu?.(event, displaySymbol)}
    >
      <div className="rtx-market-watch-details__header">
        <button
          type="button"
          className="rtx-market-watch-details__symbol"
          onClick={() => onOpenSpecification?.(displaySymbol)}
          onDoubleClick={onOpenTickChart}
          title={headerText}
        >
          {headerText}
        </button>
        {!isLive && (
          <span className="rtx-market-watch-details__availability-status" role="status">
            Symbol unavailable
          </span>
        )}
      </div>
      <div className="rtx-market-watch-details__scroll mw-scrollbar">
        <dl className="rtx-market-watch-details__list">
          {rows.map((row, index) => (
            <div
              key={row.key}
              ref={(el) => { rowRefs.current[index] = el; }}
              className={`rtx-market-watch-details__row${selectedRowKey === row.key ? ' is-selected' : ''}`}
              data-field={row.key}
              data-direction={row.direction}
              tabIndex={0}
              aria-selected={selectedRowKey === row.key}
              onClick={() => setSelectedRowKey(row.key)}
              onFocus={() => setSelectedRowKey(row.key)}
              onKeyDown={(e) => handleRowKeyDown(e, index)}
            >
              <dt className="rtx-market-watch-details__label">
                <DirectionMarker direction={row.direction} />
                <span>{row.label}</span>
              </dt>
              <dd className="rtx-market-watch-details__value" data-tone={row.direction === 'up' || row.direction === 'down' ? row.direction : undefined}>{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
});

const quotePriceClass = (direction, fresh = true) => {
  if (!fresh) return 'market-quote-neutral';
  if (direction === 'up') return 'market-quote-up';
  if (direction === 'down') return 'market-quote-down';
  return 'market-quote-neutral';
};

const MarketSymbolRow = memo(function MarketSymbolRow({
  name,
  selected,
  connected,
  now,
  onClick,
  onDoubleClick,
  onContextMenu,
}) {
  const row = useSymbolStore((state) => state.symbols[name]);
  const live = isMarketQuoteFresh(row, connected, now);
  const quote = resolveSymbolQuote(name, row);
  const direction = live ? (quote?.bidDir || quote?.askDir) : null;
  const Direction = direction === 'down' ? ArrowDownRight : direction === 'up' ? ArrowUpRight : Minus;

  return (
    <tr
      className={`market-table-row ${selected ? 'is-selected' : ''} ${live ? direction === 'down' ? 'quote-down' : direction === 'up' ? 'quote-up' : 'quote-neutral' : 'quote-stale'}`}
      onClick={() => onClick(name)}
      onDoubleClick={() => onDoubleClick(name)}
      onContextMenu={(event) => onContextMenu?.(event, name)}
      title={`Click for ${name} description · Double-click for live ticks`}
    >
      <td>
        <button
          type="button"
          className="market-symbol-btn"
          onClick={(event) => {
            event.stopPropagation();
            onClick(name);
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
            onDoubleClick(name);
          }}
        >
          <Direction size={11} />
          <span title={name}>{name}</span>
        </button>
      </td>
      <td className={`market-bid-cell admin-quote-value ${quotePriceClass(quote?.bidDir, live)}`}>{formatMarketPrice(quote?.bid)}</td>
      <td className={`market-ask-cell admin-quote-value ${quotePriceClass(quote?.askDir, live)}`}>{formatMarketPrice(quote?.ask)}</td>
      <td className={`market-spread-cell admin-quote-value ${live ? '' : 'market-quote-neutral'}`}>{formatMarketSpread(row?.bid, row?.ask)}</td>
    </tr>
  );
});

export default function MarketWatchDock({ children }) {
  const symbolMetadata = useSymbolStore(state => state.symbolMetadata);
  const feedSymbolNames = useSymbolStore(state => state.feedSymbolNames);
  const connected = useSymbolStore(state => state.isConnected);
  const feedError = useSymbolStore(state => state.feedError);
  const [collapsed, setCollapsed] = useState(DEFAULT_WORKSPACE_LAYOUT.marketWatchCollapsed);
  const [navigatorCollapsed, setNavigatorCollapsed] = useState(DEFAULT_WORKSPACE_LAYOUT.navigatorCollapsed);
  const [search, setSearch] = useState('');
  const cacheScopeRef = useRef('');
  const initialViewRef = useRef(null);
  if (initialViewRef.current === null) {
    try {
      const brokerId = localStorage.getItem('brokerId') || 'anonymous';
      const brokerLogin = localStorage.getItem('brokerLogin') || 'shared';
      cacheScopeRef.current = `${brokerId}:${brokerLogin}`;
    } catch {
      cacheScopeRef.current = 'anonymous';
    }
    const cachedView = readMarketWatchViewCache(undefined, cacheScopeRef.current);
    const cachedQuote = useSymbolStore.getState().symbols[cachedView.selected];
    initialViewRef.current = {
      ...cachedView,
      history: seedMarketTickHistory(cachedView.selected, cachedQuote, cachedView.history),
    };
  }

  const [names, setNames] = useState(() => symbolMetadata.map((entry) => entry.symbol).filter(Boolean));
  const [metadataState, setMetadataState] = useState(() => symbolMetadata.length ? 'ready' : 'loading');
  const [selected, setSelected] = useState(initialViewRef.current.selected);
  const [tab, setTab] = useState(DEFAULT_WORKSPACE_LAYOUT.marketWatchTab);
  const [now, setNow] = useState(Date.now);
  const [history, setHistory] = useState(initialViewRef.current.history);
  const [scrollTop, setScrollTop] = useState(0);
  const liveQuote = useSymbolStore((state) => selected ? state.symbols[selected] : undefined);

  // Specification & Ticks parity state
  const [remoteHistoryMap, setRemoteHistoryMap] = useState({});
  const [instrumentSpecMap, setInstrumentSpecMap] = useState({});
  const [serverTimeOffsetMs, setServerTimeOffsetMs] = useState(0);
  const [contextMenu, setContextMenu] = useState(null);
  const [specModalSymbol, setSpecModalSymbol] = useState(null);
  const [detailsShowGrid, setDetailsShowGrid] = useState(true);
  const [activeProfile, setActiveProfile] = useState('Default');
  const [showRawQuotes, setShowRawQuotes] = useState(false);
  const [hiddenSymbols, setHiddenSymbols] = useState(() => new Set());
  const [symbolsModalOpen, setSymbolsModalOpen] = useState(false);
  const [sortField, setSortField] = useState('Default');
  const [useSystemColors, setUseSystemColors] = useState(false);
  const [showMilliseconds, setShowMilliseconds] = useState(false);
  const [trackRequests, setTrackRequests] = useState(true);
  const [autoArrange, setAutoArrange] = useState(true);
  const [mwColumns, setMwColumns] = useState(DEFAULT_MW_COLUMNS);

  const [tickSourceMode, setTickSourceMode] = useState('current');
  const [autoScroll, setAutoScroll] = useState(true);
  const [crosshairEnabled, setCrosshairEnabled] = useState(true);
  const [showBidLine, setShowBidLine] = useState(true);
  const [showAskLine, setShowAskLine] = useState(true);
  const [showLastLine, setShowLastLine] = useState(true);
  const [showTickGrid, setShowTickGrid] = useState(true);
  const [panEndOffset, setPanEndOffset] = useState(0);
  const [pointer, setPointer] = useState(null);
  const pointerFrameRef = useRef(0);
  const [chartElement, setChartElement] = useState(null);
  const [chartSize, setChartSize] = useState(FALLBACK_CHART_SIZE);
  const fetchedTickHistoryKeysRef = useRef(new Set());
  const titleId = useId();
  const descriptionId = useId();
  const brokerTimeZone = useMemo(() => getConfiguredBrokerTimeZone(), []);
  const specModalQuote = useSymbolStore((state) => specModalSymbol ? state.symbols[specModalSymbol] : undefined);

  const toggleMarketWatchCollapsed = (forced) => {
    setCollapsed(prev => typeof forced === 'boolean' ? forced : !prev);
  };

  const toggleNavigatorCollapsed = (forced) => {
    setNavigatorCollapsed(prev => typeof forced === 'boolean' ? forced : !prev);
  };

  // Vertical Resizer State between Market Watch and Navigator
  const dockRef = useRef(null);
  const marketWatchSectionRef = useRef(null);
  const navigatorSectionRef = useRef(null);
  const columnResize = useWorkspaceDockResize(dockRef, collapsed, navigatorCollapsed);
  const [marketWatchHeight, setMarketWatchHeight] = useState(DEFAULT_WORKSPACE_LAYOUT.marketWatchHeight);
  const [isDragging, setIsDragging] = useState(false);
  const [dockArrangement, setDockArrangement] = useState(createInitialMt5DockArrangement);
  const [activeDockGuidePanel, setActiveDockGuidePanel] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileTriggerRef = useRef(null);
  const mobilePanelRef = useRef(null);
  const mobileCloseRef = useRef(null);

  const handleSelectDockPlacement = useCallback((panelId, zone) => {
    setDockArrangement((prev) => applyMt5DockPlacement(prev, panelId, zone));
    setActiveDockGuidePanel(null);
  }, []);

  useEffect(() => {
    const bodyEl = dockRef.current?.closest?.('.admin-workspace-body');
    if (!bodyEl) return undefined;
    if (dockArrangement.terminalFullWidth) {
      bodyEl.classList.add('is-terminal-full-width');
    } else {
      bodyEl.classList.remove('is-terminal-full-width');
    }
    return () => {
      bodyEl.classList.remove('is-terminal-full-width');
    };
  }, [dockArrangement.terminalFullWidth]);

  const startPanelMove = useCallback((panelId, event) => {
    if (event.button !== 0) return;
    if (event.target?.closest?.('button')) return;
    event.preventDefault();
    setActiveDockGuidePanel(panelId);

    const sectionEl = panelId === MT5_DOCK_PANELS.NAVIGATOR
      ? navigatorSectionRef.current
      : marketWatchSectionRef.current;
    const rect = sectionEl?.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const offsetX = rect ? startX - rect.left : 96;
    const offsetY = rect ? startY - rect.top : 14;
    const initialX = rect ? Math.round(rect.left) : 24;
    const initialY = rect ? Math.round(rect.top) : 148;
    const initialWidth = 228;
    const initialHeight = 380;

    setDockArrangement((prev) => ({
      ...prev,
      floatingPanel: panelId,
      floatRects: {
        ...prev.floatRects,
        [panelId]: {
          x: initialX,
          y: initialY,
          width: initialWidth,
          height: initialHeight,
        },
      },
    }));

    let moved = false;
    let latestX = initialX;
    let latestY = initialY;

    const handleMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const dist = Math.hypot(dx, dy);
      if (!moved && dist < 96) return;
      moved = true;
      latestX = Math.max(8, Math.round(moveEvent.clientX - offsetX));
      latestY = Math.max(48, Math.round(moveEvent.clientY - offsetY));
      if (sectionEl) {
        sectionEl.style.willChange = 'transform';
        sectionEl.style.transform = `translate3d(${latestX - initialX}px, ${latestY - initialY}px, 0)`;
      }
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      if (sectionEl) {
        sectionEl.style.willChange = '';
        sectionEl.style.transform = '';
      }
      if (moved) {
        setDockArrangement((prev) => ({
          ...prev,
          floatingPanel: panelId,
          floatRects: {
            ...prev.floatRects,
            [panelId]: {
              x: latestX,
              y: latestY,
              width: initialWidth,
              height: initialHeight,
            },
          },
        }));
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, []);

  const closeMobileDock = useCallback(() => {
    setMobileOpen(false);
    window.requestAnimationFrame(() => mobileTriggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const focusFrame = window.requestAnimationFrame(() => mobileCloseRef.current?.focus());
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMobileDock();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = [...(mobilePanelRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      ) || [])].filter(element => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const handleResize = () => {
      if (window.innerWidth > 640) setMobileOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [mobileOpen, closeMobileDock]);

  const handleMobileNavigatorClick = (event) => {
    if (!mobileOpen || event.target.closest('button')) return;
    const item = event.target.closest('[role="treeitem"]');
    if (item && item.getAttribute('aria-disabled') !== 'true') closeMobileDock();
  };

  const handleMobileNavigatorKeyDown = (event) => {
    if (!mobileOpen || (event.key !== 'Enter' && event.key !== ' ')) return;
    if (event.target.getAttribute('role') === 'treeitem' && event.target.getAttribute('aria-disabled') !== 'true') {
      closeMobileDock();
    }
  };

  const viewport = useRef(null);
  const selectedRef = useRef(selected);
  const cacheSnapshotRef = useRef({ selected, tab, history });
  const cacheWriteTimerRef = useRef(null);
  cacheSnapshotRef.current = { selected, tab, history };

  const resetScroll = useCallback(() => {
    setScrollTop(0);
    if (viewport.current) viewport.current.scrollTop = 0;
  }, []);

  useEffect(() => {
    if (!chartElement || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width);
      const height = Math.floor(entry.contentRect.height);
      if (width <= 0 || height <= 0) return;
      setChartSize((current) => (
        current.width === width && current.height === height
          ? current
          : { width, height, fontSize: 11 }
      ));
    });
    observer.observe(chartElement);
    return () => observer.disconnect();
  }, [chartElement]);

  useEffect(() => {
    setPanEndOffset(0);
    setPointer(null);
  }, [selected]);

  useEffect(() => {
    if (autoScroll) {
      setPanEndOffset(0);
    }
  }, [autoScroll]);

  useEffect(() => {
    const serverMs = extractServerTimeMs(liveQuote);
    if (serverMs) {
      setServerTimeOffsetMs(serverMs - Date.now());
    }
  }, [liveQuote]);

  // On-Demand Specification Fetch scoped to `${scopeKey}\0${symbol}`
  useEffect(() => {
    const targetSymbol = specModalSymbol || (tab === 'Details' || tab === 'Ticks' ? selected : null);
    if (!targetSymbol) return undefined;
    const scopeKey = cacheScopeRef.current || 'default';
    const requestScopeId = `${scopeKey}\0${targetSymbol}`;
    let cancelled = false;
    const controller = new AbortController();
    const startedAt = Date.now();
    const url = buildBrokerApiUrl(`/api/v2/instruments/${encodeURIComponent(targetSymbol)}`);

    fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (cancelled || !payload || !requestScopeId) return;
        const serverMs = extractServerTimeMs(payload);
        if (serverMs) {
          const midpointMs = Math.round((startedAt + Date.now()) / 2);
          setServerTimeOffsetMs(serverMs - midpointMs);
        }
        const resolved = payload?.instrument ?? payload?.data ?? payload;
        if (resolved && typeof resolved === 'object') {
          setInstrumentSpecMap((prev) => ({ ...prev, [targetSymbol]: resolved }));
        }
      })
      .catch(() => {
        // Fall back to loaded instrument catalog while loading or if request fails.
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selected, specModalSymbol, tab]);

  // Historical tick fetch once per (scopeKey, exactSymbol)
  useEffect(() => {
    if (!selected || tab !== 'Ticks') return undefined;
    const scopeKey = cacheScopeRef.current || 'default';
    const fetchKey = `${scopeKey}\0${selected}`;
    if (fetchedTickHistoryKeysRef.current.has(fetchKey)) return undefined;

    let cancelled = false;
    const controller = new AbortController();
    const startedAt = Date.now();
    const url = buildBrokerApiUrl(`/api/v2/ticks/${encodeURIComponent(selected)}?limit=${MARKET_WATCH_TICK_CHART_LIMIT}`);

    fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (cancelled || !payload) return;
        fetchedTickHistoryKeysRef.current.add(fetchKey);
        const serverMs = extractServerTimeMs(payload);
        if (serverMs) {
          const midpointMs = Math.round((startedAt + Date.now()) / 2);
          setServerTimeOffsetMs(serverMs - midpointMs);
        }
        const points = parseRemoteTickHistory(payload, selected);
        if (points.length > 0) {
          setRemoteHistoryMap((prev) => ({ ...prev, [selected]: points }));
        }
      })
      .catch(() => {
        // Brokers without historical tick endpoints still chart live session ticks.
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selected, tab]);

  useEffect(() => {
    let active = true;
    InstrumentsService.getMarketSymbols().then(rows => {
      if (active) { setNames(rows); setMetadataState('ready'); }
    }).catch(() => {
      if (active) {
        setMetadataState(useSymbolStore.getState().symbolMetadata.length ? 'ready' : 'unavailable');
      }
    });
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (cacheWriteTimerRef.current !== null) return;
    cacheWriteTimerRef.current = window.setTimeout(() => {
      cacheWriteTimerRef.current = null;
      writeMarketWatchViewCache(
        cacheSnapshotRef.current,
        undefined,
        cacheScopeRef.current
      );
    }, MARKET_WATCH_CACHE_WRITE_MS);
  }, [selected, tab, history]);

  useEffect(() => () => {
    if (cacheWriteTimerRef.current !== null) window.clearTimeout(cacheWriteTimerRef.current);
  }, []);

  useEffect(() => useSymbolStore.subscribe((state, previous) => {
    if (!selected) return;
    const quote = state.symbols[selected];
    if (!quote?.live || quote.lastUpdate === previous.symbols[selected]?.lastUpdate) return;
    setHistory(rows => seedMarketTickHistory(selected, quote, rows));
  }), [selected]);

  const metadataNames = useMemo(
    () => symbolMetadata.map((entry) => entry.symbol).filter(Boolean),
    [symbolMetadata]
  );
  const allSymbolNames = useMemo(
    () => [...new Set(feedSymbolNames ? metadataNames : [...names, ...metadataNames])].sort((a, b) => a.localeCompare(b)),
    [feedSymbolNames, metadataNames, names]
  );

  // Once the feed reports what it streams, list exactly those symbols; the
  // instrument catalogue is only a fallback while the feed status is unknown.
  const rows = useMemo(() => {
    const filtered = allSymbolNames.filter((name) => {
      if (hiddenSymbols.has(name)) return false;
      if (!matchesSymbolProfile(name, activeProfile)) return false;
      return name.toLowerCase().includes(search.trim().toLowerCase());
    });
    if (sortField === 'Bid' || sortField === 'Ask' || sortField === 'Spread') {
      const symMap = useSymbolStore.getState().symbols || {};
      return [...filtered].sort((a, b) => {
        const qa = symMap[a] || {};
        const qb = symMap[b] || {};
        if (sortField === 'Bid') return Number(qb.bid || 0) - Number(qa.bid || 0);
        if (sortField === 'Ask') return Number(qb.ask || 0) - Number(qa.ask || 0);
        return Math.abs(Number(qb.ask || 0) - Number(qb.bid || 0)) - Math.abs(Number(qa.ask || 0) - Number(qa.bid || 0));
      });
    }
    return filtered;
  }, [activeProfile, allSymbolNames, hiddenSymbols, search, sortField]);

  // Keep the quote list inexpensive even when the feed contains thousands of symbols.
  const first = Math.min(Math.max(0, Math.floor(scrollTop / 27) - 8), Math.max(0, rows.length - 60));
  const displayed = rows.slice(first, first + 60);
  const quote = validMarketPrice(liveQuote?.bid) || validMarketPrice(liveQuote?.ask)
    ? liveQuote
    : history[0] || liveQuote;
  const fresh = isMarketQuoteFresh(quote, connected, now);

  const commitMarketView = useCallback((name, nextTab) => {
    const normalizedName = String(name || '').trim().toUpperCase();
    const previousName = selectedRef.current;
    const cachedQuote = normalizedName
      ? useSymbolStore.getState().symbols[normalizedName]
      : undefined;
    const start = nextTab === 'Ticks' && typeof performance !== 'undefined'
      ? performance.now()
      : null;

    flushSync(() => {
      if (normalizedName) {
        selectedRef.current = normalizedName;
        setSelected(normalizedName);
        setHistory((rows) => seedMarketTickHistory(
          normalizedName,
          cachedQuote,
          previousName === normalizedName ? rows : []
        ));
      }
      setTab(nextTab);
      setScrollTop(0);
    });

    if (viewport.current) viewport.current.scrollTop = 0;
    if (start !== null && typeof performance.measure === 'function') {
      try {
        performance.measure('rtx5.marketWatch.ticks.commit', { start, end: performance.now() });
      } catch { /* Performance marks are diagnostic only. */ }
    }
  }, []);

  // Single-click and double-click commits are urgent UI work; network refresh continues separately.
  const handleSymbolClick = useCallback((name) => commitMarketView(name, 'Details'), [commitMarketView]);
  const handleSymbolDoubleClick = useCallback((name) => commitMarketView(name, 'Ticks'), [commitMarketView]);
  const activateMarketTab = useCallback(
    (nextTab) => {
      const targetName = selectedRef.current || rows[0] || '';
      commitMarketView(targetName, nextTab);
    },
    [commitMarketView, rows]
  );

  const handleHideSymbol = useCallback((sym) => {
    if (!sym) return;
    setHiddenSymbols((prev) => {
      const next = new Set(prev);
      next.add(sym);
      return next;
    });
  }, []);

  const handleToggleSymbolVisibility = useCallback((sym) => {
    if (!sym) return;
    setHiddenSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym);
      else next.add(sym);
      return next;
    });
  }, []);

  const handleHideAllSymbols = useCallback((keepSymbol) => {
    const keep = keepSymbol || selectedRef.current || rows[0];
    setHiddenSymbols(new Set(allSymbolNames.filter((sym) => sym && sym !== keep)));
  }, [allSymbolNames, rows]);

  const handleShowAllSymbols = useCallback(() => {
    setHiddenSymbols(new Set());
    setActiveProfile('Default');
  }, []);

  const handleToggleColumn = useCallback((colKey) => {
    setMwColumns((prev) => ({
      ...prev,
      [colKey]: !prev[colKey],
    }));
  }, []);

  const handleExportSymbolsCsv = useCallback(() => {
    const symMap = useSymbolStore.getState().symbols || {};
    const csvRows = rows.map((name) => {
      const q = symMap[name] || {};
      const bidVal = showRawQuotes ? (q.rawBid ?? q.bid) : q.bid;
      const askVal = showRawQuotes ? (q.rawAsk ?? q.ask) : q.ask;
      return {
        symbol: name,
        bid: formatMarketPrice(bidVal),
        ask: formatMarketPrice(askVal),
        spread: formatMarketSpread(bidVal, askVal),
        time: formatServerTime(q.lastUpdate || Date.now(), brokerTimeZone),
      };
    });
    exportMarketWatchCsv(csvRows, 'market-watch-quotes.csv');
  }, [brokerTimeZone, rows, showRawQuotes]);

  const openSymbolContextMenu = useCallback((event, symbolName) => {
    event.preventDefault();
    const normalized = String(symbolName || selectedRef.current || rows[0] || '').trim().toUpperCase();
    if (normalized) {
      selectedRef.current = normalized;
      setSelected(normalized);
    }
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      label: `Context menu for ${normalized || 'symbol'}`,
      items: buildMt5SymbolContextMenuItems({
        symbolName: normalized,
        activeProfile,
        onSelectProfile: (profileId) => setActiveProfile(profileId),
        showRawQuotes,
        onToggleRawQuotes: () => setShowRawQuotes((prev) => !prev),
        onOpenDetails: (sym) => commitMarketView(sym || normalized, 'Details'),
        onOpenTickChart: (sym) => commitMarketView(sym || normalized, 'Ticks'),
        onOpenSpecification: (sym) => {
          const target = sym || normalized;
          if (target) setSpecModalSymbol(target);
        },
        onHideSymbol: handleHideSymbol,
        onHideAllSymbols: handleHideAllSymbols,
        onShowAllSymbols: handleShowAllSymbols,
        onOpenSymbolsDialog: () => setSymbolsModalOpen(true),
        sortField,
        onSelectSortField: (field) => setSortField(field),
        onExportCsv: handleExportSymbolsCsv,
        useSystemColors,
        onToggleSystemColors: () => setUseSystemColors((prev) => !prev),
        showMilliseconds,
        onToggleMilliseconds: () => setShowMilliseconds((prev) => !prev),
        trackRequests,
        onToggleTrackRequests: () => setTrackRequests((prev) => !prev),
        autoArrange,
        onToggleAutoArrange: () => setAutoArrange((prev) => !prev),
        showGrid: detailsShowGrid,
        onToggleGrid: () => setDetailsShowGrid((prev) => !prev),
        columns: mwColumns,
        onToggleColumn: handleToggleColumn,
      }),
    });
  }, [
    activeProfile,
    autoArrange,
    commitMarketView,
    detailsShowGrid,
    handleExportSymbolsCsv,
    handleHideAllSymbols,
    handleHideSymbol,
    handleShowAllSymbols,
    handleToggleColumn,
    mwColumns,
    rows,
    showMilliseconds,
    showRawQuotes,
    sortField,
    trackRequests,
    useSystemColors,
  ]);

  const openTickChartContextMenu = useCallback((event) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      minWidth: 162,
      label: 'Tick Chart options',
      items: buildMt5TickChartContextMenuItems({
        tickSourceMode,
        onSelectTickSource: (mode) => setTickSourceMode(mode),
        onSaveTickChart: () => exportTickChartImage(chartElement, selected || rows[0] || 'TICK_CHART'),
        autoScroll,
        onToggleAutoScroll: () => setAutoScroll((prev) => !prev),
        crosshairEnabled,
        onToggleCrosshair: () => setCrosshairEnabled((prev) => !prev),
        showBidLine,
        onToggleBidLine: () => setShowBidLine((prev) => !prev),
        showAskLine,
        onToggleAskLine: () => setShowAskLine((prev) => !prev),
        showLastLine,
        onToggleLastLine: () => setShowLastLine((prev) => !prev),
        showTickGrid,
        onToggleGrid: () => setShowTickGrid((prev) => !prev),
      }),
    });
  }, [autoScroll, chartElement, crosshairEnabled, rows, selected, showAskLine, showBidLine, showLastLine, showTickGrid, tickSourceMode]);

  const handleTickChartKeyDown = useCallback((event) => {
    if (event.target?.tagName === 'INPUT' || event.target?.tagName === 'TEXTAREA') return;
    const key = event.key.toUpperCase();
    if (key === 'S') {
      event.preventDefault();
      setAutoScroll((prev) => !prev);
    } else if (key === 'C') {
      event.preventDefault();
      setCrosshairEnabled((prev) => !prev);
    } else if (key === 'B') {
      event.preventDefault();
      setShowBidLine((prev) => !prev);
    } else if (key === 'A') {
      event.preventDefault();
      setShowAskLine((prev) => !prev);
    } else if (key === 'L') {
      event.preventDefault();
      setShowLastLine((prev) => !prev);
    } else if (key === 'G') {
      event.preventDefault();
      setShowTickGrid((prev) => !prev);
    }
  }, []);

  const handleTickChartWheel = useCallback((event) => {
    if (autoScroll) return;
    event.preventDefault();
    const step = Math.max(1, Math.round(Math.max(2, Math.floor((chartSize.width - 68) / 2.2)) * 0.12));
    const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX;
    setPanEndOffset((cur) => Math.max(0, cur + (delta > 0 ? step : -step)));
  }, [autoScroll, chartSize.width]);

  const handleTickChartMouseMove = useCallback((event) => {
    if (!chartElement || !crosshairEnabled) return;
    const clientX = event.clientX;
    const clientY = event.clientY;
    if (pointerFrameRef.current) return;
    pointerFrameRef.current = window.requestAnimationFrame(() => {
      pointerFrameRef.current = 0;
      const rect = chartElement.getBoundingClientRect();
      const nextX = clientX - rect.left;
      const nextY = clientY - rect.top;
      setPointer((prev) => (
        prev && Math.abs(prev.x - nextX) < 0.5 && Math.abs(prev.y - nextY) < 0.5
          ? prev
          : { x: nextX, y: nextY }
      ));
    });
  }, [chartElement, crosshairEnabled]);

  const handleTickChartMouseLeave = useCallback(() => {
    if (pointerFrameRef.current) {
      window.cancelAnimationFrame(pointerFrameRef.current);
      pointerFrameRef.current = 0;
    }
    setPointer(null);
  }, []);

  useEffect(() => () => {
    if (pointerFrameRef.current) {
      window.cancelAnimationFrame(pointerFrameRef.current);
      pointerFrameRef.current = 0;
    }
  }, []);

  // Drag Resizer Mechanics
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    const startY = e.clientY;
    const startH = marketWatchHeight;

    const handleMouseMove = (moveEvent) => {
      const delta = moveEvent.clientY - startY;
      const totalH = dockRef.current ? dockRef.current.clientHeight : 700;
      const maxH = Math.max(130, totalH - 120);
      const nextH = Math.max(130, Math.min(maxH, startH + delta));
      setMarketWatchHeight(nextH);
    };

    const handleMouseUp = (upEvent) => {
      const delta = upEvent.clientY - startY;
      const totalH = dockRef.current ? dockRef.current.clientHeight : 700;
      const maxH = Math.max(130, totalH - 120);
      const finalH = Math.max(130, Math.min(maxH, startH + delta));
      setMarketWatchHeight(finalH);
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    if (!touch) return;
    setIsDragging(true);
    const startY = touch.clientY;
    const startH = marketWatchHeight;

    const handleTouchMove = (moveEvent) => {
      const currentTouch = moveEvent.touches[0];
      if (!currentTouch) return;
      const delta = currentTouch.clientY - startY;
      const totalH = dockRef.current ? dockRef.current.clientHeight : 700;
      const maxH = Math.max(130, totalH - 120);
      const nextH = Math.max(130, Math.min(maxH, startH + delta));
      setMarketWatchHeight(nextH);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
  };

  const handleResizerDoubleClick = () => {
    setMarketWatchHeight(DEFAULT_WORKSPACE_LAYOUT.marketWatchHeight);
  };

  const tickChartModel = useMemo(() => {
    if (tab !== 'Ticks' || !selected) return null;
    const chartName = selected;
    const instrument = instrumentSpecMap[chartName] || quote;
    const spec = readMarketWatchSymbolSpecification(instrument, quote);

    const storeBuffer = getAdminMarketTickBuffer(chartName, quote);
    const fallbackHistory = [...history]
      .reverse()
      .map((tick) => {
        const bidVal = Number(tick?.bid);
        const askVal = Number(tick?.ask);
        const lastVal = Number(tick?.last ?? tick?.Last);
        return {
          timestamp: Number(tick?.lastUpdate ?? tick?.timestamp ?? tick?.time) || Date.now(),
          bid: bidVal,
          ask: askVal,
          ...(Number.isFinite(lastVal) && lastVal > 0 ? { last: lastVal } : {}),
        };
      })
      .filter((point) => Number.isFinite(point.bid) && Number.isFinite(point.ask) && point.bid > 0 && point.ask > 0);

    const livePoints = storeBuffer.length >= fallbackHistory.length ? storeBuffer : fallbackHistory;
    const remotePoints = remoteHistoryMap[chartName] || [];
    const firstLiveTimestamp = livePoints[0]?.timestamp ?? Number.POSITIVE_INFINITY;
    const earlierPoints = remotePoints.filter((point) => point.timestamp < firstLiveTimestamp);
    const combinedPoints = [...earlierPoints, ...livePoints].slice(-MARKET_WATCH_TICK_CHART_LIMIT);

    const geometry = buildTickChartGeometry(combinedPoints, {
      ...chartSize,
      digits: spec.digits,
      endOffset: autoScroll ? 0 : panEndOffset,
      includeBid: showBidLine,
      includeAsk: showAskLine,
      includeLast: showLastLine,
      formatDate: (ms) => formatServerDate(ms, brokerTimeZone),
      formatTime: (ms) => formatServerTime(ms, brokerTimeZone),
    });

    const activePriceTags = geometry
      ? [
          ...(showAskLine ? [['ask', geometry.askTag]] : []),
          ...(showBidLine ? [['bid', geometry.bidTag]] : []),
          ...(showLastLine && geometry.lastTag ? [['last', geometry.lastTag]] : []),
        ]
      : [];

    return {
      chartName,
      spec,
      geometry,
      activePriceTags,
    };
  }, [
    autoScroll,
    brokerTimeZone,
    chartSize,
    history,
    instrumentSpecMap,
    panEndOffset,
    quote,
    remoteHistoryMap,
    selected,
    showAskLine,
    showBidLine,
    showLastLine,
    tab,
  ]);

  const renderTickChartView = () => {
    if (!selected || !tickChartModel) {
      return (
        <div className="market-watch-empty">
          <p>Select a symbol in Symbols first.</p>
        </div>
      );
    }

    const { chartName, spec, geometry, activePriceTags } = tickChartModel;

    const crosshair = crosshairEnabled && pointer && geometry
      ? buildTickChartCrosshair(geometry, pointer, {
          ...chartSize,
          digits: spec.digits,
          formatDate: (ms) => formatServerDate(ms, brokerTimeZone),
          formatTime: (ms) => formatServerTime(ms, brokerTimeZone),
        })
      : null;

    return (
      <section
        className="rtx-market-tick-chart"
        aria-label={chartName}
        data-crosshair={crosshairEnabled}
        tabIndex={0}
        onKeyDown={handleTickChartKeyDown}
        onContextMenu={openTickChartContextMenu}
      >
        <div
          ref={setChartElement}
          className="rtx-market-tick-chart__canvas"
          onWheel={handleTickChartWheel}
          onMouseMove={handleTickChartMouseMove}
          onMouseLeave={handleTickChartMouseLeave}
        >
          {geometry ? (
            <svg
              width={chartSize.width}
              height={chartSize.height}
              viewBox={`0 0 ${chartSize.width} ${chartSize.height}`}
              role="img"
              aria-labelledby={`${titleId} ${descriptionId}`}
              data-tick-count={geometry.visibleCount}
              style={{ fontSize: chartSize.fontSize }}
            >
              <title id={titleId}>{chartName}</title>
              <desc id={descriptionId}>
                {`${chartName} live tick chart with ${geometry.visibleCount} recent broker quotes. Bid ${geometry.bidTag.label}, Ask ${geometry.askTag.label}.`}
              </desc>
              {/* 1. Plot Background */}
              <rect
                className="rtx-market-tick-chart__plot"
                x={geometry.plot.left}
                y={geometry.plot.top}
                width={geometry.plot.right - geometry.plot.left}
                height={geometry.plot.bottom - geometry.plot.top}
              />
              {/* 2. Grid */}
              {showTickGrid && (
                <g className="rtx-market-tick-chart__grid" aria-hidden="true">
                  {geometry.priceTicks.map((tick) => (
                    <line key={`price-${tick.label}`} x1={geometry.plot.left} x2={geometry.plot.right} y1={tick.y} y2={tick.y} />
                  ))}
                  {geometry.timeTicks.slice(1).map((tick) => (
                    <line key={`time-${tick.x}`} x1={tick.x} x2={tick.x} y1={geometry.plot.top} y2={geometry.plot.bottom} />
                  ))}
                </g>
              )}
              {/* 3. Period Separators */}
              {showTickGrid && (
                <g className="rtx-market-tick-chart__separators" aria-hidden="true">
                  {geometry.separators.map((x) => (
                    <line key={x} x1={x} x2={x} y1={geometry.plot.top} y2={geometry.plot.bottom} />
                  ))}
                </g>
              )}
              {/* 4. Ask Line */}
              {showAskLine && geometry.askPath && (
                <path
                  data-testid="market-tick-ask-line"
                  className="rtx-market-tick-chart__line rtx-market-tick-chart__line--ask"
                  d={geometry.askPath}
                />
              )}
              {/* 5. Bid Line */}
              {showBidLine && geometry.bidPath && (
                <path
                  data-testid="market-tick-bid-line"
                  className="rtx-market-tick-chart__line rtx-market-tick-chart__line--bid"
                  d={geometry.bidPath}
                />
              )}
              {/* 6. Last Line */}
              {showLastLine && geometry.lastPath && (
                <path
                  data-testid="market-tick-last-line"
                  className="rtx-market-tick-chart__line rtx-market-tick-chart__line--last"
                  d={geometry.lastPath}
                />
              )}
              {/* 7. Current Price Reference Lines */}
              <g className="rtx-market-tick-chart__price-lines" aria-hidden="true">
                {showAskLine && (
                  <line
                    className="rtx-market-tick-chart__price-line--ask"
                    x1={geometry.lastX ?? geometry.plot.left}
                    x2={geometry.plot.right}
                    y1={geometry.askTag.lineY}
                    y2={geometry.askTag.lineY}
                  />
                )}
                {showBidLine && (
                  <line
                    className="rtx-market-tick-chart__price-line--bid"
                    x1={geometry.lastX ?? geometry.plot.left}
                    x2={geometry.plot.right}
                    y1={geometry.bidTag.lineY}
                    y2={geometry.bidTag.lineY}
                  />
                )}
                {showLastLine && geometry.lastTag && (
                  <line
                    className="rtx-market-tick-chart__price-line--last"
                    x1={geometry.lastX ?? geometry.plot.left}
                    x2={geometry.plot.right}
                    y1={geometry.lastTag.lineY}
                    y2={geometry.lastTag.lineY}
                  />
                )}
              </g>
              {/* 8. Plot Frame */}
              <rect
                className="rtx-market-tick-chart__frame"
                x={geometry.plot.left}
                y={geometry.plot.top}
                width={geometry.plot.right - geometry.plot.left}
                height={geometry.plot.bottom - geometry.plot.top}
              />
              {/* 9. Symbol Watermark */}
              <text
                className="rtx-market-tick-chart__symbol"
                x={geometry.plot.left + 5}
                y={geometry.plot.top + chartSize.fontSize + 4}
              >
                {chartName}
              </text>
              {/* 10. Axes */}
              <g className="rtx-market-tick-chart__axis" aria-hidden="true">
                {geometry.priceTicks
                  .filter((tick) => tick.y > geometry.plot.top + chartSize.fontSize / 2 && tick.y < geometry.plot.bottom - chartSize.fontSize / 2)
                  .map((tick) => (
                    <g key={`price-label-${tick.label}`}>
                      <line x1={geometry.plot.right} x2={geometry.plot.right + geometry.tickLength} y1={tick.y} y2={tick.y} />
                      <text x={geometry.plot.right + geometry.tickLength + 3} y={tick.y + chartSize.fontSize * 0.35}>{tick.label}</text>
                    </g>
                  ))}
                {geometry.timeTicks.map((tick) => {
                  const textX = tick.isLast
                    ? Math.max(geometry.plot.left, Math.min(tick.x - 18, geometry.plot.right - 24))
                    : tick.x + 2;
                  return (
                    <g key={`time-label-${tick.x}`}>
                      <line x1={tick.x} x2={tick.x} y1={geometry.plot.bottom} y2={geometry.plot.bottom + geometry.tickLength} />
                      <text x={textX} y={geometry.plot.bottom + geometry.tickLength + chartSize.fontSize}>{tick.label}</text>
                    </g>
                  );
                })}
              </g>
              {/* 11. Right-Axis Price Tags */}
              {activePriceTags.map(([side, tag]) => (
                <g key={side} className={`rtx-market-tick-chart__tag rtx-market-tick-chart__tag--${side}`} data-testid={`market-tick-${side}-tag`}>
                  <rect
                    x={geometry.plot.right}
                    y={tag.y - geometry.tagHeight / 2}
                    width={geometry.axisWidth}
                    height={geometry.tagHeight}
                  />
                  <text x={geometry.plot.right + geometry.tickLength + 3} y={tag.y + chartSize.fontSize * 0.35}>{tag.label}</text>
                </g>
              ))}
              {/* 12. Crosshair Overlay */}
              {crosshair && (
                <g className="rtx-market-tick-chart__crosshair" aria-hidden="true">
                  <line x1={geometry.plot.left} x2={geometry.plot.right} y1={crosshair.y} y2={crosshair.y} />
                  <line x1={crosshair.x} x2={crosshair.x} y1={geometry.plot.top} y2={geometry.plot.bottom} />
                  <g className="rtx-market-tick-chart__tag rtx-market-tick-chart__tag--crosshair">
                    <rect
                      x={geometry.plot.right}
                      y={crosshair.priceTag.y - geometry.tagHeight / 2}
                      width={geometry.axisWidth}
                      height={geometry.tagHeight}
                    />
                    <text x={geometry.plot.right + geometry.tickLength + 3} y={crosshair.priceTag.y + chartSize.fontSize * 0.35}>
                      {crosshair.priceTag.label}
                    </text>
                  </g>
                  <g className="rtx-market-tick-chart__tag rtx-market-tick-chart__tag--crosshair">
                    <rect
                      x={crosshair.timeTag.x}
                      y={crosshair.timeTag.y}
                      width={crosshair.timeTag.width}
                      height={crosshair.timeTag.height}
                    />
                    <text x={crosshair.timeTag.x + 4} y={geometry.plot.bottom + chartSize.fontSize + 1}>
                      {crosshair.timeTag.label}
                    </text>
                  </g>
                  <g className="rtx-market-tick-chart__quote-pill">
                    <rect
                      x={crosshair.quotePill.x}
                      y={crosshair.quotePill.y}
                      width={crosshair.quotePill.width}
                      height={crosshair.quotePill.height}
                    />
                    <text x={crosshair.quotePill.x + 4} y={crosshair.quotePill.y + chartSize.fontSize}>
                      {crosshair.quotePill.label}
                    </text>
                  </g>
                </g>
              )}
            </svg>
          ) : (
            <div className="rtx-market-tick-chart__empty" role="status">
              <strong>{fresh ? 'Waiting for live ticks' : 'Symbol unavailable'}</strong>
              <span>
                {fresh
                  ? `The chart will appear when the broker publishes a quote for ${chartName}.`
                  : `${chartName} is not available in the active broker feed.`}
              </span>
            </div>
          )}
        </div>
      </section>
    );
  };

  const isStackedColumn = dockArrangement.mode === MT5_DOCK_MODES.COLUMN;
  const isMarketWatchFirst = dockArrangement.order[0] !== MT5_DOCK_PANELS.NAVIGATOR;
  const isMarketWatchFloating = dockArrangement.floatingPanel === MT5_DOCK_PANELS.MARKET_WATCH;
  const isNavigatorFloating = dockArrangement.floatingPanel === MT5_DOCK_PANELS.NAVIGATOR;
  const marketFloatRect = dockArrangement.floatRects[MT5_DOCK_PANELS.MARKET_WATCH];
  const navigatorFloatRect = dockArrangement.floatRects[MT5_DOCK_PANELS.NAVIGATOR];

  const marketSectionStyle = isMarketWatchFloating
    ? {
        position: 'fixed',
        left: `${marketFloatRect.x}px`,
        top: `${marketFloatRect.y}px`,
        width: `${marketFloatRect.width}px`,
        height: `${marketFloatRect.height}px`,
        flex: 'none',
        zIndex: 9500,
        boxShadow: '0 14px 36px rgba(0, 0, 0, 0.58)',
        border: '1px solid var(--border-primary, #383842)',
      }
    : isStackedColumn
      ? (navigatorCollapsed || isNavigatorFloating
          ? { order: 0, flex: '1 1 0', height: 'auto', width: '100%' }
          : isMarketWatchFirst
            ? { order: 0, height: `${marketWatchHeight}px`, flex: `0 0 ${marketWatchHeight}px`, width: '100%' }
            : { order: 2, flex: '1 1 0', height: 'auto', width: '100%' })
      : {
          order: isMarketWatchFirst ? 0 : 2,
          ...(navigatorCollapsed ? { flex: '1 1 0', height: 'auto' } : { height: `${marketWatchHeight}px`, flex: 'none' }),
        };

  const navigatorSectionStyle = isNavigatorFloating
    ? {
        position: 'fixed',
        left: `${navigatorFloatRect.x}px`,
        top: `${navigatorFloatRect.y}px`,
        width: `${navigatorFloatRect.width}px`,
        height: `${navigatorFloatRect.height}px`,
        flex: 'none',
        zIndex: 9500,
        boxShadow: '0 14px 36px rgba(0, 0, 0, 0.58)',
        border: '1px solid var(--border-primary, #383842)',
      }
    : isStackedColumn
      ? (collapsed || isMarketWatchFloating
          ? { order: 0, flex: '1 1 0', height: 'auto', width: '100%' }
          : !isMarketWatchFirst
            ? { order: 0, height: `${marketWatchHeight}px`, flex: `0 0 ${marketWatchHeight}px`, width: '100%' }
            : { order: 2, flex: '1 1 0', height: 'auto', width: '100%' })
      : {
          order: isMarketWatchFirst ? 2 : 0,
        };

  return (
    <aside
      className={`admin-market-dock ${collapsed ? 'is-collapsed' : ''} ${navigatorCollapsed ? 'is-navigator-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''} ${isStackedColumn ? 'is-stacked-column' : 'is-side-by-side'} ${isMarketWatchFirst ? 'is-market-first' : 'is-navigator-first'} ${dockArrangement.floatingPanel ? 'has-floating-panel' : ''}`}
      ref={dockRef}
      style={columnResize.style}
      aria-label="Market Watch and Navigator"
    >
      <Mt5SmartDockGuide
        activePanelId={activeDockGuidePanel}
        onSelectPlacement={handleSelectDockPlacement}
        onDismiss={() => setActiveDockGuidePanel(null)}
      />
      <button
        ref={mobileTriggerRef}
        type="button"
        className="admin-dock-mobile-trigger"
        onClick={() => setMobileOpen(true)}
        aria-label="Open Market Watch and Navigator"
        aria-expanded={mobileOpen}
        aria-controls="admin-dock-mobile-panel"
      >
        <PanelLeftOpen size={17} />
        <span>Panels</span>
      </button>
      <div className="admin-dock-mobile-backdrop" onClick={closeMobileDock} aria-hidden="true" />
      <div
        ref={mobilePanelRef}
        id="admin-dock-mobile-panel"
        className="admin-dock-mobile-panel"
        role={mobileOpen ? 'dialog' : undefined}
        aria-modal={mobileOpen ? 'true' : undefined}
        aria-label={mobileOpen ? 'Market Watch and Navigator' : undefined}
      >
      <div className="admin-dock-mobile-header">
        <span>Workspace panels</span>
        <button ref={mobileCloseRef} type="button" onClick={closeMobileDock} aria-label="Close Market Watch and Navigator">
          <X size={16} />
        </button>
      </div>
      {collapsed ? (
        <button
          type="button"
          className="market-watch-restore"
          onClick={() => toggleMarketWatchCollapsed(false)}
          aria-label="Show Market Watch"
          title="Show Market Watch"
        >
          <ChartNoAxesCombined size={16} />
          <span>Market Watch</span>
          <ChevronDown size={14} />
        </button>
      ) : (
        <section
          ref={marketWatchSectionRef}
          className={`admin-market-watch ${isMarketWatchFloating ? 'is-floating' : ''}`}
          style={marketSectionStyle}
          aria-labelledby="admin-market-watch-title"
        >
          <MarketWatchServerClock
            offsetMs={serverTimeOffsetMs}
            timeZone={brokerTimeZone}
            onClose={() => toggleMarketWatchCollapsed(true)}
            onTitleMouseDown={(e) => startPanelMove(MT5_DOCK_PANELS.MARKET_WATCH, e)}
          />

          {feedError && (
            <div
              className={`admin-market-status ${connected ? 'is-connected' : ''}`}
              style={tab !== 'Symbols' ? { display: 'none' } : undefined}
              role="status"
            >
              {feedError}
            </div>
          )}

          <div
            className={`admin-market-content${tab === 'Named feeds' ? ' is-named-feeds' : ''}`}
            ref={viewport}
            onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
            style={tab === 'Details' || tab === 'Ticks' ? { display: 'flex', flexDirection: 'column', overflow: 'hidden' } : undefined}
          >
            {/* View 1: Symbols Quotes Table */}
            {tab === 'Named feeds' && (
              <Suspense fallback={<p className="market-watch-empty" role="status">Loading named feeds…</p>}>
                <LPFeedsPanel compact />
              </Suspense>
            )}
            {tab === 'Symbols' && (
              <>
                <table className="admin-market-table admin-market-symbols-table">
                  <thead>
                    <tr>
                      <th className="market-col-symbol">Symbol</th>
                      <th className="market-col-bid">Bid</th>
                      <th className="market-col-ask">Ask</th>
                      <th className="market-col-spread" title="Difference between Ask and Bid">Spread</th>
                    </tr>
                  </thead>
                  <tbody>
                    {first > 0 && (
                      <tr aria-hidden="true">
                        <td colSpan={4} style={{ height: first * 27, padding: 0 }} />
                      </tr>
                    )}
                    {displayed.map(name => (
                      <MarketSymbolRow
                        key={name}
                        name={name}
                        selected={selected === name}
                        connected={connected}
                        now={now}
                        onClick={handleSymbolClick}
                        onDoubleClick={handleSymbolDoubleClick}
                        onContextMenu={openSymbolContextMenu}
                      />
                    ))}
                    {rows.length > first + displayed.length && (
                      <tr aria-hidden="true">
                        <td colSpan={4} style={{ height: (rows.length - first - displayed.length) * 27, padding: 0 }} />
                      </tr>
                    )}
                  </tbody>
                </table>
                {!rows.length && (
                  <p className="market-watch-empty">
                    {search
                      ? 'No matching symbols.'
                      : metadataState === 'loading'
                        ? 'Loading symbols…'
                        : metadataState === 'unavailable'
                          ? 'Symbol list unavailable. Waiting for market feed.'
                          : 'Waiting for symbols from the feed.'}
                  </p>
                )}
              </>
            )}

            {/* View 2: Symbol Specification & Detailed Description (MT5 / WebTerminal Parity) */}
            {tab === 'Details' && (
              selected ? (
                <MarketWatchSymbolDetails
                  symbol={selected}
                  instrument={instrumentSpecMap[selected] || quote}
                  quote={quote}
                  isLive={fresh}
                  showGrid={detailsShowGrid}
                  onToggleGrid={() => setDetailsShowGrid((prev) => !prev)}
                  onOpenSpecification={(sym) => setSpecModalSymbol(sym)}
                  onOpenTickChart={() => activateMarketTab('Ticks')}
                  onContextMenu={openSymbolContextMenu}
                />
              ) : (
                <div className="market-watch-empty">
                  <Info size={24} className="mx-auto mb-2 opacity-50 text-white" />
                  <p>Click any symbol in the Symbols table to view its full specification and description.</p>
                </div>
              )
            )}

            {/* View 3: Live Ticks Chart (MT5 / WebTerminal Parity) */}
            {tab === 'Ticks' && renderTickChartView()}
          </div>

          <div className="admin-market-search-bar" style={tab !== 'Symbols' ? { display: 'none' } : undefined}>
            <label className="admin-market-search">
              <Search size={12} />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); resetScroll(); }}
                placeholder="Search symbols"
                aria-label="Search market symbols"
              />
              {search && (
                <button
                  type="button"
                  className="admin-market-search-clear"
                  aria-label="Clear symbol search"
                  onClick={() => { setSearch(''); resetScroll(); }}
                >
                  <X size={11} />
                </button>
              )}
            </label>
          </div>

          <nav
            className="admin-market-tabs rtx-market-watch-view-tabs"
            aria-label="Market Watch views"
            style={{
              display: 'flex',
              alignItems: 'stretch',
              minHeight: '22px',
              borderTop: '1px solid var(--border-primary, var(--mw-border, #28282e))',
              background: 'var(--bg-secondary, var(--mw-bg-2, #131316))',
              padding: '0 4px',
              gap: '2px',
            }}
          >
            {['Symbols', 'Details', 'Ticks', 'Named feeds'].map(value => {
              const isActive = tab === value;
              const tabStyle = {
                padding: '0 10px',
                fontSize: '12px',
                border: '1px solid transparent',
                borderTopColor: isActive ? 'var(--text-secondary, var(--mw-text-secondary, #a0a0ab))' : 'transparent',
                borderInlineColor: isActive ? 'var(--text-secondary, var(--mw-text-secondary, #a0a0ab))' : 'transparent',
                background: isActive ? 'var(--bg-secondary, var(--mw-bg-2, #131316))' : 'transparent',
                color: isActive ? 'var(--text-primary, var(--mw-text, #f4f4f6))' : 'var(--text-secondary, var(--mw-text-secondary, #a0a0ab))',
              };
              if (value === 'Ticks') {
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => activateMarketTab('Ticks')}
                    style={tabStyle}
                  >
                    {value}
                  </button>
                );
              }
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => activateMarketTab(value)}
                  style={tabStyle}
                >
                  {value}
                </button>
              );
            })}
          </nav>
          <WorkspaceColumnResizer label="Resize Market Watch width" {...columnResize.separatorProps('marketWatch')} />
        </section>
      )}

      {/* Horizontal Resizer / Dragger Bar between Market Watch and Navigator */}
      {!collapsed && !navigatorCollapsed && !dockArrangement.floatingPanel && (
        <div
          className={`admin-dock-resizer ${isDragging ? 'is-dragging' : ''}`}
          style={{ order: 1 }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onDoubleClick={handleResizerDoubleClick}
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize Market Watch and Navigator"
          title="Drag up or down to adjust Market Watch and Navigator height (Double-click to reset)"
        >
          <div className="admin-dock-resizer-line" />
          <div className="admin-dock-resizer-handle">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}

      {/* Navigator Section */}
      {navigatorCollapsed ? (
        <button
          type="button"
          className="navigator-restore"
          onClick={() => toggleNavigatorCollapsed(false)}
          aria-label="Show Navigator"
          title="Show Navigator"
        >
          <Folder size={15} />
          <span>Navigator</span>
          <ChevronUp size={14} />
        </button>
      ) : (
        <section
          ref={navigatorSectionRef}
          className={`admin-navigator-dock ${isNavigatorFloating ? 'is-floating' : ''}`}
          style={navigatorSectionStyle}
          aria-label="Navigator"
        >
          <header
            className="admin-dock-heading rtx-market-watch-header"
            data-dock-titlebar="true"
            onMouseDown={(e) => startPanelMove(MT5_DOCK_PANELS.NAVIGATOR, e)}
            title="Drag or click to move and dock Navigator"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: '20px',
              minHeight: '20px',
              padding: '0 6px',
              background: 'var(--bg-secondary, var(--mw-bg-2, #131316))',
              borderBottom: '1px solid var(--border-primary, var(--mw-border, #28282e))',
              color: 'var(--text-secondary, var(--mw-text-secondary, #a0a0ab))',
              fontSize: '11px',
              lineHeight: 1,
              cursor: 'grab',
              userSelect: 'none',
            }}
          >
            <span>Navigator</span>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <button
                type="button"
                onClick={() => toggleNavigatorCollapsed(true)}
                aria-label="Collapse Navigator"
                title="Close"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '16px',
                  height: '16px',
                  padding: 0,
                  border: 0,
                  background: 'transparent',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontSize: '13px',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          </header>
          <div className="admin-navigator-content" onClick={handleMobileNavigatorClick} onKeyDown={handleMobileNavigatorKeyDown}>
            {children}
          </div>
          <nav
            className="admin-market-tabs rtx-market-watch-view-tabs"
            aria-label="Navigator views"
            style={{
              display: 'flex',
              alignItems: 'stretch',
              minHeight: '22px',
              borderTop: '1px solid var(--border-primary, var(--mw-border, #28282e))',
              background: 'var(--bg-secondary, var(--mw-bg-2, #131316))',
              padding: '0 4px',
              gap: '2px',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              aria-pressed="true"
              style={{
                padding: '0 10px',
                fontSize: '11px',
                border: '1px solid transparent',
                borderTopColor: 'var(--text-secondary, var(--mw-text-secondary, #a0a0ab))',
                borderInlineColor: 'var(--text-secondary, var(--mw-text-secondary, #a0a0ab))',
                background: 'var(--bg-secondary, var(--mw-bg-2, #131316))',
                color: 'var(--text-primary, var(--mw-text, #f4f4f6))',
              }}
            >
              Common
            </button>
            <button
              type="button"
              aria-pressed="false"
              style={{
                padding: '0 10px',
                fontSize: '11px',
                border: '1px solid transparent',
                background: 'transparent',
                color: 'var(--text-secondary, var(--mw-text-secondary, #a0a0ab))',
              }}
            >
              Chats
            </button>
          </nav>
          <WorkspaceColumnResizer label="Resize Navigator width" {...columnResize.separatorProps('navigator')} />
        </section>
      )}
      </div>

      <MarketWatchContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
      />

      <MarketWatchSymbolsModal
        open={symbolsModalOpen}
        symbols={allSymbolNames}
        hiddenSymbols={hiddenSymbols}
        onToggleSymbolVisibility={handleToggleSymbolVisibility}
        onShowAll={handleShowAllSymbols}
        onHideAll={handleHideAllSymbols}
        onOpenSpecification={(sym) => {
          setSymbolsModalOpen(false);
          setSpecModalSymbol(sym);
        }}
        onClose={() => setSymbolsModalOpen(false)}
      />

      <SymbolSpecificationModal
        symbol={specModalSymbol}
        instrument={specModalSymbol ? instrumentSpecMap[specModalSymbol] : null}
        quote={specModalQuote}
        onClose={() => setSpecModalSymbol(null)}
      />
    </aside>
  );
}
