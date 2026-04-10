import React, { useState, useEffect } from 'react';
import { ManagerService } from '../../services/manager.service';
import { Plus, Trash2, Settings, X, ChevronRight } from 'lucide-react';
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

  // Schedule panel state
  const [selectedRow, setSelectedRow] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const fetchLeverages = async () => {
    setLoading(true);
    try {
      const res = await ManagerService.getDynamicLeverageList();
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

  useEffect(() => { fetchLeverages(); }, []);

  const handleRowClick = async (row) => {
    const id = row.rule_id || row.id;
    if (!id) return;
    setSelectedRow(row);
    setSchedule([]);
    setScheduleLoading(true);
    try {
      const res = await ManagerService.getLeverageScheduleList(id);
      setSchedule(Array.isArray(res) ? res : res?.schedules ?? []);
    } catch (err) {
      setSchedule([]);
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleContextMenu = (e, record) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, selectedRecord: record });
  };

  const handleCloseContextMenu = () => setContextMenu({ visible: false });

  const handleDelete = async () => {
    if (!contextMenu.selectedRecord) return;
    const deletionId = contextMenu.selectedRecord.rule_id || contextMenu.selectedRecord.id;
    if (window.confirm(`Delete Leverage Rule "${deletionId}" for group "${contextMenu.selectedRecord.group_name}"?`)) {
      try {
        await ManagerService.deleteDynamicLeverage(deletionId);
        if (selectedRow?.rule_id === deletionId || selectedRow?.id === deletionId) {
          setSelectedRow(null);
          setSchedule([]);
        }
        fetchLeverages();
      } catch (err) {
        alert('Failed: ' + (err.response?.data?.message || err.message));
      }
    }
    handleCloseContextMenu();
  };

  const scheduleOpen = !!selectedRow;

  return (
    <div className="flex-1 bg-[#1e1e1e] flex flex-col overflow-hidden relative" onClick={handleCloseContextMenu} onContextMenu={(e) => e.preventDefault()}>

      {/* Top Action Bar */}
      <div className="flex items-center px-2 py-1.5 bg-[#252526] border-b border-black/40 shrink-0 select-none">
        <button
          onClick={() => setIsAddPopupOpen(true)}
          className="flex items-center gap-1.5 h-[24px] px-3 bg-[#007acc] hover:bg-[#0098ff] text-white text-[11px] rounded-[2px] transition-colors"
        >
          <Plus size={12} /> Add Leverage Rule
        </button>
        <div className="ml-auto flex items-center pr-2">
          <Settings size={14} className="text-[#999] hover:text-white cursor-pointer" />
        </div>
      </div>

      {/* Split layout: table + schedule panel */}
      <div className="flex flex-1 overflow-hidden">

        {/* Main Table */}
        <div className={`flex flex-col overflow-hidden ${scheduleOpen ? 'flex-1' : 'flex-1'}`}>
          {/* Grid Header */}
          <div className="flex bg-[#333333] border-b border-black/40 shadow-sm sticky top-0 z-10 select-none shrink-0">
            <div className="w-[80px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">ID</div>
            <div className="w-[70px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Enabled</div>
            <div className="w-[180px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Group Name</div>
            <div className="w-[120px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Symbol</div>
            <div className="w-[80px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Priority</div>
            <div className="w-[100px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Leverage</div>
            <div className="w-[100px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Margin Rate</div>
            <div className="w-[100px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Vol From</div>
            <div className="w-[100px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0">Vol To</div>
            <div className="flex-1 px-3 py-1.5 bg-[#333333]"></div>
          </div>

          {/* Table Body */}
          <div className="flex-1 overflow-auto no-scrollbar bg-[#1e1e1e]">
            {data.map((row, idx) => {
              const rowId = row.rule_id || row.id;
              const isSelected = (selectedRow?.rule_id || selectedRow?.id) === rowId;
              return (
                <div
                  key={rowId || idx}
                  onClick={(e) => { e.stopPropagation(); handleRowClick(row); }}
                  onContextMenu={(e) => handleContextMenu(e, row)}
                  className={`flex cursor-pointer border-b border-black/10 transition-colors
                    ${isSelected ? 'bg-[#094771] border-l-2 border-l-[#007acc]' : idx % 2 === 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'}
                    hover:bg-blue-600/20`}
                >
                  <div className="w-[80px] px-3 py-1 text-[12px] flex items-center gap-2 border-r border-black/10 shrink-0">
                    <HashIcon />
                    <span className="text-[#e1e1e1] font-medium truncate">{rowId || '-'}</span>
                  </div>
                  <div className="w-[70px] px-3 py-1 text-[12px] border-r border-black/10 shrink-0 flex items-center">
                    <span className={`text-[11px] font-semibold ${row.enabled ? 'text-[#4ec9b0]' : 'text-[#f48771]'}`}>
                      {row.enabled ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="w-[180px] px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate flex items-center">{row.group_name}</div>
                  <div className="w-[120px] px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate flex items-center">{row.symbol}</div>
                  <div className="w-[80px] px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate flex items-center">{row.priority}</div>
                  <div className="w-[100px] px-3 py-1 text-[12px] text-[#9cdcfe] font-semibold border-r border-black/10 shrink-0 truncate flex items-center">{row.leverage}</div>
                  <div className="w-[100px] px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate flex items-center">{row.margin_rate}</div>
                  <div className="w-[100px] px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate flex items-center">{row.volume_from}</div>
                  <div className="w-[100px] px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 truncate flex items-center">{row.volume_to}</div>
                  <div className="flex-1 flex items-center justify-end pr-2">
                    {isSelected && <ChevronRight size={12} className="text-[#007acc]" />}
                  </div>
                </div>
              );
            })}

            {loading && <div className="p-4 text-[#aaaaaa] text-[12px] italic">Loading leverages...</div>}
            {!loading && data.length === 0 && <div className="p-4 text-[#aaaaaa] text-[12px] italic">No dynamic leverages found.</div>}

            {[...Array(20)].map((_, i) => (
              <div key={`empty-${i}`} className={`flex border-b border-black/5 opacity-40 ${i % 2 !== 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'}`}>
                <div className="w-full h-6 border-r border-black/10"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Schedule Panel */}
        {scheduleOpen && (
          <div className="w-[340px] flex flex-col border-l border-black/40 bg-[#1e1e1e] shrink-0">
            {/* Panel Header */}
            <div className="flex items-center px-3 h-[30px] bg-[#252526] border-b border-black/40 shrink-0">
              <span className="text-[11px] font-semibold text-[#9cdcfe] flex-1 truncate">
                Schedule — {selectedRow.group_name || selectedRow.rule_id || selectedRow.id}
              </span>
              <button onClick={() => { setSelectedRow(null); setSchedule([]); }}
                className="text-[#555] hover:text-[#ccc] transition-colors">
                <X size={13} />
              </button>
            </div>

            {/* Rule summary */}
            <div className="px-3 py-2 border-b border-black/30 bg-[#252526] shrink-0">
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {[
                  ['ID', selectedRow.id || selectedRow.rule_id],
                  ['Enabled', selectedRow.enabled ? 'Yes' : 'No'],
                  ['Symbol', selectedRow.symbol],
                  ['Group', selectedRow.group_name],
                  ['Leverage', selectedRow.leverage],
                  ['Margin Rate', selectedRow.margin_rate],
                  ['Vol From', selectedRow.volume_from],
                  ['Vol To', selectedRow.volume_to],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center h-[18px]">
                    <span className="text-[10px] text-[#555] w-20 shrink-0">{k}</span>
                    <span className="text-[10px] font-mono text-[#e1e1e1]">{v ?? '—'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Schedule list header */}
            <div className="flex items-center px-3 h-[24px] bg-[#252526] border-b border-black/30 shrink-0">
              {[['From','flex-1'],['To','flex-1'],['Leverage','w-20']].map(([l,w]) => (
                <div key={l} className={`${w} text-[10px] font-semibold text-[#888] uppercase tracking-wider pr-2`}>{l}</div>
              ))}
            </div>

            {/* Schedule rows */}
            <div className="flex-1 overflow-auto">
              {scheduleLoading && (
                <div className="flex items-center justify-center h-16 text-[#888] text-[11px]">Loading…</div>
              )}
              {!scheduleLoading && schedule.length === 0 && (
                <div className="flex items-center justify-center h-16 text-[#555] text-[11px]">No schedule entries.</div>
              )}
              {!scheduleLoading && schedule.map((s, i) => (
                <div key={i} className={`flex items-center px-3 h-[22px] border-b border-black/20 ${i % 2 === 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'}`}>
                  <div className="flex-1 text-[11px] text-[#e1e1e1] pr-2 font-mono truncate">{s.from ?? s.time_from ?? s.start ?? '—'}</div>
                  <div className="flex-1 text-[11px] text-[#e1e1e1] pr-2 font-mono truncate">{s.to ?? s.time_to ?? s.end ?? '—'}</div>
                  <div className="w-20 text-[11px] text-[#9cdcfe] font-semibold font-mono">{s.leverage ?? '—'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {isAddPopupOpen && (
        <CreateLeveragePopup onClose={() => setIsAddPopupOpen(false)} onCreated={fetchLeverages} />
      )}

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed z-[9999] bg-[#2d2d30] border border-[#3e3e42] shadow-2xl py-1 min-w-[200px] text-[12px] text-[#cccccc] font-sans rounded-[2px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-6 py-1 hover:bg-[#007acc] hover:text-white cursor-pointer select-none" onClick={() => { setIsAddPopupOpen(true); handleCloseContextMenu(); }}>Add Rule</div>
          <div className="h-[1px] bg-[#3e3e42] my-1 mx-2"></div>
          <div className="px-6 py-1 hover:bg-[#e51400] hover:text-white cursor-pointer select-none text-red-400" onClick={handleDelete}>Delete</div>
        </div>
      )}

      {/* Bottom Status Bar */}
      <div className="h-6 bg-[#007acc] text-white flex items-center px-4 text-[11px] select-none shrink-0 border-t border-[#005a9e]">
        <span>Total Leverage Rules: {data.length}</span>
        {selectedRow && (
          <span className="ml-4 opacity-70">
            Selected: {selectedRow.group_name || selectedRow.rule_id || selectedRow.id}
          </span>
        )}
      </div>
    </div>
  );
};

export default LeveragesView;
