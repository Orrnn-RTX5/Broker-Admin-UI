import React from 'react';
import { 
  XOctagon, 
  RefreshCcw, 
  RotateCw, 
  ArrowLeft, 
  ArrowRight, 
  ExternalLink, 
  Download, 
  Check, 
  Plus, 
  Pencil,
  Trash2,
  ArrowUpDown,
  Search,
  Play,
  Pause
} from 'lucide-react';

const ToolButton = ({ icon: Icon, label, disabled, color = 'text-[#d1d1d1]', onClick }) => (
  <button 
    disabled={disabled}
    onClick={onClick}
    className={`h-7 px-1.5 flex items-center gap-1.5 hover:bg-[#555555] rounded-sm transition-colors text-[11px] ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-default'} ${color}`}
  >
    <Icon size={14} className="stroke-[2.5]" />
    {label && <span className="font-medium">{label}</span>}
  </button>
);

const ActionToolBar = ({ onAddClick }) => {
  return (
    <div className="h-9 bg-[#3c3f41] flex items-center px-2 gap-0.5 border-b border-black/40 overflow-x-auto no-scrollbar shadow-inner">
      <ToolButton icon={XOctagon} label="Disconnect" color="text-red-500" />
      <div className="w-[1px] h-6 bg-black/20 mx-1.5 shadow-[1px_0_0_0_rgba(255,255,255,0.05)]" />
      
      <ToolButton icon={RefreshCcw} label="Refresh" />
      <ToolButton icon={RotateCw} label="Restart Server" />
      <div className="w-[1px] h-6 bg-black/20 mx-1.5 shadow-[1px_0_0_0_rgba(255,255,255,0.05)]" />

      <ToolButton icon={ArrowLeft} disabled />
      <ToolButton icon={ArrowRight} disabled />
      <div className="w-[1px] h-6 bg-black/20 mx-1.5 shadow-[1px_0_0_0_rgba(255,255,255,0.05)]" />

      <ToolButton icon={ExternalLink} label="Export" />
      <ToolButton icon={Download} label="Import" />
      <div className="w-[1px] h-6 bg-black/20 mx-1.5 shadow-[1px_0_0_0_rgba(255,255,255,0.05)]" />

      <ToolButton icon={Check} label="Apply" color="text-green-500" />
      <ToolButton icon={Plus} onClick={onAddClick} />
      <ToolButton icon={Pencil} />
      <ToolButton icon={Trash2} />
      <ToolButton icon={ArrowUpDown} label="Sort" />
      <div className="w-[1px] h-6 bg-black/20 mx-1.5 shadow-[1px_0_0_0_rgba(255,255,255,0.05)]" />

      <ToolButton icon={Play} color="text-green-400" />
      <ToolButton icon={Pause} color="text-yellow-400" />
      
      <div className="ml-auto flex items-center gap-2">
        <div className="relative">
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 text-[#808080]" size={12} />
          <input 
            type="text" 
            placeholder="" 
            className="bg-[#2b2b2b] border border-black/40 rounded-sm text-[11px] px-2 py-0.5 w-40 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>
    </div>
  );
};

export default ActionToolBar;
