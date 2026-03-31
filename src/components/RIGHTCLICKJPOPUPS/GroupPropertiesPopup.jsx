import React, { useState } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { X, Minus, Square, HelpCircle, Users, ChevronUp, ChevronDown, Plus, Pencil, Trash2 } from 'lucide-react';
import SymbolPropertiesPopup from './SymbolPropertiesPopup';

const GroupPropertiesPopup = ({ group, onClose }) => {
  const [activeTab, setActiveTab] = useState('Common');
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [reportData, setReportData] = useState('End of Month only');
  const [genStatements, setGenStatements] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const dragControls = useDragControls();

  const tabs = [
    'Common', 'Company', 'News & Mail', 'Permissions', 'Margin', 'Symbols', 'Commissions', 'Reports'
  ];

  // --- Helper Components ---
  const Label = ({ children, width = "w-40" }) => (
    <label className={`text-[11px] text-[#e1e1e1] ${width} text-right shrink-0 select-none`}>{children}:</label>
  );

  const InputField = ({ label, value, type = "text", width = "w-full", labelWidth }) => (
    <div className="flex items-center gap-3 mb-2">
      <Label width={labelWidth}>{label}</Label>
      <input 
        type={type} 
        defaultValue={value}
        className={`${width} bg-[#1e1e1e] border border-[#3e3e42] rounded-sm px-2 py-0.5 text-[11px] text-[#e1e1e1] focus:border-blue-500/50 focus:outline-none`}
      />
    </div>
  );

  const SelectField = ({ label, options, defaultValue, value, onChange, width = "w-full", labelWidth, disabled = false }) => (
    <div className="flex items-center gap-3 mb-2">
      <Label width={labelWidth}>{label}</Label>
      <select 
        {...(value !== undefined ? { value } : { defaultValue })}
        onChange={onChange}
        disabled={disabled}
        className={`${width} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} bg-[#1e1e1e] border border-[#3e3e42] rounded-sm px-1 py-0.5 text-[11px] text-[#e1e1e1] focus:border-blue-500/50 focus:outline-none appearance-none cursor-pointer`}
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
        className="mt-0.5 w-3.5 h-3.5 accent-blue-500 rounded-sm border-[#3e3e42]" 
      />
      <label className="text-[11px] text-[#e1e1e1] leading-tight select-none cursor-default">{label}</label>
    </div>
  );

  const SideButton = ({ icon: Icon, label }) => (
    <button className="flex flex-col items-center justify-center w-20 py-1.5 bg-[#404040] hover:bg-[#4a4a4a] border border-black/40 rounded-sm mb-1.5 group transition-colors">
      {Icon && <Icon size={14} className="text-[#a0a0a0] group-hover:text-white" />}
      {label && <span className="text-[10px] text-[#cccccc] font-medium uppercase mt-0.5">{label}</span>}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
      <motion.div 
        drag
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="w-[720px] bg-[#252526] rounded-lg shadow-2xl shadow-black/80 border border-[#3e3e42] overflow-hidden"
      >
        {/* Title Bar */}
        <div 
          onPointerDown={(e) => dragControls.start(e)}
          className="h-8 bg-[#323233] flex items-center px-3 justify-between select-none cursor-move"
        >
          <div className="flex items-center gap-2">
            <Users size={14} className="text-emerald-400" />
            <span className="text-[12px] font-medium text-[#cccccc]">Group: {group?.group || 'Demo\\extra'}</span>
          </div>
          <div className="flex items-center gap-1 h-full">
            <button className="p-1.5 hover:bg-white/10 rounded-sm text-[#808080] hover:text-white transition-colors"><Minus size={14} /></button>
            <button className="p-1.5 hover:bg-white/10 rounded-sm text-[#808080] hover:text-white transition-colors"><Square size={12} /></button>
            <button onClick={onClose} className="p-1.5 hover:bg-[#c42b1c] rounded-sm text-[#808080] hover:text-white transition-colors"><X size={14} /></button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="px-2 pt-1.5 bg-[#252526] border-b border-black/20 flex gap-0.5 overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-[11px] transition-colors relative whitespace-nowrap ${
                activeTab === tab ? 'text-white bg-[#1e1e1e] border-t border-l border-r border-[#3e3e42] rounded-t-sm' : 'text-[#808080] hover:text-[#cccccc]'
              }`}
            >
              {tab}
              {activeTab === tab && <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>}
            </button>
          ))}
        </div>

        {/* --- Content Area --- */}
        <div className="p-6 bg-[#1e1e1e] min-h-[440px] max-h-[500px] overflow-y-auto custom-scrollbar">
          
          {/* Header Info (Global for all tabs) */}
          <div className="flex gap-4 mb-6">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20 shrink-0">
              <Users size={32} className="text-emerald-500/80" />
            </div>
            <div className="text-[11px] text-[#aaaaaa] leading-normal pt-1 italic pb-4">
              {activeTab === 'Common' && "Group is a set of users that have the same permission settings and service conditions. Please specify name of group, deposit currency, trade server, and authentication type."}
              {activeTab === 'Company' && "Please specify details of the group servicing company and the folder with mail and report templates."}
              {activeTab === 'Margin' && "Please set up the mechanism of margin calculation for the group: choose the method of calculation and margin requirements."}
              {activeTab === 'Symbols' && "Please set up individual parameters of symbols trade for the group."}
              {activeTab === 'Commissions' && "Please set up commissions for accounts in the group."}
              {activeTab === 'Reports' && "The platform can daily save the end-of-day state of accounts to a special database. That data is used for generating daily statements and various reports for managers."}
              {['News & Mail', 'Permissions'].includes(activeTab) && "Configuration of security and news distribution policies for this specific group."}
            </div>
          </div>

          {/* Tab Specific Views */}
          <AnimatePresence mode='wait'>
            <motion.div key={activeTab} initial={{ opacity: 0, x: 5 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.15 }}>
              
              {/* --- COMMON TAB --- */}
              {activeTab === 'Common' && (
                <div className="space-y-1">
                  <div className="grid grid-cols-2 gap-x-8">
                    <div>
                      <InputField label="Name" value={group?.group || 'StarrFX\\ACH'} width="w-64" />
                      <SelectField label="Trade server" options={["Main Trade Server, 1", "Backup Server"]} defaultValue="Main Trade Server, 1" />
                      <SelectField label="Authentication" options={["Normal", "LDAP", "OAuth"]} defaultValue="Normal" />
                      <SelectField label="One-time password" options={["Disabled", "Email", "SMS"]} defaultValue="Disabled" />
                      <SelectField label="Push notifications" options={["None", "Enabled"]} defaultValue="None" />
                    </div>
                    <div>
                      <SelectField label="Currency" options={["USD", "EUR", "GBP",'JPY','CHF',"RUR"]} defaultValue="USD" width="w-24" />
                      <SelectField label="Digits" options={["2", "3", "5"]} defaultValue="2" width="w-24" />
                      <InputField label="Minimum password length" value="8" width="w-16" />
                      <CheckboxField label="Force one-time password usage" ml="ml-16 mt-4" />
                    </div>
                  </div>
                  <div className="mt-4 border-t border-white/5 pt-4">
                    <CheckboxField label="Enable connections" checked={true} />
                    <CheckboxField label="Enable certificate confirmation" />
                    <CheckboxField label="Change password at first login" />
                    <CheckboxField label="Show the risk warning window after connection" />
                    <CheckboxField label="Enforce country-specific regulatory restrictions for retail clients" />
                  </div>
                </div>
              )}

              {/* --- COMPANY TAB --- */}
              {activeTab === 'Company' && (
                <div className="space-y-1 pr-4">
                   <SelectField label="Company" options={["Flexy Markets Limited", "Global Trades Corp"]} defaultValue="Flexy Markets Limited" width="w-full" />
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
                   <SelectField label="Risk management" options={["for Retail Forex, CFD, Futures with hedged positions", "Netting", "Exchange"]} defaultValue="for Retail Forex, CFD, Futures with hedged positions" />
                   <div className="flex items-center gap-3 ml-4">
                      <Label width="w-36">Margin call level</Label>
                      <input type="text" defaultValue="150.00" className="w-20 bg-[#1e1e1e] border border-[#3e3e42] rounded-sm px-2 py-0.5 text-[11px] text-white" />
                      <Label width="w-32">Stop out level</Label>
                      <input type="text" defaultValue="30.00" className="w-20 bg-[#1e1e1e] border border-[#3e3e42] rounded-sm px-2 py-0.5 text-[11px] text-white" />
                      <select className="bg-[#1e1e1e] border border-[#3e3e42] rounded-sm px-1 py-0.5 text-[11px] text-[#e1e1e1] outline-none">
                         <option value="percent">in %, percent</option>
                      </select>
                   </div>
                   <div className="space-y-1">
                      <CheckboxField label="Stop out fully hedged accounts" ml="ml-44" />
                      <CheckboxField label="Compensate negative balance after stop out" ml="ml-44" />
                      <CheckboxField label="Withdraw credit after negative balance compensation" ml="ml-44" />
                   </div>
                   <SelectField label="Floating leverage profile" options={["Crypto", "Forex", "Stock"]} defaultValue="Crypto" />
                   
                   <div className="p-4 border border-[#3e3e42] rounded-sm relative mt-6">
                      <span className="absolute -top-2.5 left-4 px-2 bg-[#1e1e1e] text-[10px] text-[#808080] font-medium">Profit/loss in free margin</span>
                      <SelectField label="Unrealized profit" options={["use unrealized profit/loss", "exclude"]} defaultValue="use unrealized profit/loss" />
                      <SelectField label="Daily fixed profit" options={["use daily fixed profit/loss", "exclude"]} defaultValue="use daily fixed profit/loss" />
                      <CheckboxField label="Release fixed profit at the end of day" ml="ml-44" />
                   </div>
                   <div className="flex items-center gap-3">
                      <Label width="w-40">Virtual credit</Label>
                      <input type="text" className="w-24 bg-[#1e1e1e] border border-[#3e3e42] rounded-sm px-2 py-0.5 text-[11px] text-[#e1e1e1]" />
                      <span className="text-[10px] text-[#808080]">(applies only to opening new positions)</span>
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
                    <SideButton icon={Plus} label="Add" />
                    <SideButton icon={Pencil} label="Edit" />
                    <SideButton icon={Trash2} label="Delete" />
                  </div>
                  <div className="flex-1 border border-[#3e3e42] bg-[#1e1e1e] overflow-hidden rounded-sm min-h-[300px]">
                    <div className="grid grid-cols-[1fr_120px_100px] border-b border-[#3e3e42] bg-[#2d2d2d] text-[11px] font-medium text-[#aaaaaa]">
                      <div className="px-3 py-1.5 border-r border-[#3e3e42]">Symbol</div>
                      <div className="px-3 py-1.5 border-r border-[#3e3e42] text-center">Spread</div>
                      <div className="px-3 py-1.5 text-center">Trade</div>
                    </div>
                    <div className="text-[11px] tabular-nums">
                      {[
                        { s: 'TradingA\\CFD-FX\\*', sp: '+20', t: 'Default', a: true },
                        { s: 'TradingA\\CFD-Bullion-Futures\\*', sp: 'Default', t: 'Default' },
                        { s: 'TradingA\\CFD-Indices\\*', sp: '+30', t: 'Default' },
                        { s: 'TradingA\\CFD-Metals\\*', sp: '+25', t: 'Default' },
                        { s: 'TradingA\\CFD-Energy-Spot\\*', sp: '+30', t: 'Default' },
                        { s: 'TradingA\\Crypto\\*', sp: '+10', t: 'Default' },
                      ].map((sym, i) => (
                        <div 
                          key={i} 
                          onDoubleClick={() => setSelectedSymbol(sym)}
                          className={`grid grid-cols-[1fr_120px_100px] border-b border-black/10 items-center overflow-hidden transition-colors ${sym.a ? 'bg-[#1a334d]' : 'hover:bg-white/5 cursor-default'}`}
                        >
                          <div className="px-3 py-1 border-r border-black/10 truncate font-mono text-[#e1e1e1] flex items-center gap-2">
                            <span className="text-orange-400">$</span> {sym.s}
                          </div>
                          <div className="px-3 py-1 border-r border-black/10 text-center text-blue-400">{sym.sp}</div>
                          <div className="px-3 py-1 text-center text-[#aaaaaa]">{sym.t}</div>
                        </div>
                      ))}
                      <div className="px-3 py-2 text-[#00a86b] font-medium cursor-pointer hover:bg-white/5 transition-colors">+ click to add...</div>
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
                    <SideButton icon={Plus} label="Add" />
                    <SideButton icon={Pencil} label="Edit" />
                    <SideButton icon={Trash2} label="Delete" />
                  </div>
                  <div className="flex-1 border border-[#3e3e42] bg-[#1e1e1e] overflow-hidden rounded-sm min-h-[300px]">
                    <div className="flex border-b border-[#3e3e42] bg-[#2d2d2d] text-[11px] font-medium text-[#aaaaaa] shrink-0">
                      <div className="w-32 px-3 py-1.5 border-r border-[#3e3e42]">Name</div>
                      <div className="w-40 px-3 py-1.5 border-r border-[#3e3e42]">Symbol</div>
                      <div className="w-24 px-3 py-1.5 border-r border-[#3e3e42]">Type</div>
                      <div className="w-24 px-3 py-1.5 border-r border-[#3e3e42]">Range</div>
                      <div className="w-24 px-3 py-1.5 border-r border-[#3e3e42]">Charge</div>
                      <div className="flex-1 px-3 py-1.5">Value</div>
                    </div>
                    <div className="text-[11px] tabular-nums">
                        <div className="flex bg-[#1a334d] border-b border-black/10 shrink-0 text-white font-mono">
                          <div className="w-32 px-2 py-1.5 border-r border-black/10 flex items-center gap-1.5">
                            <span className="text-[#00a3ff] font-bold">%</span> Future
                          </div>
                          <div className="w-40 px-2 py-1.5 border-r border-black/10 truncate">Trading\CFD-Fut...</div>
                          <div className="w-24 px-2 py-1.5 border-r border-black/10">standard</div>
                          <div className="w-24 px-2 py-1.5 border-r border-black/10">volume</div>
                          <div className="w-24 px-2 py-1.5 border-r border-black/10">instant</div>
                          <div className="flex-1 px-2 py-1.5 truncate">0.01-1 000 - 5.00 - dep...</div>
                        </div>
                        <div className="px-3 py-2 text-[#00a86b] font-medium cursor-pointer flex items-center gap-1.5 hover:bg-white/5 transition-colors">
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
                      <input type="text" defaultValue="Auto select" className="flex-1 bg-[#1e1e1e] border border-[#3e3e42] rounded-sm px-2 py-0.5 text-[11px] text-[#e1e1e1] focus:border-blue-500/50 focus:outline-none" />
                      <button className="px-6 py-0.5 bg-[#404040] hover:bg-[#505050] border border-[#3e3e42] rounded-sm text-[11px] text-[#cccccc] transition-colors">Change</button>
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
                        <input type="text" defaultValue="0.0000" className="w-20 bg-[#1e1e1e] border border-[#3e3e42] rounded-sm px-2 py-0.5 text-[11px] text-[#e1e1e1] outline-none" />
                        <span className="text-[11px] text-[#e1e1e1]">%</span>
                      </div>
                    </div>
                    <div>
                      <SelectField label="Available history" options={["All", "Last 3 months"]} defaultValue="All" width="w-32" />
                      <SelectField label="Maximum orders" options={["unlimited", "100"]} defaultValue="unlimited" width="w-32" />
                      <SelectField label="Leverage by default" options={["1 : 1000", "1 : 500"]} defaultValue="1 : 1000" width="w-32" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mb-4">
                    <SelectField label="Trading Signals" options={["Enable all signals from all brokers"]} defaultValue="Enable all signals from all brokers" width="w-[430px]" />
                    <SelectField label="Transfer of funds" options={["Disable transfer of funds between accounts"]} defaultValue="Disable transfer of funds between accounts" width="w-[430px]" />
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 pl-12 pt-2 mb-4">
                    <div className="space-y-1.5 flex flex-col items-end mr-4">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-[#e1e1e1]">Enable trading by Expert Advisors</label>
                        <input type="checkbox" defaultChecked={true} className="mt-0.5 w-3.5 h-3.5 accent-blue-500 rounded-sm border-[#3e3e42]" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-[#e1e1e1]">Enable trailing stops</label>
                        <input type="checkbox" defaultChecked={true} className="mt-0.5 w-3.5 h-3.5 accent-blue-500 rounded-sm border-[#3e3e42]" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-[#e1e1e1]">Enable charge of swaps</label>
                        <input type="checkbox" defaultChecked={true} className="mt-0.5 w-3.5 h-3.5 accent-blue-500 rounded-sm border-[#3e3e42]" />
                      </div>
                    </div>
                    <div className="space-y-1.5 flex flex-col items-end pr-10">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-[#e1e1e1]">Enable position closing according to FIFO rule</label>
                        <input type="checkbox" defaultChecked={false} className="mt-0.5 w-3.5 h-3.5 accent-blue-500 rounded-sm border-[#3e3e42]" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-[#e1e1e1]">Prohibit hedge positions</label>
                        <input type="checkbox" defaultChecked={false} className="mt-0.5 w-3.5 h-3.5 accent-blue-500 rounded-sm border-[#3e3e42]" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-[#e1e1e1]">Enable deal cost calculation</label>
                        <input type="checkbox" defaultChecked={false} className="mt-0.5 w-3.5 h-3.5 accent-blue-500 rounded-sm border-[#3e3e42]" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 justify-center pl-8 pt-2">
                    <Label width="w-auto">Inactivity period:</Label>
                    <input type="text" defaultValue="360" className="w-14 bg-[#1e1e1e] border border-[#3e3e42] rounded-sm px-2 py-0.5 text-[11px] text-[#e1e1e1] outline-none text-center" />
                    <span className="text-[11px] text-[#e1e1e1]">days, orders and positions will be deleted after inactivity period</span>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Area */}
        <div className="h-14 bg-[#2b2b2b] border-t border-black/40 flex items-center justify-end px-6 gap-2">
           <button onClick={onClose} className="px-8 py-1.5 bg-[#404040] hover:bg-[#505050] text-[12px] text-white border border-black/60 rounded-sm shadow-md transition-shadow active:shadow-none hover:border-black/80">OK</button>
           <button onClick={onClose} className="px-8 py-1.5 bg-[#404040] hover:bg-[#505050] text-[12px] text-white border border-black/60 rounded-sm shadow-md transition-shadow active:shadow-none hover:border-black/80">Cancel</button>
           <button className="px-8 py-1.5 bg-[#404040] hover:bg-[#505050] text-[12px] text-white border border-black/60 rounded-sm shadow-md transition-shadow active:shadow-none hover:border-black/80 ml-6">Help</button>
        </div>
      </motion.div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #1e1e1e; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3e3e42; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4e4e52; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}} />

      {/* Render nested symbol popup if a symbol is selected */}
      <AnimatePresence>
        {selectedSymbol && (
          <SymbolPropertiesPopup 
            symbol={selectedSymbol} 
            onClose={() => setSelectedSymbol(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default GroupPropertiesPopup;
