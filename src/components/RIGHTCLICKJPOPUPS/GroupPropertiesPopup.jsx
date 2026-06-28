import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { X, Minus, Square, HelpCircle, Users, ChevronUp, ChevronDown, Plus, Pencil, Trash2, Save } from 'lucide-react';
import SymbolPropertiesPopup from './SymbolPropertiesPopup';
import { ManagerService } from '../../services/manager.service';
import { buildGroupRiskPayload } from '../../utils/adminValidation';
import { useToast } from '../ui/useToast';

const MotionDiv = motion.div;

const Label = ({ children, width = "w-40" }) => (
  <label className={`text-[11px] text-[color:var(--text-primary)] ${width} text-right shrink-0 select-none`}>{children}:</label>
);

const InputField = ({ label, value, type = "text", width = "w-full", labelWidth, onChange, disabled = false }) => {
  const valueProps = onChange || disabled
    ? { value: value ?? '', onChange: onChange || (() => {}) }
    : { defaultValue: value };

  return (
    <div className="flex items-center gap-3 mb-2">
      <Label width={labelWidth}>{label}</Label>
      <input
        type={type}
        {...valueProps}
        disabled={disabled}
        className={`${width} ${disabled ? 'opacity-60 cursor-not-allowed' : ''} bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-2 py-0.5 text-[11px] text-[color:var(--text-primary)] focus:border-blue-500/50 focus:outline-none`}
      />
    </div>
  );
};

const SelectField = ({ label, options, defaultValue, value, onChange, width = "w-full", labelWidth, disabled = false }) => (
  <div className="flex items-center gap-3 mb-2">
    <Label width={labelWidth}>{label}</Label>
    <select
      {...(value !== undefined ? { value } : { defaultValue })}
      onChange={onChange}
      disabled={disabled}
      className={`${width} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-1 py-0.5 text-[11px] text-[color:var(--text-primary)] focus:border-blue-500/50 focus:outline-none appearance-none cursor-pointer`}
      style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23808080\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '0.75rem' }}
    >
      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  </div>
);

const CheckboxField = ({ label, checked, onChange, defaultChecked, ml = "ml-44", disabled = false }) => (
  <div className={`flex items-start gap-2 mb-1.5 ${ml} ${disabled ? 'opacity-40' : ''}`}>
    <input
      type="checkbox"
      {...(onChange ? { checked, onChange } : { defaultChecked: checked || defaultChecked })}
      disabled={disabled}
      className="mt-0.5 w-3.5 h-3.5 accent-blue-500 rounded-sm border-[color:var(--border-default)]"
    />
    <label className="text-[11px] text-[color:var(--text-primary)] leading-tight select-none cursor-default">{label}</label>
  </div>
);

const SideButton = ({ icon: Icon, label, onClick }) => (
  <button onClick={onClick} className="flex flex-col items-center justify-center w-20 py-1.5 bg-[#404040] hover:bg-[color:var(--bg-surface-3)] border border-black/40 rounded-sm mb-1.5 group transition-colors">
    {Icon && <Icon size={14} className="text-[color:var(--text-muted)] group-hover:text-white" />}
    {label && <span className="text-[10px] text-[color:var(--text-secondary)] font-medium uppercase mt-0.5">{label}</span>}
  </button>
);

const pickDefined = (source, keys, fallback = '') => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
};

const parseLeverageValue = (value, fallback = 100) => {
  const match = String(value ?? '').match(/(\d+)\s*$/);
  return match ? Number(match[1]) : fallback;
};

const normalizeCsv = (value) => (
  Array.isArray(value) ? value.join(', ') : String(value ?? '')
);

const buildInitialGroupForm = (group) => {
  const name = group?.group || group?.name || '';

  return {
    originalName: name,
    name,
    description: pickDefined(group, ['description', 'company'], ''),
    accountType: pickDefined(group, ['accountType', 'type'], 'standard'),
    bookType: pickDefined(group, ['bookType'], 'b'),
    commissionRate: pickDefined(group, ['commissionRate'], 0),
    commissionType: pickDefined(group, ['commissionType'], 'per_lot'),
    currency: pickDefined(group, ['currency'], 'USD'),
    demo: Boolean(pickDefined(group, ['demo'], false)),
    executionMode: pickDefined(group, ['executionMode', 'risk'], 'market'),
    leverage: parseLeverageValue(pickDefined(group, ['leverage'], 100), 100),
    lotDivisor: pickDefined(group, ['lotDivisor'], 1),
    marginCallLevel: pickDefined(group, ['marginCallLevel'], 100),
    maxLotPerTrade: pickDefined(group, ['maxLotPerTrade'], 100),
    maxTotalLots: pickDefined(group, ['maxTotalLots'], 500),
    negativeBalanceProtection: Boolean(pickDefined(group, ['negativeBalanceProtection'], true)),
    spreadMarkup: pickDefined(group, ['spreadMarkup'], 0),
    stopOutLevel: pickDefined(group, ['stopOutLevel'], 50),
    swapMultiplier: pickDefined(group, ['swapMultiplier'], 1),
    symbolsAllowed: normalizeCsv(pickDefined(group, ['symbolsAllowed'], '')),
    symbolsBlocked: normalizeCsv(pickDefined(group, ['symbolsBlocked'], '')),
    tradeAllowed: pickDefined(group, ['tradeAllowed'], true) !== false,
  };
};

