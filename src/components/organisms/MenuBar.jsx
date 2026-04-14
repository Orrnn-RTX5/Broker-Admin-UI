import {
  LayoutGrid, Copy, AlignVerticalSpaceAround, AlignHorizontalSpaceAround,
  ArrowDownToLine, RotateCcw, BarChart2, PieChart, UserCheck, User, FileText,
  Files, Loader, Activity, Percent, Users, Puzzle, Mail, BookOpen,
  PanelTop, PanelBottom, ArrowLeftRight, ArrowLeft, ArrowRight,
  Plus, X, Settings, ArrowRightFromLine, XOctagon, Lock,
  Upload, Download, FolderOpen, Printer, FileSearch, FileCog, LogOut,
  Globe, Palette,
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

const Item = ({ icon: Icon, label, shortcut, onClick, disabled }) => (
  <DropdownMenuItem disabled={disabled} shortcut={shortcut} onSelect={() => onClick && onClick(label)}>
    {Icon ? (
      <Icon size={12} className="text-[color:var(--text-muted)]" />
    ) : (
      <span className="w-3" />
    )}
    <span>{label}</span>
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

const MenuBar = ({ onMenuSelect, activeNode, onThemeSelect }) => {
  const handleFileExport = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify({ server: 'HexyMarkets', timestamp: new Date() }, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = 'server_export.json';
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
    switch (action) {
      case 'Disconnect': alert('Server disconnected.'); break;
      case 'Change Password': alert('Change Password flow triggered.'); break;
      case 'Open Data Folder': alert('Opening local directory:\nC:\\Users\\Administrator\\AppData\\Roaming\\MetaQuotes\\Terminal\\'); break;
      case 'Print Preview': alert('Generating print preview presentation...'); break;
      case 'Print Setup': alert('Opening local printer dialog configurations...'); break;
      case 'Logout': AuthService.logout(); break;
      case 'Exit': alert('Application exit initiated.'); window.close(); break;
      default: break;
    }
  };

  return (
    <div className="h-9 bg-[color:var(--bg-surface-1)] flex items-center px-1 border-b border-[color:var(--border-subtle)] select-none">
      <DropdownMenu>
        <MenuTrigger label="File" />
        <DropdownMenuContent align="start" sideOffset={0}>
          <Item icon={Plus} label="Add Server" disabled />
          <Item icon={X} label="Remove Server" disabled />
          <Item icon={Settings} label="Server Properties" disabled />
          <DropdownMenuSeparator />
          <Item icon={ArrowRightFromLine} label="Connect" disabled />
          <Item icon={XOctagon} label="Disconnect" onClick={() => handleFileAction('Disconnect')} />
          <Item icon={Lock} label="Change Password" onClick={() => handleFileAction('Change Password')} />
          <DropdownMenuSeparator />
          <Item icon={Upload} label="Export" onClick={handleFileExport} />
          <Item icon={Download} label="Import" onClick={handleFileImport} />
          <DropdownMenuSeparator />
          <Item icon={FolderOpen} label="Open Data Folder" shortcut="Ctrl+Shift+D" onClick={() => handleFileAction('Open Data Folder')} />
          <DropdownMenuSeparator />
          <Item icon={Printer} label="Print" shortcut="Ctrl+P" onClick={() => window.print()} />
          <Item icon={FileSearch} label="Print Preview" onClick={() => handleFileAction('Print Preview')} />
          <Item icon={FileCog} label="Print Setup" onClick={() => handleFileAction('Print Setup')} />
          <DropdownMenuSeparator />
          <Item icon={LogOut} label="Logout" onClick={() => handleFileAction('Logout')} />
          <Item icon={LogOut} label="Exit" onClick={() => handleFileAction('Exit')} />
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <MenuTrigger label="Edit" />
        <DropdownMenuContent align="start">
          <Item label="Undo" shortcut="Ctrl+Z" disabled />
          <Item label="Redo" shortcut="Ctrl+Y" disabled />
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <MenuTrigger label="View" />
        <DropdownMenuContent align="start">
          <DropdownMenuSub>
            <SubTrigger icon={Globe} label="Languages" />
            <DropdownMenuSubContent>
              <Item label="English" />
              <Item label="French" />
              <Item label="Spanish" />
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <SubTrigger icon={Palette} label="Color Themes" />
            <DropdownMenuSubContent>
              <Item label="Dark" onClick={() => onThemeSelect && onThemeSelect('dark')} />
              <Item label="Light" onClick={() => onThemeSelect && onThemeSelect('light')} />
              <Item label="System" onClick={() => onThemeSelect && onThemeSelect('system')} />
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />
          <Item icon={PanelTop} label="Toolbar" />
          <Item icon={PanelBottom} label="Toolbox" shortcut="Ctrl+T" />
          <Item icon={ArrowLeftRight} label="Split" />
          <Item icon={RotateCcw} label="Reset to Default" />
          <DropdownMenuSeparator />
          <Item icon={ArrowLeft} label="Navigate Backward" shortcut="Alt+Left" />
          <Item icon={ArrowRight} label="Navigate Forward" shortcut="Alt+Right" />
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <MenuTrigger label="Services" />
        <DropdownMenuContent align="start">
          <Item label="Services configuration" disabled />
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <MenuTrigger label="Window" />
        <DropdownMenuContent align="start">
          <Item icon={LayoutGrid} label="Tile Windows" shortcut="Alt+R" />
          <Item icon={Copy} label="Cascade" />
          <Item icon={AlignVerticalSpaceAround} label="Tile Horizontally" />
          <Item icon={AlignHorizontalSpaceAround} label="Tile Vertically" />
          <Item icon={ArrowDownToLine} label="Arrange Icons" />
          <Item icon={RotateCcw} label="Reset to Default" />
          <DropdownMenuSub>
            <SubTrigger label="Window Layouts" />
            <DropdownMenuSubContent>
              <Item label="Default" />
              <Item label="Trading" />
              <Item label="Analytics" />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <Item icon={BarChart2} label="Analytics" onClick={onMenuSelect} />
          <Item icon={PieChart} label="Server Reports" onClick={onMenuSelect} />
          <Item icon={UserCheck} label="Online Users" onClick={onMenuSelect} />
          <Item icon={User} label="Accounts" onClick={onMenuSelect} />
          <Item icon={FileText} label="Positions" onClick={onMenuSelect} />
          <Item icon={Files} label="Orders" onClick={onMenuSelect} />
          <Item icon={Loader} label="Ultency Matching Engine" onClick={onMenuSelect} />
          <Item icon={Activity} label="Dealer" onClick={onMenuSelect} />
          <Item icon={Percent} label="Leverages" onClick={onMenuSelect} />
          <Item icon={Users} label="Groups" onClick={onMenuSelect} />
          <Item icon={Puzzle} label="Plugins" onClick={onMenuSelect} />
          <Item icon={Mail} label="Mailbox" onClick={onMenuSelect} />
          <Item icon={BookOpen} label="Journal" onClick={onMenuSelect} />
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <MenuTrigger label="Help" />
        <DropdownMenuContent align="start">
          <Item label="About RTX5" />
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center pr-3 gap-3">
        <span className="text-[11px] text-[color:var(--text-muted)] font-mono">
          HexyMarkets · {activeNode || '—'}
        </span>
      </div>
    </div>
  );
};

export default MenuBar;
