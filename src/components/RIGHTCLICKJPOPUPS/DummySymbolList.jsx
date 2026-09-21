import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, ListChecks, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import {
  canMoveSelectedSymbols, findSymbolMatch, getSymbolClipboardText, moveSelectedSymbols, rangeSymbolIds,
} from '../../utils/symbolListActions';
import './DummySymbolList.css';

export default function DummySymbolList({ items, onChange, onEdit, selected, onSelect }) {
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const findRef = useRef(null);
  const [selection, setSelection] = useState({ active: selected, ids: selected ? [selected] : [], anchor: selected });
  const [menu, setMenu] = useState(null);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  // A symbol added or edited in the nested dialog becomes the active row.
  const ids = (selection.active === selected ? selection.ids : selected ? [selected] : []).filter(id => items.some(item => item.id === id));
  const selectedSet = new Set(ids);
  const anchor = selection.active === selected ? selection.anchor : selected;
  const selectedItem = ids.length === 1 ? items.find(item => item.id === ids[0]) : null;
  const matches = items.filter(item => query.trim() && item.path.toLowerCase().includes(query.trim().toLowerCase()));
  const matchIndex = matches.findIndex(item => item.id === selected);

  const select = (nextIds, active = nextIds.at(-1) || null, anchor = active) => {
    setSelection({ ids: nextIds, active, anchor });
    onSelect(active);
  };
  const rowElement = id => Array.from(rootRef.current?.querySelectorAll('[data-symbol-row]') || []).find(row => row.dataset.symbolRow === id);
  const focusRow = id => requestAnimationFrame(() => {
    const row = rowElement(id);
    (row || rootRef.current)?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  const selectRow = (event, item) => {
    if (event.shiftKey) {
      const range = rangeSymbolIds(items, anchor || selected, item.id);
      select(event.ctrlKey || event.metaKey ? [...new Set([...ids, ...range])] : range, item.id, anchor || selected || item.id);
    } else if (event.ctrlKey || event.metaKey) {
      const next = selectedSet.has(item.id) ? ids.filter(id => id !== item.id) : [...ids, item.id];
      select(next, next.includes(item.id) ? item.id : next.at(-1), item.id);
    } else select([item.id]);
  };
  const move = direction => {
    if (!canMoveSelectedSymbols(items, ids, direction)) return;
    onChange(moveSelectedSymbols(items, ids, direction));
    focusRow(selected);
  };
  const remove = () => {
    if (!ids.length) return;
    const firstIndex = items.findIndex(item => selectedSet.has(item.id));
    const remaining = items.filter(item => !selectedSet.has(item.id));
    const next = remaining[Math.min(firstIndex, remaining.length - 1)]?.id;
    onChange(remaining);
    select(next ? [next] : []);
    if (next) focusRow(next);
    else requestAnimationFrame(() => rootRef.current?.focus());
    setNotice(`${ids.length} symbol ${ids.length === 1 ? 'rule' : 'rules'} removed from this draft (Dummy).`);
  };
  const selectAll = () => {
    select(items.map(item => item.id), selected || items[0]?.id);
    setNotice(`${items.length} symbol rules selected (Dummy).`);
    focusRow(selected || items[0]?.id);
  };
  const copyRows = async () => {
    if (!ids.length) return;
    const text = getSymbolClipboardText(items, ids);
    let copied = false;
    try { await navigator.clipboard.writeText(text); copied = true; } catch {
      // Keep the fallback inside the native modal, whose outside content is inert.
      const input = document.createElement('textarea');
      input.value = text;
      input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
      rootRef.current?.appendChild(input);
      input.select();
      try { copied = document.execCommand('copy'); } catch { /* Report denied clipboard access. */ }
      input.remove();
    }
    setNotice(copied ? `${ids.length} symbol ${ids.length === 1 ? 'rule' : 'rules'} copied (Dummy).` : 'Clipboard access was denied. Allow clipboard access and try again.');
    focusRow(selected);
  };
  const openFind = () => {
    setFindOpen(true);
    requestAnimationFrame(() => { findRef.current?.focus(); findRef.current?.select(); });
  };
  const find = (direction, keepInputFocus = false) => {
    if (!query.trim()) { openFind(); return; }
    setFindOpen(true);
    const id = findSymbolMatch(items, query, selected, direction);
    if (!id) { requestAnimationFrame(() => findRef.current?.focus()); return; }
    select([id]);
    if (keepInputFocus) rowElement(id)?.scrollIntoView({ block: 'nearest' });
    else focusRow(id);
  };
  const closeMenu = (restoreFocus = true) => {
    setMenu(null);
    if (restoreFocus) focusRow(selected);
  };
  const openMenu = (event, item) => {
    event.preventDefault(); event.stopPropagation();
    if (item) {
      if (!selectedSet.has(item.id)) select([item.id]);
    } else select([]);
    setMenu({ x: event.clientX, y: event.clientY });
  };
  const actions = [
    { label: 'Add', shortcut: 'Insert', Icon: Plus, run: () => onEdit(null) },
    { label: 'Edit', shortcut: 'Enter', Icon: Pencil, disabled: !selectedItem, run: () => onEdit(selectedItem) },
    { label: 'Delete', shortcut: 'Delete', Icon: Trash2, disabled: !ids.length, run: remove },
    { label: 'Move Up', Icon: ArrowUp, separator: true, disabled: !canMoveSelectedSymbols(items, ids, -1), run: () => move(-1) },
    { label: 'Move Down', Icon: ArrowDown, disabled: !canMoveSelectedSymbols(items, ids, 1), run: () => move(1) },
    { label: 'Select All', shortcut: 'Ctrl+A', Icon: ListChecks, separator: true, disabled: !items.length, run: selectAll },
    { label: 'Copy', shortcut: 'Ctrl+C', Icon: Copy, disabled: !ids.length, run: copyRows },
    { label: 'Find', shortcut: 'Ctrl+F', Icon: Search, separator: true, run: openFind },
    { label: 'Find Next', shortcut: 'F3', Icon: Search, disabled: !items.length, run: () => find(1) },
    { label: 'Find Previous', shortcut: 'Shift+F3', Icon: Search, disabled: !items.length, run: () => find(-1) },
  ];

  useLayoutEffect(() => {
    if (!menu) return;
    const element = menuRef.current;
    const bounds = element.getBoundingClientRect();
    element.style.left = `${Math.max(6, Math.min(menu.x, window.innerWidth - bounds.width - 6))}px`;
    element.style.top = `${Math.max(6, Math.min(menu.y, window.innerHeight - bounds.height - 6))}px`;
    element.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const dismiss = event => { if (!menuRef.current?.contains(event.target)) setMenu(null); };
    const reposition = () => setMenu(null);
    document.addEventListener('pointerdown', dismiss, true);
    window.addEventListener('resize', reposition);
    return () => { document.removeEventListener('pointerdown', dismiss, true); window.removeEventListener('resize', reposition); };
  }, [menu]);

  // The active Symbols tab owns these shortcuts, including when its tab button
  // has focus. Nested symbol dialogs and text inputs retain their own shortcuts.
  useEffect(() => {
    const owner = rootRef.current?.closest('dialog');
    const onKey = event => {
      if (Array.from(document.querySelectorAll('dialog[open]')).at(-1) !== owner || menuRef.current?.contains(event.target)) return;
      const editing = event.target.closest('input,textarea,select,[contenteditable="true"]');
      const mod = event.ctrlKey || event.metaKey;
      let action;
      if (mod && event.key.toLowerCase() === 'f') action = openFind;
      else if (event.key === 'F3') action = () => find(event.shiftKey ? -1 : 1, event.target === findRef.current);
      else if (!editing) {
        if (mod && event.key.toLowerCase() === 'a') action = selectAll;
        else if (mod && event.key.toLowerCase() === 'c') action = copyRows;
        else if (event.key === 'Insert') action = () => onEdit(null);
        else if (event.key === 'Delete') action = remove;
        else if (event.key === 'Enter' && event.target.closest('[data-symbol-row]') && selectedItem) action = () => {
          const item = items.find(item => item.id === event.target.closest('[data-symbol-row]').dataset.symbolRow);
          select([item.id]); onEdit(item);
        };
        else if ((event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) && items.length) action = () => {
          const row = rowElement(selected) || rowElement(items[0].id);
          if (!selected) select([items[0].id]);
          const bounds = row.getBoundingClientRect();
          setMenu({ x: bounds.left + 25, y: bounds.bottom });
        };
      }
      if (action) { event.preventDefault(); event.stopPropagation(); action(); }
    };
    owner?.addEventListener('keydown', onKey);
    return () => owner?.removeEventListener('keydown', onKey);
  });

  const menuKeys = event => {
    const buttons = Array.from(menuRef.current.querySelectorAll('button:not(:disabled)'));
    const index = buttons.indexOf(document.activeElement);
    if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); closeMenu(); return; }
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % buttons.length;
    if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = buttons.length - 1;
    const shortcut = actions.find(action => !action.disabled && (
      ((event.ctrlKey || event.metaKey) && action.shortcut === `Ctrl+${event.key.toUpperCase()}`)
      || (event.key === 'F3' && action.shortcut === (event.shiftKey ? 'Shift+F3' : 'F3'))
      || (['Insert', 'Delete'].includes(event.key) && action.shortcut === event.key)
    ));
    if (shortcut) { event.preventDefault(); event.stopPropagation(); closeMenu(false); shortcut.run(); }
    else if (next !== undefined) { event.preventDefault(); event.stopPropagation(); buttons[next]?.focus(); }
  };

  return <div ref={rootRef} className="dgp-symbol-list" tabIndex={-1} data-symbol-list>
    {findOpen && <form role="search" aria-label="Find symbols" className="dgp-symbol-find" onSubmit={event => { event.preventDefault(); find(1, true); }}>
      <Search size={14} /><input ref={findRef} aria-label="Find symbol" placeholder="Find symbol or path" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setFindOpen(false); focusRow(selected); }
        if (event.key === 'Enter' && event.shiftKey) { event.preventDefault(); find(-1, true); }
      }} />
      <button type="button" className="dgp-button" aria-label="Find Previous" onClick={() => find(-1)}><ArrowUp size={12} /></button>
      <button type="submit" className="dgp-button" aria-label="Find Next"><ArrowDown size={12} /></button>
      <button type="button" className="dgp-icon-button" aria-label="Close symbol search" onClick={() => { setFindOpen(false); focusRow(selected); }}><X size={14} /></button>
      <span role="status">{!query.trim() ? 'Type a symbol or path.' : !matches.length ? 'No matching symbols.' : matchIndex < 0 ? `${matches.length} matches. Press Enter to find.` : `${matchIndex + 1} of ${matches.length} matches`}</span>
    </form>}
    <div className="dgp-list-layout"><div className="dgp-list-actions">
      <button type="button" className="dgp-button" disabled={!canMoveSelectedSymbols(items, ids, -1)} onClick={() => move(-1)}><ArrowUp size={12} /> Up</button>
      <button type="button" className="dgp-button" disabled={!canMoveSelectedSymbols(items, ids, 1)} onClick={() => move(1)}><ArrowDown size={12} /> Down</button>
      <div className="dgp-action-spacer" />
      <button type="button" className="dgp-button" onClick={() => onEdit(null)}><Plus size={12} /> Add</button>
      <button type="button" className="dgp-button" disabled={!selectedItem} onClick={() => onEdit(selectedItem)}><Pencil size={12} /> Edit</button>
      <button type="button" className="dgp-button" disabled={!ids.length} onClick={remove}><Trash2 size={12} /> Delete</button>
    </div><div className="dgp-table-scroll" onContextMenu={event => openMenu(event)}>
      <table className="dgp-table" aria-label="Symbols"><thead><tr><th>Symbol</th><th>Initial Margin</th><th>Maintenance Margin</th></tr></thead><tbody>
        {items.map((item, index) => <tr key={item.id} data-symbol-row={item.id} tabIndex={selected === item.id || (!selected && index === 0) ? 0 : -1} aria-selected={selectedSet.has(item.id)} className={selectedSet.has(item.id) ? 'dgp-selected' : ''}
          onClick={event => selectRow(event, item)} onContextMenu={event => openMenu(event, item)} onDoubleClick={() => { select([item.id]); onEdit(item); }} onKeyDown={event => {
            if (event.key === ' ') { event.preventDefault(); selectRow(event, item); }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              const next = items[items.indexOf(item) + (event.key === 'ArrowDown' ? 1 : -1)];
              if (next) { selectRow(event, next); focusRow(next.id); }
            }
          }}>
          <td>{item.path} <span className="dgp-dummy">(Dummy)</span></td>
          <td>{item.margin?.useDefault !== false ? 'Default' : item.margin.initial} <span className="dgp-dummy">(Dummy)</span></td>
          <td>{item.margin?.useDefault !== false ? 'Default' : item.margin.maintenance} <span className="dgp-dummy">(Dummy)</span></td>
        </tr>)}
        <tr><td colSpan={3}><button type="button" className="dgp-add-row" onClick={() => onEdit(null)}><Plus size={13} /> click to add...</button></td></tr>
      </tbody></table>{!items.length && <p className="dgp-empty">No symbols configured. Add a sample entry.</p>}
    </div></div>
    <p role="status" className="dgp-symbol-notice">{notice || 'Right-click a symbol for actions. Ctrl-click or Shift-click to select multiple rows.'}</p>
    {menu && <div ref={menuRef} role="menu" aria-label="Symbol actions" className="dgp-symbol-menu" style={{ left: menu.x, top: menu.y }} onKeyDown={menuKeys}>
      {actions.map(action => {
        const { label, shortcut, Icon, disabled, separator, run } = action;
        return <div key={label}>
        {separator && <div role="separator" />}
        <button type="button" role="menuitem" aria-label={label} disabled={disabled} onClick={() => { closeMenu(false); run(); }}><Icon size={14} /><span>{label}</span><kbd>{shortcut}</kbd></button>
      </div>; })}
    </div>}
  </div>;
}
