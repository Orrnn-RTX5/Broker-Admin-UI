import React from 'react';
import MenuBar from './components/organisms/MenuBar';
import ActionToolBar from './components/organisms/ActionToolBar';
import SidebarNavTree from './components/organisms/SidebarNavTree';
import AdminDataTable from './components/organisms/AdminDataTable';
import GroupPropertiesPopup from './components/RIGHTCLICKJPOPUPS/GroupPropertiesPopup';
import { Network, Activity, Globe } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

const App = () => {
  const [selectedGroup, setSelectedGroup] = React.useState(null);
  const [isPopupOpen, setIsPopupOpen] = React.useState(false);
  const [activeNode, setActiveNode] = React.useState('Groups');
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
    setSelectedGroup(group);
    setIsPopupOpen(true);
  };

  const handleNodeSelect = (nodeOrLabel) => {
    const label = typeof nodeOrLabel === 'string' ? nodeOrLabel : nodeOrLabel.label;
    setActiveNode(label);
  };

  const handleAddClick = () => {
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
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#1e1e1e] text-[#d1d1d1] selection:bg-blue-500/30">
        {/* Top Menu Bar */}
        <MenuBar onMenuSelect={handleNodeSelect} activeNode={activeNode} onThemeSelect={setGlobalTheme} />

      {/* Main Action Toolbar */}
      <ActionToolBar onAddClick={handleAddClick} />

      {/* Main Content Area: Sidebar + Data Workspace */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Navigation Sidebar (LEFT SIDE) */}
        <SidebarNavTree 
          onNodeSelect={handleNodeSelect} 
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
          />
        </div>
      </div>

      {/* Popups Overlay */}
      <AnimatePresence>
        {isPopupOpen && (
          <GroupPropertiesPopup 
            group={selectedGroup} 
            onClose={() => setIsPopupOpen(false)} 
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
