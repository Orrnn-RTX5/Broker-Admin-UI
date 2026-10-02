import { useEffect, useId, useRef, useState } from 'react';
import { parseCsvList } from '../../utils/adminValidation';
import { appendSymbolToList } from '../../utils/lpSymbolLists';

const GroupSymbolPicker = ({ value, onChange, disabled, symbolSource }) => {
  const inputId = useId();
  const listId = useId();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const { symbols, loading, error, reload } = symbolSource;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeSymbol, setActiveSymbol] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const selected = new Set(parseCsvList(value).map(symbol => symbol.toUpperCase()));
  const search = query.trim().toLowerCase();
  const matches = symbols.filter(entry => `${entry.symbol} ${entry.category || ''}`.toLowerCase().includes(search));
  const available = loading || error ? [] : matches.filter(entry => !selected.has(entry.symbol.toUpperCase()));
  const expanded = open && !disabled;
  const activeIndex = loading || error ? -1 : matches.findIndex(entry => entry.symbol === activeSymbol && !selected.has(entry.symbol.toUpperCase()));
  const activeId = expanded && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined;

  useEffect(() => {
    const list = listRef.current;
    const row = activeId ? document.getElementById(activeId) : null;
    if (!list || !row) return;
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
    }
  }, [activeId]);

  const addSymbols = text => {
    if (disabled) return;
    const entries = parseCsvList(text).map(symbol => symbols.find(entry => entry.symbol.toUpperCase() === symbol.toUpperCase())?.symbol || symbol);
    const next = entries.reduce(appendSymbolToList, value);
    if (next !== value) onChange(next);
    const additions = parseCsvList(next).filter(symbol => !selected.has(symbol.toUpperCase()));
    setAnnouncement(additions.length ? `${additions.join(', ')} added to the group.` : 'These symbols are already selected.');
    setQuery('');
    setActiveSymbol(null);
    inputRef.current?.focus({ preventScroll: true });
    setOpen(false);
  };

  const handleKeyDown = event => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      if (!available.length) { setActiveSymbol(null); return; }
      const index = expanded ? available.findIndex(entry => entry.symbol === activeSymbol) : -1;
      const next = event.key === 'ArrowDown'
        ? (index + 1) % available.length
        : (index < 0 ? available.length - 1 : (index + available.length - 1) % available.length);
      setActiveSymbol(available[next]?.symbol || null);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeId) addSymbols(activeSymbol);
      else if (query.trim()) addSymbols(query);
    }
  };

  return (
    <div className="group-create-symbol-picker" data-group-picker-open={expanded || undefined} onKeyDown={event => {
      if (event.key === 'Escape' && expanded) {
        event.preventDefault(); event.stopPropagation(); setOpen(false); setActiveSymbol(null);
      }
    }} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActiveSymbol(null); }
    }}>
      <label htmlFor={inputId}>Add symbol</label>
      <div className="group-create-symbol-adder">
        <input ref={inputRef} id={inputId} type="text" role="combobox" aria-label="Symbol to add"
          aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded ? listId : undefined}
          aria-activedescendant={activeId} autoComplete="off" spellCheck={false}
          placeholder="Search symbol or category…" value={query} disabled={disabled}
          onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
          onChange={event => { setQuery(event.target.value); setActiveSymbol(null); setOpen(true); }}
          onKeyDown={handleKeyDown} />
        <button type="button" onClick={() => addSymbols(query)} disabled={disabled || !query.trim()}>Add</button>
      </div>
      {expanded && <div className="group-create-symbol-results">
        <div className="group-create-symbol-results-heading" aria-hidden="true"><span>Symbol</span><span>Category</span></div>
        <div ref={listRef} id={listId} role="listbox" aria-label="Available symbols" aria-busy={loading} className="group-create-symbol-options">
          {!loading && !error && matches.map((entry, index) => {
            const added = selected.has(entry.symbol.toUpperCase());
            return <div key={entry.symbol} id={`${listId}-${index}`} role="option" aria-selected={activeSymbol === entry.symbol && !added} aria-disabled={added}
              className="group-create-symbol-option" onMouseDown={event => event.preventDefault()}
              onMouseMove={() => setActiveSymbol(added ? null : entry.symbol)}
              onClick={() => { if (!added) addSymbols(entry.symbol); }}>
              <span className="group-create-symbol-option-name">{entry.symbol}{added && <small>Selected</small>}</span>
              <span className="group-create-symbol-option-category">{String(entry.category || 'Other').replace(/[\\/]+/g, ' / ')}{!entry.configured && <small>Not configured</small>}</span>
            </div>;
          })}
        </div>
        {loading ? <p className="group-create-symbol-message" role="status">Loading symbols…</p>
          : error ? <div className="group-create-symbol-message" role="status"><span>Symbols could not be loaded. You can still enter a symbol manually.</span><button type="button" onClick={() => { inputRef.current?.focus({ preventScroll: true }); reload(); }}>Retry</button></div>
            : matches.length === 0 && <p className="group-create-symbol-message" role="status">{symbols.length ? 'No matching symbols.' : 'No symbols available.'} You can add a symbol or pattern manually.</p>}
      </div>}
      <span className="group-create-sr-only" role="status" aria-live="polite">{announcement}</span>
    </div>
  );
};

export default GroupSymbolPicker;
