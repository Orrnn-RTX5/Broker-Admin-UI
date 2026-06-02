import React from 'react';
import MenuBar from './components/organisms/MenuBar';
import ActionToolBar from './components/organisms/ActionToolBar';
import SidebarNavTree from './components/organisms/SidebarNavTree';
import AdminDataTable from './components/organisms/AdminDataTable';
import GroupPropertiesPopup from './components/RIGHTCLICKJPOPUPS/GroupPropertiesPopup';
import ManagerPropertiesPopup from './components/RIGHTCLICKJPOPUPS/ManagerPropertiesPopup';
import ServerPropertiesPopup from './components/RIGHTCLICKJPOPUPS/ServerPropertiesPopup';
import CreateGroupPopup from './components/RIGHTCLICKJPOPUPS/CreateGroupPopup';
import { AdminLogin, BrokerSelector, ManagerLogin, ManualBrokerEntry } from './components/organisms/BrokerAuthScreens';
import { TabBar } from './components/organisms/TabBar';
import { HelpModal } from './components/organisms/HelpModal';
import { useAuthStore } from './store/authStore';
import { useConnectionStore } from './store/connectionStore';
import useSymbolStore from './store/useSymbolStore';
import { useLocalStorage } from './lib/useLocalStorage';
import { useKbStatus } from './lib/useKbStatus';
import { Network, Globe } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { TooltipProvider } from './components/ui/Tooltip';
import { ToastProvider, ToastViewport, useToast } from './components/ui/Toast';
import { StatusDot } from './components/ui/Badge';

const formatTime = (d) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

const AUTH_PATHS = new Set(['/', '/manager-login', '/admin-login', '/broker-manual-entry']);
const SYMBOL_FEED_VIEWS = new Set(['Market Overview']);

const useBrowserPath = () => {
  const [pathname, setPathname] = React.useState(() => window.location.pathname || '/');

  const navigate = React.useCallback((to, options = {}) => {
    const method = options.replace ? 'replaceState' : 'pushState';
    window.history[method](null, '', to);
    setPathname(to);
  }, []);

  React.useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname || '/');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return { pathname, navigate };
};

