import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, GitBranch, AlertCircle, Plus, Trash2, Loader2 } from 'lucide-react';
import { RoutingService } from '../../services/routing.service';
import { ManagerService } from '../../services/manager.service';
import { gatewayGetRoutingOptions } from '../../services/gateway.service';

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

  // Processing Rule fields
  rule_symbols: '*',
  rule_logins: '*',
  rule_bbi_pools: '',
  rule_groups: '*',
  rule_min_volume: 0,
  rule_max_volume: 1000000000,
  rule_security: '*',
  rule_order_types: 'All',
  rule_order_directions: 'All',
  rule_round_type: "Trader's worst",
  rule_fok_with_ce: false,
  rule_execute_limits: false,
  rule_compensate_slippage: false,
  rule_enabled: true,

  // Markup fields
  markup_mode: 'Standard',
  markup_take_positive: true,
  markup_send_lp_min: 100,
  markup_send_lp_max: 100,
  markup_min_market: 30,
  markup_max_market: 30,
  markup_min_limit: 30,
  markup_max_limit: 30,
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

const DispatchDelaySection = () => {
  const [delayMs, setDelayMs] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchDelay = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ManagerService.getLPDispatchDelay();
      if (res && res.dispatch_delay_ms !== undefined) {
        setDelayMs(res.dispatch_delay_ms.toString());
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch delay');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDelay();
  }, [fetchDelay]);

  const handleSave = async () => {
    if (delayMs === '') return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await ManagerService.setLPDispatchDelay(delayMs);
      setSuccess('Delay updated successfully');
      setTimeout(() => setSuccess(''), 3000);
      await fetchDelay();
    } catch (err) {
      setError(err.message || 'Failed to set delay');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 border border-black/20 rounded-md p-4 bg-[color:var(--bg-surface-2)]">
      <div>
        <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">Dispatch Delay</h3>
        <p className="text-[11px] text-[color:var(--text-muted)] mt-0.5">Configure the global LP dispatch delay.</p>
      </div>
      
      {loading ? (
        <div className="py-4 flex justify-center"><Loader2 size={14} className="animate-spin text-gray-400" /></div>
      ) : (
        <div className="flex flex-col gap-2 mt-2">
          {error && <div className="text-red-400 text-[11px]">{error}</div>}
          {success && <div className="text-green-400 text-[11px]">{success}</div>}
          
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Field label="Delay (ms)">
                <input
                  className={inputCls + " font-mono"}
                  type="number"
                  min="0"
                  step="1"
                  value={delayMs}
                  onChange={(e) => setDelayMs(e.target.value)}
                  placeholder="e.g. 250"
                />
              </Field>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || delayMs === ''}
              className="bg-[color:var(--accent-500)] hover:opacity-90 text-white px-4 py-1.5 rounded-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1 min-w-[80px] h-[30px] text-[11px]"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


const HiddenMarkupSection = ({ initialGroup, groups }) => {
  const [selectedGroup, setSelectedGroup] = useState(initialGroup || '');
  const [markups, setMarkups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  
  const [newAcc, setNewAcc] = useState('*');
  const [newMarkup, setNewMarkup] = useState('0.00000');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (initialGroup && !selectedGroup) setSelectedGroup(initialGroup);
  }, [initialGroup]);

  const fetchMarkups = useCallback(async () => {
    if (!selectedGroup) {
      setMarkups([]);
      return;
    }
    setLoading(true);
    try {
      const res = await ManagerService.getHiddenMarkupList();
      const filtered = (res || []).filter(m => m.group_name === selectedGroup);
      setMarkups(filtered);
      setErr('');
    } catch (e) {
      setErr(e.message || 'Failed to fetch markups');
    } finally {
      setLoading(false);
    }
  }, [selectedGroup]);

  useEffect(() => {
    fetchMarkups();
  }, [fetchMarkups]);

  const handleAdd = async () => {
    if (!selectedGroup) return alert('Select a group name first');
    if (!newAcc || !newMarkup) return;
    setAdding(true);
    try {
      await ManagerService.setHiddenMarkup({
        group_name: selectedGroup,
        account_number: newAcc,
        hidden_markup: parseFloat(newMarkup)
      });
      setNewAcc('*');
      setNewMarkup('0.00000');
      fetchMarkups();
    } catch (e) {
      alert(e.message || 'Failed to add markup');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (acc) => {
    try {
      await ManagerService.deleteHiddenMarkup(selectedGroup, acc);
      fetchMarkups();
    } catch (e) {
      alert(e.message || 'Failed to delete markup');
    }
  };

  return (
    <div className="flex flex-col gap-3 border border-black/20 rounded-md p-4 bg-[color:var(--bg-surface-2)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">Hidden Markups</h3>
          <p className="text-[11px] text-[color:var(--text-muted)] mt-0.5">Configure hidden markups for the entire group (*) or specific accounts.</p>
        </div>
        <select
          className="bg-[color:var(--bg-surface-1)] border border-[#555] text-white px-2 py-1 focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors text-[11px] min-w-[150px] cursor-pointer"
          value={selectedGroup}
          onChange={e => setSelectedGroup(e.target.value)}
        >
          <option value="">-- Select Group --</option>
          {(groups || []).map(g => {
            const groupName = typeof g === 'object' ? g.name : g;
            return <option key={groupName} value={groupName}>{groupName}</option>;
          })}
        </select>
      </div>
      
      {!selectedGroup ? (
        <div className="py-6 text-center text-[11px] text-[color:var(--text-muted)] italic">
          Select a group from the dropdown to manage its hidden markups.
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="flex flex-col gap-1 mt-1">
        <div className="grid grid-cols-[1fr_1fr_40px] px-2 py-1.5 bg-black/10 rounded-sm text-[10px] font-bold uppercase text-[color:var(--text-muted)]">
          <div>Account</div>
          <div>Markup</div>
          <div></div>
        </div>
        {loading ? (
          <div className="py-4 flex justify-center"><Loader2 size={14} className="animate-spin text-gray-400" /></div>
        ) : err ? (
          <div className="py-2 text-red-400">{err}</div>
        ) : markups.length === 0 ? (
          <div className="py-3 text-center text-[11px] text-[color:var(--text-muted)] italic">No hidden markups found</div>
        ) : (
          markups.map(m => (
            <div key={m.id || m.account_number} className="grid grid-cols-[1fr_1fr_40px] px-2 py-1.5 items-center border-b border-black/10 last:border-0 hover:bg-black/5">
              <div className="font-mono text-[11px] text-white">{m.account_number}</div>
              <div className="font-mono text-[11px] text-[color:var(--accent-400)]">{m.hidden_markup}</div>
              <button
                type="button"
                onClick={() => handleDelete(m.account_number)}
                className="text-red-400 hover:text-red-300 p-1 flex justify-center"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add Form */}
      <div className="flex items-center gap-2 mt-2 pt-3 border-t border-black/10">
        <div className="flex-1">
          <input 
            className="bg-[color:var(--bg-surface-1)] border border-[#555] text-white px-2 py-1.5 focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors w-full font-mono text-[11px]"
            value={newAcc}
            onChange={e => setNewAcc(e.target.value)}
            placeholder="Account (* for all)"
          />
        </div>
        <div className="flex-1">
          <input 
            className="bg-[color:var(--bg-surface-1)] border border-[#555] text-white px-2 py-1.5 focus:border-[color:var(--accent-500)] focus:outline-none rounded-sm transition-colors w-full font-mono text-[11px]"
            type="number"
            step="0.00001"
            min="0"
            value={newMarkup}
            onChange={e => setNewMarkup(e.target.value)}
            placeholder="Markup (e.g. 0.0005)"
          />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding}
          className="bg-[color:var(--accent-500)] hover:opacity-90 text-white px-3 py-1.5 rounded-sm transition-colors disabled:opacity-50 flex items-center gap-1 shrink-0 text-[11px]"
        >
          {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add
        </button>
      </div>
        </>
      )}
    </div>
  );
};

const LPRouteFormPopup = ({ initialData, onClose, onSaved }) => {
  const isEdit = !!initialData;

  const [form, setForm] = useState(() =>
    isEdit ? { ...DEFAULT, ...initialData } : { ...DEFAULT }
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [groups, setGroups] = useState([]);
  const [lpOptions, setLpOptions] = useState([]);
  const [activeTab, setActiveTab] = useState('basic');

  useEffect(() => {
    ManagerService.getGroupList()
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.answer ?? []);
        setGroups(list);
      })
      .catch(() => {});

    gatewayGetRoutingOptions()
      .then(res => {
        setLpOptions(res.items || []);
      })
      .catch(() => {});
  }, []);

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
    <div className="fixed inset-0 z-[9999] bg-black/50 flex justify-end">
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-[750px] h-full bg-[color:var(--bg-surface-1)] border-l border-[color:var(--border-default)] shadow-2xl flex flex-col font-sans"
      >
        {/* Header */}
        <div className="flex flex-col bg-[color:var(--bg-surface-1)] border-b border-[color:var(--border-default)] select-none shrink-0">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2 text-white text-[15px] font-medium">
              <GitBranch size={16} className="text-[#3b82f6]" />
              {isEdit
                ? `Edit Route — ${initialData.group_name} / ${initialData.symbol_pattern}`
                : 'Create LP Routing Rule'}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[#999] hover:text-white hover:bg-[color:var(--bg-surface-2)] p-1.5 rounded-sm transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex items-center px-5 gap-6 border-t border-black/20 bg-[color:var(--bg-surface-2)]">
            {[
              { id: 'basic', label: 'Basic Config' },
              { id: 'rules', label: 'Processing Rules' },
              { id: 'markups', label: 'Markups & Slippage' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 text-[12px] font-medium transition-colors border-b-[3px] ${
                  activeTab === tab.id 
                    ? 'border-[color:var(--accent-500)] text-[color:var(--accent-500)]' 
                    : 'border-transparent text-[color:var(--text-muted)] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden bg-[color:var(--bg-app)] text-[12px]">
          <div className="flex-1 overflow-y-auto no-scrollbar p-5 flex flex-col gap-6">
            {error && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 p-3 rounded-sm text-red-400 shrink-0">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span className="leading-tight">{error}</span>
              </div>
            )}

            {/* TAB: BASIC CONFIG */}
            <div className={activeTab === 'basic' ? 'flex flex-col gap-6' : 'hidden'}>
              {/* Identification */}
          <div className="flex flex-col gap-2.5 pb-3 border-b border-[#333]">
            <p className="text-[10px] uppercase tracking-widest text-[#555] font-semibold">Route Identification</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Group Name" hint="*required">
                <select
                  className={selectCls + (isEdit ? ' opacity-50 cursor-not-allowed' : '')}
                  value={form.group_name}
                  onChange={(e) => set('group_name', e.target.value)}
                  disabled={isEdit}
                >
                  <option value="">Select group…</option>
                  {groups.map(g => (
                    <option key={g.name} value={g.name}>{g.name}</option>
                  ))}
                </select>
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
                <select
                  className={selectCls}
                  value={form.lp_name}
                  onChange={(e) => set('lp_name', e.target.value)}
                >
                  <option value="">Select LP Route…</option>
                  {lpOptions.map(opt => (
                    <option key={opt.id} value={opt.name}>{opt.name}</option>
                  ))}
                </select>
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
            </div>

            {/* TAB: PROCESSING RULES */}
            <div className={activeTab === 'rules' ? 'flex flex-col gap-6' : 'hidden'}>
              <DispatchDelaySection />
            </div>

            {/* TAB: MARKUPS & SLIPPAGE */}
            <div className={activeTab === 'markups' ? 'flex flex-col gap-6' : 'hidden'}>
              <HiddenMarkupSection initialGroup={form.group_name} groups={groups} />
              
              <div className="flex flex-col gap-3 pb-3 border-b border-[#333]">
                <p className="text-[10px] uppercase tracking-widest text-[#555] font-semibold">A-book markups</p>
                <Field label="Markup mode">
                  <select className={selectCls} value={form.markup_mode} onChange={(e) => set('markup_mode', e.target.value)}>
                    <option value="Standard">Standard</option>
                  </select>
                </Field>
                <label className="flex items-center gap-2.5 cursor-pointer select-none my-1">
                  <input type="checkbox" checked={form.markup_take_positive} onChange={(e) => set('markup_take_positive', e.target.checked)} className="w-3.5 h-3.5 accent-blue-500" />
                  <span className="text-[color:var(--text-secondary)]">Take positive slippage</span>
                </label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <Field label="Send to LP after (min, ms)">
                    <input className={inputCls} type="number" value={form.markup_send_lp_min} onChange={(e) => set('markup_send_lp_min', e.target.value)} />
                  </Field>
                  <Field label="Send to LP after (max, ms)">
                    <input className={inputCls} type="number" value={form.markup_send_lp_max} onChange={(e) => set('markup_send_lp_max', e.target.value)} />
                  </Field>
                  <Field label="Min market markup">
                    <input className={inputCls} type="number" value={form.markup_min_market} onChange={(e) => set('markup_min_market', e.target.value)} />
                  </Field>
                  <Field label="Max market markup">
                    <input className={inputCls} type="number" value={form.markup_max_market} onChange={(e) => set('markup_max_market', e.target.value)} />
                  </Field>
                  <Field label="Min limit markup">
                    <input className={inputCls} type="number" value={form.markup_min_limit} onChange={(e) => set('markup_min_limit', e.target.value)} />
                  </Field>
                  <Field label="Max limit markup">
                    <input className={inputCls} type="number" value={form.markup_max_limit} onChange={(e) => set('markup_max_limit', e.target.value)} />
                  </Field>
                </div>
              </div>

              <div className="flex flex-col gap-3 pb-3 border-b border-[#333]">
                <p className="text-[10px] uppercase tracking-widest text-[#555] font-semibold">Modify processing rule</p>
                <Field label="Platform symbols and tags">
                  <input className={inputCls} value={form.rule_symbols} onChange={(e) => set('rule_symbols', e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Logins">
                    <input className={inputCls} value={form.rule_logins} onChange={(e) => set('rule_logins', e.target.value)} />
                  </Field>
                  <Field label="Logins from BBI pools">
                    <select className={selectCls} value={form.rule_bbi_pools} onChange={(e) => set('rule_bbi_pools', e.target.value)}>
                      <option value="">Select...</option>
                    </select>
                  </Field>
                  <Field label="Groups">
                    <input className={inputCls} value={form.rule_groups} onChange={(e) => set('rule_groups', e.target.value)} />
                  </Field>
                  <Field label="Min volume (lots)">
                    <input className={inputCls} type="number" value={form.rule_min_volume} onChange={(e) => set('rule_min_volume', e.target.value)} />
                  </Field>
                  <Field label="Max volume (lots)">
                    <input className={inputCls} type="number" value={form.rule_max_volume} onChange={(e) => set('rule_max_volume', e.target.value)} />
                  </Field>
                  <Field label="Security">
                    <input className={inputCls} value={form.rule_security} onChange={(e) => set('rule_security', e.target.value)} />
                  </Field>
                </div>
                <Field label="Order types">
                  <select className={selectCls} value={form.rule_order_types} onChange={(e) => set('rule_order_types', e.target.value)}>
                    <option value="All">All</option>
                    <option value="Market">Market</option>
                    <option value="Limit">Limit</option>
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Order directions">
                    <select className={selectCls} value={form.rule_order_directions} onChange={(e) => set('rule_order_directions', e.target.value)}>
                      <option value="All">All</option>
                      <option value="Buy">Buy</option>
                      <option value="Sell">Sell</option>
                    </select>
                  </Field>
                  <Field label="Round type">
                    <select className={selectCls} value={form.rule_round_type} onChange={(e) => set('rule_round_type', e.target.value)}>
                      <option value="Trader's worst">Trader's worst</option>
                      <option value="Trader's best">Trader's best</option>
                    </select>
                  </Field>
                </div>
                <div className="flex flex-col gap-2 mt-2">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input type="checkbox" checked={form.rule_fok_with_ce} onChange={(e) => set('rule_fok_with_ce', e.target.checked)} className="w-3.5 h-3.5 accent-blue-500" />
                    <span className="text-[color:var(--text-secondary)]">FOK with CE</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input type="checkbox" checked={form.rule_execute_limits} onChange={(e) => set('rule_execute_limits', e.target.checked)} className="w-3.5 h-3.5 accent-blue-500" />
                    <span className="text-[color:var(--text-secondary)]">Execute limits as markets</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input type="checkbox" checked={form.rule_compensate_slippage} onChange={(e) => set('rule_compensate_slippage', e.target.checked)} className="w-3.5 h-3.5 accent-blue-500" />
                    <span className="text-[color:var(--text-secondary)]">Compensate slippage for SL / Stop orders</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer select-none mt-2">
                    <input type="checkbox" checked={form.rule_enabled} onChange={(e) => set('rule_enabled', e.target.checked)} className="w-3.5 h-3.5 accent-blue-500" />
                    <span className="text-[color:var(--text-primary)] font-medium">Enabled</span>
                  </label>
                </div>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-[color:var(--border-default)] bg-[color:var(--bg-surface-1)] shrink-0">
            <span className="text-[11px] text-[color:var(--text-muted)] italic">
              * Some fields are required
            </span>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-5 py-2 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] border border-black/20 text-white rounded-[3px] transition-colors disabled:opacity-50 text-[12px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-[color:var(--accent-500)] hover:opacity-90 text-white rounded-[3px] transition-colors disabled:opacity-50 min-w-[120px] flex justify-center font-medium text-[12px]"
              >
                {submitting ? 'Saving...' : isEdit ? 'Update Route' : 'Create Route'}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default LPRouteFormPopup;
