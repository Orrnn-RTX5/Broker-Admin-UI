import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Copy, Edit2, Loader2, X, Wrench, Info } from 'lucide-react';
import {
  symbolClone, symbolCategoryList,
} from '../../../services/api';
import { InstrumentsService } from '../../../services/instruments.service';
import { getApiErrorMessage, normalizeArrayResponse } from '../../../utils/apiShapes';
import { buildActionableErrorState } from '../../../utils/errorState';
import { invalidateLpSymbols, loadLpSymbols } from '../../../utils/lpSymbols';
import useSymbolStore from '../../../store/useSymbolStore';
import { initialSymbolManagementState, rememberSymbolManagement } from '../../../utils/dynamicSymbolView';
import SymbolFormModal from './SymbolFormModal';
import BulkCloneWizard from './BulkCloneWizard';
import ActionableErrorState from '../../atoms/ActionableErrorState';
import './SymbolsTab.css';
import {
  STATUS_FILTERS, buildSymbolRows, categoryFilterOptions, cloneSourceOptions, cloneDefaultsFromSource,
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
const CloneModal = ({ categories, onClose, onSuccess, onConfigure }) => {
  const [baseSymbols, setBaseSymbols] = useState([]);
  const [unconfiguredSymbols, setUnconfiguredSymbols] = useState([]);
  const [sourceInstruments, setSourceInstruments] = useState({});
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
        const { ready: names, needsConfig } = cloneSourceOptions(entries);
        setBaseSymbols(names);
        setUnconfiguredSymbols(needsConfig);
        setSourceInstruments(Object.fromEntries(entries
          .filter((entry) => entry.configured && entry.instrument)
          .map((entry) => [entry.symbol, entry.instrument])));
        setSymbolsError(names.length === 0 && needsConfig.length === 0
          ? buildActionableErrorState('No LP or configured symbols are available to clone.', {
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
  const sourceNeedsConfig = unconfiguredSymbols.includes(form.baseSymbol);
  // Picking a source starts the form at that symbol's category, contract size
  // and volumes (the backend treats these fields as overrides of the source).
  const selectSource = (symbol) => setForm(f => ({
    ...f,
    baseSymbol: symbol,
    ...cloneDefaultsFromSource(sourceInstruments[symbol], categories.map(c => c.name)),
  }));
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
                  Loading symbols…
                </span>
              </div>
            ) : (
              <select className="ui-input ui-input-sm" value={form.baseSymbol} onChange={e => selectSource(e.target.value)} required>
                <option value="">— select —</option>
                {baseSymbols.length > 0 && (
                  <optgroup label="Configured — ready to clone">
                    {baseSymbols.map(name => <option key={name} value={name}>{name}</option>)}
                  </optgroup>
                )}
                {unconfiguredSymbols.length > 0 && (
                  <optgroup label="From LP — configure first">
                    {unconfiguredSymbols.map(name => <option key={name} value={name}>{name} (not configured)</option>)}
                  </optgroup>
                )}
              </select>
            )}
            {sourceNeedsConfig ? (
              <div className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-[11px]"
                style={{ color: 'var(--warning, #f59e0b)', border: '1px solid currentColor' }}>
                <span>{form.baseSymbol} has no specifications yet — a clone copies them from the source, so configure it first.</span>
                <button type="button" className="ui-btn ui-btn-primary ui-btn-sm shrink-0" onClick={() => onConfigure(form.baseSymbol)}>
                  Configure {form.baseSymbol}
                </button>
              </div>
            ) : (
              <p className="text-[10px]" style={{ color: 'var(--muted)' }}>A clone copies the source symbol's specifications, so the source must be configured.</p>
            )}
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
            <button type="submit" disabled={saving || sourceNeedsConfig} className="ui-btn ui-btn-primary ui-btn-sm">
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
  if (state === 'unknown') return <span className="symbols-management-feed">Awaiting</span>;
  const live = state === 'live';
  return (
    <span
      className="symbols-management-feed"
      data-live={live}
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
const SymbolsTab = ({ toolbarTarget }) => {
  const [initial] = useState(() => initialSymbolManagementState(useSymbolStore.getState()));
  const [symbols, setSymbols] = useState(initial.symbols); // configured instruments
  const [lpEntries, setLpEntries] = useState(initial.lpEntries); // merged LP symbols (utils/lpSymbols)
  const [categories, setCategories] = useState(initial.categories);
  const [loading, setLoading] = useState(initial.loading);
  const [syncing, setSyncing] = useState(initial.syncing);
  const [fromDynamic, setFromDynamic] = useState(initial.fromDynamic);
  const hasRowsRef = useRef(initial.symbols.length > 0 || initial.lpEntries.length > 0);
  const requestRef = useRef(0);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterEnabled, setFilterEnabled] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | 'edit' | 'configure' | 'clone' (bulk wizard) | 'clone-single'
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
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const current = () => requestId === requestRef.current;
    const blocking = !hasRowsRef.current;
    setLoadError(null);
    if (blocking) setLoading(true);
    else setSyncing(true);
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
      if (!current()) return;
      const failures = [];
      const nextSymbols = symsResult.status === 'fulfilled'
        ? normalizeSymbolManagementRows(symsResult.value)
        : null;
      const nextCategories = catsResult.status === 'fulfilled'
        ? normalizeCategoryRows(catsResult.value)
        : null;
      const nextLpEntries = lpResult.status === 'fulfilled' ? lpResult.value : null;
      if (nextSymbols) setSymbols(nextSymbols);
      else if (!hasRowsRef.current) setSymbols([]);
      if (!nextSymbols) failures.push(`Symbols: ${getApiErrorMessage(symsResult.reason, 'symbol list request failed')}`);
      if (nextCategories) setCategories(nextCategories);
      else if (!hasRowsRef.current) setCategories([]);
      if (!nextCategories) failures.push(`Categories: ${getApiErrorMessage(catsResult.reason, 'category list request failed')}`);
      if (nextLpEntries) setLpEntries(nextLpEntries);
      else if (!hasRowsRef.current) setLpEntries([]);
      if (!nextLpEntries) failures.push(`LP symbols: ${getApiErrorMessage(lpResult.reason, 'LP symbol catalogue request failed')}`);
      if (nextSymbols || nextLpEntries) {
        hasRowsRef.current = true;
        setFromDynamic(false);
        rememberSymbolManagement({
          symbols: nextSymbols || symbols,
          categories: nextCategories || categories,
          lpEntries: nextLpEntries || lpEntries,
        });
      }
      if (failures.length > 0) {
        setLoadError(buildActionableErrorState(failures.join(' '), {
          title: symsResult.status === 'rejected' ? 'Symbols failed to load' : 'Symbols partially loaded',
          actionLabel: 'Retry',
        }));
      }
    } finally {
      if (current()) {
        setLoading(false);
        setSyncing(false);
      }
    }
  };

  // Instruments changed: drop the shared LP symbol cache so every picker sees it.
  const reloadAfterChange = () => {
    invalidateLpSymbols();
    return load(true);
  };

  const streamedCount = useSymbolStore((state) => (
    Array.isArray(state.feedSymbolNames) ? state.feedSymbolNames.length : state.symbolMetadata.length
  ));

  useEffect(() => {
    if (!loading || hasRowsRef.current) return;
    const seed = initialSymbolManagementState(useSymbolStore.getState());
    if (seed.symbols.length === 0 && seed.lpEntries.length === 0) return;
    setSymbols(seed.symbols);
    setLpEntries(seed.lpEntries);
    setCategories(seed.categories);
    setFromDynamic(seed.fromDynamic);
    setLoading(false);
    setSyncing(true);
    hasRowsRef.current = true;
  }, [loading, streamedCount]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      load();
    }, 0);

    return () => window.clearTimeout(loadTimer);
    // Paint the feed first. This request refreshes that list and must not restart on each quote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const toolbar = (
      <div className="symbols-management-toolbar">
        <div className="symbols-management-filters">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted)' }} />
          <input type="search" aria-label="Search symbols" className="ui-input ui-input-sm" style={{ paddingLeft: 30, width: 200 }} placeholder="Search symbols…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select aria-label="Filter by category" className="ui-input ui-input-sm" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ width: 150 }}>
          <option value="">All Categories</option>
          {categoryOptions.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <select aria-label="Filter by type" className="ui-input ui-input-sm" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 130 }}>
          <option value="">All Types</option>
          <option value="base">Base</option>
          <option value="derived">Derived</option>
        </select>
        <select aria-label="Filter by status" className="ui-input ui-input-sm" value={filterEnabled} onChange={e => setFilterEnabled(e.target.value)} style={{ width: 140 }}>
          {STATUS_FILTERS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {!loading && (
          <span className="symbols-management-toolbar-summary" style={{ color: 'var(--muted)' }}>
            {symbolCountSummary(rows)}
            {filtered.length !== rows.length && ` · ${filtered.length} shown`}
          </span>
        )}
        </div>
        <div className="symbols-management-actions">
        <button onClick={() => setModal('clone')} className="ui-btn ui-btn-secondary ui-btn-sm">
          <Copy size={13} /> Clone
        </button>
        <button onClick={() => { setEditTarget(null); setConfigureSymbol(''); setModal('add'); }} className="ui-btn ui-btn-primary ui-btn-sm">
          <Plus size={13} /> Add Symbol
        </button>
        </div>
      </div>
  );

  return (
    <div className="symbols-management-panel">
      {toolbarTarget && createPortal(toolbar, toolbarTarget)}
      {loadError && (
        <ActionableErrorState state={loadError} onAction={() => load(true)} compact className="m-0 shrink-0" />
      )}

      {savedNotice && <p role="status" className="symbols-management-notice">{savedNotice}</p>}
      {/* Table */}
      <div className="symbols-management-table-scroll" role="region" aria-label="Symbol instruments" tabIndex={0} aria-busy={loading}>
        {loading ? (
          <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'var(--muted)' }}>
            <Loader2 size={16} className="animate-spin mr-2" /> Loading symbols…
          </div>
        ) : (
          <table className="ui-grid symbols-management-table" aria-label="Symbol instruments">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Feed</th>
                <th>Type</th>
                <th>Category</th>
                <th>Digits</th>
                <th>Contract Size</th>
                <th>Spread</th>
                <th>Calc Mode</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="symbols-management-empty">No symbols found.</td></tr>
              ) : filtered.map(s => s.configured ? (
                <tr key={s.symbol}>
                  <td className="symbols-management-code" title={s.parentSymbol ? `${s.symbol} · derived from ${s.parentSymbol}` : s.symbol}>
                    {s.symbol}
                    {s.symbolType === 'derived' && s.parentSymbol && (
                      <span className="symbols-management-parent">{s.parentSymbol}</span>
                    )}
                  </td>
                  <td><StreamingIndicator state={streamingState(s.symbol, streamedNames)} /></td>
                  <td>
                    {s.symbolType === 'derived' ? 'Derived' : 'Base'}
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
                    <span className="symbols-management-status" data-tone={s.enabled ? 'enabled' : 'disabled'}>
                      {s.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <div className="symbols-management-row-actions">
                      <button
                        onClick={() => handleToggle(s)}
                        disabled={togglingSymbol === s.symbol}
                        className="ui-btn ui-btn-ghost ui-btn-sm symbols-management-toggle"
                        title={s.enabled ? 'Disable' : 'Enable'}
                        aria-label={`${s.enabled ? 'Disable' : 'Enable'} ${s.symbol}`}
                      >
                        {togglingSymbol === s.symbol ? 'Updating…' : s.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => { setEditTarget(s); setModal('edit'); }}
                        className="ui-btn ui-btn-ghost ui-btn-icon ui-btn-sm"
                        title="Edit"
                        aria-label={`Edit ${s.symbol}`}
                      >
                        <Edit2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={s.symbol}>
                  <td className="symbols-management-code" title={s.symbol}>
                    {s.symbol}
                  </td>
                  <td><StreamingIndicator state={streamingState(s.symbol, streamedNames)} /></td>
                  <td style={{ color: 'var(--muted)' }}>—</td>
                  <td style={{ color: 'var(--text-2)' }}>{s.category || '—'}</td>
                  <td style={{ color: 'var(--muted)' }}>—</td>
                  <td style={{ color: 'var(--muted)' }}>—</td>
                  <td style={{ color: 'var(--muted)' }}>—</td>
                  <td style={{ color: 'var(--muted)' }}>—</td>
                  <td>
                    {s.detailsPending ? (
                      <span className="symbols-management-status" data-tone="pending" title="Live feed symbol. Specifications are still loading.">
                        Syncing
                      </span>
                    ) : (
                      <span className="symbols-management-status" data-tone="pending" title="Streams from the LP but has no instrument specifications; not tradable">
                        Not configured
                      </span>
                    )}
                  </td>
                  <td>
                    {s.detailsPending ? null : (
                    <div className="flex items-center justify-start gap-1">
                      <button
                        onClick={() => { setEditTarget(null); setConfigureSymbol(s.symbol); setModal('configure'); }}
                        className="ui-btn ui-btn-secondary ui-btn-sm"
                        title={`Configure ${s.symbol} as a tradable instrument`}
                        aria-label={`Configure ${s.symbol}`}
                      >
                        <Wrench size={12} /> Configure
                      </button>
                    </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <footer className="symbols-management-footer">
        <span role="status">{loading ? 'Loading symbols…' : fromDynamic ? `Showing ${filtered.length} live symbols${syncing ? ' · updating specifications' : ''}` : `Showing ${filtered.length} of ${rows.length} symbols${syncing ? ' · updating' : ''}`}</span>
        <details className="symbols-management-help">
          <summary><Info size={12} /> Trading requirements</summary>
          <p>Enabled symbols remain subject to account group permissions, trading sessions and fresh executable quotes. Symbols marked “Not configured” stream from the LP but cannot be traded until you configure them.</p>
        </details>
      </footer>

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
        <BulkCloneWizard
          onClose={() => setModal(null)}
          onChanged={reloadAfterChange}
          onSingleClone={() => setModal('clone-single')}
        />
      )}
      {modal === 'clone-single' && (
        <CloneModal
          categories={categories}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); reloadAfterChange(); }}
          onConfigure={(symbol) => { setEditTarget(null); setConfigureSymbol(symbol); setModal('configure'); }}
        />
      )}
    </div>
  );
};

export default SymbolsTab;
