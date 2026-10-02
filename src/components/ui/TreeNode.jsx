import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * Premium-flat tree node. Caller supplies icon + label; this handles indent,
 * chevron, selected state, and hover.
 */
export const TreeNode = ({
  label,
  icon,
  depth = 0,
  hasChildren = false,
  expanded = false,
  selected = false,
  onClick,
  onDoubleClick,
  onContextMenu,
  className,
}) => (
  <div
    role="treeitem"
    aria-selected={selected}
    aria-expanded={hasChildren ? expanded : undefined}
    onClick={onClick}
    onDoubleClick={onDoubleClick}
    onContextMenu={onContextMenu}
    className={cn(
      'flex items-center h-7 pr-2 text-[11px] font-normal cursor-default select-none',
      'text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface-2)]',
      selected &&
        'bg-[color:var(--accent-100)] text-[color:var(--text-primary)] font-semibold',
      className
    )}
    style={{ paddingLeft: 8 + depth * 14 }}
  >
    <span className="w-4 h-4 flex items-center justify-center mr-1 shrink-0">
      {hasChildren ? (
        <ChevronRight
          size={12}
          className={cn(
            'text-[color:var(--text-muted)] transition-transform duration-150',
            expanded && 'rotate-90'
          )}
        />
      ) : null}
    </span>
    {icon && <span className="mr-1.5 shrink-0 text-[color:var(--text-muted)]">{icon}</span>}
    <span className="truncate">{label}</span>
  </div>
);
