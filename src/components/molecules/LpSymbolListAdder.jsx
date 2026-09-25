import React, { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import LpSymbolDatalist from '../atoms/LpSymbolDatalist';
import { appendSymbolToList } from '../../utils/lpSymbolLists';

/**
 * Helper row under a comma-separated symbol field: pick any LP symbol (or type
 * a pattern) and append it to `value` with the same ", " separated format.
 */
const LpSymbolListAdder = ({ value, onChange, disabled = false, className = '' }) => {
  const listId = `lp-symbols-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [pending, setPending] = useState('');

  const add = () => {
    const next = appendSymbolToList(value, pending);
    if (next !== value) onChange(next);
    setPending('');
  };

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <input
        type="text"
        value={pending}
        onChange={(event) => setPending(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            add();
          }
        }}
        disabled={disabled}
        list={listId}
        autoComplete="off"
        aria-label="Symbol to add"
        placeholder="Add symbol…"
        className="flex-1 min-w-0 bg-[color:var(--bg-surface-2)] border border-[#555] text-white text-[11px] px-2 py-1 focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors disabled:opacity-50"
      />
      <LpSymbolDatalist id={listId} />
      <button
        type="button"
        onClick={add}
        disabled={disabled || !pending.trim()}
        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-[color:var(--bg-surface-3)] border border-[#555] text-[color:var(--text-primary)] rounded-sm hover:border-[color:var(--accent-500)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus size={11} /> Add
      </button>
    </div>
  );
};

export default LpSymbolListAdder;
