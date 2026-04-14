import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { X, HelpCircle, DollarSign, FileText } from 'lucide-react';
import { ManagerService } from '../../services/manager.service';

const SymbolPropertiesPopup = ({ symbol, groupName, onClose }) => {
  const [activeTab, setActiveTab] = useState('Common');
  const [fullSymbolData, setFullSymbolData] = useState(symbol);

  useEffect(() => {
    if (groupName) {
      ManagerService.getSymbolList(groupName).then(res => {
        const found = res?.symbols?.find(s => s.symbol?.toLowerCase() === symbol?.symbol?.toLowerCase());
        if (found) {
          // Merge found (global symbol properties) FIRST, then overwrite with symbol (group-specific overrides) LAST.
          setFullSymbolData({ ...found, ...symbol });
        }
      }).catch(err => console.error(err));
    }
  }, [groupName, symbol?.symbol]);
  const dragControls = useDragControls();

  const tabs = [
    'Common', 'Trade', 'Execution', 'Margin', 'Margin Rates', 'Swaps'
  ];

  // --- Helper Components ---
  const Label = ({ children, width = "w-32" }) => (
    <label className={`text-[11px] text-[color:var(--text-primary)] ${width} text-right shrink-0 select-none`}>{children}:</label>
  );

  const InputField = ({ label, value, type = "text", width = "w-full", labelWidth }) => (
    <div className="flex items-center gap-2 mb-2">
      <Label width={labelWidth}>{label}</Label>
      <input 
        type={type} 
        defaultValue={value}
        className={`${width} bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-2 py-0.5 text-[11px] text-[color:var(--text-primary)] focus:border-blue-500/50 focus:outline-none`}
      />
    </div>
  );

  const SelectField = ({ label, options, defaultValue, width = "w-full", labelWidth, disabled = false }) => (
    <div className="flex items-center gap-2 mb-2">
      <Label width={labelWidth}>{label}</Label>
      <select 
        defaultValue={defaultValue}
        disabled={disabled}
        className={`${width} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-1 py-0.5 text-[11px] text-[color:var(--text-primary)] focus:border-blue-500/50 focus:outline-none appearance-none`}
        style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23808080\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '0.75rem' }}
      >
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );

  const CheckboxField = ({ label, checked = false, ml = "ml-36", disabled = false, onChange }) => (
    <div className={`flex items-start gap-2 mb-1.5 ${ml} ${disabled ? 'opacity-40' : ''}`}>
      <input type="checkbox" defaultChecked={checked} onChange={onChange} disabled={disabled} className="mt-0.5 w-3.5 h-3.5 accent-blue-500 rounded-sm border-[color:var(--border-default)]" />
      <label className="text-[11px] text-[color:var(--text-primary)] leading-tight select-none">{label}</label>
    </div>
  );

  const BlueDocIcon = () => (
    <div className="w-3.5 h-3.5 bg-blue-500/20 border border-blue-500/50 rounded-sm flex items-center justify-center">
       <div className="w-1.5 h-0.5 bg-blue-400 mb-0.5"></div>
       <div className="w-1.5 h-0.5 bg-blue-400"></div>
    </div>
  );

  const RedDocIcon = () => (
    <div className="w-3.5 h-3.5 bg-red-500/20 border border-red-500/50 rounded-sm flex items-center justify-center">
       <div className="w-1.5 h-0.5 bg-red-400 mb-0.5"></div>
       <div className="w-1.5 h-0.5 bg-red-400"></div>
    </div>
  );

  const TableHeader = ({ title }) => (
    <div className="px-3 py-1.5 border-r border-[color:var(--border-default)] text-center last:border-r-0">{title}</div>
  );

  const TableCell = ({ children, isFirst = false }) => (
    <div className={`px-3 py-1 border-r border-black/10 last:border-r-0 ${isFirst ? 'flex items-center gap-1.5 font-medium' : 'text-center'}`}>
      {children}
    </div>
  );

  const handleToggleEnable = async (e) => {
    const isChecked = e.target.checked;
    const originalState = fullSymbolData?.enabled;
    
    // Optmistic UI update
    setFullSymbolData(prev => ({ ...prev, enabled: isChecked }));
    
    try {
      await ManagerService.toggleGroupSymbol(groupName, fullSymbolData?.symbol, isChecked);
    } catch (err) {
      console.error("Failed to toggle symbol status", err);
      // Revert on failure
      setFullSymbolData(prev => ({ ...prev, enabled: originalState }));
      alert('Failed to toggle symbol status. Details: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
      <motion.div 
        drag
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="w-[660px] bg-[color:var(--bg-surface-1)] rounded-lg shadow-[0_0_30px_rgba(0,0,0,0.8)] border border-[color:var(--border-default)] overflow-hidden"
      >
        {/* Title Bar */}
        <div 
          onPointerDown={(e) => dragControls.start(e)}
          className="h-8 bg-[#323233] flex items-center px-3 justify-between select-none cursor-move"
        >
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-[color:var(--text-secondary)]">Symbol: {fullSymbolData?.symbol || 'Trading\\CFD-Energy-Spot\\*'}</span>
          </div>
          <div className="flex items-center gap-1 h-full">
            <button className="px-2 hover:bg-white/10 rounded-sm text-[color:var(--text-muted)] hover:text-white transition-colors text-[14px]">?</button>
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
        <div className="p-6 bg-[color:var(--bg-app)] min-h-[360px] max-h-[480px] overflow-y-auto custom-scrollbar">
          
          {/* Header Info (Global) */}
          <div className="flex gap-4 mb-6">
            <div className="w-12 h-12 bg-[#E8B339] rounded-md flex items-center justify-center shrink-0 shadow-inner">
              <DollarSign size={28} className="text-[#B38600] drop-shadow-sm" />
            </div>
            <div className="text-[11px] text-[#dedede] leading-normal pt-1 pb-4 font-medium">
              {activeTab === 'Margin' && "Please specify margin requirements for the symbols group."}
              {activeTab === 'Margin Rates' && "Please specify margin rates for different types of trade operations."}
              {activeTab === 'Swaps' && "Please set up parameters of charging swaps by symbols for the group."}
              {['Common', 'Trade', 'Execution'].includes(activeTab) && "Configure core execution parameters for " + (fullSymbolData?.symbol || 'this symbol group') + "."}
            </div>
          </div>

          <AnimatePresence mode='wait'>
            <motion.div key={activeTab} initial={{ opacity: 0, x: 5 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.15 }}>
              
              {/* --- MARGIN TAB --- */}
              {activeTab === 'Margin' && (
                <div className="pl-4 space-y-2">
                  <CheckboxField label="Use default margin values" checked={true} />
                  <InputField label="Initial margin" value="0" width="w-24" />
                  <InputField label="Hedged margin" value="0" width="w-24" />
                  <InputField label="Maintenance margin" value="0" width="w-24" />
                  
                  <div className="mt-4 space-y-1.5">
                    <CheckboxField label="Use default margin settings" checked={true} />
                    <CheckboxField label="Calculate hedged margin using larger leg" disabled />
                    <CheckboxField label="Exclude long position PnL from free margin and margin level" disabled />
                    <CheckboxField label="Recalculate margin exchange rate at the End of Day" disabled />
                  </div>

                  <div className="flex items-center gap-2 mt-4 ml-[-1rem]">
                    <Label width="w-[140px]">Additional margin checks:</Label>
                    <select disabled className="w-[300px] opacity-50 bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-1 py-0.5 text-[11px] text-[color:var(--text-primary)] appearance-none" style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23808080\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '0.75rem' }}>
                      <option>0</option>
                    </select>
                  </div>
                </div>
              )}

              {/* --- MARGIN RATES TAB --- */}
              {activeTab === 'Margin Rates' && (
                <div className="space-y-4">
                  <div className="pl-2">
                    <SelectField label="Liquidity margin rate" options={["0"]} defaultValue="0" width="w-32" labelWidth="w-[130px]" />
                    <SelectField label="Currency margin rate" options={["0"]} defaultValue="0" width="w-32" labelWidth="w-[130px]" />
                  </div>

                  <div className="border border-[color:var(--border-default)] bg-[color:var(--bg-app)] rounded-sm mt-4">
                    <div className="grid grid-cols-[110px_1fr_1fr_1fr_1fr] border-b border-[color:var(--border-default)] bg-[color:var(--bg-app)] text-[11px]">
                      <TableHeader title="" />
                      <TableHeader title="Market Order" />
                      <TableHeader title="Limit Order" />
                      <TableHeader title="Stop Order" />
                      <TableHeader title="Stop Limit Order" />
                    </div>
                    
                    {/* Initial Margin Group */}
                    <div className="px-3 py-1 font-bold text-white text-[11px] border-b border-black/10">Initial margin</div>
                    <div className="grid grid-cols-[110px_1fr_1fr_1fr_1fr] border-b border-black/10 text-[11px] text-[color:var(--text-primary)]">
                      <TableCell isFirst><BlueDocIcon /> Buy</TableCell>
                      <TableCell>0</TableCell><TableCell>0</TableCell><TableCell>0</TableCell><TableCell>0</TableCell>
                    </div>
                    <div className="grid grid-cols-[110px_1fr_1fr_1fr_1fr] border-b border-[color:var(--border-default)] text-[11px] text-[color:var(--text-primary)]">
                      <TableCell isFirst><RedDocIcon /> Sell</TableCell>
                      <TableCell>0</TableCell><TableCell>0</TableCell><TableCell>0</TableCell><TableCell>0</TableCell>
                    </div>

                    {/* Maintenance Margin Group */}
                    <div className="px-3 py-1 font-bold text-white text-[11px] border-b border-black/10">Maintenance margin</div>
                    <div className="grid grid-cols-[110px_1fr_1fr_1fr_1fr] border-b border-black/10 text-[11px] text-[color:var(--text-primary)]">
                      <TableCell isFirst><BlueDocIcon /> Buy</TableCell>
                      <TableCell>0</TableCell><TableCell>0</TableCell><TableCell>0</TableCell><TableCell>0</TableCell>
                    </div>
                    <div className="grid grid-cols-[110px_1fr_1fr_1fr_1fr] text-[11px] text-[color:var(--text-primary)]">
                      <TableCell isFirst><RedDocIcon /> Sell</TableCell>
                      <TableCell>0</TableCell><TableCell>0</TableCell><TableCell>0</TableCell><TableCell>0</TableCell>
                    </div>
                  </div>

                  <button className="px-6 py-1 bg-[color:var(--bg-app)] hover:bg-[#333] border border-[color:var(--border-default)] rounded-sm text-[11px] text-[color:var(--text-secondary)] transition-colors ml-1 w-[200px]">
                    Use default rates settings
                  </button>
                </div>
              )}

              {/* --- SWAPS TAB --- */}
              {activeTab === 'Swaps' && (
                <div className="pl-4 relative">
                  <SelectField label="Type" options={["0"]} defaultValue="0" width="w-[490px]" labelWidth="w-24" />
                  
                  <div className="grid grid-cols-[300px_300px] mb-2 mt-2">
                    <div className="flex items-center gap-2">
                      <Label width="w-24">Long positions</Label>
                      <select className="w-[124px] bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-1 py-0.5 text-[11px] text-blue-400 outline-none">
                        <option>0</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label width="w-[110px]">Short positions</Label>
                      <select className="w-[124px] bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-1 py-0.5 text-[11px] text-blue-400 outline-none">
                        <option>0</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-[300px_300px] mb-4">
                    <div className="flex items-center gap-2">
                      <Label width="w-24">Days in year</Label>
                      <select className="w-[124px] bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-1 py-0.5 text-[11px] text-blue-400 outline-none">
                        <option>0</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label width="w-[110px]">Consider holidays</Label>
                      <select className="w-[124px] bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-1 py-0.5 text-[11px] text-white outline-none">
                        <option>0</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex items-start gap-2">
                      <Label width="w-24 pt-1">Swap multipliers</Label>
                      <div className="w-[200px] border border-[color:var(--text-primary)] bg-[color:var(--bg-app)] text-[11px] rounded-sm overflow-hidden flex flex-col">
                        <div className="grid grid-cols-2 border-b border-black/20 text-[color:var(--text-secondary)] font-medium text-center">
                          <div className="border-r border-black/20 py-1 text-left px-2">Day of week</div>
                          <div className="py-1">Multiplier</div>
                        </div>
                        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, idx) => (
                          <div key={day} className={`grid grid-cols-2 border-b border-black/10 last:border-0 ${idx === 0 ? 'bg-[#1a334d]' : 'hover:bg-white/5 cursor-default'}`}>
                            <div className={`px-2 py-1 border-r border-black/10 ${idx === 0 ? 'text-white' : 'text-[color:var(--text-primary)]'}`}>{day}</div>
                            <div className="px-2 py-1 text-center text-blue-400">0</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-3 mt-1">
                      <button className="w-24 py-1 bg-[color:var(--bg-app)] hover:bg-[#333] border border-[color:var(--border-default)] rounded-sm text-[11px] text-white transition-colors">0</button>
                      <button className="w-24 py-1 bg-[color:var(--bg-app)] hover:bg-[#333] border border-[color:var(--border-default)] rounded-sm text-[11px] text-white transition-colors">0</button>
                      <button className="w-24 py-1 bg-[color:var(--bg-app)] hover:bg-[#333] border border-[color:var(--border-default)] rounded-sm text-[11px] text-white transition-colors">0</button>
                      <button className="w-24 py-1 bg-[color:var(--bg-app)] hover:bg-[#333] border border-[color:var(--border-default)] rounded-sm text-[11px] text-white transition-colors">0</button>
                      <select className="w-[240px] mt-[-2px] bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-1 py-0.5 text-[11px] text-white outline-none">
                        <option>0</option>
                      </select>
                    </div>
                  </div>

                  <button className="w-[200px] py-1 bg-[color:var(--bg-app)] hover:bg-[#333] border border-[color:var(--text-primary)] rounded-sm text-[11px] text-white transition-colors mt-2 ml-[104px]">
                    Use default swap settings
                  </button>
                </div>
              )}

              {/* --- COMMON TAB --- */}
              {activeTab === 'Common' && (
                <div className="pl-4 pr-10 space-y-3 pb-8">
                  <div className="flex items-center gap-6">
                    <SelectField label="Symbol" options={[fullSymbolData?.symbol || "0"]} defaultValue={fullSymbolData?.symbol || "0"} labelWidth="w-28" width="w-48" disabled />
                    <CheckboxField label="Enabled" checked={fullSymbolData?.enabled ?? true} onChange={handleToggleEnable} ml="ml-0" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 ml-4 pt-2 pb-2">
                    <InputField label="Digits" value={fullSymbolData?.digits ?? 5} width="w-20" labelWidth="w-[100px]" />
                    <InputField label="Spread" value={fullSymbolData?.spread ?? 10} width="w-20" labelWidth="w-[100px]" />
                    
                    <InputField label="Contract size" value={fullSymbolData?.contract_size ?? 100000} width="w-24" labelWidth="w-[100px]" />
                    <InputField label="Tick size" value={fullSymbolData?.tick_size ?? 0.00001} width="w-24" labelWidth="w-[100px]" />
                    
                    <InputField label="Tick value" value={fullSymbolData?.tick_value ?? 1} width="w-24" labelWidth="w-[100px]" />
                    <InputField label="Spread markup" value={fullSymbolData?.spread_markup ?? 0} width="w-20" labelWidth="w-[100px]" />
                    
                    <InputField label="Commission" value={fullSymbolData?.commission_rate ?? 0} width="w-20" labelWidth="w-[100px]" />
                    <InputField label="Swap mult." value={fullSymbolData?.swap_multiplier ?? 1} width="w-20" labelWidth="w-[100px]" />
                  </div>

                  <div className="flex items-center ml-[120px] pt-2 pb-1 border-t border-white/5">
                    <CheckboxField label="Enable market depth" checked={fullSymbolData?.trade_allowed ?? true} ml="ml-0 mb-0" />
                  </div>

                  <CheckboxField label="Use default spread" checked={false} ml="ml-[120px]" />
                  
                  <div className="flex items-center ml-4 gap-4 pb-2">
                    <div className="flex items-center gap-2 opacity-50">
                      <Label width="w-24">Spread difference</Label>
                      <select disabled className="w-16 bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-1 py-0.5 text-[11px] text-[color:var(--text-primary)] outline-none">
                        <option>0</option>
                      </select>
                      <span className="text-[11px] text-[color:var(--text-primary)]">pt</span>
                    </div>
                    <div className="flex items-center gap-2 opacity-50">
                      <Label width="w-auto">Difference balance</Label>
                      <div className="flex items-center gap-2 ml-1">
                        <input type="range" min="-10" max="10" defaultValue="0" className="w-24" disabled />
                        <span className="text-[11px] text-[color:var(--text-primary)] w-20">0 bid / 0 ask</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <CheckboxField label="Use default volumes" checked={true} ml="ml-[120px]" />
                    
                    <div className="flex items-center gap-4 ml-8 pb-3">
                      <div className="flex items-center gap-2 opacity-50">
                        <Label width="w-16">Minimum</Label>
                        <select disabled className="w-16 bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-1 py-0.5 text-[11px] text-[color:var(--text-primary)] outline-none"><option>0</option></select>
                      </div>
                      <div className="flex items-center gap-2 opacity-50">
                        <Label width="w-10">Step</Label>
                        <select disabled className="w-16 bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-1 py-0.5 text-[11px] text-[color:var(--text-primary)] outline-none"><option>0</option></select>
                      </div>
                      <div className="flex items-center gap-2 opacity-50">
                        <Label width="w-16">Maximum</Label>
                        <select disabled className="w-16 bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-1 py-0.5 text-[11px] text-[color:var(--text-primary)] outline-none"><option>0</option></select>
                      </div>
                    </div>

                    <div className="pt-2">
                       <CheckboxField label="Use default limit" checked={true} ml="ml-[120px]" />
                       <div className="flex items-center gap-2 ml-10 mt-1 opacity-50">
                          <Label width="w-16">Limit</Label>
                          <select disabled className="w-16 bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-1 py-0.5 text-[11px] text-[color:var(--text-primary)] outline-none"><option>0</option></select>
                       </div>
                    </div>
                  </div>
                </div>
              )}

              {/* --- TRADE TAB --- */}
              {activeTab === 'Trade' && (
                <div className="pl-6 space-y-4">
                  <CheckboxField label="Use default trade settings" checked={true} ml="ml-[100px]" />
                  
                  <div className="space-y-2 pr-[200px]">
                    <SelectField label="Trade" options={["0"]} defaultValue="0" labelWidth="w-[90px]" disabled />
                    <SelectField label="Filling" options={["0"]} defaultValue="0" labelWidth="w-[90px]" disabled />
                    <SelectField label="Expiration" options={["0"]} defaultValue="0" labelWidth="w-[90px]" disabled />
                    <SelectField label="Orders" options={["0"]} defaultValue="0" labelWidth="w-[90px]" disabled />
                  </div>

                  <div className="pt-4 space-y-3">
                    <CheckboxField label="Use default trade level settings" checked={true} ml="ml-[100px]" />
                    
                    <div className="flex items-center gap-10 ml-4 opacity-50">
                      <div className="flex items-center gap-2">
                        <Label width="w-[90px]">Limit & stop level</Label>
                        <input type="text" defaultValue="0" disabled className="w-20 bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-2 py-0.5 text-[11px] text-[color:var(--text-primary)] outline-none text-right" />
                        <span className="text-[11px] text-[color:var(--text-primary)]">pt</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label width="w-auto">Freeze level</Label>
                        <input type="text" defaultValue="0" disabled className="w-20 bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-2 py-0.5 text-[11px] text-[color:var(--text-primary)] outline-none text-right" />
                        <span className="text-[11px] text-[color:var(--text-primary)]">pt</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* --- EXECUTION TAB --- */}
              {activeTab === 'Execution' && (
                <div className="pl-6 space-y-4 pt-2">
                  <CheckboxField label="Use default execution settings" checked={true} ml="ml-24" />
                  <div className="pr-[200px]">
                    <SelectField label="Execution" options={["0"]} defaultValue="0" labelWidth="w-24" disabled />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Area */}
        <div className="h-14 bg-[color:var(--bg-surface-1)] border-t border-black/40 flex items-center justify-end px-6 gap-2">
           <button onClick={onClose} className="w-24 py-1.5 bg-[#404040] hover:bg-[color:var(--border-strong)] text-[12px] text-white border border-black/60 rounded-sm shadow-md transition-shadow active:shadow-none hover:border-black/80">OK</button>
           <button onClick={onClose} className="w-24 py-1.5 bg-[#404040] hover:bg-[color:var(--border-strong)] text-[12px] text-white border border-black/60 rounded-sm shadow-md transition-shadow active:shadow-none hover:border-black/80">Cancel</button>
           <button className="w-24 py-1.5 bg-[#404040] hover:bg-[color:var(--border-strong)] text-[12px] text-white border border-black/60 rounded-sm shadow-md transition-shadow active:shadow-none hover:border-black/80 ml-6">Help</button>
        </div>
      </motion.div>
    </div>
  );
};

export default SymbolPropertiesPopup;
