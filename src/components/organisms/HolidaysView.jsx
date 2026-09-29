import React, { useState, useEffect } from 'react';
import { ManagerService } from '../../services/manager.service';
import { Plus, Settings, Calendar } from 'lucide-react';
import CreateHolidayPopup from '../popups/CreateHolidayPopup';

const CalendarIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

const HolidaysView = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddPopupOpen, setIsAddPopupOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState({ visible: false });

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const res = await ManagerService.getHolidayList();
      if (Array.isArray(res)) setData(res);
      else if (res && Array.isArray(res.data)) setData(res.data);
      else if (res && Array.isArray(res.holidays)) setData(res.holidays);
      else setData([]);
    } catch (err) {
      console.error('Failed to fetch holidays list', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
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
    
    const deletionId = contextMenu.selectedRecord.holiday_id || contextMenu.selectedRecord.id;
    
    if (window.confirm(`Are you sure you want to delete holiday "${contextMenu.selectedRecord.name}"?`)) {
      try {
        await ManagerService.deleteHoliday(deletionId);
        fetchHolidays();
      } catch (err) {
        alert('Failed to delete holiday: ' + (err.response?.data?.message || err.message));
      }
    }
    handleCloseContextMenu();
  };

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden relative" onClick={handleCloseContextMenu} onContextMenu={(e) => e.preventDefault()}>
      
      {/* Top Action Bar */}
      <div className="flex items-center px-2 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0 select-none">
        <button 
          onClick={() => setIsAddPopupOpen(true)}
          className="flex items-center gap-1.5 h-[24px] px-3 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] transition-colors"
        >
          <Plus size={12} />
          Add Holiday
        </button>
        <div className="ml-auto flex items-center pr-2">
          <Settings size={14} className="text-white hover:text-white cursor-pointer" />
        </div>
      </div>

      {/* Grid Header */}
      <div className="flex bg-[color:var(--bg-surface-2)] border-b border-black/40 shadow-sm sticky top-0 z-10 select-none">
        <div className="w-[100px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 shrink-0">ID</div>
        <div className="w-[200px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 shrink-0">Name</div>
        <div className="w-[120px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 shrink-0">Date</div>
        <div className="w-[120px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 shrink-0">Trading Allowed</div>
        <div className="w-[300px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 shrink-0">Symbols</div>
        <div className="flex-1 px-3 py-1.5 bg-[color:var(--bg-surface-2)]"></div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto no-scrollbar bg-[color:var(--bg-app)]">
        {data.map((row, idx) => (
          <div 
            key={row.holiday_id || row.id || idx} 
            onContextMenu={(e) => handleContextMenu(e, row)}
            className={`flex cursor-default group border-b border-black/10 transition-colors ${idx % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-blue-600/20`}
          >
            <div className="w-[100px] px-3 py-1 text-[12px] flex items-center gap-2 border-r border-black/10 shrink-0">
              <CalendarIcon />
              <span className="text-[color:var(--text-primary)] font-medium truncate">{row.holiday_id || row.id || '-'}</span>
            </div>
            <div className="w-[200px] px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate">{row.name}</div>
            <div className="w-[120px] px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate">{row.date}</div>
            <div className="w-[120px] px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate">{row.trading_allowed ? 'Yes' : 'No'}</div>
            <div className="w-[300px] px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate">
              {Array.isArray(row.symbols) ? row.symbols.join(', ') : row.symbols}
            </div>
            <div className="flex-1 border-b border-white/5 bg-transparent"></div>
          </div>
        ))}

        {loading && (
          <div className="p-4 text-[color:var(--text-muted)] text-[12px] italic">Loading holidays...</div>
        )}
        
        {!loading && data.length === 0 && (
          <div className="p-4 text-[color:var(--text-muted)] text-[12px] italic">No holidays found.</div>
        )}

        {/* Empty Fill */}
        {[...Array(30)].map((_, i) => (
           <div key={`empty-${i}`} className={`flex border-b border-black/5 opacity-40 ${i % 2 !== 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'}`}>
              <div className="w-full h-6 border-r border-black/10"></div>
           </div>
        ))}
      </div>

      {isAddPopupOpen && (
        <CreateHolidayPopup 
          onClose={() => setIsAddPopupOpen(false)} 
          onCreated={fetchHolidays} 
        />
      )}

      {/* Context Menu */}
      {contextMenu.visible && (
        <div 
          className="fixed z-[9999] bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] shadow-2xl py-1 min-w-[200px] text-[12px] text-[color:var(--text-secondary)] font-sans rounded-[2px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="px-6 py-1 hover:bg-[color:var(--accent-500)] hover:text-white cursor-pointer select-none" onClick={() => setIsAddPopupOpen(true)}>Add Holiday</div>
          <div className="h-[1px] bg-[color:var(--border-default)] my-1 mx-2"></div>
          <div 
            className="px-6 py-1 hover:bg-[color:var(--accent-500)] hover:text-white cursor-pointer select-none text-red-400 hover:text-white"
            onClick={handleDelete}
          >
            Delete
          </div>
        </div>
      )}
      
      {/* Bottom Status Bar */}
      <div className="h-6 bg-[color:var(--accent-500)] text-white flex items-center px-4 text-[11px] select-none shrink-0 border-t border-[color:var(--accent-700)]">
        <span>Total Holidays: {data.length}</span>
      </div>
    </div>
  );
};

export default HolidaysView;
