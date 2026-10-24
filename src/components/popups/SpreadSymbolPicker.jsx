import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { useLpSymbols } from '../../hooks/useLpSymbols';

export default function SpreadSymbolPicker({ value, onChange, disabled }) {
  const { symbols, loading, error, reload } = useLpSymbols();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState(null);
  const fieldRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const listId = useId();
  const query = value.trim().toLowerCase();
  const matches = symbols.some(entry => entry.symbol.toLowerCase() === query)
    ? symbols : symbols.filter(entry => `${entry.symbol} ${entry.category || ''}`.toLowerCase().includes(query));
  const expanded = open && !disabled;
  const activeSymbol = matches[activeIndex];

  useLayoutEffect(() => {
    if (!expanded) return;
    const updatePosition = () => {
      const field = fieldRef.current;
      const root = field.closest('[role="dialog"]');
      if (!root) return;
      const box = field.getBoundingClientRect(), bounds = root.getBoundingClientRect();
      const desiredHeight = Math.min(222, Math.max(1, matches.length) * 30 + 36);
      const below = bounds.bottom - box.bottom - 12, above = box.top - bounds.top - 12;
      const placeAbove = below < desiredHeight && above > below;
      const maxHeight = Math.min(desiredHeight, Math.max(0, placeAbove ? above : below));
      const width = Math.min(box.width, bounds.width - 24);
      setPosition({ root, style: { left: Math.max(8, Math.min(box.left - bounds.left - root.clientLeft, root.clientWidth - width - 8)), top: (placeAbove ? box.top - maxHeight - 4 : box.bottom + 4) - bounds.top - root.clientTop, width, maxHeight } });
    };
    const handleOutside = event => {
      if (!fieldRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(fieldRef.current);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('pointerdown', handleOutside);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('pointerdown', handleOutside);
    };
  }, [expanded, matches.length]);

  const selectSymbol = symbol => {
    onChange(symbol);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus({ preventScroll: true });
  };
  const handleKeyDown = event => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape' && expanded) {
      event.preventDefault(); event.stopPropagation(); setOpen(false); setActiveIndex(-1);
    } else if (event.key === 'Tab') {
      setOpen(false);
    } else if (event.key === 'Enter' && expanded) {
      event.preventDefault();
      if (activeSymbol) selectSymbol(activeSymbol.symbol);
      else setOpen(false);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true);
      if (!matches.length || loading || error) return;
      const next = !expanded || activeIndex < 0 ? (event.key === 'ArrowDown' ? 0 : matches.length - 1) : (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
      setActiveIndex(next);
      requestAnimationFrame(() => document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: 'nearest' }));
    }
  };

  return <>
    <div ref={fieldRef} className="spread-symbol-field" data-symbol-picker-open={expanded || undefined}>
      <input ref={inputRef} id="spread-symbol" name="symbol" type="text" role="combobox" required value={value} disabled={disabled}
        autoComplete="off" spellCheck={false} placeholder="Select or enter a symbol"
        aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded ? listId : undefined}
        aria-activedescendant={expanded && activeSymbol && !loading && !error ? `${listId}-${activeIndex}` : undefined}
        onClick={() => { setOpen(true); setActiveIndex(-1); }}
        onChange={event => { onChange(event.target.value); setOpen(true); setActiveIndex(-1); }}
        onKeyDown={handleKeyDown}
        onBlur={event => { if (!fieldRef.current?.contains(event.relatedTarget) && !menuRef.current?.contains(event.relatedTarget)) setOpen(false); }} />
      <button type="button" className="spread-symbol-toggle" aria-label="Show spread symbols" aria-expanded={expanded} disabled={disabled}
        onMouseDown={event => event.preventDefault()}
        onClick={() => { inputRef.current?.focus({ preventScroll: true }); setOpen(!expanded); setActiveIndex(-1); }}><ChevronDown size={13} aria-hidden="true" /></button>
    </div>
    {expanded && position && createPortal(<div ref={menuRef} className="spread-symbol-menu" style={position.style}>
      <div className="spread-symbol-menu-label">Available symbols</div>
      <div id={listId} role="listbox" aria-label="Spread symbols" aria-busy={loading} className="spread-symbol-list">
        {!loading && !error && matches.map((entry, index) => <div key={entry.symbol} id={`${listId}-${index}`} role="option" aria-selected={entry.symbol === value}
          data-active={activeIndex === index} className="spread-symbol-option" title={[entry.category, !entry.configured && 'Not configured'].filter(Boolean).join(' · ')}
          onMouseDown={event => event.preventDefault()} onMouseMove={() => setActiveIndex(index)} onClick={() => selectSymbol(entry.symbol)}>
          <span>{entry.symbol}</span><span className="spread-symbol-option-detail">{!entry.configured && <small>Not configured</small>}{entry.symbol === value && <Check size={12} aria-hidden="true" />}</span>
        </div>)}
      </div>
      {loading ? <p className="spread-symbol-message" role="status">Loading symbols…</p>
        : error ? <div className="spread-symbol-message" role="status"><span>Symbols unavailable. Enter a symbol manually.</span><button type="button" onMouseDown={event => event.preventDefault()} onClick={reload}>Retry</button></div>
          : !matches.length && <p className="spread-symbol-message" role="status">No matching symbols. You can enter a symbol manually.</p>}
    </div>, position.root)}
  </>;
}
