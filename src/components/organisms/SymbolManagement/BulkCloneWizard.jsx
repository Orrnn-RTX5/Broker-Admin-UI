import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Loader2, Plus, Search, X } from 'lucide-react';
import { symbolCloneBulk, symbolCloneCategoryCreate, symbolCloneCategoryList } from '../../../services/api';
import { InstrumentsService } from '../../../services/instruments.service';
import { getApiErrorMessage } from '../../../utils/apiShapes';
import { buildActionableErrorState } from '../../../utils/errorState';
import { invalidateLpSymbols, loadLpSymbols } from '../../../utils/lpSymbols';
import ActionableErrorState from '../../atoms/ActionableErrorState';
import {
  APPLY_ALL_FIELDS, BULK_CLONE_MAX_SYMBOLS, CLONE_NAME_MAX_LENGTH,
  applyToAllRows, buildBulkClonePayload, buildCloneCandidates, buildCloneRows, cloneSymbolName,
  filterCloneCandidates, groupSelectionState, normalizeBulkCloneResult, normalizeCloneCategories,
  pruneSelection, selectionError, toggleGroupSelection, validateCloneCategoryForm, validateCloneRows,
} from './bulkClone';

const STEPS = ['Category', 'Symbols', 'Configure', 'Create'];
const FIELD_LABELS = {
  spreadMarkupPips: 'Spread markup (pips)',
  contractSize: 'Contract size',
  minVolume: 'Min vol',
  maxVolume: 'Max vol',
  volumeStep: 'Vol step',
};
const STATUS_NOTES = {
  cloned: 'already cloned',
  too_long: `name > ${CLONE_NAME_MAX_LENGTH} chars`,
  unconfigured: 'configure first',
};

const StepIndicator = ({ step }) => (
  <ol className="flex items-center gap-2 text-xs flex-wrap">
    {STEPS.map((label, index) => {
      const number = index + 1;
      const done = number < step;
      const current = number === step;
      return (
        <li key={label} className="flex items-center gap-2">
          {index > 0 && <span style={{ color: 'var(--muted)' }}>·</span>}
          <span
            className="inline-flex items-center gap-1.5"
            style={{ color: current ? 'var(--text)' : 'var(--muted)', fontWeight: current ? 600 : 400 }}
            aria-current={current ? 'step' : undefined}
          >
            <span
              className="inline-flex items-center justify-center rounded-full text-[10px]"
              style={{
                width: 18, height: 18,
                border: `1px solid ${current ? 'var(--accent-border)' : 'currentColor'}`,
                background: current ? 'var(--accent-soft)' : 'transparent',
                color: current ? 'var(--accent-text)' : undefined,
              }}
            >
              {done ? <Check size={10} /> : number}
            </span>
            {label}
          </span>
        </li>
      );
    })}
  </ol>
);

