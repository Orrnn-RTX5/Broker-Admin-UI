import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Copy, ToggleLeft, ToggleRight, Edit2, Loader2, X, Wrench } from 'lucide-react';
import {
  symbolClone, symbolCategoryList,
} from '../../../services/api';
import { InstrumentsService } from '../../../services/instruments.service';
import { getApiErrorMessage, normalizeArrayResponse } from '../../../utils/apiShapes';
import { buildActionableErrorState } from '../../../utils/errorState';
import { invalidateLpSymbols, loadLpSymbols } from '../../../utils/lpSymbols';
import useSymbolStore from '../../../store/useSymbolStore';
import SymbolFormModal from './SymbolFormModal';
import ActionableErrorState from '../../atoms/ActionableErrorState';
import {
  STATUS_FILTERS, buildSymbolRows, categoryFilterOptions, cloneBaseSymbols,
  filterSymbolRows, streamingState, symbolCountSummary,
} from './symbolRows';

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

// ─── Clone Modal ───────────────────────────────────────────────────────────────
// SymbolClone copies the base row from `instruments` (derived_symbol_overrides
// reference it), so the source must be a configured, non-derived instrument.
const CloneModal = ({ categories, onClose, onSuccess }) => {
  const [baseSymbols, setBaseSymbols] = useState([]);
  const [loadingSymbols, setLoadingSymbols] = useState(true);
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
  const [symbolsError, setSymbolsError] = useState(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    loadLpSymbols(InstrumentsService, { force: loadAttempt > 0 })
      .then((entries) => {
        if (!active) return;
        const names = cloneBaseSymbols(entries);
        setBaseSymbols(names);
        setSymbolsError(names.length === 0
          ? buildActionableErrorState('No configured base symbols yet. Configure a symbol first, then clone it.', {
            title: 'No source symbols',
            actionLabel: 'Retry',
          })
          : null);
      })
      .catch((error) => {
        if (!active) return;
        setBaseSymbols([]);
        setSymbolsError(buildActionableErrorState(getApiErrorMessage(error, 'symbol list request failed'), {
          title: 'Source symbols failed to load',
          actionLabel: 'Retry',
        }));
      })
      .finally(() => { if (active) setLoadingSymbols(false); });
    return () => { active = false; };
  }, [loadAttempt]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const retrySymbols = () => {
    setSymbolsError(null);
    setLoadingSymbols(true);
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
            </label>
            {loadingSymbols ? (
              <div className="ui-input ui-input-sm flex items-center" style={{ pointerEvents: 'none' }}>
                <span className="inline-flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                  <Loader2 size={12} className="animate-spin" />
                  Loading configured symbols…
                </span>
              </div>
            ) : (
              <select className="ui-input ui-input-sm" value={form.baseSymbol} onChange={e => set('baseSymbol', e.target.value)} required>
                <option value="">— select —</option>
                {baseSymbols.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}
            <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Only configured base symbols can be cloned.</p>
            {symbolsError && (
              <ActionableErrorState state={symbolsError} onAction={retrySymbols} compact className="m-0" />
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

// ─── Streaming indicator ───────────────────────────────────────────────────────
const StreamingIndicator = ({ state }) => {
  if (state === 'unknown') return null;
  const live = state === 'live';
  return (
    <span
      className="ml-2 inline-flex items-center gap-1 text-[10px] align-middle"
      style={{ color: 'var(--muted)', fontWeight: 400 }}
      title={live ? 'The LP is streaming prices for this symbol' : 'No prices are streaming for this symbol'}
    >
      <span
        aria-hidden="true"
        className="inline-block rounded-full"
        style={{ width: 6, height: 6, background: live ? 'var(--success-500)' : 'var(--muted)' }}
      />
      {live ? 'Live' : 'No data'}
    </span>
  );
};

// Streamed symbol names from the shared feed store, as a stable string key so
// quote ticks do not re-render the table. null while the feed is unknown.
const selectStreamedKey = (state) => {
  if (Array.isArray(state.feedSymbolNames)) return state.feedSymbolNames.join(',');
  const quoted = Object.keys(state.symbols || {});
  return quoted.length > 0 ? quoted.join(',') : null;
};

// ─── Main Tab ──────────────────────────────────────────────────────────────────
const SymbolsTab = () => {
  const [symbols, setSymbols] = useState([]); // configured instruments
  const [lpEntries, setLpEntries] = useState([]); // merged LP symbols (utils/lpSymbols)
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterEnabled, setFilterEnabled] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | 'edit' | 'configure' | 'clone'
  const [editTarget, setEditTarget] = useState(null);
  const [configureSymbol, setConfigureSymbol] = useState('');
  const [togglingSymbol, setTogglingSymbol] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [savedNotice, setSavedNotice] = useState('');
  const streamedKey = useSymbolStore(selectStreamedKey);
  const streamedNames = useMemo(
    () => (streamedKey === null ? null : new Set(streamedKey ? streamedKey.split(',').map((name) => name.trim().toUpperCase()) : [])),
    [streamedKey]
  );

  const load = async (force = false) => {
    setLoading(true);
    setLoadError(null);
    try {
      const [symsResult, catsResult, lpResult] = await Promise.allSettled([
        InstrumentsService.getConfiguredInstruments({ page: 1, limit: SYMBOL_MANAGEMENT_LIMIT, search: '', enabled: '' }),
        withTimeout(
          symbolCategoryList(),
          CATEGORY_LOAD_TIMEOUT_MS,
          'category list request timed out'
        ),
        loadLpSymbols(InstrumentsService, { force }),
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
      if (lpResult.status === 'fulfilled') {
        setLpEntries(lpResult.value);
      } else {
        setLpEntries([]);
        failures.push(`LP symbols: ${getApiErrorMessage(lpResult.reason, 'LP symbol catalogue request failed')}`);
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

  // Instruments changed: drop the shared LP symbol cache so every picker sees it.
  const reloadAfterChange = () => {
    invalidateLpSymbols();
    return load(true);
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
      invalidateLpSymbols();
    } catch (e) {
      alert('Error: ' + getApiErrorMessage(e, 'instrument toggle failed'));
    } finally {
      setTogglingSymbol(null);
    }
  };

  const rows = useMemo(() => buildSymbolRows(symbols, lpEntries), [symbols, lpEntries]);
  const categoryOptions = useMemo(() => categoryFilterOptions(categories, rows), [categories, rows]);

  const filtered = useMemo(
    () => filterSymbolRows(rows, { search, category: filterCategory, type: filterType, status: filterEnabled }),
    [rows, search, filterCategory, filterType, filterEnabled]
  );

  const closeForm = () => { setModal(null); setEditTarget(null); setConfigureSymbol(''); };

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
          {categoryOptions.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <select className="ui-input ui-input-sm" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 130 }}>
          <option value="">All Types</option>
          <option value="base">Base</option>
          <option value="derived">Derived</option>
        </select>
        <select className="ui-input ui-input-sm" value={filterEnabled} onChange={e => setFilterEnabled(e.target.value)} style={{ width: 140 }}>
          {STATUS_FILTERS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {!loading && (
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {symbolCountSummary(rows)}
            {filtered.length !== rows.length && ` · ${filtered.length} shown`}
          </span>
        )}
        <div className="flex-1" />
        <button onClick={() => setModal('clone')} className="ui-btn ui-btn-secondary ui-btn-sm">
          <Copy size={13} /> Clone
        </button>
        <button onClick={() => { setEditTarget(null); setConfigureSymbol(''); setModal('add'); }} className="ui-btn ui-btn-primary ui-btn-sm">
          <Plus size={13} /> Add Symbol
        </button>
      </div>
      {loadError && (
        <ActionableErrorState state={loadError} onAction={() => load(true)} compact className="m-0 shrink-0" />
      )}

      {savedNotice && <p role="status" className="text-xs">{savedNotice}</p>}
      <p className="text-xs" style={{color: 'var(--text-2)'}}>Enabled symbols remain subject to account group permissions, trading sessions and fresh executable quotes. Symbols marked “Not configured” stream from the LP but cannot be traded until you configure them.</p>
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
              ) : filtered.map(s => s.configured ? (
                <tr key={s.symbol}>
                  <td style={{ color: 'var(--text)', fontWeight: 500 }}>
                    {s.symbol}
                    {s.symbolType === 'derived' && s.parentSymbol && (
                      <span className="ml-2 ui-badge ui-badge-primary text-[10px]">derived: {s.parentSymbol}</span>
                    )}
                    <StreamingIndicator state={streamingState(s.symbol, streamedNames)} />
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
                          : s.enabled ? <ToggleRight size={14} style={{ color: 'var(--success-500)' }} /> : <ToggleLeft size={14} style={{ color: 'var(--muted)' }} />
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
              ) : (
                <tr key={s.symbol}>
                  <td style={{ color: 'var(--text-2)', fontWeight: 500 }}>
                    {s.symbol}
                    <StreamingIndicator state={streamingState(s.symbol, streamedNames)} />
                  </td>
                  <td style={{ color: 'var(--muted)' }}>—</td>
                  <td style={{ color: 'var(--text-2)' }}>{s.category || '—'}</td>
                  <td style={{ color: 'var(--muted)' }}>—</td>
                  <td style={{ color: 'var(--muted)' }}>—</td>
                  <td style={{ color: 'var(--muted)' }}>—</td>
                  <td style={{ color: 'var(--muted)' }}>—</td>
                  <td>
                    <span className="ui-badge ui-badge-neutral text-[10px]" title="Streams from the LP but has no instrument specifications; not tradable">
                      Not configured
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setEditTarget(null); setConfigureSymbol(s.symbol); setModal('configure'); }}
                        className="ui-btn ui-btn-secondary ui-btn-sm"
                        title={`Configure ${s.symbol} as a tradable instrument`}
                      >
                        <Wrench size={12} /> Configure
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
      {(modal === 'add' || modal === 'edit' || modal === 'configure') && (
        <SymbolFormModal
          symbol={modal === 'edit' ? editTarget : null}
          initialSymbol={modal === 'configure' ? configureSymbol : ''}
          categories={categories}
          instruments={symbols}
          onClose={closeForm}
          onSuccess={(saved) => { setSavedNotice(`${saved.symbol}: saved and ${saved.enabled ? 'enabled' : 'disabled'}. ${saved.enabled ? 'The terminal updates automatically. Trading requires group permission, an open session and a fresh quote.' : 'Enable after reviewing specifications.'}`); closeForm(); reloadAfterChange(); }}
        />
      )}
      {modal === 'clone' && (
        <CloneModal
          categories={categories}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); reloadAfterChange(); }}
        />
      )}
    </div>
  );
};

export default SymbolsTab;
