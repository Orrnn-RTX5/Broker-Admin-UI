import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Clock, AlertCircle } from 'lucide-react';
import { ManagerService } from '../../services/manager.service';

const MotionDiv = motion.div;

const DAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

// Called after existing overrides are loaded appends one row and re-saves the full set

const CreateSessionOverridePopup = ({ symbol, group, existingOverrides = [], onClose, onCreated }) => {
  const [formData, setFormData] = useState({
    day_of_week: 1,
    quote_from: '08:00',
    quote_to: '17:00',
    trade_from: '08:00',
    trade_to: '17:00',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const newEntry = {
        day_of_week: Number(formData.day_of_week),
        quote_from: formData.quote_from,
        quote_to: formData.quote_to,
        trade_from: formData.trade_from,
        trade_to: formData.trade_to,
      };

      // API replaces ALL overrides for symbol+group — we append to existing ones
      const cleanedExisting = existingOverrides.map(o => ({
        day_of_week: o.day_of_week,
        quote_from: o.quote_from,
        quote_to: o.quote_to,
        trade_from: o.trade_from,
        trade_to: o.trade_to,
      }));

      await ManagerService.setSessionOverrides(symbol, group, [...cleanedExisting, newEntry]);
      if (onCreated) onCreated();
      onClose();
      
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to create session override');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
      <MotionDiv
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-[420px] bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] shadow-2xl flex flex-col font-sans rounded-md overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 bg-[color:var(--bg-surface-1)] border-b border-[color:var(--border-default)] select-none">
          <div className="flex items-center gap-2 text-[color:var(--text-primary)] text-[13px] font-medium">
            <Clock size={16} className="text-[color:var(--text-secondary)]" />
            Add Session Override
          </div>
          <button onClick={onClose} className="text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] hover:bg-white/10 p-1 rounded-sm transition-colors">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4 text-[12px] bg-[color:var(--bg-app)]">
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 p-3 rounded-sm text-red-400">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span className="leading-tight">{error}</span>
            </div>
          )}

          <div className="flex gap-4 text-[11px] text-[color:var(--text-secondary)] bg-[color:var(--bg-surface-1)] border border-[color:var(--border-subtle)] px-3 py-2 rounded-sm">
            <span>Symbol: <strong className="text-[color:var(--text-primary)]">{symbol}</strong></span>
            <span>Group: <strong className="text-[color:var(--text-primary)]">{group}</strong></span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[color:var(--text-secondary)]">Day of Week</label>
            <select name="day_of_week" value={formData.day_of_week} onChange={handleChange}
              className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors">
              {DAY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[color:var(--text-secondary)]">Quote From</label>
              <input type="time" name="quote_from" value={formData.quote_from} onChange={handleChange}
                className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors [color-scheme:inherit]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[color:var(--text-secondary)]">Quote To</label>
              <input type="time" name="quote_to" value={formData.quote_to} onChange={handleChange}
                className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors [color-scheme:inherit]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[color:var(--text-secondary)]">Trade From</label>
              <input type="time" name="trade_from" value={formData.trade_from} onChange={handleChange}
                className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors [color-scheme:inherit]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[color:var(--text-secondary)]">Trade To</label>
              <input type="time" name="trade_to" value={formData.trade_to} onChange={handleChange}
                className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors [color-scheme:inherit]" />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-[color:var(--border-default)]">
            <button type="button" onClick={onClose} disabled={isSubmitting}
              className="px-4 py-1.5 bg-[#444] hover:bg-[#555] text-white rounded-[2px] transition-colors disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={isSubmitting}
              className="px-4 py-1.5 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white rounded-[2px] transition-colors disabled:opacity-50 min-w-[70px] flex justify-center">
              {isSubmitting ? '...' : 'Add'}
            </button>
          </div>
        </form>
      </MotionDiv>
    </div>
  );
};

export default CreateSessionOverridePopup;
