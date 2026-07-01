import React, { useEffect, useRef } from 'react';
import { 
  Plus, Settings, X, ArrowUp, ArrowDown, ArrowDownAZ, 
  Copy, Upload, Download, Search, Check, ChevronRight
} from 'lucide-react';

const ContextMenuItem = ({ icon: Icon, iconColor, label, shortcut, rightArrow, checked, separator, onClick, onClose }) => {
  if (separator) {
    return <div className="h-[1px] bg-[color:var(--border-default)] my-1 ml-6 mr-1"></div>;
  }

  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    }
    onClose();
  };

  return (
    <div
      onClick={handleClick}
      className="flex items-center w-full py-[4px] rounded-[2px] hover:bg-[color:var(--accent-500)]/18 text-[11.5px] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors group px-1"
    >
      <div className="w-6 flex items-center justify-center shrink-0">
        {checked && <Check size={12} className="text-[color:var(--text-primary)]" />}
        {!checked && Icon && <Icon size={12} className={iconColor} />}
      </div>
      <div className="flex-1 flex items-center justify-between pr-2 pl-1">
        <span>{label}</span>
        <div className="flex items-center text-[color:var(--text-muted)] font-mono text-[10px] group-hover:text-[color:var(--text-primary)]">
          {shortcut && <span>{shortcut}</span>}
          {rightArrow && <ChevronRight size={12} />}
        </div>
      </div>
    </div>
  );
};

const ContextMenu = ({ x, y, onClose, onAdd, onEdit, onDelete, selectedRow }) => {
  const menuRef = useRef(null);

  // Close menu if clicked outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    
    // Use pointerdown to catch it early before other click events
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [onClose]);

  // Ensure menu stays within viewport
  const style = {
    top: y,
    left: x,
  };

  return (
    <div 
      ref={menuRef}
      className="fixed z-[9999] w-[240px] bg-[color:var(--bg-surface-1)] border border-[color:var(--border-strong)] shadow-[var(--shadow-lg)] p-1 select-none rounded-[var(--radius-sm)]"
      style={style}
      onContextMenu={(e) => e.preventDefault()}
    >
      <ContextMenuItem onClose={onClose} label="Servers" rightArrow />
      <ContextMenuItem onClose={onClose} separator />
      <ContextMenuItem onClose={onClose} icon={Plus} iconColor="text-emerald-500" label="Add" shortcut="Ctrl+N" onClick={onAdd} />
      <ContextMenuItem onClose={onClose} icon={Settings} iconColor="text-blue-500" label="Edit" shortcut="Ctrl+U" onClick={selectedRow ? onEdit : null} />
      <ContextMenuItem onClose={onClose} icon={X} iconColor="text-red-500" label="Delete" shortcut="Ctrl+D" onClick={selectedRow ? onDelete : null} />
      <ContextMenuItem onClose={onClose} separator />
      <ContextMenuItem onClose={onClose} icon={ArrowUp} iconColor="text-[color:var(--text-muted)]" label="Move Up" />
      <ContextMenuItem onClose={onClose} icon={ArrowDown} iconColor="text-[color:var(--text-muted)]" label="Move Down" />
      <ContextMenuItem onClose={onClose} icon={ArrowDownAZ} iconColor="text-blue-500" label="Sort Alphabetically" />
      <ContextMenuItem onClose={onClose} separator />
      <ContextMenuItem onClose={onClose} label="Automation Triggers" rightArrow />
      <ContextMenuItem onClose={onClose} label="Automation Actions" rightArrow />
      <ContextMenuItem onClose={onClose} separator />
      <ContextMenuItem onClose={onClose} label="Copy As" rightArrow />
      <ContextMenuItem onClose={onClose} icon={Upload} iconColor="text-emerald-500" label="Export to File" />
      <ContextMenuItem onClose={onClose} icon={Download} iconColor="text-emerald-500" label="Import from File" />
      <ContextMenuItem onClose={onClose} icon={Download} iconColor="text-emerald-500" label="Import from Server" />
      <ContextMenuItem onClose={onClose} separator />
      <ContextMenuItem onClose={onClose} label="Request" rightArrow />
      <ContextMenuItem onClose={onClose} icon={Search} iconColor="text-blue-500" label="Find" shortcut="Ctrl+F" />
      <ContextMenuItem onClose={onClose} separator />
      <ContextMenuItem onClose={onClose} checked label="Auto Arrange" />
      <ContextMenuItem onClose={onClose} checked label="Grid" />
      <ContextMenuItem onClose={onClose} separator />
      <ContextMenuItem onClose={onClose} label="Columns" rightArrow />
    </div>
  );
};

export default ContextMenu;