const AppInner = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((state) => state.setUser);
  const connStatus = useConnectionStore((s) => s.status);
  const connError  = useConnectionStore((s) => s.lastError);
  const { notify } = useToast();
  const kb = useKbStatus();
  const { pathname, navigate } = useBrowserPath();

  const [selectedGroup, setSelectedGroup] = React.useState(null);
  const [isPopupOpen, setIsPopupOpen] = React.useState(false);
  const [serverPopupData, setServerPopupData] = React.useState(null);
  const [isCreatingGroup, setIsCreatingGroup] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [serverTargetTab, setServerTargetTab] = React.useState(null);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [now, setNow] = React.useState(() => new Date());
  const [rowCount, setRowCount] = React.useState({ total: 0, filtered: 0 });

  // Persisted state
  const [globalTheme, setGlobalTheme] = useLocalStorage('rtx5.theme', 'light');         // light|dark|system|auto-time
  const [density, setDensity] = useLocalStorage('rtx5.density', 'compact');              // compact|cozy
  const [savedSearches, setSavedSearches] = useLocalStorage('rtx5.searches', {});        // { [viewType]: query }
  const [openTabs, setOpenTabs] = useLocalStorage('rtx5.tabs', ['Groups']);              // array of viewTypes
  const [activeTab, setActiveTab] = useLocalStorage('rtx5.activeTab', 'Groups');

  // History stack for navigate back/forward (independent of tabs)
  const [history, setHistory] = React.useState([activeTab || 'Groups']);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const activeNode = activeTab || history[currentIndex];

  const searchQuery = savedSearches[activeNode] || '';
  const setSearchQuery = (q) =>
    setSavedSearches((prev) => ({ ...prev, [activeNode]: q }));

  const searchInputRef = React.useRef(null);

  const handleAuthSuccess = React.useCallback((session, redirectPath) => {
    const accessToken = session.token || session.session_token || session.access_token;
    const refreshToken = session.refresh_token || accessToken;

    if (accessToken) {
      setToken(accessToken, refreshToken);
      setUser({
        id: session.login || session.user || 'admin',
        login: session.login || session.user || '',
        name: `Agent ${session.login || session.user || ''}`.trim(),
        role: session.is_admin ? 'admin' : 'manager',
        is_admin: !!session.is_admin,
        broker_id: session.broker_id || null,
      });
    }

    navigate(redirectPath, { replace: true });
  }, [navigate, setToken, setUser]);

  React.useEffect(() => {
    if (!isAuthenticated && !AUTH_PATHS.has(pathname)) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate, pathname]);

  // ── Theme (light/dark/system/auto-time) ──────────────────────────────────
  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      let resolved = globalTheme;
      if (globalTheme === 'system')    resolved = mediaQuery.matches ? 'dark' : 'light';
      else if (globalTheme === 'auto-time') {
        const h = new Date().getHours();
        resolved = (h >= 6 && h < 18) ? 'light' : 'dark';
      }
      document.documentElement.setAttribute('data-theme', resolved);
    };
    applyTheme();
    const mqHandler = () => { if (globalTheme === 'system') applyTheme(); };
    mediaQuery.addEventListener('change', mqHandler);

    // Re-evaluate auto-time every minute
    let timeTick;
    if (globalTheme === 'auto-time') {
      timeTick = setInterval(applyTheme, 60_000);
    }
    return () => {
      mediaQuery.removeEventListener('change', mqHandler);
      if (timeTick) clearInterval(timeTick);
    };
  }, [globalTheme]);

  // ── Density on <html> ────────────────────────────────────────────────────
  React.useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
  }, [density]);

  // ── Window title ─────────────────────────────────────────────────────────
  React.useEffect(() => {
    document.title = activeNode ? `RTX 5 Admin · ${activeNode}` : 'RTX 5 Admin';
  }, [activeNode]);

  // ── Live clock ───────────────────────────────────────────────────────────
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Symbol Store WebSocket (feeds Market Overview counts & live bid/ask) ──
  React.useEffect(() => {
    const symbolStore = useSymbolStore.getState();
    if (isAuthenticated && SYMBOL_FEED_VIEWS.has(activeNode)) {
      symbolStore.initWebSocket();
      return;
    }

    symbolStore.disconnectWebSocket();
  }, [isAuthenticated, activeNode]);

  // ── Tabs + navigation ────────────────────────────────────────────────────
  const openTab = React.useCallback((label) => {
    setOpenTabs((prev) => (prev.includes(label) ? prev : [...prev, label]));
    setActiveTab(label);
    setHistory((prev) => {
      const newHistory = prev.slice(0, currentIndex + 1);
      newHistory.push(label);
      setCurrentIndex(newHistory.length - 1);
      return newHistory;
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
    if (label === 'Local Main Status Server' || label === 'Local Main Backup Server') {
      label = 'Main Trade Server';
      setServerTargetTab('Status');
    } else {
      setServerTargetTab(null);
    }
    if (label === activeNode) return;
    openTab(label);
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

  const handleRowDoubleClick = (group) => {
    if (activeNode === 'Payments' || activeNode === 'Clients & Accounts' || activeNode === 'Orders & Deals') {
      if (group.name) handleNodeSelect(group.name);
      return;
    }
    setSelectedGroup(group);
    setIsPopupOpen(true);
  };

  const handleAddClick = () => {
    if (activeNode === 'Groups') { setIsCreatingGroup(true); return; }
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

  // ── Global keyboard shortcuts ────────────────────────────────────────────
  React.useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const tag = e.target?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable;

      // ? opens help — only when not typing
      if (!typing && (e.key === '?' || (e.key === '/' && mod))) {
        e.preventDefault(); setHelpOpen(true); return;
      }
      if (mod && e.key.toLowerCase() === 'r') { e.preventDefault(); handleRefresh(); return; }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'e') { e.preventDefault(); handleExportCsv(); return; }
      if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); handleExport(); return; }
      if (mod && !e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setGlobalTheme(prev => prev === 'dark' ? 'light' : 'dark');
        return;
      }
      if (mod && (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'k')) {
        e.preventDefault(); searchInputRef.current?.focus(); return;
      }
      if (e.altKey && e.key === 'ArrowLeft')  { e.preventDefault(); handleUndo(); return; }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); handleRedo(); return; }
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
        else if (isCreatingGroup) setIsCreatingGroup(false);
        else if (serverPopupData) setServerPopupData(null);
        else if (helpOpen) setHelpOpen(false);
        else if (searchQuery) setSearchQuery('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleRefresh, activeTab, openTabs, isPopupOpen, isCreatingGroup, serverPopupData, helpOpen, searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const connTone = connStatus === 'error' ? 'danger' : 'success';
  const connText = connStatus === 'error' ? `Connection issue: ${connError}` : 'Connected to RTX5-PROD-01';

  if (!isAuthenticated) {
    if (pathname === '/manager-login') {
      return <ManagerLogin navigate={navigate} onLoginSuccess={handleAuthSuccess} />;
    }

    if (pathname === '/admin-login') {
      return <AdminLogin navigate={navigate} onLoginSuccess={handleAuthSuccess} />;
    }

    if (pathname === '/broker-manual-entry') {
      return <ManualBrokerEntry navigate={navigate} onLoginSuccess={handleAuthSuccess} />;
    }

    return <BrokerSelector navigate={navigate} />;
  }

  return (
    <>
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
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchInputRef={searchInputRef}
        />

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <SidebarNavTree
            onNodeSelect={handleNodeSelect}
            onNodeDoubleClick={handleNodeDoubleClick}
            selectedNodeLabel={activeNode}
          />

          <div className="flex-1 min-h-0 flex flex-col overflow-hidden border-l border-[color:var(--border-subtle)]">
            <TabBar
              tabs={openTabs}
              activeTab={activeTab}
              onSelect={(t) => { setActiveTab(t); openTab(t); }}
              onClose={closeTab}
            />

            {/* Breadcrumb / context bar */}
            <div className="h-8 bg-[color:var(--bg-surface-2)] border-b border-[color:var(--border-subtle)] flex items-center px-3 gap-4 text-[11px] text-[color:var(--text-muted)]">
              <div className="flex items-center gap-1.5 text-[color:var(--text-primary)] font-medium">
                <Network size={12} className="text-[color:var(--text-muted)]" />
                <span>{activeNode}</span>
              </div>
              {rowCount.total > 0 && (
                <span className="font-mono tracking-tight">
                  {searchQuery
                    ? `Showing ${rowCount.filtered} of ${rowCount.total}`
                    : `${rowCount.total} rows`}
                </span>
              )}
              <div className="flex items-center gap-1.5 ml-auto text-[color:var(--text-secondary)]">
                <Globe size={12} />
                <span className="font-mono tracking-tight">4482 / 8 KB</span>
              </div>
            </div>

            <AdminDataTable
              onRowDoubleClick={handleRowDoubleClick}
              viewType={activeNode}
              onAddClick={handleAddClick}
              initialServerTab={serverTargetTab}
              refreshTrigger={refreshKey}
              searchQuery={searchQuery}
              onCountChange={setRowCount}
            />
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
              refreshGroups={() => setRefreshKey((p) => p + 1)}
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

        {/* Status bar */}
        <footer className="h-7 bg-[color:var(--bg-surface-2)] border-t border-[color:var(--border-subtle)] flex items-center px-3 justify-between select-none text-[11px] text-[color:var(--text-secondary)]">
          <div className="flex items-center gap-2" title={connText}>
            <StatusDot tone={connTone} />
            <span className="font-medium">{connText}</span>
          </div>
          <div className="flex items-center gap-4 text-[color:var(--text-muted)] font-mono tracking-tight">
            <span className={kb.caps   ? 'text-[color:var(--text-primary)]' : ''}>CAP</span>
            <span className={kb.num    ? 'text-[color:var(--text-primary)]' : ''}>NUM</span>
            <span className={kb.scroll ? 'text-[color:var(--text-primary)]' : ''}>SCRL</span>
            <span className="tabular-nums text-[color:var(--text-primary)]">{formatTime(now)}</span>
          </div>
        </footer>

        <ToastViewport />
      </div>
    </>
  );
};

const App = () => (
  <TooltipProvider>
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  </TooltipProvider>
);

export default App;
