import React, { useState, useEffect } from 'react';
import { ManagerService } from '../../services/manager.service';
import { Plus, Trash2, Settings, Hash } from 'lucide-react';
import CreateLeveragePopup from '../popups/CreateLeveragePopup';

const HashIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="4" y1="9" x2="20" y2="9"></line>
    <line x1="4" y1="15" x2="20" y2="15"></line>
    <line x1="10" y1="3" x2="8" y2="21"></line>
    <line x1="16" y1="3" x2="14" y2="21"></line>
  </svg>
);

const LeveragesView = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddPopupOpen, setIsAddPopupOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState({ visible: false });

  const fetchLeverages = async () => {
    setLoading(true);
    try {
      const res = await ManagerService.getDynamicLeverageList();
      // Adjust according to how backend wraps list requests
      if (Array.isArray(res)) setData(res);
      else if (res && Array.isArray(res.data)) setData(res.data);
      else if (res && Array.isArray(res.leverages)) setData(res.leverages);
      else setData([]);
    } catch (err) {
      console.error('Failed to fetch leverages list', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeverages();
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
    
    // The curl schema mentions rule_id. If backend returns rule_id or id, we map appropriately
    const deletionId = contextMenu.selectedRecord.rule_id || contextMenu.selectedRecord.id;
    
    if (window.confirm(`Are you sure you want to delete Leverage Rule ID "${deletionId}" for group "${contextMenu.selectedRecord.group_name}"?`)) {
      try {
        await ManagerService.deleteDynamicLeverage(deletionId);
        fetchLeverages();
      } catch (err) {
        alert('Failed to delete rule: ' + (err.response?.data?.message || err.message));
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
          Add Leverage Rule
        </button>
        <div className="ml-auto flex items-center pr-2">
          <Settings size={14} className="text-[#999] hover:text-white cursor-pointer" />
        </div>
      </div>

      {/* Grid Header */}
      <div className="flex bg-[#333333] border-b border-black/40 shadow-sm sticky top-0 z-10 select-none">
        <div className="w-[100px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Rule ID</div>
        <div className="w-[180px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Group Name</div>
        <div className="w-[120px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Symbol</div>
        <div className="w-[100px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Priority</div>
        <div className="w-[120px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Leverage</div>
        <div className="w-[120px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Margin Rate</div>
        <div className="w-[120px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Volume From</div>
        <div className="w-[120px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Volume To</div>
        <div className="flex-1 px-3 py-1.5 bg-[#333333]"></div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto no-scrollbar bg-[#1e1e1e]">
        {data.map((row, idx) => (
          <div 
            key={row.rule_id || row.id || idx} 
            onContextMenu={(e) => handleContextMenu(e, row)}
            className={`flex cursor-default group border-b border-black/10 transition-colors ${idx % 2 === 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'} hover:bg-blue-600/20`}
          >
            <div className="w-[100px] px-3 py-1 text-[12px] flex items-center gap-2 border-r border-black/10 shrink-0">
              <HashIcon />
              <span className="text-[#e1e1e1] font-medium truncate">{row.rule_id || row.id || '-'}</span>
            </div>
            <div className="w-[180px] px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate">{row.group_name}</div>
            <div className="w-[120px] px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate">{row.symbol}</div>
            <div className="w-[100px] px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate">{row.priority}</div>
            <div className="w-[120px] px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate">{row.leverage}</div>
            <div className="w-[120px] px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate">{row.margin_rate}</div>
            <div className="w-[120px] px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate">{row.volume_from}</div>
            <div className="w-[120px] px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate">{row.volume_to}</div>
            <div className="flex-1 border-b border-white/5 bg-transparent"></div>
          </div>
        ))}

        {loading && (
          <div className="p-4 text-[#aaaaaa] text-[12px] italic">Loading leverages...</div>
        )}
        
        {!loading && data.length === 0 && (
          <div className="p-4 text-[#aaaaaa] text-[12px] italic">No dynamic leverages found.</div>
        )}

        {/* Empty Fill */}
        {[...Array(30)].map((_, i) => (
           <div key={`empty-${i}`} className={`flex border-b border-black/5 opacity-40 ${i % 2 !== 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'}`}>
              <div className="w-full h-6 border-r border-black/10"></div>
           </div>
        ))}
      </div>

      {isAddPopupOpen && (
        <CreateLeveragePopup 
          onClose={() => setIsAddPopupOpen(false)} 
          onCreated={fetchLeverages} 
        />
      )}

      {/* Context Menu */}
      {contextMenu.visible && (
        <div 
          className="fixed z-[9999] bg-[#2d2d30] border border-[#3e3e42] shadow-2xl py-1 min-w-[200px] text-[12px] text-[#cccccc] font-sans rounded-[2px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="px-6 py-1 hover:bg-[#007acc] hover:text-white cursor-pointer select-none" onClick={() => setIsAddPopupOpen(true)}>Add Rule</div>
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
        <span>Total Leverage Rules: {data.length}</span>
      </div>
    </div>
  );
};

export default LeveragesView;
