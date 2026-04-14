import React, { useState, useEffect } from 'react';
import { CommunicationsService } from '../../services/communications.service';
import { Plus, RefreshCw, X, Send, Trash2, Edit2, CheckCircle, BarChart2, MessageSquare, Mail, Bell, Smartphone } from 'lucide-react';

const fmt = (v) => (v == null ? '—' : v);
const fmtTs = (v) => { if (!v) return '—'; try { return new Date(v * 1000).toLocaleString(); } catch { return v; } };
const inp = "w-full bg-[color:var(--bg-surface-2)] border border-[#555] text-[color:var(--text-primary)] text-[12px] px-2 py-1.5 rounded-[2px] focus:outline-none focus:border-[color:var(--accent-500)]";
const Lbl = ({ t, req, children }) => (
  <div className="flex flex-col gap-0.5">
    <label className="text-[10px] text-[#888] uppercase tracking-wider">{t}{req && <span className="text-[#f48771] ml-0.5">*</span>}</label>
    {children}
  </div>
);

// ── Shared Modal Shell ─────────────────────────────────────────────────────
const Modal = ({ title, width = 420, onClose, children }) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={onClose}>
    <div className={`bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-[3px] shadow-2xl`} style={{ width }} onClick={e => e.stopPropagation()}>
      <div className="flex items-center h-9 px-4 border-b border-black/40 bg-[color:var(--bg-surface-1)]">
        <span className="text-[12px] font-semibold text-[color:var(--text-primary)] flex-1">{title}</span>
        <button onClick={onClose} className="text-[#555] hover:text-[#ccc]"><X size={14} /></button>
      </div>
      {children}
    </div>
  </div>
);

