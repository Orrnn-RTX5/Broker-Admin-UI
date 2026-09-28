import React, { useCallback, useEffect, useState } from 'react';
import { RiskManagementService } from '../../services/riskManagement.service';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { buildRiskLimitPayload } from '../../utils/adminValidation';
import { buildActionableErrorState } from '../../utils/errorState';
import ActionableErrorState from '../atoms/ActionableErrorState';
import LpSymbolDatalist from '../atoms/LpSymbolDatalist';

const SCOPE_TYPES = ['', 'account', 'group', 'symbol', 'global'];
const LIMIT_TYPES = ['max_drawdown', 'max_volume', 'max_loss', 'max_margin', 'max_positions'];
const ACTIONS = ['alert', 'disable', 'restrict'];
const tsFormat = (ts) => ts ? new Date(ts * 1000).toLocaleString() : '—';

const defaultForm = { scope_type: 'account', scope_value: '', limit_type: 'max_drawdown', limit_value: '', action: 'alert', alert_threshold: '', enabled: true };

const RiskLimitsView = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scopeFilter, setScopeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // limit object being edited
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [contextMenu, setContextMenu] = useState({ visible: false });
  const [loadError, setLoadError] = useState(null);

  const fetchLimits = useCallback(async (scope) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await RiskManagementService.listRiskLimits(scope || undefined);
      setData(Array.isArray(res) ? res : []);
    } catch (err) {
      setData([]);
      setLoadError(buildActionableErrorState(err, {
        title: 'Risk limits failed to load',
        actionLabel: 'Load again',
        fallback: 'Could not load risk limits',
      }));
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchLimits(''), 0);
    return () => clearTimeout(timer);
  }, [fetchLimits]);

  const openCreate = () => { setEditing(null); setForm(defaultForm); setShowForm(true); };
  const openEdit = (row) => {
    setEditing(row);
    setForm({
      scope_type: row.scope_type || 'account',
      scope_value: row.scope_value || '',
      limit_type: row.limit_type || 'max_drawdown',
      limit_value: row.limit_value ?? '',
      action: row.action || 'alert',
      alert_threshold: row.alert_threshold ?? '',
      enabled: row.enabled ?? true,
    });
    setShowForm(true);
    setContextMenu({ visible: false });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = buildRiskLimitPayload(form);
      if (editing) {
        await RiskManagementService.updateRiskLimit(editing.id, body);
      } else {
        await RiskManagementService.createRiskLimit(body);
      }
      setShowForm(false);
      fetchLimits(scopeFilter);
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!contextMenu.row) return;
    if (window.confirm(`Delete risk limit #${contextMenu.row.id}?`)) {
      try {
        await RiskManagementService.deleteRiskLimit(contextMenu.row.id);
        fetchLimits(scopeFilter);
      } catch (err) {
        alert('Failed: ' + (err.response?.data?.message || err.message));
      }
    }
    setContextMenu({ visible: false });
  };

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden relative"
      onClick={() => setContextMenu({ visible: false })}
      onContextMenu={e => e.preventDefault()}>

      {/* Top Bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
        <button onClick={openCreate}
          className="flex items-center gap-1.5 h-[24px] px-3 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px]">
          <Plus size={12} /> Add Limit
        </button>
        <div className="flex items-center gap-2 ml-2">
          <select value={scopeFilter} onChange={e => setScopeFilter(e.target.value)}
            className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-1.5 rounded-[2px] outline-none">
            {SCOPE_TYPES.map(s => <option key={s} value={s}>{s || 'All scopes'}</option>)}
          </select>
          <button onClick={() => fetchLimits(scopeFilter)}
            className="h-[22px] px-3 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-white text-[11px] rounded-[2px]">Load</button>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center px-3 h-[24px] bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0">
        {[['ID','w-12'],['Scope','w-24'],['Value','w-36'],['Limit Type','w-36'],['Limit Value','w-28'],['Action','w-24'],['Threshold','w-28'],['Enabled','w-20'],['Created By','w-28'],['Created','w-40']].map(([l,w]) => (
          <div key={l} className={`${w} text-[10px] font-semibold text-white uppercase tracking-wider pr-2`}>{l}</div>
        ))}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-auto">
        {loading ? <div className="flex items-center justify-center h-24 text-white text-[11px]">Loading…</div>
          : loadError ? <ActionableErrorState state={loadError} onAction={() => fetchLimits(scopeFilter)} />
          : data.length === 0 ? <div className="flex items-center justify-center h-24 text-white text-[11px]">No risk limits configured</div>
          : data.map((row, i) => (
            <div key={row.id}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, row }); }}
              onDoubleClick={() => openEdit(row)}
              className={`flex items-center px-3 h-[22px] border-b border-black/20 cursor-default select-none ${i % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-[#2a2d2e]`}>
              <div className="w-12 text-[11px] text-[color:var(--text-primary)] pr-2">{row.id}</div>
              <div className="w-24 text-[11px] text-white pr-2">{row.scope_type}</div>
              <div className="w-36 text-[11px] text-[color:var(--text-primary)] pr-2 truncate">{row.scope_value || <span className="text-white">—</span>}</div>
              <div className="w-36 text-[11px] text-white pr-2">{row.limit_type}</div>
              <div className="w-28 text-[11px] text-[#f48771] pr-2">{typeof row.limit_value === 'number' ? row.limit_value.toFixed(2) : '—'}</div>
              <div className="w-24 text-[11px] text-[#d4a017] pr-2">{row.action}</div>
              <div className="w-28 text-[11px] text-white pr-2">{typeof row.alert_threshold === 'number' ? row.alert_threshold.toFixed(2) : '—'}</div>
              <div className="w-20 pr-2">
                <span className={row.enabled ? 'text-white text-[11px]' : 'text-white text-[11px]'}>{row.enabled ? 'Yes' : 'No'}</span>
              </div>
              <div className="w-28 text-[11px] text-white pr-2">{row.created_by || '—'}</div>
              <div className="w-40 text-[11px] text-white">{tsFormat(row.created_at)}</div>
            </div>
          ))}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div className="fixed z-50 bg-[color:var(--bg-surface-1)] border border-[color:var(--bg-surface-3)] shadow-xl rounded-[2px] py-0.5 min-w-[140px]"
          style={{ top: contextMenu.y, left: contextMenu.x }} onClick={e => e.stopPropagation()}>
          <button onClick={() => openEdit(contextMenu.row)}
            className="flex items-center gap-2 w-full px-3 h-[26px] text-[11px] text-[color:var(--text-primary)] hover:bg-[color:var(--accent-700)]">
            <Pencil size={12} /> Edit
          </button>
          <button onClick={handleDelete}
            className="flex items-center gap-2 w-full px-3 h-[26px] text-[11px] text-[#f48771] hover:bg-[color:var(--accent-700)]">
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <form onSubmit={handleSubmit}
            className="bg-[color:var(--bg-surface-1)] border border-[color:var(--bg-surface-3)] rounded-[3px] shadow-2xl w-[380px] p-5 flex flex-col gap-3"
            onClick={e => e.stopPropagation()}>
            <div className="text-[12px] font-semibold text-[color:var(--text-primary)]">{editing ? `Edit Limit #${editing.id}` : 'Create Risk Limit'}</div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-white uppercase tracking-wider">Scope Type *</label>
                <select value={form.scope_type} onChange={e => setForm(f => ({ ...f, scope_type: e.target.value }))}
                  className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[24px] px-1.5 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]">
                  {SCOPE_TYPES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-white uppercase tracking-wider">Scope Value</label>
                <input value={form.scope_value} onChange={e => setForm(f => ({ ...f, scope_value: e.target.value }))}
                  placeholder={form.scope_type === 'symbol' ? 'e.g. EURUSD' : 'login / group / symbol'}
                  list={form.scope_type === 'symbol' ? 'risk-limit-symbol-options' : undefined}
                  autoComplete="off"
                  className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[24px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]" />
                {form.scope_type === 'symbol' && <LpSymbolDatalist id="risk-limit-symbol-options" />}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-white uppercase tracking-wider">Limit Type *</label>
                <select value={form.limit_type} onChange={e => setForm(f => ({ ...f, limit_type: e.target.value }))}
                  className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[24px] px-1.5 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]">
                  {LIMIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-white uppercase tracking-wider">Action *</label>
                <select value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value }))}
                  className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[24px] px-1.5 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]">
                  {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-white uppercase tracking-wider">Limit Value *</label>
                <input type="number" step="any" required value={form.limit_value} onChange={e => setForm(f => ({ ...f, limit_value: e.target.value }))}
                  className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[24px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-white uppercase tracking-wider">Alert Threshold</label>
                <input type="number" step="any" value={form.alert_threshold} onChange={e => setForm(f => ({ ...f, alert_threshold: e.target.value }))}
                  className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[24px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]" />
              </div>
            </div>

            <label className="flex items-center gap-1.5 text-[11px] text-white cursor-pointer">
              <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} className="accent-[color:var(--accent-500)]" />
              Enabled
            </label>

            <div className="flex gap-2 justify-end mt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="h-[24px] px-4 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-white text-[11px] rounded-[2px]">Cancel</button>
              <button type="submit" disabled={saving}
                className="h-[24px] px-4 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] disabled:opacity-50">
                {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default RiskLimitsView;
