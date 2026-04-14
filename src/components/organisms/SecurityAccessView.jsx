import React, { useState, useEffect } from 'react';
import { SecurityAccessService } from '../../services/security.service';
import {
  Plus, RefreshCw, X, Trash2, Shield, Sliders, FileText,
  HardDrive, Database, CheckCircle, AlertCircle, Power, PowerOff
} from 'lucide-react';

const fmt = (v) => (v == null ? '—' : String(v));
const fmtBytes = (b) => {
  if (b == null) return '—';
  if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB';
  if (b >= 1048576) return (b / 1048576).toFixed(2) + ' MB';
  if (b >= 1024) return (b / 1024).toFixed(2) + ' KB';
  return b + ' B';
};
const fmtDate = (v) => { if (!v) return '—'; try { return new Date(v).toLocaleString(); } catch { return v; } };

const inp = "w-full bg-[color:var(--bg-surface-2)] border border-[#555] text-[color:var(--text-primary)] text-[12px] px-2 py-1.5 rounded-[2px] focus:outline-none focus:border-[color:var(--accent-500)]";
const Lbl = ({ t, req, children }) => (
  <div className="flex flex-col gap-0.5">
    <label className="text-[10px] text-[#888] uppercase tracking-wider">{t}{req && <span className="text-[#f48771] ml-0.5">*</span>}</label>
    {children}
  </div>
);

const Modal = ({ title, width = 420, onClose, children }) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={onClose}>
    <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-[3px] shadow-2xl" style={{ width }} onClick={e => e.stopPropagation()}>
      <div className="flex items-center h-9 px-4 border-b border-black/40 bg-[color:var(--bg-surface-1)]">
        <span className="text-[12px] font-semibold text-[color:var(--text-primary)] flex-1">{title}</span>
        <button onClick={onClose} className="text-[#555] hover:text-[#ccc]"><X size={14} /></button>
      </div>
      {children}
    </div>
  </div>
);

const Badge = ({ on, label }) => (
  <span className={`px-1.5 py-0.5 rounded-[2px] text-[10px] font-medium ${on ? 'bg-[#22c55e]/20 text-[#4ec9b0]' : 'bg-[#555]/30 text-[#888]'}`}>
    {label ?? (on ? 'Enabled' : 'Disabled')}
  </span>
);

const RuleTypeBadge = ({ type }) => {
  const color = type === 'deny' ? 'bg-[#ef4444]/20 text-[#f48771]' : 'bg-[#22c55e]/20 text-[#4ec9b0]';
  return <span className={`px-1.5 py-0.5 rounded-[2px] text-[10px] font-medium ${color}`}>{fmt(type)}</span>;
};