// ── Result Box ─────────────────────────────────────────────────────────────
const ResultBox = ({ result }) => (
  <div className="bg-[#1e3a2e] border border-[#4ec9b0]/30 rounded-[2px] px-4 py-3">
    <div className="text-[10px] text-[#4ec9b0] font-semibold uppercase mb-2">Success</div>
    <pre className="text-[11px] text-[color:var(--text-primary)] font-mono whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════
// TAB 1 — Auto Notification Rules
// ══════════════════════════════════════════════════════════════════════════
const AutoNotificationRulesTab = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState(null); // null | { mode: 'create' | 'edit', row?: obj }
  const [deleting, setDeleting] = useState(null);

  const fetch = async () => {
    setLoading(true);
    try { const r = await CommunicationsService.listAutoNotificationRules(); setData(Array.isArray(r) ? r : r?.data ?? []); }
    catch { setData([]); } finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, []);

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete rule "${row.name || row.id}"?`)) return;
    setDeleting(row.id);
    try { await CommunicationsService.deleteAutoNotificationRule(row.id); fetch(); }
    catch (err) { alert(err.response?.data?.message || err.message); }
    finally { setDeleting(null); }
  };

  // Create/Edit Popup
  const RulePopup = ({ mode, row, onClose, onSaved }) => {
    const [form, setForm] = useState({
      name: row?.name || '', event_type: row?.event_type || '',
      channel: row?.channel || 'email', template: row?.template || '', enabled: row?.enabled ?? true,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!form.name || !form.event_type) { setError('Name and Event Type are required.'); return; }
      setLoading(true); setError('');
      try {
        if (mode === 'create') {
          await CommunicationsService.createAutoNotificationRule(form);
        } else {
          await CommunicationsService.updateAutoNotificationRule({ id: row.id, ...form });
        }
        onSaved(); onClose();
      } catch (err) { setError(err.response?.data?.message || err.message); }
      finally { setLoading(false); }
    };

    return (
      <Modal title={mode === 'create' ? 'New Notification Rule' : `Edit Rule #${row.id}`} onClose={onClose}>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Lbl t="Name" req><input className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Welcome Email" /></Lbl>
            <Lbl t="Event Type" req><input className={inp} value={form.event_type} onChange={e => set('event_type', e.target.value)} placeholder="account.created" /></Lbl>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Lbl t="Channel">
              <select className={inp} value={form.channel} onChange={e => set('channel', e.target.value)}>
                {['email', 'sms', 'push', 'in_app'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Lbl>
            <Lbl t="Template"><input className={inp} value={form.template} onChange={e => set('template', e.target.value)} placeholder="welcome_v1" /></Lbl>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-[#ccc] cursor-pointer">
            <input type="checkbox" checked={form.enabled} onChange={e => set('enabled', e.target.checked)} className="accent-[color:var(--accent-500)]" />
            Enabled
          </label>
          {error && <div className="text-[11px] text-[#f48771] bg-[color:var(--bg-surface-2)] px-3 py-1.5 rounded-[2px]">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="h-[26px] px-4 text-[11px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--border-strong)] text-[#ccc] rounded-[2px]">Cancel</button>
            <button type="submit" disabled={loading} className="h-[26px] px-4 text-[11px] bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] disabled:opacity-50 text-white rounded-[2px]">{loading ? 'Saving…' : mode === 'create' ? 'Create' : 'Update'}</button>
          </div>
        </form>
      </Modal>
    );
  };

  const cols = [
    ['ID', 'w-[60px]'], ['Name', 'w-[180px]'], ['Event Type', 'w-[180px]'], ['Channel', 'w-[100px]'], ['Template', 'w-[160px]'], ['Enabled', 'flex-1'], ['Created', 'w-[150px]'],
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
        <button onClick={() => setPopup({ mode: 'create' })}
          className="flex items-center gap-1.5 h-[24px] px-3 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px]">
          <Plus size={12} /> New Rule
        </button>
        <div className="ml-auto"><button onClick={fetch} className="text-[#999] hover:text-white"><RefreshCw size={13} /></button></div>
      </div>
      <div className="flex bg-[color:var(--bg-surface-2)] border-b border-black/40 select-none shrink-0">
        {cols.map(([l, w]) => <div key={l} className={`${w} px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 shrink-0`}>{l}</div>)}
        <div className="w-[100px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] shrink-0">Actions</div>
      </div>
      <div className="flex-1 overflow-auto no-scrollbar">
        {data.map((row, idx) => (
          <div key={row.id || idx} className={`flex border-b border-black/10 hover:bg-blue-600/10 ${idx % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'}`}>
            <div className="w-[60px] px-3 py-1 text-[12px] text-[#9cdcfe] font-semibold border-r border-black/10 shrink-0 flex items-center">{fmt(row.id)}</div>
            <div className="w-[180px] px-3 py-1 text-[12px] text-[color:var(--text-primary)] border-r border-black/10 shrink-0 truncate flex items-center">{fmt(row.name)}</div>
            <div className="w-[180px] px-3 py-1 text-[12px] text-[#9cdcfe] font-mono border-r border-black/10 shrink-0 truncate flex items-center">{fmt(row.event_type)}</div>
            <div className="w-[100px] px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 flex items-center">{fmt(row.channel)}</div>
            <div className="w-[160px] px-3 py-1 text-[12px] text-[#888] font-mono border-r border-black/10 shrink-0 truncate flex items-center">{fmt(row.template)}</div>
            <div className="flex-1 px-3 py-1 border-r border-black/10 flex items-center">
              <span className={`text-[11px] font-semibold ${row.enabled ? 'text-[#4ec9b0]' : 'text-[#f48771]'}`}>{row.enabled ? 'Yes' : 'No'}</span>
            </div>
            <div className="w-[150px] px-3 py-1 text-[11px] text-[#888] font-mono border-r border-black/10 shrink-0 flex items-center">{fmtTs(row.created_at)}</div>
            <div className="w-[100px] px-2 py-1 flex items-center gap-1 shrink-0">
              <button onClick={() => setPopup({ mode: 'edit', row })} title="Edit"
                className="flex items-center gap-1 h-[20px] px-2 bg-[color:var(--accent-500)]/20 hover:bg-[color:var(--accent-500)]/40 text-[color:var(--accent-500)] text-[10px] rounded-[2px]">
                <Edit2 size={10} />
              </button>
              <button onClick={() => handleDelete(row)} disabled={deleting === row.id} title="Delete"
                className="flex items-center gap-1 h-[20px] px-2 bg-[#f48771]/20 hover:bg-[#f48771]/40 text-[#f48771] text-[10px] rounded-[2px] disabled:opacity-50">
                <Trash2 size={10} />
              </button>
            </div>
          </div>
        ))}
        {loading && <div className="p-4 text-[color:var(--text-muted)] text-[12px] italic">Loading…</div>}
        {!loading && data.length === 0 && <div className="p-4 text-[color:var(--text-muted)] text-[12px] italic">No notification rules found.</div>}
        {[...Array(10)].map((_, i) => <div key={i} className={`flex border-b border-black/5 opacity-30 h-6 ${i % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'}`}></div>)}
      </div>
      <div className="h-6 bg-[color:var(--accent-500)] text-white flex items-center px-4 text-[11px] select-none shrink-0 border-t border-[color:var(--accent-700)]">
        Total: {data.length}
      </div>
      {popup && <RulePopup mode={popup.mode} row={popup.row} onClose={() => setPopup(null)} onSaved={fetch} />}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════
// TAB 2 — Email Campaigns
// ══════════════════════════════════════════════════════════════════════════
const EmailCampaignsTab = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [statsPopup, setStatsPopup] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const fetch = async () => {
    setLoading(true);
    try { const r = await CommunicationsService.listEmailCampaigns(); setData(Array.isArray(r) ? r : r?.data ?? []); }
    catch { setData([]); } finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, []);

  const handleSend = async (row) => {
    if (!window.confirm(`Send campaign "${row.name || row.id}" to all recipients?`)) return;
    setActionLoading(row.id);
    try { await CommunicationsService.sendEmailCampaign(row.id); fetch(); }
    catch (err) { alert(err.response?.data?.message || err.message); }
    finally { setActionLoading(null); }
  };

  const handleStats = async (row) => {
    setActionLoading(`stats-${row.id}`);
    try {
      const res = await CommunicationsService.getEmailCampaignStats(row.id);
      setStatsPopup({ row, stats: res });
    } catch (err) { alert(err.response?.data?.message || err.message); }
    finally { setActionLoading(null); }
  };

  const CreateCampaignPopup = ({ onClose, onSaved }) => {
    const [form, setForm] = useState({ name: '', subject: '', body: '', recipients: '', scheduled_at: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!form.name || !form.subject) { setError('Name and Subject are required.'); return; }
      setLoading(true); setError('');
      try {
        const payload = { name: form.name, subject: form.subject, body: form.body };
        if (form.recipients) payload.recipients = form.recipients;
        if (form.scheduled_at) payload.scheduled_at = form.scheduled_at;
        await CommunicationsService.createEmailCampaign(payload);
        onSaved(); onClose();
      } catch (err) { setError(err.response?.data?.message || err.message); }
      finally { setLoading(false); }
    };

    return (
      <Modal title="New Email Campaign" width={500} onClose={onClose}>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Lbl t="Campaign Name" req><input className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Q2 Newsletter" /></Lbl>
            <Lbl t="Subject" req><input className={inp} value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Your subject line" /></Lbl>
          </div>
          <Lbl t="Body">
            <textarea className={inp + ' resize-none'} rows={4} value={form.body} onChange={e => set('body', e.target.value)} placeholder="Email body content…" />
          </Lbl>
          <div className="grid grid-cols-2 gap-3">
            <Lbl t="Recipients (segment/list)"><input className={inp} value={form.recipients} onChange={e => set('recipients', e.target.value)} placeholder="all_users" /></Lbl>
            <Lbl t="Scheduled At"><input className={inp} type="datetime-local" value={form.scheduled_at} onChange={e => set('scheduled_at', e.target.value)} /></Lbl>
          </div>
          {error && <div className="text-[11px] text-[#f48771] bg-[color:var(--bg-surface-2)] px-3 py-1.5 rounded-[2px]">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="h-[26px] px-4 text-[11px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--border-strong)] text-[#ccc] rounded-[2px]">Cancel</button>
            <button type="submit" disabled={loading} className="h-[26px] px-4 text-[11px] bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] disabled:opacity-50 text-white rounded-[2px]">{loading ? 'Creating…' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    );
  };

  const cols = [['ID', 'w-[60px]'], ['Name', 'w-[200px]'], ['Subject', 'w-[220px]'], ['Status', 'w-[110px]'], ['Recipients', 'w-[110px]'], ['Sent At', 'flex-1'], ['Created', 'w-[150px]']];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 h-[24px] px-3 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px]">
          <Plus size={12} /> New Campaign
        </button>
        <div className="ml-auto"><button onClick={fetch} className="text-[#999] hover:text-white"><RefreshCw size={13} /></button></div>
      </div>
      <div className="flex bg-[color:var(--bg-surface-2)] border-b border-black/40 select-none shrink-0">
        {cols.map(([l, w]) => <div key={l} className={`${w} px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 shrink-0`}>{l}</div>)}
        <div className="w-[130px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] shrink-0">Actions</div>
      </div>
      <div className="flex-1 overflow-auto no-scrollbar">
        {data.map((row, idx) => (
          <div key={row.id || idx} className={`flex border-b border-black/10 hover:bg-blue-600/10 ${idx % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'}`}>
            <div className="w-[60px] px-3 py-1 text-[12px] text-[#9cdcfe] font-semibold border-r border-black/10 shrink-0 flex items-center">{fmt(row.id)}</div>
            <div className="w-[200px] px-3 py-1 text-[12px] text-[color:var(--text-primary)] border-r border-black/10 shrink-0 truncate flex items-center">{fmt(row.name)}</div>
            <div className="w-[220px] px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 truncate flex items-center">{fmt(row.subject)}</div>
            <div className="w-[110px] px-3 py-1 border-r border-black/10 shrink-0 flex items-center">
              <span className={`text-[11px] font-semibold ${row.status === 'sent' ? 'text-[#4ec9b0]' : row.status === 'scheduled' ? 'text-[#f4c96e]' : 'text-[color:var(--text-muted)]'}`}>{fmt(row.status)}</span>
            </div>
            <div className="w-[110px] px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 flex items-center">{fmt(row.recipient_count)}</div>
            <div className="flex-1 px-3 py-1 text-[11px] text-[#888] font-mono border-r border-black/10 flex items-center">{fmtTs(row.sent_at)}</div>
            <div className="w-[150px] px-3 py-1 text-[11px] text-[#888] font-mono border-r border-black/10 shrink-0 flex items-center">{fmtTs(row.created_at)}</div>
            <div className="w-[130px] px-2 py-1 flex items-center gap-1 shrink-0">
              <button onClick={() => handleSend(row)} disabled={actionLoading === row.id} title="Send Campaign"
                className="flex items-center gap-1 h-[20px] px-2 bg-[#4ec9b0]/20 hover:bg-[#4ec9b0]/40 text-[#4ec9b0] text-[10px] rounded-[2px] disabled:opacity-50">
                <Send size={10} /> Send
              </button>
              <button onClick={() => handleStats(row)} disabled={actionLoading === `stats-${row.id}`} title="View Stats"
                className="flex items-center gap-1 h-[20px] px-2 bg-[#f4c96e]/20 hover:bg-[#f4c96e]/40 text-[#f4c96e] text-[10px] rounded-[2px] disabled:opacity-50">
                <BarChart2 size={10} />
              </button>
            </div>
          </div>
        ))}
        {loading && <div className="p-4 text-[color:var(--text-muted)] text-[12px] italic">Loading…</div>}
        {!loading && data.length === 0 && <div className="p-4 text-[color:var(--text-muted)] text-[12px] italic">No campaigns found.</div>}
        {[...Array(10)].map((_, i) => <div key={i} className={`flex border-b border-black/5 opacity-30 h-6 ${i % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'}`}></div>)}
      </div>
      <div className="h-6 bg-[color:var(--accent-500)] text-white flex items-center px-4 text-[11px] select-none shrink-0 border-t border-[color:var(--accent-700)]">Total: {data.length}</div>
      {createOpen && <CreateCampaignPopup onClose={() => setCreateOpen(false)} onSaved={fetch} />}
      {statsPopup && (
        <Modal title={`Stats — ${statsPopup.row.name || statsPopup.row.id}`} width={420} onClose={() => setStatsPopup(null)}>
          <div className="p-4">
            <pre className="text-[11px] text-[color:var(--text-primary)] font-mono whitespace-pre-wrap">{JSON.stringify(statsPopup.stats, null, 2)}</pre>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════
// TAB 3 — Message Center
// ══════════════════════════════════════════════════════════════════════════
const MessageCenterTab = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterLogin, setFilterLogin] = useState('');
  const [sendOpen, setSendOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterLogin) params.login = parseInt(filterLogin);
      const r = await CommunicationsService.listMessages(params);
      setData(Array.isArray(r) ? r : r?.data ?? []);
    } catch { setData([]); } finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, []);

  const handleMarkRead = async (row) => {
    setActionLoading(row.id);
    try { await CommunicationsService.markMessageRead(row.id); fetch(); }
    catch (err) { alert(err.response?.data?.message || err.message); }
    finally { setActionLoading(null); }
  };

  const SendMessagePopup = ({ onClose, onSaved }) => {
    const [form, setForm] = useState({ login: '', subject: '', body: '', type: 'info' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!form.login || !form.subject) { setError('Login and Subject are required.'); return; }
      setLoading(true); setError('');
      try {
        await CommunicationsService.sendMessage({ login: parseInt(form.login), subject: form.subject, body: form.body, type: form.type });
        onSaved(); onClose();
      } catch (err) { setError(err.response?.data?.message || err.message); }
      finally { setLoading(false); }
    };

    return (
      <Modal title="Send Message Center Message" width={460} onClose={onClose}>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Lbl t="Account Login" req><input className={inp} type="number" value={form.login} onChange={e => set('login', e.target.value)} placeholder="12345" /></Lbl>
            <Lbl t="Type">
              <select className={inp} value={form.type} onChange={e => set('type', e.target.value)}>
                {['info', 'warning', 'alert', 'news'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Lbl>
          </div>
          <Lbl t="Subject" req><input className={inp} value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Important update" /></Lbl>
          <Lbl t="Body">
            <textarea className={inp + ' resize-none'} rows={3} value={form.body} onChange={e => set('body', e.target.value)} placeholder="Message content…" />
          </Lbl>
          {error && <div className="text-[11px] text-[#f48771] bg-[color:var(--bg-surface-2)] px-3 py-1.5 rounded-[2px]">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="h-[26px] px-4 text-[11px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--border-strong)] text-[#ccc] rounded-[2px]">Cancel</button>
            <button type="submit" disabled={loading} className="h-[26px] px-4 text-[11px] bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] disabled:opacity-50 text-white rounded-[2px]">{loading ? 'Sending…' : 'Send'}</button>
          </div>
        </form>
      </Modal>
    );
  };

  const cols = [['ID', 'w-[60px]'], ['Login', 'w-[90px]'], ['Subject', 'w-[220px]'], ['Type', 'w-[90px]'], ['Read', 'w-[80px]'], ['Sent At', 'flex-1']];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
        <button onClick={() => setSendOpen(true)}
          className="flex items-center gap-1.5 h-[24px] px-3 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px]">
          <MessageSquare size={12} /> Send Message
        </button>
        <div className="flex items-center gap-1.5 ml-3">
          <input value={filterLogin} onChange={e => setFilterLogin(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetch()}
            placeholder="login…" className="h-[22px] w-[90px] bg-[color:var(--bg-surface-2)] border border-[#555] text-[color:var(--text-primary)] text-[11px] px-2 rounded-[2px] focus:outline-none focus:border-[color:var(--accent-500)]" />
          <button onClick={fetch} className="h-[22px] px-2.5 bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--border-strong)] text-[#ccc] text-[11px] rounded-[2px] border border-[#555]">Filter</button>
        </div>
        <div className="ml-auto"><button onClick={fetch} className="text-[#999] hover:text-white"><RefreshCw size={13} /></button></div>
      </div>
      <div className="flex bg-[color:var(--bg-surface-2)] border-b border-black/40 select-none shrink-0">
        {cols.map(([l, w]) => <div key={l} className={`${w} px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 shrink-0`}>{l}</div>)}
        <div className="w-[100px] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] shrink-0">Actions</div>
      </div>
      <div className="flex-1 overflow-auto no-scrollbar">
        {data.map((row, idx) => (
          <div key={row.id || idx} className={`flex border-b border-black/10 hover:bg-blue-600/10 ${idx % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'}`}>
            <div className="w-[60px] px-3 py-1 text-[12px] text-[#9cdcfe] font-semibold border-r border-black/10 shrink-0 flex items-center">{fmt(row.id)}</div>
            <div className="w-[90px] px-3 py-1 text-[12px] text-[color:var(--text-primary)] border-r border-black/10 shrink-0 flex items-center">{fmt(row.account_login ?? row.login)}</div>
            <div className="w-[220px] px-3 py-1 text-[12px] text-[color:var(--text-primary)] border-r border-black/10 shrink-0 truncate flex items-center">{fmt(row.subject)}</div>
            <div className="w-[90px] px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 shrink-0 flex items-center">{fmt(row.type)}</div>
            <div className="w-[80px] px-3 py-1 border-r border-black/10 shrink-0 flex items-center">
              <span className={`text-[11px] font-semibold ${row.read ? 'text-[#4ec9b0]' : 'text-[#f4c96e]'}`}>{row.read ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex-1 px-3 py-1 text-[11px] text-[#888] font-mono border-r border-black/10 flex items-center">{fmtTs(row.sent_at ?? row.created_at)}</div>
            <div className="w-[100px] px-2 py-1 flex items-center shrink-0">
              {!row.read && (
                <button onClick={() => handleMarkRead(row)} disabled={actionLoading === row.id} title="Mark as Read"
                  className="flex items-center gap-1 h-[20px] px-2 bg-[#4ec9b0]/20 hover:bg-[#4ec9b0]/40 text-[#4ec9b0] text-[10px] rounded-[2px] disabled:opacity-50">
                  <CheckCircle size={10} /> Read
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="p-4 text-[color:var(--text-muted)] text-[12px] italic">Loading…</div>}
        {!loading && data.length === 0 && <div className="p-4 text-[color:var(--text-muted)] text-[12px] italic">No messages found.</div>}
        {[...Array(10)].map((_, i) => <div key={i} className={`flex border-b border-black/5 opacity-30 h-6 ${i % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'}`}></div>)}
      </div>
      <div className="h-6 bg-[color:var(--accent-500)] text-white flex items-center px-4 text-[11px] select-none shrink-0 border-t border-[color:var(--accent-700)]">Total: {data.length}</div>
      {sendOpen && <SendMessagePopup onClose={() => setSendOpen(false)} onSaved={fetch} />}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════
// TAB 4 — Push Notifications
// ══════════════════════════════════════════════════════════════════════════
const PushNotificationsTab = () => {
  const inp2 = inp;

  const SingleForm = () => {
    const [form, setForm] = useState({ login: '', title: '', body: '', data: '' });
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!form.login || !form.title) { setError('Login and Title are required.'); return; }
      setLoading(true); setError(''); setResult(null);
      try {
        const payload = { login: parseInt(form.login), title: form.title, body: form.body };
        if (form.data) { try { payload.data = JSON.parse(form.data); } catch { payload.data = form.data; } }
        const res = await CommunicationsService.sendPushNotification(payload);
        setResult(res);
      } catch (err) { setError(err.response?.data?.message || err.message); }
      finally { setLoading(false); }
    };

    return (
      <div className="flex flex-col gap-3">
        <div className="text-[11px] text-[#888] font-semibold uppercase tracking-wider flex items-center gap-1.5"><Bell size={11} className="text-[#f4c96e]" /> Single Push Notification</div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Lbl t="Account Login" req><input className={inp2} type="number" value={form.login} onChange={e => set('login', e.target.value)} placeholder="12345" /></Lbl>
            <Lbl t="Title" req><input className={inp2} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Notification title" /></Lbl>
          </div>
          <Lbl t="Body"><input className={inp2} value={form.body} onChange={e => set('body', e.target.value)} placeholder="Notification body text" /></Lbl>
          <Lbl t="Data (JSON)"><input className={inp2} value={form.data} onChange={e => set('data', e.target.value)} placeholder='{"action":"open_tab","tab":"deposits"}' /></Lbl>
          {error && <div className="text-[11px] text-[#f48771] bg-[color:var(--bg-surface-2)] px-3 py-1.5 rounded-[2px]">{error}</div>}
          {result && <ResultBox result={result} />}
          <button type="submit" disabled={loading}
            className="flex items-center justify-center gap-1.5 h-[28px] px-4 text-[11px] bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] disabled:opacity-50 text-white rounded-[2px] w-fit">
            <Send size={11} /> {loading ? 'Sending…' : 'Send Notification'}
          </button>
        </form>
      </div>
    );
  };

  const BulkForm = () => {
    const [form, setForm] = useState({ logins: '', title: '', body: '', data: '' });
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!form.logins || !form.title) { setError('Logins and Title are required.'); return; }
      setLoading(true); setError(''); setResult(null);
      try {
        const logins = form.logins.split(',').map(s => parseInt(s.trim())).filter(Boolean);
        const payload = { logins, title: form.title, body: form.body };
        if (form.data) { try { payload.data = JSON.parse(form.data); } catch { payload.data = form.data; } }
        const res = await CommunicationsService.sendPushNotificationBulk(payload);
        setResult(res);
      } catch (err) { setError(err.response?.data?.message || err.message); }
      finally { setLoading(false); }
    };

    return (
      <div className="flex flex-col gap-3">
        <div className="text-[11px] text-[#888] font-semibold uppercase tracking-wider flex items-center gap-1.5"><Bell size={11} className="text-[#9cdcfe]" /> Bulk Push Notifications</div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Lbl t="Account Logins (comma-separated)" req>
            <input className={inp2} value={form.logins} onChange={e => set('logins', e.target.value)} placeholder="12345, 12346, 12347" />
          </Lbl>
          <div className="grid grid-cols-2 gap-3">
            <Lbl t="Title" req><input className={inp2} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Important update" /></Lbl>
            <Lbl t="Body"><input className={inp2} value={form.body} onChange={e => set('body', e.target.value)} placeholder="Notification body" /></Lbl>
          </div>
          <Lbl t="Data (JSON)"><input className={inp2} value={form.data} onChange={e => set('data', e.target.value)} placeholder='{"promo":"summer2025"}' /></Lbl>
          {error && <div className="text-[11px] text-[#f48771] bg-[color:var(--bg-surface-2)] px-3 py-1.5 rounded-[2px]">{error}</div>}
          {result && <ResultBox result={result} />}
          <button type="submit" disabled={loading}
            className="flex items-center justify-center gap-1.5 h-[28px] px-4 text-[11px] bg-[#4ec9b0] hover:bg-[#5dd9c0] disabled:opacity-50 text-[color:var(--bg-app)] font-semibold rounded-[2px] w-fit">
            <Send size={11} /> {loading ? 'Sending…' : 'Send Bulk'}
          </button>
        </form>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-auto p-6 flex flex-col gap-8 max-w-[600px]">
      <SingleForm />
      <div className="border-t border-[color:var(--border-default)]"></div>
      <BulkForm />
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════
// TAB 5 — SMS
// ══════════════════════════════════════════════════════════════════════════
const SMSTab = () => {
  const [templates, setTemplates] = useState([]);
  const [tplLoading, setTplLoading] = useState(true);
  const [createTplOpen, setCreateTplOpen] = useState(false);
  const inp2 = inp;

  const fetchTemplates = async () => {
    setTplLoading(true);
    try { const r = await CommunicationsService.listSMSTemplates(); setTemplates(Array.isArray(r) ? r : r?.data ?? []); }
    catch { setTemplates([]); } finally { setTplLoading(false); }
  };
  useEffect(() => { fetchTemplates(); }, []);

  const SendSMSForm = () => {
    const [form, setForm] = useState({ phone: '', message: '', login: '' });
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!form.phone || !form.message) { setError('Phone and Message are required.'); return; }
      setLoading(true); setError(''); setResult(null);
      try {
        const params = { phone: form.phone, message: form.message };
        if (form.login) params.login = parseInt(form.login);
        const res = await CommunicationsService.sendSMS(params);
        setResult(res);
      } catch (err) { setError(err.response?.data?.message || err.message); }
      finally { setLoading(false); }
    };

    return (
      <div className="flex flex-col gap-3">
        <div className="text-[11px] text-[#888] font-semibold uppercase tracking-wider flex items-center gap-1.5"><Smartphone size={11} className="text-[#4ec9b0]" /> Send SMS</div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Lbl t="Phone Number" req><input className={inp2} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1234567890" /></Lbl>
            <Lbl t="Account Login (optional)"><input className={inp2} type="number" value={form.login} onChange={e => set('login', e.target.value)} placeholder="12345" /></Lbl>
          </div>
          <Lbl t="Message" req>
            <textarea className={inp2 + ' resize-none'} rows={3} value={form.message} onChange={e => set('message', e.target.value)} placeholder="Your message…" />
          </Lbl>
          {error && <div className="text-[11px] text-[#f48771] bg-[color:var(--bg-surface-2)] px-3 py-1.5 rounded-[2px]">{error}</div>}
          {result && <ResultBox result={result} />}
          <button type="submit" disabled={loading}
            className="flex items-center justify-center gap-1.5 h-[28px] px-4 text-[11px] bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] disabled:opacity-50 text-white rounded-[2px] w-fit">
            <Send size={11} /> {loading ? 'Sending…' : 'Send SMS'}
          </button>
        </form>
      </div>
    );
  };

  const CreateTemplatePopup = ({ onClose, onSaved }) => {
    const [form, setForm] = useState({ name: '', body: '', variables: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!form.name || !form.body) { setError('Name and Body are required.'); return; }
      setLoading(true); setError('');
      try {
        const payload = { name: form.name, body: form.body };
        if (form.variables) payload.variables = form.variables.split(',').map(s => s.trim()).filter(Boolean);
        await CommunicationsService.createSMSTemplate(payload);
        onSaved(); onClose();
      } catch (err) { setError(err.response?.data?.message || err.message); }
      finally { setLoading(false); }
    };

    return (
      <Modal title="New SMS Template" width={420} onClose={onClose}>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <Lbl t="Template Name" req><input className={inp2} value={form.name} onChange={e => set('name', e.target.value)} placeholder="deposit_confirm" /></Lbl>
          <Lbl t="Body" req>
            <textarea className={inp2 + ' resize-none'} rows={3} value={form.body} onChange={e => set('body', e.target.value)} placeholder="Your deposit of {{amount}} has been confirmed." />
          </Lbl>
          <Lbl t="Variables (comma-separated)"><input className={inp2} value={form.variables} onChange={e => set('variables', e.target.value)} placeholder="amount, currency, date" /></Lbl>
          {error && <div className="text-[11px] text-[#f48771] bg-[color:var(--bg-surface-2)] px-3 py-1.5 rounded-[2px]">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="h-[26px] px-4 text-[11px] bg-[color:var(--bg-surface-2)] hover:bg-[color:var(--border-strong)] text-[#ccc] rounded-[2px]">Cancel</button>
            <button type="submit" disabled={loading} className="h-[26px] px-4 text-[11px] bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] disabled:opacity-50 text-white rounded-[2px]">{loading ? 'Creating…' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    );
  };

  return (
    <div className="flex-1 overflow-auto flex flex-col">
      {/* Send SMS Form */}
      <div className="p-6 max-w-[600px]">
        <SendSMSForm />
      </div>
      <div className="border-t border-[color:var(--border-default)] mx-6"></div>
      {/* Templates Table */}
      <div className="flex flex-col flex-1 mt-4">
        <div className="flex items-center gap-2 px-2 py-1.5 bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0">
          <span className="text-[11px] text-[#888] font-semibold uppercase tracking-wider flex items-center gap-1.5 ml-1"><Smartphone size={11} className="text-[#9cdcfe]" /> SMS Templates</span>
          <button onClick={() => setCreateTplOpen(true)}
            className="flex items-center gap-1.5 h-[22px] px-3 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white text-[11px] rounded-[2px] ml-3">
            <Plus size={11} /> New Template
          </button>
          <div className="ml-auto"><button onClick={fetchTemplates} className="text-[#999] hover:text-white"><RefreshCw size={13} /></button></div>
        </div>
        <div className="flex bg-[color:var(--bg-surface-2)] border-b border-black/40 select-none shrink-0">
          {[['ID', 'w-[60px]'], ['Name', 'w-[200px]'], ['Body', 'flex-1'], ['Variables', 'w-[200px]'], ['Created', 'w-[150px]']].map(([l, w]) =>
            <div key={l} className={`${w} px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-primary)] border-r border-black/20 shrink-0`}>{l}</div>
          )}
        </div>
        <div className="flex-1 overflow-auto no-scrollbar">
          {templates.map((row, idx) => (
            <div key={row.id || idx} className={`flex border-b border-black/10 hover:bg-blue-600/10 ${idx % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'}`}>
              <div className="w-[60px] px-3 py-1 text-[12px] text-[#9cdcfe] font-semibold border-r border-black/10 shrink-0 flex items-center">{fmt(row.id)}</div>
              <div className="w-[200px] px-3 py-1 text-[12px] text-[color:var(--text-primary)] border-r border-black/10 shrink-0 truncate flex items-center">{fmt(row.name)}</div>
              <div className="flex-1 px-3 py-1 text-[12px] text-[color:var(--text-muted)] border-r border-black/10 truncate flex items-center">{fmt(row.body)}</div>
              <div className="w-[200px] px-3 py-1 text-[11px] text-[#888] font-mono border-r border-black/10 shrink-0 truncate flex items-center">
                {Array.isArray(row.variables) ? row.variables.join(', ') : fmt(row.variables)}
              </div>
              <div className="w-[150px] px-3 py-1 text-[11px] text-[#888] font-mono flex items-center">{fmtTs(row.created_at)}</div>
            </div>
          ))}
          {tplLoading && <div className="p-4 text-[color:var(--text-muted)] text-[12px] italic">Loading…</div>}
          {!tplLoading && templates.length === 0 && <div className="p-4 text-[color:var(--text-muted)] text-[12px] italic">No SMS templates found.</div>}
          {[...Array(8)].map((_, i) => <div key={i} className={`flex border-b border-black/5 opacity-30 h-6 ${i % 2 === 0 ? 'bg-[color:var(--bg-app)]' : 'bg-[color:var(--bg-surface-1)]'}`}></div>)}
        </div>
      </div>
      {createTplOpen && <CreateTemplatePopup onClose={() => setCreateTplOpen(false)} onSaved={fetchTemplates} />}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════
// Main View
// ══════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: 'rules', label: 'Auto Notification Rules', icon: Bell },
  { id: 'email', label: 'Email Campaigns', icon: Mail },
  { id: 'msgctr', label: 'Message Center', icon: MessageSquare },
  { id: 'push', label: 'Push Notifications', icon: Bell },
  { id: 'sms', label: 'SMS', icon: Smartphone },
];

const CommunicationsView = () => {
  const [tab, setTab] = useState('rules');

  return (
    <div className="flex-1 bg-[color:var(--bg-app)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-4 py-2 bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0 select-none">
        <span className="text-[11px] text-[#888]">
          Push notifications, SMS, message center, email campaigns, auto-notification rules. Requires <span className="text-[#9cdcfe] font-mono">manage_communications</span> permission.
        </span>
      </div>
      {/* Tab Bar */}
      <div className="flex bg-[color:var(--bg-surface-1)] border-b border-black/40 shrink-0 select-none">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 h-[30px] text-[11px] border-r border-black/30 transition-colors ${tab === id
              ? 'bg-[color:var(--bg-app)] text-white border-t-2 border-t-[color:var(--accent-500)]'
              : 'text-[#888] hover:text-[#ccc] hover:bg-[color:var(--bg-surface-1)]'}`}>
            <Icon size={11} />
            {label}
          </button>
        ))}
      </div>
      {/* Tab Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'rules' && <AutoNotificationRulesTab />}
        {tab === 'email' && <EmailCampaignsTab />}
        {tab === 'msgctr' && <MessageCenterTab />}
        {tab === 'push' && <PushNotificationsTab />}
        {tab === 'sms' && <SMSTab />}
      </div>
    </div>
  );
};

export default CommunicationsView;
