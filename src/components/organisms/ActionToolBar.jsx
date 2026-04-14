import {
  XOctagon, RefreshCcw, RotateCw, ArrowLeft, ArrowRight,
  ExternalLink, Download, Check, Plus, Pencil, Trash2,
  ArrowUpDown, Search, Play, Pause,
} from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { Tooltip } from '../ui/Tooltip';
import { Input } from '../ui/Input';

const Divider = () => (
  <div className="w-px h-5 bg-[color:var(--border-subtle)] mx-1" />
);

const Tool = ({ icon: Icon, label, onClick, disabled }) => (
  <Tooltip content={label || ''}>
    <IconButton aria-label={label || 'action'} onClick={onClick} disabled={disabled}>
      <Icon size={14} />
    </IconButton>
  </Tooltip>
);

const ActionToolBar = ({ onAddClick, onUndo, onRedo, canUndo, canRedo }) => (
  <div className="h-10 bg-[color:var(--bg-surface-1)] flex items-center px-2 gap-0.5 border-b border-[color:var(--border-subtle)] overflow-x-auto no-scrollbar">
    <Tool icon={XOctagon} label="Disconnect" />
    <Divider />
    <Tool icon={RefreshCcw} label="Refresh" />
    <Tool icon={RotateCw} label="Restart Server" />
    <Divider />
    <Tool icon={ArrowLeft} label="Back" disabled={!canUndo} onClick={onUndo} />
    <Tool icon={ArrowRight} label="Forward" disabled={!canRedo} onClick={onRedo} />
    <Divider />
    <Tool icon={ExternalLink} label="Export" />
    <Tool icon={Download} label="Import" />
    <Divider />
    <Tool icon={Check} label="Apply" />
    <Tool icon={Plus} label="Add" onClick={onAddClick} />
    <Tool icon={Pencil} label="Edit" />
    <Tool icon={Trash2} label="Delete" />
    <Tool icon={ArrowUpDown} label="Sort" />
    <Divider />
    <Tool icon={Play} label="Start" />
    <Tool icon={Pause} label="Pause" />

    <div className="ml-auto flex items-center gap-2">
      <div className="relative">
        <Search
          size={12}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] pointer-events-none"
        />
        <Input placeholder="Search…" className="w-56 pr-7 h-7 text-[12px]" />
      </div>
    </div>
  </div>
);

export default ActionToolBar;