// ══════════════════════════════════════════════════════════════════════════
// TAB 1 — IP Restrictions
// ══════════════════════════════════════════════════════════════════════════
const IpRestrictionsTab = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const r = await SecurityAccessService.listAccessRestrictions(); setData(Array.isArray(r) ? r : []); }
    catch { setData([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete restriction for "${row.ip_pattern}"?`)) return;
    setDeleting(row.id);
    try { await SecurityAccessService.deleteAccessRestriction(row.id); load(); }
    catch (err) { alert(err.response?.data?.message || err.message); }
    finally { setDeleting(null); }
  };

  const CreatePopup = ({ onClose, onSaved }) => {
    const [form, setForm] = useState({ rule_type: 'deny', ip_pattern: '', description: '', scope: 'all', created_by: 'admin' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!form.ip_pattern) { setError('IP Pattern is required.'); return; }
      setSaving(true); setError('');
      try { await SecurityAccessService.createAccessRestriction(form); onSaved(); onClose(); }
      catch (err) { setError(err.response?.data?.message || err.message); }
      finally { setSaving(false); }
    };

    return (
      <Modal title="New IP Restriction" onClose={onClose}>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Lbl t="Rule Type" req>
              <select className={inp} value={form.rule_type} onChange={e => set('rule_type', e.target.value)}>
                <option value="deny">deny</option>
                <option value="allow">allow</option>
              </select>
            </Lbl>
            <Lbl t="Scope">
              <select className={inp} value={form.scope} onChange={e => set('scope', e.target.value)}>
                {['all', 'trader', 'manager', 'api'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Lbl>
          </div>
          <Lbl t="IP Pattern (CIDR or single IP)" req>
            <input className={inp} value={form.ip_pattern} onChange={e => set('ip_pattern', e.target.value)} placeholder="192.168.1.100 or 10.0.0.0/8" />
          </Lbl>
          <Lbl t="Description">
            <input className={inp} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Suspicious IP block" />
          </Lbl>
          <Lbl t="Created By">
            <input className={inp} value={form.created_by} onChange={e => set('created_by', e.target.value)} placeholder="admin" />
          </Lbl>
          {error && <div className="text-[#f48771] text-[11px] bg-[#3a1c1c] px-3 py-2 rounded-[2px]">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-[11px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] rounded-[2px]">Cancel</button>
            <button type="submit" disabled={saving} className="px-3 py-1.5 text-[11px] bg-[color:var(--accent-500)] hover:bg-[#1a8ad4] text-white rounded-[2px] disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Rule'}
            </button>
          </div>
        </form>
      </Modal>
    );
  };

  const cols = [['#', 'w-10'], ['Rule Type', 'w-24'], ['IP Pattern', 'w-48'], ['Scope', 'w-24'], ['Description', 'flex-1'], ['Enabled', 'w-20'], ['Created By', 'w-28'], ['Created At', 'w-40'], ['', 'w-10']];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {popup && <CreatePopup onClose={() => setPopup(false)} onSaved={load} />}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40">
        <button onClick={() => setPopup(true)} className="flex items-center gap-1 px-2 py-1 text-[11px] bg-[color:var(--accent-500)] hover:bg-[#1a8ad4] text-white rounded-[2px]">
          <Plus size={11} /> New Rule
        </button>
        <button onClick={load} className="flex items-center gap-1 px-2 py-1 text-[11px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] rounded-[2px]">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>
      <div className="flex bg-[color:var(--bg-surface-2)] border-b border-black/40 select-none">
        {cols.map(([label, width]) => (
          <div key={label} className={`${width} px-3 py-1.5 text-[11px] font-medium text-[#aaa] shrink-0`}>{label}</div>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-20 text-[11px] text-[#555]">Loading…</div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-[11px] text-[#555]">No IP restrictions configured</div>
        ) : data.map((row, idx) => (
          <div key={row.id} className={`flex items-center border-b border-black/20 hover:bg-blue-600/10 ${idx % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'}`}>
            <div className="w-10 px-3 py-1.5 text-[11px] text-[#555] shrink-0">{row.id}</div>
            <div className="w-24 px-3 py-1.5 shrink-0"><RuleTypeBadge type={row.rule_type} /></div>
            <div className="w-48 px-3 py-1.5 text-[11px] text-[#9cdcfe] font-mono shrink-0">{fmt(row.ip_pattern)}</div>
            <div className="w-24 px-3 py-1.5 text-[11px] text-[#ccc] shrink-0">{fmt(row.scope)}</div>
            <div className="flex-1 px-3 py-1.5 text-[11px] text-[#aaa] truncate">{fmt(row.description)}</div>
            <div className="w-20 px-3 py-1.5 shrink-0"><Badge on={row.enabled} /></div>
            <div className="w-28 px-3 py-1.5 text-[11px] text-[#ccc] shrink-0">{fmt(row.created_by)}</div>
            <div className="w-40 px-3 py-1.5 text-[11px] text-[#888] shrink-0">{fmtDate(row.created_at)}</div>
            <div className="w-10 px-2 py-1.5 shrink-0">
              <button onClick={() => handleDelete(row)} disabled={deleting === row.id} className="text-[#555] hover:text-[#f48771]" title="Delete">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="h-6 bg-[color:var(--accent-500)] text-white flex items-center px-4 text-[11px]">Total: {data.length}</div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════
// TAB 2 — Connection Throttle
// ══════════════════════════════════════════════════════════════════════════
const ConnectionThrottleTab = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const r = await SecurityAccessService.listConnectionThrottle(); setData(Array.isArray(r) ? r : []); }
    catch { setData([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete throttle rule "${row.name}"?`)) return;
    setDeleting(row.id);
    try { await SecurityAccessService.deleteConnectionThrottle(row.id); load(); }
    catch (err) { alert(err.response?.data?.message || err.message); }
    finally { setDeleting(null); }
  };

  const CreatePopup = ({ onClose, onSaved }) => {
    const [form, setForm] = useState({ name: '', scope: 'global', scope_value: '', max_connections: 100, per_seconds: 60, burst: 10, action: 'reject' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!form.name) { setError('Name is required.'); return; }
      setSaving(true); setError('');
      try {
        const payload = { ...form, max_connections: Number(form.max_connections), per_seconds: Number(form.per_seconds), burst: Number(form.burst) };
        if (!payload.scope_value) delete payload.scope_value;
        await SecurityAccessService.createConnectionThrottle(payload);
        onSaved(); onClose();
      } catch (err) { setError(err.response?.data?.message || err.message); }
      finally { setSaving(false); }
    };

    return (
      <Modal title="New Throttle Rule" width={480} onClose={onClose}>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Lbl t="Name" req>
              <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Per-IP limit" />
            </Lbl>
            <Lbl t="Scope">
              <select className={inp} value={form.scope} onChange={e => set('scope', e.target.value)}>
                {['global', 'ip', 'user', 'group'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Lbl>
          </div>
          {form.scope !== 'global' && (
            <Lbl t="Scope Value">
              <input className={inp} value={form.scope_value} onChange={e => set('scope_value', e.target.value)} placeholder="IP address, user ID, or group name" />
            </Lbl>
          )}
          <div className="grid grid-cols-3 gap-3">
            <Lbl t="Max Connections" req>
              <input type="number" min="1" className={inp} value={form.max_connections} onChange={e => set('max_connections', e.target.value)} />
            </Lbl>
            <Lbl t="Per Seconds" req>
              <input type="number" min="1" className={inp} value={form.per_seconds} onChange={e => set('per_seconds', e.target.value)} />
            </Lbl>
            <Lbl t="Burst">
              <input type="number" min="0" className={inp} value={form.burst} onChange={e => set('burst', e.target.value)} />
            </Lbl>
          </div>
          <Lbl t="Action">
            <select className={inp} value={form.action} onChange={e => set('action', e.target.value)}>
              {['reject', 'drop', 'delay'].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </Lbl>
          {error && <div className="text-[#f48771] text-[11px] bg-[#3a1c1c] px-3 py-2 rounded-[2px]">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-[11px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] rounded-[2px]">Cancel</button>
            <button type="submit" disabled={saving} className="px-3 py-1.5 text-[11px] bg-[color:var(--accent-500)] hover:bg-[#1a8ad4] text-white rounded-[2px] disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Rule'}
            </button>
          </div>
        </form>
      </Modal>
    );
  };

  const cols = [['#', 'w-10'], ['Name', 'w-44'], ['Scope', 'w-20'], ['Scope Value', 'w-36'], ['Max Conn', 'w-24'], ['Per Sec', 'w-20'], ['Burst', 'w-16'], ['Action', 'w-20'], ['Enabled', 'w-20'], ['', 'w-10']];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {popup && <CreatePopup onClose={() => setPopup(false)} onSaved={load} />}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40">
        <button onClick={() => setPopup(true)} className="flex items-center gap-1 px-2 py-1 text-[11px] bg-[color:var(--accent-500)] hover:bg-[#1a8ad4] text-white rounded-[2px]">
          <Plus size={11} /> New Rule
        </button>
        <button onClick={load} className="flex items-center gap-1 px-2 py-1 text-[11px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] rounded-[2px]">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>
      <div className="flex bg-[color:var(--bg-surface-2)] border-b border-black/40 select-none">
        {cols.map(([label, width]) => (
          <div key={label} className={`${width} px-3 py-1.5 text-[11px] font-medium text-[#aaa] shrink-0`}>{label}</div>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-20 text-[11px] text-[#555]">Loading…</div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-[11px] text-[#555]">No throttle rules configured</div>
        ) : data.map((row, idx) => (
          <div key={row.id} className={`flex items-center border-b border-black/20 hover:bg-blue-600/10 ${idx % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'}`}>
            <div className="w-10 px-3 py-1.5 text-[11px] text-[#555] shrink-0">{row.id}</div>
            <div className="w-44 px-3 py-1.5 text-[11px] text-[color:var(--text-primary)] shrink-0">{fmt(row.name)}</div>
            <div className="w-20 px-3 py-1.5 text-[11px] text-[#9cdcfe] shrink-0">{fmt(row.scope)}</div>
            <div className="w-36 px-3 py-1.5 text-[11px] text-[#aaa] font-mono shrink-0">{fmt(row.scope_value)}</div>
            <div className="w-24 px-3 py-1.5 text-[11px] text-[#4ec9b0] shrink-0">{fmt(row.max_connections)}</div>
            <div className="w-20 px-3 py-1.5 text-[11px] text-[#ccc] shrink-0">{fmt(row.per_seconds)}s</div>
            <div className="w-16 px-3 py-1.5 text-[11px] text-[#ccc] shrink-0">{fmt(row.burst)}</div>
            <div className="w-20 px-3 py-1.5 text-[11px] text-[#f48771] shrink-0">{fmt(row.action)}</div>
            <div className="w-20 px-3 py-1.5 shrink-0"><Badge on={row.enabled} /></div>
            <div className="w-10 px-2 py-1.5 shrink-0">
              <button onClick={() => handleDelete(row)} disabled={deleting === row.id} className="text-[#555] hover:text-[#f48771]" title="Delete">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="h-6 bg-[color:var(--accent-500)] text-white flex items-center px-4 text-[11px]">Total: {data.length}</div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════
// TAB 3 — Log Management
// ══════════════════════════════════════════════════════════════════════════
const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

const LogManagementTab = () => {
  const [logLevel, setLogLevel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState('info');
  const [setting, setSetting] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [lastFlush, setLastFlush] = useState(null);
  const [error, setError] = useState('');

  const loadLevel = async () => {
    setLoading(true);
    try {
      const r = await SecurityAccessService.getLogLevel();
      setLogLevel(r.log_level);
      setSelectedLevel(r.log_level || 'info');
    } catch { setLogLevel(null); } finally { setLoading(false); }
  };
  useEffect(() => { loadLevel(); }, []);

  const handleSetLevel = async () => {
    setSetting(true); setError('');
    try {
      const r = await SecurityAccessService.setLogLevel(selectedLevel);
      setLogLevel(r.log_level);
    } catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setSetting(false); }
  };

  const handleFlush = async () => {
    if (!window.confirm('Flush all current logs? This action cannot be undone.')) return;
    setFlushing(true); setError('');
    try {
      await SecurityAccessService.flushLogs();
      setLastFlush(new Date().toLocaleString());
    } catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setFlushing(false); }
  };

  const levelColor = (l) => {
    const map = { trace: '#9cdcfe', debug: '#4ec9b0', info: '#22c55e', warn: '#d97706', error: '#f48771', fatal: '#ef4444' };
    return map[l] || '#ccc';
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-xl space-y-5">
          {/* Current Level Card */}
          <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-[3px] p-4">
            <div className="text-[11px] text-[#888] uppercase tracking-wider mb-3">Current Log Level</div>
            {loading ? (
              <div className="text-[13px] text-[#555]">Loading…</div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-[22px] font-bold font-mono uppercase" style={{ color: levelColor(logLevel) }}>
                  {logLevel ?? '—'}
                </span>
                <span className="text-[11px] text-[#555]">active on server</span>
              </div>
            )}
          </div>

          {/* Set Level */}
          <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-[3px] p-4">
            <div className="text-[11px] text-[#888] uppercase tracking-wider mb-3">Set Log Level</div>
            <div className="flex gap-2 flex-wrap mb-3">
              {LOG_LEVELS.map(l => (
                <button
                  key={l}
                  onClick={() => setSelectedLevel(l)}
                  className={`px-3 py-1.5 text-[11px] font-mono rounded-[2px] border transition-colors ${selectedLevel === l ? 'border-[color:var(--accent-500)] bg-[color:var(--accent-500)]/20' : 'border-[color:var(--border-default)] bg-[color:var(--bg-app)] hover:border-[#555]'}`}
                  style={{ color: levelColor(l) }}
                >
                  {l}
                </button>
              ))}
            </div>
            <button
              onClick={handleSetLevel}
              disabled={setting || selectedLevel === logLevel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] bg-[color:var(--accent-500)] hover:bg-[#1a8ad4] text-white rounded-[2px] disabled:opacity-50"
            >
              {setting ? <RefreshCw size={11} className="animate-spin" /> : <CheckCircle size={11} />}
              {setting ? 'Applying…' : `Set to "${selectedLevel}"`}
            </button>
          </div>

          {/* Flush Logs */}
          <div className="bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-[3px] p-4">
            <div className="text-[11px] text-[#888] uppercase tracking-wider mb-1">Flush Logs</div>
            <div className="text-[11px] text-[#666] mb-3">Immediately write all buffered log entries to disk and clear the in-memory buffer.</div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleFlush}
                disabled={flushing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] bg-[#c0392b] hover:bg-[#e74c3c] text-white rounded-[2px] disabled:opacity-50"
              >
                {flushing ? <RefreshCw size={11} className="animate-spin" /> : <FileText size={11} />}
                {flushing ? 'Flushing…' : 'Flush Logs'}
              </button>
              {lastFlush && <span className="text-[11px] text-[#4ec9b0]">Last flushed: {lastFlush}</span>}
            </div>
          </div>

          {error && <div className="text-[#f48771] text-[11px] bg-[#3a1c1c] px-3 py-2 rounded-[2px]">{error}</div>}
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════
// TAB 4 — Backup Schedules
// ══════════════════════════════════════════════════════════════════════════
const BackupSchedulesTab = () => {
  const [schedules, setSchedules] = useState([]);
  const [history, setHistory] = useState([]);
  const [loadingS, setLoadingS] = useState(true);
  const [loadingH, setLoadingH] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [popup, setPopup] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const loadSchedules = async () => {
    setLoadingS(true);
    try { const r = await SecurityAccessService.listBackupSchedules(); setSchedules(Array.isArray(r) ? r : []); }
    catch { setSchedules([]); } finally { setLoadingS(false); }
  };

  const loadHistory = async (scheduleId) => {
    setLoadingH(true);
    try {
      const params = scheduleId ? { schedule_id: scheduleId, limit: 20 } : { limit: 20 };
      const r = await SecurityAccessService.listBackupHistory(params);
      setHistory(Array.isArray(r) ? r : []);
    } catch { setHistory([]); } finally { setLoadingH(false); }
  };

  useEffect(() => { loadSchedules(); loadHistory(); }, []);

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete backup schedule "${row.name}"?`)) return;
    setDeleting(row.id);
    try { await SecurityAccessService.deleteBackupSchedule(row.id); if (selectedSchedule?.id === row.id) setSelectedSchedule(null); loadSchedules(); }
    catch (err) { alert(err.response?.data?.message || err.message); }
    finally { setDeleting(null); }
  };

  const handleSelectSchedule = (row) => {
    const next = selectedSchedule?.id === row.id ? null : row;
    setSelectedSchedule(next);
    loadHistory(next?.id);
  };

  const CreatePopup = ({ onClose, onSaved }) => {
    const [form, setForm] = useState({ name: '', schedule_cron: '0 2 * * *', backup_type: 'full', target_path: '/backups/daily', retention_days: 30, compress: true });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!form.name || !form.schedule_cron || !form.target_path) { setError('Name, Cron Schedule, and Target Path are required.'); return; }
      setSaving(true); setError('');
      try {
        await SecurityAccessService.createBackupSchedule({ ...form, retention_days: Number(form.retention_days) });
        onSaved(); onClose();
      } catch (err) { setError(err.response?.data?.message || err.message); }
      finally { setSaving(false); }
    };

    return (
      <Modal title="New Backup Schedule" width={460} onClose={onClose}>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <Lbl t="Name" req>
            <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Daily DB Backup" />
          </Lbl>
          <div className="grid grid-cols-2 gap-3">
            <Lbl t="Cron Schedule" req>
              <input className={inp} value={form.schedule_cron} onChange={e => set('schedule_cron', e.target.value)} placeholder="0 2 * * *" />
            </Lbl>
            <Lbl t="Backup Type">
              <select className={inp} value={form.backup_type} onChange={e => set('backup_type', e.target.value)}>
                {['full', 'incremental', 'differential'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Lbl>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Lbl t="Target Path" req>
              <input className={inp} value={form.target_path} onChange={e => set('target_path', e.target.value)} placeholder="/backups/db" />
            </Lbl>
            <Lbl t="Retention Days">
              <input type="number" min="1" className={inp} value={form.retention_days} onChange={e => set('retention_days', e.target.value)} />
            </Lbl>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-[#ccc] cursor-pointer select-none">
            <input type="checkbox" checked={form.compress} onChange={e => set('compress', e.target.checked)} className="accent-[color:var(--accent-500)]" />
            Compress backup archive
          </label>
          {error && <div className="text-[#f48771] text-[11px] bg-[#3a1c1c] px-3 py-2 rounded-[2px]">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-[11px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] rounded-[2px]">Cancel</button>
            <button type="submit" disabled={saving} className="px-3 py-1.5 text-[11px] bg-[color:var(--accent-500)] hover:bg-[#1a8ad4] text-white rounded-[2px] disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </Modal>
    );
  };

  const statusColor = (s) => {
    if (s === 'success') return 'text-[#4ec9b0]';
    if (s === 'failed') return 'text-[#f48771]';
    return 'text-[#888]';
  };

  const sCols = [['#', 'w-10'], ['Name', 'w-48'], ['Cron', 'w-32'], ['Type', 'w-28'], ['Target Path', 'flex-1'], ['Retention', 'w-20'], ['Compress', 'w-20'], ['Enabled', 'w-20'], ['Created', 'w-36'], ['', 'w-10']];
  const hCols = [['#', 'w-10'], ['Schedule', 'w-16'], ['Type', 'w-24'], ['Status', 'w-20'], ['File Path', 'flex-1'], ['File Size', 'w-24'], ['Started', 'w-36'], ['Finished', 'w-36']];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {popup && <CreatePopup onClose={() => setPopup(false)} onSaved={loadSchedules} />}
      {/* Schedules Panel */}
      <div className="flex flex-col" style={{ height: '55%' }}>
        <div className="flex items-center gap-2 px-2 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40">
          <span className="text-[11px] text-[#aaa] font-medium ml-1 mr-2">Schedules</span>
          <button onClick={() => setPopup(true)} className="flex items-center gap-1 px-2 py-1 text-[11px] bg-[color:var(--accent-500)] hover:bg-[#1a8ad4] text-white rounded-[2px]">
            <Plus size={11} /> New Schedule
          </button>
          <button onClick={loadSchedules} className="flex items-center gap-1 px-2 py-1 text-[11px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] rounded-[2px]">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
        <div className="flex bg-[color:var(--bg-surface-2)] border-b border-black/40 select-none shrink-0">
          {sCols.map(([label, width]) => (
            <div key={label} className={`${width} px-3 py-1.5 text-[11px] font-medium text-[#aaa] shrink-0`}>{label}</div>
          ))}
        </div>
        <div className="flex-1 overflow-auto">
          {loadingS ? (
            <div className="flex items-center justify-center h-20 text-[11px] text-[#555]">Loading…</div>
          ) : schedules.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-[11px] text-[#555]">No backup schedules configured</div>
          ) : schedules.map((row, idx) => (
            <div
              key={row.id}
              onClick={() => handleSelectSchedule(row)}
              className={`flex items-center border-b border-black/20 cursor-pointer ${selectedSchedule?.id === row.id ? 'bg-blue-600/20' : idx % 2 === 0 ? 'bg-[color:var(--bg-app)] hover:bg-blue-600/10' : 'bg-[color:var(--bg-surface-1)] hover:bg-blue-600/10'}`}
            >
              <div className="w-10 px-3 py-1.5 text-[11px] text-[#555] shrink-0">{row.id}</div>
              <div className="w-48 px-3 py-1.5 text-[11px] text-[color:var(--text-primary)] shrink-0">{fmt(row.name)}</div>
              <div className="w-32 px-3 py-1.5 text-[11px] text-[#9cdcfe] font-mono shrink-0">{fmt(row.schedule_cron)}</div>
              <div className="w-28 px-3 py-1.5 text-[11px] text-[#ccc] shrink-0">{fmt(row.backup_type)}</div>
              <div className="flex-1 px-3 py-1.5 text-[11px] text-[#aaa] font-mono truncate">{fmt(row.target_path)}</div>
              <div className="w-20 px-3 py-1.5 text-[11px] text-[#ccc] shrink-0">{fmt(row.retention_days)}d</div>
              <div className="w-20 px-3 py-1.5 shrink-0"><Badge on={row.compress} label={row.compress ? 'Yes' : 'No'} /></div>
              <div className="w-20 px-3 py-1.5 shrink-0"><Badge on={row.enabled} /></div>
              <div className="w-36 px-3 py-1.5 text-[11px] text-[#888] shrink-0">{fmtDate(row.created_at)}</div>
              <div className="w-10 px-2 py-1.5 shrink-0">
                <button onClick={e => { e.stopPropagation(); handleDelete(row); }} disabled={deleting === row.id} className="text-[#555] hover:text-[#f48771]" title="Delete">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="h-6 bg-[color:var(--bg-surface-1)] border-t border-black/40 flex items-center px-4 text-[11px] text-[#888]">
          {selectedSchedule ? `Showing history for: ${selectedSchedule.name}` : 'Click a schedule to filter history'} — Total: {schedules.length}
        </div>
      </div>
      {/* History Panel */}
      <div className="flex flex-col flex-1 border-t-2 border-black/40">
        <div className="flex items-center gap-2 px-2 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40">
          <span className="text-[11px] text-[#aaa] font-medium ml-1 mr-2">Backup History</span>
          <button onClick={() => loadHistory(selectedSchedule?.id)} className="flex items-center gap-1 px-2 py-1 text-[11px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] rounded-[2px]">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
        <div className="flex bg-[color:var(--bg-surface-2)] border-b border-black/40 select-none shrink-0">
          {hCols.map(([label, width]) => (
            <div key={label} className={`${width} px-3 py-1.5 text-[11px] font-medium text-[#aaa] shrink-0`}>{label}</div>
          ))}
        </div>
        <div className="flex-1 overflow-auto">
          {loadingH ? (
            <div className="flex items-center justify-center h-16 text-[11px] text-[#555]">Loading…</div>
          ) : history.length === 0 ? (
            <div className="flex items-center justify-center h-16 text-[11px] text-[#555]">No backup history available</div>
          ) : history.map((row, idx) => (
            <div key={row.id} className={`flex items-center border-b border-black/20 hover:bg-blue-600/10 ${idx % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'}`}>
              <div className="w-10 px-3 py-1.5 text-[11px] text-[#555] shrink-0">{row.id}</div>
              <div className="w-16 px-3 py-1.5 text-[11px] text-[#555] shrink-0">{fmt(row.schedule_id)}</div>
              <div className="w-24 px-3 py-1.5 text-[11px] text-[#ccc] shrink-0">{fmt(row.backup_type)}</div>
              <div className={`w-20 px-3 py-1.5 text-[11px] font-medium shrink-0 ${statusColor(row.status)}`}>{fmt(row.status)}</div>
              <div className="flex-1 px-3 py-1.5 text-[11px] text-[#aaa] font-mono truncate">{fmt(row.file_path)}</div>
              <div className="w-24 px-3 py-1.5 text-[11px] text-[#9cdcfe] shrink-0">{fmtBytes(row.file_size_bytes)}</div>
              <div className="w-36 px-3 py-1.5 text-[11px] text-[#888] shrink-0">{fmtDate(row.started_at)}</div>
              <div className="w-36 px-3 py-1.5 text-[11px] text-[#888] shrink-0">{fmtDate(row.finished_at)}</div>
            </div>
          ))}
        </div>
        <div className="h-6 bg-[color:var(--accent-500)] text-white flex items-center px-4 text-[11px]">History Records: {history.length}</div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════
// TAB 5 — Plugin Management
// ══════════════════════════════════════════════════════════════════════════
const PluginManagementTab = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [uninstalling, setUninstalling] = useState(null);

  const load = async () => {
    setLoading(true);
    try { const r = await SecurityAccessService.listPlugins(); setData(Array.isArray(r) ? r : []); }
    catch { setData([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleToggle = async (row) => {
    setToggling(row.id);
    try { await SecurityAccessService.togglePlugin(row.id, !row.enabled); load(); }
    catch (err) { alert(err.response?.data?.message || err.message); }
    finally { setToggling(null); }
  };

  const handleUninstall = async (row) => {
    if (!window.confirm(`Uninstall plugin "${row.name}"? This cannot be undone.`)) return;
    setUninstalling(row.id);
    try { await SecurityAccessService.uninstallPlugin(row.id); load(); }
    catch (err) { alert(err.response?.data?.message || err.message); }
    finally { setUninstalling(null); }
  };

  const InstallPopup = ({ onClose, onSaved }) => {
    const [form, setForm] = useState({ name: '', version: '1.0.0', description: '', plugin_type: 'notification', config: '{}', priority: 100 });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!form.name || !form.version) { setError('Name and Version are required.'); return; }
      let config;
      try { config = JSON.parse(form.config); } catch { setError('Config must be valid JSON.'); return; }
      setSaving(true); setError('');
      try {
        await SecurityAccessService.installPlugin({ ...form, config, priority: Number(form.priority) });
        onSaved(); onClose();
      } catch (err) { setError(err.response?.data?.message || err.message); }
      finally { setSaving(false); }
    };

    return (
      <Modal title="Install Plugin" width={500} onClose={onClose}>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Lbl t="Plugin Name" req>
              <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="email-notifier" />
            </Lbl>
            <Lbl t="Version" req>
              <input className={inp} value={form.version} onChange={e => set('version', e.target.value)} placeholder="1.0.0" />
            </Lbl>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Lbl t="Plugin Type">
              <select className={inp} value={form.plugin_type} onChange={e => set('plugin_type', e.target.value)}>
                {['notification', 'analytics', 'integration', 'security', 'reporting', 'other'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Lbl>
            <Lbl t="Priority">
              <input type="number" min="0" max="1000" className={inp} value={form.priority} onChange={e => set('priority', e.target.value)} />
            </Lbl>
          </div>
          <Lbl t="Description">
            <input className={inp} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description of the plugin" />
          </Lbl>
          <Lbl t="Config (JSON)">
            <textarea
              className={`${inp} font-mono resize-y`}
              rows={4}
              value={form.config}
              onChange={e => set('config', e.target.value)}
              placeholder='{ "key": "value" }'
            />
          </Lbl>
          {error && <div className="text-[#f48771] text-[11px] bg-[#3a1c1c] px-3 py-2 rounded-[2px]">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-[11px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] rounded-[2px]">Cancel</button>
            <button type="submit" disabled={saving} className="px-3 py-1.5 text-[11px] bg-[color:var(--accent-500)] hover:bg-[#1a8ad4] text-white rounded-[2px] disabled:opacity-50">
              {saving ? 'Installing…' : 'Install Plugin'}
            </button>
          </div>
        </form>
      </Modal>
    );
  };

  const typeBadge = (t) => {
    const map = { notification: '#9cdcfe', analytics: '#4ec9b0', integration: '#d97706', security: '#22c55e', reporting: '#888', other: '#555' };
    return <span className="text-[10px] font-mono" style={{ color: map[t] || '#ccc' }}>{t}</span>;
  };

  const cols = [['#', 'w-10'], ['Name', 'w-44'], ['Version', 'w-20'], ['Type', 'w-28'], ['Description', 'flex-1'], ['Priority', 'w-20'], ['Status', 'w-20'], ['Installed', 'w-36'], ['Actions', 'w-24']];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {popup && <InstallPopup onClose={() => setPopup(false)} onSaved={load} />}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40">
        <button onClick={() => setPopup(true)} className="flex items-center gap-1 px-2 py-1 text-[11px] bg-[color:var(--accent-500)] hover:bg-[#1a8ad4] text-white rounded-[2px]">
          <Plus size={11} /> Install Plugin
        </button>
        <button onClick={load} className="flex items-center gap-1 px-2 py-1 text-[11px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--bg-surface-3)] text-[#ccc] rounded-[2px]">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>
      <div className="flex bg-[color:var(--bg-surface-2)] border-b border-black/40 select-none">
        {cols.map(([label, width]) => (
          <div key={label} className={`${width} px-3 py-1.5 text-[11px] font-medium text-[#aaa] shrink-0`}>{label}</div>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-20 text-[11px] text-[#555]">Loading…</div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-[11px] text-[#555]">No plugins installed</div>
        ) : data.map((row, idx) => (
          <div key={row.id} className={`flex items-center border-b border-black/20 hover:bg-blue-600/10 ${idx % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'}`}>
            <div className="w-10 px-3 py-1.5 text-[11px] text-[#555] shrink-0">{row.id}</div>
            <div className="w-44 px-3 py-1.5 text-[11px] text-[color:var(--text-primary)] font-medium shrink-0">{fmt(row.name)}</div>
            <div className="w-20 px-3 py-1.5 text-[11px] text-[#888] font-mono shrink-0">{fmt(row.version)}</div>
            <div className="w-28 px-3 py-1.5 shrink-0">{typeBadge(row.plugin_type)}</div>
            <div className="flex-1 px-3 py-1.5 text-[11px] text-[#aaa] truncate">{fmt(row.description)}</div>
            <div className="w-20 px-3 py-1.5 text-[11px] text-[#9cdcfe] shrink-0">{fmt(row.priority)}</div>
            <div className="w-20 px-3 py-1.5 shrink-0"><Badge on={row.enabled} /></div>
            <div className="w-36 px-3 py-1.5 text-[11px] text-[#888] shrink-0">{fmtDate(row.installed_at)}</div>
            <div className="w-24 px-2 py-1.5 flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleToggle(row)}
                disabled={toggling === row.id}
                className={`p-1 rounded-[2px] ${row.enabled ? 'text-[#4ec9b0] hover:bg-[#4ec9b0]/10' : 'text-[#555] hover:text-[#4ec9b0] hover:bg-[#4ec9b0]/10'}`}
                title={row.enabled ? 'Disable' : 'Enable'}
              >
                {row.enabled ? <Power size={11} /> : <PowerOff size={11} />}
              </button>
              <button
                onClick={() => handleUninstall(row)}
                disabled={uninstalling === row.id}
                className="p-1 text-[#555] hover:text-[#f48771] hover:bg-[#f48771]/10 rounded-[2px]"
                title="Uninstall"
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="h-6 bg-[color:var(--accent-500)] text-white flex items-center px-4 text-[11px]">Total: {data.length}</div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════
// MAIN VIEW
// ══════════════════════════════════════════════════════════════════════════
const TAB_MAP = {
  'IP Restrictions':      { id: 'ip',      label: 'IP Restrictions',      icon: Shield },
  'Connection Throttle':  { id: 'throttle', label: 'Connection Throttle', icon: Sliders },
  'Log Management':       { id: 'logs',    label: 'Log Management',        icon: FileText },
  'Backup Schedules':     { id: 'backup',  label: 'Backup Schedules',      icon: Database },
  'Plugin Management':    { id: 'plugins', label: 'Plugin Management',     icon: HardDrive },
};

const TABS = Object.values(TAB_MAP);

const SecurityAccessView = ({ initialTab }) => {
  const startTab = (initialTab && TAB_MAP[initialTab]?.id) || 'ip';
  const [tab, setTab] = useState(startTab);

  useEffect(() => {
    if (initialTab && TAB_MAP[initialTab]) {
      setTab(TAB_MAP[initialTab].id);
    }
  }, [initialTab]);

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden">
      <div className="flex items-center px-4 py-2 bg-[color:var(--bg-surface-1)] border-b border-black/40">
        <Shield size={13} className="text-[#21BA45] mr-2" />
        <span className="text-[11px] text-[#888]">Security &amp; Access — IP restrictions, throttle rules, log level, backup schedules, and plugin management. Requires <span className="text-[#9cdcfe]">server_admin</span> permission.</span>
      </div>
      <div className="flex bg-[color:var(--bg-surface-1)] border-b border-black/40">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 h-[30px] text-[11px] border-b-2 transition-colors ${tab === id ? 'border-[color:var(--accent-500)] text-[color:var(--text-primary)] bg-[color:var(--bg-app)]' : 'border-transparent text-[#888] hover:text-[#ccc] hover:bg-[color:var(--bg-surface-1)]'}`}
          >
            <Icon size={11} />
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'ip'      && <IpRestrictionsTab />}
        {tab === 'throttle' && <ConnectionThrottleTab />}
        {tab === 'logs'    && <LogManagementTab />}
        {tab === 'backup'  && <BackupSchedulesTab />}
        {tab === 'plugins' && <PluginManagementTab />}
      </div>
    </div>
  );
};

export default SecurityAccessView;
