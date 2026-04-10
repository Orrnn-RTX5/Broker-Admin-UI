import React, { useState, useEffect } from 'react';
import { ManagerService } from '../../services/manager.service';
import { Plus, Trash2, RefreshCw, X, Settings } from 'lucide-react';

const fmt = (v) => (v == null ? '—' : v);
const fmtDate = (v) => {
  if (!v) return '—';
  try { return new Date(v).toLocaleString(); } catch { return v; }
};

// ── Create Schedule Popup ──────────────────────────────────────────────────
const CreateSchedulePopup = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({
    group_name: '', symbol: '*',
    leverage_from: '', leverage_to: '',
    volume_min: '', volume_max: '',
    effective_from: '', effective_to: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.group_name.trim()) { setError('Group name is required.'); return; }
    setLoading(true);
    setError('');
    try {
      const payload = {
        group_name: form.group_name.trim(),
        symbol: form.symbol.trim() || '*',
      };
      if (form.leverage_from !== '') payload.leverage_from = Number(form.leverage_from);
      if (form.leverage_to !== '')   payload.leverage_to   = Number(form.leverage_to);
      if (form.volume_min !== '')    payload.volume_min    = parseFloat(form.volume_min);
      if (form.volume_max !== '')    payload.volume_max    = parseFloat(form.volume_max);
      if (form.effective_from)       payload.effective_from = form.effective_from;
      if (form.effective_to)         payload.effective_to   = form.effective_to;
      await ManagerService.createLeverageSchedule(payload);
      onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, required, children }) => (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] text-[#888] uppercase tracking-wider">
        {label}{required && <span className="text-[#f48771] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );

  const inp = "w-full bg-[#3c3c3c] border border-[#555] text-[#e1e1e1] text-[12px] px-2 py-1 rounded-[2px] focus:outline-none focus:border-[#007acc]";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[#252526] border border-[#3e3e42] rounded-[3px] shadow-2xl w-[480px] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center h-9 px-4 border-b border-black/40 bg-[#2d2d30] shrink-0">
          <span className="text-[12px] font-semibold text-[#e1e1e1] flex-1">Add Leverage Schedule Rule</span>
          <button onClick={onClose} className="text-[#555] hover:text-[#ccc]"><X size={14} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Group Name" required>
              <input className={inp} value={form.group_name} onChange={e => set('group_name', e.target.value)} placeholder="e.g. standard" />
            </Field>
            <Field label="Symbol">
              <input className={inp} value={form.symbol} onChange={e => set('symbol', e.target.value)} placeholder="* = all symbols" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Leverage From">
              <input className={inp} type="number" value={form.leverage_from} onChange={e => set('leverage_from', e.target.value)} placeholder="e.g. 1" min={1} />
            </Field>
            <Field label="Leverage To">
              <input className={inp} type="number" value={form.leverage_to} onChange={e => set('leverage_to', e.target.value)} placeholder="e.g. 100" min={1} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Volume Min (lots)">
              <input className={inp} type="number" step="0.01" value={form.volume_min} onChange={e => set('volume_min', e.target.value)} placeholder="e.g. 0.0" />
            </Field>
            <Field label="Volume Max (lots)">
              <input className={inp} type="number" step="0.01" value={form.volume_max} onChange={e => set('volume_max', e.target.value)} placeholder="e.g. 10.0" />
            </Field>
          </div>

          <div className="bg-[#1e1e1e] rounded-[2px] px-3 py-2 border border-[#3e3e42]">
            <div className="text-[10px] text-[#888] uppercase tracking-wider mb-2">Effective Period (optional — leave blank for no restriction)</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From">
                <input className={inp} type="datetime-local" value={form.effective_from} onChange={e => set('effective_from', e.target.value)} />
              </Field>
              <Field label="To">
                <input className={inp} type="datetime-local" value={form.effective_to} onChange={e => set('effective_to', e.target.value)} />
              </Field>
            </div>
          </div>

          {error && <div className="text-[11px] text-[#f48771] bg-[#3e1e1e] px-3 py-1.5 rounded-[2px] border border-[#f48771]/30">{error}</div>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="h-[26px] px-4 text-[11px] bg-[#3c3c3c] hover:bg-[#505050] text-[#ccc] rounded-[2px] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="h-[26px] px-4 text-[11px] bg-[#007acc] hover:bg-[#0098ff] disabled:opacity-50 text-white rounded-[2px] transition-colors">
              {loading ? 'Creating…' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main View ──────────────────────────────────────────────────────────────
const LeverageScheduleView = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState('');
  const [appliedFilter, setAppliedFilter] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState({ visible: false });

  const fetchData = async (group = '') => {
    setLoading(true);
    try {
      const res = await ManagerService.getLeverageScheduleList(group || undefined);
      setData(Array.isArray(res) ? res : res?.data ?? []);
    } catch (err) {
      console.error('Failed to fetch leverage schedules', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleApplyFilter = () => {
    setAppliedFilter(groupFilter);
    fetchData(groupFilter);
  };

  const handleClearFilter = () => {
    setGroupFilter('');
    setAppliedFilter('');
    fetchData('');
  };

  const handleContextMenu = (e, row) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, row });
  };

  const handleDelete = async () => {
    const row = contextMenu.row;
    if (!row) return;
    const sid = row.id || row.schedule_id;
    if (window.confirm(`Delete schedule ID ${sid} (${row.group_name} / ${row.symbol})?`)) {
      try {
        await ManagerService.deleteLeverageSchedule(sid);
        fetchData(appliedFilter);
      } catch (err) {
        alert('Failed: ' + (err.response?.data?.message || err.message));
      }
    }
    setContextMenu({ visible: false });
  };

  const columns = [
    { label: 'ID',         w: 'w-[70px]'  },
    { label: 'Group',      w: 'w-[160px]' },
    { label: 'Symbol',     w: 'w-[110px]' },
    { label: 'Lev From',   w: 'w-[90px]'  },
    { label: 'Lev To',     w: 'w-[90px]'  },
    { label: 'Vol Min',    w: 'w-[90px]'  },
    { label: 'Vol Max',    w: 'w-[90px]'  },
    { label: 'Eff. From',  w: 'w-[160px]' },
    { label: 'Eff. To',    w: 'w-[160px]' },
    { label: 'Created',    w: 'flex-1'    },
  ];

  return (
    <div
      className="flex-1 bg-[#1e1e1e] flex flex-col overflow-hidden relative"
      onClick={() => setContextMenu({ visible: false })}
      onContextMenu={e => e.preventDefault()}
    >
      {/* Action Bar */}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-[#252526] border-b border-black/40 shrink-0 select-none">
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 h-[24px] px-3 bg-[#007acc] hover:bg-[#0098ff] text-white text-[11px] rounded-[2px] transition-colors"
        >
          <Plus size={12} /> Add Schedule
        </button>

        {/* Group filter */}
        <div className="flex items-center gap-1.5 ml-3">
          <span className="text-[10px] text-[#888] uppercase tracking-wider">Group:</span>
          <input
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleApplyFilter()}
            placeholder="filter by group…"
            className="h-[22px] w-[160px] bg-[#3c3c3c] border border-[#555] text-[#e1e1e1] text-[11px] px-2 rounded-[2px] focus:outline-none focus:border-[#007acc]"
          />
          <button
            onClick={handleApplyFilter}
            className="h-[22px] px-2.5 bg-[#3c3c3c] hover:bg-[#505050] text-[#ccc] text-[11px] rounded-[2px] border border-[#555] transition-colors"
          >
            Filter
          </button>
          {appliedFilter && (
            <button onClick={handleClearFilter} className="h-[22px] px-1.5 text-[#888] hover:text-[#ccc] transition-colors">
              <X size={11} />
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 pr-2">
          <button onClick={() => fetchData(appliedFilter)} title="Refresh" className="text-[#999] hover:text-white transition-colors">
            <RefreshCw size={13} />
          </button>
          <Settings size={14} className="text-[#999] hover:text-white cursor-pointer" />
        </div>
      </div>

      {/* Active filter badge */}
      {appliedFilter && (
        <div className="px-3 py-1 bg-[#252526] border-b border-black/30 shrink-0 flex items-center gap-2">
          <span className="text-[10px] text-[#888]">Showing group:</span>
          <span className="text-[10px] text-[#9cdcfe] font-mono bg-[#1e1e1e] px-2 py-0.5 rounded-[2px]">{appliedFilter}</span>
        </div>
      )}

      {/* Table Header */}
      <div className="flex bg-[#333333] border-b border-black/40 shadow-sm sticky top-0 z-10 select-none shrink-0">
        {columns.map(c => (
          <div key={c.label} className={`${c.w} px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20 shrink-0`}>{c.label}</div>
        ))}
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto no-scrollbar bg-[#1e1e1e]">
        {data.map((row, idx) => {
          const sid = row.id || row.schedule_id;
          return (
            <div
              key={sid || idx}
              onContextMenu={e => handleContextMenu(e, row)}
              className={`flex cursor-default border-b border-black/10 hover:bg-blue-600/20 transition-colors
                ${idx % 2 === 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'}`}
            >
              <div className="w-[70px] px-3 py-1 text-[12px] text-[#9cdcfe] font-semibold border-r border-black/10 shrink-0 flex items-center">{fmt(sid)}</div>
              <div className="w-[160px] px-3 py-1 text-[12px] text-[#e1e1e1] border-r border-black/10 shrink-0 truncate flex items-center">{fmt(row.group_name)}</div>
              <div className="w-[110px] px-3 py-1 text-[12px] text-[#4ec9b0] font-mono border-r border-black/10 shrink-0 truncate flex items-center">
                {row.symbol === '*' ? <span className="text-[#888]">* (all)</span> : fmt(row.symbol)}
              </div>
              <div className="w-[90px] px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 flex items-center">{fmt(row.leverage_from)}</div>
              <div className="w-[90px] px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 flex items-center">{fmt(row.leverage_to)}</div>
              <div className="w-[90px] px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 flex items-center">{fmt(row.volume_min)}</div>
              <div className="w-[90px] px-3 py-1 text-[12px] text-[#aaaaaa] border-r border-black/10 shrink-0 flex items-center">{fmt(row.volume_max)}</div>
              <div className="w-[160px] px-3 py-1 text-[11px] text-[#888] font-mono border-r border-black/10 shrink-0 truncate flex items-center">{fmtDate(row.effective_from)}</div>
              <div className="w-[160px] px-3 py-1 text-[11px] text-[#888] font-mono border-r border-black/10 shrink-0 truncate flex items-center">{fmtDate(row.effective_to)}</div>
              <div className="flex-1 px-3 py-1 text-[11px] text-[#666] font-mono flex items-center truncate">{fmtDate(row.created_at)}</div>
            </div>
          );
        })}

        {loading && <div className="p-4 text-[#aaaaaa] text-[12px] italic">Loading schedules…</div>}
        {!loading && data.length === 0 && <div className="p-4 text-[#aaaaaa] text-[12px] italic">No leverage schedule rules found.</div>}

        {[...Array(20)].map((_, i) => (
          <div key={`empty-${i}`} className={`flex border-b border-black/5 opacity-30 ${i % 2 !== 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'}`}>
            <div className="w-full h-6"></div>
          </div>
        ))}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed z-[9999] bg-[#2d2d30] border border-[#3e3e42] shadow-2xl py-1 min-w-[200px] text-[12px] text-[#cccccc] font-sans rounded-[2px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-6 py-1 hover:bg-[#007acc] hover:text-white cursor-pointer select-none"
            onClick={() => { setIsAddOpen(true); setContextMenu({ visible: false }); }}>
            Add Schedule
          </div>
          <div className="h-[1px] bg-[#3e3e42] my-1 mx-2"></div>
          <div className="px-6 py-1 hover:bg-[#e51400] hover:text-white cursor-pointer select-none text-red-400" onClick={handleDelete}>
            Delete
          </div>
        </div>
      )}

      {/* Create Popup */}
      {isAddOpen && (
        <CreateSchedulePopup
          onClose={() => setIsAddOpen(false)}
          onCreated={() => fetchData(appliedFilter)}
        />
      )}

      {/* Status Bar */}
      <div className="h-6 bg-[#007acc] text-white flex items-center px-4 text-[11px] select-none shrink-0 border-t border-[#005a9e]">
        <span>Total Schedule Rules: {data.length}</span>
        {appliedFilter && <span className="ml-4 opacity-70">Filtered: {appliedFilter}</span>}
      </div>
    </div>
  );
};

export default LeverageScheduleView;
