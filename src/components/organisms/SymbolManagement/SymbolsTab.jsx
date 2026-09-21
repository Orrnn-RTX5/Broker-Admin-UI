import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Copy, ToggleLeft, ToggleRight, Edit2, Loader2, ChevronDown, X } from 'lucide-react';
import {
  symbolClone, symbolCategoryList,
} from '../../../services/api';
import { InstrumentsService } from '../../../services/instruments.service';
import { buildFeedWsUrl } from '../../../config/endpoints';
import { getApiErrorMessage, normalizeArrayResponse } from '../../../utils/apiShapes';
import { buildActionableErrorState } from '../../../utils/errorState';
import SymbolFormModal from './SymbolFormModal';
import ActionableErrorState from '../../atoms/ActionableErrorState';

const SYMBOL_MANAGEMENT_LIMIT = 5000;
const CATEGORY_LOAD_TIMEOUT_MS = 7000;
const SYMBOL_RESPONSE_KEYS = ['instruments', 'symbols', 'data', 'answer', 'items', 'rows', 'value'];
const CATEGORY_RESPONSE_KEYS = ['categories', 'data', 'answer', 'items', 'rows', 'value'];

const withTimeout = (promise, timeoutMs, message) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(message)), timeoutMs);

  Promise.resolve(promise)
    .then((value) => {
      clearTimeout(timer);
      resolve(value);
    })
    .catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
});

const normalizeSymbolManagementRows = (response) =>
  normalizeArrayResponse(response, SYMBOL_RESPONSE_KEYS)
    .map((row) => {
      if (typeof row === 'string') {
        return { symbol: row, name: row, symbolType: 'base', enabled: true };
      }

      if (!row || typeof row !== 'object') return null;

      const symbol = row.symbol || row.Symbol || row.name || row.Name || '';
      if (!symbol) return null;
      const parentSymbol = row.parentSymbol || row.ParentSymbol || row.parent_symbol || '';

      return {
        ...row,
        symbol,
        name: row.name || row.Name || symbol,
        symbolType: row.symbolType || row.SymbolType || row.symbol_type || (parentSymbol ? 'derived' : 'base'),
        parentSymbol,
        category: row.category || row.Category || '',
        enabled: row.enabled ?? row.Enabled ?? true,
      };
    })
    .filter(Boolean);

const normalizeCategoryRows = (response) =>
  normalizeArrayResponse(response, CATEGORY_RESPONSE_KEYS)
    .map((row) => {
      if (typeof row === 'string') return { name: row };
      if (!row || typeof row !== 'object') return null;

      const name = row.name || row.Name || row.category || row.Category || '';
      return name ? { ...row, name } : null;
    })
    .filter(Boolean);

