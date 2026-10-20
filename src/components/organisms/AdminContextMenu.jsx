import React, { useEffect, useRef } from 'react';
import { 
  Plus, Settings, X, ArrowUp, ArrowDown, ArrowDownAZ, 
  Copy, Upload, Download, Search, Check, ChevronRight
} from 'lucide-react';

// Sweep SUI-A7: none of these actions has a backend in this workspace except
// the caller-wired Add/Edit/Delete, so every other entry renders disabled
// with the reason instead of closing the menu with no effect.
export const ADMIN_MENU_UNAVAILABLE_REASON = 'This action is not available in this workspace.';
export const ADMIN_MENU_ADD_UNAVAILABLE_REASON = 'Group creation is not permitted for this session.';
export const ADMIN_MENU_DELETE_UNAVAILABLE_REASON = 'Group deletion is not permitted for this session.';
export const ADMIN_MENU_NO_ROW_REASON = 'Select a group row first.';

const ContextMenuItem = ({ icon: Icon, iconColor, label, shortcut, rightArrow, checked, separator, disabled, disabledReason, onClick, onClose }) => {
  if (separator) {
    return <div className="h-[1px] bg-[color:var(--border-default)] my-1 ml-6 mr-1"></div>;
  }

  const isDisabled = Boolean(disabled || !onClick);

  const handleClick = (e) => {
    e.stopPropagation();
    if (isDisabled) {
      return;
    }
    onClick();
    onClose();
  };

  return (
    <div
      onClick={handleClick}
      role="menuitem"
      aria-disabled={isDisabled}
      title={isDisabled ? (disabledReason || ADMIN_MENU_UNAVAILABLE_REASON) : undefined}
      className={`flex items-center w-full py-[4px] rounded-[2px] text-[11.5px] transition-colors group px-1 ${isDisabled ? 'opacity-50 cursor-not-allowed text-[color:var(--text-muted)]' : 'hover:bg-[color:var(--accent-500)]/18 text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]'}`}
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
      <ContextMenuItem onClose={onClose} icon={Plus} iconColor="text-white" label="Add" shortcut="Ctrl+N" onClick={onAdd} disabled={!onAdd} disabledReason={ADMIN_MENU_ADD_UNAVAILABLE_REASON} />
      <ContextMenuItem onClose={onClose} icon={Settings} iconColor="text-white" label="Edit" shortcut="Ctrl+U" onClick={selectedRow && onEdit ? onEdit : null} disabled={!selectedRow || !onEdit} disabledReason={!selectedRow ? ADMIN_MENU_NO_ROW_REASON : ADMIN_MENU_UNAVAILABLE_REASON} />
      <ContextMenuItem onClose={onClose} icon={X} iconColor="text-red-500" label="Delete" shortcut="Ctrl+D" onClick={selectedRow && onDelete ? onDelete : null} disabled={!selectedRow || !onDelete} disabledReason={!selectedRow ? ADMIN_MENU_NO_ROW_REASON : ADMIN_MENU_DELETE_UNAVAILABLE_REASON} />
      <ContextMenuItem onClose={onClose} separator />
      <ContextMenuItem onClose={onClose} icon={ArrowUp} iconColor="text-[color:var(--text-muted)]" label="Move Up" />
      <ContextMenuItem onClose={onClose} icon={ArrowDown} iconColor="text-[color:var(--text-muted)]" label="Move Down" />
      <ContextMenuItem onClose={onClose} icon={ArrowDownAZ} iconColor="text-white" label="Sort Alphabetically" />
      <ContextMenuItem onClose={onClose} separator />
      <ContextMenuItem onClose={onClose} label="Automation Triggers" rightArrow />
      <ContextMenuItem onClose={onClose} label="Automation Actions" rightArrow />
      <ContextMenuItem onClose={onClose} separator />
      <ContextMenuItem onClose={onClose} label="Copy As" rightArrow />
      <ContextMenuItem onClose={onClose} icon={Upload} iconColor="text-white" label="Export to File" />
      <ContextMenuItem onClose={onClose} icon={Download} iconColor="text-white" label="Import from File" />
      <ContextMenuItem onClose={onClose} icon={Download} iconColor="text-white" label="Import from Server" />
      <ContextMenuItem onClose={onClose} separator />
      <ContextMenuItem onClose={onClose} label="Request" rightArrow />
      <ContextMenuItem onClose={onClose} icon={Search} iconColor="text-white" label="Find" shortcut="Ctrl+F" />
      <ContextMenuItem onClose={onClose} separator />
      <ContextMenuItem onClose={onClose} checked label="Auto Arrange" />
      <ContextMenuItem onClose={onClose} checked label="Grid" />
      <ContextMenuItem onClose={onClose} separator />
      <ContextMenuItem onClose={onClose} label="Columns" rightArrow />
    </div>
  );
};

export default ContextMenu;
