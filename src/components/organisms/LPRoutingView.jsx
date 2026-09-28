import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, RefreshCw, X, Edit2, Trash2, GitBranch, Network, Loader2, ChevronUp, ChevronDown, ArrowLeft } from 'lucide-react';
import { RoutingService } from '../../services/routing.service';
import { ManagerService } from '../../services/manager.service';
import { gatewayGetRoutingOptions } from '../../services/gateway.service';
import LPRouteFormPopup from '../popups/LPRouteFormPopup';

const ROUTING_MODE_COLOR = {
  b_book: 'text-[color:var(--success-500)]',
  a_book: 'text-[#d97706]',
  hybrid:  'text-white',
};    

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

const RouteIcon = (props) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/>
    <path d="M6 9v3a6 6 0 0 0 6 6h3"/>
  </svg>
);

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

// ─── Routing Options Panel ─────────────────────────────────────────────────────
const LpRoutingOptionsPanel = () => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [err, setErr] = useState('');

  const fetchOptions = useCallback(() => {
    setLoading(true);
    setErr('');
    gatewayGetRoutingOptions()
      .then((res) => {
        setOptions(res.items || []);
      })
      .catch(e => {
        setErr(e.message || 'Failed to fetch routing options');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(fetchOptions, 0);
    return () => window.clearTimeout(timerId);
  }, [fetchOptions]);

  const toggleExpand = () => setExpanded(e => !e);

  return (
    <div className="rounded-xl border overflow-hidden shrink-0"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      
      {/* ── Panel header ── */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 cursor-pointer select-none" onClick={toggleExpand}>
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Network size={16} className="text-purple-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Routing Options API</span>
              {loading && <Loader2 size={11} className="animate-spin" style={{ color: 'var(--muted)' }} />}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                {err ? 'Unable to load LP routes' : `${options.length} LP routes available`}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>· Available LP endpoints</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={fetchOptions} title="Refresh options"
            className="ui-btn ui-btn-ghost ui-btn-icon ui-btn-sm">
            <RefreshCw size={13} />
          </button>
          <button onClick={toggleExpand} className="ui-btn ui-btn-ghost ui-btn-icon ui-btn-sm">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* ── Expanded view ── */}
      {expanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border-3)' }}>
          <ErrBox msg={err} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {options.map((opt) => (
              <div key={opt.id} className="rounded-lg border p-4 flex flex-col gap-3 relative overflow-hidden"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border-3)' }}>
                
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>{opt.name}</span>
                    <span className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-3)' }}>
                      {opt.adapter_type}
                    </span>
                  </div>
                  <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${opt.routing_mode === 'a_book' ? 'bg-blue-500/10 text-white' : 'bg-orange-500/10 text-orange-400'}`}>
                    {opt.routing_mode.replace('_', '-')}</div>
                </div>

                <div className="flex flex-col gap-1.5 mt-1">
                  <KV label="Route Value" value={opt.route_value} mono />
                  <KV label="Connection" value={opt.connected ? 'Connected' : 'Disconnected'} mono />
                  <KV label="Trade Enabled" value={opt.trade_connected ? '✓ Yes' : '✗ No'} mono />
                  {opt.is_internal_route && <KV label="Internal" value="Yes" mono />}
                  {opt.is_external_route && <KV label="External LP" value="Yes" mono />}
                </div>
                
                <div className="mt-2 text-[10px] truncate" style={{ color: 'var(--text-3)' }}>
                  {(!opt.supported_symbols || opt.supported_symbols.length === 0)
                    ? 'No explicit symbols filtered'
                    : `Symbols: ${opt.supported_symbols.join(', ')}`}
                </div>
              </div>
            ))}
            
            {!loading && options.length === 0 && !err && (
              <div className="col-span-full py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
                No routing options available.
              </div>
            )}
          </div>
        </div>
      )}
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

const LPRoutingView = () => {
  const [data, setData]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selectedRow, setSelectedRow] = useState(null);
  const [formOpen, setFormOpen]       = useState(false);
  const [editRoute, setEditRoute]     = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false });
  const [filterEnabled, setFilterEnabled] = useState('all'); // 'all' | 'active' | 'off'
  const [search, setSearch]           = useState('');
  const [blankUiGroup, setBlankUiGroup] = useState(null);

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
      {blankUiGroup ? (
        <GroupDashboardPanel 
          groupName={blankUiGroup} 
          onClose={() => setBlankUiGroup(null)} 
        />
      ) : (
        <>
          {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 px-2 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-[color:var(--border-default)] shrink-0 select-none flex-wrap">
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
                  : 'bg-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]'
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
          className="h-[24px] px-2 text-[11px] bg-[color:var(--bg-app)] border border-black/20 text-[color:var(--text-primary)] placeholder-[color:var(--text-muted)] focus:border-[color:var(--accent-500)] focus:outline-none rounded-[2px] w-44"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition-colors">
            <X size={12} />
          </button>
        )}

        <div className="ml-auto flex items-center gap-2 pr-1">
          <span className="text-[11px] tabular-nums text-[color:var(--text-secondary)]">{filtered.length} route{filtered.length !== 1 ? 's' : ''}</span>
          <button
            onClick={fetchRoutes}
            disabled={loading}
            className="text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Split: Table + Detail Panel ─────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden p-4 gap-4">
        
        <LpRoutingOptionsPanel />

        {/* Table */}
        <div className="flex overflow-hidden flex-1 border border-[color:var(--border-default)] rounded-md">
          <div className="flex flex-col overflow-hidden flex-1">

          {/* Grid Header */}
          <div className="flex bg-[color:var(--bg-surface-2)] border-b border-[color:var(--border-default)] sticky top-0 z-10 select-none shrink-0">
            <div className="w-[60px]  px-3 py-1.5 text-[11px] font-semibold text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] shrink-0">ID</div>
            <div className="w-[72px]  px-3 py-1.5 text-[11px] font-semibold text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] shrink-0">Status</div>
            <div className="w-[160px] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] shrink-0">Group</div>
            <div className="w-[130px] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] shrink-0">Symbol</div>
            <div className="w-[90px]  px-3 py-1.5 text-[11px] font-semibold text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] shrink-0">Mode</div>
            <div className="w-[120px] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] shrink-0">LP Name</div>
            <div className="w-[80px]  px-3 py-1.5 text-[11px] font-semibold text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] shrink-0">Priority</div>
            <div className="w-[130px] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] shrink-0">Fallback</div>
            <div className="w-[80px]  px-3 py-1.5 text-[11px] font-semibold text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] shrink-0">Max Vol</div>
            <div className="flex-1 px-3 py-1.5 bg-[color:var(--bg-surface-2)]"></div>
          </div>

          {/* Grid Body */}
          <div className="flex-1 overflow-auto no-scrollbar bg-[color:var(--bg-app)]" aria-busy={loading}>
            {loading && filtered.length === 0 && (
              <div role="status" className="flex min-h-40 items-center justify-center gap-2 px-6 text-[12px] text-[color:var(--text-secondary)]">
                <RefreshCw size={14} className="animate-spin text-white" />
                Loading routing rules…
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="flex min-h-44 flex-col items-center justify-center gap-2 px-6 text-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--border-default)] bg-[color:var(--bg-surface-2)] text-white">
                  <GitBranch size={17} />
                </div>
                <p className="m-0 text-[13px] font-semibold text-[color:var(--text-primary)]">
                  {data.length === 0 ? 'No routing rules configured' : 'No routes match your filter'}
                </p>
                <p className="m-0 text-[12px] text-[color:var(--text-secondary)]">
                  {data.length === 0 ? 'Create a route to connect a group to an LP.' : 'Try another group, symbol, or LP name.'}
                </p>
                {data.length === 0 && (
                  <button
                    onClick={openCreate}
                    className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-[3px] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface-2)] px-3 text-[11px] text-[color:var(--text-primary)] hover:bg-[color:var(--bg-surface-3)]"
                  >
                    <Plus size={12} /> Add Route
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
                  onDoubleClick={(e) => { e.stopPropagation(); setBlankUiGroup(row.group_name); }}
                  onContextMenu={(e) => handleContextMenu(e, row)}
                  className={`flex cursor-pointer border-b border-[color:var(--border-subtle)] transition-colors
                    ${isSelected
                      ? 'bg-[color:var(--accent-700)] border-l-2 border-l-[color:var(--accent-500)]'
                      : idx % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'}
                    hover:bg-[color:var(--bg-surface-3)]`}
                >
                  {/* ID */}
                  <div className="w-[60px] px-3 py-1 text-[12px] flex items-center gap-1.5 border-r border-[color:var(--border-subtle)] shrink-0">
                    <RouteIcon />
                    <span className="text-[color:var(--text-primary)] font-mono truncate">{rowId ?? '—'}</span>
                  </div>
                  {/* Status */}
                  <div className="w-[72px] px-3 py-1 text-[12px] border-r border-[color:var(--border-subtle)] shrink-0 flex items-center">
                    <span className={`text-[11px] font-semibold ${row.enabled ? 'text-white' : 'text-[#f48771]'}`}>
                      {row.enabled ? 'Active' : 'Off'}
                    </span>
                  </div>
                  {/* Group */}
                  <div className="w-[160px] px-3 py-1 text-[12px] text-white font-medium border-r border-[color:var(--border-subtle)] shrink-0 truncate flex items-center">
                    {row.group_name}
                  </div>
                  {/* Symbol */}
                  <div className="w-[130px] px-3 py-1 text-[12px] font-mono text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] shrink-0 truncate flex items-center">
                    {row.symbol_pattern}
                  </div>
                  {/* Mode */}
                  <div className="w-[90px] px-3 py-1 text-[12px] border-r border-[color:var(--border-subtle)] shrink-0 flex items-center">
                    <span className={`text-[11px] font-semibold ${ROUTING_MODE_COLOR[row.routing_mode] ?? 'text-white'}`}>
                      {ROUTING_MODE_LABEL[row.routing_mode] ?? row.routing_mode}
                    </span>
                  </div>
                  {/* LP Name */}
                  <div className="w-[120px] px-3 py-1 text-[12px] text-[color:var(--text-secondary)] font-medium border-r border-[color:var(--border-subtle)] shrink-0 truncate flex items-center">
                    {row.lp_name}
                  </div>
                  {/* Priority */}
                  <div className="w-[80px] px-3 py-1 text-[12px] text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] shrink-0 truncate flex items-center tabular-nums">
                    {row.priority}
                  </div>
                  {/* Fallback */}
                  <div className="w-[130px] px-3 py-1 text-[11px] text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] shrink-0 truncate flex items-center">
                    {FALLBACK_LABEL[row.fallback_policy] ?? row.fallback_policy}
                  </div>
                  {/* Max Vol */}
                  <div className="w-[80px] px-3 py-1 text-[12px] text-[color:var(--text-secondary)] border-r border-[color:var(--border-subtle)] shrink-0 truncate flex items-center tabular-nums">
                    {row.max_volume ?? '—'}
                  </div>
                  <div className="flex-1 flex items-center justify-end pr-2 gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
                      className="opacity-0 group-hover:opacity-100 text-white hover:text-white transition-colors p-0.5"
                      title="Edit"
                    >
                      <Edit2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}

          </div>
        </div>

        {/* ── Detail Panel ──────────────────────────────────────────────────── */}
        {detailOpen && (
          <div className="w-[300px] flex flex-col border-l border-black/40 bg-[color:var(--bg-app)] shrink-0">
            {/* Panel Header */}
            <div className="flex items-center px-3 h-[30px] bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
              <span className="text-[11px] font-semibold text-white flex-1 truncate">
                Route #{selectedRow.route_id ?? selectedRow.id} — {selectedRow.group_name}
              </span>
              <button
                onClick={() => setSelectedRow(null)}
                className="text-white hover:text-white transition-colors"
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
                    <span className="text-[10px] text-white w-28 shrink-0">{k}</span>
                    <span className={`text-[11px] font-mono truncate ${k === 'Status' ? (selectedRow.enabled ? 'text-white' : 'text-[#f48771]') : 'text-[color:var(--text-primary)]'}`}>
                      {v ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="px-3 py-2.5 flex flex-col gap-2 shrink-0">
              <p className="text-[10px] uppercase tracking-widest text-white font-semibold">Actions</p>
              <button
                onClick={() => handleEdit(selectedRow)}
                className="flex items-center gap-2 h-[26px] px-3 bg-[#2a3a4a] hover:bg-[#3a4a5a] text-white text-[11px] rounded-[2px] transition-colors w-full"
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
                <p className="text-[10px] uppercase tracking-widest text-white font-semibold mb-1.5">Timestamps</p>
                {selectedRow.created_at && (
                  <div className="flex items-center py-0.5">
                    <span className="text-[10px] text-white w-20 shrink-0">Created</span>
                    <span className="text-[10px] font-mono text-white">
                      {new Date(selectedRow.created_at * 1000).toLocaleString()}
                    </span>
                  </div>
                )}
                {selectedRow.updated_at && (
                  <div className="flex items-center py-0.5">
                    <span className="text-[10px] text-white w-20 shrink-0">Updated</span>
                    <span className="text-[10px] font-mono text-white">
                      {new Date(selectedRow.updated_at * 1000).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
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
            <Edit2 size={12} className="text-white" /> Edit Route
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

        </>
      )}
    </div>
  );
};

export default LPRoutingView;
