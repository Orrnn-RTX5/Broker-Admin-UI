import {
  BarChart2, PieChart, UserCheck, User, FileText,
  Files, Loader, Activity, Percent, Users, Puzzle, Mail, BookOpen,
  ArrowLeft, ArrowRight, RefreshCcw,
  Upload, Download, Printer, LogOut, Undo2, Redo2, Palette, Power,
  Rows3, FileSpreadsheet, Info, Keyboard, Clock, Bell, Settings, ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import './MenuBar.css';
import { AuthService } from '../../services/auth.service';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '../ui/Menu';

const MenuTrigger = ({ label }) => (
  <DropdownMenuTrigger asChild>
    <button
      className="px-2.5 h-full text-[12px] font-normal text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface-2)] data-[state=open]:bg-[color:var(--bg-surface-2)] data-[state=open]:text-[color:var(--text-primary)] transition-colors focus:outline-none"
    >
      {label}
    </button>
  </DropdownMenuTrigger>
);

const Item = ({ icon: Icon, label, shortcut, onClick, disabled, active }) => (
  <DropdownMenuItem disabled={disabled} shortcut={shortcut} onSelect={() => onClick && onClick(label)}>
    {Icon ? (
      <Icon size={12} className={active ? 'text-[color:var(--accent-500)]' : 'text-[color:var(--text-muted)]'} />
    ) : (
      <span className="w-3" />
    )}
    <span className={active ? 'font-semibold' : ''}>{label}</span>
  </DropdownMenuItem>
);

const SubTrigger = ({ icon: Icon, label }) => (
  <DropdownMenuSubTrigger>
    {Icon ? (
      <Icon size={12} className="text-[color:var(--text-muted)]" />
    ) : (
      <span className="w-3" />
    )}
    <span>{label}</span>
  </DropdownMenuSubTrigger>
);

const MenuBar = ({
  onMenuSelect, onThemeSelect, currentTheme,
  density, onDensityToggle,
  onUndo, onRedo, onRefresh, onExport, onExportCsv, onImport, onHelp, onAbout,
  canUndo, canRedo,
}) => {
  const user = useAuthStore((state) => state.user);
  const adminName = String(user?.name || user?.login || 'Admin');
  const adminLogin = String(user?.login || user?.id || '');
  const initials = adminName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const handleLogout = () => AuthService.logout();

  const handleExit = () => {
    if (!window.confirm('Exit RTX 5 Admin?')) return;
    try { AuthService.logout(); } catch { /* noop */ }
    setTimeout(() => {
      try { window.close(); } catch { /* noop */ }
      window.location.reload();
    }, 150);
  };

  return (
    <div className="admin-menu-bar" role="navigation" aria-label="Admin navigation">
      <button type="button" className="admin-menu-brand" onClick={onAbout} aria-label="About RTX5 Admin">
        <img src="./admin-symbol.png" alt="" />
        <span>Admin</span>
      </button>
      {/* FILE */}
      <DropdownMenu>
        <MenuTrigger label="File" />
        <DropdownMenuContent align="start" sideOffset={0}>
          <Item icon={Upload}          label="Export JSON"  shortcut="Ctrl+E"       onClick={onExport} />
          <Item icon={FileSpreadsheet} label="Export CSV"   shortcut="Ctrl+Shift+E" onClick={onExportCsv} />
          <Item icon={Download}        label="Import"       onClick={onImport} />
          <DropdownMenuSeparator />
          <Item icon={Printer} label="Print" shortcut="Ctrl+P" onClick={() => window.print()} />
          <DropdownMenuSeparator />
          <Item icon={LogOut}  label="Logout" onClick={handleLogout} />
          <DropdownMenuSeparator />
          <Item icon={Power}   label="Exit"   shortcut="Alt+F4" onClick={handleExit} />
        </DropdownMenuContent>
      </DropdownMenu>

      {/* EDIT */}
      <DropdownMenu>
        <MenuTrigger label="Edit" />
        <DropdownMenuContent align="start">
          <Item icon={Undo2}      label="Undo"    shortcut="Alt+Left"  onClick={onUndo} disabled={!canUndo} />
          <Item icon={Redo2}      label="Redo"    shortcut="Alt+Right" onClick={onRedo} disabled={!canRedo} />
          <DropdownMenuSeparator />
          <Item icon={RefreshCcw} label="Refresh" shortcut="Ctrl+R"    onClick={onRefresh} />
        </DropdownMenuContent>
      </DropdownMenu>

      {/* VIEW */}
      <DropdownMenu>
        <MenuTrigger label="View" />
        <DropdownMenuContent align="start">
          <DropdownMenuSub>
            <SubTrigger icon={Palette} label="Color Themes" />
            <DropdownMenuSubContent>
              <Item label="Dark"       active={currentTheme === 'dark'}      onClick={() => onThemeSelect && onThemeSelect('dark')} />
              <Item label="Light"      active={currentTheme === 'light'}     onClick={() => onThemeSelect && onThemeSelect('light')} />
              <Item label="System"     active={currentTheme === 'system'}    onClick={() => onThemeSelect && onThemeSelect('system')} />
              <Item icon={Clock} label="Auto by time (06–18 light)" active={currentTheme === 'auto-time'} onClick={() => onThemeSelect && onThemeSelect('auto-time')} />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <SubTrigger icon={Rows3} label="Density" />
            <DropdownMenuSubContent>
              <Item label="Compact" active={density === 'compact'} onClick={() => density !== 'compact' && onDensityToggle?.()} />
              <Item label="Cozy"    active={density === 'cozy'}    onClick={() => density !== 'cozy'    && onDensityToggle?.()} />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <Item icon={ArrowLeft}  label="Navigate Backward" shortcut="Alt+Left"  onClick={onUndo} disabled={!canUndo} />
          <Item icon={ArrowRight} label="Navigate Forward"  shortcut="Alt+Right" onClick={onRedo} disabled={!canRedo} />
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <MenuTrigger label="Tools" />
        <DropdownMenuContent align="start">
          <Item icon={Users} label="Managers" onClick={onMenuSelect} />
          <Item icon={Puzzle} label="Plugins" onClick={onMenuSelect} />
          <Item icon={BookOpen} label="Journal" onClick={onMenuSelect} />
          <DropdownMenuSeparator />
          <Item icon={ShieldCheck} label="Platform Super Admin" onClick={() => onMenuSelect?.('SuperAdmin')} />
        </DropdownMenuContent>
      </DropdownMenu>


      {/* WINDOW */}
      <DropdownMenu>
        <MenuTrigger label="Window" />
        <DropdownMenuContent align="start">
          <Item icon={BarChart2} label="Analytics"               onClick={onMenuSelect} />
          <Item icon={PieChart}  label="Server Reports"          onClick={onMenuSelect} />
          <Item icon={UserCheck} label="Online Users"            onClick={onMenuSelect} />
          <Item icon={User}      label="Accounts"                onClick={onMenuSelect} />
          <Item icon={FileText}  label="Positions"               onClick={onMenuSelect} />
          <Item icon={Files}     label="Orders"                  onClick={onMenuSelect} />
          <Item icon={Loader}    label="Ultency Matching Engine" onClick={onMenuSelect} />
          <Item icon={Activity}  label="Dealer"                  onClick={onMenuSelect} />
          <Item icon={Percent}   label="Leverages"               onClick={onMenuSelect} />
          <Item icon={Users}     label="Groups"                  onClick={onMenuSelect} />
          <Item icon={Puzzle}    label="Plugins"                 onClick={onMenuSelect} />
          <Item icon={Mail}      label="Mailbox"                 onClick={onMenuSelect} />
          <Item icon={BookOpen}  label="Journal"                 onClick={onMenuSelect} />
        </DropdownMenuContent>
      </DropdownMenu>

      {/* HELP */}
      <DropdownMenu>
        <MenuTrigger label="Help" />
        <DropdownMenuContent align="start">
          <Item icon={Keyboard}   label="Keyboard shortcuts" shortcut="?" onClick={onHelp} />
          <Item icon={Info} label="About RTX 5" onClick={onAbout} />
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="admin-menu-actions">
        <button
          type="button"
          onClick={() => onMenuSelect?.('SuperAdmin')}
          className="admin-menu-super-admin px-2 py-1 rounded border text-xs font-semibold flex items-center gap-1.5 transition-colors mr-1"
          title="Open RTX5 Super Admin Control Plane"
        >
          <ShieldCheck size={14} />
          <span className="hidden md:inline">Super Admin</span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="admin-menu-icon" aria-label="Notifications" title="Notifications"><Bell size={14} /></button>

          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="px-3 py-2 text-xs font-semibold">Notifications</div>
            <div className="px-3 pb-3 text-xs text-[color:var(--text-muted)]">Check Mailbox and Journal for broker updates.</div>
            <Item icon={Mail} label="Mailbox" onClick={onMenuSelect} />
            <Item icon={BookOpen} label="Journal" onClick={onMenuSelect} />
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="admin-menu-icon" aria-label="Quick settings" title="Quick settings"><Settings size={14} /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <Item icon={Palette} label="Dark theme" active={currentTheme === 'dark'} onClick={() => onThemeSelect?.('dark')} />
            <Item icon={Palette} label="Light theme" active={currentTheme === 'light'} onClick={() => onThemeSelect?.('light')} />
            <Item icon={Palette} label="System theme" active={currentTheme === 'system'} onClick={() => onThemeSelect?.('system')} />
            <DropdownMenuSeparator />
            <Item icon={Rows3} label={density === 'compact' ? 'Use cozy spacing' : 'Use compact spacing'} onClick={onDensityToggle} />
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="admin-profile-avatar" aria-label={`Signed in as ${adminName}`} title={`${adminName}${adminLogin ? ' ? ' + adminLogin : ''}`}>
              {initials || 'A'}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <div className="px-3 py-3">
              <div className="text-[10px] uppercase tracking-wider text-[color:var(--text-muted)]">Signed-in admin</div>
              <div className="mt-1 break-words text-sm font-semibold">{adminName}</div>
              {adminLogin && <div className="mt-1 text-xs text-[color:var(--text-muted)]">Login: {adminLogin}</div>}
              {user?.broker_id && <div className="mt-1 text-xs text-[color:var(--text-muted)]">Broker: {user.broker_id}</div>}
            </div>
            <DropdownMenuSeparator />
            <Item icon={LogOut} label="Logout" onClick={handleLogout} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default MenuBar;
