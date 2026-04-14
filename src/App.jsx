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
import { Network, Activity, Globe } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

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
  
  const [globalTheme, setGlobalTheme] = React.useState('dark');
  const [isLightMode, setIsLightMode] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const applyTheme = () => {
      if (globalTheme === 'light') setIsLightMode(true);
      else if (globalTheme === 'dark') setIsLightMode(false);
      else setIsLightMode(!mediaQuery.matches);
    };

    applyTheme();

    const handler = () => { if (globalTheme === 'system') applyTheme(); };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [globalTheme]);

  const handleRowDoubleClick = (group) => {
    // If double-clicking a row inside the Payments directory, navigate to that page instead of opening a popup
    if (activeNode === 'Payments' || activeNode === 'Clients & Accounts' || activeNode === 'Orders & Deals') {
      if (group.name) {
        handleNodeSelect(group.name);
      }
      return;
    }
    
    setSelectedGroup(group);
    setIsPopupOpen(true);
  };

  const [serverTargetTab, setServerTargetTab] = React.useState(null);

  const handleNodeSelect = (nodeOrLabel) => {
    let label = typeof nodeOrLabel === 'string' ? nodeOrLabel : nodeOrLabel.label;
    
    if (label === 'Local Main Status Server' || label === 'Local Main Backup Server') {
      label = 'Main Trade Server';
      setServerTargetTab('Status');
    } else {
      setServerTargetTab(null);
    }

    if (label === activeNode) return;
    
    // Create new history array, clipping any "forward" paths if we've undone beforehand
    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push(label);
    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  };

  const handleNodeDoubleClick = (node) => {
    const label = typeof node === 'string' ? node : node.label;
    if (['Main Trade Server', 'History Server', 'MainTrade Backup Server', 'Local Main Status Server', 'Local Main Backup Server', 'TradeProcessor SQL_E', 'History Backup Server', 'Access Server'].includes(label)) {
      setServerPopupData({
        isOpen: true,
        target: label,
        id: Math.floor(Math.random() * 10) + 1
      });
    }
  };

  const handleUndo = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const handleRedo = () => {
    if (currentIndex < history.length - 1) setCurrentIndex(currentIndex + 1);
  };

  const handleAddClick = () => {
    if (activeNode === 'Groups') {
      setIsCreatingGroup(true);
      return;
    }
    setSelectedGroup({ group: 'New Group\\Demo' });
    setIsPopupOpen(true);
  };

  return (
    <>
      {isLightMode && (
        <style>{`
          body,
          .bg-\\[\\#1e1e1e\\] { background-color: #ffffff !important; }
          .bg-\\[\\#252526\\] { background-color: #f5f6f7 !important; }
          .bg-\\[\\#333333\\] { background-color: #e1e3e5 !important; }
          .bg-\\[\\#3c3f41\\] { background-color: #eaebec !important; }
          .bg-\\[\\#2b2b2b\\] { background-color: #d1d5db !important; }
          .bg-\\[\\#3e3e42\\] { background-color: #e2e8f0 !important; }
          .bg-\\[\\#404040\\], .bg-\\[\\#444444\\], .bg-\\[\\#4a4a4a\\] { background-color: #cbd5e1 !important; }
          
          .text-\\[\\#d1d1d1\\], .text-\\[\\#e1e1e1\\], .text-\\[\\#cccccc\\], .text-white { color: #000000 !important; }
          .text-\\[\\#aaaaaa\\], .text-\\[\\#808080\\], .text-\\[\\#e0e0e0\\] { color: #4b5563 !important; }
          
          .border-black\\/40, .border-black\\/20, .border-black\\/10, .border-\\[\\#3e3e42\\] { border-color: rgba(0,0,0,0.15) !important; }
          .border-white\\/5 { border-color: rgba(0,0,0,0.05) !important; }
          
          /* Prevent override on active colored buttons */
          .bg-\\[\\#007acc\\] { background-color: #007acc !important; color: #ffffff !important; }
        `}</style>
      )}
      {!isAuthenticated && <LoginOverlay />}
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#1e1e1e] text-[#d1d1d1] selection:bg-blue-500/30">
        {/* Top Menu Bar */}
        <MenuBar onMenuSelect={handleNodeSelect} activeNode={activeNode} onThemeSelect={setGlobalTheme} />

      {/* Main Action Toolbar */}
      <ActionToolBar 
        onAddClick={handleAddClick} 
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={currentIndex > 0}
        canRedo={currentIndex < history.length - 1}
      />

      {/* Main Content Area: Sidebar + Data Workspace */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Navigation Sidebar (LEFT SIDE) */}
        <SidebarNavTree 
          onNodeSelect={handleNodeSelect} 
          onNodeDoubleClick={handleNodeDoubleClick}
          selectedNodeLabel={activeNode}
        />

        {/* Main Data Viewport (Center/Right) */}
        <div className="flex-1 flex flex-col overflow-hidden border-l border-black/40">
          {/* Breadcrumb Area (Simplified to match MT5) */}
          <div className="h-6 bg-[#333333] border-b border-black/40 flex items-center px-2 gap-4 text-[11px] text-[#a0a0a0]">
             <div className="flex items-center gap-1.5 text-[#e1e1e1] font-medium h-full px-2">
                <Network size={12} />
                <span>{activeNode === 'Groups' ? 'Groups (127)' : activeNode}</span>
             </div>
             <div className="flex items-center gap-1.5 hover:text-[#d1d1d1] cursor-default h-full px-2 ml-auto">
                <Globe size={12} />
                <span className="text-blue-400 font-mono tracking-tighter">4482 / 8 KB</span>
             </div>
          </div>

          {/* Table Area */}
          <AdminDataTable 
            onRowDoubleClick={handleRowDoubleClick} 
            viewType={activeNode}
            onAddClick={handleAddClick}
            initialServerTab={serverTargetTab}
            refreshTrigger={refreshKey}
          />
        </div>
      </div>

      {/* Popups Overlay */}
      <AnimatePresence>
        {isPopupOpen && activeNode === 'Managers' && (
          <ManagerPropertiesPopup 
            manager={selectedGroup} 
            onClose={() => setIsPopupOpen(false)} 
          />
        )}
        {isPopupOpen && activeNode !== 'Managers' && (
          <GroupPropertiesPopup 
            group={selectedGroup} 
            onClose={() => setIsPopupOpen(false)} 
            refreshGroups={() => setRefreshKey(prev => prev + 1)}
          />
        )}
        {isCreatingGroup && (
          <CreateGroupPopup 
            onClose={() => setIsCreatingGroup(false)} 
            onCreated={() => setRefreshKey(prev => prev + 1)}
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

      {/* System Taskbar / Footer */}
      <footer className="h-6 bg-[#007acc] flex items-center px-3 justify-between select-none z-50">
        <div className="flex items-center gap-3">
          <div className="text-[11px] text-white flex items-center gap-1.5 font-medium">
            <div className="w-2.5 h-2.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.7)] animate-pulse"></div>
            <span>Connected to HEXY-PROD-01</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[10px] text-white/90 font-mono tracking-tight">
          <span>CAP</span>
          <span>NUM</span>
          <span>SCRL</span>
          <div className="bg-white/15 px-3 h-4 flex items-center rounded-sm font-semibold tabular-nums">
            18:42:05
          </div>
        </div>
      </footer>
      </div>
    </>
  );
};

export default App;
