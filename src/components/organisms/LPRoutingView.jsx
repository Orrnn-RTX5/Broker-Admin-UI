import { useAuthStore } from '../../store/authStore';
import { canEditGroup, canEditGroups } from '../../utils/groupAccess';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Plus, X, Edit2, Trash2, GitBranch, Network, Loader2, ArrowLeft, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { RoutingService } from '../../services/routing.service';
import { ManagerService } from '../../services/manager.service';
import LPRouteFormPopup from '../popups/LPRouteFormPopup';
import './LPRoutingView.css';

const ROUTING_MODE_LABEL = {
  b_book: 'B-Book',
  a_book: 'A-Book',
  hybrid:  'Hybrid',
};

const FALLBACK_LABEL = {
  best_available: 'Best Available',
  b_book:         'B-Book',
  reject:         'Reject',
};

const KV = ({ label, value, mono }) => (
  <div className="flex items-start justify-between gap-4 py-1 border-b" style={{ borderColor: 'var(--border-3)' }}>
    <span className="text-[11px] shrink-0" style={{ color: 'var(--text-3)' }}>{label}</span>
    <span className={`text-[11px] text-right break-all ${mono ? 'font-mono' : 'font-medium'}`} style={{ color: 'var(--text)' }}>
      {value ?? '—'}
    </span>
  </div>
);

const ErrBox = ({ msg }) => {
  if (!msg) return null;
  return (
    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-4">
      {msg}
    </div>
  );
};