// ─── Add / Edit Modal ──────────────────────────────────────────────────────────
// ─── Clone Modal ───────────────────────────────────────────────────────────────
// localStorage cache for symbol names (instant open after first use)
const SYMBOL_CACHE_KEY = 'rtx-clone-symbol-names-cache';
const readSymbolCache = () => {
  try {
    const raw = localStorage.getItem(SYMBOL_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};
const writeSymbolCache = (names) => {
  try { localStorage.setItem(SYMBOL_CACHE_KEY, JSON.stringify(names)); } catch { /* quota */ }
};

const CloneModal = ({ categories, onClose, onSuccess }) => {
  const cached = readSymbolCache();
  const [baseSymbols, setBaseSymbols] = useState(cached);
  // If we have cached names, never block the dropdown — refresh silently in the background.
  const [loadingSymbols, setLoadingSymbols] = useState(cached.length === 0);
  const [refreshing, setRefreshing] = useState(cached.length > 0);
  const [form, setForm] = useState({
    baseSymbol: '',
    newSymbol: '',
    description: '',
    spreadMarkupPips: 0,
    contractSize: 100000,
    minVolume: 0.01,
    maxVolume: 100,
    volumeStep: 0.01,
    category: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [wsError, setWsError] = useState(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  // Fetch symbol names from the FIX WebSocket feed.
  // Cache hit  → render instantly, refresh silently in background.
  // Cache miss → animated skeleton until first batch arrives (max 3s).
  useEffect(() => {
    const ws = new WebSocket(buildFeedWsUrl());
    const symbolSet = new Set(cached);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', symbols: ['*'] }));
    };

    ws.onmessage = (e) => {
      try {
        const messages = e.data.trim().split('\n');
        for (let i = 0; i < messages.length; i++) {
          if (!messages[i]) continue;
          const msg = JSON.parse(messages[i]);
          if (msg.symbol) symbolSet.add(msg.symbol);
        }
      } catch { /* ignore parse errors */ }
    };

    const timer = setTimeout(() => {
      const symbols = Array.from(symbolSet).sort();
      setBaseSymbols(symbols);
      setLoadingSymbols(false);
      setRefreshing(false);
      writeSymbolCache(symbols);
      if (symbols.length === 0) {
        setWsError(buildActionableErrorState('No source symbols arrived from the feed within 3 seconds.', {
          title: 'Source symbols unavailable',
          actionLabel: 'Retry feed',
        }));
      }
      if (ws.readyState === WebSocket.OPEN) ws.close();
    }, 3000);

    ws.onerror = () => {
      setLoadingSymbols(false);
      setRefreshing(false);
      setWsError(buildActionableErrorState('The feed WebSocket connection failed before source symbols were loaded.', {
        title: 'Symbol feed failed',
        actionLabel: 'Retry feed',
      }));
    };

    return () => {
      clearTimeout(timer);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.onclose = null;
        ws.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAttempt]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const retryFeed = () => {
    setWsError(null);
    setLoadingSymbols(baseSymbols.length === 0);
    setRefreshing(baseSymbols.length > 0);
    setLoadAttempt(attempt => attempt + 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      await symbolClone(form);
      onSuccess();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="ui-card w-full max-w-md p-6 flex flex-col gap-4" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Clone Symbol</h2>
          <button onClick={onClose} className="ui-btn ui-btn-ghost ui-btn-icon ui-btn-sm"><X size={14} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium flex items-center gap-1.5" style={{ color: 'var(--text-2)' }}>
              Source Symbol *
              {refreshing && (
                <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--muted)' }}>
                  <Loader2 size={10} className="animate-spin" /> refreshing
                </span>
              )}
            </label>
            {loadingSymbols ? (
              <div className="ui-input ui-input-sm relative overflow-hidden flex items-center" style={{ pointerEvents: 'none' }}>
                <span
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent 0%, var(--surface-2, rgba(255,255,255,0.08)) 50%, transparent 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'rtxSkeletonShimmer 1.2s linear infinite',
                  }}
                />
                <span className="relative inline-flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                  <Loader2 size={12} className="animate-spin" />
                  Loading symbols from feed…
                </span>
                <style>{`@keyframes rtxSkeletonShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
              </div>
            ) : (
              <select className="ui-input ui-input-sm" value={form.baseSymbol} onChange={e => set('baseSymbol', e.target.value)} required>
                <option value="">— select —</option>
                {baseSymbols.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}
            {wsError && (
              <ActionableErrorState state={wsError} onAction={retryFeed} compact className="m-0" />
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>New Symbol Name *</label>
            <input className="ui-input ui-input-sm" value={form.newSymbol} onChange={e => set('newSymbol', e.target.value)} required placeholder="e.g. EURUSDpro" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Description</label>
            <input className="ui-input ui-input-sm" value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Spread Markup (pips)</label>
              <input type="number" className="ui-input ui-input-sm" value={form.spreadMarkupPips} onChange={e => set('spreadMarkupPips', +e.target.value)} min={0} step={0.1} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Contract Size</label>
              <input type="number" className="ui-input ui-input-sm" value={form.contractSize} onChange={e => set('contractSize', +e.target.value)} min={1} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Min Vol</label>
              <input type="number" className="ui-input ui-input-sm" value={form.minVolume} onChange={e => set('minVolume', +e.target.value)} step={0.01} min={0.01} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Max Vol</label>
              <input type="number" className="ui-input ui-input-sm" value={form.maxVolume} onChange={e => set('maxVolume', +e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Vol Step</label>
              <input type="number" className="ui-input ui-input-sm" value={form.volumeStep} onChange={e => set('volumeStep', +e.target.value)} step={0.01} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Category</label>
            <select className="ui-input ui-input-sm" value={form.category} onChange={e => set('category', e.target.value)}>
              <option value="">— none —</option>
              {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          {err && <p className="text-xs" style={{ color: 'var(--danger)' }}>{err}</p>}
          <div className="flex justify-end gap-2 mt-1">
            <button type="button" onClick={onClose} className="ui-btn ui-btn-secondary ui-btn-sm">Cancel</button>
            <button type="submit" disabled={saving} className="ui-btn ui-btn-primary ui-btn-sm">
              {saving ? <Loader2 size={13} className="animate-spin" /> : 'Clone'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main Tab ──────────────────────────────────────────────────────────────────
const SymbolsTab = () => {
  const [symbols, setSymbols] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterEnabled, setFilterEnabled] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | 'edit' | 'clone'
  const [editTarget, setEditTarget] = useState(null);
  const [togglingSymbol, setTogglingSymbol] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [savedNotice, setSavedNotice] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [symsResult, catsResult] = await Promise.allSettled([
        InstrumentsService.getConfiguredInstruments({ page: 1, limit: SYMBOL_MANAGEMENT_LIMIT, search: '', enabled: '' }),
        withTimeout(
          symbolCategoryList(),
          CATEGORY_LOAD_TIMEOUT_MS,
          'category list request timed out'
        ),
      ]);
      const failures = [];
      if (symsResult.status === 'fulfilled') {
        setSymbols(normalizeSymbolManagementRows(symsResult.value));
      } else {
        setSymbols([]);
        failures.push(`Symbols: ${getApiErrorMessage(symsResult.reason, 'symbol list request failed')}`);
      }
      if (catsResult.status === 'fulfilled') {
        setCategories(normalizeCategoryRows(catsResult.value));
      } else {
        setCategories([]);
        failures.push(`Categories: ${getApiErrorMessage(catsResult.reason, 'category list request failed')}`);
      }
      if (failures.length > 0) {
        setLoadError(buildActionableErrorState(failures.join(' '), {
          title: symsResult.status === 'rejected' ? 'Symbols failed to load' : 'Symbols partially loaded',
          actionLabel: 'Retry',
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      load();
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, []);

  const handleToggle = async (sym) => {
    setTogglingSymbol(sym.symbol);
    try {
      const targetEnabled = !sym.enabled;
      const result = await InstrumentsService.toggleInstrument(sym.symbol, targetEnabled);
      const enabled = typeof result?.enabled === 'boolean' ? result.enabled : targetEnabled;
      setSymbols(prev => prev.map(s => s.symbol === sym.symbol ? { ...s, enabled } : s));
    } catch (e) {
      alert('Error: ' + getApiErrorMessage(e, 'instrument toggle failed'));
    } finally {
      setTogglingSymbol(null);
    }
  };

  const filtered = useMemo(() => {
    return symbols.filter(s => {
      if (search && !(s.symbol || '').toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategory && s.category !== filterCategory) return false;
      if (filterType === 'base' && s.symbolType !== 'base') return false;
      if (filterType === 'derived' && s.symbolType !== 'derived') return false;
      if (filterEnabled === 'enabled' && !s.enabled) return false;
      if (filterEnabled === 'disabled' && s.enabled) return false;
      return true;
    });
  }, [symbols, search, filterCategory, filterType, filterEnabled]);

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted)' }} />
          <input className="ui-input ui-input-sm" style={{ paddingLeft: 30, width: 200 }} placeholder="Search symbols…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="ui-input ui-input-sm" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ width: 150 }}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
        <select className="ui-input ui-input-sm" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 130 }}>
          <option value="">All Types</option>
          <option value="base">Base</option>
          <option value="derived">Derived</option>
        </select>
        <select className="ui-input ui-input-sm" value={filterEnabled} onChange={e => setFilterEnabled(e.target.value)} style={{ width: 130 }}>
          <option value="">All Status</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
        <div className="flex-1" />
        <button onClick={() => setModal('clone')} className="ui-btn ui-btn-secondary ui-btn-sm">
          <Copy size={13} /> Clone
        </button>
        <button onClick={() => { setEditTarget(null); setModal('add'); }} className="ui-btn ui-btn-primary ui-btn-sm">
          <Plus size={13} /> Add Symbol
        </button>
      </div>
      {loadError && (
        <ActionableErrorState state={loadError} onAction={load} compact className="m-0 shrink-0" />
      )}

      {savedNotice && <p role="status" className="text-xs">{savedNotice}</p>}
      <p className="text-xs" style={{color: 'var(--text-2)'}}>Enabled symbols remain subject to account group permissions, trading sessions and fresh executable quotes.</p>
      {/* Table */}
      <div className="ui-card flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'var(--muted)' }}>
            <Loader2 size={16} className="animate-spin mr-2" /> Loading symbols…
          </div>
        ) : (
          <table className="ui-grid w-full">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Type</th>
                <th>Category</th>
                <th>Digits</th>
                <th>Contract Size</th>
                <th>Spread</th>
                <th>Calc Mode</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-sm" style={{ color: 'var(--muted)' }}>No symbols found.</td></tr>
              ) : filtered.map(s => (
                <tr key={s.symbol}>
                  <td style={{ color: 'var(--text)', fontWeight: 500 }}>
                    {s.symbol}
                    {s.symbolType === 'derived' && s.parentSymbol && (
                      <span className="ml-2 ui-badge ui-badge-primary text-[10px]">derived: {s.parentSymbol}</span>
                    )}
                  </td>
                  <td>
                    <span className={`ui-badge text-[10px] ${s.symbolType === 'derived' ? 'ui-badge-warning' : 'ui-badge-success'}`}>
                      {s.symbolType || 'base'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-2)' }}>{s.category || '—'}</td>
                  <td style={{ color: 'var(--text-2)' }}>{s.digits ?? '—'}</td>
                  <td style={{ color: 'var(--text-2)' }}>{s.contractSize ?? '—'}</td>
                  <td style={{ color: 'var(--text-2)' }}>
                    {s.spread ?? '—'}
                    {s.spreadMarkupPips > 0 && <span className="ml-1 text-[10px]" style={{ color: 'var(--warning)' }}>(+{s.spreadMarkupPips})</span>}
                  </td>
                  <td style={{ color: 'var(--text-2)' }}>{s.calcMode || '—'}</td>
                  <td>
                    <span className={`ui-badge text-[10px] ${s.enabled ? 'ui-badge-success' : 'ui-badge-danger'}`}>
                      {s.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleToggle(s)}
                        disabled={togglingSymbol === s.symbol}
                        className="ui-btn ui-btn-ghost ui-btn-icon ui-btn-sm"
                        title={s.enabled ? 'Disable' : 'Enable'}
                      >
                        {togglingSymbol === s.symbol
                          ? <Loader2 size={13} className="animate-spin" />
                          : s.enabled ? <ToggleRight size={14} style={{ color: 'var(--success)' }} /> : <ToggleLeft size={14} style={{ color: 'var(--muted)' }} />
                        }
                      </button>
                      <button
                        onClick={() => { setEditTarget(s); setModal('edit'); }}
                        className="ui-btn ui-btn-ghost ui-btn-icon ui-btn-sm"
                        title="Edit"
                      >
                        <Edit2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {(modal === 'add' || modal === 'edit') && (
        <SymbolFormModal
          symbol={editTarget}
          categories={categories}
          instruments={symbols}
          onClose={() => { setModal(null); setEditTarget(null); }}
          onSuccess={(saved) => { setSavedNotice(`${saved.symbol}: saved and ${saved.enabled ? 'enabled' : 'disabled'}. ${saved.enabled ? 'The terminal updates automatically. Trading requires group permission, an open session and a fresh quote.' : 'Enable after reviewing specifications.'}`); setModal(null); setEditTarget(null); load(); }}
        />
      )}
      {modal === 'clone' && (
        <CloneModal
          categories={categories}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
};

export default SymbolsTab;
