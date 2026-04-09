import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Calendar, AlertCircle } from 'lucide-react';
import { ManagerService } from '../../services/manager.service';

const CreateHolidayPopup = ({ onClose, onCreated }) => {
  const [formData, setFormData] = useState({
    date: '2026-12-25',
    name: 'Christmas Day',
    symbols: 'EURUSD, GBPUSD',
    trading_allowed: false
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        date: formData.date,
        name: formData.name,
        symbols: formData.symbols.split(',').map(s => s.trim()).filter(s => s),
        trading_allowed: formData.trading_allowed
      };

      await ManagerService.createHoliday(payload);
      if (onCreated) onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create holiday');
    } finally {
      setIsSubmitting(false);
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
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-[400px] bg-[#252526] border border-[#3e3e42] shadow-2xl flex flex-col font-sans rounded-md overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#2d2d30] border-b border-[#3e3e42] select-none">
          <div className="flex items-center gap-2 text-white text-[13px] font-medium">
            <Calendar size={16} className="text-[#3b82f6]" />
            Create Holiday
          </div>
          <button
            onClick={onClose}
            className="text-[#999] hover:text-white hover:bg-white/10 p-1 rounded-sm transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4 text-[12px] bg-[#1e1e1e]">
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 p-3 rounded-sm text-red-400">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span className="leading-tight">{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[#cccccc]">Holiday Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="e.g. Christmas Day"
                className="bg-[#3c3f41] border border-[#555] text-white px-2 py-1.5 focus:border-[#007acc] focus:outline-none rounded-sm transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[#cccccc]">Date</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                className="bg-[#3c3f41] border border-[#555] text-white px-2 py-1.5 focus:border-[#007acc] focus:outline-none rounded-sm transition-colors [color-scheme:dark]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[#cccccc]">Symbols (comma separated)</label>
              <input
                type="text"
                name="symbols"
                value={formData.symbols}
                onChange={handleChange}
                placeholder="EURUSD, GBPUSD"
                className="bg-[#3c3f41] border border-[#555] text-white px-2 py-1.5 focus:border-[#007acc] focus:outline-none rounded-sm transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="trading_allowed"
                name="trading_allowed"
                checked={formData.trading_allowed}
                onChange={handleChange}
                className="w-[13px] h-[13px] accent-[#007acc]"
              />
              <label htmlFor="trading_allowed" className="text-[#cccccc] cursor-pointer">
                Trading Allowed
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-[#3e3e42]">
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
              className="px-4 py-1.5 bg-[#007acc] hover:bg-[#0098ff] text-white rounded-[2px] transition-colors disabled:opacity-50 min-w-[70px] flex justify-center"
            >
              {isSubmitting ? '...' : 'Create'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default CreateHolidayPopup;
