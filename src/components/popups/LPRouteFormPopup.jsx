import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, GitBranch, AlertCircle } from 'lucide-react';
import { RoutingService } from '../../services/routing.service';

const ROUTING_MODES = [
  { value: 'a_book', label: 'A-Book (External LP)' },
  { value: 'hybrid', label: 'Hybrid (Mixed)' },
];

const FALLBACK_POLICIES = [
  { value: 'best_available', label: 'Best Available' },
  { value: 'b_book', label: 'B-Book (Internal)' },
  { value: 'reject', label: 'Reject Order' },
];

const DEFAULT = {
  group_name: '',
  symbol_pattern: '',
  routing_mode: 'a_book',
  lp_name: '',
  priority: 100,
  enabled: true,
  fallback_policy: 'best_available',
  max_volume: 10.0,
};

const inputCls =
  'bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors w-full text-[12px]';
const selectCls =
  'bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors w-full text-[12px] cursor-pointer';

const Field = ({ label, hint, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[color:var(--text-secondary)] text-[11px]">
      {label}
      {hint && <span className="text-[#555] ml-1.5 text-[10px]">{hint}</span>}
    </label>
    {children}
  </div>
);

const LPRouteFormPopup = ({ initialData, onClose, onSaved }) => {
  const isEdit = !!initialData;

  const [form, setForm] = useState(() =>
    isEdit
      ? {
          group_name:      initialData.group_name      ?? '',
          symbol_pattern:  initialData.symbol_pattern  ?? '',
          routing_mode:    initialData.routing_mode     ?? 'a_book',
          lp_name:         initialData.lp_name          ?? '',
          priority:        initialData.priority         ?? 100,
          enabled:         initialData.enabled          ?? true,
          fallback_policy: initialData.fallback_policy  ?? 'best_available',
          max_volume:      initialData.max_volume        ?? 10.0,
        }
      : { ...DEFAULT }
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.group_name.trim())     { setError('Group name is required.');            return; }
    if (!form.symbol_pattern.trim()) { setError('Symbol pattern is required (use * for all).'); return; }
    if (!form.lp_name.trim())        { setError('LP name is required.');               return; }

    setSubmitting(true);
    setError(null);
    try {
      const payload = { ...form, priority: Number(form.priority), max_volume: Number(form.max_volume) };
      if (isEdit) {
        await RoutingService.updateRoute({ id: initialData.id, ...payload });
      } else {
        await RoutingService.createRoute(payload);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-[520px] bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] shadow-2xl flex flex-col font-sans rounded-md overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[color:var(--bg-surface-1)] border-b border-[color:var(--border-default)] select-none">
          <div className="flex items-center gap-2 text-white text-[13px] font-medium">
            <GitBranch size={15} className="text-[#3b82f6]" />
            {isEdit
              ? `Edit Route — ${initialData.group_name} / ${initialData.symbol_pattern}`
              : 'Create LP Routing Rule'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#999] hover:text-white hover:bg-white/10 p-1 rounded-sm transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4 text-[12px] bg-[color:var(--bg-app)]">
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 p-3 rounded-sm text-red-400">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span className="leading-tight">{error}</span>
            </div>
          )}

          {/* Identification */}
          <div className="flex flex-col gap-2.5 pb-3 border-b border-[#333]">
            <p className="text-[10px] uppercase tracking-widest text-[#555] font-semibold">Route Identification</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Group Name" hint="*required">
                <input
                  className={inputCls + (isEdit ? ' opacity-50 cursor-not-allowed' : '')}
                  value={form.group_name}
                  onChange={(e) => set('group_name', e.target.value)}
                  placeholder="retail"
                  disabled={isEdit}
                />
              </Field>
              <Field label="Symbol Pattern" hint="* = all">
                <input
                  className={inputCls}
                  value={form.symbol_pattern}
                  onChange={(e) => set('symbol_pattern', e.target.value)}
                  placeholder="EURUSD"
                />
              </Field>
              <Field label="LP Name" hint="*required">
                <input
                  className={inputCls}
                  value={form.lp_name}
                  onChange={(e) => set('lp_name', e.target.value)}
                  placeholder="T4B"
                />
              </Field>
            </div>
          </div>

          {/* Execution */}
          <div className="flex flex-col gap-2.5">
            <p className="text-[10px] uppercase tracking-widest text-[#555] font-semibold">Execution Settings</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Routing Mode">
                <select className={selectCls} value={form.routing_mode} onChange={(e) => set('routing_mode', e.target.value)}>
                  {ROUTING_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </Field>
              <Field label="Fallback Policy">
                <select className={selectCls} value={form.fallback_policy} onChange={(e) => set('fallback_policy', e.target.value)}>
                  {FALLBACK_POLICIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </Field>
              <Field label="Priority" hint="lower = higher">
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  value={form.priority}
                  onChange={(e) => set('priority', e.target.value)}
                />
              </Field>
              <Field label="Max Volume (lots)" hint="0 = unlimited">
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.max_volume}
                  onChange={(e) => set('max_volume', e.target.value)}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2.5 mt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => set('enabled', e.target.checked)}
                className="w-3.5 h-3.5 accent-blue-500"
              />
              <span className="text-[color:var(--text-secondary)]">Route Enabled</span>
            </label>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--border-default)]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-1.5 bg-[#444] hover:bg-[#555] text-white rounded-[2px] transition-colors disabled:opacity-50 text-[12px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 bg-[color:var(--accent-500)] hover:opacity-90 text-white rounded-[2px] transition-colors disabled:opacity-50 min-w-[90px] flex justify-center text-[12px]"
            >
              {submitting ? '…' : isEdit ? 'Update Route' : 'Create Route'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default LPRouteFormPopup;
