import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Loader2, Search } from 'lucide-react';
import { useLpSymbols } from '../../hooks/useLpSymbols';
import { symbolsToCsv } from '../../lib/feedConfigPayload';
import './GatewaySymbolPicker.css';

const uniqueSymbols = (symbols) => [...new Map(symbols.map((symbol) => [symbol.toUpperCase(), symbol])).values()];

const GatewaySymbolPicker = ({ value, onChange, disabled, allSymbols }) => {
  const { symbols, loading, error, reload } = useLpSymbols();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const menuId = useId();
  const summaryId = useId();
  const expanded = open && !disabled;
  const positioned = position !== null;
  const selected = uniqueSymbols(symbolsToCsv(value).split(',').filter(Boolean));
  const selectedKeys = new Set(selected.map((symbol) => symbol.toUpperCase()));
  const options = new Map(symbols.map((entry) => [entry.symbol.toUpperCase(), entry]));

  selected.forEach((symbol) => {
    if (!options.has(symbol.toUpperCase())) options.set(symbol.toUpperCase(), { symbol, category: 'Saved selection' });
  });

  const search = query.trim().toLowerCase();
  const matches = [...options.values()]
    .sort((a, b) => a.symbol.localeCompare(b.symbol))
    .filter((entry) => `${entry.symbol} ${entry.category || ''}`.toLowerCase().includes(search));

  useLayoutEffect(() => {
    if (!expanded) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const box = trigger.getBoundingClientRect();
      const view = trigger.closest('.gateways-view')?.getBoundingClientRect();
      let topLimit = Math.max(8, (view?.top || 0) + 8);
      let bottomLimit = Math.min(window.innerHeight - 8, (view?.bottom || window.innerHeight) - 8);
      if (Math.max(box.top - topLimit, bottomLimit - box.bottom) < 150) {
        topLimit = 8;
        bottomLimit = window.innerHeight - 8;
      }
      const below = Math.max(0, bottomLimit - box.bottom - 6);
      const above = Math.max(0, box.top - topLimit - 6);
      const placeAbove = below < Math.min(340, above);
      const height = Math.min(340, placeAbove ? above : below);
      const width = Math.min(Math.max(box.width, 320), window.innerWidth - 16);
      setPosition({
        width,
        height,
        left: Math.max(8, Math.min(box.left, window.innerWidth - width - 8)),
        top: placeAbove ? box.top - height - 6 : box.bottom + 6,
      });
    };

    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(triggerRef.current);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    if (positioned) searchRef.current?.focus({ preventScroll: true });
    const handleOutsideClick = (event) => {
      if (!triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [expanded, positioned]);

  const toggleSymbol = (symbol) => {
    const key = symbol.toUpperCase();
    onChange((selectedKeys.has(key)
      ? selected.filter((item) => item.toUpperCase() !== key)
      : [...selected, symbol]).join(','));
  };

  const closeMenu = () => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="gateways-symbol-trigger"
        aria-label="Symbols"
        aria-describedby={summaryId}
        aria-haspopup="dialog"
        aria-expanded={expanded}
        aria-controls={expanded ? menuId : undefined}
        disabled={disabled}
        onClick={() => { setQuery(''); setOpen((current) => !current); }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') { event.preventDefault(); setQuery(''); setOpen(true); }
        }}
      >
        <span id={summaryId} className={!selected.length && !allSymbols ? 'gateways-symbol-placeholder' : undefined}>
          {allSymbols ? 'All symbols' : selected.length ? selected.join(', ') : 'Select symbols'}
        </span>
        {!allSymbols && selected.length > 0 && <span className="gateways-symbol-count">{selected.length}</span>}
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {expanded && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="dialog"
          aria-label="Select symbols"
          className="gateways-symbol-menu"
          style={position || { visibility: 'hidden' }}
          onBlur={(event) => {
            if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== triggerRef.current) setOpen(false);
          }}
        >
          <div className="gateways-symbol-search">
            <Search size={14} aria-hidden="true" />
            <input ref={searchRef} type="search" aria-label="Search symbols" placeholder="Search symbols or category..."
              value={query} onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  menuRef.current?.querySelector('input[type="checkbox"]')?.focus();
                }
              }} />
          </div>
          <div className="gateways-symbol-toolbar">
            <span>{matches.length} {matches.length === 1 ? 'symbol' : 'symbols'}</span>
            <button type="button" disabled={loading || Boolean(error) || !matches.length}
              onClick={() => onChange(uniqueSymbols([...selected, ...matches.map((entry) => entry.symbol)]).join(','))}>Select shown</button>
            <button type="button" disabled={!selected.length} onClick={() => onChange('')}>Clear selection</button>
          </div>
          <div className="gateways-symbol-options" aria-label="Available symbols" aria-busy={loading}>
            {loading && <div className="gateways-symbol-message" role="status"><Loader2 size={14} className="animate-spin" />Loading symbols...</div>}
            {!loading && error && <div className="gateways-symbol-message gateways-symbol-error" role="status">
              <span>Symbols could not be loaded. Saved selections are kept.</span>
              <button type="button" onClick={reload}>Retry</button>
            </div>}
            {matches.map((entry) => (
              <label key={entry.symbol.toUpperCase()} className="gateways-symbol-option">
                <input type="checkbox" checked={selectedKeys.has(entry.symbol.toUpperCase())} onChange={() => toggleSymbol(entry.symbol)} />
                <span className="gateways-symbol-name">{entry.symbol}</span>
                <span className="gateways-symbol-category">{String(entry.category || '').replace(/[\\/]+/g, ' / ')}</span>
              </label>
            ))}
            {!loading && !error && !matches.length && <div className="gateways-symbol-message" role="status">
              {search ? 'No matching symbols.' : 'No symbols available.'}
            </div>}
          </div>
          <div className="gateways-symbol-footer">
            <span role="status" aria-live="polite">{selected.length} selected</span>
            <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={closeMenu}>Done</button>
          </div>
        </div>, document.body,
      )}
    </>
  );
};

export default GatewaySymbolPicker;
