import GroupMigrationPanel from '../organisms/GroupMigrationPanel.jsx';
import { groupMigration } from '../../services/groupMigration.js';
import GroupAuthorityPanel from '../organisms/GroupAuthorityPanel.jsx';
import { useAuthStore } from '../../store/authStore';
import { canEditGroup, canManageGroupLifecycle } from '../../utils/groupAccess';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { X, HelpCircle, Users, ChevronUp, ChevronDown, ChevronRight, Plus, Pencil, Trash2, Save, Info, AlertTriangle, UserPlus } from 'lucide-react';
import { ManagerService } from '../../services/manager.service';
import AccountCreatePopup from './AccountCreatePopup';
import {
  buildGroupLeverageChange,
  describeConfigError,
  readConfigError,
  readRevision,
  withExpectedRevision,
} from '../../utils/legacyConfig';
import { getApiErrorMessage, normalizeArrayResponse } from '../../utils/apiShapes';
import { findGroupFeedSymbol, normalizeGroupFeedSymbols } from '../../utils/groupFeedSymbols';
import { useToast } from '../ui/useToast';
import LpSymbolDatalist from '../atoms/LpSymbolDatalist';
import GroupAccountsTab from './GroupAccountsTab';
import { loadGroupTreePages } from '../../utils/groupTreeData';
import { GROUP_LIST_ARRAY_KEYS } from '../../utils/groupListCache';
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
  findGroupRecord,
  formatCommissionType,
  formatVolumeRange,
  getGroupName,
  getScheduleId,
  groupSymbolEditForm,
  isGroupSymbolListDirty,
  isMarginFormDirty,
  moveGroupSymbolRow,
  normalizeGroupSymbolsResponse,
  rebaseMarginForm,
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
import './GroupPropertiesPopup.css';

const MotionDiv = motion.div;

const TABS = ['Accounts', 'Margin', 'Symbols', 'Commissions', 'Inheritance', 'Migration'];

const TAB_INTRO = {
  Accounts: 'Trading accounts that belong to this group, loaded from the server. Double-click an account to open it.',
  Inheritance: 'Set the parent, purpose for newly created accounts, and manual overrides.',
  Migration: 'Preview and verify complete account/history migration before source deletion.',
  Margin: 'Please set up the mechanism of margin calculation for the group: execution mode and margin requirements.',
  Symbols: 'Every symbol from Symbol Management. A symbol is tradeable in this group when it is enabled globally and not turned off for this group.',
  'Symbol List': 'Legacy allowed-symbols list with individual trade parameters per symbol.',
  Commissions: 'Please set up commissions for accounts in the group. Changes on this tab are saved immediately.',
};

const TAB_HELP = {
  Inheritance: 'Fields inherit continuously until overridden. Reset to inherit uses the latest effective parent value. Symbol and routing collections replace the complete inherited list.',
  Migration: 'Existing trades retain their original feed and route. New orders use destination settings. Deletion requires verified account/history migration and retained execution dependencies.',
  Margin: 'Execution mode selects market or instant execution for the group. Margin call and stop out levels are margin levels in percent; the stop out level must not exceed the margin call level. "Compensate negative balance after stop out" resets a negative balance to zero after a stop out. When you press OK, changed values are also applied to the accounts already in the group. Leverage cannot change while any account in the group has an open position, a pending order or an unfinished order; the server names those accounts. If someone else saved the group after you opened it, reload and apply your change again. Greyed-out options are not available yet.',
  Accounts: 'Every trading account in this group. Double-click an account to open its properties. This tab is read-only; OK and Cancel do not affect it.',
  Symbols: 'All global symbols. "Global" means the group follows Symbol Management; turning a symbol off here blocks it for this group only and never changes the group\'s symbol list. A symbol disabled globally (or excluded by the blocked list or a legacy allow-list) cannot be turned on here. Changes are kept until you press OK, and Cancel discards them.',
  'Symbol List': 'The ordered list of symbols that accounts in this group see and trade in the terminal. An empty list allows every symbol available from the group\'s quote feed; a non-empty list restricts the group to exactly those symbols. Each symbol has its own spread markup (points), commission, swap multiplier and trading switch. Use Add, Edit (or double-click a row), Delete, Up and Down; changes are kept until you press OK, and Cancel discards them.',

  Commissions: 'Commission schedules charged to accounts in this group, by symbol and volume range. Per lot charges the value per lot, Percentage charges a percent of the deal notional, Flat charges a fixed amount per deal. Add, Edit and Delete save immediately; OK and Cancel do not affect them.',
};

const SYMBOL_COLUMNS = 'minmax(0, 1fr) 110px 100px 110px 84px';
const COMMISSION_COLUMNS = 'minmax(0, 1.3fr) minmax(0, 1fr) 90px 110px 80px 72px';

const Field = ({ label, htmlFor, hint, error, disabled = false, wide = false, children }) => (
  <div className={`gpp-field${disabled ? ' is-disabled' : ''}${wide ? ' is-wide' : ''}`}>
    <label className="gpp-field-label" htmlFor={htmlFor}>{label}</label>
    {children}
    {hint && <div className="gpp-field-hint">{hint}</div>}
    {error && <div className="gpp-field-error" role="alert">{error}</div>}
  </div>
);

const SelectField = ({ id, label, options, value, onChange, disabled = false, hint, error, wide }) => (
  <Field label={label} htmlFor={id} hint={hint} error={error} disabled={disabled} wide={wide}>
    <select id={id} value={value} onChange={onChange || (() => {})} disabled={disabled} className="gpp-select">
      {options.map((opt) => {
        const option = typeof opt === 'string' ? { value: opt, label: opt } : opt;
        return <option key={option.value} value={option.value}>{option.label}</option>;
      })}
    </select>
  </Field>
);

const CheckboxField = ({ id, label, description, checked, onChange, disabled = false }) => (
  <label className={`gpp-check${disabled ? ' is-disabled' : ''}`} htmlFor={id}>
    <input id={id} type="checkbox" checked={Boolean(checked)} onChange={onChange || (() => {})} disabled={disabled} />
    <span className="gpp-check-copy">
      <span className="gpp-check-label">{label}</span>
      {description && <span className="gpp-check-desc">{description}</span>}
    </span>
  </label>
);

