import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ManagerService } from '../../services/manager.service';
import { useGroups } from '../../hooks/useAdmin';

const InputField = ({ label, value, onChange, type = "text", width = "w-[240px]", labelWidth = "w-[120px]" }) => (
  <div className="flex items-center gap-2 mb-2">
    <label className={`text-[11px] text-[#cccccc] ${labelWidth} shrink-0`}>{label}</label>
    <input 
      type={type}
      value={value}
      onChange={onChange}
      className={`bg-[#1e1e1e] border border-[#3e3e42] rounded-sm px-2 py-0.5 text-[11px] text-[#e1e1e1] outline-none ${width} hover:border-[#555] focus:border-[#007acc] focus:bg-[#252526] transition-colors`}
    />
  </div>
);

const SelectField = ({ label, value, onChange, options, loading, width = "w-[240px]", labelWidth = "w-[120px]" }) => (
  <div className="flex items-center gap-2 mb-2">
    <label className={`text-[11px] text-[#cccccc] ${labelWidth} shrink-0`}>{label}</label>
    <select 
      value={value}
      onChange={onChange}
      disabled={loading}
      className={`bg-[#1e1e1e] border border-[#3e3e42] rounded-sm px-1 py-0.5 text-[11px] text-[#e1e1e1] outline-none ${width} hover:border-[#555] focus:border-[#007acc]`}
    >
      {loading ? <option>Loading...</option> : options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

const CheckboxField = ({ label, checked, onChange }) => (
  <div className="flex items-center gap-2 mb-2 ml-[128px]">
    <input 
      type="checkbox" 
      checked={checked}
      onChange={onChange}
      className="appearance-none w-3.5 h-3.5 border border-[#3e3e42] rounded-[2px] bg-[#1e1e1e] checked:bg-[#007acc] checked:border-[#007acc] relative
      after:content-[''] after:absolute after:hidden checked:after:block after:left-[3px] after:top-[1px] after:w-[4px] after:h-[7px] after:border-r-[1.5px] after:border-b-[1.5px] after:border-white after:rotate-45"
    />
    <span className="text-[11px] text-[#cccccc] select-none">{label}</span>
  </div>
);

const AddSwapFreeGroupPopup = ({ onClose, onCreated }) => {
  const { data: groupsResponse, loading: groupsLoading } = useGroups(true);
  
  const [formData, setFormData] = useState({
    group_name: '',
    symbol_pattern: '*',
    swap_free: true,
    charge_fee: false,
    fee_per_lot: 0,
    max_holding_days: 0
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (groupsResponse) {
      const apiGroups = Array.isArray(groupsResponse) ? groupsResponse : (groupsResponse.answer || []);
      if (apiGroups.length > 0 && !formData.group_name) {
        setFormData(prev => ({ ...prev, group_name: apiGroups[0].name }));
      }
    }
  }, [groupsResponse, formData.group_name]);

  const groupOptions = React.useMemo(() => {
    if (!groupsResponse) return [];
    const apiGroups = Array.isArray(groupsResponse) ? groupsResponse : (groupsResponse.answer || []);
    return apiGroups.map(g => ({ label: g.name, value: g.name }));
  }, [groupsResponse]);

  const handleChange = (field, value) => {
    let parsedValue = value;
    if (field === 'fee_per_lot') parsedValue = parseFloat(value) || 0;
    if (field === 'max_holding_days') parsedValue = parseInt(value, 10) || 0;
    
    setFormData(prev => ({ ...prev, [field]: parsedValue }));
  };

  const handleCheckboxChange = (field, checked) => {
    setFormData(prev => ({ ...prev, [field]: checked }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      if (!formData.group_name) {
         throw new Error("Please select a valid group name.");
      }

      await ManagerService.setSwapFreeGroup(formData);
      onCreated();
      onClose();
    } catch (err) {
      alert("Failed to add swap-free configuration: " + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[9998]" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none">
        <div className="w-[450px] bg-[#1e1e1e] border border-black shadow-2xl flex flex-col pointer-events-auto rounded-[2px] overflow-hidden">
          
          {/* Header */}
          <div className="h-8 bg-[#323233] flex items-center px-3 justify-between select-none">
            <span className="text-[12px] font-medium text-[#cccccc]">Add Swap-Free Configuration</span>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-sm text-[#808080] hover:text-white transition-colors">
              <X size={14} />
            </button>
          </div>

          {/* Form Content */}
          <div className="p-6 pb-2 border-b border-black/40">
            <SelectField 
              label="Group Name:" 
              value={formData.group_name} 
              onChange={e => handleChange('group_name', e.target.value)} 
              options={groupOptions} 
              loading={groupsLoading} 
            />
            
            <InputField 
              label="Symbol Pattern:" 
              value={formData.symbol_pattern} 
              onChange={e => handleChange('symbol_pattern', e.target.value)} 
            />
            
            <div className="h-2"></div>
            
            <CheckboxField 
              label="Swap Free Enabled" 
              checked={formData.swap_free} 
              onChange={e => handleCheckboxChange('swap_free', e.target.checked)} 
            />
            
            <CheckboxField 
              label="Charge Fee Instead" 
              checked={formData.charge_fee} 
              onChange={e => handleCheckboxChange('charge_fee', e.target.checked)} 
            />
            
            <div className="h-2"></div>

            <InputField 
              label="Fee Per Lot:" 
              type="number"
              value={formData.fee_per_lot} 
              onChange={e => handleChange('fee_per_lot', e.target.value)} 
            />

            <InputField 
              label="Max Holding Days (0 = ∞):" 
              type="number"
              value={formData.max_holding_days} 
              onChange={e => handleChange('max_holding_days', e.target.value)} 
            />
          </div>

          {/* Footer Actions */}
          <div className="p-3 bg-[#252526] flex justify-end gap-2">
            <button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className={`px-6 py-1 bg-[#007acc] hover:bg-[#0098ff] text-white text-[11px] rounded-sm transition-colors ${isSubmitting ? 'opacity-50 pointer-events-none' : ''}`}
            >
              OK
            </button>
            <button 
              onClick={onClose}
              className="px-4 py-1 bg-[#333333] hover:bg-[#444] border border-[#555] text-white text-[11px] rounded-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AddSwapFreeGroupPopup;