const GroupPropertiesPopup = ({ group, onClose, onSaved }) => {
  const [activeTab, setActiveTab] = useState('Common');
  const [formData, setFormData] = useState(() => buildInitialGroupForm(group));
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [showAddCommission, setShowAddCommission] = useState(false);
  const [isCreatingCommission, setIsCreatingCommission] = useState(false);
  const [commissionsList, setCommissionsList] = useState([]);
  const [selectedCommission, setSelectedCommission] = useState(null);
  const currentGroupName = group?.group || group?.name || '';

  const [commissionFormData, setCommissionFormData] = useState({
    commission_type: "per_lot",
    group_name: currentGroupName,
    max_volume: 100,
    min_volume: 0.01,
    name: "EURUSD Standard",
    symbol: "EURUSD",
    time_from: "00:00",
    time_to: "23:59",
    value: 7
  });

  const [reportData, setReportData] = useState('End of Month only');
  const [genStatements, setGenStatements] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const dragControls = useDragControls();
  const { notify } = useToast();

  const [stats, setStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const [groupSymbols, setGroupSymbols] = useState([]);
  const [isLoadingSymbols, setIsLoadingSymbols] = useState(false);
  const [hasFetchedSymbols, setHasFetchedSymbols] = useState(false);

  const setFormField = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSaveGroup = async () => {
    setIsSavingGroup(true);
    setSaveError(null);

    try {
      const payload = buildGroupRiskPayload(formData);
      await ManagerService.updateGroup(payload);
      notify({ title: 'Group updated', description: formData.name, tone: 'success' });
      onSaved?.();
      onClose();
    } catch (error) {
      setSaveError(error?.response?.data?.message || error?.message || 'Failed to update group.');
    } finally {
      setIsSavingGroup(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'Statistics' && !stats) {
      const fetchStats = async () => {
        setIsLoadingStats(true);
        try {
          const res = await ManagerService.getGroupStats(currentGroupName);
          if (res) {
            setStats(res);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setIsLoadingStats(false);
        }
      };
      fetchStats();
    }
  }, [activeTab, currentGroupName, stats]);

  React.useEffect(() => {
    if (activeTab === 'Symbols' && !hasFetchedSymbols) {
      const fetchSymbols = async () => {
        setIsLoadingSymbols(true);
        try {
          const res = await ManagerService.getGroupSymbols(currentGroupName);
          if (Array.isArray(res)) {
            setGroupSymbols(res);
          } else if (res?.symbols) {
            setGroupSymbols(res.symbols);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setIsLoadingSymbols(false);
          setHasFetchedSymbols(true);
        }
      };
      fetchSymbols();
    }
  }, [activeTab, currentGroupName, hasFetchedSymbols]);

  const tabs = [
    'Common', 'Statistics', 'Company', 'News & Mail', 'Permissions', 'Margin', 'Symbols', 'Commissions', 'Reports'
  ];

  const fetchCommissions = useCallback(async () => {
    try {
      const res = await ManagerService.getCommissionScheduleList();
      const list = Array.isArray(res) ? res : (res?.answer || []);
      setCommissionsList(list);
    } catch (error) {
      console.error("Failed to fetch commissions", error);
    }
  }, []);

  React.useEffect(() => {
    if (activeTab !== 'Commissions') return undefined;
    const timer = setTimeout(fetchCommissions, 0);
    return () => clearTimeout(timer);
  }, [activeTab, fetchCommissions]);

  const handleDeleteCommission = async () => {
    if (!selectedCommission) return alert('Select a commission to delete');
    const deleteId = selectedCommission.schedule_id ?? selectedCommission.id ?? selectedCommission.Id;
    if (deleteId === undefined) {
      return alert('Could not find schedule_id for this item.');
    }
    
    try {
      await ManagerService.deleteCommissionSchedule(deleteId);
      fetchCommissions();
      setSelectedCommission(null);
    } catch(e) {
      console.error("Failed to delete commission", e);
      alert('Failed to delete commission');
    }
  };

  const handleCreateCommission = async () => {
    setIsCreatingCommission(true);
    try {
      const payload = {
        ...commissionFormData,
        max_volume: Number(commissionFormData.max_volume),
        min_volume: Number(commissionFormData.min_volume),
        value: Number(commissionFormData.value)
      };
      await ManagerService.createCommissionSchedule(payload);
      alert('Commission created successfully');
      setShowAddCommission(false);
      fetchCommissions();
    } catch (error) {
      console.error('Failed to create commission', error);
      alert('Failed to create commission');
    } finally {
      setIsCreatingCommission(false);
    }
  };

  const handleAddSymbol = async () => {
    const symbolStr = window.prompt(`Enter symbol to add to ${currentGroupName} (e.g. xauusd):`);
    if (!symbolStr) return;
    
    try {
      await ManagerService.getSymbolSet(currentGroupName, symbolStr);
      alert(`Symbol ${symbolStr} added successfully to ${currentGroupName}!`);
      setHasFetchedSymbols(false);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error adding symbol');
    }
  };

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
          className="h-8 bg-[#323233] flex items-center px-3 justify-between select-none cursor-move"
        >
          <div className="flex items-center gap-2">
            <Users size={14} className="text-emerald-400" />
            <span className="text-[12px] font-medium text-[color:var(--text-secondary)]">Group: {currentGroupName || 'Demo\\extra'}</span>
          </div>
          <div className="flex items-center gap-1 h-full">
            <button className="p-1.5 hover:bg-white/10 rounded-sm text-[color:var(--text-muted)] hover:text-white transition-colors"><Minus size={14} /></button>
            <button className="p-1.5 hover:bg-white/10 rounded-sm text-[color:var(--text-muted)] hover:text-white transition-colors"><Square size={12} /></button>
            <button onClick={onClose} className="p-1.5 hover:bg-[#c42b1c] rounded-sm text-[color:var(--text-muted)] hover:text-white transition-colors"><X size={14} /></button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="px-2 pt-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/20 flex gap-0.5 overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-[11px] transition-colors relative whitespace-nowrap ${
                activeTab === tab ? 'text-white bg-[color:var(--bg-app)] border-t border-l border-r border-[color:var(--border-default)] rounded-t-sm' : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]'
              }`}
            >
              {tab}
              {activeTab === tab && <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>}
            </button>
          ))}
        </div>

        {/* --- Content Area --- */}
        <div className="p-6 bg-[color:var(--bg-app)] min-h-[440px] max-h-[500px] overflow-y-auto custom-scrollbar">
          
          {/* Header Info (Global for all tabs) */}
          <div className="flex gap-4 mb-6">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20 shrink-0">
              <Users size={32} className="text-emerald-500/80" />
            </div>
            <div className="text-[11px] text-[color:var(--text-muted)] leading-normal pt-1 italic pb-4">
              {activeTab === 'Common' && "Group is a set of users that have the same permission settings and service conditions. Please specify name of group, deposit currency, trade server, and authentication type."}
              {activeTab === 'Company' && "Please specify details of the group servicing company and the folder with mail and report templates."}
              {activeTab === 'Margin' && "Please set up the mechanism of margin calculation for the group: choose the method of calculation and margin requirements."}
              {activeTab === 'Symbols' && "Please set up individual parameters of symbols trade for the group."}
              {activeTab === 'Commissions' && "Please set up commissions for accounts in the group."}
              {activeTab === 'Reports' && "The platform can daily save the end-of-day state of accounts to a special database. That data is used for generating daily statements and various reports for managers."}
              {activeTab === 'Statistics' && "Live active statistics for accounts and margins linked to this specific group. Refreshes dynamically."}
              {['News & Mail', 'Permissions'].includes(activeTab) && "Configuration of security and news distribution policies for this specific group."}
            </div>
          </div> 

          {/* Tab Specific Views */}
          <AnimatePresence mode='wait'>
            <MotionDiv key={activeTab} initial={{ opacity: 0, x: 5 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.15 }}>
              
              {/* --- COMMON TAB --- */}
              {activeTab === 'Common' && (
                <div className="space-y-1">
                  <div className="grid grid-cols-2 gap-x-8">
                    <div>
                      <InputField label="Name" value={formData.name} onChange={setFormField('name')} width="w-64" />
                      <SelectField label="Trade server" options={["Main Trade Server, 1", "Backup Server"]} defaultValue="Main Trade Server, 1" />
                      <SelectField label="Authentication" options={["Normal", "LDAP", "OAuth"]} defaultValue="Normal" />
                      <SelectField label="One-time password" options={["Disabled", "Email", "SMS"]} defaultValue="Disabled" />
                      <SelectField label="Push notifications" options={["None", "Enabled"]} defaultValue="None" />
                    </div>
                    <div>
                      <SelectField label="Currency" options={["USD", "EUR", "GBP",'JPY','CHF',"RUR"]} value={formData.currency} onChange={setFormField('currency')} width="w-24" />
                      <SelectField label="Digits" options={["2", "3", "5"]} defaultValue="2" width="w-24" />
                      <InputField label="Minimum password length" value="8" width="w-16" />
                      <CheckboxField label="Force one-time password usage" ml="ml-16 mt-4" />
                    </div>
                  </div>
                  <div className="mt-4 border-t border-white/5 pt-4">
                    <CheckboxField label="Enable connections" checked={formData.tradeAllowed} onChange={setFormField('tradeAllowed')} />
                    <CheckboxField label="Enable certificate confirmation" />
                    <CheckboxField label="Change password at first login" />
                    <CheckboxField label="Show the risk warning window after connection" />
                    <CheckboxField label="Enforce country-specific regulatory restrictions for retail clients" />
                  </div>
                </div>
              )}

              {/* --- STATISTICS TAB --- */}
              {activeTab === 'Statistics' && (
                <div className="flex-1">
                  {isLoadingStats ? (
                     <div className="text-[12px] text-[color:var(--text-muted)] flex items-center justify-center p-10 mt-10">Loading statistics...</div>
                  ) : stats ? (
                    <div className="grid grid-cols-2 gap-4">
                      {/* Top metric row */}
                      <div className="bg-[#2a2a2b] border border-[color:var(--border-default)] p-4 rounded-sm flex flex-col items-center justify-center relative overflow-hidden group">
                         <div className="text-[11px] font-medium text-[color:var(--text-muted)] uppercase tracking-wider mb-1">Total Accounts</div>
                         <div className="text-2xl text-blue-400 font-mono font-bold">{stats.accountCount?.toLocaleString() || 0}</div>
                      </div>
                      <div className="bg-[#2a2a2b] border border-[color:var(--border-default)] p-4 rounded-sm flex flex-col items-center justify-center relative overflow-hidden group">
                         <div className="text-[11px] font-medium text-[color:var(--text-muted)] uppercase tracking-wider mb-1">Active Positions</div>
                         <div className="text-2xl text-emerald-400 font-mono font-bold">{stats.activePositions?.toLocaleString() || 0}</div>
                      </div>
                      <div className="bg-[#2a2a2b] border border-[color:var(--border-default)] p-4 rounded-sm flex flex-col items-center justify-center relative overflow-hidden group">
                         <div className="text-[11px] font-medium text-[color:var(--text-muted)] uppercase tracking-wider mb-1">Total Volume</div>
                         <div className="text-2xl text-orange-400 font-mono font-bold">{stats.totalVolume?.toFixed(2) || '0.00'}</div>
                      </div>
                      <div className="bg-[#2a2a2b] border border-[color:var(--border-default)] p-4 rounded-sm flex flex-col items-center justify-center relative overflow-hidden group">
                         <div className="text-[11px] font-medium text-[color:var(--text-muted)] uppercase tracking-wider mb-1">Net Exposure</div>
                         <div className="text-2xl text-purple-400 font-mono font-bold">$0.00</div>
                      </div>
                      
                      {/* Financials Row */}
                      <div className="col-span-2 grid grid-cols-2 gap-4 mt-2">
                         <div className="bg-[#2a2a2b] border border-blue-500/20 p-5 rounded-sm flex items-center gap-4">
                            <div className="flex-1">
                               <div className="text-[11px] font-medium text-[color:var(--text-muted)] uppercase tracking-wider">Total Balance</div>
                               <div className="text-[26px] text-white font-mono mt-1">${stats.totalBalance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</div>
                            </div>
                         </div>
                         <div className="bg-[#2a2a2b] border border-emerald-500/20 p-5 rounded-sm flex items-center gap-4">
                            <div className="flex-1">
                               <div className="text-[11px] font-medium text-[color:var(--text-muted)] uppercase tracking-wider">Total Equity</div>
                               <div className="text-[26px] text-[color:var(--text-primary)] font-mono mt-1">${stats.totalEquity?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</div>
                            </div>
                         </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[12px] text-[color:var(--text-muted)] flex items-center justify-center p-10 mt-10">No statistics available.</div>
                  )}
                </div>
              )}

              {/* --- COMPANY TAB --- */}
              {activeTab === 'Company' && (
                <div className="space-y-1 pr-4">
                   <SelectField label="Company" options={["Flexy Markets Limited", "Global Trades Corp"]} defaultValue="Flexy Markets Limited" width="w-full" />
                   <InputField label="Description" value={formData.description} onChange={setFormField('description')} />
                   <InputField label="Company site" value="" />
                   <InputField label="Company email" value="" />
                   <div className="h-4"></div>
                   <InputField label="Deposit URL" value="" />
                   <InputField label="Withdrawal URL" value="" />
                   <div className="h-4"></div>
                   <InputField label="Support site" value="https://www.mql5.com/[lang:en|ru|es|pt|zh|ja|de|ko|fr|it|tr]" />
                   <InputField label="Support email" value="" />
                   <InputField label="Templates folder" value="" />
                </div>
              )}

              {/* --- MARGIN TAB --- */}
              {activeTab === 'Margin' && (
                <div className="space-y-4">
                   <SelectField label="Risk management" options={["market", "instant"]} value={formData.executionMode} onChange={setFormField('executionMode')} />
                   <div className="flex items-center gap-3 ml-4">
                      <Label width="w-36">Margin call level</Label>
                      <input type="text" value={formData.marginCallLevel} onChange={setFormField('marginCallLevel')} className="w-20 bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-2 py-0.5 text-[11px] text-white" />
                      <Label width="w-32">Stop out level</Label>
                      <input type="text" value={formData.stopOutLevel} onChange={setFormField('stopOutLevel')} className="w-20 bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-2 py-0.5 text-[11px] text-white" />
                      <select className="bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-1 py-0.5 text-[11px] text-[color:var(--text-primary)] outline-none">
                         <option value="percent">in %, percent</option>
                      </select>
                   </div>
                   <div className="space-y-1">
                      <CheckboxField label="Stop out fully hedged accounts" ml="ml-44" />
                      <CheckboxField label="Compensate negative balance after stop out" ml="ml-44" />
                      <CheckboxField label="Withdraw credit after negative balance compensation" ml="ml-44" />
                   </div>
                   <SelectField label="Floating leverage profile" options={["Crypto", "Forex", "Stock"]} defaultValue="Crypto" />
                   
                   <div className="p-4 border border-[color:var(--border-default)] rounded-sm relative mt-6">
                      <span className="absolute -top-2.5 left-4 px-2 bg-[color:var(--bg-app)] text-[10px] text-[color:var(--text-muted)] font-medium">Profit/loss in free margin</span>
                      <SelectField label="Unrealized profit" options={["use unrealized profit/loss", "exclude"]} defaultValue="use unrealized profit/loss" />
                      <SelectField label="Daily fixed profit" options={["use daily fixed profit/loss", "exclude"]} defaultValue="use daily fixed profit/loss" />
                      <CheckboxField label="Release fixed profit at the end of day" ml="ml-44" />
                   </div>
                   <div className="flex items-center gap-3">
                      <Label width="w-40">Virtual credit</Label>
                      <input type="text" className="w-24 bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-2 py-0.5 text-[11px] text-[color:var(--text-primary)]" />
                      <span className="text-[10px] text-[color:var(--text-muted)]">(applies only to opening new positions)</span>
                   </div>
                </div>
              )}

              {/* --- SYMBOLS TAB --- */}
              {activeTab === 'Symbols' && (
                <div className="flex gap-4">
                  <div className="flex flex-col pt-2">
                    <SideButton icon={ChevronUp} label="Up" />
                    <SideButton icon={ChevronDown} label="Down" />
                    <div className="h-10"></div>
                    <SideButton icon={Plus} label="Add" onClick={handleAddSymbol} />
                    <SideButton icon={Pencil} label="Edit" />
                    <SideButton icon={Trash2} label="Delete" />
                  </div>
                  <div className="flex-1 border border-[color:var(--border-default)] bg-[color:var(--bg-app)] overflow-hidden rounded-sm min-h-[300px]">
                    <div className="grid grid-cols-[1fr_80px_80px_80px] border-b border-[color:var(--border-default)] bg-[color:var(--bg-surface-1)] text-[11px] font-medium text-[color:var(--text-muted)]">
                      <div className="px-3 py-1.5 border-r border-[color:var(--border-default)]">Symbol</div>
                      <div className="px-3 py-1.5 border-r border-[color:var(--border-default)] text-center">Spread Mku</div>
                      <div className="px-3 py-1.5 border-r border-[color:var(--border-default)] text-center">Comm</div>
                      <div className="px-3 py-1.5 text-center">Swap M.</div>
                    </div>
                    <div className="text-[11px] tabular-nums">
                      {isLoadingSymbols ? (
                        <div className="p-4 text-center text-[color:var(--text-muted)]">Loading symbols...</div>
                      ) : groupSymbols.length > 0 ? (
                        groupSymbols.map((sym, i) => (
                          <div 
                            key={i} 
                            onDoubleClick={() => setSelectedSymbol(sym)}
                            className={`grid grid-cols-[1fr_80px_80px_80px] border-b border-black/10 items-center overflow-hidden transition-colors hover:bg-white/5 cursor-pointer`}
                          >
                            <div className="px-3 py-1 border-r border-black/10 truncate font-mono text-[color:var(--text-primary)] flex items-center gap-2">
                              <span className={`text-[14px] font-bold text-orange-400`}>$</span> {sym.symbol}
                            </div>
                            <div className="px-3 py-1 border-r border-black/10 text-center text-blue-400">{sym.spread_markup ? `+${sym.spread_markup}` : '0'}</div>
                            <div className="px-3 py-1 border-r border-black/10 text-center text-red-400">{sym.commission_rate || '0'}</div>
                            <div className="px-3 py-1 text-center text-[color:var(--text-muted)]">{sym.swap_multiplier || '1.0'}</div>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-[color:var(--text-muted)]">No symbols found for this group.</div>
                      )}
                      <div onClick={handleAddSymbol} className="px-3 py-2 text-[#00a86b] font-medium cursor-pointer hover:bg-white/5 transition-colors">+ click to add...</div>
                    </div>
                  </div>
                </div>
              )}

              {/* --- COMMISSIONS TAB --- */}
              {activeTab === 'Commissions' && (
                <div className="flex gap-4">
                   <div className="flex flex-col pt-2">
                    <SideButton icon={ChevronUp} label="Up" />
                    <SideButton icon={ChevronDown} label="Down" />
                    <div className="h-10"></div>
                    <SideButton icon={Plus} label="Add" onClick={() => setShowAddCommission(true)} />
                    <SideButton icon={Pencil} label="Edit" />
                    <SideButton icon={Trash2} label="Delete" onClick={handleDeleteCommission} />
                  </div>
                  <div className="flex-1 border border-[color:var(--border-default)] bg-[color:var(--bg-app)] overflow-hidden rounded-sm min-h-[300px]">
                    <div className="flex border-b border-[color:var(--border-default)] bg-[color:var(--bg-surface-1)] text-[11px] font-medium text-[color:var(--text-muted)] shrink-0">
                      <div className="w-32 px-3 py-1.5 border-r border-[color:var(--border-default)]">Name</div>
                      <div className="w-40 px-3 py-1.5 border-r border-[color:var(--border-default)]">Symbol</div>
                      <div className="w-24 px-3 py-1.5 border-r border-[color:var(--border-default)]">Type</div>
                      <div className="w-24 px-3 py-1.5 border-r border-[color:var(--border-default)]">Range</div>
                      <div className="w-24 px-3 py-1.5 border-r border-[color:var(--border-default)]">Charge</div>
                      <div className="flex-1 px-3 py-1.5">Value</div>
                    </div>
                    <div className="text-[11px] tabular-nums">
                        {commissionsList.length > 0 ? commissionsList.map((comm, index) => (
                          <div 
                            key={comm.schedule_id || comm.id || index} 
                            onClick={() => setSelectedCommission(comm)}
                            className={`flex border-b border-black/10 shrink-0 font-mono transition-colors cursor-pointer ${
                              selectedCommission === comm ? 'bg-blue-600/30 text-white' : 'text-[color:var(--text-primary)] hover:bg-white/5'
                            }`}
                          >
                            <div className="w-32 px-2 py-1.5 border-r border-black/10 flex items-center gap-1.5">
                              <span className="text-[#00a3ff] font-bold">%</span> {comm.name}
                            </div>
                            <div className="w-40 px-2 py-1.5 border-r border-black/10 truncate">{comm.symbol}</div>
                            <div className="w-24 px-2 py-1.5 border-r border-black/10">{comm.commission_type}</div>
                            <div className="w-24 px-2 py-1.5 border-r border-black/10">volume</div>
                            <div className="w-24 px-2 py-1.5 border-r border-black/10">instant</div>
                            <div className="flex-1 px-2 py-1.5 truncate">{comm.min_volume}-{comm.max_volume} - {comm.value}</div>
                          </div>
                        )) : (
                          <div className="flex bg-[#1a334d] border-b border-black/10 shrink-0 text-white font-mono opacity-50">
                             <div className="px-3 py-1.5 w-full text-center text-[color:var(--text-muted)]">No commissions found</div>
                          </div>
                        )}
                        <div onClick={() => setShowAddCommission(true)} className="px-3 py-2 text-[#00a86b] font-medium cursor-pointer flex items-center gap-1.5 hover:bg-white/5 transition-colors">
                          <span className="text-[14px]">+</span> click to add...
                        </div>
                    </div>
                  </div>
                </div>
              )}

              {/* --- REPORTS TAB --- */}
              {activeTab === 'Reports' && (
                <div className="space-y-3">
                   <div className="pr-4 pl-4 pt-2">
                     <SelectField 
                       label="Generate report data" 
                       options={["Disabled", "End of Day and End of Month", "End of Day only", "End of Month only"]} 
                       value={reportData}
                       onChange={(e) => {
                         const val = e.target.value;
                         setReportData(val);
                         if (val === 'Disabled') {
                           setGenStatements(false);
                           setSendEmail(false);
                         }
                       }}
                       width="w-full" 
                       labelWidth="w-32"
                     />
                     <CheckboxField 
                        label="Generate statements for clients"
                        checked={genStatements}
                        onChange={(e) => {
                          setGenStatements(e.target.checked);
                          if (!e.target.checked) setSendEmail(false);
                        }}
                        disabled={reportData === 'Disabled'}
                        ml="ml-[141px]"
                     />
                     <CheckboxField 
                        label="Send statements by email"
                        checked={sendEmail}
                        onChange={(e) => setSendEmail(e.target.checked)}
                        disabled={reportData === 'Disabled' || !genStatements}
                        ml="ml-[141px]"
                     />
                     <SelectField 
                       label="Mail server" 
                       options={["Default", "SMTP Relay"]} 
                       defaultValue="Default" 
                       width="w-full" 
                       labelWidth="w-32"
                       disabled={reportData === 'Disabled' || !sendEmail} 
                     />
                     <CheckboxField 
                       label="Send copies to support email" 
                       disabled={reportData === 'Disabled'} 
                       ml="ml-[141px] pt-1"
                     />
                   </div>
                </div>
              )}

              {/* --- NEWS & MAIL TAB --- */}
              {activeTab === 'News & Mail' && (
                <div className="space-y-3 pr-4">
                  <SelectField label="News" options={["full package", "Disabled"]} defaultValue="full package" width="w-48" />
                  <SelectField label="News categories" options={[]} defaultValue="" width="w-full" disabled />
                  <div className="flex items-center gap-3 mb-2">
                    <Label>News languages</Label>
                    <div className="flex items-center gap-2 w-full">
                      <input type="text" defaultValue="Auto select" className="flex-1 bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-2 py-0.5 text-[11px] text-[color:var(--text-primary)] focus:border-blue-500/50 focus:outline-none" />
                      <button className="px-6 py-0.5 bg-[#404040] hover:bg-[color:var(--border-strong)] border border-[color:var(--border-default)] rounded-sm text-[11px] text-[color:var(--text-secondary)] transition-colors">Change</button>
                    </div>
                  </div>
                  <CheckboxField label="Enable internal mail system" checked={true} />
                </div>
              )}

              {/* --- PERMISSIONS TAB --- */}
              {activeTab === 'Permissions' && (
                <div className="pr-2">
                  <div className="grid grid-cols-2 gap-x-8 mb-4">
                    <div>
                      <SelectField label="Maximum symbols" options={["unlimited", "100"]} defaultValue="unlimited" width="w-28" />
                      <SelectField label="Maximum positions" options={["unlimited", "100"]} defaultValue="unlimited" width="w-28" />
                      <InputField label="Deposit by default" value="" width="w-28" />
                      
                      <div className="flex items-center gap-3 mb-2">
                        <Label>Annual interest rate</Label>
                        <input type="text" defaultValue="0.0000" className="w-20 bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-2 py-0.5 text-[11px] text-[color:var(--text-primary)] outline-none" />
                        <span className="text-[11px] text-[color:var(--text-primary)]">%</span>
                      </div>
                    </div>
                    <div>
                      <SelectField label="Available history" options={["All", "Last 3 months"]} defaultValue="All" width="w-32" />
                      <SelectField label="Maximum orders" options={["unlimited", "100"]} defaultValue="unlimited" width="w-32" />
                      <SelectField label="Leverage by default" options={["1000", "500", "100", "50"]} value={String(formData.leverage)} onChange={setFormField('leverage')} width="w-32" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mb-4">
                    <SelectField label="Trading Signals" options={["Enable all signals from all brokers","disable","Enable signals from my servers only"]} defaultValue="Enable all signals from all brokers" width="w-[430px]" />
                    <SelectField label="Transfer of funds" options={["Disable transfer of funds between accounts","enable between accounts with same name group and sub group","Enable between accounts with same name groups","Enable between accounts from the same name"]} defaultValue="Disable transfer of funds between accounts" width="w-[430px]" />
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 pl-12 pt-2 mb-4">
                    <div className="space-y-1.5 flex flex-col items-end mr-4">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-[color:var(--text-primary)]">Enable trading by Expert Advisors</label>
                        <input type="checkbox" defaultChecked={true} className="mt-0.5 w-3.5 h-3.5 accent-blue-500 rounded-sm border-[color:var(--border-default)]" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-[color:var(--text-primary)]">Enable trailing stops</label>
                        <input type="checkbox" defaultChecked={true} className="mt-0.5 w-3.5 h-3.5 accent-blue-500 rounded-sm border-[color:var(--border-default)]" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-[color:var(--text-primary)]">Enable charge of swaps</label>
                        <input type="checkbox" defaultChecked={true} className="mt-0.5 w-3.5 h-3.5 accent-blue-500 rounded-sm border-[color:var(--border-default)]" />
                      </div>
                    </div>
                    <div className="space-y-1.5 flex flex-col items-end pr-10">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-[color:var(--text-primary)]">Enable position closing according to FIFO rule</label>
                        <input type="checkbox" defaultChecked={false} className="mt-0.5 w-3.5 h-3.5 accent-blue-500 rounded-sm border-[color:var(--border-default)]" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-[color:var(--text-primary)]">Prohibit hedge positions</label>
                        <input type="checkbox" defaultChecked={false} className="mt-0.5 w-3.5 h-3.5 accent-blue-500 rounded-sm border-[color:var(--border-default)]" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-[color:var(--text-primary)]">Enable deal cost calculation</label>
                        <input type="checkbox" defaultChecked={false} className="mt-0.5 w-3.5 h-3.5 accent-blue-500 rounded-sm border-[color:var(--border-default)]" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-center pl-8 pt-2">
                    <Label width="w-auto">Inactivity period:</Label>
                    <input type="text" defaultValue="360" className="w-14 bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-2 py-0.5 text-[11px] text-[color:var(--text-primary)] outline-none text-center" />
                    <span className="text-[11px] text-[color:var(--text-primary)]">days, orders and positions will be deleted after inactivity period</span>
                  </div>
                </div>
              )}
            </MotionDiv>
          </AnimatePresence>
        </div>

        {/* Footer Area */}
        <div className="h-14 bg-[color:var(--bg-surface-1)] border-t border-black/40 flex items-center justify-end px-6 gap-2">
           {saveError && <span className="mr-auto max-w-[360px] truncate text-[11px] text-red-400" title={saveError}>{saveError}</span>}
           <button onClick={handleSaveGroup} disabled={isSavingGroup} className="px-8 py-1.5 bg-[#404040] hover:bg-[color:var(--border-strong)] text-[12px] text-white border border-black/60 rounded-sm shadow-md transition-shadow active:shadow-none hover:border-black/80 disabled:opacity-50">{isSavingGroup ? 'Saving...' : 'OK'}</button>
           <button onClick={onClose} disabled={isSavingGroup} className="px-8 py-1.5 bg-[#404040] hover:bg-[color:var(--border-strong)] text-[12px] text-white border border-black/60 rounded-sm shadow-md transition-shadow active:shadow-none hover:border-black/80 disabled:opacity-50">Cancel</button>
           <button className="px-8 py-1.5 bg-[#404040] hover:bg-[color:var(--border-strong)] text-[12px] text-white border border-black/60 rounded-sm shadow-md transition-shadow active:shadow-none hover:border-black/80 ml-6">Help</button>
        </div>
      </MotionDiv>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #1e1e1e; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3e3e42; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4e4e52; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}} />

      {/* Add Commission Popup Overlay */}
      <AnimatePresence>
        {showAddCommission && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <MotionDiv
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-[450px] bg-[color:var(--bg-surface-1)] rounded-md shadow-2xl shadow-black/80 border border-[color:var(--border-default)] overflow-hidden"
            >
              <div className="h-8 bg-[#323233] flex items-center px-3 justify-between select-none">
                <span className="text-[12px] font-medium text-[color:var(--text-secondary)]">Create Commission Schedule</span>
                <button onClick={() => setShowAddCommission(false)} className="p-1 hover:bg-[#c42b1c] rounded-sm text-[color:var(--text-muted)] hover:text-white transition-colors">
                  <X size={14} />
                </button>
              </div>
              <div className="p-5 bg-[color:var(--bg-app)]">
                <div className="space-y-3">
                  <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                    <label className="text-[11px] text-[color:var(--text-muted)] text-right">Name:</label>
                    <input type="text" value={commissionFormData.name} onChange={(e) => setCommissionFormData({...commissionFormData, name: e.target.value})} className="w-full bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-sm px-2 py-1 text-[11px] text-[color:var(--text-primary)] outline-none focus:border-blue-500/50" />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                    <label className="text-[11px] text-[color:var(--text-muted)] text-right">Group Name:</label>
                    <input type="text" value={commissionFormData.group_name} onChange={(e) => setCommissionFormData({...commissionFormData, group_name: e.target.value})} className="w-full bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-sm px-2 py-1 text-[11px] text-[color:var(--text-primary)] outline-none focus:border-blue-500/50" />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                    <label className="text-[11px] text-[color:var(--text-muted)] text-right">Symbol:</label>
                    <input type="text" value={commissionFormData.symbol} onChange={(e) => setCommissionFormData({...commissionFormData, symbol: e.target.value})} className="w-full bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-sm px-2 py-1 text-[11px] text-[color:var(--text-primary)] outline-none focus:border-blue-500/50" />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                    <label className="text-[11px] text-[color:var(--text-muted)] text-right">Comm Type:</label>
                    <select value={commissionFormData.commission_type} onChange={(e) => setCommissionFormData({...commissionFormData, commission_type: e.target.value})} className="w-full bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-sm px-2 py-1 text-[11px] text-[color:var(--text-primary)] outline-none focus:border-blue-500/50">
                      <option value="per_lot">per_lot</option>
                      <option value="standard">standard</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                    <label className="text-[11px] text-[color:var(--text-muted)] text-right">Value:</label>
                    <input type="number" step="1" value={commissionFormData.value} onChange={(e) => setCommissionFormData({...commissionFormData, value: e.target.value})} className="w-full bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-sm px-2 py-1 text-[11px] text-[color:var(--text-primary)] outline-none focus:border-blue-500/50" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                      <label className="text-[11px] text-[color:var(--text-muted)] text-right">Min Volume:</label>
                      <input type="number" step="0.01" value={commissionFormData.min_volume} onChange={(e) => setCommissionFormData({...commissionFormData, min_volume: e.target.value})} className="w-full bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-sm px-2 py-1 text-[11px] text-[color:var(--text-primary)] outline-none focus:border-blue-500/50" />
                    </div>
                    <div className="grid grid-cols-[60px_1fr] items-center gap-3">
                      <label className="text-[11px] text-[color:var(--text-muted)] text-right">Max Vol:</label>
                      <input type="number" step="1" value={commissionFormData.max_volume} onChange={(e) => setCommissionFormData({...commissionFormData, max_volume: e.target.value})} className="w-full bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-sm px-2 py-1 text-[11px] text-[color:var(--text-primary)] outline-none focus:border-blue-500/50" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid grid-cols-[100px_1fr] items-center gap-3">
                      <label className="text-[11px] text-[color:var(--text-muted)] text-right">Time From:</label>
                      <input type="time" value={commissionFormData.time_from} onChange={(e) => setCommissionFormData({...commissionFormData, time_from: e.target.value})} className="w-full bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-sm px-2 py-1 text-[11px] text-[color:var(--text-primary)] outline-none focus:border-blue-500/50" />
                    </div>
                    <div className="grid grid-cols-[60px_1fr] items-center gap-3">
                      <label className="text-[11px] text-[color:var(--text-muted)] text-right">Time To:</label>
                      <input type="time" value={commissionFormData.time_to} onChange={(e) => setCommissionFormData({...commissionFormData, time_to: e.target.value})} className="w-full bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-sm px-2 py-1 text-[11px] text-[color:var(--text-primary)] outline-none focus:border-blue-500/50" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="h-12 bg-[color:var(--bg-surface-1)] border-t border-black/40 flex items-center justify-end px-4 gap-2">
                 <button onClick={() => setShowAddCommission(false)} className="px-4 py-1.5 bg-[#404040] hover:bg-[color:var(--border-strong)] text-[11px] text-white border border-black/60 rounded-sm">Cancel</button>
                 <button onClick={handleCreateCommission} disabled={isCreatingCommission} className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-[11px] text-white border border-blue-800 rounded-sm">
                   {isCreatingCommission ? "Saving..." : <><Save size={12}/> Save</>}
                 </button>
              </div>
            </MotionDiv>
          </div>
        )}
      </AnimatePresence>

      {selectedSymbol && (
        <SymbolPropertiesPopup 
          symbol={selectedSymbol} 
          groupName={currentGroupName}
          onClose={() => setSelectedSymbol(null)} 
        />
      )}
    </div>
  );
};

export default GroupPropertiesPopup;
