import React, { useState } from 'react';
import { ManagerService } from '../../services/manager.service';
import { Plus, Settings, Search, Clock } from 'lucide-react';
import CreateSessionOverridePopup from '../popups/CreateSessionOverridePopup';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SessionOverridesView = () => {
  const [symbol, setSymbol] = useState('');
  const [group, setGroup] = useState('default');
  const [searchedSymbol, setSearchedSymbol] = useState('');
  const [searchedGroup, setSearchedGroup] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [isAddPopupOpen, setIsAddPopupOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState({ visible: false });

  const fetchOverrides = async (sym, grp) => {
    setLoading(true);
    try {
      const res = await ManagerService.getSessionOverrideList(sym, grp);
      if (Array.isArray(res)) setData(res);
      else if (res?.data && Array.isArray(res.data)) setData(res.data);
      else setData([]);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!symbol.trim()) return;
    setSearchedSymbol(symbol.trim());
    setSearchedGroup(group.trim() || 'default');
    setSearched(true);
    fetchOverrides(symbol.trim(), group.trim() || 'default');
  };

  const handleContextMenu = (e, row) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, row });
  };

  const handleDelete = async () => {
    if (!contextMenu.row) return;
    const id = contextMenu.row.id;
    if (window.confirm(`Delete override ID ${id} (${DAY_LABELS[contextMenu.row.day_of_week]})?`)) {
      try {
        await ManagerService.deleteSessionOverride(id);
        fetchOverrides(searchedSymbol, searchedGroup);
      } catch (err) {
        alert('Failed to delete: ' + (err.response?.data?.error || err.message));
      }
    }
    setContextMenu({ visible: false });
  };

  return (
    <div className="flex-1 bg-[#1e1e1e] flex flex-col overflow-hidden relative"
      onClick={() => setContextMenu({ visible: false })}
      onContextMenu={(e) => e.preventDefault()}>

      {/* Top Bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-[#252526] border-b border-black/40 shrink-0 flex-wrap">
        <button
          onClick={() => searched && setIsAddPopupOpen(true)}
          disabled={!searched}
          title={!searched ? 'Search a symbol first' : ''}
          className="flex items-center gap-1.5 h-[24px] px-3 bg-[#007acc] hover:bg-[#0098ff] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] rounded-[2px] transition-colors">
          <Plus size={12} /> Add Override
        </button>

        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="flex border border-[#555] bg-[#1e1e1e] h-[22px] items-center rounded-[2px] w-[160px]">
            <div className="px-1.5"><Search size={11} className="text-[#888]" /></div>
            <input type="text" value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="Symbol (EURUSD)"
              className="bg-transparent outline-none w-full text-[11px] text-[#e1e1e1] placeholder:text-[#555] h-full" />
          </div>
          <div className="flex border border-[#555] bg-[#1e1e1e] h-[22px] items-center rounded-[2px] w-[120px]">
            <input type="text" value={group} onChange={e => setGroup(e.target.value)} placeholder="Group"
              className="bg-transparent outline-none w-full text-[11px] text-[#e1e1e1] placeholder:text-[#555] h-full px-2" />
          </div>
          <button type="submit" className="h-[22px] px-3 bg-[#3c3c3c] hover:bg-[#4a4a4a] text-[#ccc] text-[11px] rounded-[2px] transition-colors">
            Load
          </button>
        </form>

        {searchedSymbol && (
          <span className="text-[11px] text-[#888]">
            <strong className="text-white">{searchedSymbol}</strong> / <strong className="text-white">{searchedGroup}</strong>
          </span>
        )}

        <div className="ml-auto">
          <Settings size={14} className="text-[#999] hover:text-white cursor-pointer" />
        </div>
      </div>

      {/* Grid Header */}
      <div className="flex bg-[#333] border-b border-black/40 select-none shrink-0">
        <div className="w-[60px]  px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20">ID</div>
        <div className="w-[110px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20">Day</div>
        <div className="w-[90px]  px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20">Quote From</div>
        <div className="w-[90px]  px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20">Quote To</div>
        <div className="w-[90px]  px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20">Trade From</div>
        <div className="w-[90px]  px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20">Trade To</div>
        <div className="w-[80px]  px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20">Enabled</div>
        <div className="flex-1"></div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto bg-[#1e1e1e]">
        {!searched && (
          <div className="flex flex-col items-center justify-center h-full opacity-30 select-none">
            <Clock size={48} className="mb-3 text-[#888]" />
            <p className="text-[13px]">Enter a symbol and group to load session overrides</p>
          </div>
        )}

        {searched && loading && <div className="p-4 text-[#aaa] text-[12px] italic">Loading...</div>}

        {searched && !loading && data.length === 0 && (
          <div className="p-4 text-[#aaa] text-[12px] italic">
            No session overrides for <strong className="text-white">{searchedSymbol}</strong> / <strong className="text-white">{searchedGroup}</strong>.
          </div>
        )}

        {data.map((row, idx) => (
          <div key={row.id || idx} onContextMenu={e => handleContextMenu(e, row)}
            className={`flex cursor-default border-b border-black/10 transition-colors hover:bg-blue-600/20 ${idx % 2 === 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'}`}>
            <div className="w-[60px]  px-3 py-1 text-[12px] text-[#e1e1e1] border-r border-black/10">{row.id}</div>
            <div className="w-[110px] px-3 py-1 text-[12px] text-[#aaa] border-r border-black/10">{DAY_LABELS[row.day_of_week] ?? row.day_of_week}</div>
            <div className="w-[90px]  px-3 py-1 text-[12px] text-[#aaa] border-r border-black/10">{row.quote_from}</div>
            <div className="w-[90px]  px-3 py-1 text-[12px] text-[#aaa] border-r border-black/10">{row.quote_to}</div>
            <div className="w-[90px]  px-3 py-1 text-[12px] text-[#aaa] border-r border-black/10">{row.trade_from}</div>
            <div className="w-[90px]  px-3 py-1 text-[12px] text-[#aaa] border-r border-black/10">{row.trade_to}</div>
            <div className="w-[80px]  px-3 py-1 text-[12px] border-r border-black/10">
              <span className={row.enabled ? 'text-green-400' : 'text-[#888]'}>{row.enabled ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex-1"></div>
          </div>
        ))}

        {[...Array(20)].map((_, i) => (
          <div key={`e-${i}`} className={`flex border-b border-black/5 opacity-30 h-6 ${i % 2 !== 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'}`}></div>
        ))}
      </div>

      {/* Status Bar */}
      <div className="h-6 bg-[#007acc] text-white flex items-center px-4 text-[11px] select-none shrink-0">
        <span>Overrides: {data.length}{searchedSymbol ? ` · ${searchedSymbol} / ${searchedGroup}` : ''}</span>
      </div>

      {isAddPopupOpen && (
        <CreateSessionOverridePopup
          symbol={searchedSymbol}
          group={searchedGroup}
          existingOverrides={data}
          onClose={() => setIsAddPopupOpen(false)}
          onCreated={() => fetchOverrides(searchedSymbol, searchedGroup)}
        />
      )}

      {contextMenu.visible && (
        <div className="fixed z-[9999] bg-[#2d2d30] border border-[#3e3e42] shadow-2xl py-1 min-w-[180px] text-[12px] text-[#cccccc] rounded-[2px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}>
          <div className="px-5 py-1 hover:bg-[#007acc] hover:text-white cursor-pointer select-none"
            onClick={() => { setIsAddPopupOpen(true); setContextMenu({ visible: false }); }}>Add Override</div>
          <div className="h-[1px] bg-[#3e3e42] my-1 mx-2"></div>
          <div className="px-5 py-1 hover:bg-red-600 hover:text-white cursor-pointer select-none text-red-400"
            onClick={handleDelete}>Delete</div>
        </div>
      )}
    </div>
  );
};

export default SessionOverridesView;
