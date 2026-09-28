import React, { useCallback, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { X, HelpCircle, Users, ChevronUp, ChevronDown, Plus, Pencil, Trash2, Save } from 'lucide-react';
import { ManagerService } from '../../services/manager.service';
import { getApiErrorMessage, normalizeArrayResponse } from '../../utils/apiShapes';
import { useLpSymbols } from '../../hooks/useLpSymbols';
import { useToast } from '../ui/useToast';
import LpSymbolDatalist from '../atoms/LpSymbolDatalist';
import {
  COMMISSION_TYPE_OPTIONS,
  EXECUTION_MODE_OPTIONS,
  addGroupSymbolRow,
  addGroupSymbolRows,
  symbolCategoryOptions,
  buildCommissionSchedulePayload,
  buildGroupSymbolsSavePayload,
  buildMarginChanges,
  buildMarginForm,
  commissionFormFromSchedule,
  describeAccountsUpdated,
  emptyCommissionForm,
  filterSchedulesForGroup,
  formatCommissionType,
  formatVolumeRange,
  getGroupName,
  getScheduleId,
  groupSymbolEditForm,
  isGroupSymbolListDirty,
  isMarginFormDirty,
  moveGroupSymbolRow,
  normalizeGroupSymbolsResponse,
  removeGroupSymbolRow,
  updateGroupSymbolRow,
  validateGroupSymbolEdit,
  validateMarginForm,
} from '../../utils/groupProperties';
import {
  GROUP_SYMBOL_FILTERS,
  GROUP_SYMBOL_STATUS,
  applyStagedOverride,
  buildGroupSymbolOverrideChanges,
  filterGroupSymbolRows,
  isGroupSymbolEditable,
  normalizeGroupSymbolOverrides,
  summarizeGroupSymbols,
  toggleStagedOverride,
} from '../../utils/groupSymbolOverrides';

const MotionDiv = motion.div;

const TABS = ['Margin', 'Symbols', 'Symbol List', 'Commissions'];

const TAB_INTRO = {
  Margin: 'Please set up the mechanism of margin calculation for the group: execution mode and margin requirements.',
  Symbols: 'Every symbol from Symbol Management. A symbol is tradeable in this group when it is enabled globally and not turned off for this group.',
  'Symbol List': 'Legacy allowed-symbols list with individual trade parameters per symbol.',
  Commissions: 'Please set up commissions for accounts in the group. Changes on this tab are saved immediately.',
};

const TAB_HELP = {
  Margin: 'Execution mode selects market or instant execution for the group. Margin call and stop out levels are margin levels in percent; the stop out level must not exceed the margin call level. "Compensate negative balance after stop out" resets a negative balance to zero after a stop out. When you press OK, changed values are also applied to the accounts already in the group. Greyed-out options are not available yet.',
  Symbols: 'All global symbols. "Global" means the group follows Symbol Management; turning a symbol off here blocks it for this group only and never changes the group\'s symbol list. A symbol disabled globally (or excluded by the blocked list or a legacy allow-list) cannot be turned on here. Changes are kept until you press OK, and Cancel discards them.',
  'Symbol List': 'The ordered list of symbols that accounts in this group see and trade in the terminal. An empty list means all broker symbols are allowed; a non-empty list restricts the group to exactly those symbols. Each symbol has its own spread markup (points), commission, swap multiplier and trading switch. Use Add, Edit (or double-click a row), Delete, Up and Down; changes are kept until you press OK, and Cancel discards them.',
  Commissions: 'Commission schedules charged to accounts in this group, by symbol and volume range. Per lot charges the value per lot, Percentage charges a percent of the deal notional, Flat charges a fixed amount per deal. Add, Edit and Delete save immediately; OK and Cancel do not affect them.',
};

const inputClass = 'bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-2 py-0.5 text-[11px] text-[color:var(--text-primary)] focus:border-blue-500/50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';
const modalInputClass = 'w-full bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-sm px-2 py-1 text-[11px] text-[color:var(--text-primary)] outline-none focus:border-blue-500/50';
const dialogButtonClass = 'px-8 py-1.5 bg-[#404040] hover:bg-[color:var(--border-strong)] text-[12px] text-white border border-black/60 rounded-sm shadow-md transition-shadow active:shadow-none hover:border-black/80 disabled:opacity-50';

const Label = ({ children, width = 'w-40', htmlFor }) => (
  <label htmlFor={htmlFor} className={`text-[11px] text-[color:var(--text-primary)] ${width} text-right shrink-0 select-none`}>{children}:</label>
);

const NotAvailableHint = () => (
  <span className="text-[10px] italic text-[color:var(--text-muted)] whitespace-nowrap">not available yet</span>
);

const FieldError = ({ message, ml = 'ml-44' }) => (
  message ? <div className={`${ml} -mt-1 mb-2 text-[10px] text-[color:var(--danger-500)]`}>{message}</div> : null
);

const SelectField = ({ id, label, options, value, onChange, width = 'w-full', labelWidth, disabled = false, hint }) => (
  <div className={`flex items-center gap-3 mb-2 ${disabled ? 'opacity-60' : ''}`}>
    <Label width={labelWidth} htmlFor={id}>{label}</Label>
    <select
      id={id}
      value={value}
      onChange={onChange || (() => {})}
      disabled={disabled}
      className={`${width} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-1 py-0.5 text-[11px] text-[color:var(--text-primary)] focus:border-blue-500/50 focus:outline-none appearance-none`}
      style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23808080\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '0.75rem' }}
    >
      {options.map((opt) => {
        const option = typeof opt === 'string' ? { value: opt, label: opt } : opt;
        return <option key={option.value} value={option.value}>{option.label}</option>;
      })}
    </select>
    {hint}
  </div>
);

