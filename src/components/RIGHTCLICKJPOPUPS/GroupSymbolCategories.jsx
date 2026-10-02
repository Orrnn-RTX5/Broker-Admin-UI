import { useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { buildGroupSymbolCategories, toggleGroupSymbolCategory } from '../../utils/groupSymbolCategories';

const CategoryCheckbox = ({ label, details, checked, mixed, onChange, className = '' }) => {
  const labelId = useId();
  const detailsId = useId();
  return <label className={`group-create-category-option ${className}`} data-state={mixed ? 'mixed' : checked ? 'checked' : 'unchecked'}
    onPointerDown={event => { if (event.target.tagName !== 'INPUT') event.preventDefault(); }}>
    <input type="checkbox" checked={checked} aria-checked={mixed ? 'mixed' : checked}
      aria-labelledby={labelId} aria-describedby={detailsId} onChange={onChange}
      ref={input => { if (input) input.indeterminate = mixed; }} />
    <span id={labelId}>{label}</span><small id={detailsId}>{details}</small>
  </label>;
};

const GroupSymbolCategories = ({ value, onChange, disabled, symbolSource }) => {
  const labelId = useId();
  const listId = useId();
  const hintId = useId();
  const valueId = useId();
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const { symbols, loading, error, reload } = symbolSource;
  const categories = buildGroupSymbolCategories(symbols, value);
  const allSymbols = categories.flatMap(category => category.symbols);
  const selectedCount = categories.reduce((count, category) => count + category.selectedCount, 0);
  const allSelected = allSymbols.length > 0 && selectedCount === allSymbols.length;
  const selected = categories.filter(category => category.selectedCount > 0);
  const expanded = open && !disabled;
  const description = selected.map(category => category.selectedCount === category.symbols.length
    ? category.label : `${category.label} (${category.selectedCount}/${category.symbols.length})`).join(', ');

  const close = () => { triggerRef.current?.focus({ preventScroll: true }); setOpen(false); };
  const show = last => {
    setOpen(true);
    window.requestAnimationFrame(() => {
      const options = listRef.current?.querySelectorAll('input[type="checkbox"]');
      options?.[last ? options.length - 1 : 0]?.focus();
    });
  };
  const selectCategory = category => {
    const removing = category.selectedCount === category.symbols.length;
    onChange(toggleGroupSymbolCategory(value, category));
    setAnnouncement(`${category.label}: ${category.symbols.length} symbol${category.symbols.length === 1 ? '' : 's'} ${removing ? 'removed from' : 'selected for'} the group.`);
  };
  const selectAll = () => {
    onChange(toggleGroupSymbolCategory(value, { symbols: allSymbols }));
    setAnnouncement(`${allSymbols.length} symbols ${allSelected ? 'removed from' : 'selected for'} the group.`);
  };

  return <div className="group-create-category-picker" data-group-picker-open={expanded || undefined}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onKeyDown={event => {
      if (event.key === 'Escape' && expanded) { event.preventDefault(); event.stopPropagation(); close(); }
      const options = [...(listRef.current?.querySelectorAll('input[type="checkbox"]') || [])];
      const index = options.indexOf(event.target);
      if (index >= 0) {
        let next;
        if (event.key === 'ArrowDown') next = (index + 1) % options.length;
        if (event.key === 'ArrowUp') next = (index + options.length - 1) % options.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = options.length - 1;
        if (next !== undefined) { event.preventDefault(); options[next]?.focus(); }
        if (event.key === 'Enter') { event.preventDefault(); event.target.click(); }
      }
      const leavingCheckboxes = event.key === 'Tab' && index >= 0 && (event.shiftKey ? index === 0 : index === options.length - 1);
      const leavingRetry = event.key === 'Tab' && event.target !== triggerRef.current && index < 0;
      if (expanded && (leavingCheckboxes || leavingRetry)) {
        event.preventDefault();
        const next = !event.shiftKey && event.currentTarget.parentElement.querySelector('.group-create-symbol-adder input:not(:disabled)');
        if (next) { next.focus(); setOpen(false); } else close();
      }
    }}>
    <span id={labelId} className="group-create-category-label">Allowed symbols</span>
    <button ref={triggerRef} type="button" className="group-create-category-trigger" aria-labelledby={labelId}
      aria-describedby={`${valueId} ${hintId}`} aria-expanded={expanded} aria-controls={expanded ? listId : undefined}
      disabled={disabled} onClick={() => { if (expanded) close(); else show(false); }}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show(event.key === 'ArrowUp'); }
      }}>
      <span id={valueId} data-placeholder={!description}>{description || (loading ? 'Loading categories…' : 'Select categories…')}</span><ChevronDown size={14} aria-hidden="true" />
    </button>
    {expanded && <div className="group-create-category-results">
      <div ref={listRef} id={listId} role="group" aria-label="Symbol categories" aria-busy={loading} className="group-create-category-options">
        {!loading && !error && categories.length > 0 && <CategoryCheckbox label="Select all" className="group-create-category-select-all"
          details={`${selectedCount}/${allSymbols.length} selected`} checked={allSelected} mixed={selectedCount > 0 && !allSelected} onChange={selectAll} />}
        {!loading && !error && categories.map(category => <CategoryCheckbox key={category.category} label={category.label}
          checked={category.selectedCount === category.symbols.length}
          mixed={category.selectedCount > 0 && category.selectedCount < category.symbols.length}
          details={category.selectedCount ? `${category.selectedCount}/${category.symbols.length} selected` : `${category.symbols.length} symbol${category.symbols.length === 1 ? '' : 's'}`}
          onChange={() => selectCategory(category)} />)}
      </div>
      {loading ? <p className="group-create-symbol-message" role="status">Loading categories…</p>
        : error ? <div className="group-create-symbol-message" role="status"><span>Categories could not be loaded.</span><button type="button" onClick={() => { triggerRef.current?.focus({ preventScroll: true }); reload(); }}>Retry</button></div>
          : categories.length === 0 && <p className="group-create-symbol-message" role="status">No symbol categories available. You can add symbols individually below.</p>}
    </div>}
    <small id={hintId}>Check categories to add their symbols, or use Select all.</small>
    <span className="group-create-sr-only" role="status" aria-live="polite">{announcement}</span>
  </div>;
};

export default GroupSymbolCategories;
