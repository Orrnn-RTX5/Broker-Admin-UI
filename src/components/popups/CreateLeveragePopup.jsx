import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Hash, AlertCircle } from 'lucide-react';
import { ManagerService } from '../../services/manager.service';
import { buildDynamicLeveragePayload } from '../../utils/adminValidation';
import LpSymbolDatalist from '../atoms/LpSymbolDatalist';

const MotionDiv = motion.div;

const CreateLeveragePopup = ({ onClose, onCreated }) => {
  const [formData, setFormData] = useState({
    group_name: 'std_ecn',
    leverage: 500,
    margin_rate: 0.002,
    priority: 1,
    symbol: '',
    volume_from: 0,
    volume_to: 10
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = buildDynamicLeveragePayload(formData);

      await ManagerService.createDynamicLeverage(payload);
      if (onCreated) onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create leverage rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
      <MotionDiv
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-[450px] bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] shadow-2xl flex flex-col font-sans rounded-md overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[color:var(--bg-surface-1)] border-b border-[color:var(--border-default)] select-none">
          <div className="flex items-center gap-2 text-white text-[13px] font-medium">
            <Hash size={16} className="text-[#3b82f6]" />
            Create Dynamic Leverage
          </div>
          <button
            onClick={onClose}
            className="text-[#999] hover:text-white hover:bg-white/10 p-1 rounded-sm transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4 text-[12px] bg-[color:var(--bg-app)]">
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 p-3 rounded-sm text-red-400">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span className="leading-tight">{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {/* Group Name & Symbol */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[color:var(--text-secondary)]">Group Name</label>
                <input
                  type="text"
                  name="group_name"
                  value={formData.group_name}
                  onChange={handleChange}
                  required
                  placeholder="e.g. std_ecn"
                  className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[color:var(--text-secondary)]">Symbol Pattern</label>
                <input
                  type="text"
                  name="symbol"
                  value={formData.symbol}
                  onChange={handleChange}
                  required
                  list="dynamic-leverage-symbol-options"
                  autoComplete="off"
                  placeholder="e.g. EURUSD"
                  className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors"
                />
                <LpSymbolDatalist id="dynamic-leverage-symbol-options" />
              </div>
            </div>

            {/* Leverage & Margin Rate */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[color:var(--text-secondary)]">Leverage (1:X)</label>
                <input
                  type="number"
                  name="leverage"
                  value={formData.leverage}
                  onChange={handleChange}
                  required
                  min="1"
                  className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[color:var(--text-secondary)]">Margin Rate</label>
                <input
                  type="number"
                  name="margin_rate"
                  value={formData.margin_rate}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.001"
                  className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors"
                />
              </div>
            </div>

            {/* Priority & Volume Range */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[color:var(--text-secondary)]">Priority</label>
                <input
                  type="number"
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  required
                  min="0"
                  className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[color:var(--text-secondary)]">Vol From</label>
                <input
                  type="number"
                  name="volume_from"
                  value={formData.volume_from}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[color:var(--text-secondary)]">Vol To</label>
                <input
                  type="number"
                  name="volume_to"
                  value={formData.volume_to}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-[color:var(--border-default)]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-[#444] hover:bg-[#555] text-white rounded-[2px] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white rounded-[2px] transition-colors disabled:opacity-50 min-w-[70px] flex justify-center"
            >
              {isSubmitting ? '...' : 'Create'}
            </button>
          </div>
        </form>
      </MotionDiv>
    </div>
  );
};

export default CreateLeveragePopup;
