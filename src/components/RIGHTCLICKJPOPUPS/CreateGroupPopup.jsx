import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { ManagerService } from '../../services/manager.service';

const CreateGroupPopup = ({ onClose, onCreated, initialData }) => {
  const [formData, setFormData] = useState(() => {
    if (initialData) {
      return {
        ...initialData,
        symbolsAllowed: Array.isArray(initialData.symbolsAllowed) ? initialData.symbolsAllowed.join(', ') : (initialData.symbolsAllowed || ''),
        symbolsBlocked: Array.isArray(initialData.symbolsBlocked) ? initialData.symbolsBlocked.join(', ') : (initialData.symbolsBlocked || ''),
      };
    }
    return {
      name: '',
      description: '',
      accountType: 'standard',
      bookType: 'b',
      commissionRate: 0,
      commissionType: 'per_lot',
      currency: 'USD',
      demo: false,
      executionMode: 'market',
      leverage: 100,
      lotDivisor: 1,
      marginCallLevel: 100,
      maxLotPerTrade: 100,
      maxTotalLots: 500,
      negativeBalanceProtection: true,
      spreadMarkup: 0,
      stopOutLevel: 50,
      swapMultiplier: 1,
      symbolsAllowed: '',
      symbolsBlocked: '',
      tradeAllowed: true
    };
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!formData.name) {
      setError('Group Name refers to name field and is required.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const payload = {
        ...formData,
        commissionRate: Number(formData.commissionRate),
        leverage: Number(formData.leverage),
        lotDivisor: Number(formData.lotDivisor),
        marginCallLevel: Number(formData.marginCallLevel),
        maxLotPerTrade: Number(formData.maxLotPerTrade),
        maxTotalLots: Number(formData.maxTotalLots),
        spreadMarkup: Number(formData.spreadMarkup),
        stopOutLevel: Number(formData.stopOutLevel),
        swapMultiplier: Number(formData.swapMultiplier),
        symbolsAllowed: formData.symbolsAllowed ? formData.symbolsAllowed.split(',').map(s => s.trim()).filter(Boolean) : [],
        symbolsBlocked: formData.symbolsBlocked ? formData.symbolsBlocked.split(',').map(s => s.trim()).filter(Boolean) : [],
      };

      if (initialData) {
        await ManagerService.updateGroup(payload);
      } else {
        await ManagerService.createGroup(payload);
      }
      if (onCreated) onCreated();
      onClose();
    } catch (err) {
      setError(err.message || 'Error creating group');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        className="w-[600px] bg-[#1e1e1e] border border-[#444444] rounded-[6px] shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
      >
        <div className="flex justify-between items-center h-8 bg-[#1e1e1e] px-3 border-b border-white/5 select-none shrink-0">
          <div className="text-[12px] text-[#e1e1e1]">{initialData ? 'Update Group' : 'Create Group'}</div>
          <button onClick={onClose} className="w-[28px] h-[20px] flex items-center justify-center hover:bg-red-500 hover:text-white text-[#aaaaaa] transition-colors rounded-tr-[4px]">
            <X size={12} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4 text-[#cccccc] overflow-y-auto no-scrollbar">
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            {/* Left Column */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <label className="text-[12px] w-28 shrink-0 text-right">Name:</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} disabled={!!initialData} className="flex-1 bg-[#1e1e1e] border border-[#555555] px-2 py-1 text-[12px] text-white focus:border-blue-500 rounded-sm disabled:opacity-50" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[12px] w-28 shrink-0 text-right">Description:</label>
                <input type="text" name="description" value={formData.description} onChange={handleChange} className="flex-1 bg-[#1e1e1e] border border-[#555555] px-2 py-1 text-[12px] text-white focus:border-blue-500 rounded-sm" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[12px] w-28 shrink-0 text-right">Currency:</label>
                <input type="text" name="currency" value={formData.currency} onChange={handleChange} className="flex-1 bg-[#1e1e1e] border border-[#555555] px-2 py-1 text-[12px] text-white focus:border-blue-500 rounded-sm" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[12px] w-28 shrink-0 text-right">Account Type:</label>
                <select name="accountType" value={formData.accountType} onChange={handleChange} className="flex-1 bg-[#252526] border border-[#555555] px-2 py-1 text-[12px] text-white focus:border-blue-500 rounded-sm">
                  <option value="standard">Standard</option>
                  <option value="cent">Cent</option>
                  <option value="micro">Micro</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[12px] w-28 shrink-0 text-right">Book Type:</label>
                <select name="bookType" value={formData.bookType} onChange={handleChange} className="flex-1 bg-[#252526] border border-[#555555] px-2 py-1 text-[12px] text-white focus:border-blue-500 rounded-sm">
                  <option value="b">B-Book</option>
                  <option value="a">A-Book</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[12px] w-28 shrink-0 text-right">Leverage (1:x):</label>
                <input type="number" name="leverage" value={formData.leverage} onChange={handleChange} className="flex-1 bg-[#1e1e1e] border border-[#555555] px-2 py-1 text-[12px] text-white focus:border-blue-500 rounded-sm" />
              </div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <label className="text-[12px] w-28 shrink-0 text-right">Margin Call %:</label>
                <input type="number" name="marginCallLevel" value={formData.marginCallLevel} onChange={handleChange} className="flex-1 bg-[#1e1e1e] border border-[#555555] px-2 py-1 text-[12px] text-white focus:border-blue-500 rounded-sm" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[12px] w-28 shrink-0 text-right">Stop Out %:</label>
                <input type="number" name="stopOutLevel" value={formData.stopOutLevel} onChange={handleChange} className="flex-1 bg-[#1e1e1e] border border-[#555555] px-2 py-1 text-[12px] text-white focus:border-blue-500 rounded-sm" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[12px] w-28 shrink-0 text-right">Spread Markup:</label>
                <input type="number" name="spreadMarkup" value={formData.spreadMarkup} onChange={handleChange} className="flex-1 bg-[#1e1e1e] border border-[#555555] px-2 py-1 text-[12px] text-white focus:border-blue-500 rounded-sm" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[12px] w-28 shrink-0 text-right">Comm. Rate:</label>
                <input type="number" name="commissionRate" value={formData.commissionRate} onChange={handleChange} className="flex-1 bg-[#1e1e1e] border border-[#555555] px-2 py-1 text-[12px] text-white focus:border-blue-500 rounded-sm" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[12px] w-28 shrink-0 text-right">Comm. Type:</label>
                <select name="commissionType" value={formData.commissionType} onChange={handleChange} className="flex-1 bg-[#252526] border border-[#555555] px-2 py-1 text-[12px] text-white focus:border-blue-500 rounded-sm">
                  <option value="per_lot">Per Lot</option>
                  <option value="standard">Standard</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[12px] w-28 shrink-0 text-right">Execution:</label>
                <select name="executionMode" value={formData.executionMode} onChange={handleChange} className="flex-1 bg-[#252526] border border-[#555555] px-2 py-1 text-[12px] text-white focus:border-blue-500 rounded-sm">
                  <option value="market">Market</option>
                  <option value="instant">Instant</option>
                </select>
              </div>
            </div>
          </div>
          
          <hr className="border-[#3e3e42] my-1" />
          
          <div className="flex items-center gap-3">
            <label className="text-[12px] w-28 shrink-0 text-right">Allowed Symbols:</label>
            <input type="text" name="symbolsAllowed" value={formData.symbolsAllowed} onChange={handleChange} placeholder="EURUSD, GBPUSD" className="flex-1 bg-[#1e1e1e] border border-[#555555] px-2 py-1 text-[12px] text-white focus:border-blue-500 rounded-sm" />
          </div>

          <div className="grid grid-cols-3 gap-2 px-10 mt-2">
             <label className="flex items-center gap-2 cursor-pointer">
               <input type="checkbox" name="demo" checked={formData.demo} onChange={handleChange} className="accent-blue-500 w-3 h-3" />
               <span className="text-[11px]">Demo Account</span>
             </label>
             <label className="flex items-center gap-2 cursor-pointer">
               <input type="checkbox" name="tradeAllowed" checked={formData.tradeAllowed} onChange={handleChange} className="accent-blue-500 w-3 h-3" />
               <span className="text-[11px]">Trade Allowed</span>
             </label>
             <label className="flex items-center gap-2 cursor-pointer">
               <input type="checkbox" name="negativeBalanceProtection" checked={formData.negativeBalanceProtection} onChange={handleChange} className="accent-blue-500 w-3 h-3" />
               <span className="text-[11px]">Neg. Bal. Protect</span>
             </label>
          </div>

          {error && <div className="text-red-400 text-[11px] text-center mt-2">{error}</div>}
        </div>

        <div className="px-4 py-3 bg-[#1e1e1e] flex justify-end gap-2 border-t border-white/5 select-none shrink-0">
          <button 
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-6 h-[24px] bg-[#007acc] text-white border border-transparent rounded text-[12px] hover:bg-[#0098ff] transition-all disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Save'}
          </button>
          <button 
            onClick={onClose}
            className="px-6 h-[24px] bg-transparent border border-[#555555] rounded text-[12px] text-white hover:bg-white/10 hover:border-[#777777] transition-all"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default CreateGroupPopup;
