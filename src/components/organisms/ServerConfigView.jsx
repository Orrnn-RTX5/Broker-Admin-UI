import React, { useState, useEffect } from 'react';
import { ServerConfigService } from '../../services/serverConfig.service';
import { AlertTriangle, RefreshCw, Save, Search, ShieldOff, ShieldCheck } from 'lucide-react';
import ActionableErrorState from '../atoms/ActionableErrorState';
import LpSymbolDatalist from '../atoms/LpSymbolDatalist';
import { getApiErrorMessage } from '../../utils/apiShapes';
import {
  DEMO_DISABLE_CONFIRM_MESSAGE,
  normalizeDemoAccountGroupState,
  buildDemoServerWarning,
  buildDemoGroupStatus,
  buildDemoGroupOptions,
  initialDemoGroupSelection,
  isDemoGroupSelectionChanged,
} from '../../utils/demoAccountGroup';

const TABS = ['Server Status', 'Server Settings', 'Swap Rates', 'Trading Halt', 'Demo Accounts'];

// ─── Server Status ───────────────────────────────────────────────────────────
const ServerStatusTab = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try { setData(await ServerConfigService.getServerStatus()); }
    catch (err) {
      setData(null);
      setError(getApiErrorMessage(err, 'Server status failed to load.'));
    }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex items-center justify-center flex-1 text-[#888] text-[11px]">Loading…</div>;
  if (error) return <ActionableErrorState title="Unable to load data" message={error} actionLabel="Refresh" onAction={load} />;
  if (!data) return <div className="flex items-center justify-center flex-1 text-[#555] text-[11px]">No data.</div>;

  const { db_pool, ...top } = data;

  const statusColor = (v) => {
    if (typeof v === 'string') return v === 'connected' ? 'text-[#4ec9b0]' : 'text-[#f48771]';
    if (typeof v === 'number') return 'text-[#9cdcfe]';
    return 'text-[color:var(--text-primary)]';
  };

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-semibold text-[#9cdcfe]">Live Server Health</span>
        <button onClick={load} className="flex items-center gap-1.5 h-[22px] px-3 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px]">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>
      <div className="flex gap-4 flex-wrap">
        {/* Top-level stats */}
        <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--bg-surface-2)] rounded-[3px] divide-y divide-black/30 min-w-[260px]">
          {Object.entries(top).map(([k, v]) => (
            <div key={k} className="flex items-center px-4 h-[32px]">
              <span className="text-[11px] text-[#888] flex-1">{k.replace(/_/g, ' ')}</span>
              <span className={`text-[12px] font-mono font-semibold ${statusColor(v)}`}>{String(v)}</span>
            </div>
          ))}
        </div>
        {/* DB Pool */}
        {db_pool && (
          <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--bg-surface-2)] rounded-[3px] min-w-[220px]">
            <div className="px-4 h-[28px] flex items-center border-b border-black/30">
              <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wider">DB Pool</span>
            </div>
            {Object.entries(db_pool).map(([k, v]) => (
              <div key={k} className="flex items-center px-4 h-[32px] border-b border-black/20 last:border-0">
                <span className="text-[11px] text-[#888] flex-1">{k.replace(/_/g, ' ')}</span>
                <span className="text-[12px] font-mono font-semibold text-[#9cdcfe]">{String(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Server Settings ─────────────────────────────────────────────────────────
const ServerSettingsTab = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editKey, setEditKey] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchKey, setSearchKey] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try { setData(await ServerConfigService.listServerSettings() ?? []); }
    catch (err) {
      setData([]);
      setError(getApiErrorMessage(err, 'Server settings failed to load.'));
    }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  const handleSave = async (key) => {
    setSaving(true);
    try {
      await ServerConfigService.setServerSetting(key, editVal);
      setData(d => d.map(r => r.key === key ? { ...r, value: editVal } : r));
      setEditKey(null);
    } catch (err) { alert('Failed: ' + (err.response?.data?.message || err.message)); }
    finally { setSaving(false); }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchKey.trim()) return;
    setSearching(true);
    try { setSearchResult(await ServerConfigService.getServerSetting(searchKey.trim())); }
    catch (err) { alert('Failed: ' + (err.response?.data?.message || err.message)); }
    finally { setSearching(false); }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0 flex-wrap">
        <button onClick={loadAll} className="flex items-center gap-1.5 h-[24px] px-3 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px]">
          <RefreshCw size={11} /> Refresh
        </button>
        <form onSubmit={handleSearch} className="flex items-center gap-1.5 ml-4">
          <span className="text-[10px] text-[#888]">Get key</span>
          <input value={searchKey} onChange={e => setSearchKey(e.target.value)} placeholder="e.g. max_leverage"
            className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-2 w-36 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]" />
          <button type="submit" disabled={searching}
            className="flex items-center gap-1 h-[22px] px-3 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px]">
            <Search size={11} /> {searching ? '…' : 'Get'}
          </button>
        </form>
        {searchResult && (
          <div className="flex items-center gap-2 bg-[color:var(--accent-700)] border border-[color:var(--accent-500)]/40 rounded-[2px] px-3 h-[22px]">
            <span className="text-[11px] text-[#9cdcfe]">{searchResult.key}</span>
            <span className="text-[10px] text-[#555]">=</span>
            <span className="text-[11px] font-mono text-[color:var(--text-primary)]">{searchResult.value}</span>
            <button onClick={() => setSearchResult(null)} className="text-[#555] hover:text-[#ccc] text-[11px] ml-1">×</button>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center px-3 h-[24px] bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0">
        <div className="w-64 text-[10px] font-semibold text-[#888] uppercase tracking-wider pr-3">Key</div>
        <div className="flex-1 text-[10px] font-semibold text-[#888] uppercase tracking-wider pr-3">Value</div>
        <div className="w-20 text-[10px] font-semibold text-[#888] uppercase tracking-wider">Action</div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-auto">
        {loading
          ? <div className="flex items-center justify-center h-24 text-[#888] text-[11px]">Loading…</div>
          : error
            ? <ActionableErrorState title="Unable to load data" message={error} actionLabel="Refresh" onAction={loadAll} compact />
            : data.length === 0
            ? <div className="flex items-center justify-center h-24 text-[#555] text-[11px]">No settings found.</div>
            : data.map((row, i) => (
              <div key={row.key}
                className={`flex items-center px-3 h-[26px] border-b border-black/20 ${i % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-[#2a2d2e]`}>
                <div className="w-64 text-[11px] text-[#9cdcfe] pr-3 font-mono">{row.key}</div>
                <div className="flex-1 pr-3">
                  {editKey === row.key
                    ? <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSave(row.key); if (e.key === 'Escape') setEditKey(null); }}
                        className="w-full bg-[color:var(--bg-app)] border border-[color:var(--accent-500)] text-[color:var(--text-primary)] text-[11px] h-[20px] px-2 rounded-[2px] outline-none font-mono" />
                    : <span className="text-[11px] text-[color:var(--text-primary)] font-mono">{row.value}</span>}
                </div>
                <div className="w-20 flex items-center gap-1">
                  {editKey === row.key ? (
                    <>
                      <button onClick={() => handleSave(row.key)} disabled={saving}
                        className="h-[18px] px-2 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[10px] rounded-[2px] disabled:opacity-50">
                        {saving ? '…' : 'Save'}
                      </button>
                      <button onClick={() => setEditKey(null)}
                        className="h-[18px] px-1.5 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[10px] rounded-[2px]">✕</button>
                    </>
                  ) : (
                    <button onClick={() => { setEditKey(row.key); setEditVal(row.value); }}
                      className="h-[18px] px-2 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--accent-700)] text-[#ccc] hover:text-[#9cdcfe] text-[10px] rounded-[2px]">Edit</button>
                  )}
                </div>
              </div>
            ))}
      </div>
    </div>
  );
};

