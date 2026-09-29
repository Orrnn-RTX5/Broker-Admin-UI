import React from 'react';
import {
  RefreshCcw, ExternalLink, Plus, Pencil, X,
  Settings, ZoomIn, ZoomOut, Users, UserCheck, BookOpen, Mail,
  Bell, Building2, SlidersHorizontal, Power, ChevronDown,
  Maximize2, Printer, Sparkles, Rows3, Search, Filter, Plug,
  Folder, ArrowUpDown, BarChart3, Server, Copy, LayoutGrid,
  Newspaper, ClipboardCopy, HelpCircle,
} from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '../ui/Menu';
import './ActionToolBar.css';

const ICON = { size: 16, strokeWidth: 1.75 };
const CHIP_ICON = { size: 14, strokeWidth: 1.75 };

const Tool = ({
  icon,
  label,
  onClick,
  disabled = false,
  reason,
  active = false,
  variant = 'default',
  badge = null,
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
          {badge && <span className="mt5-tool-badge">{badge}</span>}
        </button>
      </span>
    </Tooltip>
  );
};

const Divider = () => <span className="mt5-toolbar-divider" aria-hidden="true" />;

const ActionToolBar = ({
  onDisconnect, onAddClick, canAdd = false,
  onRefresh, onSync, onExport, onExportCsv, onImport, canImport = false,
  onEditClick, canEdit = false, onDeleteClick, canDelete = false, deleting = false,
  onNativePending, canViewNativePending = false,
  onSort, canSort = false, sortDirection = '', autoRefresh = false, onStart, onPause,
  searchQuery = '', onSearchChange, searchInputRef,
  activeNode = 'Groups', onNodeSelect, density = 'compact', onDensityToggle, onHelp, connStatus = 'connected',
}) => {
  const clearSearch = () => {
    onSearchChange?.('');
    searchInputRef?.current?.focus();
  };

  const connError = connStatus === 'error';

  return (
    <div className="admin-action-toolbar mt5-action-toolbar" role="region" aria-label="Workspace actions">
      <div className="mt5-toolbar-main">
        {/* Section 1: Core Navigation & Workspace Modules */}
        <div className="mt5-tool-group" role="group" aria-label="Core Navigation">
          <Tool icon={Folder} label="Navigator / Groups (Ctrl+N)" active={activeNode === 'Groups'} onClick={() => onNodeSelect?.('Groups')} />
          <Tool icon={ArrowUpDown} label="Market Watch / Symbols (Ctrl+M)" active={activeNode === 'Symbols'} onClick={() => onNodeSelect?.('Symbols')} />
          <Tool icon={BarChart3} label="Analytics & Margins" active={activeNode === 'Analytics' || activeNode === 'Leverages'} onClick={() => onNodeSelect?.('Analytics')} />
          <Tool icon={Server} label="Trade Server Status / Toolbox (Ctrl+T)" active={activeNode.includes('Server') || activeNode === 'Server Configuration'} onClick={() => onNodeSelect?.('Server Configuration')} />
        </div>

        <Divider />

        {/* Section 2: Window View & Layout */}
        <div className="mt5-tool-group" role="group" aria-label="Window Views">
          <Tool icon={Maximize2} label="Fullscreen / Popout View (F11)" onClick={() => {
            if (document.fullscreenElement) {
              document.exitFullscreen?.();
            } else {
              document.documentElement.requestFullscreen?.();
            }
          }} />
          <Tool icon={Copy} label="Cascade Windows (Alt+R)" onClick={() => onNodeSelect?.('Groups')} />
          <Tool icon={Sparkles} label="Strategy Tester & Automations" onClick={() => onNodeSelect?.('Automations')} active={activeNode === 'Automations'} />
        </div>

        <Divider />

        {/* Section 3: Print & Export */}
        <div className="mt5-tool-group" role="group" aria-label="Print & Export">
          <Tool icon={Printer} label="Print Active View (Ctrl+P)" onClick={() => window.print()} />
          <DropdownMenu>
            <Tooltip content="Export displayed rows">
              <DropdownMenuTrigger asChild>
                <button type="button" className="mt5-tool mt5-tool--default" aria-label="Export visible rows">
                  <ExternalLink {...ICON} aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
            </Tooltip>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onSelect={onExportCsv}>
                <span className="text-[color:var(--success-500)] font-semibold">CSV:</span> Export Table
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onExport}>
                <span className="text-[color:var(--info-500)] font-semibold">JSON:</span> Export Table
              </DropdownMenuItem>
              {canImport && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onImport}>
                    Import Group Config
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Divider />

        {/* Section 4: Record Management (CRUD) */}
        <div className="mt5-tool-group" role="group" aria-label="Record Management">
          <Tool
            icon={Plus}
            label="New Record / Add Group (F9)"
            reason="Select a manageable view to create a record"
            disabled={!canAdd}
            onClick={onAddClick}
            variant="add"
          />
          <Tool icon={Pencil} label="Edit" onClick={onEditClick} disabled={!canEdit} />
          <Tool icon={BookOpen} label="Native pending orders" reason="Select an account you can view" onClick={onNativePending} disabled={!canViewNativePending} />
          <Tool
            icon={Settings}
            label="Server Options & Properties (Ctrl+O)"
            onClick={() => onNodeSelect?.('Server Configuration')}
            active={activeNode === 'Server Configuration'}
          />
          <Tool
            icon={X}
            label={deleting ? 'Deleting...' : 'Delete selected record (Delete)'}
            reason="Select a deletable record with proper permissions"
            disabled={!canDelete || deleting}
            onClick={onDeleteClick}
            variant="danger"
          />
        </div>

        <Divider />

        {/* Section 5: Zoom & Integrations */}
        <div className="mt5-tool-group" role="group" aria-label="Zoom and Integrations">
          <Tool
            icon={ZoomIn}
            label="Zoom In — Cozy Row Spacing"
            reason="Already at cozy spacing"
            disabled={density === 'cozy'}
            onClick={onDensityToggle}
          />
          <Tool
            icon={ZoomOut}
            label="Zoom Out — Compact Row Spacing"
            reason="Already at compact spacing"
            disabled={density === 'compact'}
            onClick={onDensityToggle}
          />
          <Tool
            icon={RefreshCcw}
            label="Integrations"
            onClick={() => onNodeSelect?.('Integrations')}
            active={activeNode === 'Integrations'}
          />
        </div>

        <Divider />

        {/* Section 6: Administration & Accounts */}
        <div className="mt5-tool-group" role="group" aria-label="Administration">
          <Tool icon={Users} label="Managers Management" onClick={() => onNodeSelect?.('Managers')} active={activeNode === 'Managers'} />
          <Tool icon={UserCheck} label="Trading Accounts & Clients" onClick={() => onNodeSelect?.('Trading Accounts')} active={activeNode === 'Trading Accounts' || activeNode === 'Clients'} />
          <Tool icon={BookOpen} label="Server Journal & Audit Logs" onClick={() => onNodeSelect?.('Journal')} active={activeNode === 'Journal'} />
        </div>

        <Divider />

        {/* Section 7: Communication & Infrastructure */}
        <div className="mt5-tool-group" role="group" aria-label="Communication">
          <Tool icon={Mail} label="Internal Mailbox" onClick={() => onNodeSelect?.('Mailbox')} active={activeNode === 'Mailbox'} />
          <Tool icon={Bell} label="System Alerts & Notifications" onClick={() => onRefresh?.()} />
          <Tool icon={Newspaper} label="Economic Calendar & News" onClick={() => onNodeSelect?.('News')} active={activeNode === 'News'} />
          <Tool icon={Building2} label="Liquidity Providers & Gateways" onClick={() => onNodeSelect?.('Gateways')} active={activeNode === 'Gateways'} />
        </div>

        <Divider />

        {/* Section 8: Window Tile & Grid Layout */}
        <div className="mt5-tool-group" role="group" aria-label="Window Layout">
          <Tool icon={LayoutGrid} label="Tile Windows" onClick={() => onNodeSelect?.('Groups')} />
          <Tool icon={Rows3} label="Toggle Row Density" onClick={onDensityToggle} />
        </div>

        <Divider />

        {/* Section 9: Connection & Automation */}
        <div className="mt5-tool-group" role="group" aria-label="Connection and Automation">
          <DropdownMenu>
            <Tooltip content={connError ? 'Connection issue — click for options' : 'Connected to RTX5 Trade Server — click to manage'}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`mt5-chip${connError ? ' is-error' : ' is-connected'}`}
                  aria-label="Server connection status"
                >
                  <Plug {...CHIP_ICON} className="mt5-chip-icon" aria-hidden="true" />
                  <span className="mt5-chip-text">Connect</span>
                  <ChevronDown size={12} strokeWidth={2} className="mt5-chip-caret" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-3 py-2 text-xs font-semibold text-[color:var(--text-primary)]">
                Server Connection
              </div>
              <DropdownMenuItem onSelect={onSync}>
                <RefreshCcw size={13} /> Reconnect Feed & Sync
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onDisconnect} className="text-[color:var(--danger-500)]">
                <Power size={13} /> Disconnect & Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip content={autoRefresh ? 'Automation: live 15s polling — click to pause' : 'Automation: paused — click to start 15s live polling'}>
            <button
              type="button"
              className={`mt5-chip${autoRefresh ? ' is-active' : ''}`}
              onClick={autoRefresh ? onPause : onStart}
              aria-pressed={autoRefresh}
              aria-label="Toggle automation"
            >
              <Settings {...CHIP_ICON} className={`mt5-chip-icon${autoRefresh ? ' mt5-chip-icon--spin' : ''}`} aria-hidden="true" />
              <span className="mt5-chip-text">Automation</span>
              {autoRefresh && <span className="mt5-live-dot" aria-hidden="true" />}
            </button>
          </Tooltip>

          <Tool icon={ClipboardCopy} label="Duplicate Selected Configuration" onClick={onExport} />
          <Tool icon={HelpCircle} label="Help Topics & User Guide (F1)" onClick={onHelp} />
        </div>
      </div>

      <Divider />

      {/* Pinned right: Filter, Sort & Search */}
      <div className="mt5-toolbar-side" role="group" aria-label="Search and Filters">
        <DropdownMenu>
          <Tooltip content="Quick view filters">
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`mt5-chip mt5-chip--filter${searchQuery ? ' is-active' : ''}`}
                aria-label="Filter rows"
              >
                <Filter {...CHIP_ICON} className="mt5-chip-icon" aria-hidden="true" />
                <span className="mt5-chip-text">Filter</span>
                {searchQuery && <span className="mt5-filter-indicator" aria-hidden="true" />}
                <ChevronDown size={12} strokeWidth={2} className="mt5-chip-caret" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => onSearchChange?.('')}>Show All Records</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSearchChange?.('Demo')}>Filter: Demo</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSearchChange?.('Real')}>Filter: Real</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onSearchChange?.('USD')}>Filter: USD</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onRefresh}>Re-apply Active Filter</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip content={sortDirection ? `Sort: ${sortDirection.toUpperCase()} — click to toggle` : 'Sort table columns (ascending / descending)'}>
          <span className="mt5-tool-wrap">
            <button
              type="button"
              className={`mt5-tool mt5-tool--default${sortDirection ? ' is-active' : ''}`}
              onClick={onSort}
              disabled={!canSort && !sortDirection}
              aria-label="Sort columns"
            >
              <SlidersHorizontal {...ICON} aria-hidden="true" />
              {sortDirection && <span className="mt5-sort-badge" aria-hidden="true">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
            </button>
          </span>
        </Tooltip>

        <div className="mt5-toolbar-search" role="search">
          <Search size={14} strokeWidth={1.75} className="mt5-search-icon" aria-hidden="true" />
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