const Section = ({ title, description, children }) => (
  <section className="gpp-section">
    <header className="gpp-section-head">
      <div>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
    </header>
    <div className="gpp-section-body">{children}</div>
  </section>
);

const Notice = ({ tone = 'info', children, action }) => {
  const Icon = tone === 'info' ? Info : AlertTriangle;
  return (
    <div className={`gpp-notice is-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon size={13} aria-hidden="true" />
      <span>{children}</span>
      {action}
    </div>
  );
};

const ToolButton = ({ icon: Icon, label, onClick, disabled = false, title, iconOnly = false, primary = false }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title || (iconOnly ? label : undefined)}
    aria-label={iconOnly ? label : undefined}
    className={`gpp-tool${iconOnly ? ' is-icon' : ''}${primary ? ' is-primary' : ''}`}
  >
    {Icon && <Icon size={13} aria-hidden="true" />}
    {!iconOnly && label}
  </button>
);

const ModalShell = ({ title, onClose, children, footer, narrow = false, onSubmit }) => (
  <div className="gpp-modal-backdrop">
    <MotionDiv
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.12 }}
      className={`gpp-modal${narrow ? ' is-narrow' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} noValidate>
        <div className="gpp-modal-head">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="gpp-icon-button is-close"><X size={14} /></button>
        </div>
        <div className="gpp-modal-body">{children}</div>
        <div className="gpp-modal-foot">{footer}</div>
      </form>
    </MotionDiv>
  </div>
);

/** Inline "add symbol" picker; mounted only while adding so LP symbols load on demand. */
const SymbolAddPicker = ({ groupName, existing, error, onAdd, onAddMany, onCancel, onInput }) => {
  const [value, setValue] = useState('');
  const [mode, setMode] = useState('symbol');
  const [category, setCategory] = useState('');
  const [catalog, setCatalog] = useState(null);
  const currentCatalog = catalog?.groupName === groupName ? catalog : null;
  const symbols = currentCatalog?.symbols || [];
  const loading = !currentCatalog;
  const catalogError = currentCatalog?.error || '';
  const [pickerError, setPickerError] = useState('');
  useEffect(() => {
    let active = true;
    ManagerService.getGroupFeedSymbols(groupName).then((response) => {
      if (active) setCatalog({ groupName, symbols: normalizeGroupFeedSymbols(response), error: '' });
    }).catch((reason) => {
      if (active) setCatalog({ groupName, symbols: [], error: getApiErrorMessage(reason, 'Could not load symbols for this group.') });
    });
    return () => { active = false; };
  }, [groupName]);
  const categories = useMemo(() => symbolCategoryOptions(symbols, existing), [symbols, existing]);
  const selectedCategory = categories.find((option) => option.category === category);
  const catalogHint = loading ? 'Loading symbols...' : catalogError || (symbols.length === 0 ? 'Choose a quote feed with symbols for this group.' : '');

  const modeSwitch = (
    <div className="gpp-segmented" role="group" aria-label="Add by">
      {[['symbol', 'Symbol'], ['category', 'By category']].map(([key, label]) => (
        <button key={key} type="button" aria-pressed={mode === key} onClick={() => { setMode(key); onInput(); }}>{label}</button>
      ))}
    </div>
  );

  if (mode === 'category') {
    return (
      <div className="gpp-picker">
        {modeSwitch}
        <div className="gpp-picker-row">
          <select
            autoFocus
            value={category}
            onChange={(e) => { setCategory(e.target.value); onInput(); }}
            aria-label={`Category to add to ${groupName}`}
            className="gpp-select"
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
            className="gpp-btn is-primary"
          >
            {selectedCategory ? `Add ${selectedCategory.addable} symbol${selectedCategory.addable === 1 ? '' : 's'}` : 'Add'}
          </button>
          <button type="button" onClick={onCancel} className="gpp-btn">Cancel</button>
        </div>
        {selectedCategory && (
          <div className="gpp-picker-list" title={selectedCategory.symbols.map((s) => s.symbol).join(', ')}>
            {selectedCategory.symbols.map((s) => s.symbol).join(', ')}
          </div>
        )}
        {(catalogHint || error) && <div className="gpp-field-error">{catalogHint || error}</div>}
      </div>
    );
  }

  const confirm = () => {
    const name = value.trim();
    if (!name) return;
    const entry = findGroupFeedSymbol(symbols, name);
    if (!entry) {
      setPickerError('Choose a symbol from this group’s quote feed.');
      return;
    }
    onAdd(entry.symbol, { configured: entry.configured });
  };

  return (
    <div className="gpp-picker">
      {modeSwitch}
      <div className="gpp-picker-row">
        <input
          type="text"
          autoFocus
          value={value}
          onChange={(e) => { setValue(e.target.value); setPickerError(''); onInput(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); confirm(); }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
          }}
          list="group-symbol-add-options"
          autoComplete="off"
          aria-label={`Symbol to add to ${groupName}`}
          placeholder="Symbol from this group’s quote feed"
          disabled={loading || Boolean(catalogError) || symbols.length === 0}
          className="gpp-input is-mono"
        />
        <datalist id="group-symbol-add-options">
          {symbols.filter((item) => !existing.includes(item.symbol)).map((item) => <option key={item.symbol} value={item.symbol} />)}
        </datalist>
        <button
          type="button"
          onClick={confirm}
          disabled={!value.trim() || loading || Boolean(catalogError) || symbols.length === 0}
          className="gpp-btn is-primary"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="gpp-btn"
        >
          Cancel
        </button>
      </div>
        {(catalogHint || pickerError || error) && <div className="gpp-field-error">{catalogHint || pickerError || error}</div>}
    </div>
  );
};

const GroupPropertiesPopup = ({
  group,
  onClose,
  onSaved,
  onOpenAccount,
  onNoChanges,
  // Opens on the group's accounts, like the MT5 Manager group window. Opened
  // from an account it shows only Margin / Symbols / Commissions.
  initialTab = 'Accounts',
  showAccountsTab = true,
}) => {
  const currentGroupName = getGroupName(group);
  const user = useAuthStore((state) => state.user);
  const readOnly = !canEditGroup(user, currentGroupName);
  const dragControls = useDragControls();
  const { notify } = useToast();
  const tabs = showAccountsTab ? TABS : TABS.filter((tab) => tab !== 'Accounts');

  const [activeTab, setActiveTab] = useState(() => (tabs.includes(initialTab) ? initialTab : tabs[0]));
  const [showHelp, setShowHelp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  // True once anything was written server-side, so the caller refreshes even
  // if the dialog is then cancelled (e.g. margin saved, symbols failed).
  const persistedRef = useRef(false);

  // --- Margin (staged, saved on OK) ---
  const [initialMargin, setInitialMargin] = useState(() => buildMarginForm(group));
  const [marginForm, setMarginForm] = useState(initialMargin);
  // G8: group revision (expected_revision for GroupUpdate) and leverage come
  // from GroupGet; '' revision (older backend) keeps the legacy write.
  const [groupRevision, setGroupRevision] = useState(() => readRevision(group));
  const [initialLeverage, setInitialLeverage] = useState(() => String(group?.leverage ?? ''));
  const [leverage, setLeverage] = useState(initialLeverage);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const leverageTouchedRef = useRef(false);
  const leverageChange = useMemo(() => buildGroupLeverageChange(initialLeverage, leverage), [initialLeverage, leverage]);
  const leverageDirty = leverage.trim() !== initialLeverage.trim();
  const marginDirty = isMarginFormDirty(initialMargin, marginForm) || leverageDirty;

  useEffect(() => {
    if (!currentGroupName) return undefined;
    let active = true;
    ManagerService.getGroup(currentGroupName).then((fresh) => {
      if (!active || !fresh) return;
      setGroupRevision(readRevision(fresh));
      if (fresh.leverage !== undefined && fresh.leverage !== null) {
        const value = String(fresh.leverage);
        setInitialLeverage(value);
        if (!leverageTouchedRef.current) setLeverage(value);
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [currentGroupName]);

  const changeLeverage = (event) => {
    leverageTouchedRef.current = true;
    setLeverage(event.target.value);
  };
  // Only flag problems once the admin has touched the Margin fields.
  const marginErrors = useMemo(
    () => (marginDirty ? validateMarginForm(marginForm).errors : {}),
    [marginDirty, marginForm]
  );

  const marginTouchedRef = useRef(false);
  const setMarginField = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    marginTouchedRef.current = true;
    setMarginForm((current) => ({ ...current, [field]: value }));
  };

  // The group passed in may come from a cached list (or be just a name when
  // opened from an account), so reload the live record from the server.
  const [marginLoading, setMarginLoading] = useState(true);
  const [marginLoadError, setMarginLoadError] = useState('');
  const [syncedAt, setSyncedAt] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setMarginLoading(true);
    setMarginLoadError('');
    loadGroupTreePages(ManagerService.getGroupList, { arrayKeys: GROUP_LIST_ARRAY_KEYS })
      .then((rows) => {
        if (cancelled) return;
        const record = findGroupRecord(rows, currentGroupName);
        if (!record) {
          setMarginLoadError(`Group "${currentGroupName}" was not found on the server.`);
          return;
        }
        const fresh = buildMarginForm(record);
        setInitialMargin(fresh);
        setSyncedAt(new Date());
        // Keep anything the admin already typed; OK then sends only real differences.
        if (!marginTouchedRef.current) setMarginForm(fresh);
      })
      .catch((error) => {
        if (!cancelled) setMarginLoadError(getApiErrorMessage(error, 'Failed to load the current group settings.'));
      })
      .finally(() => {
        if (!cancelled) setMarginLoading(false);
      });
    return () => { cancelled = true; };
  }, [currentGroupName]);

  // --- Symbols (staged, saved on OK) ---
  const [symbolsBaseline, setSymbolsBaseline] = useState(null);
  const [symbolRows, setSymbolRows] = useState([]);
  const [symbolsLoading, setSymbolsLoading] = useState(false);
  const [symbolsError, setSymbolsError] = useState('');
  const [selectedSymbolIndex, setSelectedSymbolIndex] = useState(-1);
  const [isAddingSymbol, setIsAddingSymbol] = useState(false);
  const [addSymbolError, setAddSymbolError] = useState('');
  const [symbolEditor, setSymbolEditor] = useState(null);
  const [symbolsRevision, setSymbolsRevision] = useState('');
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
      const response = await ManagerService.getGroupAllowedSymbols(currentGroupName);
      const { rows } = normalizeGroupSymbolsResponse(response);
      setSymbolsRevision(readRevision(response));
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
    if (readOnly) return;
    if (!symbolsLoaded) return;
    setAddSymbolError('');
    setIsAddingSymbol(true);
  };

  const cancelAddSymbol = () => {
    setIsAddingSymbol(false);
    setAddSymbolError('');
  };

  const handleAddSymbol = (symbol, options) => {
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly) return;
    const { rows, index } = moveGroupSymbolRow(symbolRows, selectedSymbolIndex, delta);
    setSymbolRows(rows);
    setSelectedSymbolIndex(index);
  };

  const deleteSelectedSymbol = () => {
    if (readOnly) return;
    const row = selectedSymbolRow;
    if (!row) return;
    if (row.persisted && !window.confirm(`Remove ${row.symbol} from group "${currentGroupName}"?\n\nThe change is saved when you press OK.`)) return;
    const next = removeGroupSymbolRow(symbolRows, selectedSymbolIndex);
    setSymbolRows(next);
    setSelectedSymbolIndex(next.length === 0 ? -1 : Math.min(selectedSymbolIndex, next.length - 1));
  };

  const openSymbolEditor = (index) => {
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly) return;
    setCommissionEditor({ mode: 'create', id: null, form: emptyCommissionForm(), error: '' });
  };

  const openEditCommission = (row) => {
    if (readOnly) return;
    const target = row || selectedCommission;
    if (!target) return;
    setSelectedCommissionId(getScheduleId(target));
    setCommissionEditor({ mode: 'edit', id: getScheduleId(target), revision: readRevision(target), form: commissionFormFromSchedule(target), error: '' });
  };

  const setCommissionField = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setCommissionEditor((current) => ({ ...current, form: { ...current.form, [field]: value }, error: '' }));
  };

  const submitCommission = async () => {
    if (readOnly) return;
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
      if (isEdit) await ManagerService.updateCommissionSchedule(withExpectedRevision(payload, commissionEditor.revision));
      else await ManagerService.createCommissionSchedule(payload);
      notify({ title: isEdit ? 'Commission updated' : 'Commission created', description: `${payload.name} · ${payload.symbol}`, tone: 'success' });
      setCommissionEditor(null);
      loadCommissions();
    } catch (error) {
      const message = describeConfigError(error, isEdit ? 'Failed to update commission.' : 'Failed to create commission.');
      setCommissionEditor((current) => (current ? { ...current, error: message } : current));
      if (readConfigError(error).kind === 'conflict') loadCommissions();
    } finally {
      setIsSubmittingCommission(false);
    }
  };

  const deleteSelectedCommission = async () => {
    if (readOnly) return;
    const row = selectedCommission;
    if (!row || isDeletingCommission) return;
    if (!window.confirm(`Delete commission schedule "${row.name}" (${row.symbol})?\n\nThis takes effect immediately.`)) return;

    setIsDeletingCommission(true);
    setCommissionsError('');
    try {
      await ManagerService.deleteCommissionSchedule(getScheduleId(row), readRevision(row));
      notify({ title: 'Commission deleted', description: `${row.name} · ${row.symbol}`, tone: 'success' });
      setSelectedCommissionId(null);
      loadCommissions();
    } catch (error) {
      const message = describeConfigError(error, 'Failed to delete commission.');
      if (readConfigError(error).kind === 'conflict') loadCommissions();
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

  // G8 revision conflict on GroupUpdate: reload the group (fresh revision and
  // values), keep the admin's own edits staged and take the fresh value for
  // every untouched field. Nothing is re-sent: the admin reviews the reloaded
  // values and presses OK again. Returns the message for the dialog footer.
  const reloadGroupAfterConflict = async (conflictReason) => {
    try {
      const fresh = await ManagerService.getGroup(currentGroupName);
      const revision = readRevision(fresh);
      if (!fresh || !revision) throw new Error('the server returned no group revision.');
      const freshMargin = buildMarginForm({ ...initialMargin, ...fresh });
      setMarginForm((current) => rebaseMarginForm(initialMargin, current, freshMargin));
      setInitialMargin(freshMargin);
      if (fresh.leverage !== undefined && fresh.leverage !== null) {
        const value = String(fresh.leverage);
        setLeverage((current) => (current.trim() === initialLeverage.trim() ? value : current));
        setInitialLeverage(value);
      }
      setGroupRevision(revision);
      return 'Not saved: someone else changed this group after you opened it. The group was reloaded — review the current values and your edits, then press OK again.';
    } catch (reloadError) {
      return `Failed to save margin settings: ${conflictReason} Reloading the group failed: ${getApiErrorMessage(reloadError, 'request failed.')} Close and reopen the dialog.`;
    }
  };

  const handleOk = async () => {
    if (readOnly) return;
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
      if (leverageChange.error) {
        setActiveTab('Margin');
        setSaveError(leverageChange.error);
        return;
      }
      marginChanges = { ...changes, ...leverageChange.changes };
    }

    const saveMargin = Object.keys(marginChanges).length > 0;
    if (!saveMargin && !symbolsDirty && !overridesDirty) {
      closeDialog();
      onNoChanges?.(currentGroupName);
      return;
    }

    setIsSaving(true);
    const summary = [];
    let failedTab = 'Margin';
    try {
      if (saveMargin) {
        const res = await ManagerService.updateGroup(withExpectedRevision({ originalName: currentGroupName, ...marginChanges }, groupRevision));
        persistedRef.current = true;
        setInitialMargin(marginForm);
        setInitialLeverage(leverage.trim());
        setGroupRevision(readRevision(res));
        summary.push(describeAccountsUpdated(res) || 'Margin settings saved.');
      }

      // The symbol list goes first: GroupSymbolsSave rewrites trade_allowed of
      // listed symbols, and the staged overrides must win.
      if (symbolsDirty) {
        failedTab = 'Symbol List';
        const payload = buildGroupSymbolsSavePayload(currentGroupName, symbolRows);
        const res = await ManagerService.saveGroupAllowedSymbols(payload.group, payload.symbols, symbolsRevision);
        setSymbolsRevision(readRevision(res));
        persistedRef.current = true;
        const saved = normalizeGroupSymbolsResponse(res).rows;
        const count = res && Array.isArray(res.symbols) ? saved.length : payload.symbols.length;
        summary.push(count === 0 ? 'All symbols from the group’s quote feed allowed.' : `${count} symbol${count === 1 ? '' : 's'} allowed.`);
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

      notify({ title: 'Group updated', description: `${currentGroupName} — ${summary.join(' ')}`, tone: 'success' });
      onSaved?.();
      onClose();
    } catch (error) {
      const reason = describeConfigError(error, 'request failed.');
      setActiveTab(failedTab);
      if (failedTab === 'Margin' && readConfigError(error).kind === 'conflict') {
        setSaveError(await reloadGroupAfterConflict(reason));
      } else {
        const what = { Margin: 'margin settings', Symbols: 'symbol overrides', 'Symbol List': 'symbol list' }[failedTab];
        setSaveError(summary.length > 0
          ? `${summary.join(' ')} But saving the ${what} failed: ${reason}`
          : `Failed to save ${what}: ${reason}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const tabDirty = { Accounts: false, Margin: marginDirty, Symbols: overridesDirty, 'Symbol List': symbolsDirty, Commissions: false };
  const hasUnsavedChanges = marginDirty || symbolsDirty || overridesDirty;

  const commissionTypeHint = COMMISSION_TYPE_OPTIONS.find((option) => option.value === commissionEditor?.form.commission_type)?.valueHint;
  const executionOptions = EXECUTION_MODE_OPTIONS.some((o) => o.value === marginForm.executionMode)
    ? EXECUTION_MODE_OPTIONS
    : [{ value: marginForm.executionMode, label: marginForm.executionMode || '—' }, ...EXECUTION_MODE_OPTIONS];

  const syncStatus = marginLoading
    ? { tone: 'is-loading', label: 'Loading live settings…' }
    : marginLoadError
      ? { tone: 'is-error', label: 'Not synced' }
      : { tone: '', label: syncedAt ? `Synced ${syncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Synced' };

  return (
    <div className="gpp-backdrop">
      <MotionDiv
        drag
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className="gpp-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Group properties: ${currentGroupName}`}
      >
        {/* Header */}
        <div className="gpp-header" onPointerDown={(e) => dragControls.start(e)}>
          <div className="gpp-header-icon"><Users size={15} aria-hidden="true" /></div>
          <div className="gpp-header-copy">
            <span className="gpp-eyebrow">Group properties</span>
            <span className="gpp-title" title={currentGroupName}>{currentGroupName}</span>
          </div>
          <div className="gpp-header-meta" onPointerDown={(e) => e.stopPropagation()}>
            <span className={`gpp-sync ${syncStatus.tone}`} role="status" title={marginLoadError || undefined}>
              <span className="gpp-sync-dot" aria-hidden="true" />{syncStatus.label}
            </span>
            <button type="button" onClick={closeDialog} aria-label="Close" className="gpp-icon-button is-close"><X size={15} /></button>
          </div>
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label="Group settings" className="gpp-tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => selectTab(tab)}
              title={tabDirty[tab] ? 'Unsaved changes — press OK to save' : undefined}
              className="gpp-tab"
            >
              {tab}
              {tabDirty[tab] && <span className="gpp-tab-dirty" aria-label="unsaved changes" />}
            </button>
          ))}
        </div>

        {/* Content */}
        <fieldset disabled={readOnly && activeTab !== 'Accounts'} className="gpp-body" role="tabpanel" aria-label={activeTab}>
          <p className="gpp-intro">{TAB_INTRO[activeTab]}</p>

          {showHelp && (
            <div className="gpp-notice is-info gpp-help" role="note" style={{ marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div className="gpp-help-head">
                  <span>Help</span>
                  <button type="button" onClick={() => setShowHelp(false)} aria-label="Close help" className="gpp-icon-button" style={{ width: 22, height: 22 }}><X size={12} /></button>
                </div>
                {tabs.map((tab) => (
                  <p key={tab} className={tab === activeTab ? '' : 'is-dim'}>
                    <strong>{tab}: </strong>{TAB_HELP[tab]}
                  </p>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            <MotionDiv key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }}>

              {activeTab === 'Accounts' && (
                <GroupAccountsTab groupName={currentGroupName} onOpenAccount={onOpenAccount} />
              )}

              {activeTab === 'Migration' && <GroupMigrationPanel source={currentGroupName} api={groupMigration} canManage={!readOnly && canManageGroupLifecycle(user)} disabled={isSaving || marginDirty || symbolsDirty || overridesDirty} onMigrated={value => { persistedRef.current = true; onSaved?.({ action: 'migrated', ...value }); }} onDeleted={value => { onSaved?.({ action: 'deleted', ...value }); onClose(); }} />}
              {activeTab === 'Inheritance' && <GroupAuthorityPanel name={currentGroupName} readGroup={ManagerService.getGroup} updateGroup={(name, payload) => ManagerService.updateGroup({ ...payload, originalName: name })} canManage={!readOnly} disabled={isSaving || marginDirty || symbolsDirty || overridesDirty} onSaved={fresh => { persistedRef.current = true; setGroupRevision(readRevision(fresh)); setInitialLeverage(String(fresh.leverage ?? '')); setLeverage(String(fresh.leverage ?? '')); const next = buildMarginForm(fresh); setInitialMargin(next); setMarginForm(next); onSaved?.(); }} />}
              {/* --- MARGIN TAB --- */}
              {activeTab === 'Margin' && (
                <div className="gpp-stack">
                  {marginLoadError && <Notice tone="danger">{marginLoadError}</Notice>}

                  <Section title="Execution" description="How orders from accounts in this group are executed.">
                    <div className="gpp-grid">
                      <SelectField
                        id="group-execution-mode"
                        label="Execution mode"
                        options={executionOptions}
                        value={marginForm.executionMode}
                        onChange={setMarginField('executionMode')}
                        error={marginErrors.executionMode}
                        disabled={marginLoading}
                      />
                    </div>
                  </Section>

                  <Section title="Margin requirements" description="Margin levels, in percent, at which a margin call is issued and positions are stopped out.">
                    <div className="gpp-grid">
                      <Field label="Margin call level" htmlFor="group-margin-call" error={marginErrors.marginCallLevel} hint="A margin call is issued below this level.">
                        <div className="gpp-input-group">
                          <input id="group-margin-call" type="number" min="0" step="any" value={marginForm.marginCallLevel} onChange={setMarginField('marginCallLevel')} aria-invalid={Boolean(marginErrors.marginCallLevel)} disabled={marginLoading} className="gpp-input" />
                          <span className="gpp-input-suffix" aria-hidden="true">%</span>
                        </div>
                      </Field>
                      <Field label="Stop out level" htmlFor="group-stop-out" error={marginErrors.stopOutLevel} hint="Must not exceed the margin call level.">
                        <div className="gpp-input-group">
                          <input id="group-stop-out" type="number" min="0" step="any" value={marginForm.stopOutLevel} onChange={setMarginField('stopOutLevel')} aria-invalid={Boolean(marginErrors.stopOutLevel)} disabled={marginLoading} className="gpp-input" />
                          <span className="gpp-input-suffix" aria-hidden="true">%</span>
                        </div>
                      </Field>
                    </div>
                  </Section>

                  <Section title="Stop out handling" description="What happens to an account's balance after a stop out.">
                    <CheckboxField
                      id="group-negative-balance"
                      label="Compensate negative balance after stop out"
                      description="Resets a negative balance to zero after positions are stopped out."
                      checked={marginForm.negativeBalanceProtection}
                      onChange={setMarginField('negativeBalanceProtection')}
                      disabled={marginLoading}
                    />
                  </Section>
                  <Section title="Leverage" description="Leverage is locked while accounts in the group are trading.">
                    <Field label="Leverage" htmlFor="group-leverage" error={leverageDirty ? leverageChange.error : ''}>
                      <div className="gpp-input-group">
                        <span className="gpp-input-suffix" aria-hidden="true">1 :</span>
                        <input id="group-leverage" type="number" min="1" max="10000" step="1" value={leverage} onChange={changeLeverage} aria-invalid={Boolean(leverageDirty && leverageChange.error)} disabled={marginLoading} className="gpp-input" />
                      </div>
                    </Field>
                  </Section>

                  <Section title="Leverage" description="Leverage for accounts in this group. Locked while accounts in the group are trading.">
                    <div className="gpp-grid">
                      <Field label="Leverage (1 : N)" htmlFor="group-leverage" error={leverageDirty ? leverageChange.error : ''}>
                        <input id="group-leverage" type="number" min="1" max="10000" step="1" value={leverage} onChange={changeLeverage} aria-invalid={Boolean(leverageDirty && leverageChange.error)} disabled={marginLoading} className="gpp-input" />
                      </Field>
                    </div>
                  </Section>

                  <details className="gpp-disclosure">
                    <summary>
                      <ChevronRight size={13} aria-hidden="true" />
                      Additional settings
                      <span className="gpp-tag">Not supported by the server yet</span>
                    </summary>
                    <div className="gpp-disclosure-body">
                      <CheckboxField id="group-hedged-stopout" label="Stop out fully hedged accounts" disabled />
                      <CheckboxField id="group-withdraw-credit" label="Withdraw credit after negative balance compensation" disabled />
                      <div className="gpp-grid" style={{ marginTop: 10 }}>
                        <SelectField id="group-floating-leverage" label="Floating leverage profile" options={['None']} value="None" disabled />
                        <Field label="Virtual credit" htmlFor="group-virtual-credit" hint="Applies only to opening new positions." disabled>
                          <input id="group-virtual-credit" type="text" disabled value="" onChange={() => {}} className="gpp-input" />
                        </Field>
                        <SelectField id="group-unrealized-profit" label="Unrealized profit in free margin" options={['Use unrealized profit/loss']} value="Use unrealized profit/loss" disabled />
                        <SelectField id="group-daily-profit" label="Daily fixed profit in free margin" options={['Use daily fixed profit/loss']} value="Use daily fixed profit/loss" disabled />
                      </div>
                      <CheckboxField id="group-release-profit" label="Release fixed profit at the end of day" disabled />
                    </div>
                  </details>
                </div>
              )}

              {/* --- SYMBOLS TAB (global symbols + group overrides) --- */}
              {activeTab === 'Symbols' && (
                <div className="flex flex-col gap-2">
                  {overridesView && !overridesView.groupTrading && (
                    <div className="px-3 py-2 border border-red-500/40 bg-red-500/5 rounded-sm text-[11px] text-[color:var(--danger-500)]" role="note">
                      Trading is switched off for this group (or the group is disabled), so no symbol is tradeable. Overrides set here apply once it is on again.
                    </div>
                  )}
                  {overridesView?.legacyAllowList && (
                    <div className="px-3 py-2 border border-amber-500/40 bg-amber-500/5 rounded-sm text-[11px] text-amber-300" role="note">
                      This group has a legacy allowed-symbols list ({overridesView.allowListCount} symbols). Symbols outside it stay blocked
                      (&quot;Not in allow-list&quot;).
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="search"
                      value={overrideQuery}
                      onChange={(event) => setOverrideQuery(event.target.value)}
                      placeholder="Search symbol or category"
                      aria-label="Search symbols"
                      className="gpp-input flex-1 min-w-0"
                    />
                    <select
                      value={overrideFilter}
                      onChange={(event) => setOverrideFilter(event.target.value)}
                      aria-label="Filter symbols"
                      className="gpp-select w-40"
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
                <div>
                  <Notice tone="warning">
                    Saving a non-empty list restricts this group to exactly the listed symbols. Use the Symbols tab to turn individual symbols off.
                  </Notice>
                  <div className="gpp-toolbar" role="toolbar" aria-label="Symbol actions">
                    <ToolButton icon={Plus} label="Add" onClick={startAddSymbol} disabled={!symbolsLoaded} primary />
                    <ToolButton icon={Pencil} label="Edit" onClick={() => openSymbolEditor(selectedSymbolIndex)} disabled={!selectedSymbolRow} />
                    <ToolButton icon={Trash2} label="Remove" onClick={deleteSelectedSymbol} disabled={!selectedSymbolRow} />
                    <span className="gpp-toolbar-sep" aria-hidden="true" />
                    <ToolButton icon={ChevronUp} label="Move up" iconOnly onClick={() => moveSelectedSymbol(-1)} disabled={selectedSymbolIndex <= 0} />
                    <ToolButton icon={ChevronDown} label="Move down" iconOnly onClick={() => moveSelectedSymbol(1)} disabled={selectedSymbolIndex < 0 || selectedSymbolIndex >= symbolRows.length - 1} />
                    <span className="gpp-toolbar-meta">
                      {symbolsLoaded ? `${symbolRows.length} symbol${symbolRows.length === 1 ? '' : 's'}` : ''}
                    </span>
                  </div>

                  {symbolsLoaded && symbolRows.length === 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <Notice tone="info">No symbols listed — accounts in this group see all symbols available from its quote feed. Add symbols to limit them.</Notice>
                    </div>
                  )}

                  <div className="gpp-table">
                    <div className="gpp-table-scroll">
                      <div className="gpp-row is-head" style={{ gridTemplateColumns: SYMBOL_COLUMNS }}>
                        <div>Symbol</div>
                        <div className="is-num">Spread markup</div>
                        <div className="is-num">Commission</div>
                        <div className="is-num">Swap multiplier</div>
                        <div>Trading</div>

                      </div>
                      <div role="listbox" aria-label={`Symbols of ${currentGroupName}`}>
                        {symbolsLoading && <div className="gpp-table-empty">Loading symbols…</div>}
                        {!symbolsLoading && symbolsError && (
                          <div className="gpp-table-empty is-error">
                            {symbolsError}{' '}
                            <button type="button" onClick={loadSymbols} className="gpp-notice-action">Retry</button>
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
                              className="gpp-row is-body"
                              style={{ gridTemplateColumns: SYMBOL_COLUMNS }}
                            >
                              <div className="is-mono" title={row.symbol}>
                                {row.symbol}
                                {!row.configured && <span className="gpp-flag-warn" title="No instrument is configured for this symbol yet">Not configured</span>}
                              </div>
                              <div className="is-num">{row.spread_markup ? `+${row.spread_markup}` : '0'}</div>
                              <div className="is-num">{row.commission}</div>
                              <div className="is-num">{row.swap_multiplier}</div>
                              <div className={row.trade_allowed ? 'gpp-status-on' : 'gpp-status-off'}>{row.trade_allowed ? 'Enabled' : 'Disabled'}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
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
                      <button type="button" onClick={startAddSymbol} className="gpp-table-add"><Plus size={13} aria-hidden="true" /> Add symbol</button>
                    ))}
                  </div>
                </div>
              )}

              {/* --- COMMISSIONS TAB --- */}
              {activeTab === 'Commissions' && (
                <div>
                  <div className="gpp-toolbar" role="toolbar" aria-label="Commission actions">
                    <ToolButton icon={Plus} label="Add" onClick={openCreateCommission} primary />
                    <ToolButton icon={Pencil} label="Edit" onClick={() => openEditCommission()} disabled={!selectedCommission} />
                    <ToolButton icon={Trash2} label="Delete" onClick={deleteSelectedCommission} disabled={!selectedCommission || isDeletingCommission} />
                    <span className="gpp-toolbar-meta">
                      {commissionsLoaded ? `${commissions.length} schedule${commissions.length === 1 ? '' : 's'} · saved immediately` : 'Saved immediately'}
                    </span>
                  </div>

                  {commissionsError && (
                    <div style={{ marginBottom: 8 }}>
                      <Notice tone="danger" action={<button type="button" onClick={loadCommissions} className="gpp-notice-action">Retry</button>}>
                        {commissionsError}
                      </Notice>
                    </div>
                  )}

                  <div className="gpp-table">
                    <div className="gpp-table-scroll">
                      <div className="gpp-row is-head" style={{ gridTemplateColumns: COMMISSION_COLUMNS }}>
                        <div>Name</div>
                        <div>Symbol</div>
                        <div>Type</div>
                        <div className="is-num">Volume range</div>
                        <div className="is-num">Value</div>
                        <div>Status</div>
                      </div>
                      {commissionsLoading && !commissionsLoaded && <div className="gpp-table-empty">Loading commissions…</div>}
                      {commissions.map((row) => {
                        const id = getScheduleId(row);
                        const selected = id === selectedCommissionId;
                        return (
                          <div
                            key={id}
                            role="option"
                            aria-selected={selected}
                            onClick={() => setSelectedCommissionId(id)}
                            onDoubleClick={() => openEditCommission(row)}
                            className={`gpp-row is-body${row.enabled === false ? ' is-muted' : ''}`}
                            style={{ gridTemplateColumns: COMMISSION_COLUMNS }}
                          >
                            <div title={row.name}>{row.name}</div>
                            <div className="is-mono" title={row.symbol}>{row.symbol}</div>
                            <div>{formatCommissionType(row.commission_type)}</div>
                            <div className="is-num">{formatVolumeRange(row)}</div>
                            <div className="is-num">{row.value}</div>
                            <div className={row.enabled === false ? 'gpp-status-off' : 'gpp-status-on'}>{row.enabled === false ? 'Disabled' : 'Active'}</div>
                          </div>
                        );
                      })}
                      {commissionsLoaded && commissions.length === 0 && (
                        <div className="gpp-table-empty">No commission schedules for this group yet.</div>
                      )}
                    </div>
                    <button type="button" onClick={openCreateCommission} className="gpp-table-add"><Plus size={13} aria-hidden="true" /> Add commission schedule</button>
                  </div>
                </div>
              )}
            </MotionDiv>
          </AnimatePresence>
        </fieldset>

        {/* Footer */}
        <div className="gpp-footer">
          <button type="button" onClick={() => setShowHelp((value) => !value)} aria-pressed={showHelp} className="gpp-btn is-ghost">
            <HelpCircle size={13} aria-hidden="true" /> Help
          </button>
          <button type="button" onClick={() => setShowCreateAccount(true)} hidden={readOnly} disabled={isSaving || readOnly || !currentGroupName} title={`Create a customer account in ${currentGroupName}`} className="gpp-btn">
            <UserPlus size={12} aria-hidden="true" /> New account
          </button>
          <div className={`gpp-footer-status${saveError ? ' is-error' : hasUnsavedChanges ? ' is-dirty' : ''}`}>
            {saveError ? (
              <><AlertTriangle size={13} aria-hidden="true" /><span role="alert" title={saveError}>{saveError}</span></>
            ) : hasUnsavedChanges ? (
              <span>Unsaved changes</span>
            ) : null}
          </div>
          <button type="button" onClick={closeDialog} disabled={isSaving} className="gpp-btn">Cancel</button>
          <button type="button" onClick={handleOk} hidden={readOnly} disabled={isSaving || readOnly} className="gpp-btn is-primary">{isSaving ? 'Saving…' : 'OK'}</button>
        </div>
      </MotionDiv>

      {/* Symbol settings editor */}
      <AnimatePresence>
        {!readOnly && symbolEditor && (
          <ModalShell
            title={`Symbol settings · ${symbolEditor.symbol}`}
            narrow
            onClose={() => setSymbolEditor(null)}
            onSubmit={applySymbolEdit}
            footer={(
              <>
                <button type="button" onClick={() => setSymbolEditor(null)} className="gpp-btn">Cancel</button>
                <button type="submit" className="gpp-btn is-primary">Apply</button>
              </>
            )}
          >
            <Field label="Spread markup" htmlFor="gs-spread" hint="Points, whole number." error={symbolEditor.errors.spread_markup}>
              <input id="gs-spread" type="number" min="0" step="1" autoFocus value={symbolEditor.form.spread_markup} onChange={setSymbolEditorField('spread_markup')} className="gpp-input" />
            </Field>
            <div className="gpp-grid">
              <Field label="Commission" htmlFor="gs-commission" error={symbolEditor.errors.commission}>
                <input id="gs-commission" type="number" min="0" step="any" value={symbolEditor.form.commission} onChange={setSymbolEditorField('commission')} className="gpp-input" />
              </Field>
              <Field label="Swap multiplier" htmlFor="gs-swap" error={symbolEditor.errors.swap_multiplier}>
                <input id="gs-swap" type="number" min="0" step="any" value={symbolEditor.form.swap_multiplier} onChange={setSymbolEditorField('swap_multiplier')} className="gpp-input" />
              </Field>
            </div>
            <CheckboxField id="gs-trading" label="Trading allowed" description="Accounts in this group can open positions on this symbol." checked={symbolEditor.form.trade_allowed} onChange={setSymbolEditorField('trade_allowed')} />
            {Object.entries(symbolEditor.errors)
              .filter(([field, message]) => message && !['spread_markup', 'commission', 'swap_multiplier'].includes(field))
              .map(([, message]) => <div key={message} className="gpp-field-error">{message}</div>)}
          </ModalShell>
        )}
      </AnimatePresence>

      {/* Commission schedule create / edit */}
      <AnimatePresence>
        {!readOnly && commissionEditor && (
          <ModalShell
            title={commissionEditor.mode === 'edit' ? 'Edit commission schedule' : 'New commission schedule'}
            onClose={() => setCommissionEditor(null)}
            onSubmit={submitCommission}
            footer={(
              <>
                <button type="button" onClick={() => setCommissionEditor(null)} className="gpp-btn">Cancel</button>
                <button type="submit" disabled={isSubmittingCommission} className="gpp-btn is-primary">
                  {isSubmittingCommission ? 'Saving…' : <><Save size={12} aria-hidden="true" /> Save</>}
                </button>
              </>
            )}
          >
            <div className="gpp-grid">
              <Field label="Name" htmlFor="gc-name">
                <input id="gc-name" type="text" autoFocus value={commissionEditor.form.name} onChange={setCommissionField('name')} placeholder="e.g. EURUSD standard" className="gpp-input" />
              </Field>
              <Field label="Group">
                <div className="gpp-readonly" title={currentGroupName}>{currentGroupName}</div>
              </Field>
              <Field label="Symbol" htmlFor="gc-symbol">
                <input id="gc-symbol" type="text" value={commissionEditor.form.symbol} onChange={setCommissionField('symbol')} list="group-commission-symbol-options" autoComplete="off" placeholder="Symbol" className="gpp-input is-mono" />
                <LpSymbolDatalist id="group-commission-symbol-options" />
              </Field>
              <Field label="Type" htmlFor="gc-type">
                <select id="gc-type" value={commissionEditor.form.commission_type} onChange={setCommissionField('commission_type')} className="gpp-select">
                  {!COMMISSION_TYPE_OPTIONS.some((option) => option.value === commissionEditor.form.commission_type) && (
                    <option value={commissionEditor.form.commission_type} disabled>{commissionEditor.form.commission_type} (unsupported — choose a type)</option>
                  )}
                  {COMMISSION_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
              <Field label="Value" htmlFor="gc-value" hint={commissionTypeHint} wide>
                <input id="gc-value" type="number" min="0" step="any" value={commissionEditor.form.value} onChange={setCommissionField('value')} className="gpp-input" />
              </Field>
              <Field label="Min volume" htmlFor="gc-min">
                <input id="gc-min" type="number" min="0" step="0.01" value={commissionEditor.form.min_volume} onChange={setCommissionField('min_volume')} placeholder="0" className="gpp-input" />
              </Field>
              <Field label="Max volume" htmlFor="gc-max">
                <input id="gc-max" type="number" min="0" step="0.01" value={commissionEditor.form.max_volume} onChange={setCommissionField('max_volume')} className="gpp-input" />
              </Field>
              <Field label="Time from" htmlFor="gc-from">
                <input id="gc-from" type="time" value={commissionEditor.form.time_from} onChange={setCommissionField('time_from')} className="gpp-input" />
              </Field>
              <Field label="Time to" htmlFor="gc-to">
                <input id="gc-to" type="time" value={commissionEditor.form.time_to} onChange={setCommissionField('time_to')} className="gpp-input" />
              </Field>
            </div>
            {commissionEditor.mode === 'edit' && (
              <CheckboxField id="gc-enabled" label="Schedule is active" checked={commissionEditor.form.enabled} onChange={setCommissionField('enabled')} />
            )}
            {commissionEditor.error && <Notice tone="danger">{commissionEditor.error}</Notice>}
          </ModalShell>
        )}
      </AnimatePresence>

      {!readOnly && showCreateAccount && (
        <AccountCreatePopup
          group={currentGroupName}
          defaultLeverage={initialLeverage}
          onClose={() => setShowCreateAccount(false)}
          onCreated={() => { persistedRef.current = true; }}
        />
      )}
    </div>
  );
};

export default GroupPropertiesPopup;
