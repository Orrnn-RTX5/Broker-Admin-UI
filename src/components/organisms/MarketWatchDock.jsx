import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import LPFeedsPanel from './LPFeedsPanel.jsx';
import {
  ArrowDownRight, ArrowUpRight, ChartNoAxesCombined, ChevronUp, ChevronDown,
  Folder, Search, ArrowLeft, Activity, Info, Clock, CheckCircle2,
} from 'lucide-react';
import useSymbolStore from '../../store/useSymbolStore';
import { InstrumentsService } from '../../services/instruments.service';
import {
  formatMarketPrice,
  getSymbolFriendlyDescription,
  isMarketQuoteFresh,
  readMarketWatchViewCache,
  seedMarketTickHistory,
  validMarketPrice,
  writeMarketWatchViewCache,
} from '../../utils/marketWatch';
import './MarketWatchDock.css';

const MARKET_WATCH_CACHE_WRITE_MS = 250;

const MarketSymbolRow = memo(function MarketSymbolRow({
  name,
  selected,
  connected,
  now,
  onClick,
  onDoubleClick,
}) {
  const row = useSymbolStore((state) => state.symbols[name]);
  const live = isMarketQuoteFresh(row, connected, now);
  const Direction = row?.dir === 'down' ? ArrowDownRight : ArrowUpRight;

  return (
    <tr
      className={`market-table-row ${selected ? 'is-selected' : ''} ${live ? row?.dir === 'down' ? 'quote-down' : 'quote-up' : 'quote-stale'}`}
      onClick={() => onClick(name)}
      onDoubleClick={() => onDoubleClick(name)}
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
      <td>{formatMarketPrice(row?.bid)}</td>
      <td>{formatMarketPrice(row?.ask)}</td>
    </tr>
  );
});

