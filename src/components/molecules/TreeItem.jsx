import React, { useState } from 'react';
import { ChevronRight, Folder, File } from 'lucide-react';
import { cn } from '../../lib/cn';

const TreeItem = ({ item, level = 0, onSelect, onDoubleClick, onLockedDropdownClick, selectedLabel }) => {
  const [isOpen, setIsOpen] = useState(item.initiallyExpanded);
  const hasChildren = item.children && item.children.length > 0;
  const showArrow = hasChildren || item.lockedDropdown;
  const isBlockedNavigation = Boolean(item.blockedNavigation);
  const isActive = selectedLabel === item.label;
  const Icon = item.icon || (hasChildren ? Folder : File);

  const handleArrowClick = (e) => {
    e.stopPropagation();
    if (item.lockedDropdown) {
      onLockedDropdownClick && onLockedDropdownClick(item);
      return;
    }
    if (hasChildren) setIsOpen((current) => !current);
  };

  const handleRowClick = () => {
    if (hasChildren && !item.lockedDropdown) {
      setIsOpen((current) => !current);
    }

    if (item.lockedDropdown && isBlockedNavigation) {
      onLockedDropdownClick && onLockedDropdownClick(item);
      return;
    }

    onSelect && onSelect(item);
  };

  return (
    <div>
      <div
        onClick={handleRowClick}
        onDoubleClick={() => onDoubleClick && onDoubleClick(item)}
        className={cn(
          'flex items-center h-7 pr-2 select-none text-[12px]',
          isBlockedNavigation ? 'cursor-not-allowed' : 'cursor-default',
          'transition-colors duration-100',
          isActive
            ? 'bg-[color:var(--bg-surface-3)] text-[color:var(--text-primary)] font-medium'
            : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-surface-2)]'
        )}
        style={{ paddingLeft: `${level * 14 + 6}px` }}
      >
        <button
          type="button"
          onClick={handleArrowClick}
          className={cn(
            'w-4 h-4 flex items-center justify-center shrink-0 rounded-sm hover:bg-[color:var(--bg-surface-3)] focus:outline-none',
            item.lockedDropdown ? 'cursor-not-allowed' : 'cursor-default'
          )}
          tabIndex={-1}
        >
          {showArrow && (
            <ChevronRight
              size={11}
              className={cn(
                'text-[color:var(--text-muted)] transition-transform duration-150',
                !item.lockedDropdown && isOpen && 'rotate-90'
              )}
            />
          )}
        </button>

        <div className="w-4 h-4 flex items-center justify-center shrink-0 text-[color:var(--text-muted)]">
          <Icon size={12} />
        </div>

        <span className="ml-1.5 whitespace-nowrap overflow-hidden text-ellipsis leading-tight flex-1">
          {item.label}
          {item.count !== undefined && (
            <span className="ml-1.5 text-[10px] font-mono text-[color:var(--text-muted)]">
              {item.count}
            </span>
          )}
        </span>
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
              onLockedDropdownClick={onLockedDropdownClick}
              selectedLabel={selectedLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeItem;
