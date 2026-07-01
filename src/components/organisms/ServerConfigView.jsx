import React, { useState, useEffect } from 'react';
import { ServerConfigService } from '../../services/serverConfig.service';
import { RefreshCw, Save, Search, ShieldOff, ShieldCheck } from 'lucide-react';
import ActionableErrorState from '../atoms/ActionableErrorState';
import { getApiErrorMessage } from '../../utils/apiShapes';

const TABS = ['Server Status', 'Server Settings', 'Swap Rates', 'Trading Halt'];

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
            className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-2 w-28 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]" />
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
            className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[26px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)] w-48 font-mono" />
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
    </div>
  );
};

export default ServerConfigView;
