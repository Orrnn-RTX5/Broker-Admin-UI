import React from 'react';
import { motion, useDragControls } from 'framer-motion';
import { X, HelpCircle, Users } from 'lucide-react';

const MotionDiv = motion.div;

const Label = ({ children, width = "w-24" }) => (
  <label className={`text-[12px] text-[color:var(--text-primary)] ${width} text-right shrink-0 select-none pb-0.5`}>{children}</label>
);

const InputField = ({ label, value, width = "w-full", labelWidth }) => (
  <div className="flex items-center gap-2 mb-2">
    <Label width={labelWidth}>{label}</Label>
    <input
      type="text"
      defaultValue={value}
      className={`${width} bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-2 py-0.5 text-[12px] text-[color:var(--text-primary)] focus:border-blue-500/50 focus:outline-none`}
    />
  </div>
);

const SelectField = ({ label, options, defaultValue, width = "w-full", labelWidth }) => (
  <div className="flex items-center gap-2 mb-2">
    <Label width={labelWidth}>{label}</Label>
    <select
      defaultValue={defaultValue}
      className={`${width} bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-1.5 py-0.5 text-[12px] text-[color:var(--text-primary)] focus:border-blue-500/50 focus:outline-none appearance-none cursor-pointer`}
      style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23808080\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '0.75rem' }}
    >
      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  </div>
);

const CheckboxField = ({ label, defaultValue, ml = "ml-26" }) => (
  <div className={`flex items-start gap-2 mb-3 mt-1 ${ml}`}>
    <input
      type="checkbox"
      defaultChecked={defaultValue}
      className="mt-0.5 w-[13px] h-[13px] accent-blue-500 rounded-sm border-[color:var(--border-default)] opacity-60"
    />
    <label className="text-[11px] text-[color:var(--text-muted)] leading-tight select-none cursor-default">{label}</label>
  </div>
);

const AccountAllocationPopup = ({ group, onClose }) => {
  const dragControls = useDragControls();

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
      <MotionDiv
        drag
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="w-[680px] bg-[#222222] rounded-lg shadow-2xl shadow-black/80 border border-[color:var(--border-default)] overflow-hidden flex flex-col"
      >
        {/* Title Bar */}
        <div 
          onPointerDown={(e) => dragControls.start(e)}
          className="h-8 bg-[color:var(--bg-app)] flex items-center px-3 justify-between select-none cursor-move border-b border-black/40"
        >
          <div className="text-[12px] font-medium text-[color:var(--text-primary)]">Account allocation group</div>
          <div className="flex items-center gap-1 h-full pt-1">
            <button className="p-1 hover:bg-white/10 rounded-sm text-[color:var(--text-muted)] hover:text-white transition-colors"><HelpCircle size={15} /></button>
            <button onClick={onClose} className="p-1 hover:bg-[#c42b1c] rounded-sm text-[color:var(--text-muted)] hover:text-white transition-colors ml-1"><X size={16} /></button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 px-6 flex flex-col bg-[#222222]">
          
          {/* Header Description */}
          <div className="flex gap-4 mb-4">
            <div className="relative w-12 h-12 flex shrink-0 mt-1">
               <Users size={40} className="text-[#00a86b] absolute left-0" style={{ fill: 'var(--success-500)' }} />
               <Users size={32} className="text-[#20c997] absolute -right-1 bottom-0" style={{ fill: 'var(--success-500)' }} />
            </div>
            <div className="text-[12px] text-[color:var(--text-primary)] leading-tight pt-1">
              Please specify a company and a group with description. This group will be available for opening accounts from the client terminals of this company.
            </div>
          </div>

          {/* Form Fields Section 1 */}
          <div className="space-y-1">
            <div className="w-[350px]">
              <SelectField label="Company:" options={["Default", "Flexy Markets Limited"]} defaultValue="Default" />
            </div>
            
            <div className="flex items-center gap-2">
               <div className="w-[350px]">
                  <SelectField label="Group:" options={[group?.group || "demo\\STD", "preliminary", "demo\\forex-hedge-usd-01"]} defaultValue={group?.group || "demo\\STD"} />
               </div>
               <span className="text-[11px] text-[color:var(--text-primary)] mb-2 px-1">forex110..120 for ranges</span>
            </div>

            <div className="flex items-center gap-4">
               <div className="flex-1">
                 <InputField label="Description:" value={group?.desc || "Preliminary Account"} />
               </div>
               <div className="flex-1 flex gap-2">
                 <Label width="w-20">Leverages:</Label>
                 <input type="text" defaultValue={group?.leverages || "100,50,25,10,5,2,1"} className="w-full bg-[color:var(--bg-app)] border border-[color:var(--border-default)] rounded-sm px-2 py-0.5 text-[12px] text-[color:var(--text-primary)]" />
               </div>
            </div>

            <SelectField label="Countries:" options={["All countries", "Specific countries"]} defaultValue="All countries" width="w-full" />
          </div>

          <div className="grid grid-cols-2 ml-26 mb-2">
             <CheckboxField label="Require identity and proof of address documents" ml="ml-0" defaultValue={false} />
             <CheckboxField label="Start KYC check automatically" ml="ml-0" defaultValue={false} />
             <CheckboxField label="Use advanced registration form" ml="ml-0" defaultValue={false} />
          </div>

          {/* Form Fields Section 2 */}
          <div className="flex items-center gap-4 mb-4">
             <div className="flex-1">
               <SelectField label="Confirm:" options={["Phone & Email", "Email", "Phone", "None"]} defaultValue="Phone & Email" />
             </div>
             <div className="flex-1">
               <SelectField label="Mail server:" options={["Flexy Markets Limited", "Default"]} defaultValue="Flexy Markets Limited" labelWidth="w-24" />
             </div>
          </div>

          {/* Agreements Table */}
          <div className="border border-[color:var(--text-primary)] min-h-[140px] flex flex-col rounded-sm bg-[color:var(--bg-app)] mb-2">
             <div className="grid grid-cols-[1fr_2fr_100px] text-[12px] text-[color:var(--text-primary)] bg-[color:var(--bg-app)] px-1 py-1">
                <div className="px-2 border-r border-[color:var(--border-default)]/50">Agreement</div>
                <div className="px-2 border-r border-[color:var(--border-default)]/50">URL</div>
                <div className="px-2 text-center">Mandatory</div>
             </div>
             <div className="px-3 py-1 text-[#00a86b] text-[12px] cursor-pointer hover:bg-white/5 transition-colors flex items-center gap-1.5">
                <span className="text-[16px] leading-none">+</span> click to add...
             </div>
          </div>

        </div>

        {/* Footer */}
        <div className="h-12 bg-[#222222] border-t border-white/20 flex items-center justify-center gap-4">
           <button onClick={onClose} className="px-8 py-1 bg-transparent hover:bg-white/5 text-[12px] text-[color:var(--text-primary)] border border-[color:var(--text-muted)] rounded shadow-sm transition-colors">OK</button>
           <button onClick={onClose} className="px-8 py-1 bg-transparent hover:bg-white/5 text-[12px] text-[color:var(--text-primary)] border border-[color:var(--text-muted)] rounded shadow-sm transition-colors">Cancel</button>
        </div>

      </MotionDiv>
    </div>
  );
};

export default AccountAllocationPopup;