const CheckboxField = ({ label, checked, onChange, ml = 'ml-44', disabled = false, hint }) => (
  <div className={`flex items-start gap-2 mb-1.5 ${ml}`}>
    <label className={`flex items-start gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={onChange || (() => {})}
        disabled={disabled}
        className="mt-0.5 w-3.5 h-3.5 accent-blue-500 rounded-sm border-[color:var(--border-default)]"
      />
      <span className="text-[11px] text-[color:var(--text-primary)] leading-tight select-none">{label}</span>
    </label>
    {hint}
  </div>
);

const SideButton = ({ icon: Icon, label, onClick, disabled = false, title }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className="flex flex-col items-center justify-center w-20 py-1.5 bg-[#404040] hover:bg-[color:var(--bg-surface-3)] border border-black/40 rounded-sm mb-1.5 group transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#404040]"
  >
    {Icon && <Icon size={14} className="text-[color:var(--text-muted)] group-hover:text-white" />}
    {label && <span className="text-[10px] text-[color:var(--text-secondary)] font-medium uppercase mt-0.5">{label}</span>}
  </button>
);

const ModalShell = ({ title, onClose, children, footer, width = 'w-[450px]', onSubmit }) => (
  <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <MotionDiv
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`${width} bg-[color:var(--bg-surface-1)] rounded-md shadow-2xl shadow-black/80 border border-[color:var(--border-default)] overflow-hidden`}
    >
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} noValidate>
        <div className="h-8 bg-[#323233] flex items-center px-3 justify-between select-none">
          <span className="text-[12px] font-medium text-[color:var(--text-secondary)]">{title}</span>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 hover:bg-[#c42b1c] rounded-sm text-[color:var(--text-muted)] hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="p-5 bg-[color:var(--bg-app)]">{children}</div>
        <div className="h-12 bg-[color:var(--bg-surface-1)] border-t border-black/40 flex items-center justify-end px-4 gap-2">{footer}</div>
      </form>
    </MotionDiv>
  </div>
);

const ModalRow = ({ label, htmlFor, children, labelWidth = '100px' }) => (
  <div className="grid items-center gap-3" style={{ gridTemplateColumns: `${labelWidth} 1fr` }}>
    <label htmlFor={htmlFor} className="text-[11px] text-[color:var(--text-muted)] text-right">{label}:</label>
    {children}
  </div>
);

/** Inline "add symbol" picker; mounted only while adding so LP symbols load on demand. */
const SymbolAddPicker = ({ groupName, existing, error, onAdd, onAddMany, onCancel, onInput }) => {
  const [value, setValue] = useState('');
  const [mode, setMode] = useState('symbol');
  const [category, setCategory] = useState('');
  const { symbols } = useLpSymbols();
  const categories = useMemo(() => symbolCategoryOptions(symbols, existing), [symbols, existing]);
  const selectedCategory = categories.find((option) => option.category === category);

  const modeButton = (key, label) => (
    <button
      type="button"
      onClick={() => { setMode(key); onInput(); }}
      className={`px-2 py-0.5 text-[10px] rounded-sm border ${mode === key
        ? 'bg-[color:var(--accent-500)] border-[color:var(--accent-500)] text-white'
        : 'bg-transparent border-[color:var(--border-default)] text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]'}`}
    >
      {label}
    </button>
  );

  if (mode === 'category') {
    return (
      <div className="px-3 py-2 border-t border-black/10 bg-[color:var(--bg-surface-1)] flex flex-col gap-1.5">
        <div className="flex items-center gap-1">{modeButton('symbol', 'Symbol')}{modeButton('category', 'By category')}</div>
        <div className="flex items-center gap-1.5">
          <select
            autoFocus
            value={category}
            onChange={(e) => { setCategory(e.target.value); onInput(); }}
            aria-label={`Category to add to ${groupName}`}
            className="flex-1 min-w-0 bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-2 py-1 text-[11px] text-[color:var(--text-primary)] outline-none focus:border-blue-500/50"
          >
            <option value="">Select a category…</option>
            {categories.map((option) => (
              <option key={option.category} value={option.category} disabled={option.addable === 0}>
                {option.category} ({option.symbols.length} symbols{option.addable < option.symbols.length ? `, ${option.addable} new` : ''})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => selectedCategory && onAddMany(selectedCategory.symbols)}
            disabled={!selectedCategory || selectedCategory.addable === 0}
            className="px-3 py-1 text-[11px] bg-[color:var(--accent-500)] text-white rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {selectedCategory ? `Add ${selectedCategory.addable} symbol${selectedCategory.addable === 1 ? '' : 's'}` : 'Add'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 text-[11px] bg-[color:var(--bg-surface-3)] border border-[color:var(--border-default)] text-[color:var(--text-primary)] rounded-sm transition-colors"
          >
            Cancel
          </button>
        </div>
        {selectedCategory && (
          <div className="text-[10px] text-[color:var(--text-muted)] truncate" title={selectedCategory.symbols.map((s) => s.symbol).join(', ')}>
            {selectedCategory.symbols.map((s) => s.symbol).join(', ')}
          </div>
        )}
        {error && <div className="text-[11px] text-[color:var(--danger-500)]">{error}</div>}
      </div>
    );
  }

  const confirm = () => {
    const name = value.trim();
    if (!name) return;
    const entry = symbols.find((item) => String(item.symbol).toUpperCase() === name.toUpperCase());
    onAdd(entry ? entry.symbol : name, { configured: entry ? Boolean(entry.configured) : true });
  };

  return (
    <div className="px-3 py-2 border-t border-black/10 bg-[color:var(--bg-surface-1)] flex flex-col gap-1.5">
      <div className="flex items-center gap-1">{modeButton('symbol', 'Symbol')}{modeButton('category', 'By category')}</div>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          autoFocus
          value={value}
          onChange={(e) => { setValue(e.target.value); onInput(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); confirm(); }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
          }}
          list="group-symbol-add-options"
          autoComplete="off"
          aria-label={`Symbol to add to ${groupName}`}
          placeholder="Symbol (e.g. XAUUSD)"
          className="flex-1 min-w-0 bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-2 py-1 text-[11px] font-mono text-[color:var(--text-primary)] outline-none focus:border-blue-500/50"
        />
        <LpSymbolDatalist id="group-symbol-add-options" exclude={existing} />
        <button
          type="button"
          onClick={confirm}
          disabled={!value.trim()}
          className="px-3 py-1 text-[11px] bg-[color:var(--accent-500)] text-white rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1 text-[11px] bg-[color:var(--bg-surface-3)] border border-[color:var(--border-default)] text-[color:var(--text-primary)] rounded-sm transition-colors"
        >
          Cancel
        </button>
      </div>
      {error && <div className="text-[11px] text-[color:var(--danger-500)]">{error}</div>}
    </div>
  );
};

const GroupPropertiesPopup = ({ group, onClose, onSaved }) => {
  const currentGroupName = getGroupName(group);
  const dragControls = useDragControls();
  const { notify } = useToast();

  const [activeTab, setActiveTab] = useState('Margin');
  const [showHelp, setShowHelp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  // True once anything was written server-side, so the caller refreshes even
  // if the dialog is then cancelled (e.g. margin saved, symbols failed).
  const persistedRef = useRef(false);

  // --- Margin (staged, saved on OK) ---
  const [initialMargin, setInitialMargin] = useState(() => buildMarginForm(group));
  const [marginForm, setMarginForm] = useState(initialMargin);
  const marginDirty = isMarginFormDirty(initialMargin, marginForm);
  // Only flag problems once the admin has touched the Margin fields.
  const marginErrors = useMemo(
    () => (marginDirty ? validateMarginForm(marginForm).errors : {}),
    [marginDirty, marginForm]
  );

  const setMarginField = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setMarginForm((current) => ({ ...current, [field]: value }));
  };

  // --- Symbols (staged, saved on OK) ---
  const [symbolsBaseline, setSymbolsBaseline] = useState(null);
  const [symbolRows, setSymbolRows] = useState([]);
  const [symbolsLoading, setSymbolsLoading] = useState(false);
  const [symbolsError, setSymbolsError] = useState('');
  const [selectedSymbolIndex, setSelectedSymbolIndex] = useState(-1);
  const [isAddingSymbol, setIsAddingSymbol] = useState(false);
  const [addSymbolError, setAddSymbolError] = useState('');
  const [symbolEditor, setSymbolEditor] = useState(null);
  const symbolsLoaded = symbolsBaseline !== null;
  const symbolsDirty = symbolsLoaded && isGroupSymbolListDirty(symbolsBaseline, symbolRows);
  const listedSymbols = useMemo(() => symbolRows.map((row) => row.symbol), [symbolRows]);
  const selectedSymbolRow = symbolRows[selectedSymbolIndex] || null;

  // --- Symbol overrides (staged, saved on OK) ---
  const [overridesView, setOverridesView] = useState(null);
  const [overridesLoading, setOverridesLoading] = useState(false);
  const [overridesError, setOverridesError] = useState('');
  const [stagedOverrides, setStagedOverrides] = useState(() => new Map());
  const [overrideQuery, setOverrideQuery] = useState('');
  const [overrideFilter, setOverrideFilter] = useState('all');
  const overridesDirty = stagedOverrides.size > 0;
  const overrideRows = useMemo(
    () => (overridesView ? overridesView.rows.map((row) => applyStagedOverride(row, stagedOverrides)) : []),
    [overridesView, stagedOverrides]
  );
  const visibleOverrideRows = useMemo(
    () => filterGroupSymbolRows(overrideRows, overrideQuery, overrideFilter),
    [overrideRows, overrideQuery, overrideFilter]
  );
  const overrideSummary = useMemo(() => summarizeGroupSymbols(overrideRows), [overrideRows]);

  // --- Commissions (immediate CRUD) ---
  const [commissions, setCommissions] = useState([]);
  const [commissionsLoaded, setCommissionsLoaded] = useState(false);
  const [commissionsLoading, setCommissionsLoading] = useState(false);
  const [commissionsError, setCommissionsError] = useState('');
  const [selectedCommissionId, setSelectedCommissionId] = useState(null);
  const [commissionEditor, setCommissionEditor] = useState(null);
  const [isSubmittingCommission, setIsSubmittingCommission] = useState(false);
  const [isDeletingCommission, setIsDeletingCommission] = useState(false);
  const selectedCommission = commissions.find((row) => getScheduleId(row) === selectedCommissionId) || null;

  const loadSymbols = useCallback(async () => {
    setSymbolsLoading(true);
    setSymbolsError('');
    try {
      const { rows } = normalizeGroupSymbolsResponse(await ManagerService.getGroupAllowedSymbols(currentGroupName));
      setSymbolsBaseline(rows);
      setSymbolRows(rows);
      setSelectedSymbolIndex(-1);
    } catch (error) {
      setSymbolsError(getApiErrorMessage(error, 'Failed to load group symbols.'));
    } finally {
      setSymbolsLoading(false);
    }
  }, [currentGroupName]);

  const loadOverrides = useCallback(async () => {
    setOverridesLoading(true);
    setOverridesError('');
    try {
      setOverridesView(normalizeGroupSymbolOverrides(await ManagerService.getGroupSymbolOverrides(currentGroupName)));
      setStagedOverrides(new Map());
    } catch (error) {
      setOverridesError(getApiErrorMessage(error, 'Failed to load group symbols.'));
    } finally {
      setOverridesLoading(false);
    }
  }, [currentGroupName]);

  const loadCommissions = useCallback(async () => {
    setCommissionsLoading(true);
    setCommissionsError('');
    try {
      const res = await ManagerService.getCommissionScheduleList(currentGroupName);
      const list = filterSchedulesForGroup(normalizeArrayResponse(res), currentGroupName);
      setCommissions(list);
      setSelectedCommissionId((current) => (list.some((row) => getScheduleId(row) === current) ? current : null));
      setCommissionsLoaded(true);
    } catch (error) {
      setCommissionsError(getApiErrorMessage(error, 'Failed to load commission schedules.'));
    } finally {
      setCommissionsLoading(false);
    }
  }, [currentGroupName]);

  const selectTab = (tab) => {
    setActiveTab(tab);
    if (tab === 'Symbols' && !overridesView && !overridesLoading) loadOverrides();
    if (tab === 'Symbol List' && !symbolsLoaded && !symbolsLoading) loadSymbols();
    if (tab === 'Commissions' && !commissionsLoading) loadCommissions();
  };

  // --- Symbols tab actions ---
  const startAddSymbol = () => {
    if (!symbolsLoaded) return;
    setAddSymbolError('');
    setIsAddingSymbol(true);
  };

  const cancelAddSymbol = () => {
    setIsAddingSymbol(false);
    setAddSymbolError('');
  };

  const handleAddSymbol = (symbol, options) => {
    try {
      const next = addGroupSymbolRow(symbolRows, symbol, options);
      setSymbolRows(next);
      setSelectedSymbolIndex(next.length - 1);
      setIsAddingSymbol(false);
      setAddSymbolError('');
    } catch (error) {
      setAddSymbolError(error.message);
    }
  };

  const handleAddSymbols = (items) => {
    const { rows, added } = addGroupSymbolRows(symbolRows, items);
    if (added === 0) {
      setAddSymbolError('Every symbol in this category is already in the list.');
      return;
    }
    setSymbolRows(rows);
    setSelectedSymbolIndex(rows.length - 1);
    setIsAddingSymbol(false);
    setAddSymbolError('');
  };

  const moveSelectedSymbol = (delta) => {
    const { rows, index } = moveGroupSymbolRow(symbolRows, selectedSymbolIndex, delta);
    setSymbolRows(rows);
    setSelectedSymbolIndex(index);
  };

  const deleteSelectedSymbol = () => {
    const row = selectedSymbolRow;
    if (!row) return;
    if (row.persisted && !window.confirm(`Remove ${row.symbol} from group "${currentGroupName}"?\n\nThe change is saved when you press OK.`)) return;
    const next = removeGroupSymbolRow(symbolRows, selectedSymbolIndex);
    setSymbolRows(next);
    setSelectedSymbolIndex(next.length === 0 ? -1 : Math.min(selectedSymbolIndex, next.length - 1));
  };

  const openSymbolEditor = (index) => {
    const row = symbolRows[index];
    if (!row) return;
    setSelectedSymbolIndex(index);
    setSymbolEditor({ index, symbol: row.symbol, form: groupSymbolEditForm(row), errors: {} });
  };

  const setSymbolEditorField = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setSymbolEditor((current) => ({ ...current, form: { ...current.form, [field]: value }, errors: { ...current.errors, [field]: undefined } }));
  };

  const applySymbolEdit = () => {
    const { values, errors } = validateGroupSymbolEdit(symbolEditor.form);
    if (Object.keys(errors).length > 0) {
      setSymbolEditor((current) => ({ ...current, errors }));
      return;
    }
    setSymbolRows((rows) => updateGroupSymbolRow(rows, symbolEditor.index, values));
    setSymbolEditor(null);
  };

  // --- Commissions tab actions ---
  const openCreateCommission = () => {
    setCommissionEditor({ mode: 'create', id: null, form: emptyCommissionForm(), error: '' });
  };

  const openEditCommission = (row) => {
    const target = row || selectedCommission;
    if (!target) return;
    setSelectedCommissionId(getScheduleId(target));
    setCommissionEditor({ mode: 'edit', id: getScheduleId(target), form: commissionFormFromSchedule(target), error: '' });
  };

  const setCommissionField = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setCommissionEditor((current) => ({ ...current, form: { ...current.form, [field]: value }, error: '' }));
  };

  const submitCommission = async () => {
    if (!commissionEditor || isSubmittingCommission) return;
    const isEdit = commissionEditor.mode === 'edit';
    let payload;
    try {
      payload = buildCommissionSchedulePayload(commissionEditor.form, currentGroupName, isEdit ? { id: commissionEditor.id } : {});
    } catch (error) {
      setCommissionEditor((current) => ({ ...current, error: error.message }));
      return;
    }

    setIsSubmittingCommission(true);
    try {
      if (isEdit) await ManagerService.updateCommissionSchedule(payload);
      else await ManagerService.createCommissionSchedule(payload);
      notify({ title: isEdit ? 'Commission updated' : 'Commission created', description: `${payload.name} · ${payload.symbol}`, tone: 'success' });
      setCommissionEditor(null);
      loadCommissions();
    } catch (error) {
      const message = getApiErrorMessage(error, isEdit ? 'Failed to update commission.' : 'Failed to create commission.');
      setCommissionEditor((current) => (current ? { ...current, error: message } : current));
    } finally {
      setIsSubmittingCommission(false);
    }
  };

  const deleteSelectedCommission = async () => {
    const row = selectedCommission;
    if (!row || isDeletingCommission) return;
    if (!window.confirm(`Delete commission schedule "${row.name}" (${row.symbol})?\n\nThis takes effect immediately.`)) return;

    setIsDeletingCommission(true);
    setCommissionsError('');
    try {
      await ManagerService.deleteCommissionSchedule(getScheduleId(row));
      notify({ title: 'Commission deleted', description: `${row.name} · ${row.symbol}`, tone: 'success' });
      setSelectedCommissionId(null);
      loadCommissions();
    } catch (error) {
      const message = getApiErrorMessage(error, 'Failed to delete commission.');
      setCommissionsError(message);
      notify({ title: 'Delete failed', description: message, tone: 'danger' });
    } finally {
      setIsDeletingCommission(false);
    }
  };

  // --- Dialog buttons ---
  const closeDialog = () => {
    if (isSaving) return;
    if (persistedRef.current) onSaved?.();
    onClose();
  };

  const handleOk = async () => {
    if (isSaving) return;
    setSaveError(null);

    let marginChanges = {};
    if (marginDirty) {
      const { changes, errors } = buildMarginChanges(initialMargin, marginForm);
      const firstError = Object.values(errors)[0];
      if (firstError) {
        setActiveTab('Margin');
        setSaveError(firstError);
        return;
      }
      marginChanges = changes;
    }

    const saveMargin = Object.keys(marginChanges).length > 0;
    if (!saveMargin && !symbolsDirty && !overridesDirty) {
      closeDialog();
      return;
    }

    setIsSaving(true);
    const summary = [];
    let failedTab = 'Margin';
    try {
      if (saveMargin) {
        const res = await ManagerService.updateGroup({ originalName: currentGroupName, ...marginChanges });
        persistedRef.current = true;
        setInitialMargin(marginForm);
        summary.push(describeAccountsUpdated(res) || 'Margin settings saved.');
      }

      if (overridesDirty) {
        failedTab = 'Symbols';
        const changes = buildGroupSymbolOverrideChanges(stagedOverrides);
        const res = await ManagerService.saveGroupSymbolOverrides(currentGroupName, changes);
        persistedRef.current = true;
        setOverridesView(normalizeGroupSymbolOverrides(res));
        setStagedOverrides(new Map());
        const off = changes.filter((change) => !change.trade_allowed).length;
        const on = changes.length - off;
        summary.push([
          off && `${off} symbol${off === 1 ? '' : 's'} turned off.`,
          on && `${on} symbol${on === 1 ? '' : 's'} follow global again.`,
        ].filter(Boolean).join(' '));
      }

      if (symbolsDirty) {
        failedTab = 'Symbol List';
        const payload = buildGroupSymbolsSavePayload(currentGroupName, symbolRows);
        const res = await ManagerService.saveGroupAllowedSymbols(payload.group, payload.symbols);
        persistedRef.current = true;
        const saved = normalizeGroupSymbolsResponse(res).rows;
        const count = res && Array.isArray(res.symbols) ? saved.length : payload.symbols.length;
        summary.push(count === 0 ? 'All broker symbols allowed.' : `${count} symbol${count === 1 ? '' : 's'} allowed.`);
      }

      notify({ title: 'Group updated', description: `${currentGroupName} — ${summary.join(' ')}`, tone: 'success' });
      onSaved?.();
      onClose();
    } catch (error) {
      const reason = getApiErrorMessage(error, 'request failed.');
      const what = { Margin: 'margin settings', Symbols: 'symbol overrides', 'Symbol List': 'symbol list' }[failedTab];
      setActiveTab(failedTab);
      setSaveError(summary.length > 0
        ? `${summary.join(' ')} But saving the ${what} failed: ${reason}`
        : `Failed to save ${what}: ${reason}`);
    } finally {
      setIsSaving(false);
    }
  };

  const tabDirty = { Margin: marginDirty, Symbols: overridesDirty, 'Symbol List': symbolsDirty, Commissions: false };
  const commissionTypeHint = COMMISSION_TYPE_OPTIONS.find((option) => option.value === commissionEditor?.form.commission_type)?.valueHint;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
      <MotionDiv
        drag
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="w-[720px] bg-[color:var(--bg-surface-1)] rounded-lg shadow-2xl shadow-black/80 border border-[color:var(--border-default)] overflow-hidden"
      >
        {/* Title Bar */}
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="h-8 bg-[color:var(--bg-surface-2)] border-b border-[color:var(--border-default)] flex items-center px-3 justify-between select-none cursor-move"
        >
          <div className="flex items-center gap-2">
            <Users size={14} className="text-emerald-400" />
            <span className="text-[12px] font-medium text-[color:var(--text-secondary)]">Group: {currentGroupName}</span>
          </div>
          <div className="flex items-center gap-1 h-full">
            <button type="button" onClick={closeDialog} aria-label="Close" className="p-1.5 hover:bg-[#c42b1c] rounded-sm text-[color:var(--text-muted)] hover:text-white transition-colors"><X size={14} /></button>
          </div>
        </div>

        {/* Tab Selection */}
        <div role="tablist" className="px-2 pt-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/20 flex gap-0.5 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => selectTab(tab)}
              title={tabDirty[tab] ? 'Unsaved changes — press OK to save' : undefined}
              className={`px-3 py-1.5 text-[11px] transition-colors relative whitespace-nowrap ${
                activeTab === tab ? 'text-[color:var(--text-primary)] bg-[color:var(--bg-app)] border-t border-l border-r border-[color:var(--border-default)] rounded-t-sm' : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]'
              }`}
            >
              {tab}{tabDirty[tab] && <span className="ml-1 text-amber-400">*</span>}
              {activeTab === tab && <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>}
            </button>
          ))}
        </div>

        {/* --- Content Area --- */}
        <div className="p-6 bg-[color:var(--bg-app)] min-h-[440px] max-h-[500px] overflow-y-auto custom-scrollbar">
          <div className="flex gap-4 mb-6">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20 shrink-0">
              <Users size={32} className="text-emerald-500/80" />
            </div>
            <div className="text-[11px] text-[color:var(--text-muted)] leading-normal pt-1 italic pb-4">
              {TAB_INTRO[activeTab]}
              {tabDirty[activeTab] && (
                <div className="not-italic mt-1 text-amber-400">Unsaved changes — press OK to save or Cancel to discard.</div>
              )}
            </div>
          </div>

          {showHelp && (
            <div className="mb-5 p-3 border border-blue-500/30 bg-blue-500/5 rounded-sm text-[11px] text-[color:var(--text-secondary)] space-y-1.5" role="note">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium text-[color:var(--text-primary)]"><HelpCircle size={12} /> Help</span>
                <button type="button" onClick={() => setShowHelp(false)} aria-label="Close help" className="p-0.5 rounded-sm text-[color:var(--text-muted)] hover:text-white hover:bg-white/10"><X size={12} /></button>
              </div>
              {TABS.map((tab) => (
                <p key={tab} className={tab === activeTab ? '' : 'opacity-60'}>
                  <span className="font-medium text-[color:var(--text-primary)]">{tab}: </span>{TAB_HELP[tab]}
                </p>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            <MotionDiv key={activeTab} initial={{ opacity: 0, x: 5 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.15 }}>

              {/* --- MARGIN TAB --- */}
              {activeTab === 'Margin' && (
                <div className="space-y-4">
                  <div>
                    <SelectField
                      id="group-execution-mode"
                      label="Execution mode"
                      options={EXECUTION_MODE_OPTIONS.some((o) => o.value === marginForm.executionMode)
                        ? EXECUTION_MODE_OPTIONS
                        : [{ value: marginForm.executionMode, label: marginForm.executionMode || '—' }, ...EXECUTION_MODE_OPTIONS]}
                      value={marginForm.executionMode}
                      onChange={setMarginField('executionMode')}
                      width="w-64"
                    />
                    <FieldError message={marginErrors.executionMode} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <Label width="w-40" htmlFor="group-margin-call">Margin call level</Label>
                      <input id="group-margin-call" type="number" min="0" step="any" value={marginForm.marginCallLevel} onChange={setMarginField('marginCallLevel')} aria-invalid={Boolean(marginErrors.marginCallLevel)} className={`w-20 ${inputClass}`} />
                      <Label width="w-24" htmlFor="group-stop-out">Stop out level</Label>
                      <input id="group-stop-out" type="number" min="0" step="any" value={marginForm.stopOutLevel} onChange={setMarginField('stopOutLevel')} aria-invalid={Boolean(marginErrors.stopOutLevel)} className={`w-20 ${inputClass}`} />
                      <select disabled value="percent" onChange={() => {}} aria-label="Stop out unit" className="bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-1 py-0.5 text-[11px] text-[color:var(--text-primary)] outline-none opacity-60 cursor-not-allowed">
                        <option value="percent">in %, percent</option>
                      </select>
                      <NotAvailableHint />
                    </div>
                    {(marginErrors.marginCallLevel || marginErrors.stopOutLevel) && (
                      <div className="ml-44 mt-1 text-[10px] text-[color:var(--danger-500)] space-y-0.5">
                        {marginErrors.marginCallLevel && <div>{marginErrors.marginCallLevel}</div>}
                        {marginErrors.stopOutLevel && <div>{marginErrors.stopOutLevel}</div>}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <CheckboxField label="Stop out fully hedged accounts" disabled hint={<NotAvailableHint />} />
                    <CheckboxField
                      label="Compensate negative balance after stop out"
                      checked={marginForm.negativeBalanceProtection}
                      onChange={setMarginField('negativeBalanceProtection')}
                    />
                    <CheckboxField label="Withdraw credit after negative balance compensation" disabled hint={<NotAvailableHint />} />
                  </div>
                  <SelectField label="Floating leverage profile" options={['None']} value="None" disabled width="w-64" hint={<NotAvailableHint />} />

                  <div className="p-4 border border-[color:var(--border-default)] rounded-sm relative mt-6">
                    <span className="absolute -top-2.5 left-4 px-2 bg-[color:var(--bg-app)] text-[10px] text-[color:var(--text-muted)] font-medium">Profit/loss in free margin <span className="italic font-normal">— not available yet</span></span>
                    <SelectField label="Unrealized profit" options={['use unrealized profit/loss']} value="use unrealized profit/loss" disabled width="w-64" />
                    <SelectField label="Daily fixed profit" options={['use daily fixed profit/loss']} value="use daily fixed profit/loss" disabled width="w-64" />
                    <CheckboxField label="Release fixed profit at the end of day" disabled />
                  </div>
                  <div className="flex items-center gap-3 opacity-60">
                    <Label width="w-40">Virtual credit</Label>
                    <input type="text" disabled value="" onChange={() => {}} aria-label="Virtual credit" className={`w-24 ${inputClass}`} />
                    <span className="text-[10px] text-[color:var(--text-muted)]">(applies only to opening new positions)</span>
                    <NotAvailableHint />
                  </div>
                </div>
              )}

              {/* --- SYMBOLS TAB (global symbols + group overrides) --- */}
              {activeTab === 'Symbols' && (
                <div className="flex flex-col gap-2">
                  {overridesView?.legacyAllowList && (
                    <div className="px-3 py-2 border border-amber-500/40 bg-amber-500/5 rounded-sm text-[11px] text-amber-300" role="note">
                      This group has a legacy allowed-symbols list ({overridesView.allowListCount} symbols). Symbols outside it stay blocked
                      (&quot;Not in allow-list&quot;). Clear it on the Symbol List tab to let the group follow Symbol Management.
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="search"
                      value={overrideQuery}
                      onChange={(event) => setOverrideQuery(event.target.value)}
                      placeholder="Search symbol or category"
                      aria-label="Search symbols"
                      className={`flex-1 min-w-0 ${inputClass}`}
                    />
                    <select
                      value={overrideFilter}
                      onChange={(event) => setOverrideFilter(event.target.value)}
                      aria-label="Filter symbols"
                      className={`w-40 ${inputClass}`}
                    >
                      {GROUP_SYMBOL_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                  {overridesView && (
                    <div className="text-[10px] text-[color:var(--text-muted)]">
                      {overrideSummary.tradeable} of {overrideSummary.total} symbols tradeable · {overrideSummary.overrides} group override{overrideSummary.overrides === 1 ? '' : 's'}
                      {visibleOverrideRows.length !== overrideRows.length && ` · showing ${visibleOverrideRows.length}`}
                    </div>
                  )}
                  <div className="border border-[color:var(--border-default)] bg-[color:var(--bg-app)] overflow-hidden rounded-sm">
                    <div className="grid grid-cols-[1fr_84px_120px_70px_64px] border-b border-[color:var(--border-default)] bg-[color:var(--bg-surface-1)] text-[11px] font-medium text-[color:var(--text-muted)]">
                      <div className="px-3 py-1.5 border-r border-[color:var(--border-default)]">Symbol</div>
                      <div className="px-2 py-1.5 border-r border-[color:var(--border-default)] text-center">Global</div>
                      <div className="px-2 py-1.5 border-r border-[color:var(--border-default)] text-center">Group</div>
                      <div className="px-2 py-1.5 border-r border-[color:var(--border-default)] text-center">Effective</div>
                      <div className="px-2 py-1.5 text-center">Trading</div>
                    </div>
                    <div className="text-[11px] tabular-nums max-h-[260px] overflow-y-auto custom-scrollbar" aria-label={`Symbols of ${currentGroupName}`}>
                      {overridesLoading && <div className="p-4 text-center text-[color:var(--text-muted)]">Loading symbols...</div>}
                      {!overridesLoading && overridesError && (
                        <div className="p-4 text-center text-[color:var(--danger-500)]">
                          {overridesError}{' '}
                          <button type="button" onClick={loadOverrides} className="underline text-[color:var(--text-secondary)] hover:text-white">Retry</button>
                        </div>
                      )}
                      {!overridesLoading && overridesView && visibleOverrideRows.length === 0 && (
                        <div className="p-4 text-center text-[color:var(--text-muted)]">No symbols match.</div>
                      )}
                      {!overridesLoading && visibleOverrideRows.map((row) => {
                        const editable = isGroupSymbolEditable(row);
                        const status = GROUP_SYMBOL_STATUS[row.status];
                        const statusColor = row.status === 'global'
                          ? 'text-[color:var(--text-muted)]'
                          : row.status === 'override_off' ? 'text-amber-400' : 'text-[color:var(--danger-500)]';
                        return (
                          <div
                            key={row.symbol}
                            className={`grid grid-cols-[1fr_84px_120px_70px_64px] border-b border-black/10 items-center ${row.staged ? 'bg-amber-500/5' : ''}`}
                          >
                            <div className="px-3 py-1 border-r border-black/10 truncate font-mono text-[color:var(--text-primary)] min-w-0" title={row.category || undefined}>
                              {row.symbol}{row.staged && <span className="ml-1 text-amber-400">*</span>}
                            </div>
                            <div className={`px-2 py-1 border-r border-black/10 text-center ${row.globalEnabled ? 'text-[color:var(--text-secondary)]' : 'text-[color:var(--danger-500)]'}`}>
                              {row.globalEnabled ? 'Enabled' : 'Disabled'}
                            </div>
                            <div className={`px-2 py-1 border-r border-black/10 text-center truncate ${statusColor}`} title={status.hint}>
                              {status.label}
                            </div>
                            <div className={`px-2 py-1 border-r border-black/10 text-center font-medium ${row.effective ? 'text-emerald-400' : 'text-[color:var(--text-muted)]'}`}>
                              {row.effective ? 'ON' : 'OFF'}
                            </div>
                            <div className="px-2 py-0.5 text-center">
                              <button
                                type="button"
                                onClick={() => setStagedOverrides((current) => toggleStagedOverride(current, row))}
                                disabled={!editable}
                                title={editable ? (row.override === 'off' ? 'Follow the global setting again' : 'Turn off for this group') : status.hint}
                                aria-label={`${row.override === 'off' ? 'Follow global for' : 'Turn off'} ${row.symbol}`}
                                className="px-2 py-0.5 text-[10px] border border-[color:var(--border-default)] rounded-sm text-[color:var(--text-secondary)] hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                              >
                                {row.override === 'off' ? 'Reset' : 'Off'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* --- SYMBOL LIST TAB (legacy allow-list + per-symbol parameters) --- */}
              {activeTab === 'Symbol List' && (
                <div className="flex gap-4">
                  <div className="flex flex-col pt-2">
                    <SideButton icon={ChevronUp} label="Up" onClick={() => moveSelectedSymbol(-1)} disabled={selectedSymbolIndex <= 0} />
                    <SideButton icon={ChevronDown} label="Down" onClick={() => moveSelectedSymbol(1)} disabled={selectedSymbolIndex < 0 || selectedSymbolIndex >= symbolRows.length - 1} />
                    <div className="h-10"></div>
                    <SideButton icon={Plus} label="Add" onClick={startAddSymbol} disabled={!symbolsLoaded} />
                    <SideButton icon={Pencil} label="Edit" onClick={() => openSymbolEditor(selectedSymbolIndex)} disabled={!selectedSymbolRow} />
                    <SideButton icon={Trash2} label="Delete" onClick={deleteSelectedSymbol} disabled={!selectedSymbolRow} />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <div className="px-3 py-2 border border-amber-500/40 bg-amber-500/5 rounded-sm text-[11px] text-amber-300" role="note">
                      Saving a non-empty list restricts this group to exactly the listed symbols — every other symbol is blocked.
                      To turn single symbols off, use the Symbols tab instead.
                    </div>
                    {symbolsLoaded && symbolRows.length === 0 && (
                      <div className="px-3 py-2 border border-blue-500/30 bg-blue-500/5 rounded-sm text-[11px] text-[color:var(--text-secondary)]">
                        No symbols listed — accounts in this group see ALL broker symbols. Add symbols to limit them.
                      </div>
                    )}
                    <div className="border border-[color:var(--border-default)] bg-[color:var(--bg-app)] overflow-hidden rounded-sm min-h-[300px]">
                      <div className="grid grid-cols-[1fr_80px_70px_70px_64px] border-b border-[color:var(--border-default)] bg-[color:var(--bg-surface-1)] text-[11px] font-medium text-[color:var(--text-muted)]">
                        <div className="px-3 py-1.5 border-r border-[color:var(--border-default)]">Symbol</div>
                        <div className="px-2 py-1.5 border-r border-[color:var(--border-default)] text-center">Spread Mku</div>
                        <div className="px-2 py-1.5 border-r border-[color:var(--border-default)] text-center">Comm</div>
                        <div className="px-2 py-1.5 border-r border-[color:var(--border-default)] text-center">Swap M.</div>
                        <div className="px-2 py-1.5 text-center">Trading</div>
                      </div>
                      <div className="text-[11px] tabular-nums" role="listbox" aria-label={`Symbols of ${currentGroupName}`}>
                        {symbolsLoading && <div className="p-4 text-center text-[color:var(--text-muted)]">Loading symbols...</div>}
                        {!symbolsLoading && symbolsError && (
                          <div className="p-4 text-center text-[color:var(--danger-500)]">
                            {symbolsError}{' '}
                            <button type="button" onClick={loadSymbols} className="underline text-[color:var(--text-secondary)] hover:text-white">Retry</button>
                          </div>
                        )}
                        {!symbolsLoading && symbolRows.map((row, index) => {
                          const selected = index === selectedSymbolIndex;
                          return (
                            <div
                              key={row.symbol}
                              role="option"
                              aria-selected={selected}
                              onClick={() => setSelectedSymbolIndex(index)}
                              onDoubleClick={() => openSymbolEditor(index)}
                              className={`grid grid-cols-[1fr_80px_70px_70px_64px] border-b border-black/10 items-center overflow-hidden transition-colors cursor-pointer ${
                                selected ? 'bg-blue-600/30 text-white' : 'hover:bg-white/5'
                              }`}
                            >
                              <div className="px-3 py-1 border-r border-black/10 truncate font-mono text-[color:var(--text-primary)] flex items-center gap-2 min-w-0">
                                <span className="text-[14px] font-bold text-orange-400">$</span>
                                <span className="truncate">{row.symbol}</span>
                                {!row.configured && (
                                  <span className="shrink-0 px-1 rounded-sm border border-amber-500/40 text-[9px] font-sans text-amber-400" title="No instrument is configured for this symbol yet">not configured</span>
                                )}
                              </div>
                              <div className="px-2 py-1 border-r border-black/10 text-center text-blue-400">{row.spread_markup ? `+${row.spread_markup}` : '0'}</div>
                              <div className="px-2 py-1 border-r border-black/10 text-center text-red-400">{row.commission}</div>
                              <div className="px-2 py-1 border-r border-black/10 text-center text-[color:var(--text-muted)]">{row.swap_multiplier}</div>
                              <div className={`px-2 py-1 text-center ${row.trade_allowed ? 'text-emerald-400' : 'text-[color:var(--text-muted)]'}`}>{row.trade_allowed ? 'on' : 'off'}</div>
                            </div>
                          );
                        })}
                        {symbolsLoaded && !symbolsLoading && (isAddingSymbol ? (
                          <SymbolAddPicker
                            groupName={currentGroupName}
                            existing={listedSymbols}
                            error={addSymbolError}
                            onAdd={handleAddSymbol}
                            onAddMany={handleAddSymbols}
                            onCancel={cancelAddSymbol}
                            onInput={() => setAddSymbolError('')}
                          />
                        ) : (
                          <div onClick={startAddSymbol} className="px-3 py-2 text-[#00a86b] font-medium cursor-pointer hover:bg-white/5 transition-colors">+ click to add...</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* --- COMMISSIONS TAB --- */}
              {activeTab === 'Commissions' && (
                <div className="flex gap-4">
                  <div className="flex flex-col pt-2">
                    <SideButton icon={Plus} label="Add" onClick={openCreateCommission} />
                    <SideButton icon={Pencil} label="Edit" onClick={() => openEditCommission()} disabled={!selectedCommission} />
                    <SideButton icon={Trash2} label="Delete" onClick={deleteSelectedCommission} disabled={!selectedCommission || isDeletingCommission} />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    {commissionsError && (
                      <div className="px-3 py-1.5 border border-red-500/30 bg-red-500/5 rounded-sm text-[11px] text-[color:var(--danger-500)] flex items-center justify-between gap-2">
                        <span className="truncate" title={commissionsError}>{commissionsError}</span>
                        <button type="button" onClick={loadCommissions} className="shrink-0 underline text-[color:var(--text-secondary)] hover:text-white">Retry</button>
                      </div>
                    )}
                    <div className="border border-[color:var(--border-default)] bg-[color:var(--bg-app)] overflow-hidden rounded-sm min-h-[300px]">
                      <div className="flex border-b border-[color:var(--border-default)] bg-[color:var(--bg-surface-1)] text-[11px] font-medium text-[color:var(--text-muted)] shrink-0">
                        <div className="w-32 px-3 py-1.5 border-r border-[color:var(--border-default)]">Name</div>
                        <div className="w-24 px-2 py-1.5 border-r border-[color:var(--border-default)]">Symbol</div>
                        <div className="w-24 px-2 py-1.5 border-r border-[color:var(--border-default)]">Type</div>
                        <div className="w-28 px-2 py-1.5 border-r border-[color:var(--border-default)]">Volume range</div>
                        <div className="w-20 px-2 py-1.5 border-r border-[color:var(--border-default)]">Value</div>
                        <div className="flex-1 px-2 py-1.5">Enabled</div>
                      </div>
                      <div className="text-[11px] tabular-nums">
                        {commissionsLoading && !commissionsLoaded && (
                          <div className="p-4 text-center text-[color:var(--text-muted)]">Loading commissions...</div>
                        )}
                        {commissions.map((row) => {
                          const id = getScheduleId(row);
                          const selected = id === selectedCommissionId;
                          return (
                            <div
                              key={id}
                              onClick={() => setSelectedCommissionId(id)}
                              onDoubleClick={() => openEditCommission(row)}
                              className={`flex border-b border-black/10 shrink-0 font-mono transition-colors cursor-pointer ${
                                selected ? 'bg-blue-600/30 text-white' : 'text-[color:var(--text-primary)] hover:bg-white/5'
                              } ${row.enabled === false ? 'opacity-60' : ''}`}
                            >
                              <div className="w-32 px-2 py-1.5 border-r border-black/10 flex items-center gap-1.5 min-w-0">
                                <span className="text-[#00a3ff] font-bold">%</span><span className="truncate" title={row.name}>{row.name}</span>
                              </div>
                              <div className="w-24 px-2 py-1.5 border-r border-black/10 truncate" title={row.symbol}>{row.symbol}</div>
                              <div className="w-24 px-2 py-1.5 border-r border-black/10 truncate font-sans">{formatCommissionType(row.commission_type)}</div>
                              <div className="w-28 px-2 py-1.5 border-r border-black/10 truncate">{formatVolumeRange(row)}</div>
                              <div className="w-20 px-2 py-1.5 border-r border-black/10 truncate">{row.value}</div>
                              <div className={`flex-1 px-2 py-1.5 font-sans ${row.enabled === false ? 'text-[color:var(--text-muted)]' : 'text-emerald-400'}`}>{row.enabled === false ? 'no' : 'yes'}</div>
                            </div>
                          );
                        })}
                        {commissionsLoaded && commissions.length === 0 && (
                          <div className="px-3 py-1.5 text-center text-[color:var(--text-muted)] border-b border-black/10">No commission schedules for this group</div>
                        )}
                        <div onClick={openCreateCommission} className="px-3 py-2 text-[#00a86b] font-medium cursor-pointer flex items-center gap-1.5 hover:bg-white/5 transition-colors">
                          <span className="text-[14px]">+</span> click to add...
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </MotionDiv>
          </AnimatePresence>
        </div>

        {/* Footer Area */}
        <div className="h-14 bg-[color:var(--bg-surface-1)] border-t border-black/40 flex items-center justify-end px-6 gap-2">
          {saveError && <span role="alert" className="mr-auto max-w-[360px] line-clamp-2 text-[11px] text-red-400" title={saveError}>{saveError}</span>}
          <button type="button" onClick={handleOk} disabled={isSaving} className={dialogButtonClass}>{isSaving ? 'Saving...' : 'OK'}</button>
          <button type="button" onClick={closeDialog} disabled={isSaving} className={dialogButtonClass}>Cancel</button>
          <button type="button" onClick={() => setShowHelp((value) => !value)} aria-pressed={showHelp} className={`${dialogButtonClass} ml-6 ${showHelp ? 'border-blue-500/60' : ''}`}>Help</button>
        </div>
      </MotionDiv>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #1e1e1e; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3e3e42; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4e4e52; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}} />

      {/* Symbol settings editor */}
      <AnimatePresence>
        {symbolEditor && (
          <ModalShell
            title={`Symbol settings: ${symbolEditor.symbol}`}
            width="w-[380px]"
            onClose={() => setSymbolEditor(null)}
            onSubmit={applySymbolEdit}
            footer={(
              <>
                <button type="button" onClick={() => setSymbolEditor(null)} className="px-4 py-1.5 bg-[#404040] hover:bg-[color:var(--border-strong)] text-[11px] text-white border border-black/60 rounded-sm">Cancel</button>
                <button type="submit" className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-[11px] text-white border border-blue-800 rounded-sm">Apply</button>
              </>
            )}
          >
            <div className="space-y-3">
              <ModalRow label="Spread markup" htmlFor="gs-spread" labelWidth="110px">
                <div>
                  <input id="gs-spread" type="number" min="0" step="1" autoFocus value={symbolEditor.form.spread_markup} onChange={setSymbolEditorField('spread_markup')} className={modalInputClass} />
                  <div className="mt-0.5 text-[10px] text-[color:var(--text-muted)]">points, whole number</div>
                </div>
              </ModalRow>
              <ModalRow label="Commission" htmlFor="gs-commission" labelWidth="110px">
                <input id="gs-commission" type="number" min="0" step="any" value={symbolEditor.form.commission} onChange={setSymbolEditorField('commission')} className={modalInputClass} />
              </ModalRow>
              <ModalRow label="Swap multiplier" htmlFor="gs-swap" labelWidth="110px">
                <input id="gs-swap" type="number" min="0" step="any" value={symbolEditor.form.swap_multiplier} onChange={setSymbolEditorField('swap_multiplier')} className={modalInputClass} />
              </ModalRow>
              <ModalRow label="Trading" htmlFor="gs-trading" labelWidth="110px">
                <label className="flex items-center gap-2 text-[11px] text-[color:var(--text-primary)] cursor-pointer">
                  <input id="gs-trading" type="checkbox" checked={symbolEditor.form.trade_allowed} onChange={setSymbolEditorField('trade_allowed')} className="w-3.5 h-3.5 accent-blue-500" />
                  Trading allowed
                </label>
              </ModalRow>
              {Object.values(symbolEditor.errors).filter(Boolean).map((message) => (
                <div key={message} className="text-[11px] text-[color:var(--danger-500)]">{message}</div>
              ))}
            </div>
          </ModalShell>
        )}
      </AnimatePresence>

      {/* Commission schedule create / edit */}
      <AnimatePresence>
        {commissionEditor && (
          <ModalShell
            title={commissionEditor.mode === 'edit' ? 'Edit Commission Schedule' : 'Create Commission Schedule'}
            onClose={() => setCommissionEditor(null)}
            onSubmit={submitCommission}
            footer={(
              <>
                <button type="button" onClick={() => setCommissionEditor(null)} className="px-4 py-1.5 bg-[#404040] hover:bg-[color:var(--border-strong)] text-[11px] text-white border border-black/60 rounded-sm">Cancel</button>
                <button type="submit" disabled={isSubmittingCommission} className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-[11px] text-white border border-blue-800 rounded-sm">
                  {isSubmittingCommission ? 'Saving...' : <><Save size={12} /> Save</>}
                </button>
              </>
            )}
          >
            <div className="space-y-3">
              <ModalRow label="Name" htmlFor="gc-name">
                <input id="gc-name" type="text" autoFocus value={commissionEditor.form.name} onChange={setCommissionField('name')} placeholder="e.g. EURUSD standard" className={modalInputClass} />
              </ModalRow>
              <ModalRow label="Group">
                <div className="px-2 py-1 text-[11px] font-mono text-[color:var(--text-secondary)] truncate" title={currentGroupName}>{currentGroupName}</div>
              </ModalRow>
              <ModalRow label="Symbol" htmlFor="gc-symbol">
                <input id="gc-symbol" type="text" value={commissionEditor.form.symbol} onChange={setCommissionField('symbol')} list="group-commission-symbol-options" autoComplete="off" placeholder="Symbol" className={`${modalInputClass} font-mono`} />
                <LpSymbolDatalist id="group-commission-symbol-options" />
              </ModalRow>
              <ModalRow label="Type" htmlFor="gc-type">
                <select id="gc-type" value={commissionEditor.form.commission_type} onChange={setCommissionField('commission_type')} className={modalInputClass}>
                  {!COMMISSION_TYPE_OPTIONS.some((option) => option.value === commissionEditor.form.commission_type) && (
                    <option value={commissionEditor.form.commission_type} disabled>{commissionEditor.form.commission_type} (unsupported — choose a type)</option>
                  )}
                  {COMMISSION_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </ModalRow>
              <ModalRow label="Value" htmlFor="gc-value">
                <div>
                  <input id="gc-value" type="number" min="0" step="any" value={commissionEditor.form.value} onChange={setCommissionField('value')} className={modalInputClass} />
                  {commissionTypeHint && <div className="mt-0.5 text-[10px] text-[color:var(--text-muted)]">{commissionTypeHint}</div>}
                </div>
              </ModalRow>
              <div className="grid grid-cols-2 gap-4">
                <ModalRow label="Min volume" htmlFor="gc-min">
                  <input id="gc-min" type="number" min="0" step="0.01" value={commissionEditor.form.min_volume} onChange={setCommissionField('min_volume')} placeholder="0" className={modalInputClass} />
                </ModalRow>
                <ModalRow label="Max volume" htmlFor="gc-max" labelWidth="70px">
                  <input id="gc-max" type="number" min="0" step="0.01" value={commissionEditor.form.max_volume} onChange={setCommissionField('max_volume')} className={modalInputClass} />
                </ModalRow>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <ModalRow label="Time from" htmlFor="gc-from">
                  <input id="gc-from" type="time" value={commissionEditor.form.time_from} onChange={setCommissionField('time_from')} className={modalInputClass} />
                </ModalRow>
                <ModalRow label="Time to" htmlFor="gc-to" labelWidth="70px">
                  <input id="gc-to" type="time" value={commissionEditor.form.time_to} onChange={setCommissionField('time_to')} className={modalInputClass} />
                </ModalRow>
              </div>
              {commissionEditor.mode === 'edit' && (
                <ModalRow label="Enabled" htmlFor="gc-enabled">
                  <label className="flex items-center gap-2 text-[11px] text-[color:var(--text-primary)] cursor-pointer">
                    <input id="gc-enabled" type="checkbox" checked={commissionEditor.form.enabled} onChange={setCommissionField('enabled')} className="w-3.5 h-3.5 accent-blue-500" />
                    Schedule is active
                  </label>
                </ModalRow>
              )}
              {commissionEditor.error && (
                <div role="alert" className="text-[11px] text-[color:var(--danger-500)]">{commissionEditor.error}</div>
              )}
            </div>
          </ModalShell>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GroupPropertiesPopup;
