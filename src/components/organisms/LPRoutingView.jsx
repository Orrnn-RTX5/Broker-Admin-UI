import React, { useState, useEffect, useMemo } from 'react';
import { Plus, RefreshCw, X, Edit2, Trash2, GitBranch } from 'lucide-react';
import { RoutingService } from '../../services/routing.service';
import LPRouteFormPopup from '../popups/LPRouteFormPopup';

const ROUTING_MODE_COLOR = {
  a_book: 'text-[#d97706]',
  hybrid:  'text-[#3b82f6]',
};

const ROUTING_MODE_LABEL = {
  a_book: 'A-Book',
  hybrid:  'Hybrid',
};

const FALLBACK_LABEL = {
  best_available: 'Best Available',
  b_book:         'B-Book',
  reject:         'Reject',
};

const RouteIcon = (props) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/>
    <path d="M6 9v3a6 6 0 0 0 6 6h3"/>
  </svg>
);

const LPRoutingView = () => {
  const [data, setData]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selectedRow, setSelectedRow] = useState(null);
  const [formOpen, setFormOpen]       = useState(false);
  const [editRoute, setEditRoute]     = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false });
  const [filterEnabled, setFilterEnabled] = useState('all'); // 'all' | 'active' | 'off'
  const [search, setSearch]           = useState('');

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const res = await RoutingService.listRoutes();
      setData(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to fetch LP routes', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoutes(); }, []);

  const filtered = useMemo(() => {
    return data.filter((r) => {
      if (filterEnabled === 'active' && !r.enabled) return false;
      if (filterEnabled === 'off'    &&  r.enabled) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!r.group_name?.toLowerCase().includes(s) && !r.symbol_pattern?.toLowerCase().includes(s) && !r.lp_name?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [data, filterEnabled, search]);

  const stats = useMemo(() => ({
    total:   data.length,
    active:  data.filter((r) => r.enabled).length,
    off:     data.filter((r) => !r.enabled).length,
  }), [data]);

  const handleContextMenu = (e, row) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, row });
  };

  const closeCtx = () => setContextMenu({ visible: false });

  const handleDelete = async (row) => {
    const r = row || contextMenu.row;
    if (!r) return;
    if (!window.confirm(`Delete route #${r.route_id ?? r.id} — ${r.group_name} / ${r.symbol_pattern}?`)) { closeCtx(); return; }
    try {
      await RoutingService.deleteRoute(r.route_id ?? r.id);
      if ((selectedRow?.id ?? selectedRow?.route_id) === (r.id ?? r.route_id)) setSelectedRow(null);
      fetchRoutes();
    } catch (err) {
      alert('Delete failed: ' + (err.response?.data?.message || err.message));
    }
    closeCtx();
  };

  const handleEdit = (row) => {
    setEditRoute(row || contextMenu.row);
    setFormOpen(true);
    closeCtx();
  };

  const openCreate = () => {
    setEditRoute(null);
    setFormOpen(true);
  };

  const detailOpen = !!selectedRow;

  return (
    <div
      className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden relative"
      onClick={closeCtx}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0 select-none flex-wrap">
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 h-[24px] px-3 bg-[color:var(--accent-500)] hover:opacity-90 text-white text-[11px] rounded-[2px] transition-colors"
        >
          <Plus size={12} /> Add Route
        </button>

        <div className="flex items-center gap-1 ml-2">
          {['all', 'active', 'off'].map((f) => (
            <button
              key={f}
              onClick={() => setFilterEnabled(f)}
              className={`h-[22px] px-2.5 text-[10px] rounded-[2px] transition-colors capitalize ${
                filterEnabled === f
                  ? 'bg-[color:var(--accent-500)] text-white'
                  : 'bg-[#333] text-[#888] hover:text-white'
              }`}
            >
              {f === 'all' ? `All (${stats.total})` : f === 'active' ? `Active (${stats.active})` : `Off (${stats.off})`}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter group, symbol, LP…"
          className="h-[24px] px-2 text-[11px] bg-[#2a2a2a] border border-[#444] text-white placeholder-[#555] focus:border-[color:var(--accent-500)] focus:outline-none rounded-[2px] w-44"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-[#555] hover:text-white transition-colors">
            <X size={12} />
          </button>
        )}

        <div className="ml-auto flex items-center gap-2 pr-1">
          <span className="text-[10px] text-[#555]">{filtered.length} route{filtered.length !== 1 ? 's' : ''}</span>
          <button
            onClick={fetchRoutes}
            disabled={loading}
            className="text-[#666] hover:text-white transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Split: Table + Detail Panel ─────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Table */}
        <div className="flex flex-col overflow-hidden flex-1">

          {/* Grid Header */}
          <div className="flex bg-[color:var(--bg-surface-2)] border-b border-black/40 shadow-sm sticky top-0 z-10 select-none shrink-0">
            <div className="w-[60px]  px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 shrink-0">ID</div>
            <div className="w-[60px]  px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 shrink-0">Status</div>
            <div className="w-[160px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 shrink-0">Group</div>
            <div className="w-[130px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 shrink-0">Symbol</div>
            <div className="w-[90px]  px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 shrink-0">Mode</div>
            <div className="w-[120px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 shrink-0">LP Name</div>
            <div className="w-[70px]  px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 shrink-0">Priority</div>
            <div className="w-[130px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 shrink-0">Fallback</div>
            <div className="w-[80px]  px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 shrink-0">Max Vol</div>
            <div className="flex-1 px-3 py-1.5 bg-[color:var(--bg-surface-2)]"></div>
          </div>

          {/* Grid Body */}
          <div className="flex-1 overflow-auto no-scrollbar bg-[color:var(--bg-app)]">
            {loading && (
              <div className="p-4 text-[color:var(--text-muted)] text-[12px] italic">Loading routing rules…</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-16">
                <GitBranch size={28} className="text-[#444]" />
                <span className="text-[#555] text-[12px] italic">
                  {data.length === 0 ? 'No routing rules configured yet.' : 'No routes match your filter.'}
                </span>
                {data.length === 0 && (
                  <button
                    onClick={openCreate}
                    className="mt-2 flex items-center gap-1.5 h-[24px] px-3 bg-[color:var(--accent-500)] hover:opacity-90 text-white text-[11px] rounded-[2px]"
                  >
                    <Plus size={12} /> Create First Route
                  </button>
                )}
              </div>
            )}

            {!loading && filtered.map((row, idx) => {
              const rowId = row.route_id ?? row.id;
              const selId = selectedRow?.route_id ?? selectedRow?.id;
              const isSelected = selId === rowId;
              return (
                <div
                  key={rowId ?? idx}
                  onClick={(e) => { e.stopPropagation(); setSelectedRow(row); }}
                  onContextMenu={(e) => handleContextMenu(e, row)}
                  className={`flex cursor-pointer border-b border-black/10 transition-colors
                    ${isSelected
                      ? 'bg-[color:var(--accent-700)] border-l-2 border-l-[color:var(--accent-500)]'
                      : idx % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'}
                    hover:bg-blue-600/20`}
                >
                  {/* ID */}
                  <div className="w-[60px] px-3 py-1 text-[12px] flex items-center gap-1.5 border-r border-black/10 shrink-0">
                    <RouteIcon />
                    <span className="text-[color:var(--text-primary)] font-mono truncate">{rowId ?? '—'}</span>
                  </div>
                  {/* Status */}
                  <div className="w-[60px] px-3 py-1 text-[12px] border-r border-black/10 shrink-0 flex items-center">
                    <span className={`text-[11px] font-semibold ${row.enabled ? 'text-[#4ec9b0]' : 'text-[#f48771]'}`}>
                      {row.enabled ? 'Active' : 'Off'}
                    </span>
                  </div>
                  {/* Group */}
                  <div className="w-[160px] px-3 py-1 text-[12px] text-[#9cdcfe] font-medium border-r border-black/10 shrink-0 truncate flex items-center">
                    {row.group_name}
                  </div>
                  {/* Symbol */}
                  <div className="w-[130px] px-3 py-1 text-[12px] font-mono text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate flex items-center">
                    {row.symbol_pattern}
                  </div>
                  {/* Mode */}
                  <div className="w-[90px] px-3 py-1 text-[12px] border-r border-black/10 shrink-0 flex items-center">
                    <span className={`text-[11px] font-semibold ${ROUTING_MODE_COLOR[row.routing_mode] ?? 'text-[#ccc]'}`}>
                      {ROUTING_MODE_LABEL[row.routing_mode] ?? row.routing_mode}
                    </span>
                  </div>
                  {/* LP Name */}
                  <div className="w-[120px] px-3 py-1 text-[12px] text-[color:var(--text-muted)] font-medium border-r border-black/10 shrink-0 truncate flex items-center">
                    {row.lp_name}
                  </div>
                  {/* Priority */}
                  <div className="w-[70px] px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate flex items-center tabular-nums">
                    {row.priority}
                  </div>
                  {/* Fallback */}
                  <div className="w-[130px] px-3 py-1 text-[11px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate flex items-center">
                    {FALLBACK_LABEL[row.fallback_policy] ?? row.fallback_policy}
                  </div>
                  {/* Max Vol */}
                  <div className="w-[80px] px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate flex items-center tabular-nums">
                    {row.max_volume ?? '—'}
                  </div>
                  <div className="flex-1 flex items-center justify-end pr-2 gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
                      className="opacity-0 group-hover:opacity-100 text-[#555] hover:text-[#9cdcfe] transition-colors p-0.5"
                      title="Edit"
                    >
                      <Edit2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Filler rows */}
            {[...Array(12)].map((_, i) => (
              <div key={`e-${i}`} className={`flex border-b border-black/5 opacity-30 ${i % 2 !== 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'}`}>
                <div className="w-full h-6 border-r border-black/10" />
              </div>
            ))}
          </div>
        </div>

        {/* ── Detail Panel ──────────────────────────────────────────────────── */}
        {detailOpen && (
          <div className="w-[300px] flex flex-col border-l border-black/40 bg-[color:var(--bg-app)] shrink-0">
            {/* Panel Header */}
            <div className="flex items-center px-3 h-[30px] bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
              <span className="text-[11px] font-semibold text-[#9cdcfe] flex-1 truncate">
                Route #{selectedRow.route_id ?? selectedRow.id} — {selectedRow.group_name}
              </span>
              <button
                onClick={() => setSelectedRow(null)}
                className="text-[#555] hover:text-[#ccc] transition-colors"
              >
                <X size={13} />
              </button>
            </div>

            {/* Properties */}
            <div className="px-3 py-2.5 border-b border-black/30 bg-[color:var(--bg-surface-1)] shrink-0">
              <div className="flex flex-col gap-0.5">
                {[
                  ['Route ID',       selectedRow.route_id ?? selectedRow.id],
                  ['Broker ID',      selectedRow.broker_id],
                  ['Group',          selectedRow.group_name],
                  ['Symbol Pattern', selectedRow.symbol_pattern],
                  ['Routing Mode',   ROUTING_MODE_LABEL[selectedRow.routing_mode] ?? selectedRow.routing_mode],
                  ['LP Name',        selectedRow.lp_name],
                  ['Priority',       selectedRow.priority],
                  ['Fallback',       FALLBACK_LABEL[selectedRow.fallback_policy] ?? selectedRow.fallback_policy],
                  ['Max Volume',     selectedRow.max_volume ?? '—'],
                  ['Status',         selectedRow.enabled ? 'Active' : 'Disabled'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-start py-0.5">
                    <span className="text-[10px] text-[#555] w-28 shrink-0">{k}</span>
                    <span className={`text-[11px] font-mono truncate ${k === 'Status' ? (selectedRow.enabled ? 'text-[#4ec9b0]' : 'text-[#f48771]') : 'text-[color:var(--text-primary)]'}`}>
                      {v ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="px-3 py-2.5 flex flex-col gap-2 shrink-0">
              <p className="text-[10px] uppercase tracking-widest text-[#444] font-semibold">Actions</p>
              <button
                onClick={() => handleEdit(selectedRow)}
                className="flex items-center gap-2 h-[26px] px-3 bg-[#2a3a4a] hover:bg-[#3a4a5a] text-[#9cdcfe] text-[11px] rounded-[2px] transition-colors w-full"
              >
                <Edit2 size={12} /> Edit Route
              </button>
              <button
                onClick={() => handleDelete(selectedRow)}
                className="flex items-center gap-2 h-[26px] px-3 bg-[#3a2a2a] hover:bg-[#4a3a3a] text-[#f48771] text-[11px] rounded-[2px] transition-colors w-full"
              >
                <Trash2 size={12} /> Delete Route
              </button>
            </div>

            {/* Timestamps */}
            {(selectedRow.created_at || selectedRow.updated_at) && (
              <div className="px-3 pb-3 mt-auto">
                <p className="text-[10px] uppercase tracking-widest text-[#444] font-semibold mb-1.5">Timestamps</p>
                {selectedRow.created_at && (
                  <div className="flex items-center py-0.5">
                    <span className="text-[10px] text-[#555] w-20 shrink-0">Created</span>
                    <span className="text-[10px] font-mono text-[#666]">
                      {new Date(selectedRow.created_at * 1000).toLocaleString()}
                    </span>
                  </div>
                )}
                {selectedRow.updated_at && (
                  <div className="flex items-center py-0.5">
                    <span className="text-[10px] text-[#555] w-20 shrink-0">Updated</span>
                    <span className="text-[10px] font-mono text-[#666]">
                      {new Date(selectedRow.updated_at * 1000).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Context Menu ────────────────────────────────────────────────────── */}
      {contextMenu.visible && (
        <div
          className="fixed z-[9998] bg-[color:var(--bg-surface-1)] border border-[#444] shadow-xl rounded-[3px] py-1 w-44 text-[12px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleEdit()}
            className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left text-[color:var(--text-primary)] hover:bg-[color:var(--accent-700)] transition-colors"
          >
            <Edit2 size={12} className="text-[#9cdcfe]" /> Edit Route
          </button>
          <div className="border-t border-[#333] my-0.5" />
          <button
            onClick={() => handleDelete()}
            className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left text-[#f48771] hover:bg-[color:var(--accent-700)] transition-colors"
          >
            <Trash2 size={12} /> Delete Route
          </button>
        </div>
      )}

      {/* ── Form Popup ──────────────────────────────────────────────────────── */}
      {formOpen && (
        <LPRouteFormPopup
          initialData={editRoute}
          onClose={() => { setFormOpen(false); setEditRoute(null); }}
          onSaved={() => fetchRoutes()}
        />
      )}
    </div>
  );
};

export default LPRoutingView;
