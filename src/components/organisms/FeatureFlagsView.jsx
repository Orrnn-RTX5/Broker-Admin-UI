import React, { useState, useEffect } from 'react';
import { PlatformConfigService } from '../../services/platformConfig.service';
import { getApiErrorMessage, normalizeArrayResponse } from '../../utils/apiShapes';
import { Plus, ToggleLeft, ToggleRight } from 'lucide-react';

const FeatureFlagsView = () => {
  const [groupFilter, setGroupFilter] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ feature_name: '', group_name: '', enabled: false, config_json: '{}' });
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(null);

  const fetchFlags = async (group) => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await PlatformConfigService.listFeatureFlags(group || undefined);
      setData(normalizeArrayResponse(res, ['flags', 'feature_flags', 'data', 'answer', 'items', 'rows']));
    } catch (err) {
      setData([]);
      setLoadError(getApiErrorMessage(err, 'Failed to load feature flags.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFlags(groupFilter); }, []);

  const handleToggle = async (flag) => {
    setToggling(flag.feature_name);
    try {
      await PlatformConfigService.setFeatureFlag({
        feature_name: flag.feature_name,
        group_name: flag.group_name || null,
        enabled: !flag.enabled,
        config_json: flag.config_json || {},
      });
      setData(d => d.map(f => f.feature_name === flag.feature_name ? { ...f, enabled: !f.enabled } : f));
    } catch (err) {
      alert('Failed to toggle: ' + (err.response?.data?.error || err.message));
    } finally {
      setToggling(null);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let config_json = {};
      try { config_json = JSON.parse(form.config_json); } catch { /* leave as {} */ }
      await PlatformConfigService.setFeatureFlag({
        feature_name: form.feature_name,
        group_name: form.group_name || null,
        enabled: form.enabled,
        config_json,
      });
      setShowForm(false);
      setForm({ feature_name: '', group_name: '', enabled: false, config_json: '{}' });
      fetchFlags(groupFilter);
    } catch (err) {
      alert('Failed to save: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden relative">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 h-[24px] px-3 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] transition-colors"
        >
          <Plus size={12} /> Add Flag
        </button>
        <div className="flex items-center gap-1.5 ml-2">
          <input
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            placeholder="Filter by group…"
            className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-2 rounded-[2px] outline-none w-[160px]"
          />
          <button
            onClick={() => fetchFlags(groupFilter)}
            className="h-[22px] px-3 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px]"
          >
            Load
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center px-3 h-[24px] bg-[color:var(--bg-surface-1)] border-b border-black/30 shrink-0">
        {[['ID', 'w-12'], ['Feature Name', 'w-56'], ['Group', 'w-36'], ['Enabled', 'w-20'], ['Config', 'flex-1'], ['Updated', 'w-44']].map(([label, w]) => (
          <div key={label} className={`${w} text-[10px] font-semibold text-[#888] uppercase tracking-wider pr-3`}>{label}</div>
        ))}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-24 text-[#888] text-[11px]">Loading…</div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center h-24 text-center px-4">
            <div className="text-[12px] font-semibold text-[#f48771]">Failed to load feature flags</div>
            <div className="mt-1 text-[11px] text-[#888] max-w-[520px]">{loadError}</div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-[#555] text-[11px]">No feature flags found</div>
        ) : (
          data.map((row, i) => (
            <div
              key={row.id || row.feature_name}
              className={`flex items-center px-3 h-[22px] border-b border-black/20 cursor-default select-none ${i % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'} hover:bg-[#2a2d2e]`}
            >
              <div className="w-12 text-[11px] text-[color:var(--text-primary)] pr-3">{row.id}</div>
              <div className="w-56 text-[11px] text-[color:var(--text-primary)] pr-3 truncate">{row.feature_name}</div>
              <div className="w-36 text-[11px] text-[#9cdcfe] pr-3 truncate">{row.group_name || <span className="text-[#555]">global</span>}</div>
              <div className="w-20 pr-3">
                <button
                  onClick={() => handleToggle(row)}
                  disabled={toggling === row.feature_name}
                  className="flex items-center gap-1 text-[11px] transition-colors disabled:opacity-50"
                >
                  {row.enabled
                    ? <ToggleRight size={16} className="text-[#4ec9b0]" />
                    : <ToggleLeft size={16} className="text-[#555]" />}
                  <span className={row.enabled ? 'text-[#4ec9b0]' : 'text-[#555]'}>{row.enabled ? 'On' : 'Off'}</span>
                </button>
              </div>
              <div className="flex-1 text-[11px] text-[#888] pr-3 truncate font-mono">
                {row.config_json && Object.keys(row.config_json).length > 0 ? JSON.stringify(row.config_json) : '{}'}
              </div>
              <div className="w-44 text-[11px] text-[#888]">
                {row.updated_at ? new Date(row.updated_at).toLocaleString() : '—'}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <form
            onSubmit={handleCreate}
            className="bg-[color:var(--bg-surface-1)] border border-[color:var(--bg-surface-3)] rounded-[3px] shadow-2xl w-[360px] p-5 flex flex-col gap-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-[12px] font-semibold text-[color:var(--text-primary)] mb-1">Set Feature Flag</div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#888] uppercase tracking-wider">Feature Name *</label>
              <input
                required
                value={form.feature_name}
                onChange={e => setForm(f => ({ ...f, feature_name: e.target.value }))}
                className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[24px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[10px] text-[#888] uppercase tracking-wider">Group (blank = global)</label>
                <input
                  value={form.group_name}
                  onChange={e => setForm(f => ({ ...f, group_name: e.target.value }))}
                  placeholder="e.g. standard"
                  className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[24px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]"
                />
              </div>
              <div className="flex flex-col gap-1 justify-end">
                <label className="flex items-center gap-1.5 text-[11px] text-[#ccc] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                    className="accent-[color:var(--accent-500)]"
                  />
                  Enabled
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#888] uppercase tracking-wider">Config JSON</label>
              <textarea
                value={form.config_json}
                onChange={e => setForm(f => ({ ...f, config_json: e.target.value }))}
                rows={3}
                className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] px-2 py-1 rounded-[2px] outline-none focus:border-[color:var(--accent-500)] resize-none font-mono"
              />
            </div>

            <div className="flex gap-2 mt-1 justify-end">
              <button type="button" onClick={() => setShowForm(false)}
                className="h-[24px] px-4 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px]">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="h-[24px] px-4 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default FeatureFlagsView;
