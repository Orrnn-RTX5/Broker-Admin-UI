import React from 'react';
import {
  BarChart2, UserCheck, Briefcase, FileText, Folder, HelpCircle,
  Files, BookOpen, Maximize2,
  ArrowLeft, ArrowRight, RefreshCcw,
  Download, FileCheck, Printer, LogOut, Palette, Power,
  Rows3, FileSpreadsheet, Info, Clock, Settings,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import './MenuBar.css';
import { AuthService } from '../../services/auth.service';
import { getBrokerBranding } from '../../utils/branding';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '../ui/Menu';

const MenuTrigger = ({ label }) => (
  <DropdownMenuTrigger asChild>
    <button type="button" className="admin-menu-trigger">
      {label}
    </button>
  </DropdownMenuTrigger>
);

const Item = ({ icon: Icon, label, shortcut, onClick, disabled, active }) => (
  <DropdownMenuItem className="admin-header-menu-item" disabled={disabled} shortcut={shortcut} onSelect={() => onClick && onClick(label)}>
    {Icon ? (
      <Icon size={16} strokeWidth={1.75} className="admin-menu-option-icon" />
    ) : (
      <span className="admin-menu-option-icon" />
    )}
    <span className={active ? 'is-active' : undefined}>{label}</span>
  </DropdownMenuItem>
);

const SubTrigger = ({ icon: Icon, label }) => (
  <DropdownMenuSubTrigger className="admin-header-menu-item">
    {Icon ? (
      <Icon size={16} strokeWidth={1.75} className="admin-menu-option-icon" />
    ) : (
      <span className="admin-menu-option-icon" />
    )}
    <span>{label}</span>
  </DropdownMenuSubTrigger>
);

const MenuBar = ({
  onMenuSelect, onThemeSelect, currentTheme,
  density, onDensityToggle, onResetLayout,
  onUndo, onRedo, onRefresh, onExport, onExportCsv, onImport, onHelp, onAbout,
  canUndo, canRedo, autoRefresh = false, onStartAutomation, onPauseAutomation, children,
}) => {
  const user = useAuthStore((state) => state.user);
  const [logoFailed, setLogoFailed] = React.useState(false);
  const { productName, logoUrl } = getBrokerBranding();
  const fallbackSymbol = `${import.meta.env.BASE_URL || '/'}admin-symbol.png`;
  const adminName = String(user?.name || user?.login || 'Admin');
  const adminLogin = String(user?.login || user?.id || '');
  const initials = adminName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const isDesktop = Boolean(window.rtx5Electron);
  const handleLogout = () => AuthService.logout();

  const handleExit = () => {
    if (!window.confirm(`Exit ${productName}?`)) return;
    try { AuthService.logout(); } catch { /* noop */ }
    setTimeout(() => {
      try { window.close(); } catch { /* noop */ }
      window.location.reload();
    }, 150);
  };

  return (
    <header className="admin-unified-header">
      <nav className="admin-menu-bar" aria-label="Admin navigation">
      <button type="button" className="admin-menu-brand" onClick={onAbout} aria-label={`About ${productName}`}>
        <img
          src={!logoFailed ? fallbackSymbol : (logoUrl || fallbackSymbol)}
          alt=""
          onError={() => setLogoFailed(true)}
        />
        <span>Admin</span>
      </button>
      {/* FILE */}
      <DropdownMenu>
        <MenuTrigger label="File" />
        <DropdownMenuContent align="start" sideOffset={0} className="admin-header-menu-content">
          <Item icon={Download}        label="Export JSON"  shortcut="Ctrl+E"       onClick={onExport} />
          <Item icon={FileSpreadsheet} label="Export CSV"   shortcut="Ctrl+Shift+E" onClick={onExportCsv} />
          <Item icon={FileCheck}       label="Validate file (no import)" onClick={onImport} />
          <DropdownMenuSeparator />
          <Item icon={Printer} label="Print" shortcut="Ctrl+P" onClick={() => window.print()} />
          <DropdownMenuSeparator />
          <Item icon={LogOut}  label="Logout" onClick={handleLogout} />
          {isDesktop && <>
            <DropdownMenuSeparator />
            <Item icon={Power} label="Exit" shortcut="Alt+F4" onClick={handleExit} />
          </>}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* VIEW */}
      <DropdownMenu>
        <MenuTrigger label="View" />
        <DropdownMenuContent align="start" className="admin-header-menu-content">
          <Item icon={ArrowLeft} label="Back" shortcut="Alt+Left" onClick={onUndo} disabled={!canUndo} />
          <Item icon={ArrowRight} label="Forward" shortcut="Alt+Right" onClick={onRedo} disabled={!canRedo} />
          <Item icon={RefreshCcw} label="Refresh view" shortcut="Ctrl+R" onClick={onRefresh} />
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <SubTrigger icon={Palette} label="Color theme" />
            <DropdownMenuSubContent className="admin-header-menu-content">
              <Item label="Dark"       active={currentTheme === 'dark'}      onClick={() => onThemeSelect && onThemeSelect('dark')} />
              <Item label="Light"      active={currentTheme === 'light'}     onClick={() => onThemeSelect && onThemeSelect('light')} />
              <Item label="System"     active={currentTheme === 'system'}    onClick={() => onThemeSelect && onThemeSelect('system')} />
              <Item icon={Clock} label="Automatic (daylight hours)" active={currentTheme === 'auto-time'} onClick={() => onThemeSelect && onThemeSelect('auto-time')} />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <SubTrigger icon={Rows3} label="Density" />
            <DropdownMenuSubContent className="admin-header-menu-content">
              <Item label="Compact" active={density === 'compact'} onClick={() => density !== 'compact' && onDensityToggle?.()} />
              <Item label="Cozy"    active={density === 'cozy'}    onClick={() => density !== 'cozy'    && onDensityToggle?.()} />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <Item icon={Rows3} label="Reset layout" onClick={onResetLayout} />
          <Item icon={Maximize2} label="Fullscreen" onClick={() => {
            if (document.fullscreenElement) document.exitFullscreen?.();
            else document.documentElement.requestFullscreen?.();
          }} />
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <MenuTrigger label="Tools" />
        <DropdownMenuContent align="start" className="admin-header-menu-content">
          <Item
            icon={RefreshCcw}
            label={autoRefresh ? 'Pause auto-refresh' : 'Start auto-refresh'}
            active={autoRefresh}
            onClick={() => { if (autoRefresh) onPauseAutomation?.(); else onStartAutomation?.(); }}
          />
        </DropdownMenuContent>
      </DropdownMenu>


      {/* WINDOW */}
      <DropdownMenu>
        <MenuTrigger label="Window" />
        <DropdownMenuContent align="start" className="admin-header-menu-content">
          <Item icon={BarChart2} label="Dashboard" onClick={onMenuSelect} />
          <Item icon={Folder} label="Groups" onClick={onMenuSelect} />
          <Item icon={Briefcase} label="Managers" onClick={onMenuSelect} />
          <Item icon={UserCheck} label="Online Users" onClick={onMenuSelect} />
          <Item icon={FileText} label="Positions" onClick={onMenuSelect} />
          <Item icon={Files} label="Orders" onClick={onMenuSelect} />
          <DropdownMenuSeparator />
          <Item icon={BarChart2} label="Analytics" onClick={onMenuSelect} />
          <Item icon={BookOpen} label="Journal" onClick={onMenuSelect} />
        </DropdownMenuContent>
      </DropdownMenu>

      {/* HELP */}
      <DropdownMenu>
        <MenuTrigger label="Help" />
        <DropdownMenuContent align="start" className="admin-header-menu-content">
          <Item icon={HelpCircle} label="Keyboard shortcuts" shortcut="?" onClick={onHelp} />
          <Item icon={Info} label={`About ${productName}`} onClick={onAbout} />
        </DropdownMenuContent>
      </DropdownMenu>
      </nav>

      {children}

      <div className="admin-menu-actions">
        <ViewSessionActions
          onMenuSelect={onMenuSelect}
          onThemeSelect={onThemeSelect}
          currentTheme={currentTheme}
          density={density}
          onDensityToggle={onDensityToggle}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="admin-profile-avatar" aria-label="Account menu" title={adminName}>
              {initials || 'A'}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="admin-header-menu-content admin-account-menu">
            <div className="admin-account-summary">
              <span>Signed in as</span>
              <strong>{adminName}</strong>
              {adminLogin && <span>Login: {adminLogin}</span>}
            </div>
            <DropdownMenuSeparator />
            <Item icon={LogOut} label="Logout" onClick={handleLogout} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

const ViewSessionActions = ({ onMenuSelect, onThemeSelect, currentTheme, density, onDensityToggle }) => (
  <div className="view-session-actions" role="group" aria-label="View actions">
    <button type="button" className="admin-menu-icon" aria-label="Open Journal" title="Journal" onClick={() => onMenuSelect?.('Journal')}><BookOpen size={16} strokeWidth={1.75} /></button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="admin-menu-icon" aria-label="Theme and spacing" title="Theme and spacing"><Settings size={16} strokeWidth={1.75} /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="admin-header-menu-content">
        <Item icon={Palette} label="Dark theme" active={currentTheme === 'dark'} onClick={() => onThemeSelect?.('dark')} />
        <Item icon={Palette} label="Light theme" active={currentTheme === 'light'} onClick={() => onThemeSelect?.('light')} />
        <Item icon={Palette} label="System theme" active={currentTheme === 'system'} onClick={() => onThemeSelect?.('system')} />
        <DropdownMenuSeparator />
        <Item icon={Rows3} label={density === 'compact' ? 'Use cozy spacing' : 'Use compact spacing'} onClick={onDensityToggle} />
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

export default MenuBar;
