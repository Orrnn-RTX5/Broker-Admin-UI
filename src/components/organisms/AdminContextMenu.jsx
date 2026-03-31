import React, { useEffect, useRef } from 'react';
import { 
  Plus, Settings, X, ArrowUp, ArrowDown, ArrowDownAZ, 
  Copy, Upload, Download, Search, Check, ChevronRight
} from 'lucide-react';

const ContextMenu = ({ x, y, onClose, onAdd }) => {
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

  const MenuItem = ({ icon: Icon, iconColor, label, shortcut, rightArrow, checked, separator, onClick }) => {
    if (separator) {
      return <div className="h-[1px] bg-[#3e3e42] my-1 ml-6 mr-1"></div>;
    }

    const handleClick = () => {
      if (onClick) {
        onClick();
        onClose();
      }
    };

    return (
      <div 
        onClick={handleClick}
        className="flex items-center w-full py-[3px] hover:bg-[#3e3e42] cursor-default text-[11.5px] text-[#cccccc] hover:text-white transition-none group px-1"
      >
        <div className="w-6 flex items-center justify-center shrink-0">
          {checked && <Check size={12} className="text-[#e1e1e1]" />}
          {!checked && Icon && <Icon size={12} className={iconColor} />}
        </div>
        <div className="flex-1 flex items-center justify-between pr-2 pl-1">
          <span>{label}</span>
          <div className="flex items-center text-[#808080] font-mono text-[10px] group-hover:text-white">
            {shortcut && <span>{shortcut}</span>}
            {rightArrow && <ChevronRight size={12} />}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      ref={menuRef}
      className="fixed z-[9999] w-[240px] bg-[#1e1e1e] border border-[#3e3e42] shadow-[4px_4px_10px_rgba(0,0,0,0.5)] py-1"
      style={style}
      onContextMenu={(e) => e.preventDefault()}
    >
      <MenuItem label="Servers" rightArrow />
      <MenuItem separator />
      <MenuItem icon={Plus} iconColor="text-emerald-500" label="Add" shortcut="Ctrl+N" onClick={onAdd} />
      <MenuItem icon={Settings} iconColor="text-blue-500" label="Edit" shortcut="Ctrl+U" />
      <MenuItem icon={X} iconColor="text-red-500" label="Delete" shortcut="Ctrl+D" />
      <MenuItem separator />
      <MenuItem icon={ArrowUp} iconColor="text-[#808080]" label="Move Up" />
      <MenuItem icon={ArrowDown} iconColor="text-[#808080]" label="Move Down" />
      <MenuItem icon={ArrowDownAZ} iconColor="text-blue-500" label="Sort Alphabetically" />
      <MenuItem separator />
      <MenuItem label="Automation Triggers" rightArrow />
      <MenuItem label="Automation Actions" rightArrow />
      <MenuItem separator />
      <MenuItem label="Copy As" rightArrow />
      <MenuItem icon={Upload} iconColor="text-emerald-500" label="Export to File" />
      <MenuItem icon={Download} iconColor="text-emerald-500" label="Import from File" />
      <MenuItem icon={Download} iconColor="text-emerald-500" label="Import from Server" />
      <MenuItem separator />
      <MenuItem label="Request" rightArrow />
      <MenuItem icon={Search} iconColor="text-blue-500" label="Find" shortcut="Ctrl+F" />
      <MenuItem separator />
      <MenuItem checked label="Auto Arrange" />
      <MenuItem checked label="Grid" />
      <MenuItem separator />
      <MenuItem label="Columns" rightArrow />
    </div>
  );
};

export default ContextMenu;
