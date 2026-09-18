import React, { useState } from 'react';
import { ChevronRight, Folder, File, LockKeyhole } from 'lucide-react';
import { cn } from '../../lib/cn';

const TreeItem = ({ item, level = 0, onSelect, onDoubleClick, selectedLabel }) => {
  const [isOpen, setIsOpen] = useState(item.initiallyExpanded);
  const hasChildren = item.children && item.children.length > 0;
  const showArrow = hasChildren || item.lockedDropdown;
  const isBlockedNavigation = Boolean(item.blockedNavigation || item.lockedDropdown || item.disabled);
  const isActive = !isBlockedNavigation && selectedLabel === item.label;
  const Icon = item.icon || (hasChildren ? Folder : File);

  const handleArrowClick = (e) => {
    e.stopPropagation();
    if (isBlockedNavigation) return;
    if (hasChildren) setIsOpen((current) => !current);
  };

  const handleRowClick = () => {
    if (isBlockedNavigation) return;
    if (hasChildren && !item.lockedDropdown) {
      setIsOpen((current) => !current);
    }

    onSelect && onSelect(item);
  };

  return (
    <div>
      <div
        onClick={handleRowClick}
        onDoubleClick={() => !isBlockedNavigation && onDoubleClick && onDoubleClick(item)}
        aria-disabled={isBlockedNavigation || undefined}
        title={isBlockedNavigation ? `${item.label} — unavailable` : undefined}
        className={cn(
          'mx-1 flex items-center min-h-[23px] pr-2 select-none text-[12px] rounded-[var(--radius-sm)]',
          showArrow && 'admin-tree-branch',
          isBlockedNavigation ? 'cursor-not-allowed opacity-50' : 'cursor-default',
          'transition-colors duration-100',
          isActive
            ? 'bg-[color:var(--accent-soft)] text-[color:var(--text-primary)] font-semibold shadow-[inset_2px_0_0_var(--accent-500)]'
            : isBlockedNavigation
              ? 'text-[color:var(--text-muted)]'
              : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-surface-3)] hover:text-[color:var(--text-primary)]'
        )}
        style={{ paddingLeft: `${level * 14 + 6}px` }}
      >
        <button
          type="button"
          disabled={isBlockedNavigation || !hasChildren}
          aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${item.label}`}
          onClick={handleArrowClick}
          className={cn(
            'w-5 h-5 flex items-center justify-center shrink-0 rounded-sm enabled:hover:bg-[color:var(--bg-surface-3)] focus:outline-none',
            isBlockedNavigation ? 'cursor-not-allowed' : 'cursor-default'
          )}
          tabIndex={-1}
        >
          {showArrow && (
            <ChevronRight
              size={11}
              className={cn(
                'text-[color:var(--text-secondary)] transition-transform duration-150',
                !item.lockedDropdown && isOpen && 'rotate-90'
              )}
            />
          )}
        </button>

        <div className={cn('w-4 h-4 flex items-center justify-center shrink-0', isActive ? 'text-[color:var(--accent-600)]' : 'text-[color:var(--text-muted)]')}>
          <Icon size={12} />
        </div>

        <span className="admin-tree-label ml-1.5 whitespace-nowrap overflow-hidden text-ellipsis leading-tight flex-1">
          {item.label}
          {item.count !== undefined && (
            <span className="ml-1.5 text-[10px] font-mono text-[color:var(--text-muted)]">
              {item.count}
            </span>
          )}
        </span>
        {isBlockedNavigation && <LockKeyhole size={11} className="ml-2 shrink-0 text-[color:var(--text-muted)]" aria-hidden="true" />}
      </div>

      {hasChildren && !item.lockedDropdown && isOpen && (
        <div>
          {item.children.map((child, index) => (
            <TreeItem
              key={`${child.label}-${index}`}
              item={child}
              level={level + 1}
              onSelect={onSelect}
              onDoubleClick={onDoubleClick}
              selectedLabel={selectedLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeItem;
