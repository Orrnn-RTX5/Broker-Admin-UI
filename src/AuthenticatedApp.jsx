import { refreshGroupMembership } from './services/groupMembershipRefresh.js';
import { startManagerAccessFeed } from './services/managerAccessFeed';
import { canViewGroup, canViewGroups, canManageGroupLifecycle, groupAccessKey } from './utils/groupAccess';
import React from 'react';
import MenuBar from './components/organisms/MenuBar';
import ActionToolBar from './components/organisms/ActionToolBar';
import SidebarNavTree from './components/organisms/SidebarNavTree';
import MarketWatchDock from './components/organisms/MarketWatchDock';
import AdminDataTable from './components/organisms/AdminDataTable';
import GroupsExplorer from './components/organisms/GroupsExplorer';
import GroupPropertiesPopup from './components/RIGHTCLICKJPOPUPS/GroupPropertiesPopup';
import ManagerPropertiesPopup from './components/RIGHTCLICKJPOPUPS/ManagerPropertiesPopup';
import ServerPropertiesPopup from './components/RIGHTCLICKJPOPUPS/ServerPropertiesPopup';
import CreateGroupPopup from './components/RIGHTCLICKJPOPUPS/CreateGroupPopup';
import AccountEditPopup from './components/RIGHTCLICKJPOPUPS/AccountEditPopup';
import AccountNativePendingDialog from './components/RIGHTCLICKJPOPUPS/AccountNativePendingDialog';
import {nativePendingAccountTarget} from './utils/nativePendingAccountTarget';
import {getManagerTradeScope} from './services/managerTradeApi';
import TradeDetailsPopup from './components/RIGHTCLICKJPOPUPS/TradeDetailsPopup';
import { HelpModal } from './components/organisms/HelpModal';
import BugReportDialog from './components/BugReportDialog';
import { AboutModal } from './components/organisms/AboutModal';
import { SuperAdminConsole } from './components/organisms/SuperAdminConsole';

import {
  getSearchesStorageKey,
  isAuthStorageEvent,
  LEGACY_SEARCHES_KEY,
  SESSION_EXPIRED_EVENT,
  useAuthStore,
  validateAuthSession,
} from './store/authStore';
import { startSessionRefreshScheduler } from './services/sessionRefreshScheduler';
import { useConnectionStore } from './store/connectionStore';
import useSymbolStore from './store/useSymbolStore';
import { useLocalStorage } from './lib/useLocalStorage';
import { useKbStatus } from './lib/useKbStatus';
import { canAccessView, hasPermission, PERMISSION_KEYS, requiredPermissionForView } from './utils/permissions';
import { AuthService } from './services/auth.service';
import { ManagerService } from './services/manager.service';
import { AccountsService } from './services/accounts.service';
import {
  DESKTOP_RELEASES_PAGE_URL,
  getLatestDesktopInstaller,
} from './config/desktopRelease';
import { getViewCapabilityToast, shouldBlockViewNavigation } from './config/viewCapabilities';
import { resolveGroupExplorerNode, sameGroupExplorerLocation, getHistoryEntryView, retireGroupHistory } from './utils/groupExplorerNavigation';
import { Download, FolderTree, Network, RefreshCcw, ShieldAlert, Users } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { TooltipProvider } from './components/ui/Tooltip';
import { ToastProvider, ToastViewport } from './components/ui/Toast';
import { useToast } from './components/ui/useToast';
import { StatusDot } from './components/ui/Badge';

const formatTime = (d) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

