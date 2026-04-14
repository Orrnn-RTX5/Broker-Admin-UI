import React, { useState, useEffect } from 'react';
import { PlatformConfigService } from '../../services/platformConfig.service';
import { Search, Save } from 'lucide-react';

const CHART_TYPES = ['candlestick', 'bar', 'line', 'area'];
const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'];
const THEMES = ['dark', 'light', 'system'];

const TradingTerminalConfigView = () => {
  const [group, setGroup] = useState('');
  const [searchGroup, setSearchGroup] = useState('');
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    default_chart: 'candlestick',
    default_timeframe: 'H1',
    theme: 'dark',
    config_json: '{}',
  });

  const handleLoad = async (e) => {
    if (e) e.preventDefault();
    if (!searchGroup.trim()) return;
    setLoading(true);
    try {
      const res = await PlatformConfigService.getTradingTerminalConfig(searchGroup.trim());
      setConfig(res);
      setForm({
        default_chart: res.default_chart || 'candlestick',
        default_timeframe: res.default_timeframe || 'H1',
        theme: res.theme || 'dark',
        config_json: res.config_json ? JSON.stringify(res.config_json, null, 2) : '{}',
      });
      setGroup(searchGroup.trim());
    } catch (err) {
      if (err.response?.status === 404 || err.response?.data?.retcode) {
        setConfig(null);
        setForm({ default_chart: 'candlestick', default_timeframe: 'H1', theme: 'dark', config_json: '{}' });
        setGroup(searchGroup.trim());
      } else {
        alert('Failed to load: ' + (err.response?.data?.error || err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!group) return;
    setSaving(true);
    try {
      let config_json = {};
      try { config_json = JSON.parse(form.config_json); } catch { /* leave as {} */ }
      await PlatformConfigService.setTradingTerminalConfig({
        group,
        default_chart: form.default_chart,
        default_timeframe: form.default_timeframe,
        theme: form.theme,
        config_json,
      });
      handleLoad();
    } catch (err) {
      alert('Failed to save: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
        <form onSubmit={handleLoad} className="flex items-center gap-2">
          <input
            value={searchGroup}
            onChange={e => setSearchGroup(e.target.value)}
            placeholder="Enter group name…"
            className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[22px] px-2 rounded-[2px] outline-none w-[200px] focus:border-[color:var(--accent-500)]"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 h-[22px] px-3 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] text-[11px] rounded-[2px]"
          >
            <Search size={11} /> Load
          </button>
        </form>
        {group && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 h-[24px] px-3 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] ml-auto disabled:opacity-50"
          >
            <Save size={12} /> {saving ? 'Saving…' : 'Save Config'}
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center flex-1 text-[#888] text-[11px]">Loading…</div>
      ) : !group ? (
        <div className="flex items-center justify-center flex-1 text-[#555] text-[11px]">Enter a group name and click Load</div>
      ) : (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-[500px] flex flex-col gap-4">
            <div className="text-[12px] font-semibold text-[#9cdcfe]">
              Trading Terminal Config — <span className="text-[color:var(--text-primary)]">{group}</span>
              {config?.updated_at && (
                <span className="ml-3 text-[10px] text-[#555] font-normal">
                  Last updated: {new Date(config.updated_at).toLocaleString()}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#888] uppercase tracking-wider">Default Chart</label>
                <select
                  value={form.default_chart}
                  onChange={e => setForm(f => ({ ...f, default_chart: e.target.value }))}
                  className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[28px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]"
                >
                  {CHART_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#888] uppercase tracking-wider">Default Timeframe</label>
                <select
                  value={form.default_timeframe}
                  onChange={e => setForm(f => ({ ...f, default_timeframe: e.target.value }))}
                  className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[28px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]"
                >
                  {TIMEFRAMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#888] uppercase tracking-wider">Theme</label>
                <select
                  value={form.theme}
                  onChange={e => setForm(f => ({ ...f, theme: e.target.value }))}
                  className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] h-[28px] px-2 rounded-[2px] outline-none focus:border-[color:var(--accent-500)]"
                >
                  {THEMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#888] uppercase tracking-wider">Config JSON (advanced)</label>
              <textarea
                value={form.config_json}
                onChange={e => setForm(f => ({ ...f, config_json: e.target.value }))}
                rows={8}
                className="bg-[color:var(--bg-app)] border border-[#555] text-[color:var(--text-primary)] text-[11px] px-2 py-1.5 rounded-[2px] outline-none focus:border-[color:var(--accent-500)] resize-none font-mono"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingTerminalConfigView;
