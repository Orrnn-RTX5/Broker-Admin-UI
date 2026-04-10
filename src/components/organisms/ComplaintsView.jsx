import React, { useState, useEffect } from 'react';
import { ReportsService } from '../../services/reports.service';
import { RefreshCw, Plus, CheckCircle, Pencil } from 'lucide-react';

const STATUSES = ['', 'open', 'in_progress', 'resolved'];
const PRIORITIES = ['low', 'medium', 'high'];
const CATEGORIES = ['finance', 'trading', 'technical', 'other'];

const statusColor = (s) => ({
  open: 'text-[#f48771]',
  in_progress: 'text-[#d4a017]',
  resolved: 'text-[#4ec9b0]',
}[s] || 'text-[#888]');

const priorityColor = (p) => ({
  high: 'text-[#f48771]',
  medium: 'text-[#d4a017]',
  low: 'text-[#888]',
}[p] || 'text-[#888]');

const tsFormat = (ts) => ts ? new Date(ts * 1000).toLocaleString() : '—';

const defaultCreate = { account_login: '', subject: '', description: '', category: 'finance', priority: 'medium' };

const ComplaintsView = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [loginFilter, setLoginFilter] = useState('');

  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(defaultCreate);
  const [saving, setSaving] = useState(false);

  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({});

  const [resolveModal, setResolveModal] = useState(null);
  const [resolution, setResolution] = useState('');
  const [resolving, setResolving] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (loginFilter) params.login = parseInt(loginFilter);
      const res = await ReportsService.listComplaints(params);
      setData(Array.isArray(res) ? res : []);
    } catch { setData([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchList(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await ReportsService.createComplaint({
        ...createForm,
        account_login: parseInt(createForm.account_login),
      });
      setCreateModal(false);
      setCreateForm(defaultCreate);
      fetchList();
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    } finally { setSaving(false); }
  };

  const openEdit = (row) => {
    setEditForm({
      id: row.id,
      status: row.status || 'open',
      priority: row.priority || 'medium',
      category: row.category || 'finance',
      assigned_to: row.assigned_to ?? '',
      description: row.description || '',
    });
    setEditModal(row);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...editForm, id: editModal.id };
      if (body.assigned_to === '') delete body.assigned_to;
      else body.assigned_to = parseInt(body.assigned_to);
      await ReportsService.updateComplaint(body);
      setData(d => d.map(r => r.id === editModal.id ? { ...r, ...body } : r));
      setEditModal(null);
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    } finally { setSaving(false); }
  };

  const handleResolve = async () => {
    if (!resolveModal) return;
    setResolving(true);
    try {
      await ReportsService.resolveComplaint(resolveModal.id, resolution || undefined);
      setData(d => d.map(r => r.id === resolveModal.id ? { ...r, status: 'resolved', resolution } : r));
      setResolveModal(null);
      setResolution('');
    } catch (err) {
      alert('Failed: ' + (err.response?.data?.message || err.message));
    } finally { setResolving(false); }
  };

  const COLS = [['ID','w-12'],['Login','w-24'],['Subject','flex-1'],['Category','w-24'],['Priority','w-20'],['Status','w-24'],['Assigned','w-24'],['Created','w-36'],['Actions','w-20']];

  return (
    <div className="flex-1 bg-[#1e1e1e] flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-[#252526] border-b border-black/40 shrink-0 flex-wrap">
        <button onClick={() => { setCreateForm(defaultCreate); setCreateModal(true); }}
          className="flex items-center gap-1.5 h-[24px] px-3 bg-[#007acc] hover:bg-[#0098ff] text-white text-[11px] rounded-[2px]">
          <Plus size={12} /> New Complaint
        </button>
        <button onClick={fetchList}
          className="flex items-center gap-1.5 h-[24px] px-3 bg-[#3c3c3c] hover:bg-[#4a4a4a] text-[#ccc] text-[11px] rounded-[2px]">
          <RefreshCw size={11} /> Refresh
        </button>
        <div className="flex items-center gap-2 ml-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-[#1e1e1e] border border-[#555] text-[#e1e1e1] text-[11px] h-[22px] px-1.5 rounded-[2px] outline-none">
            {STATUSES.map(s => <option key={s} value={s}>{s || 'All statuses'}</option>)}
          </select>
          <input type="number" value={loginFilter} onChange={e => setLoginFilter(e.target.value)} placeholder="Login filter…"
            className="bg-[#1e1e1e] border border-[#555] text-[#e1e1e1] text-[11px] h-[22px] px-2 w-28 rounded-[2px] outline-none focus:border-[#007acc]" />
          <button onClick={fetchList}
            className="h-[22px] px-3 bg-[#3c3c3c] hover:bg-[#4a4a4a] text-[#ccc] text-[11px] rounded-[2px]">Load</button>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center px-3 h-[24px] bg-[#252526] border-b border-black/30 shrink-0">
        {COLS.map(([l, w]) => (
          <div key={l} className={`${w} text-[10px] font-semibold text-[#888] uppercase tracking-wider pr-2`}>{l}</div>
        ))}
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-auto">
        {loading
          ? <div className="flex items-center justify-center h-24 text-[#888] text-[11px]">Loading…</div>
          : data.length === 0
            ? <div className="flex items-center justify-center h-24 text-[#555] text-[11px]">No complaints found.</div>
            : data.map((row, i) => (
              <div key={row.id}
                className={`flex items-center px-3 h-[22px] border-b border-black/20 cursor-default select-none ${i % 2 === 0 ? 'bg-[#1e1e1e]' : 'bg-[#252526]'} hover:bg-[#2a2d2e]`}>
                <div className="w-12 text-[11px] text-[#e1e1e1] pr-2">{row.id}</div>
                <div className="w-24 text-[11px] text-[#9cdcfe] pr-2">{row.account_login}</div>
                <div className="flex-1 text-[11px] text-[#e1e1e1] pr-2 truncate">{row.subject}</div>
                <div className="w-24 text-[11px] text-[#888] pr-2">{row.category || '—'}</div>
                <div className={`w-20 text-[11px] pr-2 font-semibold ${priorityColor(row.priority)}`}>{row.priority || '—'}</div>
                <div className={`w-24 text-[11px] pr-2 font-semibold ${statusColor(row.status)}`}>{row.status}</div>
                <div className="w-24 text-[11px] text-[#888] pr-2">{row.assigned_to ?? '—'}</div>
                <div className="w-36 text-[11px] text-[#888]">{tsFormat(row.created_at)}</div>
                <div className="w-20 flex items-center gap-1">
                  <button title="Edit" onClick={() => openEdit(row)}
                    className="h-[18px] w-[18px] flex items-center justify-center hover:bg-[#094771] rounded-[2px] text-[#888] hover:text-[#9cdcfe]">
                    <Pencil size={10} />
                  </button>
                  {row.status !== 'resolved' && (
                    <button title="Resolve" onClick={() => { setResolveModal(row); setResolution(''); }}
                      className="h-[18px] w-[18px] flex items-center justify-center hover:bg-[#094771] rounded-[2px] text-[#888] hover:text-[#4ec9b0]">
                      <CheckCircle size={10} />
                    </button>
                  )}
                </div>
              </div>
            ))}
      </div>

      {/* Create Modal */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <form onSubmit={handleCreate}
            className="bg-[#252526] border border-[#454545] rounded-[3px] shadow-2xl w-[420px] p-5 flex flex-col gap-3"
            onClick={e => e.stopPropagation()}>
            <div className="text-[12px] font-semibold text-[#e1e1e1]">New Complaint</div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#f48771] uppercase tracking-wider">Account Login *</label>
              <input type="number" required value={createForm.account_login}
                onChange={e => setCreateForm(f => ({ ...f, account_login: e.target.value }))}
                className="bg-[#1e1e1e] border border-[#555] text-[#e1e1e1] text-[11px] h-[24px] px-2 rounded-[2px] outline-none focus:border-[#007acc]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#f48771] uppercase tracking-wider">Subject *</label>
              <input required value={createForm.subject}
                onChange={e => setCreateForm(f => ({ ...f, subject: e.target.value }))}
                className="bg-[#1e1e1e] border border-[#555] text-[#e1e1e1] text-[11px] h-[24px] px-2 rounded-[2px] outline-none focus:border-[#007acc]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#f48771] uppercase tracking-wider">Description *</label>
              <textarea required rows={3} value={createForm.description}
                onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                className="bg-[#1e1e1e] border border-[#555] text-[#e1e1e1] text-[11px] px-2 py-1 rounded-[2px] outline-none focus:border-[#007acc] resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#888] uppercase tracking-wider">Category</label>
                <select value={createForm.category} onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))}
                  className="bg-[#1e1e1e] border border-[#555] text-[#e1e1e1] text-[11px] h-[24px] px-1.5 rounded-[2px] outline-none focus:border-[#007acc]">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#888] uppercase tracking-wider">Priority</label>
                <select value={createForm.priority} onChange={e => setCreateForm(f => ({ ...f, priority: e.target.value }))}
                  className="bg-[#1e1e1e] border border-[#555] text-[#e1e1e1] text-[11px] h-[24px] px-1.5 rounded-[2px] outline-none focus:border-[#007acc]">
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-1">
              <button type="button" onClick={() => setCreateModal(false)}
                className="h-[24px] px-4 bg-[#3c3c3c] hover:bg-[#4a4a4a] text-[#ccc] text-[11px] rounded-[2px]">Cancel</button>
              <button type="submit" disabled={saving}
                className="h-[24px] px-4 bg-[#007acc] hover:bg-[#0098ff] text-white text-[11px] rounded-[2px] disabled:opacity-50">
                {saving ? 'Saving…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <form onSubmit={handleUpdate}
            className="bg-[#252526] border border-[#454545] rounded-[3px] shadow-2xl w-[400px] p-5 flex flex-col gap-3"
            onClick={e => e.stopPropagation()}>
            <div className="text-[12px] font-semibold text-[#e1e1e1]">Edit Complaint #{editModal.id}</div>
            <div className="text-[11px] text-[#9cdcfe] truncate">{editModal.subject}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#888] uppercase tracking-wider">Status</label>
                <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                  className="bg-[#1e1e1e] border border-[#555] text-[#e1e1e1] text-[11px] h-[24px] px-1.5 rounded-[2px] outline-none focus:border-[#007acc]">
                  {['open','in_progress','resolved'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#888] uppercase tracking-wider">Priority</label>
                <select value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}
                  className="bg-[#1e1e1e] border border-[#555] text-[#e1e1e1] text-[11px] h-[24px] px-1.5 rounded-[2px] outline-none focus:border-[#007acc]">
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#888] uppercase tracking-wider">Category</label>
                <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                  className="bg-[#1e1e1e] border border-[#555] text-[#e1e1e1] text-[11px] h-[24px] px-1.5 rounded-[2px] outline-none focus:border-[#007acc]">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#888] uppercase tracking-wider">Assigned To</label>
                <input type="number" value={editForm.assigned_to}
                  onChange={e => setEditForm(f => ({ ...f, assigned_to: e.target.value }))}
                  placeholder="Manager login"
                  className="bg-[#1e1e1e] border border-[#555] text-[#e1e1e1] text-[11px] h-[24px] px-2 rounded-[2px] outline-none focus:border-[#007acc]" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#888] uppercase tracking-wider">Description</label>
              <textarea rows={3} value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                className="bg-[#1e1e1e] border border-[#555] text-[#e1e1e1] text-[11px] px-2 py-1 rounded-[2px] outline-none focus:border-[#007acc] resize-none" />
            </div>
            <div className="flex gap-2 justify-end mt-1">
              <button type="button" onClick={() => setEditModal(null)}
                className="h-[24px] px-4 bg-[#3c3c3c] hover:bg-[#4a4a4a] text-[#ccc] text-[11px] rounded-[2px]">Cancel</button>
              <button type="submit" disabled={saving}
                className="h-[24px] px-4 bg-[#007acc] hover:bg-[#0098ff] text-white text-[11px] rounded-[2px] disabled:opacity-50">
                {saving ? 'Saving…' : 'Update'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Resolve Modal */}
      {resolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#252526] border border-[#454545] rounded-[3px] shadow-2xl w-[360px] p-5 flex flex-col gap-3"
            onClick={e => e.stopPropagation()}>
            <div className="text-[12px] font-semibold text-[#e1e1e1]">Resolve Complaint #{resolveModal.id}</div>
            <div className="text-[11px] text-[#9cdcfe] truncate">{resolveModal.subject}</div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[#888] uppercase tracking-wider">Resolution Notes</label>
              <textarea rows={3} value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Optional resolution notes…"
                className="bg-[#1e1e1e] border border-[#555] text-[#e1e1e1] text-[11px] px-2 py-1 rounded-[2px] outline-none focus:border-[#007acc] resize-none" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setResolveModal(null)}
                className="h-[24px] px-4 bg-[#3c3c3c] hover:bg-[#4a4a4a] text-[#ccc] text-[11px] rounded-[2px]">Cancel</button>
              <button onClick={handleResolve} disabled={resolving}
                className="h-[24px] px-4 bg-[#4ec9b0] hover:bg-[#5eddc0] text-[#1e1e1e] font-semibold text-[11px] rounded-[2px] disabled:opacity-50">
                {resolving ? 'Resolving…' : 'Mark Resolved'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplaintsView;