const StatusClock = React.memo(function StatusClock() {
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return <span className="tabular-nums text-[color:var(--text-primary)]">{formatTime(now)}</span>;
});

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
  const dummyGroupsRef = React.useRef(null);
  const [isPopupOpen, setIsPopupOpen] = React.useState(false);
  // Opened by double-clicking an account: that account's group, on Margin, without the Accounts tab.
  const [groupPopupFromAccount, setGroupPopupFromAccount] = React.useState(false);
  const [selectedEditTarget, setSelectedEditTarget] = React.useState(null);
  const [selectedSidebarNodeId, setSelectedSidebarNodeId] = React.useState(null);
  const [editingAccount, setEditingAccount] = React.useState(null);
  const [nativePendingTargetKey,setNativePendingTargetKey]=React.useState(null);
  const [viewingTrade, setViewingTrade] = React.useState(null);
  const [serverPopupData, setServerPopupData] = React.useState(null);
  const [isCreatingGroup, setIsCreatingGroup] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [bugReportOpen, setBugReportOpen] = React.useState(false);
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const [isSuperAdminOpen, setIsSuperAdminOpen] = React.useState(false);
  const [rowCount, setRowCount] = React.useState({ total: 0, filtered: 0, visible: 0, bytes: 0 });
  const [desktopReleaseState, setDesktopReleaseState] = React.useState({
    status: 'idle',
    installer: null,
    error: null,
  });

  const [globalTheme, setGlobalTheme] = useLocalStorage('rtx5.theme', 'light');
  const [density, setDensity] = useLocalStorage('rtx5.density', 'compact');
  // Searches last for this tab and broker only, so a filter typed in an earlier
  // session (or for another broker) can never silently hide this session's rows.
  const [savedSearches, setSavedSearches] = useLocalStorage(getSearchesStorageKey(), {}, 'sessionStorage');
  React.useEffect(() => {
    try { localStorage.removeItem(LEGACY_SEARCHES_KEY); } catch { /* noop */ }
  }, []);
  const defaultLandingView = canAccessView(currentUser, 'Integrations') ? 'Integrations' : 'Groups';
  // Keep the existing storage key so the last selected page still restores.
  const [activeTab, setActiveTab] = useLocalStorage('rtx5.activeTab', defaultLandingView);
  const [serverTargetTab, setServerTargetTab] = React.useState(() => getInitialServerTabForLabel(activeTab));
  const [groupExplorerLocation, setGroupExplorerLocation] = React.useState(() => resolveGroupExplorerNode('Groups'));
  const [groupExplorerReveal, setGroupExplorerReveal] = React.useState(() => (
    activeTab === 'Groups' ? { ...resolveGroupExplorerNode('Groups'), revision: 0 } : null
  ));

  const [history, setHistory] = React.useState([activeTab || defaultLandingView]);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [tableSortDirection, setTableSortDirection] = React.useState('');
  const [autoRefresh, setAutoRefresh] = React.useState(false);
  const isDeletingTarget = false;
  const activeNode = activeTab || getHistoryEntryView(history[currentIndex]);
  const canCheckForUpdates =
    typeof window !== 'undefined' &&
    typeof window.rtx5Electron?.checkForUpdates === 'function';
  const canDownloadDesktopApp = !canCheckForUpdates;

  const searchQuery = savedSearches[activeNode] || '';
  const setSearchQuery = (q) => {
    setSelectedSidebarNodeId(null);
    setSavedSearches((prev) => ({ ...prev, [activeNode]: q }));
  };


  const groupIdentity=groupAccessKey(currentUser);
  React.useEffect(()=>{
    setSelectedGroup(null);setIsPopupOpen(false);setIsCreatingGroup(false);
    setSelectedEditTarget(target=>target?.type==='group'?null:target);
    setRefreshKey(value=>value+1);
  },[groupIdentity]);

  const searchInputRef = React.useRef(null);
  React.useEffect(() => {
    if (!isAuthenticated || !accessToken) return undefined;

    let cancelled = false;
    const refreshAccess=()=>AuthService.getMe().catch(() => {
      if (!cancelled && currentUser) {
        const latest=useAuthStore.getState();
        if(latest.accessToken===accessToken) setUser({...latest.user,group_config_admin:false,group_access_mode:'none',permissions:null});
      }
    });

    refreshAccess();
    const timer=window.setInterval(refreshAccess,5000);
    const stopAccessFeed=startManagerAccessFeed(refreshAccess);
    window.addEventListener('focus',refreshAccess);
    return () => { cancelled=true;stopAccessFeed();window.clearInterval(timer);window.removeEventListener('focus',refreshAccess); };
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

    // The access token lasts about an hour; renew it before it expires instead
    // of logging out. Restarts whenever the expiry changes, including after a
    // refresh done by another tab.
    const scheduler = startSessionRefreshScheduler();
    return () => scheduler.stop();
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
  const isAccountEditView = ACCOUNT_EDIT_VIEW_TYPES.has(activeNode) || (activeNode === 'Groups' && groupExplorerLocation.type === 'group');
  const canEditAccounts = hasPermission(currentUser, PERMISSION_KEYS.EDIT_ACCOUNTS);
  const nativePendingTarget=nativePendingAccountTarget({selected:selectedEditTarget,activeView:activeNode,accountView:isAccountEditView,canView:canViewActive,user:currentUser,scope:isAuthenticated?getManagerTradeScope():''});
  React.useEffect(()=>{if(nativePendingTargetKey!==nativePendingTarget?.key)setNativePendingTargetKey(null);},[nativePendingTargetKey,nativePendingTarget?.key]);
  const canEditGroups = canViewGroups(currentUser);
  const canCreateDeleteGroups=canManageGroupLifecycle(currentUser);
  const canEditSelectedTarget =
    (selectedEditTarget?.type === 'account' && selectedEditTarget.viewType === activeNode && isAccountEditView && canEditAccounts) ||
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
    if (isAuthenticated) {
      symbolStore.initWebSocket();
      return () => symbolStore.disconnectWebSocket();
    }

    symbolStore.disconnectWebSocket();
  }, [isAuthenticated]);

  const openView = React.useCallback((label, folderLocation = null) => {
    setActiveTab(label);
    setHistory((prev) => {
      const nextHistory = prev.slice(0, currentIndex + 1);
      nextHistory.push(folderLocation ? { view: label, groupExplorerLocation: folderLocation } : label);
      setCurrentIndex(nextHistory.length - 1);
      return nextHistory;
    });
  }, [currentIndex, setActiveTab]);

  const navigateGroupExplorer = (node) => {
    const location = resolveGroupExplorerNode(node);
    if (!location) return false;
    if (!canAccessView(currentUser, 'Groups')) {
      notify({ title: 'Groups unavailable', description: `Requires ${PERMISSION_KEYS.VIEW_GROUPS} permission and assigned groups.`, tone: 'warning' });
      return false;
    }
    setGroupExplorerLocation(location);
    setGroupExplorerReveal(previous => ({ ...location, revision: (previous?.revision ?? 0) + 1 }));
    setSelectedSidebarNodeId(location.id);
    setSelectedEditTarget(null);
    setEditingAccount(null);
    setServerTargetTab(null);
    setSavedSearches(previous => ({ ...previous, Groups: '' }));
    if (activeNode !== 'Groups' || !sameGroupExplorerLocation(groupExplorerLocation, location)) {
      openView('Groups', location);
    }
    return true;
  };

  const selectGroupAccountNode = (node) => {
    if (!canAccessView(currentUser, 'Trading Accounts')) {
      notify({
        title: 'Account unavailable',
        description: `Requires ${PERMISSION_KEYS.VIEW_ACCOUNTS} permission.`,
        tone: 'warning',
      });
      return false;
    }

    const login = String(node.login ?? node.account?.login ?? '').trim();
    if (!login || !navigateGroupExplorer(node)) return false;
    setSelectedSidebarNodeId(node.id);
    setSelectedEditTarget({ type: 'account', row: node.account, viewType: 'Groups', id: node.account?.id ?? login });
    return true;
  };

  const handleNodeSelect = (nodeOrLabel) => {
    if (typeof nodeOrLabel !== 'string' && nodeOrLabel?.type === 'group-account') {
      selectGroupAccountNode(nodeOrLabel);
      return;
    }
    if (resolveGroupExplorerNode(nodeOrLabel)) {
      navigateGroupExplorer(nodeOrLabel);
      return;
    }

    setSelectedSidebarNodeId(null);
    let label = typeof nodeOrLabel === 'string' ? nodeOrLabel : nodeOrLabel.label;
    if (label === 'SuperAdmin' || label === 'Platform Super Admin') {
      setIsSuperAdminOpen(true);
      return;
    }
    const isLockedDropdownParent = typeof nodeOrLabel !== 'string' && nodeOrLabel.lockedDropdown;

    const viewCapabilityToast = getViewCapabilityToast(label);
    if (!isLockedDropdownParent && viewCapabilityToast) notify(viewCapabilityToast);
    if (shouldBlockViewNavigation(label)) return;
    setServerTargetTab(getInitialServerTabForLabel(label));
    if (label === activeNode) return;
    openView(label);
  };

  const handleLockedDropdownClick = (nodeOrLabel) => {
    const label = typeof nodeOrLabel === 'string' ? nodeOrLabel : nodeOrLabel.label;
    const viewCapabilityToast = getViewCapabilityToast(label);
    if (viewCapabilityToast) notify(viewCapabilityToast);
  };

  const handleNodeDoubleClick = (node) => {
    if (typeof node !== 'string' && node?.type === 'group-account') {
      if (!selectGroupAccountNode(node) || !node.account) return;
      openAccountEditor(node.account);
      return;
    }
    if (resolveGroupExplorerNode(node)) {
      navigateGroupExplorer(node);
      return;
    }

    const label = typeof node === 'string' ? node : node.label;
    if (['Main Trade Server', 'History Server', 'MainTrade Backup Server', 'Local Main Status Server', 'Local Main Backup Server', 'TradeProcessor SQL_E', 'History Backup Server', 'Access Server'].includes(label)) {
      setServerPopupData({ isOpen: true, target: label, id: Math.floor(Math.random() * 10) + 1 });
    }
  };

  const restoreHistoryEntry = (entry) => {
    const view = getHistoryEntryView(entry);
    setSelectedEditTarget(null);
    setEditingAccount(null);
    setActiveTab(view);
    setServerTargetTab(getInitialServerTabForLabel(view));
    if (view === 'Groups') {
      const location = entry?.groupExplorerLocation || resolveGroupExplorerNode('Groups');
      setGroupExplorerLocation(location);
      setGroupExplorerReveal(previous => ({ ...location, revision: (previous?.revision ?? 0) + 1 }));
      setSelectedSidebarNodeId(location.id);
      setSavedSearches(previous => ({ ...previous, Groups: '' }));
    } else {
      setSelectedSidebarNodeId(null);
    }
  };

  const handleUndo = () => {
    if (currentIndex > 0) {
      setSelectedSidebarNodeId(null);
      const next = currentIndex - 1;
      setCurrentIndex(next);
      restoreHistoryEntry(history[next]);
    }
  };

  const handleRedo = () => {
    if (currentIndex < history.length - 1) {
      setSelectedSidebarNodeId(null);
      const next = currentIndex + 1;
      setCurrentIndex(next);
      restoreHistoryEntry(history[next]);
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

    if (target.type === 'group' && target.row?.isDummy) {
      dummyGroupsRef.current?.editGroup(target.row);
      return true;
    }

    if (target.type === 'group') {
      if(!canViewGroup(currentUser,target.row?.name || target.row?.group)) return false;
      setSelectedGroup(target.row);
      setGroupPopupFromAccount(false);
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
  }, [openAccountEditor,currentUser]);

  const handleToolbarEdit = React.useCallback(() => {
    openEditTarget(selectedEditTarget);
  }, [openEditTarget, selectedEditTarget]);

  const handleAccountSaved = React.useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleGroupSaved = React.useCallback((result) => {
    if (result?.action) {
      refreshGroupMembership(result);
      setSelectedEditTarget(null); setEditingAccount(null); setViewingTrade(null);
      if (result.action === 'deleted') {
        const location = resolveGroupExplorerNode({ type: 'group', groupName: result.to_group }) || resolveGroupExplorerNode('Groups');
        setGroupExplorerLocation(location); setSelectedSidebarNodeId(location.type === 'group' ? location.id : null);
        setGroupExplorerReveal(previous => ({ ...location, revision: (previous?.revision ?? 0) + 1 }));
        setHistory(previous => retireGroupHistory(previous, result.from_group || result.group, result.to_group));
        setSavedSearches(previous => ({ ...previous, Groups: '' }));
      }
    } else AccountsService.invalidateCache();
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
      if(!canCreateDeleteGroups) return;
      setIsCreatingGroup(true);
      return;
    }
    setSelectedGroup({ group: 'New Group\\Demo' });
    setGroupPopupFromAccount(false);
    setIsPopupOpen(true);
  };

  const openAccountGroupProperties = React.useCallback((group) => {
    setSelectedGroup(group);
    setGroupPopupFromAccount(true);
    setIsPopupOpen(true);
  }, []);

  const handleRefresh = React.useCallback(() => {
    AccountsService.invalidateCache();
    setRefreshKey((prev) => prev + 1);
    notify({ title: 'Refreshed', description: `at ${formatTime(new Date())}`, tone: 'success' });
  }, [notify]);

  const buildPayload = () => ({ view: activeNode, exportedAt: new Date().toISOString(), source: 'RTX5 Admin' });

  const visibleRowsRef = React.useRef([]);
  const handleRowsChange = React.useCallback((rows) => {
    visibleRowsRef.current = Array.isArray(rows) ? rows : [];
  }, []);

  const EXPORT_INTERNAL_KEYS = new Set(['raw']);
  const getExportRows = () => visibleRowsRef.current.map((row) => {
    const clean = {};
    Object.entries(row || {}).forEach(([key, value]) => {
      if (EXPORT_INTERNAL_KEYS.has(key)) return;
      clean[key] = value;
    });
    return clean;
  });

  const csvEscape = (value) => {
    if (value === null || value === undefined) return '""';
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  const downloadText = (filename, mime, text) => {
    const href = `data:${mime};charset=utf-8,${encodeURIComponent(text)}`;
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    a.click();
  };

  const handleExport = () => {
    const rows = getExportRows();
    const payload = { ...buildPayload(), rowCount: rows.length, rows };
    downloadText(`${(activeNode || 'view').replace(/[\s\\/]+/g, '_')}_${Date.now()}.json`, 'text/json', JSON.stringify(payload, null, 2));
    notify({
      title: 'Export JSON complete',
      description: rows.length ? `${rows.length} rows from ${activeNode}` : `View metadata for ${activeNode} (no table rows mounted)`,
      tone: 'success',
    });
  };

  const handleExportCsv = () => {
    const rows = getExportRows();
    let csv;
    if (rows.length) {
      const cols = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
      const lines = [cols.map(csvEscape).join(',')];
      rows.forEach((row) => lines.push(cols.map((col) => csvEscape(row[col])).join(',')));
      csv = lines.join('\n');
    } else {
      csv = [['view', 'exportedAt', 'source'], [activeNode, new Date().toISOString(), 'RTX5 Admin']]
        .map((line) => line.map(csvEscape).join(','))
        .join('\n');
    }
    downloadText(`${(activeNode || 'view').replace(/[\s\\/]+/g, '_')}_${Date.now()}.csv`, 'text/csv', csv);
    notify({
      title: 'Export CSV complete',
      description: rows.length ? `${rows.length} rows from ${activeNode}` : `View metadata for ${activeNode} (no table rows mounted)`,
      tone: 'success',
    });
  };

  const parseImportFile = (text) => {
    const trimmed = text.trim();
    if (!trimmed) throw new Error('file is empty');
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed);
      const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.rows) ? parsed.rows : null;
      if (!rows) throw new Error('JSON has no rows array');
      return { format: 'JSON', view: parsed?.view || null, count: rows.length };
    }
    const lines = trimmed.split(/\r?\n/).filter((line) => line.trim() !== '');
    if (lines.length < 2) throw new Error('CSV needs a header row and at least one data row');
    return { format: 'CSV', view: null, count: lines.length - 1 };
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv,.txt';
    input.onchange = async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      try {
        const summary = parseImportFile(await f.text(), f.name);
        notify({
          title: 'Import validated',
          description: `${summary.format}: ${summary.count} rows in ${f.name}${summary.view ? ` (view: ${summary.view})` : ''}`,
          tone: 'success',
        });
      } catch (err) {
        notify({
          title: 'Import failed',
          description: `${f.name}: ${err.message}`,
          tone: 'danger',
        });
      }
    };
    input.click();
  };

  React.useEffect(() => {
    if (!autoRefresh || !isAuthenticated) return undefined;
    const intervalId = window.setInterval(() => {
      setRefreshKey((prev) => prev + 1);
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [autoRefresh, isAuthenticated]);

  const handleStartAutoRefresh = React.useCallback(() => {
    setAutoRefresh(true);
    notify({
      title: 'Live auto-refresh enabled',
      description: 'Workspace automatically updates every 15s',
      tone: 'success',
    });
  }, [notify]);

  const handlePauseAutoRefresh = React.useCallback(() => {
    setAutoRefresh(false);
    notify({
      title: 'Live auto-refresh paused',
      description: 'Automatic polling stopped',
      tone: 'info',
    });
  }, [notify]);

  const handleDisconnect = React.useCallback(() => {
    if (window.confirm('Disconnect and log out of RTX 5 Admin?')) {
      AuthService.logout();
    }
  }, []);

  const handleForceSync = React.useCallback(() => {
    try {
      useSymbolStore.getState().initWebSocket();
    } catch { /* noop */ }
    setRefreshKey((prev) => prev + 1);
    notify({
      title: 'Workspace synchronized',
      description: 'Real-time feed reconnected and cache refreshed',
      tone: 'success',
    });
  }, [notify]);

  const handleSort = React.useCallback(() => {
    setTableSortDirection((prev) => {
      const next = prev === '' ? 'asc' : prev === 'asc' ? 'desc' : '';
      const label = next === 'asc' ? 'Ascending' : next === 'desc' ? 'Descending' : 'Default';
      notify({
        title: 'Table sort updated',
        description: `Order set to ${label}`,
        tone: 'info',
      });
      return next;
    });
  }, [notify]);

  const canDeleteSelectedTarget = Boolean(selectedEditTarget?.type === 'group' && canCreateDeleteGroups);
  const handleToolbarDelete = React.useCallback(async (explicitTarget) => {
    const target = explicitTarget?.type === 'group' || explicitTarget?.type === 'group-branch' ? explicitTarget : selectedEditTarget;
    if (!target || !canCreateDeleteGroups) return;
    if (target.type === 'group-branch') {
      notify({ title: 'Group migration required', description: 'Open each group to preview complete migration and verified deletion.', tone: 'warning' });
      return;
    }
    if (target.type === 'group' && target.row?.isDummy) {
      dummyGroupsRef.current?.deleteGroup(target.row);
      return;
    }
    if (target.type === 'group') {
      const groupName = target.row?.name || target.row?.group || target.id;
      if (!groupName) return;
      setSelectedGroup({ ...(target.row || {}), name: groupName, initialTab: 'Migration' });
      setGroupPopupFromAccount(false);
      setIsPopupOpen(true);
    } else {
      notify({ title: 'Delete unavailable', description: `Deleting ${target.type} is not supported from the toolbar.`, tone: 'warning' });
    }
  }, [selectedEditTarget, canCreateDeleteGroups, notify]);

  const canAdd = Boolean((activeNode === 'Groups' && canCreateDeleteGroups) || activeNode === 'Trading Accounts' || activeNode === 'Clients' || activeNode === 'Managers');
  const canImport = activeNode === 'Groups' && canCreateDeleteGroups;
  const canSort = true;

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
      // Local group dialogs own their keyboard and drafts until saved or cancelled.
      if (e.target?.closest?.('.dgp-modal, .dummy-group-action-dialog')) return;
      const mod = e.ctrlKey || e.metaKey;
      const tag = e.target?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable;

      if (!typing && (e.key === '?' || (e.key === '/' && mod))) {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'r') {
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
  }, [handleRefresh, activeTab, currentIndex, history, isPopupOpen, editingAccount, viewingTrade, isCreatingGroup, serverPopupData, helpOpen, aboutOpen, searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const connTone = connStatus === 'error' ? 'danger' : 'success';
  const connText = connStatus === 'error' ? `Connection issue: ${connError}` : 'Connected to RTX5-PROD-01';

  if (!isAuthenticated) return null;

  return (
    <div className="admin-workspace flex flex-col h-screen w-screen overflow-hidden bg-[color:var(--bg-app)] text-[color:var(--text-primary)] font-sans">
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
        onReportBug={() => setBugReportOpen(true)}
        onAbout={() => setAboutOpen(true)}
        canUndo={currentIndex > 0}
        canRedo={currentIndex < history.length - 1}
      >

      <ActionToolBar
        onDisconnect={handleDisconnect}
        onAddClick={handleAddClick}
        canAdd={canAdd}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={currentIndex > 0}
        canRedo={currentIndex < history.length - 1}
        onRefresh={handleRefresh}
        onSync={handleForceSync}
        onExport={handleExport}
        onExportCsv={handleExportCsv}
        onImport={handleImport}
        canImport={canImport}
        onEditClick={handleToolbarEdit}
        canEdit={canEditSelectedTarget}
        onNativePending={()=>{if(nativePendingTarget)setNativePendingTargetKey(nativePendingTarget.key);}}
        canViewNativePending={Boolean(nativePendingTarget)}
        onDeleteClick={handleToolbarDelete}
        canDelete={canDeleteSelectedTarget}
        deleting={isDeletingTarget}
        onSort={handleSort}
        canSort={canSort}
        sortDirection={tableSortDirection}
        autoRefresh={autoRefresh}
        onStart={handleStartAutoRefresh}
        onPause={handlePauseAutoRefresh}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchInputRef={searchInputRef}
        activeNode={activeNode}
        onNodeSelect={handleNodeSelect}
        density={density}
        onDensityToggle={() => setDensity((d) => (d === 'compact' ? 'cozy' : 'compact'))}
        onHelp={() => setHelpOpen(true)}
        onReportBug={() => setBugReportOpen(true)}
        connStatus={connStatus}
      />
      </MenuBar>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <MarketWatchDock>
        <SidebarNavTree
          onNodeSelect={handleNodeSelect}
          onNodeDoubleClick={handleNodeDoubleClick}
          onLockedDropdownClick={handleLockedDropdownClick}
          selectedNodeLabel={activeNode === 'Market Overview' ? 'Symbols Browser' : activeNode}
          selectedNodeId={selectedSidebarNodeId}
          refreshTrigger={refreshKey}
          groupExplorerReveal={groupExplorerReveal}
        />
        </MarketWatchDock>

        <div className={`flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden border-l border-[color:var(--border-default)] bg-[color:var(--bg-app)]${activeNode === 'Allocations' ? ' allocation-typography' : ''}`}>
          {!(canViewActive && ['Integrations', 'Market Overview', 'Symbols Browser', 'Symbol Management'].includes(activeNode)) && (
          <div className="min-h-10 bg-[color:var(--bg-surface-1)] border-b border-[color:var(--border-default)] flex items-center px-4 gap-3 text-xs text-[color:var(--text-muted)] shadow-[var(--shadow-sm)] select-none">
            <div role="heading" aria-level="1" className="flex items-center gap-2 text-[color:var(--text-primary)] font-semibold tracking-wide" style={{ fontSize: '14px', lineHeight: '18px' }}>
              {activeNode === 'Groups' ? (
                <FolderTree size={13} className="text-white" />
              ) : (activeNode === 'Trading Accounts' || activeNode === 'Clients') ? (
                <Users size={13} className="text-white" />
              ) : activeNode !== 'Allocations' ? (
                <Network size={13} className="text-white" />
              ) : null}
              <span>{activeNode}</span>
            </div>
            {canViewActive && rowCount.total > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[color:var(--bg-surface-3)] text-[color:var(--text-secondary)] border border-[color:var(--border-subtle)] shadow-xs">
                {searchQuery ? (
                  <>Showing <strong className="text-white">{rowCount.filtered}</strong> of {rowCount.total}</>
                ) : (
                  <>{rowCount.total} {rowCount.total === 1 ? (activeNode === 'Groups' ? 'item' : 'row') : (activeNode === 'Groups' ? 'items' : 'rows')}</>
                )}
              </span>
            )}
          </div>

          )}

          {canViewActive && activeNode === 'Groups' ? (
            <GroupsExplorer
              dummyActionsRef={dummyGroupsRef}
              key={`${groupIdentity}:${groupExplorerLocation.id}`}
              location={groupExplorerLocation}
              onNavigate={navigateGroupExplorer}
              onAccountOpen={handleNodeDoubleClick}
              onAccountGroupOpen={openAccountGroupProperties}
              onSelectionChange={handleEditableTargetSelect}
              selectedNodeId={selectedSidebarNodeId}
              onGroupEdit={(node) => openEditTarget({ type: 'group', row: node.group, viewType: 'Groups', id: node.groupName })}
              onGroupCreate={canCreateDeleteGroups ? (draft) => setIsCreatingGroup(draft ? { draft } : true) : undefined}
              onGroupDelete={handleToolbarDelete}
              deleting={isDeletingTarget}
              refreshTrigger={refreshKey}
              searchQuery={searchQuery}
              sortDirection={tableSortDirection}
              onCountChange={setRowCount}
              onRowsChange={handleRowsChange}
            />
          ) : canViewActive ? (
            <AdminDataTable key={groupIdentity}
              onRowDoubleClick={handleRowDoubleClick}
              viewType={activeNode}
              onAddClick={handleAddClick}
              onGroupsChanged={handleGroupSaved}
              initialServerTab={serverTargetTab}
              refreshTrigger={refreshKey}
              searchQuery={searchQuery}
              sortDirection={tableSortDirection}
              onCountChange={setRowCount}
              onRowsChange={handleRowsChange}
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
        {nativePendingTarget&&nativePendingTargetKey===nativePendingTarget.key&&<AccountNativePendingDialog target={nativePendingTarget} onClose={()=>setNativePendingTargetKey(null)}/>}
        {isPopupOpen && activeNode === 'Managers' && (
          <ManagerPropertiesPopup manager={selectedGroup} onClose={() => setIsPopupOpen(false)} />
        )}
        {isPopupOpen && activeNode !== 'Managers' && (
          <GroupPropertiesPopup
            group={selectedGroup}
            onClose={() => setIsPopupOpen(false)}
            onSaved={handleGroupSaved}
            onOpenAccount={openAccountEditor}
            onNoChanges={groupPopupFromAccount ? undefined : (groupName) => navigateGroupExplorer({ type: 'group', groupName })}
            initialTab={groupPopupFromAccount ? 'Margin' : (selectedGroup?.initialTab || 'Accounts')}
            showAccountsTab={!groupPopupFromAccount}
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
        {isCreatingGroup && canCreateDeleteGroups && (
          <CreateGroupPopup
            draftData={isCreatingGroup?.draft}
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
      {bugReportOpen && <BugReportDialog onClose={() => setBugReportOpen(false)} />}
      <AboutModal open={aboutOpen} onOpenChange={setAboutOpen} />
      {isSuperAdminOpen && (
        <div className="fixed inset-0 z-[10000]">
          <SuperAdminConsole onClose={() => setIsSuperAdminOpen(false)} />
        </div>
      )}


      <footer className="h-6 bg-[color:var(--bg-chrome)] border-t border-[color:var(--border-subtle)] flex items-center gap-2 px-3 justify-between select-none text-[11px] text-[color:var(--text-secondary)]">
        <div className="flex min-w-0 items-center gap-2" title={connText}>
          <StatusDot tone={connTone} />
          <span className="truncate font-normal text-[11px]">{connText}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-[color:var(--text-muted)] font-mono text-[11px] tracking-tight">
          {canDownloadDesktopApp && (
            <a
              href={desktopDownloadHref}
              target="_blank"
              rel="noopener noreferrer"
              download={desktopInstaller?.fileName || undefined}
              onClick={handleDesktopDownloadClick}
              className="h-5 inline-flex items-center gap-1 rounded-[2px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-2)] px-1.5 font-sans text-[11px] font-normal text-[color:var(--text-secondary)] hover:border-[color:var(--accent-500)] hover:text-[color:var(--text-primary)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--accent-500)]"
              title={desktopInstaller ? `Download RTX5 Broker Admin v${desktopInstaller.version}` : 'Open latest desktop app download'}
              aria-label={desktopInstaller ? `Download desktop app version ${desktopInstaller.version}` : 'Download desktop app'}
            >
              <Download size={11} aria-hidden="true" />
              <span>{desktopDownloadLabel}</span>
              {desktopInstaller?.version && (
                <span className="hidden text-[11px] text-[color:var(--text-muted)] md:inline">
                  v{desktopInstaller.version}
                </span>
              )}
            </a>
          )}
          {canCheckForUpdates && (
            <button
              type="button"
              onClick={handleCheckForUpdates}
              className="h-5 inline-flex items-center gap-1 rounded-[2px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-2)] px-1.5 font-sans text-[11px] font-normal text-[color:var(--text-secondary)] hover:border-[color:var(--accent-500)] hover:text-[color:var(--text-primary)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--accent-500)]"
              title="Check for desktop app updates"
              aria-label="Check for desktop app updates"
            >
              <RefreshCcw size={11} aria-hidden="true" />
              <span>Check updates</span>
            </button>
          )}
          <span className={kb.caps ? 'text-[color:var(--text-primary)] font-medium' : 'text-[color:var(--text-muted)]'}>CAP</span>
          <span className={kb.num ? 'text-[color:var(--text-primary)] font-medium' : 'text-[color:var(--text-muted)]'}>NUM</span>
          <span className={kb.scroll ? 'text-[color:var(--text-primary)] font-medium' : 'text-[color:var(--text-muted)]'}>SCRL</span>
          <StatusClock />
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
