import React, { useState, useEffect } from 'react';
import { PlatformConfigService } from '../../services/platformConfig.service';
import { getApiErrorMessage, normalizeArrayResponse } from '../../utils/apiShapes';
import { Plus, Trash2 } from 'lucide-react';

const ENTITY_TYPES = ['account', 'client', 'order'];
const FIELD_TYPES = ['text', 'number', 'boolean', 'date', 'select'];

const CustomFieldsView = () => {
  const [entityType, setEntityType] = useState('account');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ entity_type: 'account', field_name: '', field_type: 'text', required: false, options: '' });
  const [saving, setSaving] = useState(false);
  const [contextMenu, setContextMenu] = useState({ visible: false });

  const fetchFields = async (et) => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await PlatformConfigService.listCustomFields(et);
      setData(normalizeArrayResponse(res, ['fields', 'custom_fields', 'data', 'answer', 'items', 'rows']));
    } catch (err) {
      setData([]);
      setLoadError(getApiErrorMessage(err, 'Failed to load custom fields.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFields(entityType); }, [entityType]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const options = form.options ? form.options.split(',').map(s => s.trim()).filter(Boolean) : [];
      await PlatformConfigService.createCustomField({
        entity_type: form.entity_type,
        field_name: form.field_name,
        field_type: form.field_type,
        required: form.required,
        options,
      });
      setShowForm(false);
      setForm({ entity_type: 'account', field_name: '', field_type: 'text', required: false, options: '' });
      fetchFields(entityType);
    } catch (err) {
      alert('Failed to create: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!contextMenu.row) return;
    if (window.confirm(`Delete field "${contextMenu.row.field_name}"?`)) {
      try {
        await PlatformConfigService.deleteCustomField(contextMenu.row.id);
        fetchFields(entityType);
      } catch (err) {
        alert('Failed to delete: ' + (err.response?.data?.error || err.message));
      }
    }
    setContextMenu({ visible: false });
  };

  return (
    <div
      className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden relative"
      onClick={() => setContextMenu({ visible: false })}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 h-[24px] px-3 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] transition-colors"
        >
          <Plus size={12} /> Add Field
        </button>
        <div className="flex items-center gap-1.5 ml-2">
          <span className="text-white text-[11px]">Entity:</span>
          <select
            value={entityType}
            onChange={e => setEntityType(e.target.value)}
            className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-1.5 rounded-[2px] outline-none"
          >
            {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center px-3 h-[24px] bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0">
        {[['ID', 'w-16'], ['Field Name', 'w-48'], ['Field Type', 'w-32'], ['Required', 'w-24'], ['Options', 'flex-1'], ['Created', 'w-44']].map(([label, w]) => (
          <div key={label} className={`${w} text-[10px] font-semibold text-white uppercase tracking-wider pr-3`}>{label}</div>
        ))}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-24 text-white text-[11px]">Loading…</div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center h-24 text-center px-4">
            <div className="text-[12px] font-semibold text-[#f48771]">Failed to load custom fields</div>
            <div className="mt-1 text-[11px] text-white max-w-[520px]">{loadError}</div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-white text-[11px]">No custom fields defined</div>
        ) : (
          data.map((row, i) => (
            <div
              key={row.id}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, row }); }}
              className={`flex items-center px-3 h-[22px] border-b border-black/20 cursor-default select-none ${i % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-[#2a2d2e]`}
            >
              <div className="w-16 text-[11px] text-[color:var(--text-primary)] pr-3">{row.id}</div>
              <div className="w-48 text-[11px] text-[color:var(--text-primary)] pr-3 truncate">{row.field_name}</div>
              <div className="w-32 text-[11px] text-white pr-3">{row.field_type}</div>
              <div className="w-24 text-[11px] pr-3">
                <span className={row.required ? 'text-white' : 'text-white'}>{row.required ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex-1 text-[11px] text-white pr-3 truncate">
                {Array.isArray(row.options) && row.options.length > 0 ? row.options.join(', ') : '—'}
              </div>
              <div className="w-44 text-[11px] text-white">
                {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed z-50 bg-[color:var(--bg-surface-1)] border border-[color:var(--bg-surface-3)] shadow-xl rounded-[2px] py-0.5 min-w-[140px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 w-full px-3 h-[26px] text-[11px] text-[#f48771] hover:bg-[color:var(--accent-700)] transition-colors"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <form
            onSubmit={handleCreate}
            className="bg-[color:var(--bg-surface-1)] border border-[color:var(--bg-surface-3)] rounded-[3px] shadow-2xl w-[340px] p-5 flex flex-col gap-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-[12px] font-semibold text-[color:var(--text-primary)] mb-1">Create Custom Field</div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white uppercase tracking-wider">Entity Type</label>
              <select
                value={form.entity_type}
                onChange={e => setForm(f => ({ ...f, entity_type: e.target.value }))}
                className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[24px] px-1.5 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]"
              >
                {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white uppercase tracking-wider">Field Name *</label>
              <input
                required
                value={form.field_name}
                onChange={e => setForm(f => ({ ...f, field_name: e.target.value }))}
                className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[24px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[10px] text-white uppercase tracking-wider">Field Type</label>
                <select
                  value={form.field_type}
                  onChange={e => setForm(f => ({ ...f, field_type: e.target.value }))}
                  className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[24px] px-1.5 rounded-[2px] outline-none"
                >
                  {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1 justify-end">
                <label className="flex items-center gap-1.5 text-[11px] text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.required}
                    onChange={e => setForm(f => ({ ...f, required: e.target.checked }))}
                    className="accent-[color:var(--accent-500)]"
                  />
                  Required
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-white uppercase tracking-wider">Options (comma-separated)</label>
              <input
                value={form.options}
                onChange={e => setForm(f => ({ ...f, options: e.target.value }))}
                placeholder="e.g. gold, silver, bronze"
                className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[24px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]"
              />
            </div>

            <div className="flex gap-2 mt-1 justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="h-[24px] px-4 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-white text-[11px] rounded-[2px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-[24px] px-4 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default CustomFieldsView;
