import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * Chrome-style tab bar. Each tab is an open viewType. Click to switch,
 * X to close. Sits between the breadcrumb and the data area.
 */
export const TabBar = ({ tabs, activeTab, onSelect, onClose }) => {
  if (!tabs || tabs.length === 0) return null;
  return (
    <div className="flex items-stretch h-8 bg-[color:var(--bg-surface-2)] border-b border-[color:var(--border-subtle)] overflow-x-auto no-scrollbar">
      {tabs.map((t) => {
        const active = t === activeTab;
        return (
          <div
            key={t}
            onClick={() => onSelect(t)}
            className={cn(
              'group flex items-center gap-1.5 h-full px-3 cursor-default select-none text-[12px] border-r border-[color:var(--border-subtle)] min-w-[120px] max-w-[220px]',
              active
                ? 'bg-[color:var(--bg-surface-1)] text-[color:var(--text-primary)] border-b-2 border-b-[color:var(--accent-500)] -mb-px'
                : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-surface-1)] hover:text-[color:var(--text-primary)]'
            )}
          >
            <span className="truncate flex-1">{t}</span>
            {tabs.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); onClose(t); }}
                aria-label={`Close ${t}`}
                className="w-4 h-4 flex items-center justify-center rounded-[2px] opacity-0 group-hover:opacity-100 hover:bg-[color:var(--bg-surface-3)] text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition-opacity"
              >
                <X size={10} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};
