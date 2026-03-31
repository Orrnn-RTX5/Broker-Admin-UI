import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutGrid, Copy, AlignVerticalSpaceAround, AlignHorizontalSpaceAround, 
  ArrowDownToLine, RotateCcw, BarChart2, PieChart, UserCheck, User, FileText, 
  Files, Loader, Activity, Percent, Users, Puzzle, Mail, BookOpen, Check, ChevronRight,
  PanelTop, PanelBottom, ArrowLeftRight, ArrowLeft, ArrowRight,
  Plus, X, Settings, ArrowRightFromLine, XOctagon, Lock, 
  Upload, Download, FolderOpen, Printer, FileSearch, FileCog, LogOut
} from 'lucide-react';

const MenuBar = ({ onMenuSelect, activeNode, onThemeSelect }) => {
  const [openMenu, setOpenMenu] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  const menus = ['File', 'Edit', 'View', 'Services', 'Window', 'Help'];

  const handleMenuClick = (menu) => {
    if (openMenu === menu) setOpenMenu(null);
    else setOpenMenu(menu);
  };

  const handleFileExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ server: "HexyMarkets", timestamp: new Date() }, null, 2)); 
    const a = document.createElement('a'); 
    a.href = dataStr; 
    a.download = "server_export.json"; 
    a.click();
  };

  const handleFileImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv,.txt';
    input.onchange = (e) => {
       if (e.target.files.length > 0) alert('File mock imported successfully: ' + e.target.files[0].name);
    };
    input.click();
  };

  const handleFileAction = (action) => {
    switch(action) {
       case 'Disconnect': alert('Server disconnected.'); break;
       case 'Change Password': alert('Change Password flow triggered.'); break;
       case 'Open Data Folder': alert(`Opening local directory:\nC:\\Users\\Administrator\\AppData\\Roaming\\MetaQuotes\\Terminal\\`); break;
       case 'Print Preview': alert('Generating print preview presentation...'); break;
       case 'Print Setup': alert('Opening local printer dialog configurations...'); break;
       case 'Exit': alert('Application exit initiated.'); window.close(); break;
    }
  };

  const MenuItem = ({ icon: Icon, iconColor, label, shortcut, rightArrow, checked, separator, onClick, children, isHoverable, disabled }) => {
    if (separator) {
      return <div className="h-[1px] bg-[#3e3e42] my-1 ml-6 mr-1"></div>;
    }
    return (
      <div 
        onClick={(e) => {
          if (disabled) return;
          if (children) return; // parent menus do not close on click
          if (onClick) {
            onClick(label);
            setOpenMenu(null);
          }
        }}
        className={`relative flex items-center w-[260px] py-[3px] cursor-default text-[11.5px] transition-none group ${isHoverable ? 'group/submenu' : ''} px-1 ${
          disabled 
            ? 'text-[#606060]' 
            : `text-[#cccccc] hover:bg-[#3e3e42] hover:text-white ${activeNode === label ? 'text-white' : ''}`
        }`}
      >
        <div className="w-6 flex items-center justify-center shrink-0">
          {checked && <Check size={12} className="text-[#e1e1e1]" />}
          {!checked && Icon && <Icon size={12} className={iconColor || "text-[#3B82F6]"} />}
        </div>
        <div className="flex-1 flex items-center justify-between pr-2 pl-1">
          <span>{label}</span>
          <div className="flex items-center text-[#808080] font-mono text-[10px] group-hover:text-white">
            {shortcut && <span>{shortcut}</span>}
            {rightArrow && <ChevronRight size={12} />}
          </div>
        </div>
        
        {children && (
          <div className="hidden group-hover/submenu:block absolute top-0 left-full z-[10000] bg-[#1e1e1e] border border-[#3e3e42] shadow-[4px_4px_10px_rgba(0,0,0,0.5)] py-1 mt-[-1px]">
             {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-7 bg-[#1e1e1e] flex items-center px-1 border-b border-black/40 select-none relative" ref={menuRef}>
      {menus.map(menu => (
        <div key={menu} className="relative h-full flex items-center">
          <div 
            onClick={() => handleMenuClick(menu)}
            className={`px-2 h-full flex items-center text-[12px] cursor-default transition-colors z-50
              ${openMenu === menu ? 'bg-[#007acc] text-white' : 'text-[#e0e0e0] hover:bg-[#3e3e42] hover:text-white'}
            `}
          >
            {menu}
          </div>
          
          {openMenu === 'File' && menu === 'File' && (
            <div className="absolute top-full left-0 z-[9999] bg-[#1e1e1e] border border-[#3e3e42] shadow-[4px_4px_10px_rgba(0,0,0,0.5)] py-1 mt-[1px]">
              <MenuItem icon={Plus} iconColor="text-[#606060]" label="Add Server" disabled />
              <MenuItem icon={X} iconColor="text-[#606060]" label="Remove Server" disabled />
              <MenuItem icon={Settings} iconColor="text-[#606060]" label="Server Properties" disabled />
              <MenuItem separator />
              <MenuItem icon={ArrowRightFromLine} iconColor="text-[#606060]" label="Connect" disabled />
              <MenuItem icon={XOctagon} iconColor="text-red-500" label="Disconnect" onClick={() => handleFileAction('Disconnect')} />
              <MenuItem icon={Lock} iconColor="text-[#3B82F6]" label="Change Password" onClick={() => handleFileAction('Change Password')} />
              <MenuItem separator />
              <MenuItem icon={Upload} iconColor="text-green-500" label="Export" onClick={handleFileExport} />
              <MenuItem icon={Download} iconColor="text-green-500" label="Import" onClick={handleFileImport} />
              <MenuItem separator />
              <MenuItem icon={FolderOpen} iconColor="text-[#E8B339]" label="Open Data Folder" shortcut="Ctrl+Shift+D" onClick={() => handleFileAction('Open Data Folder')} />
              <MenuItem separator />
              <MenuItem icon={Printer} iconColor="text-[#3B82F6]" label="Print" shortcut="Ctrl+P" onClick={() => window.print()} />
              <MenuItem icon={FileSearch} iconColor="text-[#3B82F6]" label="Print Preview" onClick={() => handleFileAction('Print Preview')} />
              <MenuItem icon={FileCog} iconColor="text-[#3B82F6]" label="Print Setup" onClick={() => handleFileAction('Print Setup')} />
              <MenuItem separator />
              <MenuItem icon={LogOut} iconColor="text-red-500" label="Exit" onClick={() => handleFileAction('Exit')} />
            </div>
          )}

          {openMenu === 'View' && menu === 'View' && (
            <div className="absolute top-full left-0 z-[9999] bg-[#1e1e1e] border border-[#3e3e42] shadow-[4px_4px_10px_rgba(0,0,0,0.5)] py-1 mt-[1px]">
              <MenuItem label="Languages" rightArrow isHoverable>
                 <MenuItem label="English" checked />
                 <MenuItem label="French" />
                 <MenuItem label="Spanish" />
              </MenuItem>
              <MenuItem label="Color Themes" rightArrow isHoverable>
                 <MenuItem label="Dark" onClick={() => onThemeSelect('dark')} />
                 <MenuItem label="Light" onClick={() => onThemeSelect('light')} />
                 <MenuItem label="System" onClick={() => onThemeSelect('system')} />
              </MenuItem>
              <MenuItem separator />
              <MenuItem icon={PanelTop} iconColor="text-[#E8B339]" label="Toolbar" checked />
              <MenuItem icon={PanelBottom} iconColor="text-[#E8B339]" label="Toolbox" shortcut="Ctrl+T" />
              <MenuItem icon={ArrowLeftRight} iconColor="text-[#3B82F6]" label="Split" />
              <MenuItem icon={RotateCcw} iconColor="text-[#3B82F6]" label="Reset to Default" />
              <MenuItem separator />
              <MenuItem icon={ArrowLeft} iconColor="text-[#3B82F6]" label="Navigate Backward" shortcut="Alt+Left" />
              <MenuItem icon={ArrowRight} iconColor="text-[#3B82F6]" label="Navigate Forward" shortcut="Alt+Right" />
            </div>
          )}

          {openMenu === 'Window' && menu === 'Window' && (
            <div className="absolute top-full left-0 z-[9999] bg-[#1e1e1e] border border-[#3e3e42] shadow-[4px_4px_10px_rgba(0,0,0,0.5)] py-1 mt-[1px]">
              <MenuItem icon={LayoutGrid} label="Tile Windows" shortcut="Alt+R" />
              <MenuItem icon={Copy} label="Cascade" />
              <MenuItem icon={AlignVerticalSpaceAround} label="Tile Horizontally" />
              <MenuItem icon={AlignHorizontalSpaceAround} label="Tile Vertically" />
              <MenuItem icon={ArrowDownToLine} label="Arrange Icons" />
              <MenuItem icon={RotateCcw} label="Reset to Default" />
              <MenuItem label="Window Layouts" rightArrow />
              <MenuItem separator />
              <MenuItem icon={BarChart2} label="Analytics" onClick={onMenuSelect} />
              <MenuItem icon={PieChart} label="Server Reports" onClick={onMenuSelect} />
              <MenuItem icon={UserCheck} iconColor="text-green-500" label="Online Users" onClick={onMenuSelect} />
              <MenuItem icon={User} label="Accounts" onClick={onMenuSelect} />
              <MenuItem icon={FileText} label="Positions" onClick={onMenuSelect} />
              <MenuItem icon={Files} label="Orders" onClick={onMenuSelect} />
              <MenuItem icon={Loader} iconColor="text-purple-500" label="Ultency Matching Engine" onClick={onMenuSelect} />
              <MenuItem icon={Activity} iconColor="text-red-500" label="Dealer" onClick={onMenuSelect} />
              <MenuItem icon={Percent} iconColor="text-emerald-500" label="Leverages" onClick={onMenuSelect} />
              <MenuItem icon={Users} label="Groups" onClick={onMenuSelect} />
              <MenuItem icon={Puzzle} label="Plugins" onClick={onMenuSelect} />
              <MenuItem icon={Mail} iconColor="text-yellow-500" label="Mailbox" onClick={onMenuSelect} />
              <MenuItem icon={BookOpen} iconColor="text-orange-500" label="Journal" onClick={onMenuSelect} />
              <MenuItem separator />
              <MenuItem checked label={`1 ${activeNode || 'Accounts'}`} />
            </div>
          )}
        </div>
      ))}
      <div className="ml-auto flex items-center pr-2 gap-4">
         <span className="text-[11px] text-[#808080]">HexyMarkets-Server - MetaTrader 5 Administrator</span>
      </div>
    </div>
  );
};

export default MenuBar;
