import React from 'react';
import MenuBar from './components/organisms/MenuBar';
import ActionToolBar from './components/organisms/ActionToolBar';
import SidebarNavTree from './components/organisms/SidebarNavTree';
import AdminDataTable from './components/organisms/AdminDataTable';
import GroupPropertiesPopup from './components/RIGHTCLICKJPOPUPS/GroupPropertiesPopup';
import ManagerPropertiesPopup from './components/RIGHTCLICKJPOPUPS/ManagerPropertiesPopup';
import ServerPropertiesPopup from './components/RIGHTCLICKJPOPUPS/ServerPropertiesPopup';
import CreateGroupPopup from './components/RIGHTCLICKJPOPUPS/CreateGroupPopup';
import AccountEditPopup from './components/RIGHTCLICKJPOPUPS/AccountEditPopup';
import TradeDetailsPopup from './components/RIGHTCLICKJPOPUPS/TradeDetailsPopup';
import { TabBar } from './components/organisms/TabBar';
import { HelpModal } from './components/organisms/HelpModal';
import { AboutModal } from './components/organisms/AboutModal';
import {
  expireAuthSession,
  isAuthStorageEvent,
  normalizeTokenExpiresAt,
  SESSION_EXPIRED_EVENT,
  useAuthStore,
  validateAuthSession,
} from './store/authStore';
import { useConnectionStore } from './store/connectionStore';
import useSymbolStore from './store/useSymbolStore';
import { useLocalStorage } from './lib/useLocalStorage';
import { useKbStatus } from './lib/useKbStatus';
import { canAccessView, hasPermission, PERMISSION_KEYS, requiredPermissionForView } from './utils/permissions';
import { AuthService } from './services/auth.service';
import {
  DESKTOP_RELEASES_PAGE_URL,
  getLatestDesktopInstaller,
} from './config/desktopRelease';
import { getViewCapabilityToast, shouldBlockViewNavigation } from './config/viewCapabilities';
import { Download, Network, RefreshCcw, ShieldAlert } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { TooltipProvider } from './components/ui/Tooltip';
import { ToastProvider, ToastViewport } from './components/ui/Toast';
import { useToast } from './components/ui/useToast';
import { StatusDot } from './components/ui/Badge';

const formatTime = (d) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

const AccessDeniedPanel = ({ viewName, permission }) => (
  <div className="flex-1 flex items-center justify-center bg-[color:var(--bg-app)] select-none">
    <div className="flex flex-col items-center gap-3 max-w-md text-center px-6">
      <ShieldAlert size={40} className="text-[color:var(--text-muted)]" aria-hidden="true" />
      <div className="text-[14px] font-medium text-[color:var(--text-primary)]">{viewName}</div>
      <p className="text-[12px] text-[color:var(--text-muted)]">
        You do not have permission to view this section.
        {permission ? (
          <>
            {' '}Requires the{' '}
            <span className="font-mono text-[color:var(--text-secondary)]">{permission}</span>{' '}
            permission.
          </>
        ) : null}
      </p>
    </div>
  </div>
);

const SYMBOL_FEED_VIEWS = new Set(['Market Overview']);
const ACCOUNT_EDIT_VIEW_TYPES = new Set(['Clients', 'Trading Accounts']);
const TRADE_DETAIL_VIEW_TYPES = new Set(['Orders', 'Positions', 'Deals']);
const NAVIGABLE_ROW_VIEWS = new Set(['Payments', 'Clients & Accounts', 'Orders & Deals']);
const getInitialServerTabForLabel = (label) => (
  label === 'MainTrade Backup Server' ||
  label === 'Local Main Status Server' ||
  label === 'Local Main Backup Server'
    ? 'Status'
    : null
);

