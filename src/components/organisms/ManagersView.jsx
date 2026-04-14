import React, { useState, useEffect, useCallback } from 'react';
import { ManagerService } from '../../services/manager.service';
import { UserPlus, ShieldPlus, RefreshCw, Wifi, Activity, Trash2, Edit2, X, AlertCircle, Check } from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────
const BlueUserIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="1" {...props}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const ShieldIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#E8B339" stroke="#B38600" strokeWidth="1" {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const fmtTime = (epoch) => {
  if (!epoch) return '—';
  return new Date(epoch * 1000).toLocaleString();
};
const fmtAge = (secs) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};

// ─── Permission Badge ────────────────────────────────────────────────────────
const PermBadges = ({ permissions }) => {
  if (!permissions || typeof permissions !== 'object') return <span className="text-[#555]">—</span>;
  const active = Object.entries(permissions).filter(([,v]) => v);
  if (!active.length) return <span className="text-[#555]">None</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {active.slice(0, 3).map(([k]) => (
        <span key={k} className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] rounded border border-blue-500/30 truncate max-w-[90px]">{k}</span>
      ))}
      {active.length > 3 && <span className="px-1.5 py-0.5 text-[10px] text-[#888]">+{active.length - 3}</span>}
    </div>
  );
};

// ─── Create Role Modal ───────────────────────────────────────────────────────
const PERMISSIONS = [
  { key: 'manage_accounts', label: 'Manage Accounts' },
  { key: 'manage_groups',   label: 'Manage Groups'   },
  { key: 'execute_deals',   label: 'Execute Deals'   },
  { key: 'view_reports',    label: 'View Reports'    },
];

const CreateRoleModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({
    role_name: '',
    description: '',
    permissions: { manage_accounts: false, manage_groups: false, execute_deals: false, view_reports: false },
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const togglePerm = (key) =>
    setForm(p => ({ ...p, permissions: { ...p.permissions, [key]: !p.permissions[key] } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      await ManagerService.createRole({
        role_name: form.role_name,
        description: form.description,
        permissions: form.permissions,
      });
      onCreated(); onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center">
      <div className="w-[420px] bg-[#252526] border border-[#3e3e42] rounded-md shadow-2xl text-[12px]">
        <div className="flex items-center justify-between px-4 py-3 bg-[#2d2d30] border-b border-[#3e3e42]">
          <div className="flex items-center gap-2 text-white text-[13px] font-medium"><ShieldPlus size={15} className="text-blue-400" />Create Role</div>
          <button onClick={onClose} className="text-[#999] hover:text-white p-1"><X size={14}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3 bg-[#1e1e1e]">
          {error && <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/30 p-2 rounded"><AlertCircle size={13}/>{error}</div>}
          <div className="flex flex-col gap-1">
            <label className="text-[#ccc]">Role Name *</label>
            <input required value={form.role_name} onChange={e => setForm(p => ({ ...p, role_name: e.target.value }))}
              placeholder="e.g. Dealer" className="bg-[#3c3f41] border border-[#555] text-white px-2 py-1.5 rounded-sm focus:border-[#007acc] outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[#ccc]">Description</label>
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Optional description" className="bg-[#3c3f41] border border-[#555] text-white px-2 py-1.5 rounded-sm focus:border-[#007acc] outline-none" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[#ccc]">Permissions</label>
            <div className="bg-[#2a2a2a] border border-[#3e3e42] rounded-sm p-3 grid grid-cols-2 gap-2">
              {PERMISSIONS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={form.permissions[key]} onChange={() => togglePerm(key)}
                    className="accent-[#007acc] w-3 h-3 cursor-pointer" />
                  <span className="text-[11px] text-[#ccc]">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-[#3e3e42]">
            <button type="button" onClick={onClose} className="px-4 py-1.5 bg-[#444] hover:bg-[#555] text-white rounded-[2px]">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-1.5 bg-[#007acc] hover:bg-[#0098ff] text-white rounded-[2px] disabled:opacity-50 min-w-[60px] flex justify-center">
              {submitting ? '...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Create Manager Modal ────────────────────────────────────────────────────
const CreateManagerModal = ({ roles, onClose, onCreated }) => {
  const [form, setForm] = useState({ login: '', name: '', password: '', is_admin: false, role_id: '', allowed_groups: '', ip_whitelist: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      const payload = {
        login: Number(form.login),
        name: form.name,
        password: form.password,
        is_admin: form.is_admin,
        ...(form.role_id && { role_id: Number(form.role_id) }),
        ...(form.allowed_groups.trim() && { allowed_groups: form.allowed_groups.split(',').map(s=>s.trim()).filter(Boolean) }),
        ...(form.ip_whitelist.trim() && { ip_whitelist: form.ip_whitelist.split(',').map(s=>s.trim()).filter(Boolean) }),
      };
      await ManagerService.createManager(payload);
      onCreated(); onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center">
      <div className="w-[440px] bg-[#252526] border border-[#3e3e42] rounded-md shadow-2xl text-[12px]">
        <div className="flex items-center justify-between px-4 py-3 bg-[#2d2d30] border-b border-[#3e3e42]">
          <div className="flex items-center gap-2 text-white text-[13px] font-medium"><UserPlus size={15} className="text-blue-400"/>Create Manager</div>
          <button onClick={onClose} className="text-[#999] hover:text-white p-1"><X size={14}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3 bg-[#1e1e1e]">
          {error && <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/30 p-2 rounded"><AlertCircle size={13}/>{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1"><label className="text-[#ccc]">Login (MT5) *</label>
              <input required type="number" value={form.login} onChange={e=>setForm(p=>({...p,login:e.target.value}))} className="bg-[#3c3f41] border border-[#555] text-white px-2 py-1.5 rounded-sm focus:border-[#007acc] outline-none"/></div>
            <div className="flex flex-col gap-1"><label className="text-[#ccc]">Role</label>
              <select value={form.role_id} onChange={e=>setForm(p=>({...p,role_id:e.target.value}))} className="bg-[#3c3f41] border border-[#555] text-white px-2 py-1.5 rounded-sm focus:border-[#007acc] outline-none">
                <option value="">No Role</option>
                {roles.map(r=><option key={r.id} value={r.id}>{r.role_name}</option>)}
              </select></div>
          </div>
          <div className="flex flex-col gap-1"><label className="text-[#ccc]">Name *</label>
            <input required value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="bg-[#3c3f41] border border-[#555] text-white px-2 py-1.5 rounded-sm focus:border-[#007acc] outline-none"/></div>
          <div className="flex flex-col gap-1"><label className="text-[#ccc]">Password *</label>
            <input required type="password" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} className="bg-[#3c3f41] border border-[#555] text-white px-2 py-1.5 rounded-sm focus:border-[#007acc] outline-none"/></div>
          <div className="flex flex-col gap-1"><label className="text-[#ccc]">Allowed Groups (comma-sep)</label>
            <input value={form.allowed_groups} onChange={e=>setForm(p=>({...p,allowed_groups:e.target.value}))} placeholder="retail, vip" className="bg-[#3c3f41] border border-[#555] text-white px-2 py-1.5 rounded-sm focus:border-[#007acc] outline-none"/></div>
          <div className="flex flex-col gap-1"><label className="text-[#ccc]">IP Whitelist (comma-sep)</label>
            <input value={form.ip_whitelist} onChange={e=>setForm(p=>({...p,ip_whitelist:e.target.value}))} placeholder="192.168.1.10" className="bg-[#3c3f41] border border-[#555] text-white px-2 py-1.5 rounded-sm focus:border-[#007acc] outline-none"/></div>
          <div className="flex items-center gap-2 mt-1">
            <input type="checkbox" id="is_admin" checked={form.is_admin} onChange={e=>setForm(p=>({...p,is_admin:e.target.checked}))} className="accent-[#007acc]"/>
            <label htmlFor="is_admin" className="text-[#ccc] cursor-pointer">Is Admin</label>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-[#3e3e42]">
            <button type="button" onClick={onClose} className="px-4 py-1.5 bg-[#444] hover:bg-[#555] text-white rounded-[2px]">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-1.5 bg-[#007acc] hover:bg-[#0098ff] text-white rounded-[2px] disabled:opacity-50 min-w-[60px] flex justify-center">
              {submitting ? '...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Edit Role Modal ─────────────────────────────────────────────────────────
const EditRoleModal = ({ role, onClose, onSaved }) => {
  const [form, setForm] = useState({
    role_name:   role.role_name   || '',
    description: role.description || '',
    permissions: {
      manage_accounts: role.permissions?.manage_accounts ?? false,
      manage_groups:   role.permissions?.manage_groups   ?? false,
      execute_deals:   role.permissions?.execute_deals   ?? false,
      view_reports:    role.permissions?.view_reports    ?? false,
    },
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const togglePerm = (key) =>
    setForm(p => ({ ...p, permissions: { ...p.permissions, [key]: !p.permissions[key] } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      await ManagerService.updateRole(role.id, {
        role_name:   form.role_name,
        description: form.description,
        permissions: form.permissions,
      });
      onSaved(); onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center">
      <div className="w-[420px] bg-[#252526] border border-[#3e3e42] rounded-md shadow-2xl text-[12px]">
        <div className="flex items-center justify-between px-4 py-3 bg-[#2d2d30] border-b border-[#3e3e42]">
          <div className="flex items-center gap-2 text-white text-[13px] font-medium">
            <Edit2 size={15} className="text-blue-400" />Edit Role — <span className="text-[#9cdcfe]">{role.role_name}</span>
          </div>
          <button onClick={onClose} className="text-[#999] hover:text-white p-1"><X size={14}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3 bg-[#1e1e1e]">
          {error && <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/30 p-2 rounded"><AlertCircle size={13}/>{error}</div>}
          <div className="flex flex-col gap-1">
            <label className="text-[#ccc]">Role Name *</label>
            <input required value={form.role_name}
              onChange={e => setForm(p => ({ ...p, role_name: e.target.value }))}
              className="bg-[#3c3f41] border border-[#555] text-white px-2 py-1.5 rounded-sm focus:border-[#007acc] outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[#ccc]">Description</label>
            <input value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Optional description"
              className="bg-[#3c3f41] border border-[#555] text-white px-2 py-1.5 rounded-sm focus:border-[#007acc] outline-none" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[#ccc]">Permissions</label>
            <div className="bg-[#2a2a2a] border border-[#3e3e42] rounded-sm p-3 grid grid-cols-2 gap-2">
              {PERMISSIONS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={form.permissions[key]} onChange={() => togglePerm(key)}
                    className="accent-[#007acc] w-3 h-3 cursor-pointer" />
                  <span className="text-[11px] text-[#ccc]">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-[#3e3e42]">
            <button type="button" onClick={onClose} className="px-4 py-1.5 bg-[#444] hover:bg-[#555] text-white rounded-[2px]">Cancel</button>
            <button type="submit" disabled={submitting}
              className="px-4 py-1.5 bg-[#007acc] hover:bg-[#0098ff] text-white rounded-[2px] disabled:opacity-50 min-w-[60px] flex justify-center">
              {submitting ? '...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Activity Log Modal ──────────────────────────────────────────────────────
const ActivityLogModal = ({ manager, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ManagerService.getManagerActivityLog(manager.login).then(res => {
      setLogs(Array.isArray(res) ? res : res?.data || []);
    }).catch(() => setLogs([])).finally(() => setLoading(false));
  }, [manager.login]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center">
      <div className="w-[700px] max-h-[80vh] bg-[#252526] border border-[#3e3e42] rounded-md shadow-2xl flex flex-col text-[12px]">
        <div className="flex items-center justify-between px-4 py-3 bg-[#2d2d30] border-b border-[#3e3e42] shrink-0">
          <div className="flex items-center gap-2 text-white text-[13px] font-medium">
            <Activity size={15} className="text-blue-400"/>Activity Log — {manager.name} ({manager.login})
          </div>
          <button onClick={onClose} className="text-[#999] hover:text-white p-1"><X size={14}/></button>
        </div>
        <div className="overflow-auto flex-1 bg-[#1e1e1e]">
          <div className="flex border-b border-[#333] bg-[#2a2a2a] select-none sticky top-0">
            <div className="w-[60px] px-2 py-1.5 text-[11px] text-[#aaa] font-medium border-r border-[#333]">ID</div>
            <div className="w-[160px] px-2 py-1.5 text-[11px] text-[#aaa] font-medium border-r border-[#333]">Action</div>
            <div className="w-[90px] px-2 py-1.5 text-[11px] text-[#aaa] font-medium border-r border-[#333]">Target</div>
            <div className="w-[120px] px-2 py-1.5 text-[11px] text-[#aaa] font-medium border-r border-[#333]">IP</div>
            <div className="flex-1 px-2 py-1.5 text-[11px] text-[#aaa] font-medium">Time</div>
          </div>
          {loading && <div className="p-4 text-[#888] italic">Loading...</div>}
          {!loading && logs.length === 0 && <div className="p-4 text-[#888] italic">No activity logs found.</div>}
          {logs.map((log, i) => (
            <div key={log.id || i} className={`flex border-b border-black/10 ${i%2===0?'bg-[#1e1e1e]':'bg-[#252526]'}`}>
              <div className="w-[60px] px-2 py-1 text-[#e1e1e1] border-r border-black/10">{log.id}</div>
              <div className="w-[160px] px-2 py-1 text-blue-400 border-r border-black/10 truncate">{log.action_type}</div>
              <div className="w-[90px] px-2 py-1 text-[#aaa] border-r border-black/10">{log.target_login || '—'}</div>
              <div className="w-[120px] px-2 py-1 text-[#aaa] border-r border-black/10 truncate">{log.ip_address || '—'}</div>
              <div className="flex-1 px-2 py-1 text-[#aaa]">{fmtTime(log.action_time)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Main ManagersView ───────────────────────────────────────────────────────
const ManagersView = () => {
  const [activeTab, setActiveTab] = useState('Managers');

  const [managers, setManagers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [online, setOnline] = useState([]);
  const [loading, setLoading] = useState(false);

  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [isCreateManagerOpen, setIsCreateManagerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [activityTarget, setActivityTarget] = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false });

  const fetchManagers = useCallback(async () => {
    try {
      const res = await ManagerService.getManagerList();
      setManagers(Array.isArray(res) ? res : res?.data || []);
    } catch { setManagers([]); }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await ManagerService.getRoleList();
      setRoles(Array.isArray(res) ? res : res?.data || []);
    } catch { setRoles([]); }
  }, []);

  const fetchOnline = useCallback(async () => {
    try {
      const res = await ManagerService.getManagerOnline();
      setOnline(Array.isArray(res) ? res : res?.data || []);
    } catch { setOnline([]); }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchManagers(), fetchRoles(), fetchOnline()]);
    setLoading(false);
  }, [fetchManagers, fetchRoles, fetchOnline]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const handleContextMenu = (e, record, type) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, record, type });
  };

  const handleDisableManager = async (login) => {
    if (!window.confirm(`Disable manager ${login}? This is a soft delete.`)) return;
    try {
      await ManagerService.deleteManager(login);
      fetchManagers();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
    setContextMenu({ visible: false });
  };

  const handleDeleteRole = async (roleId, roleName) => {
    if (!window.confirm(`Delete role "${roleName}"? This fails if managers are assigned to it.`)) return;
    try {
      await ManagerService.deleteRole(roleId);
      fetchRoles();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
    setContextMenu({ visible: false });
  };

  const tabs = ['Managers', 'Roles', 'Online'];

  return (
    <div className="flex-1 bg-[#1e1e1e] flex flex-col overflow-hidden relative"
      onClick={() => setContextMenu({ visible: false })}
      onContextMenu={(e) => e.preventDefault()}>

      {/* Top Action Bar */}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-[#252526] border-b border-black/40 shrink-0 select-none">
        {activeTab === 'Managers' && (
          <button onClick={() => setIsCreateManagerOpen(true)}
            className="flex items-center gap-1.5 h-[24px] px-3 bg-[#007acc] hover:bg-[#0098ff] text-white text-[11px] rounded-[2px] transition-colors">
            <UserPlus size={12}/> Create Manager
          </button>
        )}
        {activeTab === 'Roles' && (
          <button onClick={() => setIsCreateRoleOpen(true)}
            className="flex items-center gap-1.5 h-[24px] px-3 bg-[#007acc] hover:bg-[#0098ff] text-white text-[11px] rounded-[2px] transition-colors">
            <ShieldPlus size={12}/> Create Role
          </button>
        )}
        <button onClick={refreshAll} disabled={loading}
          className="flex items-center gap-1 h-[24px] px-2 bg-[#3c3c3c] hover:bg-[#4a4a4a] text-[#ccc] text-[11px] rounded-[2px] disabled:opacity-50 transition-colors">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''}/> Refresh
        </button>
        {activeTab === 'Online' && (
          <span className="ml-2 text-[11px] text-[#888]">
            <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1.5"></span>{online.length} connected
          </span>
        )}
      </div>

      {/* ─── MANAGERS TAB ──────────────────────────────────────── */}
      {activeTab === 'Managers' && (
        <>
          <div className="flex bg-[#333] border-b border-black/40 select-none shrink-0">
            <div className="w-[80px]  px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20">Login</div>
            <div className="w-[160px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20">Name</div>
            <div className="w-[130px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20">Role</div>
            <div className="w-[70px]  px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20">Admin</div>
            <div className="w-[80px]  px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20">Status</div>
            <div className="w-[130px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20">Last Login</div>
            <div className="w-[120px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20">Last IP</div>
            <div className="flex-1"></div>
          </div>
          <div className="flex-1 overflow-auto bg-[#1e1e1e]">
            {loading && <div className="p-4 text-[#888] italic text-[12px]">Loading...</div>}
            {!loading && managers.length === 0 && <div className="p-4 text-[#888] italic text-[12px]">No managers found.</div>}
            {managers.map((row, idx) => (
              <div key={row.login} onContextMenu={e => handleContextMenu(e, row, 'manager')}
                className={`flex cursor-default border-b border-black/10 hover:bg-blue-600/20 transition-colors ${idx%2===0?'bg-[#1e1e1e]':'bg-[#252526]'}`}>
                <div className="w-[80px]  px-3 py-1 text-[12px] flex items-center gap-2 border-r border-black/10"><BlueUserIcon/>{row.login}</div>
                <div className="w-[160px] px-3 py-1 text-[12px] text-[#ccc] border-r border-black/10 truncate">{row.name}</div>
                <div className="w-[130px] px-3 py-1 text-[12px] text-[#aaa] border-r border-black/10 truncate">{row.role_name || '—'}</div>
                <div className="w-[70px]  px-3 py-1 text-[12px] border-r border-black/10">
                  {row.is_admin ? <span className="text-yellow-400">Yes</span> : <span className="text-[#666]">No</span>}
                </div>
                <div className="w-[80px]  px-3 py-1 text-[12px] border-r border-black/10">
                  {row.enabled ? <span className="text-green-400">Active</span> : <span className="text-red-400">Disabled</span>}
                </div>
                <div className="w-[130px] px-3 py-1 text-[11px] text-[#aaa] border-r border-black/10 truncate">{fmtTime(row.last_login)}</div>
                <div className="w-[120px] px-3 py-1 text-[12px] text-[#aaa] border-r border-black/10 truncate">{row.last_ip || '—'}</div>
                <div className="flex-1"></div>
              </div>
            ))}
            {[...Array(20)].map((_,i) => <div key={i} className={`flex h-6 border-b border-black/5 ${i%2!==0?'bg-[#1e1e1e]':'bg-[#252526]'} opacity-30`}></div>)}
          </div>
        </>
      )}

      {/* ─── ROLES TAB ─────────────────────────────────────────── */}
      {activeTab === 'Roles' && (
        <>
          <div className="flex bg-[#333] border-b border-black/40 select-none shrink-0">
            <div className="w-[50px]  px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20">ID</div>
            <div className="w-[150px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20">Role Name</div>
            <div className="w-[200px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20">Description</div>
            <div className="w-[260px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20">Permissions</div>
            <div className="w-[150px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20">Created</div>
            <div className="w-[60px]  px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1]">Actions</div>
          </div>
          <div className="flex-1 overflow-auto bg-[#1e1e1e]">
            {loading && <div className="p-4 text-[#888] italic text-[12px]">Loading...</div>}
            {!loading && roles.length === 0 && <div className="p-4 text-[#888] italic text-[12px]">No roles found.</div>}
            {roles.map((row, idx) => (
              <div key={row.id} onContextMenu={e => handleContextMenu(e, row, 'role')}
                className={`flex cursor-default border-b border-black/10 hover:bg-blue-600/20 transition-colors items-center ${idx%2===0?'bg-[#1e1e1e]':'bg-[#252526]'}`}>
                <div className="w-[50px]  px-3 py-1 text-[12px] text-[#e1e1e1] border-r border-black/10">{row.id}</div>
                <div className="w-[150px] px-3 py-1 text-[12px] flex items-center gap-2 border-r border-black/10"><ShieldIcon/>{row.role_name}</div>
                <div className="w-[200px] px-3 py-1 text-[12px] text-[#aaa] border-r border-black/10 truncate">{row.description || '—'}</div>
                <div className="w-[260px] px-3 py-1 border-r border-black/10"><PermBadges permissions={row.permissions}/></div>
                <div className="w-[150px] px-3 py-1 text-[11px] text-[#aaa] border-r border-black/10">{fmtTime(row.created_at)}</div>
                <div className="w-[60px] px-3 py-1 flex items-center">
                  <button onClick={() => setEditingRole(row)} title="Edit Role"
                    className="p-1 text-[#555] hover:text-[#007acc] hover:bg-[#007acc]/10 rounded-[2px] transition-colors">
                    <Edit2 size={12}/>
                  </button>
                </div>
              </div>
            ))}
            {[...Array(20)].map((_,i) => <div key={i} className={`flex h-6 border-b border-black/5 ${i%2!==0?'bg-[#1e1e1e]':'bg-[#252526]'} opacity-30`}></div>)}
          </div>
        </>
      )}

      {/* ─── ONLINE TAB ────────────────────────────────────────── */}
      {activeTab === 'Online' && (
        <>
          <div className="flex bg-[#333] border-b border-black/40 select-none shrink-0">
            <div className="w-[80px]  px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20">Login</div>
            <div className="w-[180px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20">Name</div>
            <div className="w-[180px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20">Connected At</div>
            <div className="w-[120px] px-3 py-1.5 text-[11px] font-medium text-[#d1d1d1] border-r border-black/20">Session Age</div>
            <div className="flex-1"></div>
          </div>
          <div className="flex-1 overflow-auto bg-[#1e1e1e]">
            {loading && <div className="p-4 text-[#888] italic text-[12px]">Loading...</div>}
            {!loading && online.length === 0 && <div className="p-4 text-[#888] italic text-[12px]">No managers currently online.</div>}
            {online.map((row, idx) => (
              <div key={row.login} className={`flex cursor-default border-b border-black/10 hover:bg-blue-600/20 transition-colors ${idx%2===0?'bg-[#1e1e1e]':'bg-[#252526]'}`}>
                <div className="w-[80px]  px-3 py-1 text-[12px] flex items-center gap-2 border-r border-black/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0"></span>{row.login}
                </div>
                <div className="w-[180px] px-3 py-1 text-[12px] text-[#ccc] border-r border-black/10">{row.name}</div>
                <div className="w-[180px] px-3 py-1 text-[12px] text-[#aaa] border-r border-black/10">{fmtTime(row.connected_at)}</div>
                <div className="w-[120px] px-3 py-1 text-[12px] font-mono text-green-400 border-r border-black/10">{fmtAge(row.session_age)}</div>
                <div className="flex-1"></div>
              </div>
            ))}
            {[...Array(20)].map((_,i) => <div key={i} className={`flex h-6 border-b border-black/5 ${i%2!==0?'bg-[#1e1e1e]':'bg-[#252526]'} opacity-30`}></div>)}
          </div>
        </>
      )}

      {/* Bottom Tab Bar */}
      <div className="h-7 bg-[#1e1e1e] border-t border-black/40 flex items-center px-1 gap-1 select-none shrink-0">
        {tabs.map(tab => (
          <div key={tab} onClick={() => setActiveTab(tab)}
            className={`h-[22px] px-4 text-[11px] flex items-center gap-1.5 rounded-sm cursor-default transition-colors ${activeTab===tab?'bg-[#3e3e3e] text-white border border-black/40':'text-[#999] hover:text-[#ccc] hover:bg-white/5'}`}>
            {tab === 'Online' && <span className={`w-1.5 h-1.5 rounded-full ${activeTab==='Online'?'bg-green-400':'bg-[#555]'}`}></span>}
            {tab}
            {tab === 'Online' && online.length > 0 && <span className="ml-1 text-[10px] text-green-400">{online.length}</span>}
          </div>
        ))}
      </div>

      {/* Status Bar */}
      <div className="h-6 bg-[#007acc] text-white flex items-center px-4 text-[11px] select-none shrink-0 border-t border-[#005a9e]">
        {activeTab === 'Managers' && <span>Managers: {managers.length}</span>}
        {activeTab === 'Roles' && <span>Roles: {roles.length}</span>}
        {activeTab === 'Online' && <span>Online: {online.length}</span>}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div className="fixed z-[9999] bg-[#2d2d30] border border-[#3e3e42] shadow-2xl py-1 min-w-[200px] text-[12px] text-[#ccc] rounded-[2px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}>
          {contextMenu.type === 'manager' && (
            <>
              <div className="px-5 py-1.5 hover:bg-[#007acc] hover:text-white cursor-pointer select-none"
                onClick={() => { setActivityTarget(contextMenu.record); setContextMenu({ visible: false }); }}>
                <span className="flex items-center gap-2"><Activity size={12}/>View Activity Log</span>
              </div>
              <div className="h-[1px] bg-[#3e3e42] my-1 mx-2"></div>
              <div className="px-5 py-1.5 hover:bg-red-700 hover:text-white cursor-pointer select-none text-red-400"
                onClick={() => handleDisableManager(contextMenu.record.login)}>
                <span className="flex items-center gap-2"><Trash2 size={12}/>Disable Manager</span>
              </div>
            </>
          )}
          {contextMenu.type === 'role' && (
            <>
              <div className="px-5 py-1.5 hover:bg-[#007acc] hover:text-white cursor-pointer select-none"
                onClick={() => { setEditingRole(contextMenu.record); setContextMenu({ visible: false }); }}>
                <span className="flex items-center gap-2"><Edit2 size={12}/>Edit Role</span>
              </div>
              <div className="h-[1px] bg-[#3e3e42] my-1 mx-2"></div>
              <div className="px-5 py-1.5 hover:bg-red-700 hover:text-white cursor-pointer select-none text-red-400"
                onClick={() => handleDeleteRole(contextMenu.record.id, contextMenu.record.role_name)}>
                <span className="flex items-center gap-2"><Trash2 size={12}/>Delete Role</span>
              </div>
            </>
          )}
        </div>
      )}

      {isCreateRoleOpen    && <CreateRoleModal    onClose={() => setIsCreateRoleOpen(false)}    onCreated={fetchRoles}    />}
      {isCreateManagerOpen && <CreateManagerModal roles={roles} onClose={() => setIsCreateManagerOpen(false)} onCreated={fetchManagers} />}
      {editingRole         && <EditRoleModal      role={editingRole} onClose={() => setEditingRole(null)} onSaved={fetchRoles} />}
      {activityTarget      && <ActivityLogModal   manager={activityTarget} onClose={() => setActivityTarget(null)} />}
    </div>
  );
};

export default ManagersView;
