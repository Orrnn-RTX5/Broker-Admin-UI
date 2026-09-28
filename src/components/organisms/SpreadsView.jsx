import React, { useState } from 'react';
import { ManagerService } from '../../services/manager.service';
import { Plus, Search } from 'lucide-react';
import CreateSpreadSchedulePopup from '../popups/CreateSpreadSchedulePopup';
import LpSymbolDatalist from '../atoms/LpSymbolDatalist';
import { getApiErrorMessage } from '../../utils/apiShapes';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SpreadsView = () => {
  const [symbol, setSymbol] = useState('');
  const [searchedSymbol, setSearchedSymbol] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [isAddPopupOpen, setIsAddPopupOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState({ visible: false });

  const fetchSchedules = async (sym) => {
    setLoading(true);
    setError('');
    setData([]);
    try {
      const res = await ManagerService.getSpreadScheduleList(sym);
      if (Array.isArray(res)) setData(res);
      else if (res?.data && Array.isArray(res.data)) setData(res.data);
      else setData([]);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to load spread schedules.'));
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!symbol.trim()) return;
    setSearchedSymbol(symbol.trim());
    setSearched(true);
    fetchSchedules(symbol.trim());
  };

  const handleContextMenu = (e, row) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, row });
  };

  const handleDelete = async () => {
    if (!contextMenu.row) return;
    const id = contextMenu.row.id;
    if (window.confirm(`Delete spread schedule ID ${id}?`)) {
      try {
        await ManagerService.deleteSpreadSchedule(id);
        fetchSchedules(searchedSymbol);
      } catch (err) {
        alert('Failed to delete: ' + (err.response?.data?.error || err.message));
      }
    }
    setContextMenu({ visible: false });
  };

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden relative"
      onClick={() => setContextMenu({ visible: false })}
      onContextMenu={(e) => e.preventDefault()}>

      {/* Top Bar */}
      <div className="flex items-center gap-3 overflow-x-auto px-3 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
        <button type="button" onClick={() => setIsAddPopupOpen(true)}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap h-[24px] px-3 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] transition-colors">
          <Plus size={12} /> Add Schedule
        </button>

        <form onSubmit={handleSearch} className="flex shrink-0 items-center gap-2 sm:ml-2">
          <div className="flex border border-[#555] bg-[color:var(--bg-app)] h-[22px] items-center rounded-[2px] w-[160px] sm:w-[200px]">
            <div className="px-1.5"><Search size={11} className="text-white" /></div>
            <input type="text" aria-label="Symbol for spread schedules" value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="Filter by symbol…"
              list="spreads-symbol-options" autoComplete="off"
              className="bg-transparent outline-none w-full text-[11px] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] h-full" />
            <LpSymbolDatalist id="spreads-symbol-options" />
          </div>
          <button type="submit" className="h-[22px] px-3 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-white text-[11px] rounded-[2px] transition-colors">
            Load
          </button>
        </form>

        {searchedSymbol && <span className="text-[11px] text-white">Showing: <strong className="text-white">{searchedSymbol}</strong></span>}

      </div>

      {/* Grid Header */}
      <div className="flex bg-[#333] border-b border-black/40 select-none shrink-0">
        <div className="w-[60px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20">ID</div>
        <div className="w-[100px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20">Symbol</div>
        <div className="w-[100px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20">Group</div>
        <div className="w-[100px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20">Day</div>
        <div className="w-[100px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20">From</div>
        <div className="w-[100px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20">To</div>
        <div className="w-[120px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20">Spread Override</div>
        <div className="flex-1"></div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto bg-[color:var(--bg-app)]">
        {!searched && (
          <div role="status" className="m-4 w-fit rounded-[4px] border border-[color:var(--border-default)] bg-[color:var(--bg-surface-1)] px-4 py-3 text-[12px] text-[color:var(--text-secondary)]">
            Search a symbol to load its spread schedules.
          </div>
        )}

        {searched && loading && <div role="status" className="m-4 w-fit rounded-[4px] border border-[color:var(--border-default)] bg-[color:var(--bg-surface-1)] px-4 py-3 text-[12px] text-[color:var(--text-secondary)]">Loading spread schedules...</div>}

        {searched && !loading && error && <div role="alert" className="m-4 w-fit rounded-[4px] border border-[color:var(--danger-500)]/30 bg-[color:var(--danger-500)]/10 px-4 py-3 text-[12px] text-[color:var(--danger-500)]">{error}</div>}

        {searched && !loading && !error && data.length === 0 && (
          <div role="status" className="m-4 w-fit rounded-[4px] border border-[color:var(--border-default)] bg-[color:var(--bg-surface-1)] px-4 py-3 text-[12px] text-[color:var(--text-secondary)]">No spread schedules found for <strong className="text-[color:var(--text-primary)]">{searchedSymbol}</strong>.</div>
        )}

        {data.map((row, idx) => (
          <div key={row.id || idx} onContextMenu={e => handleContextMenu(e, row)}
            className={`flex cursor-default border-b border-black/10 transition-colors hover:bg-blue-600/20 ${idx % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'}`}>
            <div className="w-[60px] px-3 py-1 text-[12px] text-[color:var(--text-primary)] border-r border-black/10">{row.id}</div>
            <div className="w-[100px] px-3 py-1 text-[12px] text-white border-r border-black/10 truncate">{row.symbol}</div>
            <div className="w-[100px] px-3 py-1 text-[12px] text-white border-r border-black/10 truncate">{row.group_name}</div>
            <div className="w-[100px] px-3 py-1 text-[12px] text-white border-r border-black/10">{DAY_LABELS[row.day_of_week] ?? row.day_of_week}</div>
            <div className="w-[100px] px-3 py-1 text-[12px] text-white border-r border-black/10">{row.time_from}</div>
            <div className="w-[100px] px-3 py-1 text-[12px] text-white border-r border-black/10">{row.time_to}</div>
            <div className="w-[120px] px-3 py-1 text-[12px] text-white border-r border-black/10">{row.spread_override}</div>
            <div className="flex-1"></div>
          </div>
        ))}

      </div>

      {/* Status Bar */}
      <div className="h-7 border-t border-[color:var(--border-default)] bg-[color:var(--bg-surface-1)] text-[color:var(--text-secondary)] flex items-center px-4 text-[11px] select-none shrink-0">
        <span>Spread Schedules: <strong className="tabular-nums text-[color:var(--text-primary)]">{data.length}</strong>{searchedSymbol ? ` for ${searchedSymbol}` : ''}</span>
      </div>

      {isAddPopupOpen && (
        <CreateSpreadSchedulePopup
          onClose={() => setIsAddPopupOpen(false)}
          onCreated={() => searchedSymbol && fetchSchedules(searchedSymbol)}
        />
      )}

      {contextMenu.visible && (
        <div className="fixed z-[9999] bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] shadow-2xl py-1 min-w-[180px] text-[12px] text-[color:var(--text-secondary)] rounded-[2px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}>
          <div className="px-5 py-1 hover:bg-[color:var(--accent-500)] hover:text-white cursor-pointer select-none"
            onClick={() => { setIsAddPopupOpen(true); setContextMenu({ visible: false }); }}>Add Schedule</div>
          <div className="h-[1px] bg-[color:var(--border-default)] my-1 mx-2"></div>
          <div className="px-5 py-1 hover:bg-red-600 hover:text-white cursor-pointer select-none text-red-400"
            onClick={handleDelete}>Delete</div>
        </div>
      )}
    </div>
  );
};

export default SpreadsView;