// ─── Swap Rates ───────────────────────────────────────────────────────────────
const SwapRatesTab = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [symbolSearch, setSymbolSearch] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [editRow, setEditRow] = useState(null); // { symbol, long, short }
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try { setData(await ServerConfigService.listSwapRates() ?? []); }
    catch (err) {
      setData([]);
      setError(getApiErrorMessage(err, 'Swap rates failed to load.'));
    }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!symbolSearch.trim()) return;
    try { setSearchResult(await ServerConfigService.getSwapRate(symbolSearch.trim().toUpperCase())); }
    catch (err) { alert('Failed: ' + (err.response?.data?.message || err.message)); }
  };

  const openEdit = (row) => setEditRow({ symbol: row.symbol, long: String(row.swap_long), short: String(row.swap_short) });

  const handleSave = async () => {
    setSaving(true);
    try {
      await ServerConfigService.setSwapRate(
        editRow.symbol,
        editRow.long !== '' ? parseFloat(editRow.long) : null,
        editRow.short !== '' ? parseFloat(editRow.short) : null,
      );
      setData(d => d.map(r => r.symbol === editRow.symbol
        ? { ...r, swap_long: parseFloat(editRow.long), swap_short: parseFloat(editRow.short) }
        : r));
      setEditRow(null);
    } catch (err) { alert('Failed: ' + (err.response?.data?.message || err.message)); }
    finally { setSaving(false); }
  };

  const swapColor = (v) => (v >= 0 ? 'text-[#4ec9b0]' : 'text-[#f48771]');

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0 flex-wrap">
        <button onClick={loadAll} className="flex items-center gap-1.5 h-[24px] px-3 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px]">
          <RefreshCw size={11} /> Refresh
        </button>
        <form onSubmit={handleSearch} className="flex items-center gap-1.5 ml-4">
          <span className="text-[10px] text-[#888]">Symbol</span>
          <input value={symbolSearch} onChange={e => setSymbolSearch(e.target.value)} placeholder="e.g. EURUSD"
            list="swap-rate-symbol-options" autoComplete="off"
            className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-2 w-28 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]" />
          <LpSymbolDatalist id="swap-rate-symbol-options" />
          <button type="submit" className="flex items-center gap-1 h-[22px] px-3 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px]">
            <Search size={11} /> Get
          </button>
        </form>
        {searchResult && (
          <div className="flex items-center gap-3 bg-[color:var(--accent-700)] border border-[color:var(--accent-500)]/40 rounded-[2px] px-3 h-[22px]">
            <span className="text-[11px] text-[#9cdcfe] font-mono">{searchResult.symbol}</span>
            <span className="text-[10px] text-[#888]">Long: <span className={`font-mono ${swapColor(searchResult.swap_long)}`}>{searchResult.swap_long}</span></span>
            <span className="text-[10px] text-[#888]">Short: <span className={`font-mono ${swapColor(searchResult.swap_short)}`}>{searchResult.swap_short}</span></span>
            <button onClick={() => setSearchResult(null)} className="text-[#555] hover:text-[#ccc] text-[11px] ml-1">×</button>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center px-3 h-[24px] bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0">
        {[['Symbol','w-32'],['Swap Long','w-32'],['Swap Short','w-32'],['Rollover Day','w-28'],['Action','w-20']].map(([l,w]) => (
          <div key={l} className={`${w} text-[10px] font-semibold text-[#888] uppercase tracking-wider pr-3`}>{l}</div>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {loading
          ? <div className="flex items-center justify-center h-24 text-[#888] text-[11px]">Loading…</div>
          : error
            ? <ActionableErrorState title="Unable to load data" message={error} actionLabel="Refresh" onAction={loadAll} compact />
          : data.length === 0
            ? <div className="flex items-center justify-center h-24 text-[#555] text-[11px]">No swap rates found.</div>
            : data.map((row, i) => (
              <div key={row.symbol}
                className={`flex items-center px-3 h-[26px] border-b border-black/20 ${i % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-[#2a2d2e]`}>
                <div className="w-32 text-[11px] text-[#9cdcfe] pr-3 font-mono font-semibold">{row.symbol}</div>
                <div className="w-32 pr-3">
                  {editRow?.symbol === row.symbol
                    ? <input value={editRow.long} onChange={e => setEditRow(r => ({ ...r, long: e.target.value }))}
                        className="w-24 bg-[color:var(--bg-app)] border border-[color:var(--accent-500)] text-[color:var(--text-primary)] text-[11px] h-[20px] px-2 rounded-[2px] outline-none font-mono" />
                    : <span className={`text-[11px] font-mono ${swapColor(row.swap_long)}`}>{row.swap_long}</span>}
                </div>
                <div className="w-32 pr-3">
                  {editRow?.symbol === row.symbol
                    ? <input value={editRow.short} onChange={e => setEditRow(r => ({ ...r, short: e.target.value }))}
                        className="w-24 bg-[color:var(--bg-app)] border border-[color:var(--accent-500)] text-[color:var(--text-primary)] text-[11px] h-[20px] px-2 rounded-[2px] outline-none font-mono" />
                    : <span className={`text-[11px] font-mono ${swapColor(row.swap_short)}`}>{row.swap_short}</span>}
                </div>
                <div className="w-28 text-[11px] text-[#888] pr-3">{row.swap_rollover_3days ?? '—'}</div>
                <div className="w-20 flex items-center gap-1">
                  {editRow?.symbol === row.symbol ? (
                    <>
                      <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-1 h-[18px] px-2 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[10px] rounded-[2px] disabled:opacity-50">
                        <Save size={9} /> {saving ? '…' : 'Save'}
                      </button>
                      <button onClick={() => setEditRow(null)}
                        className="h-[18px] px-1.5 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[10px] rounded-[2px]">✕</button>
                    </>
                  ) : (
                    <button onClick={() => openEdit(row)}
                      className="h-[18px] px-2 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--accent-700)] text-[#ccc] hover:text-[#9cdcfe] text-[10px] rounded-[2px]">Edit</button>
                  )}
                </div>
              </div>
            ))}
      </div>

      {/* Inline modal for edit confirmation if needed */}
    </div>
  );
};

// ─── Trading Halt ─────────────────────────────────────────────────────────────
const TradingHaltTab = () => {
  const [symbol, setSymbol] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const handleHalt = async (enabled) => {
    if (!symbol.trim()) { alert('Symbol is required.'); return; }
    setLoading(true);
    try {
      const res = await ServerConfigService.setTradingHalt(symbol.trim().toUpperCase(), enabled, reason || undefined);
      setLastResult(res);
    } catch (err) { alert('Failed: ' + (err.response?.data?.message || err.message)); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-[400px] flex flex-col gap-4">
        <div className="text-[12px] font-semibold text-[#9cdcfe]">Halt / Resume Trading</div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[#f48771] uppercase tracking-wider">Symbol *</label>
          <input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="e.g. EURUSD"
            list="trading-halt-symbol-options" autoComplete="off"
            className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[26px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)] w-48 font-mono" />
          <LpSymbolDatalist id="trading-halt-symbol-options" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[#888] uppercase tracking-wider">Reason (optional)</label>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Scheduled maintenance"
            className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[26px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]" />
        </div>

        <div className="flex gap-2">
          <button onClick={() => handleHalt(true)} disabled={loading}
            className="flex items-center gap-1.5 h-[28px] px-4 bg-[#f48771]/20 hover:bg-[#f48771]/30 border border-[#f48771]/50 text-[#f48771] text-[11px] rounded-[2px] disabled:opacity-50">
            <ShieldOff size={13} /> Halt Trading
          </button>
          <button onClick={() => handleHalt(false)} disabled={loading}
            className="flex items-center gap-1.5 h-[28px] px-4 bg-[#4ec9b0]/10 hover:bg-[#4ec9b0]/20 border border-[#4ec9b0]/40 text-[#4ec9b0] text-[11px] rounded-[2px] disabled:opacity-50">
            <ShieldCheck size={13} /> Resume Trading
          </button>
        </div>

        {lastResult && (
          <div className={`bg-[color:var(--bg-surface-1)] border rounded-[3px] px-4 py-3 flex flex-col gap-1 ${lastResult.halted ? 'border-[#f48771]/40' : 'border-[#4ec9b0]/40'}`}>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-semibold text-[#9cdcfe]">{lastResult.symbol}</span>
              <span className={`text-[11px] font-semibold ${lastResult.halted ? 'text-[#f48771]' : 'text-[#4ec9b0]'}`}>
                {lastResult.halted ? '● HALTED' : '● LIVE'}
              </span>
            </div>
            {lastResult.reason && <div className="text-[10px] text-[#888]">{lastResult.reason}</div>}
          </div>
        )}

        <p className="text-[10px] text-[#555] mt-2">
          Halt state is stored in Redis (<span className="font-mono">rtx5:halt:SYMBOL</span>). Persists until manually resumed.
        </p>
      </div>
    </div>
  );
};

// ─── Demo Accounts ────────────────────────────────────────────────────────────
const DEMO_STATUS_TONE = {
  ok:    { border: 'border-[#4ec9b0]/40', text: 'text-[#4ec9b0]' },
  info:  { border: 'border-[color:var(--accent-500)]/40', text: 'text-[#9cdcfe]' },
  warning: { border: 'border-orange-400/50', text: 'text-orange-400' },
  error: { border: 'border-[#f48771]/50', text: 'text-[#f48771]' },
};

const DemoAccountsTab = () => {
  const [state, setState] = useState(null);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const next = normalizeDemoAccountGroupState(await ServerConfigService.getDemoAccountGroup());
      setState(next);
      setSelected(initialDemoGroupSelection(next));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Demo account group failed to load.'));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      await ServerConfigService.setDemoAccountGroup({ group: selected });
      setSaved(true);
      await load();
    } catch (err) {
      setSaveError(getApiErrorMessage(err, 'Failed to save the demo account group.'));
    } finally { setSaving(false); }
  };

  // The admin switch saves immediately; disabling asks for confirmation first.
  const handleToggleSignup = async () => {
    if (!state || toggling) return;
    const next = !state.signupEnabled;
    if (!next && !window.confirm(DEMO_DISABLE_CONFIRM_MESSAGE)) return;
    setToggling(true);
    setToggleError('');
    try {
      await ServerConfigService.setDemoAccountGroup({ signupEnabled: next });
      await load();
    } catch (err) {
      setToggleError(getApiErrorMessage(err, 'Failed to change demo signup.'));
    } finally { setToggling(false); }
  };

  if (!state && loading) return <div className="flex items-center justify-center flex-1 text-[#888] text-[11px]">Loading…</div>;
  if (!state && error) return <ActionableErrorState title="Unable to load data" message={error} actionLabel="Refresh" onAction={load} />;
  if (!state) return <div className="flex items-center justify-center flex-1 text-[#555] text-[11px]">No data.</div>;

  const status = buildDemoGroupStatus(state);
  const tone = DEMO_STATUS_TONE[status.tone] || DEMO_STATUS_TONE.info;
  const options = buildDemoGroupOptions(state);
  const changed = isDemoGroupSelectionChanged(state, selected);
  const serverWarning = buildDemoServerWarning(state);
  const signupOn = state.signupEnabled;
  const busy = saving || toggling;

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-[520px] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[#9cdcfe]">Demo Accounts</span>
          <button onClick={load} disabled={loading || busy}
            className="flex items-center gap-1.5 h-[22px] px-3 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px] disabled:opacity-50">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {error && <ActionableErrorState title="Unable to refresh" message={error} actionLabel="Refresh" onAction={load} compact />}

        {/* Admin switch for web-terminal demo signup (saves immediately). */}
        <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--bg-surface-2)] rounded-[3px] px-4 py-3 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span id="demo-signup-switch-label" className="text-[11px] text-[color:var(--text-primary)] flex-1">
              Allow demo account creation from the web terminal
            </span>
            <button type="button" role="switch" aria-checked={signupOn} aria-labelledby="demo-signup-switch-label"
              onClick={handleToggleSignup} disabled={busy || loading}
              className={`relative w-[34px] h-[18px] rounded-full border transition-colors disabled:opacity-50 shrink-0 ${signupOn ? 'bg-[#4ec9b0]/30 border-[#4ec9b0]/60' : 'bg-[color:var(--bg-surface-2)] border-[#555]'}`}>
              <span className={`absolute top-[2px] w-[12px] h-[12px] rounded-full transition-all ${signupOn ? 'left-[18px] bg-[#4ec9b0]' : 'left-[2px] bg-[#888]'}`} />
            </button>
            <span className={`text-[11px] font-semibold w-[64px] ${signupOn ? 'text-[#4ec9b0]' : 'text-orange-400'}`}>
              {toggling ? 'Saving…' : signupOn ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          {!state.serverEnabled && (
            <span className="text-[10px] text-[#888]">
              This switch has no effect until demo signup is switched on on the server.
            </span>
          )}
          {toggleError && <ActionableErrorState title="Change failed" message={toggleError} compact />}
        </div>

        {serverWarning && (
          <div role="alert" className="bg-[#f48771]/10 border border-[#f48771]/50 rounded-[3px] px-4 py-3 flex items-start gap-2">
            <AlertTriangle size={13} className="text-[#f48771] shrink-0 mt-0.5" />
            <span className="text-[11px] font-semibold break-words text-[#f48771]">{serverWarning}</span>
          </div>
        )}

        <div role="status" className={`bg-[color:var(--bg-surface-1)] border rounded-[3px] px-4 py-3 flex items-start gap-2 ${tone.border}`}>
          {(status.tone === 'error' || status.tone === 'warning') && <AlertTriangle size={13} className={`${tone.text} shrink-0 mt-0.5`} />}
          <span className={`text-[11px] font-semibold break-words ${tone.text}`}>{status.message}</span>
        </div>

        {/* Group section: stays usable when signup is off, but visually secondary. */}
        <div className={`flex flex-col gap-4 transition-opacity ${signupOn ? '' : 'opacity-60'}`}>
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-[#9cdcfe]">Demo Account Group</span>
            <p className="text-[11px] text-[#888]">Demo accounts created from the web terminal are opened in this group.</p>
            {!signupOn && (
              <p className="text-[10px] text-orange-400">Demo signup is disabled — the group applies once signup is enabled.</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="demo-account-group-select" className="text-[10px] text-[#888] uppercase tracking-wider">Demo group</label>
            <select id="demo-account-group-select" value={selected} disabled={busy}
              onChange={e => { setSelected(e.target.value); setSaved(false); setSaveError(''); }}
              className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[26px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)] font-mono disabled:opacity-50">
              {options.map(o => (
                <option key={o.value || '__automatic__'} value={o.value} disabled={o.disabled}>{o.label}</option>
              ))}
            </select>
            {state.demoGroups.length === 0 && (
              <span className="text-[10px] text-[#555]">No enabled demo groups found for this broker.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={busy || !changed}
              className="flex items-center gap-1.5 h-[28px] px-4 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] disabled:opacity-50">
              <Save size={12} /> {saving ? 'Saving…' : 'Save'}
            </button>
            {saved && !saveError && <span className="text-[11px] text-[#4ec9b0]">Saved</span>}
          </div>

          {saveError && <ActionableErrorState title="Save failed" message={saveError} compact />}

          <div className="text-[10px] text-[#555] mt-2 flex flex-col gap-1">
            <p>Change: pick another group and Save.</p>
            <p>Automatic: new demo accounts go to the alphabetically first demo group.</p>
            <p>To stop demo accounts entirely, use the switch above.</p>
            <p>Only this broker's enabled groups with "Demo Account" checked can be selected.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
const ServerConfigView = () => {
  const [tab, setTab] = useState('Server Status');

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden">
      <div className="flex items-center bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 h-[30px] text-[11px] border-r border-black/30 whitespace-nowrap transition-colors ${tab === t ? 'bg-[color:var(--bg-app)] text-[color:var(--text-primary)] border-t-2 border-t-[color:var(--accent-500)]' : 'text-[#888] hover:text-[#ccc]'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Server Status'   && <ServerStatusTab />}
      {tab === 'Server Settings' && <ServerSettingsTab />}
      {tab === 'Swap Rates'      && <SwapRatesTab />}
      {tab === 'Trading Halt'    && <TradingHaltTab />}
      {tab === 'Demo Accounts'   && <DemoAccountsTab />}
    </div>
  );
};

export default ServerConfigView;
