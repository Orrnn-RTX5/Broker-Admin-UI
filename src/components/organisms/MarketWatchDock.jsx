import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChartNoAxesCombined, ChevronUp, ChevronDown, Folder, Pin, Search } from 'lucide-react';
import useSymbolStore from '../../store/useSymbolStore';
import { InstrumentsService } from '../../services/instruments.service';
import { formatMarketPrice, isMarketQuoteFresh } from '../../utils/marketWatch';
import './MarketWatchDock.css';

export default function MarketWatchDock({ children }) {
  const symbols = useSymbolStore(state => state.symbols);
  const connected = useSymbolStore(state => state.isConnected);
  const feedError = useSymbolStore(state => state.feedError);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const [names, setNames] = useState([]);
  const [metadataState, setMetadataState] = useState('loading');
  const [selected, setSelected] = useState('');
  const [tab, setTab] = useState('Symbols');
  const [now, setNow] = useState(Date.now);
  const [history, setHistory] = useState([]);
  const [scrollTop, setScrollTop] = useState(0);
  const viewport = useRef(null);
  const resetScroll = () => { setScrollTop(0); if (viewport.current) viewport.current.scrollTop = 0; };

  useEffect(() => {
    let active = true;
    InstrumentsService.getMarketSymbols().then(rows => {
      if (active) { setNames(rows); setMetadataState('ready'); }
    }).catch(() => { if (active) setMetadataState('unavailable'); });
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  useEffect(() => useSymbolStore.subscribe((state, previous) => {
    const quote = state.symbols[selected];
    if (!quote?.live || quote.lastUpdate === previous.symbols[selected]?.lastUpdate) return;
    setHistory(rows => [{ ...quote }, ...rows.filter(row => row.symbol === selected)].slice(0, 100));
  }), [selected]);

  const rows = useMemo(() => [...new Set([...names, ...Object.keys(symbols)])]
    .filter(name => name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => a.localeCompare(b)), [names, symbols, search]);
  // Keep the quote list inexpensive even when the feed contains thousands of symbols.
  const first = Math.min(Math.max(0, Math.floor(scrollTop / 27) - 8), Math.max(0, rows.length - 60));
  const displayed = rows.slice(first, first + 60);
  const quote = symbols[selected];
  const fresh = isMarketQuoteFresh(quote, connected, now);
  const choose = name => { setSelected(name); setHistory([]); };

  return <aside className={`admin-market-dock ${collapsed ? 'is-collapsed' : ''}`} aria-label="Market Watch and Navigator">
    {collapsed ? <button className="market-watch-restore" onClick={() => setCollapsed(false)} aria-label="Show Market Watch" title="Show Market Watch"><ChartNoAxesCombined size={16} /><span>Market Watch</span><ChevronDown size={14} /></button> :
      <section className="admin-market-watch" aria-labelledby="admin-market-watch-title">
        <header className="admin-dock-heading"><span id="admin-market-watch-title"><ChartNoAxesCombined size={15} />Market Watch</span><div><Pin size={12} aria-label="Docked" /><button onClick={() => setCollapsed(true)} aria-label="Collapse Market Watch" title="Collapse Market Watch"><ChevronUp size={15} /></button></div></header>
        <label className="admin-market-search"><Search size={14} /><input value={search} onChange={e => { setSearch(e.target.value); resetScroll(); }} placeholder="Search symbols..." aria-label="Search market symbols" /></label>
        <div className={`admin-market-status ${connected ? 'is-connected' : ''}`} role="status">{feedError || (connected ? 'Connected · awaiting or receiving ticks' : 'Connecting to market feed…')}</div>
        <div className="admin-market-content" ref={viewport} onScroll={e => setScrollTop(e.currentTarget.scrollTop)}>
          {tab === 'Symbols' && <><table className="admin-market-table"><thead><tr><th>Symbol</th><th>Bid</th><th>Ask</th></tr></thead><tbody>
            {first > 0 && <tr aria-hidden="true"><td colSpan={3} style={{ height: first * 27, padding: 0 }} /></tr>}
            {displayed.map(name => {
              const row = symbols[name];
              const live = isMarketQuoteFresh(row, connected, now);
              const Direction = row?.dir === 'down' ? ArrowDownRight : ArrowUpRight;
              return <tr key={name} className={`${selected === name ? 'is-selected' : ''} ${live ? row.dir === 'down' ? 'quote-down' : 'quote-up' : 'quote-stale'}`} title={live ? 'Recent feed quote' : 'Awaiting a fresh quote; displayed prices may be cached'}>
                <td><button onClick={() => choose(name)} onDoubleClick={() => { choose(name); setTab('Ticks'); }}><Direction size={11} /><span title={name}>{name}</span></button></td><td>{formatMarketPrice(row?.bid)}</td><td>{formatMarketPrice(row?.ask)}</td>
              </tr>;
            })}
            {rows.length > first + displayed.length && <tr aria-hidden="true"><td colSpan={3} style={{ height: (rows.length - first - displayed.length) * 27, padding: 0 }} /></tr>}
          </tbody></table>{!rows.length && <p className="market-watch-empty">{search ? 'No matching symbols.' : metadataState === 'loading' ? 'Loading symbols…' : metadataState === 'unavailable' ? 'Symbol list unavailable. Waiting for market feed.' : 'Waiting for symbols from the feed.'}</p>}
          </>}
          {tab === 'Details' && (selected ? <div className="market-watch-details"><h3>{selected}</h3><dl>{[['Bid', formatMarketPrice(quote?.bid)], ['Ask', formatMarketPrice(quote?.ask)], ['Spread', quote?.bid && quote?.ask ? Math.abs(Number(quote.ask) - Number(quote.bid)).toFixed(5) : '—'], ['Category', quote?.category || '—'], ['Status', fresh ? 'Recent quote' : 'Awaiting fresh quote'], ['Last tick', quote?.lastUpdate ? new Date(quote.lastUpdate).toLocaleTimeString() : '—']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div> : <p className="market-watch-empty">Select a symbol in Symbols to see its details.</p>)}
          {tab === 'Ticks' && <><div className="market-watch-tick-title">{selected || 'No symbol selected'} · latest 100 ticks</div><table className="admin-market-table"><thead><tr><th>Time</th><th>Bid</th><th>Ask</th></tr></thead><tbody>{history.map((tick, i) => <tr key={`${tick.lastUpdate}-${i}`}><td>{new Date(tick.lastUpdate).toLocaleTimeString()}</td><td>{formatMarketPrice(tick.bid)}</td><td>{formatMarketPrice(tick.ask)}</td></tr>)}</tbody></table>{!history.length && <p className="market-watch-empty">{selected ? 'Waiting for new ticks for this symbol.' : 'Select a symbol in Symbols first.'}</p>}</>}
        </div>
        <div className="admin-market-footer">{rows.length} symbols <span>Muted prices = not live</span></div>
        <nav className="admin-market-tabs" aria-label="Market Watch views">{['Symbols', 'Details', 'Ticks'].map(value => <button key={value} aria-pressed={tab === value} onClick={() => { setTab(value); resetScroll(); }}>{value}</button>)}</nav>
      </section>}
    <section className="admin-navigator-dock" aria-label="Navigator"><header className="admin-dock-heading"><span><Folder size={15} />Navigator</span><Pin size={12} aria-label="Docked" /></header><div className="admin-navigator-content">{children}</div></section>
  </aside>;
}
