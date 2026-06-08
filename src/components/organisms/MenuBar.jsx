import {
  BarChart2, PieChart, UserCheck, User, FileText,
  Files, Loader, Activity, Percent, Users, Puzzle, Mail, BookOpen,
  ArrowLeft, ArrowRight, RefreshCcw,
  Upload, Download, Printer, LogOut, Undo2, Redo2, Palette, Power,
  Rows3, FileSpreadsheet, HelpCircle, Keyboard, Clock,
} from 'lucide-react';
import { AuthService } from '../../services/auth.service';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '../ui/Menu';

const MenuTrigger = ({ label }) => (
  <DropdownMenuTrigger asChild>
    <button
      className="px-2.5 h-full text-[12px] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface-2)] data-[state=open]:bg-[color:var(--bg-surface-2)] data-[state=open]:text-[color:var(--text-primary)] transition-colors focus:outline-none"
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
  onMenuSelect, activeNode, onThemeSelect, currentTheme,
  density, onDensityToggle,
  onUndo, onRedo, onRefresh, onExport, onExportCsv, onImport, onHelp,
  canUndo, canRedo,
}) => {
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
    <div className="h-9 bg-[color:var(--bg-surface-1)] flex items-center px-1 border-b border-[color:var(--border-subtle)] select-none">
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
          <Item icon={HelpCircle} label="About RTX 5" onClick={() => alert('RTX 5 Admin\nBuild: dev\nElectron + React + Vite')} />
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center pr-3 gap-3">
        <span className="text-[11px] text-[color:var(--text-muted)] font-mono">
          RTX 5 · {activeNode || '—'}
        </span>
      </div>
    </div>
  );
};

export default MenuBar;