export default function MarketWatchDock({ children }) {
  const symbolMetadata = useSymbolStore(state => state.symbolMetadata);
  const feedSymbolNames = useSymbolStore(state => state.feedSymbolNames);
  const connected = useSymbolStore(state => state.isConnected);
  const feedError = useSymbolStore(state => state.feedError);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('rtx5.marketWatchCollapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [navigatorCollapsed, setNavigatorCollapsed] = useState(() => {
    try {
      return localStorage.getItem('rtx5.navigatorCollapsed') === 'true';
    } catch {
      return false;
    }
  });
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
  const [tab, setTab] = useState(initialViewRef.current.tab);
  const [now, setNow] = useState(Date.now);
  const [history, setHistory] = useState(initialViewRef.current.history);
  const [scrollTop, setScrollTop] = useState(0);
  const liveQuote = useSymbolStore((state) => selected ? state.symbols[selected] : undefined);

  const toggleMarketWatchCollapsed = (forced) => {
    setCollapsed(prev => {
      const next = typeof forced === 'boolean' ? forced : !prev;
      try {
        localStorage.setItem('rtx5.marketWatchCollapsed', String(next));
      } catch { /* noop */ }
      return next;
    });
  };

  const toggleNavigatorCollapsed = (forced) => {
    setNavigatorCollapsed(prev => {
      const next = typeof forced === 'boolean' ? forced : !prev;
      try {
        localStorage.setItem('rtx5.navigatorCollapsed', String(next));
      } catch { /* noop */ }
      return next;
    });
  };


  // Vertical Resizer State between Market Watch and Navigator
  const dockRef = useRef(null);
  const [marketWatchHeight, setMarketWatchHeight] = useState(() => {
    try {
      const saved = localStorage.getItem('rtx5.marketWatchHeight');
      const val = Number(saved);
      return Number.isFinite(val) && val >= 130 && val <= 850 ? val : 340;
    } catch {
      return 340;
    }
  });
  const [isDragging, setIsDragging] = useState(false);

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
  // Once the feed reports what it streams, list exactly those symbols; the
  // instrument catalogue is only a fallback while the feed status is unknown.
  const rows = useMemo(() => [...new Set(feedSymbolNames ? metadataNames : [...names, ...metadataNames])]
    .filter(name => name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => a.localeCompare(b)), [feedSymbolNames, metadataNames, names, search]);

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
    (nextTab) => commitMarketView(selectedRef.current, nextTab),
    [commitMarketView]
  );

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
      try {
        localStorage.setItem('rtx5.marketWatchHeight', String(finalH));
      } catch { /* noop */ }
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
    const defaultH = 340;
    setMarketWatchHeight(defaultH);
    try {
      localStorage.setItem('rtx5.marketWatchHeight', String(defaultH));
    } catch { /* noop */ }
  };

  return (
    <aside
      className={`admin-market-dock ${collapsed ? 'is-collapsed' : ''} ${navigatorCollapsed ? 'is-navigator-collapsed' : ''}`}
      ref={dockRef}
      aria-label="Market Watch and Navigator"
    >
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
          className="admin-market-watch"
          style={navigatorCollapsed ? { flex: '1 1 0', height: 'auto' } : { height: `${marketWatchHeight}px`, flex: 'none' }}
          aria-labelledby="admin-market-watch-title"
        >
          <header className="admin-dock-heading">
            <span id="admin-market-watch-title">
              <ChartNoAxesCombined size={15} />
              Market Watch
            </span>
            <div>
              <button
                type="button"
                onClick={() => toggleMarketWatchCollapsed(true)}
                aria-label="Collapse Market Watch"
                title="Collapse Market Watch"
              >
                <ChevronUp size={15} />
              </button>
            </div>
          </header>

          <label className="admin-market-search" style={tab === 'Named feeds' ? {display:'none'} : undefined}>
            <Search size={14} />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); resetScroll(); }}
              placeholder="Search symbols..."
              aria-label="Search market symbols"
            />
          </label>

          <div
            className={`admin-market-status ${connected ? 'is-connected' : ''}`}
            style={tab === 'Named feeds' ? {display:'none'} : undefined}
            role="status"
          >
            {feedError || (connected ? 'Connected · awaiting or receiving ticks' : 'Connecting to market feed…')}
          </div>

          <div
            className="admin-market-content"
            ref={viewport}
            onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
          >
            {/* View 1: Symbols Quotes Table */}
            {tab === 'Named feeds' && <LPFeedsPanel compact />}
            {tab === 'Symbols' && (
              <>
                <table className="admin-market-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Bid</th>
                      <th>Ask</th>
                    </tr>
                  </thead>
                  <tbody>
                    {first > 0 && (
                      <tr aria-hidden="true">
                        <td colSpan={3} style={{ height: first * 27, padding: 0 }} />
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
                      />
                    ))}
                    {rows.length > first + displayed.length && (
                      <tr aria-hidden="true">
                        <td colSpan={3} style={{ height: (rows.length - first - displayed.length) * 27, padding: 0 }} />
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

            {/* View 2: Symbol Specification & Detailed Description */}
            {tab === 'Details' && (
              selected ? (
                <div className="market-watch-details">
                  <div className="market-details-header">
                    <div className="flex items-center justify-between">
                      <h3 className="market-details-symbol">{selected}</h3>
                      <span className="market-details-category-badge">
                        {quote?.category || 'Trading Contract'}
                      </span>
                    </div>
                    <p className="market-details-desc">
                      {getSymbolFriendlyDescription(selected)}
                    </p>
                  </div>

                  <div className="market-details-live-bar">
                    <div className="market-price-box">
                      <span className="market-price-label">BID</span>
                      <span className={`market-price-val ${quote?.dir === 'down' ? 'text-danger' : 'text-success'}`}>
                        {formatMarketPrice(quote?.bid)}
                      </span>
                    </div>
                    <div className="market-price-box text-right">
                      <span className="market-price-label">ASK</span>
                      <span className={`market-price-val ${quote?.dir === 'down' ? 'text-danger' : 'text-success'}`}>
                        {formatMarketPrice(quote?.ask)}
                      </span>
                    </div>
                  </div>

                  <dl className="market-specs-list">
                    {[
                      ['Spread', quote?.bid && quote?.ask ? Math.abs(Number(quote.ask) - Number(quote.bid)).toFixed(5) : '—'],
                      ['Contract Size', '1.00 Lot (Standard)'],
                      ['Trade Mode', 'Full Access / Market Execution'],
                      ['Expiration', 'Good \'Til Cancelled (GTC)'],
                      ['Margin Profile', 'Floating Dynamic Leverage'],
                      ['Quote Status', fresh ? '● Live Feed Streaming' : '○ Awaiting Fresh Quote'],
                      ['Last Tick Received', quote?.lastUpdate ? new Date(quote.lastUpdate).toLocaleTimeString() : '—'],
                    ].map(([label, value]) => (
                      <div key={label} className="market-spec-row">
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="market-details-actions">
                    <button
                      type="button"
                      className="market-action-btn market-action-btn--primary"
                      onClick={() => activateMarketTab('Ticks')}
                    >
                      <Activity size={12} />
                      <span>View Live Ticks</span>
                    </button>
                    <button
                      type="button"
                      className="market-action-btn"
                      onClick={() => activateMarketTab('Symbols')}
                    >
                      <ArrowLeft size={12} />
                      <span>Back to Quotes</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="market-watch-empty">
                  <Info size={24} className="mx-auto mb-2 opacity-50 text-[color:var(--accent-500)]" />
                  <p>Click any symbol in the Symbols table to view its full specification and description.</p>
                </div>
              )
            )}

            {/* View 3: Live Ticks Stream & History */}
            {tab === 'Ticks' && (
              <>
                <div className="market-ticks-header">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[color:var(--text-primary)]">
                      {selected || 'No Symbol'}
                    </span>
                    <span className="text-[10px] text-[color:var(--text-muted)] font-mono">
                      Bid: {formatMarketPrice(quote?.bid)} · Ask: {formatMarketPrice(quote?.ask)}
                    </span>
                  </div>
                </div>

                <table className="admin-market-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Bid</th>
                      <th>Ask</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((tick, i) => (
                      <tr key={`${tick.lastUpdate}-${i}`}>
                        <td>{new Date(tick.lastUpdate).toLocaleTimeString()}</td>
                        <td>{formatMarketPrice(tick.bid)}</td>
                        <td>{formatMarketPrice(tick.ask)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!history.length && (
                  <p className="market-watch-empty">
                    {selected ? 'Waiting for incoming ticks for this symbol…' : 'Select a symbol in Symbols first.'}
                  </p>
                )}

                <div className="market-details-actions px-2 pb-2 mt-auto">
                  <button
                    type="button"
                    className="market-action-btn"
                    onClick={() => activateMarketTab('Details')}
                  >
                    <Info size={12} />
                    <span>Symbol Details</span>
                  </button>
                  <button
                    type="button"
                    className="market-action-btn"
                    onClick={() => activateMarketTab('Symbols')}
                  >
                    <ArrowLeft size={12} />
                    <span>Quotes Table</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="admin-market-footer" style={tab === 'Named feeds' ? {display:'none'} : undefined}>
            {rows.length} symbols <span>Muted = awaiting tick</span>
          </div>

          <nav className="admin-market-tabs" aria-label="Market Watch views">
            {['Symbols', 'Details', 'Ticks', 'Named feeds'].map(value => (
              <button
                key={value}
                type="button"
                aria-pressed={tab === value}
                onClick={() => activateMarketTab(value)}
              >
                {value}
              </button>
            ))}
          </nav>
        </section>
      )}

      {/* Horizontal Resizer / Dragger Bar between Market Watch and Navigator */}
      {!collapsed && !navigatorCollapsed && (
        <div
          className={`admin-dock-resizer ${isDragging ? 'is-dragging' : ''}`}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onDoubleClick={handleResizerDoubleClick}
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize Market Watch and Navigator"
          title="Drag up or down to adjust Market Watch and Navigator height (Double-click to reset)"
        >
          <div className="admin-dock-resizer-line" />
          <div className="admin-dock-resizer-handle" aria-hidden="true">
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
        <section className="admin-navigator-dock" aria-label="Navigator">
          <header className="admin-dock-heading">
            <span>
              <Folder size={15} />
              Navigator
            </span>
            <div>
              <button
                type="button"
                onClick={() => toggleNavigatorCollapsed(true)}
                aria-label="Collapse Navigator"
                title="Collapse Navigator"
              >
                <ChevronDown size={15} />
              </button>
            </div>
          </header>
          <div className="admin-navigator-content">
            {children}
          </div>
        </section>
      )}
    </aside>
  );
}
