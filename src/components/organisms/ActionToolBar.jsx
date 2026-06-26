import React from 'react';
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

const Tool = ({ icon, label, onClick, disabled }) => (
  <Tooltip content={disabled ? `${label} (not available)` : label || ''}>
    <IconButton aria-label={label || 'action'} onClick={onClick} disabled={disabled}>
      {React.createElement(icon, { size: 14 })}
    </IconButton>
  </Tooltip>
);

const ActionToolBar = ({
  onAddClick, onUndo, onRedo, canUndo, canRedo,
  onRefresh, onExport, onImport,
  searchQuery = '', onSearchChange, searchInputRef,
}) => (
  <div className="h-10 bg-[color:var(--bg-surface-1)] flex items-center px-2 gap-0.5 border-b border-[color:var(--border-subtle)] overflow-x-auto no-scrollbar">
    {/* No backend — disabled */}
    <Tool icon={XOctagon} label="Disconnect" disabled />
    <Divider />

    {/* Frontend-wired */}
    <Tool icon={RefreshCcw} label="Refresh" onClick={onRefresh} />
    {/* No backend — disabled */}
    <Tool icon={RotateCw} label="Restart Server" disabled />
    <Divider />

    {/* History navigation */}
    <Tool icon={ArrowLeft} label="Back" disabled={!canUndo} onClick={onUndo} />
    <Tool icon={ArrowRight} label="Forward" disabled={!canRedo} onClick={onRedo} />
    <Divider />

    {/* Frontend-wired */}
    <Tool icon={ExternalLink} label="Export" onClick={onExport} />
    <Tool icon={Download} label="Import" onClick={onImport} />
    <Divider />

    {/* No backend — disabled */}
    <Tool icon={Check} label="Apply" disabled />
    {/* Frontend-wired */}
    <Tool icon={Plus} label="Add" onClick={onAddClick} />
    {/* Need row selection context — disabled */}
    <Tool icon={Pencil} label="Edit" disabled />
    <Tool icon={Trash2} label="Delete" disabled />
    <Tool icon={ArrowUpDown} label="Sort" disabled />
    <Divider />

    {/* No backend — disabled */}
    <Tool icon={Play} label="Start" disabled />
    <Tool icon={Pause} label="Pause" disabled />

    <div className="ml-auto flex items-center gap-2">
      <div className="relative">
        <Search
          size={12}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] pointer-events-none"
        />
        <Input
          ref={searchInputRef}
          placeholder="Search current view…  (Ctrl+F)"
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="w-56 pr-7 h-7 text-[12px]"
        />
      </div>
    </div>
  </div>
);

export default ActionToolBar;
