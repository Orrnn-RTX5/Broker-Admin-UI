import React from 'react';
import {
  ExternalLink, Plus, Pencil, X,
  IdCard, Wallet, RefreshCcw, Search, FileSpreadsheet, Download,
  Folder, ArrowUpDown, BarChart3, Server, Bug,
} from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '../ui/Menu';
import './ActionToolBar.css';

const ICON = { size: 16, strokeWidth: 1.75 };

const Tool = ({
  icon,
  label,
  onClick,
  disabled = false,
  reason,
  active = false,
  variant = 'default',
}) => {
  const Icon = icon;
  return (
    <Tooltip content={disabled ? reason || label : label}>
      <span className="mt5-tool-wrap">
        <button
          type="button"
          className={`mt5-tool mt5-tool--${variant}${active ? ' is-active' : ''}`}
          aria-label={label}
          aria-pressed={active || undefined}
          onClick={onClick}
          disabled={disabled}
        >
          <Icon {...ICON} aria-hidden="true" />
        </button>
      </span>
    </Tooltip>
  );
};

const Divider = () => <span className="mt5-toolbar-divider" aria-hidden="true" />;

const ActionToolBar = ({
  onAddClick, canAdd = false,
  onRefresh, onExport, onExportCsv,
  onEditClick, canEdit = false, onDeleteClick, canDelete = false, deleting = false,
  searchQuery = '', onSearchChange, searchInputRef,
  activeNode = 'Groups', onNodeSelect, onReportBug,
}) => {
  const isTradeView = ['Orders', 'Positions', 'Deals'].includes(activeNode);
  const showRecordActions = ['Groups', 'Clients', 'Trading Accounts'].includes(activeNode) || isTradeView;
  const showGroupActions = activeNode === 'Groups';
  const clearSearch = () => {
    onSearchChange?.('');
    searchInputRef?.current?.focus();
  };

  return (
    <div className="admin-action-toolbar mt5-action-toolbar" role="region" aria-label="Workspace actions">
      <div className="mt5-toolbar-main">
        <div className="mt5-tool-group" role="group" aria-label="Workspaces">
          <Tool icon={Folder} label="Groups" active={activeNode === 'Groups'} onClick={() => onNodeSelect?.('Groups')} />
          <Tool icon={ArrowUpDown} label="Symbols" active={activeNode === 'Symbols'} onClick={() => onNodeSelect?.('Symbols')} />
          <Tool icon={BarChart3} label="Analytics" active={activeNode === 'Analytics' || activeNode === 'Leverages'} onClick={() => onNodeSelect?.('Analytics')} />
          <Tool icon={Server} label="Server" active={activeNode.includes('Server') || activeNode === 'Server Configuration'} onClick={() => onNodeSelect?.('Server Configuration')} />
        </div>

        {showRecordActions && (
          <>
            <Divider />
            <div className="mt5-tool-group" role="group" aria-label="Records">
              {showGroupActions && <Tool
                icon={Plus}
                label="New group"
                reason="You need group management permission"
                disabled={!canAdd}
                onClick={onAddClick}
                variant="add"
              />}
              <Tool icon={Pencil} label={isTradeView ? 'View selected details' : 'Edit selected record'} reason={isTradeView ? 'Select a trade' : 'Select an editable record'} onClick={onEditClick} disabled={!canEdit} />
              {showGroupActions && <Tool
                icon={X}
                label={deleting ? 'Deleting…' : 'Delete selected group'}
                reason="Select a group you can delete"
                disabled={!canDelete || deleting}
                onClick={onDeleteClick}
                variant="danger"
              />}
            </div>
          </>
        )}

        <Divider />

        <div className="mt5-tool-group mt5-tool-group--accounts" role="group" aria-label="Accounts">
          <Tool icon={IdCard} label="Clients" active={activeNode === 'Clients'} onClick={() => onNodeSelect?.('Clients')} />
          <Tool icon={Wallet} label="Trading Accounts" active={activeNode === 'Trading Accounts'} onClick={() => onNodeSelect?.('Trading Accounts')} />
        </div>

        <Divider />

        <div className="mt5-tool-group" role="group" aria-label="View actions">
          <Tool icon={RefreshCcw} label="Refresh view" onClick={onRefresh} />
          <DropdownMenu>
            <Tooltip content="Export displayed rows">
              <DropdownMenuTrigger asChild>
                <button type="button" className="mt5-tool mt5-tool--default" aria-label="Export visible rows">
                  <ExternalLink {...ICON} aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
            </Tooltip>
            <DropdownMenuContent align="start" className="admin-header-menu-content w-56">
              <DropdownMenuItem className="admin-header-menu-item" onSelect={onExportCsv}>
                <FileSpreadsheet size={16} strokeWidth={1.75} className="admin-menu-option-icon" aria-hidden="true" />
                <span>Export visible rows as CSV</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="admin-header-menu-item" onSelect={onExport}>
                <Download size={16} strokeWidth={1.75} className="admin-menu-option-icon" aria-hidden="true" />
                <span>Export visible rows as JSON</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tool icon={Bug} label="Report a Bug to the RTX5 platform team" onClick={onReportBug} />
        </div>
      </div>

      {/* Search stays visible while the action groups scroll on narrow screens. */}
      <div className="mt5-toolbar-side" role="group" aria-label="Search current view">
        <div className="mt5-toolbar-search" role="search">
          <Search {...ICON} className="mt5-search-icon" aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="search"
            aria-label="Search current view"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                clearSearch();
              }
            }}
            spellCheck={false}
            autoComplete="off"
          />
          {searchQuery ? (
            <button
              type="button"
              className="mt5-search-clear"
              aria-label="Clear search"
              onClick={clearSearch}
            >
              <X size={12} strokeWidth={2} aria-hidden="true" />
            </button>
          ) : (
            <kbd className="mt5-search-kbd" aria-hidden="true">Ctrl+F</kbd>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActionToolBar;