const AuthenticatedAppInner = ({ navigate }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const currentUser = useAuthStore((state) => state.user);
  const tokenExpiresAt = useAuthStore((state) => state.tokenExpiresAt);
  const setUser = useAuthStore((state) => state.setUser);
  const connStatus = useConnectionStore((s) => s.status);
  const connError = useConnectionStore((s) => s.lastError);
  const { notify } = useToast();
  const kb = useKbStatus();

  const [selectedGroup, setSelectedGroup] = React.useState(null);
  const [isPopupOpen, setIsPopupOpen] = React.useState(false);
  const [selectedEditTarget, setSelectedEditTarget] = React.useState(null);
  const [editingAccount, setEditingAccount] = React.useState(null);
  const [viewingTrade, setViewingTrade] = React.useState(null);
  const [serverPopupData, setServerPopupData] = React.useState(null);
  const [isCreatingGroup, setIsCreatingGroup] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [now, setNow] = React.useState(() => new Date());
  const [rowCount, setRowCount] = React.useState({ total: 0, filtered: 0, visible: 0, bytes: 0 });
  const [desktopReleaseState, setDesktopReleaseState] = React.useState({
    status: 'idle',
    installer: null,
    error: null,
  });

  const [globalTheme, setGlobalTheme] = useLocalStorage('rtx5.theme', 'light');
  const [density, setDensity] = useLocalStorage('rtx5.density', 'compact');
  const [savedSearches, setSavedSearches] = useLocalStorage('rtx5.searches', {});
  const [openTabs, setOpenTabs] = useLocalStorage('rtx5.tabs', ['Groups']);
  const [activeTab, setActiveTab] = useLocalStorage('rtx5.activeTab', 'Groups');
  const [serverTargetTab, setServerTargetTab] = React.useState(() => getInitialServerTabForLabel(activeTab));

  const [history, setHistory] = React.useState([activeTab || 'Groups']);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const activeNode = activeTab || history[currentIndex];
  const canCheckForUpdates =
    typeof window !== 'undefined' &&
    typeof window.rtx5Electron?.checkForUpdates === 'function';
  const canDownloadDesktopApp = !canCheckForUpdates;

  const searchQuery = savedSearches[activeNode] || '';
  const setSearchQuery = (q) =>
    setSavedSearches((prev) => ({ ...prev, [activeNode]: q }));

  const searchInputRef = React.useRef(null);
  React.useEffect(() => {
    if (!isAuthenticated || !accessToken) return undefined;

    let cancelled = false;
    AuthService.getMe().catch(() => {
      if (!cancelled && currentUser) {
        setUser({ ...currentUser, permissions: null });
      }
    });

    return () => {
      cancelled = true;
    };
    // Hydrate when the access token changes. currentUser is intentionally not
    // a dependency; getMe updates it and would otherwise loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, accessToken, setUser]);

  React.useEffect(() => {
    const handleSessionExpired = (event) => {
      navigate(event.detail?.loginPath || '/', { replace: true });
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [navigate]);

  React.useEffect(() => {
    if (!isAuthenticated) return undefined;

    const checkAuthSession = () => {
      validateAuthSession('auth_storage_invalid');
    };

    const handleStorage = (event) => {
      if (isAuthStorageEvent(event)) checkAuthSession();
    };
    const handleFocus = () => checkAuthSession();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkAuthSession();
    };

    checkAuthSession();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const intervalId = window.setInterval(checkAuthSession, 2_000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated]);

  React.useEffect(() => {
    if (!isAuthenticated || !tokenExpiresAt) return undefined;

    const expiryMs = normalizeTokenExpiresAt(tokenExpiresAt);
    if (!expiryMs) return undefined;

    const delay = expiryMs - Date.now();
    if (delay <= 0) {
      expireAuthSession('token_expired');
      return undefined;
    }

    const timeoutId = window.setTimeout(
      () => expireAuthSession('token_expired'),
      Math.min(delay, 2147483647)
    );

    return () => window.clearTimeout(timeoutId);
  }, [isAuthenticated, tokenExpiresAt]);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      let resolved = globalTheme;
      if (globalTheme === 'system') resolved = mediaQuery.matches ? 'dark' : 'light';
      else if (globalTheme === 'auto-time') {
        const h = new Date().getHours();
        resolved = (h >= 6 && h < 18) ? 'light' : 'dark';
      }
      document.documentElement.setAttribute('data-theme', resolved);
    };
    applyTheme();
    const mqHandler = () => { if (globalTheme === 'system') applyTheme(); };
    mediaQuery.addEventListener('change', mqHandler);

    let timeTick;
    if (globalTheme === 'auto-time') {
      timeTick = setInterval(applyTheme, 60_000);
    }
    return () => {
      mediaQuery.removeEventListener('change', mqHandler);
      if (timeTick) clearInterval(timeTick);
    };
  }, [globalTheme]);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
  }, [density]);

  React.useEffect(() => {
    document.title = activeNode ? `RTX 5 Admin · ${activeNode}` : 'RTX 5 Admin';
  }, [activeNode]);

  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    if (!canDownloadDesktopApp) return undefined;

    let cancelled = false;
    const loadLatestDesktopRelease = () => {
      setDesktopReleaseState((current) => ({
        ...current,
        status: current.installer ? 'ready' : 'loading',
        error: null,
      }));

      getLatestDesktopInstaller()
        .then((installer) => {
          if (!cancelled) {
            setDesktopReleaseState({ status: 'ready', installer, error: null });
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setDesktopReleaseState((current) => ({
              status: current.installer ? 'ready' : 'error',
              installer: current.installer,
              error,
            }));
          }
        });
    };

    loadLatestDesktopRelease();
    const intervalId = window.setInterval(loadLatestDesktopRelease, 10 * 60 * 1000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadLatestDesktopRelease();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [canDownloadDesktopApp]);

  const canViewActive = canAccessView(currentUser, activeNode);
  const activeViewPermission = requiredPermissionForView(activeNode);
  const isAccountEditView = ACCOUNT_EDIT_VIEW_TYPES.has(activeNode);
  const canEditAccounts = hasPermission(currentUser, PERMISSION_KEYS.EDIT_ACCOUNTS);
  const canEditGroups = hasPermission(currentUser, PERMISSION_KEYS.MANAGE_GROUPS);
  const canEditSelectedTarget =
    (selectedEditTarget?.type === 'account' && isAccountEditView && canEditAccounts) ||
    (selectedEditTarget?.type === 'group' && selectedEditTarget.viewType === activeNode && canEditGroups) ||
    (selectedEditTarget?.type === 'trade' && selectedEditTarget.viewType === activeNode && TRADE_DETAIL_VIEW_TYPES.has(activeNode));

  React.useEffect(() => {
    setSelectedEditTarget((target) => (target?.viewType === activeNode ? target : null));
    if (!isAccountEditView) {
      setEditingAccount(null);
    }
    if (!TRADE_DETAIL_VIEW_TYPES.has(activeNode)) {
      setViewingTrade(null);
    }
  }, [activeNode, isAccountEditView]);

  React.useEffect(() => {
    const symbolStore = useSymbolStore.getState();
    if (isAuthenticated && SYMBOL_FEED_VIEWS.has(activeNode)) {
      symbolStore.initWebSocket();
      return;
    }

    symbolStore.disconnectWebSocket();
  }, [isAuthenticated, activeNode]);

  const openTab = React.useCallback((label) => {
    setOpenTabs((prev) => (prev.includes(label) ? prev : [...prev, label]));
    setActiveTab(label);
    setHistory((prev) => {
      const nextHistory = prev.slice(0, currentIndex + 1);
      nextHistory.push(label);
      setCurrentIndex(nextHistory.length - 1);
      return nextHistory;
    });
  }, [currentIndex, setOpenTabs, setActiveTab]);

  const closeTab = (label) => {
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t !== label);
      if (next.length === 0) next.push('Groups');
      if (label === activeTab) setActiveTab(next[next.length - 1]);
      return next;
    });
  };

  const handleNodeSelect = (nodeOrLabel) => {
    let label = typeof nodeOrLabel === 'string' ? nodeOrLabel : nodeOrLabel.label;
    const isLockedDropdownParent = typeof nodeOrLabel !== 'string' && nodeOrLabel.lockedDropdown;
    const viewCapabilityToast = getViewCapabilityToast(label);
    if (!isLockedDropdownParent && viewCapabilityToast) notify(viewCapabilityToast);
    if (shouldBlockViewNavigation(label)) return;
    setServerTargetTab(getInitialServerTabForLabel(label));
    if (label === activeNode) return;
    openTab(label);
  };

  const handleLockedDropdownClick = (nodeOrLabel) => {
    const label = typeof nodeOrLabel === 'string' ? nodeOrLabel : nodeOrLabel.label;
    const viewCapabilityToast = getViewCapabilityToast(label);
    if (viewCapabilityToast) notify(viewCapabilityToast);
  };

  const handleNodeDoubleClick = (node) => {
    const label = typeof node === 'string' ? node : node.label;
    if (['Main Trade Server', 'History Server', 'MainTrade Backup Server', 'Local Main Status Server', 'Local Main Backup Server', 'TradeProcessor SQL_E', 'History Backup Server', 'Access Server'].includes(label)) {
      setServerPopupData({ isOpen: true, target: label, id: Math.floor(Math.random() * 10) + 1 });
    }
  };

  const handleUndo = () => {
    if (currentIndex > 0) {
      const next = currentIndex - 1;
      setCurrentIndex(next);
      setActiveTab(history[next]);
      setOpenTabs((prev) => (prev.includes(history[next]) ? prev : [...prev, history[next]]));
    }
  };

  const handleRedo = () => {
    if (currentIndex < history.length - 1) {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      setActiveTab(history[next]);
      setOpenTabs((prev) => (prev.includes(history[next]) ? prev : [...prev, history[next]]));
    }
  };

  const getEditTargetType = React.useCallback((row, viewType = activeNode) => {
    if (!row) return null;
    if (ACCOUNT_EDIT_VIEW_TYPES.has(viewType)) return 'account';
    if (TRADE_DETAIL_VIEW_TYPES.has(viewType)) return 'trade';
    if (viewType === 'Groups' && row.iconType === 'group') return 'group';
    if (row.iconType === 'group' && (row.group === viewType || row.name === viewType || row.id === viewType)) return 'group';
    return null;
  }, [activeNode]);

  const buildEditTarget = React.useCallback((row, viewType = activeNode) => {
    const type = getEditTargetType(row, viewType);
    if (!type) return null;

    return {
      type,
      row,
      viewType,
      id: row?.id ?? row?.login ?? row?.ticket ?? row?.group ?? row?.name,
    };
  }, [activeNode, getEditTargetType]);

  const handleEditableTargetSelect = React.useCallback((target) => {
    if (!target) {
      setSelectedEditTarget(null);
      return;
    }

    const normalizedTarget = target.type && target.row
      ? target
      : buildEditTarget(target.row ?? target, target.viewType ?? activeNode);
    setSelectedEditTarget(normalizedTarget);
  }, [activeNode, buildEditTarget]);

  const openAccountEditor = React.useCallback((account) => {
    if (!account) return;
    if (!canEditAccounts) {
      notify({
        title: 'Edit unavailable',
        description: `Requires ${PERMISSION_KEYS.EDIT_ACCOUNTS} permission.`,
        tone: 'warning',
      });
      return;
    }
    setEditingAccount(account);
  }, [canEditAccounts, notify]);

  const openEditTarget = React.useCallback((target) => {
    if (!target) return false;

    if (target.type === 'group') {
      setSelectedGroup(target.row);
      setIsPopupOpen(true);
      return true;
    }

    if (target.type === 'account') {
      openAccountEditor(target.row);
      return true;
    }

    if (target.type === 'trade') {
      setViewingTrade({ viewType: target.viewType, row: target.row });
      return true;
    }

    return false;
  }, [openAccountEditor]);

  const handleToolbarEdit = React.useCallback(() => {
    openEditTarget(selectedEditTarget);
  }, [openEditTarget, selectedEditTarget]);

  const handleAccountSaved = React.useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleGroupSaved = React.useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleRowDoubleClick = (row) => {
    const target = buildEditTarget(row);
    if (target) {
      setSelectedEditTarget(target);
      openEditTarget(target);
      return;
    }

    if (NAVIGABLE_ROW_VIEWS.has(activeNode)) {
      if (row.name) handleNodeSelect(row.name);
      return;
    }
  };

  const handleAddClick = () => {
    if (activeNode === 'Groups') {
      setIsCreatingGroup(true);
      return;
    }
    setSelectedGroup({ group: 'New Group\\Demo' });
    setIsPopupOpen(true);
  };

  const handleRefresh = React.useCallback(() => {
    setRefreshKey((prev) => prev + 1);
    notify({ title: 'Refreshed', description: `at ${formatTime(new Date())}`, tone: 'success' });
  }, [notify]);

  const buildPayload = () => ({ view: activeNode, exportedAt: new Date().toISOString(), source: 'RTX5 Admin' });

  const handleExport = () => {
    const href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(buildPayload(), null, 2));
    const a = document.createElement('a');
    a.href = href;
    a.download = `${(activeNode || 'view').replace(/[\s\\/]+/g, '_')}_${Date.now()}.json`;
    a.click();
  };

  const handleExportCsv = () => {
    const rows = [['view', 'exportedAt', 'source'], [activeNode, new Date().toISOString(), 'RTX5 Admin']];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    const a = document.createElement('a');
    a.href = href;
    a.download = `${(activeNode || 'view').replace(/[\s\\/]+/g, '_')}_${Date.now()}.csv`;
    a.click();
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv,.txt';
    input.onchange = (e) => {
      const f = e.target.files?.[0];
      if (f) notify({ title: 'Import selected', description: `${f.name} (${Math.round(f.size / 1024)} KB)`, tone: 'info' });
    };
    input.click();
  };

  const handleCheckForUpdates = React.useCallback(() => {
    const checkForUpdates = window.rtx5Electron?.checkForUpdates;
    if (typeof checkForUpdates !== 'function') return;

    checkForUpdates().catch((error) => {
      notify({
        title: 'Update check failed',
        description: error?.message || 'Unable to start the desktop update check.',
        tone: 'danger',
      });
    });
  }, [notify]);

  const desktopInstaller = desktopReleaseState.installer;
  const desktopDownloadHref = desktopInstaller?.downloadUrl || DESKTOP_RELEASES_PAGE_URL;
  const desktopDownloadLabel = desktopReleaseState.status === 'loading'
    ? 'Finding app'
    : 'Download app';

  const handleDesktopDownloadClick = React.useCallback((event) => {
    if (desktopReleaseState.status === 'loading' && !desktopInstaller) {
      event.preventDefault();
      notify({
        title: 'Preparing desktop download',
        description: 'Checking the latest release asset.',
        tone: 'info',
      });
      return;
    }

    if (!desktopInstaller) {
      notify({
        title: 'Opening release downloads',
        description: 'Could not resolve the installer automatically.',
        tone: 'warning',
      });
      return;
    }

    notify({
      title: 'Downloading desktop app',
      description: `RTX5 Broker Admin v${desktopInstaller.version}`,
      tone: 'success',
    });
  }, [desktopInstaller, desktopReleaseState.status, notify]);

  React.useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const tag = e.target?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable;

      if (!typing && (e.key === '?' || (e.key === '/' && mod))) {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (mod && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleRefresh();
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleExportCsv();
        return;
      }
      if (mod && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleExport();
        return;
      }
      if (mod && !e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setGlobalTheme((prev) => prev === 'dark' ? 'light' : 'dark');
        return;
      }
      if (mod && (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (openTabs.length > 1) closeTab(activeTab);
        return;
      }
      if (mod && e.key === 'Tab') {
        e.preventDefault();
        const idx = openTabs.indexOf(activeTab);
        const dir = e.shiftKey ? -1 : 1;
        const next = openTabs[(idx + dir + openTabs.length) % openTabs.length];
        if (next) setActiveTab(next);
        return;
      }
      if (e.key === 'Escape') {
        if (isPopupOpen) setIsPopupOpen(false);
        else if (editingAccount) setEditingAccount(null);
        else if (viewingTrade) setViewingTrade(null);
        else if (isCreatingGroup) setIsCreatingGroup(false);
        else if (serverPopupData) setServerPopupData(null);
        else if (helpOpen) setHelpOpen(false);
        else if (aboutOpen) setAboutOpen(false);
        else if (searchQuery) setSearchQuery('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleRefresh, activeTab, openTabs, isPopupOpen, editingAccount, viewingTrade, isCreatingGroup, serverPopupData, helpOpen, aboutOpen, searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const connTone = connStatus === 'error' ? 'danger' : 'success';
  const connText = connStatus === 'error' ? `Connection issue: ${connError}` : 'Connected to RTX5-PROD-01';

  if (!isAuthenticated) return null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[color:var(--bg-app)] text-[color:var(--text-primary)] font-sans">
      <MenuBar
        onMenuSelect={handleNodeSelect}
        activeNode={activeNode}
        onThemeSelect={setGlobalTheme}
        currentTheme={globalTheme}
        density={density}
        onDensityToggle={() => setDensity((d) => d === 'compact' ? 'cozy' : 'compact')}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onRefresh={handleRefresh}
        onExport={handleExport}
        onExportCsv={handleExportCsv}
        onImport={handleImport}
        onHelp={() => setHelpOpen(true)}
        onAbout={() => setAboutOpen(true)}
        canUndo={currentIndex > 0}
        canRedo={currentIndex < history.length - 1}
      />

      <ActionToolBar
        onAddClick={handleAddClick}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={currentIndex > 0}
        canRedo={currentIndex < history.length - 1}
        onRefresh={handleRefresh}
        onExport={handleExport}
        onImport={handleImport}
        onEditClick={handleToolbarEdit}
        canEdit={canEditSelectedTarget}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchInputRef={searchInputRef}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <SidebarNavTree
          onNodeSelect={handleNodeSelect}
          onNodeDoubleClick={handleNodeDoubleClick}
          onLockedDropdownClick={handleLockedDropdownClick}
          selectedNodeLabel={activeNode}
        />

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden border-l border-[color:var(--border-default)] bg-[color:var(--bg-app)]">
          <TabBar
            tabs={openTabs}
            activeTab={activeTab}
            onSelect={(t) => {
              const viewCapabilityToast = getViewCapabilityToast(t);
              if (viewCapabilityToast) notify(viewCapabilityToast);
              if (shouldBlockViewNavigation(t)) return;
              setServerTargetTab(getInitialServerTabForLabel(t));
              openTab(t);
            }}
            onClose={closeTab}
          />

          <div className="h-9 bg-[color:var(--bg-surface-1)] border-b border-[color:var(--border-default)] flex items-center px-4 gap-4 text-[11px] text-[color:var(--text-muted)] shadow-[var(--shadow-sm)]">
            <div className="flex items-center gap-1.5 text-[color:var(--text-primary)] font-medium">
              <Network size={12} className="text-[color:var(--text-muted)]" />
              <span>{activeNode}</span>
            </div>
            {canViewActive && rowCount.total > 0 && (
              <span className="font-mono tracking-tight">
                {searchQuery
                  ? `Showing ${rowCount.filtered} of ${rowCount.total}`
                  : `${rowCount.total} rows`}
              </span>
            )}
          </div>

          {canViewActive ? (
            <AdminDataTable
              onRowDoubleClick={handleRowDoubleClick}
              viewType={activeNode}
              onAddClick={handleAddClick}
              initialServerTab={serverTargetTab}
              refreshTrigger={refreshKey}
              searchQuery={searchQuery}
              onCountChange={setRowCount}
              onEditableTargetSelect={handleEditableTargetSelect}
              selectedEditableTargetId={selectedEditTarget?.id}
              selectedEditableTargetType={selectedEditTarget?.type}
            />
          ) : (
            <AccessDeniedPanel viewName={activeNode} permission={activeViewPermission} />
          )}
        </div>
      </div>

      <AnimatePresence>
        {isPopupOpen && activeNode === 'Managers' && (
          <ManagerPropertiesPopup manager={selectedGroup} onClose={() => setIsPopupOpen(false)} />
        )}
        {isPopupOpen && activeNode !== 'Managers' && (
          <GroupPropertiesPopup
            group={selectedGroup}
            onClose={() => setIsPopupOpen(false)}
            onSaved={handleGroupSaved}
          />
        )}
        {editingAccount && (
          <AccountEditPopup
            account={editingAccount}
            onClose={() => setEditingAccount(null)}
            onSaved={handleAccountSaved}
          />
        )}
        {viewingTrade && (
          <TradeDetailsPopup
            viewType={viewingTrade.viewType}
            row={viewingTrade.row}
            onClose={() => setViewingTrade(null)}
          />
        )}
        {isCreatingGroup && (
          <CreateGroupPopup
            onClose={() => setIsCreatingGroup(false)}
            onCreated={() => setRefreshKey((p) => p + 1)}
          />
        )}
        {serverPopupData && (
          <ServerPropertiesPopup
            isOpen={serverPopupData.isOpen}
            onClose={() => setServerPopupData(null)}
            serverName={serverPopupData.target}
            serverId={serverPopupData.id}
          />
        )}
      </AnimatePresence>

      <HelpModal open={helpOpen} onOpenChange={setHelpOpen} />
      <AboutModal open={aboutOpen} onOpenChange={setAboutOpen} />

      <footer className="h-8 bg-[color:var(--bg-surface-1)] border-t border-[color:var(--border-default)] flex items-center gap-2 px-3 justify-between select-none text-[11px] text-[color:var(--text-secondary)] shadow-[var(--shadow-sm)]">
        <div className="flex min-w-0 items-center gap-2" title={connText}>
          <StatusDot tone={connTone} />
          <span className="truncate font-medium">{connText}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-[color:var(--text-muted)] font-mono tracking-tight">
          {canDownloadDesktopApp && (
            <a
              href={desktopDownloadHref}
              target="_blank"
              rel="noopener noreferrer"
              download={desktopInstaller?.fileName || undefined}
              onClick={handleDesktopDownloadClick}
              className="h-6 inline-flex items-center gap-1.5 rounded-[2px] border border-[color:var(--border-default)] bg-[color:var(--bg-surface-2)] px-2 font-sans text-[11px] font-medium text-[color:var(--text-secondary)] hover:border-[color:var(--accent-500)] hover:text-[color:var(--text-primary)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--accent-500)]"
              title={desktopInstaller ? `Download RTX5 Broker Admin v${desktopInstaller.version}` : 'Open latest desktop app download'}
              aria-label={desktopInstaller ? `Download desktop app version ${desktopInstaller.version}` : 'Download desktop app'}
            >
              <Download size={12} aria-hidden="true" />
              <span>{desktopDownloadLabel}</span>
              {desktopInstaller?.version && (
                <span className="hidden text-[10px] text-[color:var(--text-muted)] md:inline">
                  v{desktopInstaller.version}
                </span>
              )}
            </a>
          )}
          {canCheckForUpdates && (
            <button
              type="button"
              onClick={handleCheckForUpdates}
              className="h-6 inline-flex items-center gap-1.5 rounded-[2px] border border-[color:var(--border-default)] bg-[color:var(--bg-surface-2)] px-2 font-sans text-[11px] font-medium text-[color:var(--text-secondary)] hover:border-[color:var(--accent-500)] hover:text-[color:var(--text-primary)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--accent-500)]"
              title="Check for desktop app updates"
              aria-label="Check for desktop app updates"
            >
              <RefreshCcw size={12} aria-hidden="true" />
              <span>Check updates</span>
            </button>
          )}
          <span className={kb.caps ? 'text-[color:var(--text-primary)]' : ''}>CAP</span>
          <span className={kb.num ? 'text-[color:var(--text-primary)]' : ''}>NUM</span>
          <span className={kb.scroll ? 'text-[color:var(--text-primary)]' : ''}>SCRL</span>
          <span className="tabular-nums text-[color:var(--text-primary)]">{formatTime(now)}</span>
        </div>
      </footer>

      <ToastViewport />
    </div>
  );
};

const AuthenticatedApp = ({ navigate }) => (
  <TooltipProvider>
    <ToastProvider>
      <AuthenticatedAppInner navigate={navigate} />
    </ToastProvider>
  </TooltipProvider>
);

export default AuthenticatedApp;