// ─── Step 1: clone category ────────────────────────────────────────────────────
const CategoryStep = ({ categories, loading, error, onRetry, selectedId, onSelect, onCreated, exampleBase }) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', suffix: '', description: '' });
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const errors = validateCloneCategoryForm(form, categories);
  const formValid = Object.keys(errors).length === 0;
  const selected = categories.find((category) => category.id === selectedId);
  const previewSuffix = showForm && form.suffix.trim() && !errors.suffix ? form.suffix : selected?.suffix;

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const create = async (event) => {
    event.preventDefault();
    setTouched(true);
    if (!formValid) return;
    setSaving(true);
    setSaveError('');
    try {
      const body = { name: form.name.trim(), suffix: form.suffix.trim() };
      if (form.description.trim()) body.description = form.description.trim();
      const created = await symbolCloneCategoryCreate(body);
      onCreated(created);
      setForm({ name: '', suffix: '', description: '' });
      setTouched(false);
      setShowForm(false);
    } catch (e) {
      setSaveError(getApiErrorMessage(e, 'clone category create failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs" style={{ color: 'var(--text-2)' }}>
        Clones of a clone category share its suffix and appear under that category. Each clone copies every specification of its base symbol and prices from it plus its spread markup.
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-xs py-4" style={{ color: 'var(--muted)' }}>
          <Loader2 size={13} className="animate-spin" /> Loading clone categories…
        </div>
      ) : error ? (
        <ActionableErrorState state={error} onAction={onRetry} compact className="m-0" />
      ) : categories.length === 0 ? (
        <p className="text-xs py-2" style={{ color: 'var(--muted)' }}>No clone categories yet — create one below.</p>
      ) : (
        <div role="radiogroup" aria-label="Clone category" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {categories.map((category) => {
            const active = category.id === selectedId;
            return (
              <label
                key={category.id}
                className="ui-card flex items-start gap-2 p-3 cursor-pointer"
                style={{ border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}` }}
              >
                <input type="radio" name="clone-category" className="mt-0.5" checked={active} onChange={() => onSelect(category.id)} />
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {category.name} <span className="ui-badge ui-badge-primary text-[10px] ml-1">{category.suffix}</span>
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
                    {category.symbolCount} symbol{category.symbolCount === 1 ? '' : 's'}
                    {category.description ? ` · ${category.description}` : ''}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}

      {showForm ? (
        <form onSubmit={create} className="ui-card p-3 flex flex-col gap-2" style={{ border: '1px solid var(--border)' }}>
          <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>New clone category</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-2)' }}>
              Name *
              <input className="ui-input ui-input-sm" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. PRO" autoFocus />
              {touched && errors.name && <span className="text-[10px]" style={{ color: 'var(--danger)' }}>{errors.name}</span>}
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-2)' }}>
              Suffix *
              <input className="ui-input ui-input-sm" value={form.suffix} onChange={(e) => set('suffix', e.target.value)} placeholder="e.g. .pro" maxLength={12} />
              {(touched || form.suffix) && errors.suffix && <span className="text-[10px]" style={{ color: 'var(--danger)' }}>{errors.suffix}</span>}
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-2)' }}>
              Description
              <input className="ui-input ui-input-sm" value={form.description} onChange={(e) => set('description', e.target.value)} />
            </label>
          </div>
          {saveError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{saveError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => { setShowForm(false); setSaveError(''); setTouched(false); }}>Cancel</button>
            <button type="submit" className="ui-btn ui-btn-primary ui-btn-sm" disabled={saving || (touched && !formValid)}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : 'Create category'}
            </button>
          </div>
        </form>
      ) : (
        <div>
          <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => setShowForm(true)}>
            <Plus size={13} /> New clone category
          </button>
        </div>
      )}

      {previewSuffix && (
        <p className="text-xs" style={{ color: 'var(--text-2)' }}>
          Clones will be named like <strong style={{ color: 'var(--text)' }}>{cloneSymbolName(exampleBase, previewSuffix)}</strong>
        </p>
      )}
    </div>
  );
};

// ─── Step 2: symbols ───────────────────────────────────────────────────────────
const GroupCheckbox = ({ state, disabled, onChange, label }) => (
  <input
    type="checkbox"
    aria-label={label}
    checked={state === 'all'}
    disabled={disabled}
    ref={(el) => { if (el) el.indeterminate = state === 'some'; }}
    onChange={(e) => onChange(e.target.checked)}
  />
);

const SymbolsStep = ({ groups, loading, error, onRetry, selected, setSelected }) => {
  const [search, setSearch] = useState('');
  const visible = useMemo(() => filterCloneCandidates(groups, search), [groups, search]);
  const toggle = (symbol, checked) => setSelected((current) => {
    const next = new Set(current);
    if (checked) next.add(symbol);
    else next.delete(symbol);
    return next;
  });
  const limitError = selected.size > BULK_CLONE_MAX_SYMBOLS ? selectionError(selected) : '';

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs py-4" style={{ color: 'var(--muted)' }}>
        <Loader2 size={13} className="animate-spin" /> Loading symbols…
      </div>
    );
  }
  if (error) return <ActionableErrorState state={error} onAction={onRetry} compact className="m-0" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted)' }} />
          <input className="ui-input ui-input-sm" style={{ paddingLeft: 30, width: 220 }} placeholder="Search symbols…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span className="text-xs" style={{ color: 'var(--text-2)' }}>{selected.size} selected</span>
        {selected.size > 0 && (
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
        )}
      </div>
      {limitError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{limitError}</p>}
      {visible.length === 0 ? (
        <p className="text-xs py-2" style={{ color: 'var(--muted)' }}>No symbols match.</p>
      ) : visible.map((group) => {
        const eligible = group.items.filter((item) => item.status === 'eligible');
        const chosen = eligible.filter((item) => selected.has(item.symbol)).length;
        return (
          <section key={group.name} className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--text)' }}>
              <GroupCheckbox
                state={groupSelectionState(group, selected)}
                disabled={eligible.length === 0}
                label={`Select all ${group.name}`}
                onChange={(checked) => setSelected((current) => toggleGroupSelection(current, group, checked))}
              />
              {group.name}
              <span className="font-normal" style={{ color: 'var(--muted)' }}>
                {chosen}/{eligible.length} selected · {group.items.length} total
              </span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 pl-5">
              {group.items.map((item) => {
                const enabled = item.status === 'eligible';
                return (
                  <label
                    key={item.symbol}
                    className={`flex items-center gap-1.5 text-xs ${enabled ? 'cursor-pointer' : ''}`}
                    style={{ color: enabled ? 'var(--text)' : 'var(--muted)', opacity: item.status === 'unconfigured' ? 0.6 : 1 }}
                    title={enabled ? `Creates ${item.cloneName}` : STATUS_NOTES[item.status]}
                  >
                    <input type="checkbox" disabled={!enabled} checked={enabled && selected.has(item.symbol)} onChange={(e) => toggle(item.symbol, e.target.checked)} />
                    <span className="truncate">{item.symbol}</span>
                    {!enabled && <span className="text-[10px] shrink-0">({STATUS_NOTES[item.status]})</span>}
                  </label>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};

// ─── Step 3: configure ─────────────────────────────────────────────────────────
const ConfigureStep = ({ rows, setRows, validation }) => {
  const [applyValues, setApplyValues] = useState({ spreadMarkupPips: '', minVolume: '', maxVolume: '', volumeStep: '' });
  const setCell = (baseSymbol, field, value) => setRows((current) => current.map((row) => (row.baseSymbol === baseSymbol ? { ...row, [field]: value } : row)));
  const applyAll = () => setRows((current) => APPLY_ALL_FIELDS.reduce(
    (acc, field) => (String(applyValues[field]).trim() ? applyToAllRows(acc, field, applyValues[field]) : acc),
    current,
  ));
  const canApply = APPLY_ALL_FIELDS.some((field) => String(applyValues[field]).trim());
  const cellStyle = (error) => (error ? { borderColor: 'var(--danger)' } : undefined);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs" style={{ color: 'var(--text-2)' }}>
        Values start at each base symbol's own specification. An empty field is copied from the base.
        {validation.invalidCount > 0 && <span style={{ color: 'var(--danger)' }}> {validation.invalidCount} row{validation.invalidCount === 1 ? ' has' : 's have'} invalid values.</span>}
      </p>
      <div className="overflow-x-auto">
        <table className="ui-grid w-full">
          <thead>
            <tr>
              <th>New symbol</th>
              {Object.values(FIELD_LABELS).map((label) => <th key={label}>{label}</th>)}
            </tr>
            <tr>
              <th>
                <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" disabled={!canApply} onClick={applyAll}>Apply to all</button>
              </th>
              {Object.keys(FIELD_LABELS).map((field) => (
                <th key={field}>
                  {APPLY_ALL_FIELDS.includes(field) ? (
                    <input
                      type="number"
                      className="ui-input ui-input-sm"
                      style={{ width: 96 }}
                      placeholder="all rows"
                      aria-label={`${FIELD_LABELS[field]} for all rows`}
                      value={applyValues[field]}
                      onChange={(e) => setApplyValues((current) => ({ ...current, [field]: e.target.value }))}
                    />
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const errors = validation.errors[row.baseSymbol] || {};
              return (
                <tr key={row.baseSymbol}>
                  <td style={{ color: errors.newSymbol ? 'var(--danger)' : 'var(--text)', fontWeight: 500 }} title={errors.newSymbol || `Clone of ${row.baseSymbol}`}>
                    {row.newSymbol}
                    {errors.newSymbol && <div className="text-[10px]">{errors.newSymbol}</div>}
                  </td>
                  {Object.keys(FIELD_LABELS).map((field) => (
                    <td key={field}>
                      <input
                        type="number"
                        className="ui-input ui-input-sm"
                        style={{ width: 96, ...cellStyle(errors[field]) }}
                        value={row[field]}
                        min={field === 'spreadMarkupPips' ? 0 : undefined}
                        step="any"
                        placeholder="from base"
                        title={errors[field] || ''}
                        aria-invalid={errors[field] ? 'true' : undefined}
                        onChange={(e) => setCell(row.baseSymbol, field, e.target.value)}
                      />
                      {errors[field] && <div className="text-[10px]" style={{ color: 'var(--danger)' }}>{errors[field]}</div>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Step 4: review & result ───────────────────────────────────────────────────
const ReviewStep = ({ category, rows, submitError, onRetry }) => (
  <div className="flex flex-col gap-3">
    <div className="ui-card p-3 grid grid-cols-3 gap-3 text-xs" style={{ border: '1px solid var(--border)' }}>
      <div><div style={{ color: 'var(--muted)' }}>Category</div><div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{category?.name}</div></div>
      <div><div style={{ color: 'var(--muted)' }}>Suffix</div><div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{category?.suffix}</div></div>
      <div><div style={{ color: 'var(--muted)' }}>Symbols</div><div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{rows.length}</div></div>
    </div>
    <div className="flex flex-wrap gap-1">
      {rows.map((row) => (
        <span key={row.baseSymbol} className="ui-badge ui-badge-neutral text-[10px]" title={`Clone of ${row.baseSymbol}`}>{row.newSymbol}</span>
      ))}
    </div>
    <p className="text-xs" style={{ color: 'var(--text-2)' }}>
      Each clone is created from its base symbol's specifications and prices from it plus its spread markup. Symbols whose clone already exists are skipped.
    </p>
    {submitError && <ActionableErrorState state={submitError} onAction={onRetry} compact className="m-0" />}
  </div>
);

const ResultView = ({ result }) => (
  <div className="flex flex-col gap-3">
    <p className="text-sm" style={{ color: 'var(--text)' }}>
      {result.created.length} clone{result.created.length === 1 ? '' : 's'} created in {result.category || 'the category'}
      {result.skipped.length > 0 && `, ${result.skipped.length} skipped`}.
    </p>
    {result.created.length > 0 && (
      <section className="flex flex-col gap-1">
        <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Created</div>
        <div className="flex flex-wrap gap-1">
          {result.created.map((row) => (
            <span key={row.symbol} className="ui-badge ui-badge-success text-[10px]" title={`Clone of ${row.baseSymbol}`}>{row.symbol}</span>
          ))}
        </div>
      </section>
    )}
    {result.skipped.length > 0 && (
      <section className="flex flex-col gap-1">
        <div className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Skipped</div>
        <table className="ui-grid w-full">
          <thead><tr><th>Symbol</th><th>Base</th><th>Reason</th></tr></thead>
          <tbody>
            {result.skipped.map((row) => (
              <tr key={row.symbol || row.baseSymbol}>
                <td style={{ color: 'var(--text)' }}>{row.symbol}</td>
                <td style={{ color: 'var(--text-2)' }}>{row.baseSymbol}</td>
                <td style={{ color: 'var(--warn-text)' }}>{row.reason || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    )}
  </div>
);

// ─── Wizard ────────────────────────────────────────────────────────────────────
/**
 * Bulk clone: pick a clone category (suffix), pick base symbols by market
 * group, adjust markup/volumes, create them in one /SymbolCloneBulk request.
 * `onChanged` reloads the Symbols tab; `onSingleClone` opens the one-symbol form.
 */
const BulkCloneWizard = ({ onClose, onChanged, onSingleClone }) => {
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState(null);
  const [categoriesAttempt, setCategoriesAttempt] = useState(0);
  const [categoryId, setCategoryId] = useState(null);
  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [entriesError, setEntriesError] = useState(null);
  const [entriesAttempt, setEntriesAttempt] = useState(0);
  const [selected, setSelected] = useState(() => new Set());
  const [rows, setRows] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let active = true;
    symbolCloneCategoryList()
      .then((response) => {
        if (!active) return;
        setCategories(normalizeCloneCategories(response));
        setCategoriesError(null);
      })
      .catch((error) => {
        if (!active) return;
        setCategoriesError(buildActionableErrorState(getApiErrorMessage(error, 'clone category list request failed'), {
          title: 'Clone categories failed to load',
          actionLabel: 'Retry',
        }));
      })
      .finally(() => { if (active) setCategoriesLoading(false); });
    return () => { active = false; };
  }, [categoriesAttempt]);

  useEffect(() => {
    let active = true;
    loadLpSymbols(InstrumentsService, { force: entriesAttempt > 0 })
      .then((loaded) => {
        if (!active) return;
        setEntries(loaded);
        setEntriesError(null);
      })
      .catch((error) => {
        if (!active) return;
        setEntriesError(buildActionableErrorState(getApiErrorMessage(error, 'symbol list request failed'), {
          title: 'Symbols failed to load',
          actionLabel: 'Retry',
        }));
      })
      .finally(() => { if (active) setEntriesLoading(false); });
    return () => { active = false; };
  }, [entriesAttempt]);

  const category = categories.find((row) => row.id === categoryId) || null;
  const suffix = category?.suffix || '';
  const groups = useMemo(() => buildCloneCandidates(entries, suffix), [entries, suffix]);

  // A different suffix changes which symbols are already cloned.
  useEffect(() => { setSelected((current) => pruneSelection(current, groups)); }, [groups]);

  const validation = useMemo(() => validateCloneRows(rows), [rows]);
  const exampleBase = [...selected][0] || 'EURUSD';
  const stepValid = step === 1 ? Boolean(category)
    : step === 2 ? !selectionError(selected)
      : step === 3 ? validation.valid
        : true;

  const retryCategories = () => { setCategoriesLoading(true); setCategoriesError(null); setCategoriesAttempt((n) => n + 1); };
  const retryEntries = () => { setEntriesLoading(true); setEntriesError(null); setEntriesAttempt((n) => n + 1); };

  // A category created here is also a symbol category: reload the tab on close
  // unless a successful bulk clone already did.
  const [categoryCreated, setCategoryCreated] = useState(false);
  const close = () => {
    if (categoryCreated && !(result && result.created.length > 0)) onChanged();
    onClose();
  };

  const handleCategoryCreated = (created) => {
    setCategoryCreated(true);
    const [row] = normalizeCloneCategories({ categories: [{ symbol_count: 0, description: '', ...created }] });
    if (row) {
      setCategories((current) => [...current.filter((item) => item.id !== row.id), row].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryId(row.id);
    } else {
      retryCategories();
    }
  };

  const next = () => {
    if (!stepValid) return;
    if (step === 2) setRows((current) => buildCloneRows(selected, entries, suffix, current));
    setStep((current) => Math.min(current + 1, STEPS.length));
  };
  const back = () => { setSubmitError(null); setStep((current) => Math.max(current - 1, 1)); };

  const create = async () => {
    if (!category || !validation.valid) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await symbolCloneBulk(buildBulkClonePayload(category.id, rows));
      const outcome = normalizeBulkCloneResult(response);
      setResult(outcome);
      if (outcome.created.length > 0) {
        invalidateLpSymbols();
        onChanged();
      }
    } catch (error) {
      setSubmitError(buildActionableErrorState(getApiErrorMessage(error, 'bulk clone request failed'), {
        title: 'Clones were not created',
        actionLabel: 'Retry',
      }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div role="dialog" aria-modal="true" aria-label="Bulk clone symbols" className="ui-card w-full max-w-3xl flex flex-col max-h-[88vh]" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3 shrink-0">
          <div className="flex flex-col gap-2">
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Clone Symbols</h2>
            {!result && <StepIndicator step={step} />}
          </div>
          <button type="button" onClick={close} className="ui-btn ui-btn-ghost ui-btn-icon ui-btn-sm" aria-label="Close"><X size={14} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2 min-h-0">
          {result ? <ResultView result={result} />
            : step === 1 ? (
              <CategoryStep
                categories={categories}
                loading={categoriesLoading}
                error={categoriesError}
                onRetry={retryCategories}
                selectedId={categoryId}
                onSelect={setCategoryId}
                onCreated={handleCategoryCreated}
                exampleBase={exampleBase}
              />
            ) : step === 2 ? (
              <SymbolsStep groups={groups} loading={entriesLoading} error={entriesError} onRetry={retryEntries} selected={selected} setSelected={setSelected} />
            ) : step === 3 ? (
              <ConfigureStep rows={rows} setRows={setRows} validation={validation} />
            ) : (
              <ReviewStep category={category} rows={rows} submitError={submitError} onRetry={create} />
            )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          {result ? (
            <>
              <span />
              <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={close}>Done</button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                {step === 1 && onSingleClone && (
                  <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={onSingleClone} title="Clone one symbol with a custom name">
                    Single symbol…
                  </button>
                )}
                {step === 2 && <span className="text-xs" style={{ color: 'var(--text-2)' }}>{selected.size} selected</span>}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={step === 1 ? close : back} disabled={submitting}>
                  {step === 1 ? 'Cancel' : <><ChevronLeft size={13} /> Back</>}
                </button>
                {step < STEPS.length ? (
                  <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={next} disabled={!stepValid}>
                    Next <ChevronRight size={13} />
                  </button>
                ) : (
                  <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={create} disabled={submitting || !validation.valid}>
                    {submitting ? <Loader2 size={13} className="animate-spin" /> : `Create ${rows.length} clone${rows.length === 1 ? '' : 's'}`}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkCloneWizard;
