import React, { useState } from 'react';
import { ChevronRight, Folder, File } from 'lucide-react';
import { cn } from '../../lib/cn';

const TreeItem = ({ item, level = 0, onSelect, onDoubleClick, selectedLabel }) => {
  const [isOpen, setIsOpen] = useState(item.initiallyExpanded);
  const hasChildren = item.children && item.children.length > 0;
  const isActive = selectedLabel === item.label;
  const Icon = item.icon || (hasChildren ? Folder : File);

  const handleArrowClick = (e) => {
    e.stopPropagation();
    if (hasChildren) setIsOpen(!isOpen);
  };

  return (
    <div>
      <div
        onClick={() => onSelect && onSelect(item)}
        onDoubleClick={() => onDoubleClick && onDoubleClick(item)}
        className={cn(
          'flex items-center h-7 pr-2 cursor-default select-none text-[12px]',
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
          className="w-4 h-4 flex items-center justify-center shrink-0 rounded-sm hover:bg-[color:var(--bg-surface-3)] focus:outline-none"
          tabIndex={-1}
        >
          {hasChildren && (
            <ChevronRight
              size={11}
              className={cn(
                'text-[color:var(--text-muted)] transition-transform duration-150',
                isOpen && 'rotate-90'
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

      {hasChildren && isOpen && (
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
