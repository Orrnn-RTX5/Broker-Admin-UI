import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Activity, AlertCircle } from 'lucide-react';
import { ManagerService } from '../../services/manager.service';
import LpSymbolDatalist from '../atoms/LpSymbolDatalist';

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

const CreateSpreadSchedulePopup = ({ onClose, onCreated }) => {
  const [formData, setFormData] = useState({
    symbol: '',
    group_name: 'default',
    day_of_week: 1,
    time_from: '08:00',
    time_to: '17:00',
    spread_override: 20
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
      await ManagerService.createSpreadSchedule({
        ...formData,
        day_of_week: Number(formData.day_of_week),
        spread_override: Number(formData.spread_override)
      });
      if (onCreated) onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to create spread schedule');
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
          <div className="flex items-center gap-2 text-white text-[13px] font-medium">
            <Activity size={16} className="text-white" />
            Create Spread Schedule
          </div>
          <button onClick={onClose} className="text-white hover:text-white hover:bg-white/10 p-1 rounded-sm transition-colors">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[color:var(--text-secondary)]">Symbol</label>
              <input type="text" name="symbol" value={formData.symbol} onChange={handleChange} required
                list="spread-schedule-symbol-options" autoComplete="off" placeholder="e.g. EURUSD"
                className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors" />
              <LpSymbolDatalist id="spread-schedule-symbol-options" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[color:var(--text-secondary)]">Group Name</label>
              <input type="text" name="group_name" value={formData.group_name} onChange={handleChange}
                className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors" />
            </div>
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
              <label className="text-[color:var(--text-secondary)]">Time From</label>
              <input type="time" name="time_from" value={formData.time_from} onChange={handleChange}
                className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors [color-scheme:dark]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[color:var(--text-secondary)]">Time To</label>
              <input type="time" name="time_to" value={formData.time_to} onChange={handleChange}
                className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors [color-scheme:dark]" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[color:var(--text-secondary)]">Spread Override (pts)</label>
            <input type="number" name="spread_override" value={formData.spread_override} onChange={handleChange} min="0" step="1"
              className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors" />
          </div>

          <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-[color:var(--border-default)]">
            <button type="button" onClick={onClose} disabled={isSubmitting}
              className="px-4 py-1.5 bg-[#444] hover:bg-[#555] text-white rounded-[2px] transition-colors disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={isSubmitting}
              className="px-4 py-1.5 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white rounded-[2px] transition-colors disabled:opacity-50 min-w-[70px] flex justify-center">
              {isSubmitting ? '...' : 'Create'}
            </button>
          </div>
        </form>
      </MotionDiv>
    </div>
  );
};

export default CreateSpreadSchedulePopup;
