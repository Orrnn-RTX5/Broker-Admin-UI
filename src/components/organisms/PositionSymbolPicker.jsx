import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

export default function PositionSymbolPicker({ value, onChange, options, disabled, title }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState(null);
  const fieldRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const listId = useId();
  const query = value.trim().toLowerCase();
  const matches = options.some(symbol => symbol.toLowerCase() === query)
    ? options : options.filter(symbol => symbol.toLowerCase().includes(query));
  const expanded = open && !disabled;
  const activeSymbol = matches[activeIndex];

  useLayoutEffect(() => {
    if (!expanded) return undefined;
    const updatePosition = () => {
      const box = fieldRef.current.getBoundingClientRect();
      const width = Math.min(box.width, window.innerWidth - 16);
      const desiredHeight = Math.min(240, Math.max(1, matches.length) * 30 + 40);
      const below = window.innerHeight - box.bottom - 14;
      const above = box.top - 14;
      const placeAbove = below < desiredHeight && above > below;
      const maxHeight = Math.min(desiredHeight, Math.max(0, placeAbove ? above : below));
      setPosition({
        left: Math.max(8, Math.min(box.left, window.innerWidth - width - 8)),
        top: placeAbove ? box.top - maxHeight - 6 : box.bottom + 6,
        width, maxHeight,
      });
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
    if (event.key === 'Escape') {
      event.stopPropagation();
      setOpen(false);
      setActiveIndex(-1);
    } else if (event.key === 'Tab') {
      setOpen(false);
    } else if (event.key === 'Enter' && expanded && activeSymbol) {
      event.preventDefault();
      selectSymbol(activeSymbol);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      if (!matches.length) return;
      const next = !expanded || activeIndex < 0
        ? (event.key === 'ArrowDown' ? 0 : matches.length - 1)
        : (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
      setActiveIndex(next);
      requestAnimationFrame(() => document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: 'nearest' }));
    }
  };

  return (
    <>
      <div ref={fieldRef} className="admin-positions-symbol-field" data-disabled={disabled} title={title}>
        <Search size={12} aria-hidden="true" />
        <input
          ref={inputRef}
          id="positions-close-symbol"
          className="admin-positions-symbol-input"
          type="text"
          role="combobox"
          aria-label="Close all positions symbol"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-activedescendant={expanded && activeSymbol ? `${listId}-${activeIndex}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Select symbol"
          value={value}
          disabled={disabled}
          onClick={() => { setOpen(true); setActiveIndex(-1); }}
          onChange={event => { onChange(event.target.value); setOpen(true); setActiveIndex(-1); }}
          onKeyDown={handleKeyDown}
          onBlur={event => { if (!fieldRef.current?.contains(event.relatedTarget)) setOpen(false); }}
        />
        <button
          type="button"
          className="admin-positions-symbol-toggle"
          aria-label="Show position symbols"
          aria-expanded={expanded}
          disabled={disabled}
          onMouseDown={event => event.preventDefault()}
          onClick={() => { inputRef.current?.focus({ preventScroll: true }); setOpen(!expanded); setActiveIndex(-1); }}
        ><ChevronDown size={13} aria-hidden="true" /></button>
      </div>
      {expanded && position && createPortal(
        <div ref={menuRef} className="admin-positions-symbol-menu" style={position}>
          <div className="admin-positions-symbol-menu-label">Open position symbols</div>
          <div id={listId} role="listbox" aria-label="Position symbols" className="admin-positions-symbol-list">
            {matches.map((symbol, index) => (
              <div
                key={symbol}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={symbol === value}
                data-active={index === activeIndex}
                className="admin-positions-symbol-option"
                onMouseDown={event => event.preventDefault()}
                onClick={() => selectSymbol(symbol)}
                onMouseMove={() => setActiveIndex(index)}
              >
                <span>{symbol}</span>
                {symbol === value && <Check size={12} aria-hidden="true" />}
              </div>
            ))}
          </div>
          {!matches.length && <div className="admin-positions-symbol-empty" role="status">No matching symbols</div>}
        </div>, document.body,
      )}
    </>
  );
}
