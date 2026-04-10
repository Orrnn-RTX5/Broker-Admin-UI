import React, { useState, useEffect } from 'react';
import { PlatformConfigService } from '../../services/platformConfig.service';
import { Plus, Save, Trash2 } from 'lucide-react';

const SymbolVisibilityView = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null); // { group, symbols }
  const [editSymbols, setEditSymbols] = useState('');
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newGroup, setNewGroup] = useState('');
  const [newSymbols, setNewSymbols] = useState('');

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await PlatformConfigService.listSymbolVisibility();
      setList(Array.isArray(res) ? res : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, []);

  const handleSelect = (row) => {
    setSelected(row);
    setEditSymbols(Array.isArray(row.symbols) ? row.symbols.join(', ') : '');
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const symbols = editSymbols.split(',').map(s => s.trim()).filter(Boolean);
      await PlatformConfigService.setSymbolVisibility(selected.group, symbols);
      fetchList();
      setSelected(s => ({ ...s, symbols }));
    } catch (err) {
      alert('Failed to save: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const symbols = newSymbols.split(',').map(s => s.trim()).filter(Boolean);
      await PlatformConfigService.setSymbolVisibility(newGroup, symbols);
      setShowForm(false);
      setNewGroup('');
      setNewSymbols('');
      fetchList();
    } catch (err) {
      alert('Failed to create: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 bg-[#1e1e1e] flex overflow-hidden">
      {/* Left: list */}
      <div className="w-[260px] border-r border-black/40 flex flex-col">
        <div className="flex items-center px-3 py-1.5 bg-[#252526] border-b border-black/40 shrink-0">
          <span className="text-[11px] text-[#888] flex-1">Groups</span>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 h-[22px] px-2 bg-[#007acc] hover:bg-[#0098ff] text-white text-[10px] rounded-[2px]"
          >
            <Plus size={11} /> New
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="text-[#888] text-[11px] p-3">Loading…</div>
          ) : list.length === 0 ? (
            <div className="text-[#555] text-[11px] p-3">No entries</div>
          ) : (
            list.map(row => (
              <div
                key={row.id || row.group}
                onClick={() => handleSelect(row)}
                className={`px-3 h-[24px] flex items-center cursor-pointer text-[11px] border-b border-black/20 ${selected?.group === row.group ? 'bg-[#094771] text-white' : 'text-[#e1e1e1] hover:bg-[#2a2d2e]'}`}
              >
                {row.group}
                <span className="ml-auto text-[10px] text-[#888]">{Array.isArray(row.symbols) ? row.symbols.length : 0} sym</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: edit */}
      <div className="flex-1 flex flex-col">
        {selected ? (
          <>
            <div className="flex items-center px-3 py-1.5 bg-[#252526] border-b border-black/40 shrink-0 gap-2">
              <span className="text-[11px] text-[#9cdcfe] font-semibold">{selected.group}</span>
              <span className="text-[#555] text-[11px]">— symbol visibility</span>
              <button
                onClick={handleSave}
                disabled={saving}
                className="ml-auto flex items-center gap-1.5 h-[24px] px-3 bg-[#007acc] hover:bg-[#0098ff] text-white text-[11px] rounded-[2px] disabled:opacity-50"
              >
                <Save size={12} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
            <div className="flex-1 p-4 flex flex-col gap-2">
              <label className="text-[10px] text-[#888] uppercase tracking-wider">
                Symbols (comma-separated)
              </label>
              <textarea
                value={editSymbols}
                onChange={e => setEditSymbols(e.target.value)}
                rows={12}
                className="bg-[#1e1e1e] border border-[#555] text-[#e1e1e1] text-[11px] px-2 py-1.5 rounded-[2px] outline-none focus:border-[#007acc] resize-none font-mono"
                placeholder="EURUSD, GBPUSD, XAUUSD…"
              />
              <div className="text-[10px] text-[#555]">
                {editSymbols.split(',').filter(s => s.trim()).length} symbols
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center flex-1 text-[#555] text-[11px]">
            Select a group to edit symbol visibility
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <form
            onSubmit={handleCreate}
            className="bg-[#252526] border border-[#454545] rounded-[3px] shadow-2xl w-[360px] p-5 flex flex-col gap-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-[12px] font-semibold text-[#e1e1e1] mb-1">New Symbol Visibility</div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#888] uppercase tracking-wider">Group *</label>
              <input
                required
                value={newGroup}
                onChange={e => setNewGroup(e.target.value)}
                placeholder="e.g. standard"
                className="bg-[#1e1e1e] border border-[#555] text-[#e1e1e1] text-[11px] h-[24px] px-2 rounded-[2px] outline-none focus:border-[#007acc]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#888] uppercase tracking-wider">Symbols (comma-separated)</label>
              <textarea
                value={newSymbols}
                onChange={e => setNewSymbols(e.target.value)}
                rows={4}
                className="bg-[#1e1e1e] border border-[#555] text-[#e1e1e1] text-[11px] px-2 py-1 rounded-[2px] outline-none focus:border-[#007acc] resize-none font-mono"
                placeholder="EURUSD, GBPUSD…"
              />
            </div>
            <div className="flex gap-2 mt-1 justify-end">
              <button type="button" onClick={() => setShowForm(false)}
                className="h-[24px] px-4 bg-[#3c3c3c] hover:bg-[#4a4a4a] text-[#ccc] text-[11px] rounded-[2px]">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="h-[24px] px-4 bg-[#007acc] hover:bg-[#0098ff] text-white text-[11px] rounded-[2px] disabled:opacity-50">
                {saving ? 'Saving…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default SymbolVisibilityView;
