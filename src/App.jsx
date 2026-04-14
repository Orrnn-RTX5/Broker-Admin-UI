import React from 'react';
import MenuBar from './components/organisms/MenuBar';
import ActionToolBar from './components/organisms/ActionToolBar';
import SidebarNavTree from './components/organisms/SidebarNavTree';
import AdminDataTable from './components/organisms/AdminDataTable';
import GroupPropertiesPopup from './components/RIGHTCLICKJPOPUPS/GroupPropertiesPopup';
import ManagerPropertiesPopup from './components/RIGHTCLICKJPOPUPS/ManagerPropertiesPopup';
import ServerPropertiesPopup from './components/RIGHTCLICKJPOPUPS/ServerPropertiesPopup';
import CreateGroupPopup from './components/RIGHTCLICKJPOPUPS/CreateGroupPopup';
import LoginOverlay from './components/organisms/LoginOverlay';
import { useAuthStore } from './store/authStore';
import { Network, Globe } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { TooltipProvider } from './components/ui/Tooltip';
import { ToastProvider, ToastViewport } from './components/ui/Toast';
import { StatusDot } from './components/ui/Badge';

const App = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [selectedGroup, setSelectedGroup] = React.useState(null);
  const [isPopupOpen, setIsPopupOpen] = React.useState(false);
  const [serverPopupData, setServerPopupData] = React.useState(null);
  const [history, setHistory] = React.useState(['Groups']);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const activeNode = history[currentIndex];
  const [isCreatingGroup, setIsCreatingGroup] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [globalTheme, setGlobalTheme] = React.useState('light');
  const [serverTargetTab, setServerTargetTab] = React.useState(null);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      let resolved = globalTheme;
      if (globalTheme === 'system') resolved = mediaQuery.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', resolved);
    };
    applyTheme();
    const handler = () => { if (globalTheme === 'system') applyTheme(); };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [globalTheme]);

  const handleRowDoubleClick = (group) => {
    if (activeNode === 'Payments' || activeNode === 'Clients & Accounts' || activeNode === 'Orders & Deals') {
      if (group.name) handleNodeSelect(group.name);
      return;
    }
    setSelectedGroup(group);
    setIsPopupOpen(true);
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

    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push(label);
    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  };

  const handleNodeDoubleClick = (node) => {
    const label = typeof node === 'string' ? node : node.label;
    if (['Main Trade Server', 'History Server', 'MainTrade Backup Server', 'Local Main Status Server', 'Local Main Backup Server', 'TradeProcessor SQL_E', 'History Backup Server', 'Access Server'].includes(label)) {
      setServerPopupData({ isOpen: true, target: label, id: Math.floor(Math.random() * 10) + 1 });
    }
  };

  const handleUndo = () => { if (currentIndex > 0) setCurrentIndex(currentIndex - 1); };
  const handleRedo = () => { if (currentIndex < history.length - 1) setCurrentIndex(currentIndex + 1); };

  const handleAddClick = () => {
    if (activeNode === 'Groups') {
      setIsCreatingGroup(true);
      return;
    }
    setSelectedGroup({ group: 'New Group\\Demo' });
    setIsPopupOpen(true);
  };

  return (
    <TooltipProvider>
      <ToastProvider>
        {!isAuthenticated && <LoginOverlay />}
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-[color:var(--bg-app)] text-[color:var(--text-primary)] font-sans">
          <MenuBar onMenuSelect={handleNodeSelect} activeNode={activeNode} onThemeSelect={setGlobalTheme} />

          <ActionToolBar
            onAddClick={handleAddClick}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={currentIndex > 0}
            canRedo={currentIndex < history.length - 1}
          />

          <div className="flex flex-1 overflow-hidden">
            <SidebarNavTree
              onNodeSelect={handleNodeSelect}
              onNodeDoubleClick={handleNodeDoubleClick}
              selectedNodeLabel={activeNode}
            />

            <div className="flex-1 flex flex-col overflow-hidden border-l border-[color:var(--border-subtle)]">
              {/* Breadcrumb / context bar */}
              <div className="h-8 bg-[color:var(--bg-surface-2)] border-b border-[color:var(--border-subtle)] flex items-center px-3 gap-4 text-[11px] text-[color:var(--text-muted)]">
                <div className="flex items-center gap-1.5 text-[color:var(--text-primary)] font-medium">
                  <Network size={12} className="text-[color:var(--text-muted)]" />
                  <span>{activeNode === 'Groups' ? 'Groups (127)' : activeNode}</span>
                </div>
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

          {/* Status bar */}
          <footer className="h-7 bg-[color:var(--bg-surface-2)] border-t border-[color:var(--border-subtle)] flex items-center px-3 justify-between select-none text-[11px] text-[color:var(--text-secondary)]">
            <div className="flex items-center gap-2">
              <StatusDot tone="success" />
              <span className="font-medium">Connected to HEXY-PROD-01</span>
            </div>
            <div className="flex items-center gap-4 text-[color:var(--text-muted)] font-mono tracking-tight">
              <span>CAP</span>
              <span>NUM</span>
              <span>SCRL</span>
              <span className="tabular-nums text-[color:var(--text-primary)]">18:42:05</span>
            </div>
          </footer>

          <ToastViewport />
        </div>
      </ToastProvider>
    </TooltipProvider>
  );
};

export default App;
