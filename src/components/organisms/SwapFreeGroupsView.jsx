import React, { useState, useEffect } from 'react';
import { ManagerService } from '../../services/manager.service';
import { Plus, Trash2, Settings } from 'lucide-react';
import AddSwapFreeGroupPopup from '../RIGHTCLICKJPOPUPS/AddSwapFreeGroupPopup';

const GearIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#21BA45" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const SwapFreeGroupsView = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddPopupOpen, setIsAddPopupOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState({ visible: false });

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await ManagerService.getSwapFreeGroups();
      setData(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to fetch swap free groups', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleContextMenu = (e, record) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      selectedRecord: record
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({ visible: false });
  };

  const handleDelete = async () => {
    if (!contextMenu.selectedRecord) return;
    
    if (window.confirm(`Are you sure you want to delete Swap-Free config for group "${contextMenu.selectedRecord.group_name}"?`)) {
      try {
        await ManagerService.deleteSwapFreeGroup(contextMenu.selectedRecord.id);
        fetchGroups();
      } catch (err) {
        alert('Failed to delete config: ' + (err.response?.data?.message || err.message));
      }
    }
    handleCloseContextMenu();
  };

  return (
    <div className="flex-1 bg-[#1e1e1e] flex flex-col overflow-hidden relative" onClick={handleCloseContextMenu} onContextMenu={(e) => e.preventDefault()}>
      
      {/* Top Action Bar */}
      <div className="flex items-center px-2 py-1.5 bg-[#252526] border-b border-black/40 shrink-0 select-none">
        <button 
          onClick={() => setIsAddPopupOpen(true)}
          className="flex items-center gap-1.5 h-[24px] px-3 bg-[#007acc] hover:bg-[#0098ff] text-white text-[11px] rounded-[2px] transition-colors"
        >
          <Plus size={12} />
          Add Config
        </button>
        <div className="ml-auto flex items-center pr-2">
          <Settings size={14} className="text-[#999] hover:text-white cursor-pointer" />
        </div>
      </div>

      {/* Grid Header */}
      <div className="flex bg-[#333333] border-b border-black/40 shadow-sm sticky top-0 z-10 select-none">
        <div className="w-[180px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Group Name</div>
        <div className="w-[140px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Symbol Pattern</div>
        <div className="w-[120px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Swap Free</div>
        <div className="w-[120px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Charge Fee</div>
        <div className="w-[120px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Fee per Lot</div>
        <div className="w-[140px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Max Holding Days</div>
        <div className="flex-1 px-3 py-1.5 bg-[#333333]"></div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto no-scrollbar bg-[#1e1e1e]">
        {data.map((row, idx) => (
          <div 
            key={row.id} 
            onContextMenu={(e) => handleContextMenu(e, row)}
            className={`flex cursor-default group border-b border-black/10 transition-colors ${idx % 2 === 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'} hover:bg-blue-600/20`}
          >
            <div className="w-[180px] px-3 py-1 text-[12px] flex items-center gap-2 border-r border-black/10 shrink-0">
              <GearIcon />
              <span className="text-[#e1e1e1] font-medium truncate">{row.group_name}</span>
            </div>
            <div className="w-[140px] px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate">{row.symbol_pattern}</div>
            <div className="w-[120px] px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate">{row.swap_free ? 'Yes' : 'No'}</div>
            <div className="w-[120px] px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate">{row.charge_fee ? 'Yes' : 'No'}</div>
            <div className="w-[120px] px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate">{row.fee_per_lot > 0 ? row.fee_per_lot : '-'}</div>
            <div className="w-[140px] px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate">{row.max_holding_days === 0 ? 'Unlimited' : row.max_holding_days}</div>
            <div className="flex-1 border-b border-white/5 bg-transparent"></div>
          </div>
        ))}

        {loading && (
          <div className="p-4 text-[#aaaaaa] text-[12px] italic">Loading configs...</div>
        )}
        
        {!loading && data.length === 0 && (
          <div className="p-4 text-[#aaaaaa] text-[12px] italic">No swap-free configurations found.</div>
        )}

        {/* Empty Fill */}
        {[...Array(30)].map((_, i) => (
           <div key={`empty-${i}`} className={`flex border-b border-black/5 opacity-40 ${i % 2 !== 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'}`}>
              <div className="w-full h-6 border-r border-black/10"></div>
           </div>
        ))}
      </div>

      {isAddPopupOpen && (
        <AddSwapFreeGroupPopup 
          onClose={() => setIsAddPopupOpen(false)} 
          onCreated={fetchGroups} 
        />
      )}

      {/* Context Menu */}
      {contextMenu.visible && (
        <div 
          className="fixed z-[9999] bg-[#2d2d30] border border-[#3e3e42] shadow-2xl py-1 min-w-[200px] text-[12px] text-[#cccccc] font-sans rounded-[2px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="px-6 py-1 hover:bg-[#007acc] hover:text-white cursor-pointer select-none" onClick={() => setIsAddPopupOpen(true)}>Add Config</div>
          <div className="h-[1px] bg-[#3e3e42] my-1 mx-2"></div>
          <div 
            className="px-6 py-1 hover:bg-[#007acc] hover:text-white cursor-pointer select-none text-red-400 hover:text-white"
            onClick={handleDelete}
          >
            Delete
          </div>
        </div>
      )}
      
      {/* Bottom Status Bar */}
      <div className="h-6 bg-[#007acc] text-white flex items-center px-4 text-[11px] select-none shrink-0 border-t border-[#005a9e]">
        <span>Total Swap-Free Configs: {data.length}</span>
      </div>
    </div>
  );
};

export default SwapFreeGroupsView;