const GroupDashboardPanel = ({ groupName, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    const timerId = window.setTimeout(() => {
      setLoading(true);
      setErr('');
      ManagerService.getGroupRoutingOverviewList()
        .then(res => {
          if (cancelled) return;
        const list = Array.isArray(res) ? res : [];
        const groupData = list.find(g => g.group_name === groupName);
        if (groupData) {
          setData(groupData);
        } else {
          setErr('Group not found in routing overview.');
        }
      })
      .catch(e => {
        if (cancelled) return;
        setErr(e.message || 'Failed to fetch routing overview');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [groupName]);

  return (
    <div className="flex flex-col flex-1 bg-[color:var(--bg-app)] overflow-hidden">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-black/40 bg-[color:var(--bg-surface-1)] shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="text-[color:var(--text-muted)] hover:text-white transition-colors p-1"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-[17px] font-semibold text-white">Group Dashboard: {groupName}</h1>
        </div>
      </div>
      
      {/* Dashboard Body */}
      <div className="flex-1 p-6 overflow-y-auto no-scrollbar">
        {loading && (
          <div className="flex items-center justify-center h-full text-[color:var(--text-muted)] gap-2">
            <Loader2 size={16} className="animate-spin" /> Loading group details...
          </div>
        )}
        {!loading && err && (
          <div className="flex items-center justify-center h-full">
            <ErrBox msg={err} />
          </div>
        )}
        {!loading && data && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* Group Settings */}
              <div className="rounded-lg border p-4 flex flex-col gap-3 bg-[color:var(--bg-surface-2)] border-black/20">
                <h3 className="text-sm font-semibold text-[color:var(--text-primary)] border-b border-black/20 pb-2">Overview</h3>
                <div className="flex flex-col gap-1.5 mt-1">
                  <KV label="ID" value={data.group_id} mono />
                  <KV label="Broker" value={data.broker_id} mono />
                  <KV label="Description" value={data.group_description} />
                  <KV label="Currency" value={data.group_currency} mono />
                  <KV label="Account Type" value={data.group_account_type} />
                  <KV label="Demo Account" value={data.group_demo ? 'Yes' : 'No'} />
                  <KV label="Trade Allowed" value={data.group_trade_allowed ? 'Yes' : 'No'} />
                </div>
              </div>

              {/* Trading & Risk Config */}
              <div className="rounded-lg border p-4 flex flex-col gap-3 bg-[color:var(--bg-surface-2)] border-black/20">
                <h3 className="text-sm font-semibold text-[color:var(--text-primary)] border-b border-black/20 pb-2">Trading & Risk</h3>
                <div className="flex flex-col gap-1.5 mt-1">
                  <KV label="Leverage" value={`1:${data.group_leverage}`} mono />
                  <KV label="Margin Call" value={`${data.group_margin_call_level}%`} mono />
                  <KV label="Stop Out" value={`${data.group_stop_out_level}%`} mono />
                  <KV label="Execution Mode" value={data.group_execution_mode} />
                  <KV label="Book Type" value={data.group_book_type} />
                  <KV label="Neg. Bal. Prot." value={data.group_negative_balance_protection ? 'Yes' : 'No'} />
                  <KV label="Max Lot/Trade" value={data.group_max_lot_per_trade} mono />
                  <KV label="Max Total Lots" value={data.group_max_total_lots} mono />
                  <KV label="Lot Divisor" value={data.group_lot_divisor} mono />
                </div>
              </div>

              {/* Fees & Spreads */}
              <div className="rounded-lg border p-4 flex flex-col gap-3 bg-[color:var(--bg-surface-2)] border-black/20">
                <h3 className="text-sm font-semibold text-[color:var(--text-primary)] border-b border-black/20 pb-2">Fees & Spreads</h3>
                <div className="flex flex-col gap-1.5 mt-1">
                  <KV label="Commission Rate" value={data.group_commission_rate} mono />
                  <KV label="Commission Type" value={data.group_commission_type } />
                  <KV label="Swap Multiplier" value={data.group_swap_multiplier} mono />
                  <KV label="Spread Markup" value={data.group_spread_markup} mono />
                </div>
              </div>

              {/* Routing Configuration */}
              <div className="rounded-lg border p-4 flex flex-col gap-3 bg-[color:var(--bg-surface-2)] border-black/20">
                <h3 className="text-sm font-semibold text-[color:var(--text-primary)] border-b border-black/20 pb-2">Routing Config</h3>
                <div className="flex flex-col gap-1.5 mt-1">
                  <KV label="Configured" value={data.routing_configured ? 'Yes' : 'No'} />
                  <KV label="Route ID" value={data.route_id ?? '—'} mono />
                  <KV label="LP Name" value={data.lp_name || '—'} mono />
                  <KV label="Routing Mode" value={data.routing_mode} />
                  <KV label="Internal Route" value={data.is_internal_route ? 'Yes' : 'No'} />
                  <KV label="External Route" value={data.is_external_route ? 'Yes' : 'No'} />
                  <KV label="Priority" value={data.priority} mono />
                  <KV label="Fallback Policy" value={data.fallback_policy || '—'} />
                  <KV label="Symbol Pattern" value={data.symbol_pattern} mono />
                </div>
              </div>

              {/* Symbols */}
              <div className="col-span-1 md:col-span-2 lg:col-span-2 rounded-lg border p-4 flex flex-col gap-3 bg-[color:var(--bg-surface-2)] border-black/20">
                <h3 className="text-sm font-semibold text-[color:var(--text-primary)] border-b border-black/20 pb-2">Symbol Restrictions</h3>
                
                <div className="grid grid-cols-2 gap-6 mt-1">
                  <div>
                    <span className="text-[11px] text-[color:var(--text-3)] mb-2 block">Allowed Symbols</span>
                    {data.group_symbols_allowed && data.group_symbols_allowed.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {data.group_symbols_allowed.map(sym => (
                          <span key={sym} className="px-2 py-0.5 bg-green-500/10 text-white text-[10px] rounded border border-green-500/20 font-mono">
                            {sym}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-[color:var(--text-muted)] italic">No explicit allowed symbols (or all allowed)</span>
                    )}
                  </div>
                  
                  <div>
                    <span className="text-[11px] text-[color:var(--text-3)] mb-2 block">Blocked Symbols</span>
                    {data.group_symbols_blocked && data.group_symbols_blocked.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {data.group_symbols_blocked.map(sym => (
                          <span key={sym} className="px-2 py-0.5 bg-red-500/10 text-red-400 text-[10px] rounded border border-red-500/20 font-mono">
                            {sym}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-[color:var(--text-muted)] italic">None explicitly blocked</span>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const LPRoutingView = ({ refreshTrigger = 0 }) => {
 const currentUser=useAuthStore(state=>state.user);
 const canWrite=canEditGroups(currentUser);
  const [data, setData]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [formOpen, setFormOpen]       = useState(false);
  const [editRoute, setEditRoute]     = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false });
  const [filterEnabled, setFilterEnabled] = useState('all'); // 'all' | 'active' | 'off'
  const [search, setSearch]           = useState('');
  const [blankUiGroup, setBlankUiGroup] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [pageInput, setPageInput] = useState(null);
  const gridScrollRef = useRef(null);

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await RoutingService.listRoutes();
      setData(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to fetch LP routes', err);
      setLoadError(err.response?.data?.message || err.message || 'Routing rules could not be loaded.');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(fetchRoutes, 0);
    return () => window.clearTimeout(timerId);
  }, [fetchRoutes, refreshTrigger]);

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

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  const visibleRows = filtered.slice(pageStart, pageStart + pageSize);
  const rangeLabel = filtered.length ? `${pageStart + 1}-${pageStart + visibleRows.length} of ${filtered.length}` : '0 of 0';
  const goToPage = nextPage => {
    setPage(Math.max(1, Math.min(nextPage, pageCount)));
    setPageInput(null);
    gridScrollRef.current?.scrollTo({ top: 0 });
  };
  const resetPage = () => {
    setPage(1);
    setPageInput(null);
    gridScrollRef.current?.scrollTo({ top: 0 });
  };
  const commitPageInput = () => {
    const nextPage = Number(pageInput);
    goToPage(pageInput?.trim() && Number.isInteger(nextPage) ? nextPage : currentPage);
  };

  const handleContextMenu = (e, row) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, row });
  };

  const closeCtx = () => setContextMenu({ visible: false });

  const handleDelete = async (row) => {
    const r = row || contextMenu.row;
    if (!r || !canEditGroup(currentUser,r.group_name)) return;
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
 if (!canEditGroup(currentUser,(row || contextMenu.row)?.group_name)) return;
    setEditRoute(row || contextMenu.row);
    setFormOpen(true);
    closeCtx();
  };

  const openCreate = () => {
 if(!canWrite) return;
    setEditRoute(null);
    setFormOpen(true);
  };

  const detailOpen = !!selectedRow;

  return (
    <div
      className="lp-routes-view"
      onClick={closeCtx}
      onContextMenu={(e) => e.preventDefault()}
    >
      {blankUiGroup ? (
        <GroupDashboardPanel 
          groupName={blankUiGroup} 
          onClose={() => setBlankUiGroup(null)} 
        />
      ) : (
        <>
          <header className="lp-routes-heading">
            <h1><Network size={13} aria-hidden="true" />LP Routing</h1>
            {!loading && data.length > 0 && <span className="lp-routes-count">{filtered.length === data.length ? `${data.length} rows` : `${filtered.length} of ${data.length} rows`}</span>}
            <div className="lp-routes-toolbar">
              <div className="lp-routes-search">
                <Search size={13} aria-hidden="true" />
                <input aria-label="Search routing rules" placeholder="Search group, symbol or LP…" value={search} onChange={event => { setSearch(event.target.value); resetPage(); }} />
                {search && <button type="button" aria-label="Clear routing search" title="Clear search" onClick={event => { setSearch(''); resetPage(); event.currentTarget.parentElement.querySelector('input')?.focus(); }}><X size={12} aria-hidden="true" /></button>}
              </div>
              <select className="lp-routes-status-filter" aria-label="Filter routing rules by status" value={filterEnabled} onChange={event => { setFilterEnabled(event.target.value); resetPage(); }}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="off">Off</option>
              </select>
              {canWrite && <button type="button" className="lp-route-button is-primary" onClick={openCreate}><Plus size={13} aria-hidden="true" />Add Route</button>}
            </div>
          </header>
          <div className="lp-routes-workspace">
            {loadError && <div className="lp-route-notice is-error" role="alert"><span>{loadError}</span><button type="button" className="lp-route-button" disabled={loading} onClick={fetchRoutes}>Retry</button></div>}
            <div className="lp-routes-split">
              <div className="lp-routes-grid-panel">
                <div ref={gridScrollRef} className="lp-routes-grid-scroll" tabIndex={0} aria-label="Routing rules">
                  <table className="lp-routes-table" aria-label="LP routing rules" aria-busy={loading}>
                    <colgroup>{Array.from({ length: 9 }, (_, index) => <col key={index} className="lp-route-data-column" />)}<col className="lp-route-col-actions" /></colgroup>
                    <thead><tr>{['ID', 'Status', 'Group', 'Symbol', 'Mode', 'LP provider', 'Priority', 'Fallback', 'Max volume'].map(label => <th key={label} scope="col">{label}</th>)}<th scope="col" className="lp-route-row-actions" aria-label="Route actions">Actions</th></tr></thead>
                    <tbody>
                      {visibleRows.map((row, index) => {
                        const rowId = row.route_id ?? row.id;
                        const isSelected = (selectedRow?.route_id ?? selectedRow?.id) === rowId;
                        return <tr key={rowId ?? index} tabIndex={0} aria-selected={isSelected} className={isSelected ? 'is-selected' : ''}
                          onClick={event => { event.stopPropagation(); setSelectedRow(row); }}
                          onDoubleClick={event => { event.stopPropagation(); setBlankUiGroup(row.group_name); }}
                          onContextMenu={event => handleContextMenu(event, row)}
                          onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedRow(row); } else if (event.key === 'Escape') setSelectedRow(null); }}>
                          <td><span className="lp-route-id">{rowId ?? '—'}</span></td>
                          <td><span className={`lp-route-status ${row.enabled ? 'is-active' : 'is-off'}`}>{row.enabled ? 'Active' : 'Off'}</span></td>
                          <td className="lp-route-group" title={row.group_name}>{row.group_name || '—'}</td>
                          <td className="lp-route-mono" title={row.symbol_pattern}>{row.symbol_pattern || '—'}</td>
                          <td><span className="lp-route-mode">{ROUTING_MODE_LABEL[row.routing_mode] || row.routing_mode || '—'}</span></td>
                          <td title={row.lp_name}>{row.lp_name || '—'}</td>
                          <td className="lp-route-number">{row.priority ?? '—'}</td>
                          <td title={FALLBACK_LABEL[row.fallback_policy] || row.fallback_policy}>{FALLBACK_LABEL[row.fallback_policy] || row.fallback_policy || '—'}</td>
                          <td className="lp-route-number">{row.max_volume ?? '—'}</td>
                          <td className="lp-route-row-actions">{canEditGroup(currentUser, row.group_name) && <button type="button" className="lp-route-icon-button" aria-label={`Edit route ${rowId}`} title="Edit route" onClick={event => { event.stopPropagation(); handleEdit(row); }}><Edit2 size={12} aria-hidden="true" /></button>}</td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                  {!filtered.length && <div className="lp-routes-empty" role="status">
                    <span className="lp-routes-empty-icon">{loading ? <Loader2 size={18} className="lp-route-spinning" aria-hidden="true" /> : <GitBranch size={18} aria-hidden="true" />}</span>
                    <strong>{loading ? 'Loading routing rules…' : loadError ? 'Routes unavailable' : data.length ? 'No routes match your filter' : 'No routing rules configured'}</strong>
                    {!loading && <p>{loadError ? 'Retry to reload the routing rules.' : data.length ? 'Try another group, symbol or LP name.' : 'Create a route to connect a group to an LP.'}</p>}
                    {!loading && !loadError && !data.length && canWrite && <button type="button" className="lp-route-button" onClick={openCreate}><Plus size={12} aria-hidden="true" />Add Route</button>}
                  </div>}
                </div>
                <footer className="lp-routes-grid-footer" aria-label="Routing pagination">
                  <span className="lp-route-footer-tab">LP Routing</span>
                  <nav className="lp-route-page-controls" aria-label="Routing pages">
                    <span className="lp-route-page-range" aria-live="polite" aria-label={`Rows ${rangeLabel}`}><strong>Rows</strong><span>{loading ? 'Loading…' : loadError ? 'Unavailable' : rangeLabel}</span></span>
                    <button type="button" aria-label="First routing page" disabled={loading || currentPage === 1} onClick={() => goToPage(1)}><ChevronsLeft size={14} aria-hidden="true" /></button>
                    <button type="button" aria-label="Previous routing page" disabled={loading || currentPage === 1} onClick={() => goToPage(currentPage - 1)}><ChevronLeft size={14} aria-hidden="true" /></button>
                    <label className="lp-route-page-number"><span>Page</span><input aria-label="Routing page number" type="text" inputMode="numeric" value={pageInput ?? String(currentPage)} disabled={loading} onChange={event => setPageInput(event.target.value)} onBlur={commitPageInput} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commitPageInput(); } else if (event.key === 'Escape') setPageInput(null); }} /><span>/ {pageCount}</span></label>
                    <button type="button" aria-label="Next routing page" disabled={loading || currentPage === pageCount} onClick={() => goToPage(currentPage + 1)}><ChevronRight size={14} aria-hidden="true" /></button>
                    <button type="button" aria-label="Last routing page" disabled={loading || currentPage === pageCount} onClick={() => goToPage(pageCount)}><ChevronsRight size={14} aria-hidden="true" /></button>
                    <select aria-label="Routing rows per page" value={pageSize} disabled={loading} onChange={event => { setPageSize(Number(event.target.value)); resetPage(); }}>{[50, 100, 250].map(size => <option key={size} value={size}>{size} rows</option>)}</select>
                  </nav>
                </footer>
              </div>
              {detailOpen && <aside className="lp-route-details" aria-label="Selected route details">
                <header><div><GitBranch size={13} aria-hidden="true" /><strong>Route #{selectedRow.route_id ?? selectedRow.id}</strong></div><button type="button" className="lp-route-icon-button" aria-label="Close route details" onClick={() => setSelectedRow(null)}><X size={13} aria-hidden="true" /></button></header>
                <div className="lp-route-details-scroll">
                  <p className="lp-route-detail-group" title={selectedRow.group_name}>{selectedRow.group_name}</p>
                  <dl>{[
                    ['Route ID', selectedRow.route_id ?? selectedRow.id], ['Broker ID', selectedRow.broker_id], ['Group', selectedRow.group_name], ['Symbol pattern', selectedRow.symbol_pattern],
                    ['Routing mode', ROUTING_MODE_LABEL[selectedRow.routing_mode] || selectedRow.routing_mode], ['LP provider', selectedRow.lp_name], ['Priority', selectedRow.priority],
                    ['Fallback', FALLBACK_LABEL[selectedRow.fallback_policy] || selectedRow.fallback_policy], ['Max volume', selectedRow.max_volume ?? '—'], ['Status', selectedRow.enabled ? 'Active' : 'Off'],
                  ].map(([label, content]) => <div key={label}><dt>{label}</dt><dd title={String(content ?? '—')}>{content ?? '—'}</dd></div>)}</dl>
                  {canEditGroup(currentUser, selectedRow.group_name) && <div className="lp-route-detail-actions"><button type="button" className="lp-route-button" onClick={() => handleEdit(selectedRow)}><Edit2 size={12} aria-hidden="true" />Edit Route</button><button type="button" className="lp-route-button is-danger" onClick={() => handleDelete(selectedRow)}><Trash2 size={12} aria-hidden="true" />Delete Route</button></div>}
                  {(selectedRow.created_at || selectedRow.updated_at) && <dl className="lp-route-detail-times">{[['Created', selectedRow.created_at], ['Updated', selectedRow.updated_at]].filter(([, timestamp]) => timestamp).map(([label, timestamp]) => <div key={label}><dt>{label}</dt><dd>{new Date(timestamp * 1000).toLocaleString()}</dd></div>)}</dl>}
                </div>
              </aside>}
            </div>
          </div>
      {contextMenu.visible && (
        <div
          className="lp-route-context"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            hidden={!canWrite} onClick={() => handleEdit()}
            className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left text-[color:var(--text-primary)] hover:bg-[color:var(--accent-700)] transition-colors"
          >
            <Edit2 size={12} className="text-white" /> Edit Route
          </button>
          <div className="border-t border-[#333] my-0.5" />
          <button
            hidden={!canWrite} onClick={() => handleDelete()}
            className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left text-[#f48771] hover:bg-[color:var(--accent-700)] transition-colors"
          >
            <Trash2 size={12} /> Delete Route
          </button>
        </div>
      )}

      {/* ── Form Popup ──────────────────────────────────────────────────────── */}
      {formOpen && canWrite && (
        <LPRouteFormPopup
          initialData={editRoute}
          onClose={() => { setFormOpen(false); setEditRoute(null); }}
          onSaved={() => fetchRoutes()}
        />
      )}

        </>
      )}
    </div>
  );
};

export default LPRoutingView;
