import GroupAccessFields from './GroupAccessFields';
import { toggleRolePermission } from '../../utils/groupAccess';
import { sortToolbarRows } from '../../utils/toolbarActions';
import React, { useState, useEffect, useCallback, useId, useRef, useMemo, useSyncExternalStore } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import { ManagerService } from '../../services/manager.service';
import { getManagerDirectoryIdentity, peekManagerDirectory, primeManagerDirectory, readManagerDirectory, subscribeManagerDirectory } from '../../services/managerDirectory.service';
import { UserPlus, Users, Shield, ShieldPlus, LockKeyhole, Search, RefreshCw, Wifi, Activity, Trash2, Edit2, X, AlertCircle, Check, KeyRound, Power, MoreHorizontal } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { buildManagerCreatePayload, buildManagerUpdateParams, canGrantAdminRole, parseCsvList, validateManagerPassword } from '../../utils/adminValidation';
import { loadGroupTreePages, normalizeNavigationGroups } from '../../utils/groupTreeData';
import { ROLE_PERMISSION_OPTIONS } from '../../utils/permissions';
import { buildActionableErrorState } from '../../utils/errorState';
import ActionableErrorState from '../atoms/ActionableErrorState';
import { Tooltip, TooltipProvider } from '../ui/Tooltip';
import './ManagersView.css';

// ─── Helpers ────────────────────────────────────────────────────────────────
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
  if (!permissions || typeof permissions !== 'object') return <span className="managers-muted">—</span>;
  const active = Object.entries(permissions).filter(([,v]) => v);
  if (!active.length) return <span className="managers-muted">None</span>;
  return (
    <div className="managers-permissions">
      {active.slice(0, 3).map(([k]) => (
        <span key={k} title={k} className="managers-permission">{PERMISSIONS.find(permission => permission.key === k)?.label || k}</span>
      ))}
      {active.length > 3 && <span className="managers-muted" title={active.slice(3).map(([key]) => key).join(', ')}>+{active.length - 3}</span>}
    </div>
  );
};

// ─── Create Role Modal ───────────────────────────────────────────────────────
const PERMISSIONS = ROLE_PERMISSION_OPTIONS;
const emptyPermissionMap = () =>
  Object.fromEntries(PERMISSIONS.map(({ key }) => [key, false]));
// Keeps every key the role has stored, including ones this build does not list.
const normalizeRolePermissionMap = (permissions = {}) => ({
  ...emptyPermissionMap(),
  ...Object.fromEntries(Object.entries(permissions || {}).map(([key, value]) => [key, Boolean(value)])),
});

// The role permission catalog comes from the backend (ManagerRoleDefaults), so
// a permission added there appears here without a UI release. The built-in
// list is only the fallback when that call fails.
let permissionCatalogRequest = null;
const loadPermissionCatalog = () => {
  if (!permissionCatalogRequest) {
    permissionCatalogRequest = ManagerService.getRoleDefaults()
      .then((res) => {
        const list = (res?.available_permissions || []).filter(p => p && typeof p.key === 'string' && p.key);
        if (!list.length) throw new Error('empty permission catalog');
        return { permissions: list, fromBackend: true };
      })
      .catch(() => {
        return { permissions: PERMISSIONS.map(p => ({ ...p, category: 'Permissions' })), fromBackend: false };
      })
      .finally(() => { permissionCatalogRequest = null; }); // Refresh the catalog on the next open.
  }
  return permissionCatalogRequest;
};

const usePermissionCatalog = () => {
  const [catalog, setCatalog] = useState(null);
  useEffect(() => {
    let active = true;
    loadPermissionCatalog().then(result => { if (active) setCatalog(result); });
    return () => { active = false; };
  }, []);
  return catalog;
};

const PermissionChecklist = ({ permissions, onToggle, disabled = false }) => {
  const catalog = usePermissionCatalog();
  const [search, setSearch] = useState('');
  const [storedKeys] = useState(() => Object.keys(permissions).filter(key => permissions[key]));
  if (!catalog) {
    return <div className="role-permission-message" role="status">Loading permissions…</div>;
  }
  const knownKeys = new Set(catalog.permissions.map(permission => permission.key));
  const items = [...catalog.permissions, ...storedKeys.filter(key => !knownKeys.has(key)).map(key => ({
    key, label: key.replace(/_/g, ' '), category: 'Other permissions',
  }))];
  const term = search.trim().toLowerCase();
  const selectedCount = Object.values(permissions).filter(Boolean).length;
  const groups = [];
  for (const perm of items) {
    if (term && ![perm.label, perm.key, perm.category, perm.description].some(value => String(value || '').toLowerCase().includes(term))) continue;
    const category = perm.category || 'Other';
    let group = groups.find(g => g.category === category);
    if (!group) { group = { category, items: [] }; groups.push(group); }
    group.items.push(perm);
  }
  return (
    <div className="role-permission-picker">
      <div className="role-permission-filter">
        <Search size={13} aria-hidden="true" />
        <input type="search" aria-label="Search permissions" placeholder="Search permissions…" value={search} onChange={event => setSearch(event.target.value)} disabled={disabled} />
        <span className="role-permission-count" aria-live="polite">{selectedCount} selected</span>
      </div>
      <div className="role-permission-list">
      {!catalog.fromBackend && (
        <div className="role-permission-message" role="status">Permission list unavailable. Showing known permissions.</div>
      )}
      {!groups.length && <div className="role-permission-message" role="status">No matching permissions.</div>}
      {groups.map(({ category, items }) => (
        <fieldset key={category} className="role-permission-category" disabled={disabled}>
          <legend>{category}</legend>
          <div className="role-permission-grid">
            {items.map(({ key, label, description }) => (
              <label key={key} title={description || label || key} className="role-permission-option">
                <input type="checkbox" checked={Boolean(permissions[key])} onChange={() => onToggle(key)} />
                <span>{label || key}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      </div>
    </div>
  );
};

const CreateRoleModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({
    role_name: '',
    description: '',
    permissions: emptyPermissionMap(),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const togglePerm = (key) =>
    setForm(p => ({ ...p, permissions: toggleRolePermission(p.permissions, key) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      const created = await ManagerService.createRole({
        role_name: form.role_name,
        description: form.description,
        permissions: form.permissions,
      });
      onCreated(created); onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="managers-modal-layer fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center">
      <div className="w-[420px] bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-md shadow-2xl text-[12px]">
        <div className="flex items-center justify-between px-4 py-3 bg-[color:var(--bg-surface-1)] border-b border-[color:var(--border-default)]">
          <div className="flex items-center gap-2 text-white text-[13px] font-medium"><ShieldPlus size={15} className="text-white" />Create Role</div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="text-white hover:text-white p-1"><X size={14}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3 bg-[color:var(--bg-app)]">
          {error && <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/30 p-2 rounded"><AlertCircle size={13}/>{error}</div>}
          <div className="flex flex-col gap-1">
            <label className="text-white">Role Name *</label>
            <input required value={form.role_name} onChange={e => setForm(p => ({ ...p, role_name: e.target.value }))}
              placeholder="e.g. Dealer" className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 rounded-sm focus:border-[color:var(--accent-500)] outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-white">Description</label>
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Optional description" className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 rounded-sm focus:border-[color:var(--accent-500)] outline-none" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-white">Permissions</label>
            <PermissionChecklist permissions={form.permissions} onToggle={togglePerm} />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--border-default)]">
            <button type="button" onClick={onClose} className="px-4 py-1.5 bg-[#444] hover:bg-[#555] text-white rounded-[2px]">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-1.5 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white rounded-[2px] disabled:opacity-50 min-w-[60px] flex justify-center">
              {submitting ? '...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Create Manager Modal ────────────────────────────────────────────────────
const loadGroupNames = async () => normalizeNavigationGroups(await loadGroupTreePages(
  ManagerService.getGroupList,
  { arrayKeys: ['answer', 'groups', 'data', 'items', 'rows'] },
)).map(g => g.groupName);

// Allowed Groups picker: the broker's groups as a checklist. value/onChange
// keep the form's comma-separated string; saved entries that are not in the
// list (e.g. wildcards) stay selected and removable.
const GroupPicker = ({ value, onChange }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setGroups(await loadGroupNames()); }
    catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const selected = parseCsvList(value);
  const isSelected = (name) => selected.includes(name);
  const toggle = (name) => onChange((isSelected(name) ? selected.filter(g => g !== name) : [...selected, name]).join(', '));
  const extra = selected.filter(g => !groups.includes(g));
  const term = search.trim().toLowerCase();
  const visible = term ? groups.filter(g => g.toLowerCase().includes(term)) : groups;

  return (
    <div className="managers-group-picker">
      <div className="managers-group-filter">
        <Search size={13} aria-hidden="true" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search groups…" aria-label="Search groups" />
        <span className="managers-group-count" aria-live="polite">{selected.length} selected</span>
      </div>
        <div className="managers-group-list">
          {loading && <div className="managers-group-message" role="status">Loading groups…</div>}
          {!loading && error && (
            <div className="managers-group-message managers-group-error" role="alert">
              Unable to load groups. <button type="button" onClick={load} className="underline">Retry</button>
            </div>
          )}
          {!loading && !error && visible.length === 0 && (
            <div className="managers-group-message" role="status">{groups.length ? 'No matching groups' : 'No groups found'}</div>
          )}
          {!loading && !error && visible.map(g => (
            <label key={g} className="managers-group-option">
              <input type="checkbox" checked={isSelected(g)} onChange={() => toggle(g)} />
              <span>{g}</span>
            </label>
          ))}
        </div>
      {selected.length > 0 && (
        <div className="managers-group-selected">
          {selected.map(g => (
            <span key={g} className="managers-group-chip">
              <span title={g}>{g}</span>
              <button type="button" onClick={() => toggle(g)} aria-label={`Remove group ${g}`} title={`Remove ${g}`}><X size={11} aria-hidden="true" /></button>
            </span>
          ))}
        </div>
      )}
      {!loading && extra.length > 0 && (
        <div className="managers-group-message">Saved assignments outside this list: {extra.join(', ')}</div>
      )}
    </div>
  );
};

const NEW_ROLE_OPTION = '__new_role__';

const CreateManagerModal = ({ roles, rolesLoading = false, onClose, onCreated, onCreateRole }) => {
  const [form, setForm] = useState({ login: '', name: '', password: '', is_admin: false, role_id: '', group_access_mode: 'none', allowed_groups: '', ip_whitelist: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const currentUser = useAuthStore((state) => state.user);
  const canCreateAdmin = canGrantAdminRole(currentUser);

  // Opens Create Role on top of this form; the new role is selected on return.
  // With no roles yet, clicking the role picker goes straight there.
  const openCreateRole = () =>
    onCreateRole((roleId) => setForm(p => ({ ...p, role_id: String(roleId) })));

  const handleRoleChange = (e) => {
    if (e.target.value === NEW_ROLE_OPTION) { openCreateRole(); return; }
    setForm(p => ({ ...p, role_id: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      const payload = buildManagerCreatePayload(form, { canGrantAdmin: canCreateAdmin });
      await ManagerService.createManager(payload);
      onCreated(); onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="managers-modal-layer fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center">
      <div className="w-[440px] bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-md shadow-2xl text-[12px]">
        <div className="flex items-center justify-between px-4 py-3 bg-[color:var(--bg-surface-1)] border-b border-[color:var(--border-default)]">
          <div className="flex items-center gap-2 text-white text-[13px] font-medium"><UserPlus size={15} className="text-white"/>Create Manager</div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="text-white hover:text-white p-1"><X size={14}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3 bg-[color:var(--bg-app)]">
          {error && <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/30 p-2 rounded"><AlertCircle size={13}/>{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1"><label className="text-white">Login (RTX5) *</label>
              <input required type="number" value={form.login} onChange={e=>setForm(p=>({...p,login:e.target.value}))} className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 rounded-sm focus:border-[color:var(--accent-500)] outline-none"/></div>
            <div className="flex flex-col gap-1"><label className="text-white">Role</label>
              <select value={form.role_id} onChange={handleRoleChange} disabled={rolesLoading}
                onMouseDown={!rolesLoading && roles.length === 0 ? (e) => { e.preventDefault(); openCreateRole(); } : undefined}
                className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 rounded-sm focus:border-[color:var(--accent-500)] outline-none">
                <option value="">{rolesLoading ? 'Loading roles…' : 'No Role'}</option>
                {roles.map(r=><option key={r.id} value={r.id}>{r.role_name}</option>)}
                <option value={NEW_ROLE_OPTION}>+ Create new role…</option>
              </select>
              {!rolesLoading && roles.length === 0 && (
                <button type="button" onClick={openCreateRole} className="self-start text-[11px] text-white hover:underline">
                  No roles yet — create one
                </button>
              )}</div>
          </div>
          <div className="flex flex-col gap-1"><label className="text-white">Name *</label>
            <input required value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 rounded-sm focus:border-[color:var(--accent-500)] outline-none"/></div>
          <div className="flex flex-col gap-1"><label className="text-white">Password *</label>
            <input required type="password" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 rounded-sm focus:border-[color:var(--accent-500)] outline-none"/></div>
          <GroupAccessFields mode={form.group_access_mode} groups={form.allowed_groups} onChange={(mode, groups) => setForm(p => ({ ...p, group_access_mode: mode, allowed_groups: groups.join(', ') }))}>
            <GroupPicker value={form.allowed_groups} onChange={v=>setForm(p=>({...p,allowed_groups:v}))}/>
          </GroupAccessFields>
          <div className="flex flex-col gap-1"><label className="text-white">IP Whitelist (comma-sep)</label>
            <input value={form.ip_whitelist} onChange={e=>setForm(p=>({...p,ip_whitelist:e.target.value}))} placeholder="192.168.1.10" className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 rounded-sm focus:border-[color:var(--accent-500)] outline-none"/></div>
          <div className="flex items-center gap-2 mt-1">
            <input type="checkbox" id="is_admin" checked={form.is_admin && canCreateAdmin} onChange={e=>setForm(p=>({...p,is_admin:canCreateAdmin && e.target.checked}))} disabled={!canCreateAdmin} className="accent-[color:var(--accent-500)] disabled:opacity-50"/>
            <label htmlFor="is_admin" className="text-white cursor-pointer">Is Admin</label>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--border-default)]">
            <button type="button" onClick={onClose} className="px-4 py-1.5 bg-[#444] hover:bg-[#555] text-white rounded-[2px]">Cancel</button>
            <button type="submit" disabled={submitting} className="px-4 py-1.5 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white rounded-[2px] disabled:opacity-50 min-w-[60px] flex justify-center">
              {submitting ? '...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Edit Manager Modal ──────────────────────────────────────────────────────
const joinList = (list) => (Array.isArray(list) ? list.filter(Boolean).join(', ') : '');

const EditManagerModal = ({ manager, roles, rolesLoading = false, onClose, onSaved }) => {
  const fieldId = useId();
  const nameInputRef = useRef(null);
  const returnFocusRef = useRef(null);
  const changedFieldsRef = useRef(new Set());
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [detailsError, setDetailsError] = useState('');
  const [detailsRevision, setDetailsRevision] = useState(0);
  const [original, setOriginal] = useState(manager);
  const [form, setForm] = useState({
    name: manager.name || '',
    role_id: manager.role_id != null ? String(manager.role_id) : '',
    enabled: manager.enabled !== false,
    group_access_mode: manager.group_access_mode || (manager.allowed_groups?.length ? 'restricted' : 'none'),
    allowed_groups: joinList(manager.allowed_groups),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const updateForm = (changes) => {
    Object.keys(changes).forEach(key => changedFieldsRef.current.add(key));
    setForm(previous => ({ ...previous, ...changes }));
  };

  // The list row may be stale or partial; load the full record once.
  useEffect(() => {
    let active = true;
    setDetailsLoading(true); setDetailsError('');
    ManagerService.getManagerDetail(manager.login).then((detail) => {
      if (!active) return;
      if (!detail || typeof detail !== 'object' || Array.isArray(detail) || detail._directorySummary) throw new Error('Manager details are unavailable.');
      if (detail.is_admin) throw new Error('This manager account is protected.');
      setOriginal(detail);
      const loadedForm = {
        name: detail.name || '',
        role_id: detail.role_id != null ? String(detail.role_id) : '',
        enabled: detail.enabled !== false,
        group_access_mode: detail.group_access_mode || (detail.allowed_groups?.length ? 'restricted' : 'none'),
        allowed_groups: joinList(detail.allowed_groups),
      };
      // Keep edits made while a slow detail response was in flight.
      setForm(current => Object.fromEntries(Object.entries(loadedForm).map(([key, value]) =>
        [key, changedFieldsRef.current.has(key) ? current[key] : value],
      )));
    }).catch(error => { if (active) setDetailsError(error?.response?.data?.error || error.message || 'Manager details could not be loaded.'); })
      .finally(() => { if (active) setDetailsLoading(false); });
    return () => { active = false; };
  }, [manager.login, detailsRevision]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (detailsLoading || detailsError) return;
    setSubmitting(true); setError(null);
    try {
      // IP restrictions are outside this form; omission preserves them.
      await ManagerService.updateManager(manager.login, buildManagerUpdateParams(form, original, { includeIpWhitelist: false }));
      onSaved(); onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message);
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog.Root open onOpenChange={open => { if (!open && !submitting) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="manager-edit-overlay" />
        <Dialog.Content className="managers-modal-layer manager-edit-dialog" onPointerDownOutside={event => event.preventDefault()}
          onOpenAutoFocus={event => { event.preventDefault(); returnFocusRef.current = document.activeElement; nameInputRef.current?.focus(); }}
          onCloseAutoFocus={event => { event.preventDefault(); if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus(); }}>
          <header className="manager-edit-heading">
            <Dialog.Title>Edit Manager <span className="managers-mono">{manager.login}</span></Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" disabled={submitting} aria-label="Close dialog" className="manager-edit-close"><X size={15} aria-hidden="true" /></button>
            </Dialog.Close>
          </header>
          <Dialog.Description className="sr-only">Update the manager's account details and access settings.</Dialog.Description>
          <form onSubmit={handleSubmit} className="manager-edit-form">
            <div className="manager-edit-body">
              {detailsLoading && <div className="manager-edit-pending" role="status">Loading current access settings…</div>}
              {detailsError && <div className="manager-edit-error" role="alert">{detailsError}<button type="button" onClick={() => setDetailsRevision(value => value + 1)}>Retry</button></div>}
              {error && <div className="manager-edit-error" role="alert"><AlertCircle size={14} aria-hidden="true" />{error}</div>}
              <fieldset className="manager-edit-section" disabled={submitting}>
                <legend>Account details</legend>
                <div className="manager-edit-grid">
                  <div className="manager-edit-field">
                    <label htmlFor={fieldId + '-login'}>Login</label>
                    <input id={fieldId + '-login'} value={manager.login} disabled className="managers-mono" />
                  </div>
                  <div className="manager-edit-field">
                    <label htmlFor={fieldId + '-role'}>Role</label>
                    <select id={fieldId + '-role'} value={form.role_id} disabled={rolesLoading} onChange={e => updateForm({ role_id: e.target.value })}>
                      <option value="">No role</option>
                      {form.role_id && !roles.some(role => String(role.id) === form.role_id) && <option value={form.role_id}>{original.role_name || 'Current role'}</option>}
                      {roles.map(r => <option key={r.id} value={String(r.id)}>{r.role_name}</option>)}
                    </select>
                  </div>
                  <div className="manager-edit-field manager-edit-field--wide">
                    <label htmlFor={fieldId + '-name'}>Name <span aria-hidden="true">*</span></label>
                    <input ref={nameInputRef} id={fieldId + '-name'} required value={form.name} onChange={e => updateForm({ name: e.target.value })} />
                  </div>
                </div>
              </fieldset>
              <fieldset className="manager-edit-section" disabled={submitting}>
                <legend>Access settings</legend>
                <div className="manager-edit-group-access">
                  <GroupAccessFields mode={form.group_access_mode} groups={form.allowed_groups} onChange={(mode, groups) => updateForm({ group_access_mode: mode, allowed_groups: groups.join(', ') })}>
                    <GroupPicker value={form.allowed_groups} onChange={value => updateForm({ allowed_groups: value })} />
                  </GroupAccessFields>
                </div>
                <label className="manager-edit-enabled">
                  <input type="checkbox" checked={form.enabled} onChange={e => updateForm({ enabled: e.target.checked })} aria-describedby={fieldId + '-enabled-hint'} />
                  <span>Account enabled<span id={fieldId + '-enabled-hint'} className="manager-edit-hint">Disabling this account prevents login.</span></span>
                </label>
              </fieldset>
            </div>
            <footer className="manager-edit-footer">
              <button type="button" disabled={submitting} onClick={onClose} className="manager-edit-button">Cancel</button>
              <button type="submit" disabled={submitting || detailsLoading || Boolean(detailsError)} className="manager-edit-button manager-edit-button--primary">{submitting ? 'Saving…' : 'Save'}</button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

// ─── Reset Password Modal ────────────────────────────────────────────────────
const ResetPasswordModal = ({ manager, onClose }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      await ManagerService.resetManagerPassword(manager.login, validateManagerPassword(password, confirm));
      setPassword(''); setConfirm(''); setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="managers-modal-layer fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center">
      <div className="w-[400px] bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-md shadow-2xl text-[12px]">
        <div className="flex items-center justify-between px-4 py-3 bg-[color:var(--bg-surface-1)] border-b border-[color:var(--border-default)]">
          <div className="flex items-center gap-2 text-white text-[13px] font-medium"><KeyRound size={15} className="text-white"/>Reset Password — {manager.name} ({manager.login})</div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="text-white hover:text-white p-1"><X size={14}/></button>
        </div>
        {done ? (
          <div className="p-4 flex flex-col gap-3 bg-[color:var(--bg-app)]">
            <div className="flex items-center gap-2 text-white bg-green-500/10 border border-green-500/30 p-2 rounded"><Check size={13}/>Password changed. The manager has been signed out everywhere and must log in with the new password.</div>
            <div className="flex justify-end"><button onClick={onClose} className="px-4 py-1.5 bg-[color:var(--accent-500)] text-white rounded-[2px]">Close</button></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3 bg-[color:var(--bg-app)]">
            {error && <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/30 p-2 rounded"><AlertCircle size={13}/>{error}</div>}
            <div className="flex flex-col gap-1"><label className="text-white">New Password * (12–72 characters)</label>
              <input required type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 rounded-sm focus:border-[color:var(--accent-500)] outline-none"/></div>
            <div className="flex flex-col gap-1"><label className="text-white">Confirm Password *</label>
              <input required type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} className="bg-[color:var(--bg-surface-2)] border border-[#555] text-white px-2 py-1.5 rounded-sm focus:border-[color:var(--accent-500)] outline-none"/></div>
            <div className="text-[11px] text-white">Saving signs this manager out of every open session.</div>
            <div className="flex justify-end gap-2 pt-3 border-t border-[color:var(--border-default)]">
              <button type="button" onClick={onClose} className="px-4 py-1.5 bg-[#444] hover:bg-[#555] text-white rounded-[2px]">Cancel</button>
              <button type="submit" disabled={submitting} className="px-4 py-1.5 bg-[color:var(--accent-500)] hover:bg-[color:var(--accent-500)] text-white rounded-[2px] disabled:opacity-50 min-w-[60px] flex justify-center">
                {submitting ? '...' : 'Reset'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ─── Edit Role Modal ─────────────────────────────────────────────────────────
const EditRoleModal = ({ role, onClose, onSaved }) => {
  const fieldId = useId();
  const nameInputRef = useRef(null);
  const returnFocusRef = useRef(null);
  const [form, setForm] = useState({
    role_name:   role.role_name   || '',
    description: role.description || '',
    permissions: normalizeRolePermissionMap(role.permissions),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const togglePerm = (key) =>
    setForm(p => ({ ...p, permissions: toggleRolePermission(p.permissions, key) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true); setError(null);
    try {
      if (!form.role_name.trim()) throw new Error('Role name is required.');
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
    <Dialog.Root open onOpenChange={open => { if (!open && !submitting) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="manager-edit-overlay" />
        <Dialog.Content className="managers-modal-layer manager-edit-dialog role-edit-dialog" onPointerDownOutside={event => event.preventDefault()}
          onOpenAutoFocus={event => { event.preventDefault(); returnFocusRef.current = document.activeElement; nameInputRef.current?.focus(); }}
          onCloseAutoFocus={event => { event.preventDefault(); if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus(); }}>
          <header className="manager-edit-heading">
            <Dialog.Title>Edit Role <span className="role-edit-identity">Role <span className="managers-mono">{role.id}</span></span></Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" disabled={submitting} aria-label="Close dialog" className="manager-edit-close"><X size={15} aria-hidden="true" /></button>
            </Dialog.Close>
          </header>
          <Dialog.Description className="sr-only">Update role details and the permissions assigned to this role.</Dialog.Description>
          <form onSubmit={handleSubmit} className="manager-edit-form">
            <div className="manager-edit-body">
              {error && <div className="manager-edit-error" role="alert"><AlertCircle size={14} aria-hidden="true" />{error}</div>}
              <fieldset className="manager-edit-section" disabled={submitting}>
                <legend>Role details</legend>
                <div className="manager-edit-grid">
                  <div className="manager-edit-field manager-edit-field--wide">
                    <label htmlFor={fieldId + '-name'}>Role name <span aria-hidden="true">*</span></label>
                    <input ref={nameInputRef} id={fieldId + '-name'} required value={form.role_name} onChange={e => setForm(p => ({ ...p, role_name: e.target.value }))} />
                  </div>
                  <div className="manager-edit-field manager-edit-field--wide">
                    <label htmlFor={fieldId + '-description'}>Description <span className="role-edit-optional">Optional</span></label>
                    <input id={fieldId + '-description'} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe the role's responsibilities" />
                  </div>
                </div>
              </fieldset>
              <fieldset className="manager-edit-section" disabled={submitting}>
                <legend>Permissions</legend>
                <PermissionChecklist permissions={form.permissions} onToggle={togglePerm} disabled={submitting} />
              </fieldset>
            </div>
            <footer className="manager-edit-footer">
              <button type="button" disabled={submitting} onClick={onClose} className="manager-edit-button">Cancel</button>
              <button type="submit" disabled={submitting} className="manager-edit-button manager-edit-button--primary">{submitting ? 'Saving…' : 'Save'}</button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
    <div className="managers-modal-layer fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center">
      <div className="w-[700px] max-h-[80vh] bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-md shadow-2xl flex flex-col text-[12px]">
        <div className="flex items-center justify-between px-4 py-3 bg-[color:var(--bg-surface-1)] border-b border-[color:var(--border-default)] shrink-0">
          <div className="flex items-center gap-2 text-white text-[13px] font-medium">
            <Activity size={15} className="text-white"/>Activity Log — {manager.name} ({manager.login})
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="text-white hover:text-white p-1"><X size={14}/></button>
        </div>
        <div className="overflow-auto flex-1 bg-[color:var(--bg-app)]">
          <div className="flex border-b border-[#333] bg-[color:var(--bg-surface-1)] select-none sticky top-0">
            <div className="w-[60px] px-2 py-1.5 text-[11px] text-white font-medium border-r border-[#333]">ID</div>
            <div className="w-[160px] px-2 py-1.5 text-[11px] text-white font-medium border-r border-[#333]">Action</div>
            <div className="w-[90px] px-2 py-1.5 text-[11px] text-white font-medium border-r border-[#333]">Target</div>
            <div className="w-[120px] px-2 py-1.5 text-[11px] text-white font-medium border-r border-[#333]">IP</div>
            <div className="flex-1 px-2 py-1.5 text-[11px] text-white font-medium">Time</div>
          </div>
          {loading && <div className="p-4 text-white italic">Loading...</div>}
          {!loading && logs.length === 0 && <div className="p-4 text-white italic">No activity logs found.</div>}
          {logs.map((log, i) => (
            <div key={log.id || i} className={`flex border-b border-black/10 ${i%2===0?'bg-[color:var(--bg-app)]':'bg-[color:var(--bg-surface-1)]'}`}>
              <div className="w-[60px] px-2 py-1 text-[color:var(--text-primary)] border-r border-black/10">{log.id}</div>
              <div className="w-[160px] px-2 py-1 text-white border-r border-black/10 truncate">{log.action_type}</div>
              <div className="w-[90px] px-2 py-1 text-white border-r border-black/10">{log.target_login || '—'}</div>
              <div className="w-[120px] px-2 py-1 text-white border-r border-black/10 truncate">{log.ip_address || '—'}</div>
              <div className="flex-1 px-2 py-1 text-white">{fmtTime(log.action_time)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Main ManagersView ───────────────────────────────────────────────────────
const EmptyManagerView = ({ title, description }) => (
  <div role="status" className="managers-empty">
    <Users size={28} strokeWidth={1.4} aria-hidden="true" />
    <div className="managers-empty-title">{title}</div>
    <p>{description}</p>
  </div>
);

const ManagerEditButton = ({ label, onClick }) => (
  <Tooltip content={label}>
    <button type="button" className="managers-edit-trigger" aria-label={label} onClick={onClick}>
      <Edit2 size={14} strokeWidth={1.65} aria-hidden="true" />
    </button>
  </Tooltip>
);

const ManagerActionsMenu = ({ label, heading, actions, protectedAccount = false }) => (
  <Menu.Root>
    <Tooltip content={label}>
      <Menu.Trigger asChild>
        <button type="button" className="managers-actions-trigger" aria-label={label}>
          <MoreHorizontal size={15} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </Menu.Trigger>
    </Tooltip>
    <Menu.Portal>
      <Menu.Content className="managers-command-menu" align="end" sideOffset={5} collisionPadding={8}>
        <Menu.Label className="managers-command-heading">
          {heading}
          {protectedAccount && <span className="managers-command-protected"><LockKeyhole size={11} aria-hidden="true" />Protected account</span>}
        </Menu.Label>
        {actions.map(({ text, label: actionLabel, icon, onSelect, destructive }) => (
          <React.Fragment key={text}>
            {destructive && <Menu.Separator className="managers-command-divider" />}
            <Menu.Item className="managers-command-item" data-destructive={destructive || undefined} aria-label={actionLabel} onSelect={onSelect}>
              {React.createElement(icon, { size: 14, strokeWidth: 1.65, 'aria-hidden': true })}{text}
            </Menu.Item>
          </React.Fragment>
        ))}
      </Menu.Content>
    </Menu.Portal>
  </Menu.Root>
);

const MANAGER_TABS = ['Managers', 'Roles', 'Online'];

const getInitialManagersTab = (tab) => (MANAGER_TABS.includes(tab) ? tab : 'Managers');

const ManagersView = ({ refreshTrigger = 0, searchQuery = '', sortDirection = '', onRowsChange, initialTab }) => {
  const [directorySearch, setDirectorySearch] = useState('');
  const matchesSearch = useCallback((row) => [searchQuery, directorySearch].every((query) =>
    !query.trim() || Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(query.trim().toLowerCase()))
  ), [searchQuery, directorySearch]);
  const [activeTab, setActiveTab] = useState(() => getInitialManagersTab(initialTab));
  const identity = useAuthStore(getManagerDirectoryIdentity);
  const directory = useSyncExternalStore(subscribeManagerDirectory, () => peekManagerDirectory(identity));
  const managers = directory.managers.rows, roles = directory.roles.rows, online = directory.online.rows;
  const activeResource = directory[activeTab.toLowerCase()];
  const loading = activeResource.loading;
  const loadErrors = useMemo(() => Object.fromEntries(Object.entries(directory).map(([kind, resource]) =>
    [kind, resource.error ? buildActionableErrorState(resource.error, { title: (kind === 'online' ? 'Online sessions' : kind === 'roles' ? 'Roles' : 'Managers') + ' failed to load', actionLabel: 'Retry', fallback: 'Could not refresh manager data' }) : null],
  )), [directory]);

  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  // Set while Create Role was opened from Create Manager: selects the new role there.
  const [selectCreatedRole, setSelectCreatedRole] = useState(null);
  const [isCreateManagerOpen, setIsCreateManagerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [editingManager, setEditingManager] = useState(null);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [activityTarget, setActivityTarget] = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false });
  const currentUser = useAuthStore((state) => state.user);

  // The backend refuses changes to protected admin identities and to the
  // signed-in account itself, so those rows get no edit actions.
  const canAdminister = (row) => !row.is_admin && Number(row.login) !== Number(currentUser?.login);

  const fetchManagers = useCallback(() => readManagerDirectory('managers'), []);
  const fetchRoles = useCallback(() => readManagerDirectory('roles'), []);
  useEffect(() => {
    void primeManagerDirectory();
    const refreshVisible = () => { if (document.visibilityState !== 'hidden') void primeManagerDirectory(); };
    const timer = window.setInterval(refreshVisible, 15_000);
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refreshVisible); document.removeEventListener('visibilitychange', refreshVisible); };
  }, [identity]);
  const previousRefresh = useRef(refreshTrigger);
  useEffect(() => {
    if (previousRefresh.current !== refreshTrigger) { previousRefresh.current = refreshTrigger; void primeManagerDirectory({ force: true }); }
  }, [refreshTrigger]);
  // Window-menu entries (e.g. Online Users) reuse this directory with a preset
  // tab, so follow initialTab without a remount when navigation changes it.
  useEffect(() => {
    setActiveTab(getInitialManagersTab(initialTab));
  }, [initialTab]);

  const handleContextMenu = (e, record, type) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, record, type });
  };

  const handleDisableManager = async (login) => {
    if (!window.confirm(`Disable manager ${login}? They cannot log in until re-enabled.`)) return;
    try {
      await ManagerService.setManagerEnabled(login, false);
      fetchManagers();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
    setContextMenu({ visible: false });
  };

  const handleDeleteManager = async (login, name) => {
    if (!window.confirm(`Permanently delete manager ${login}${name ? ` (${name})` : ''} from the database? This cannot be undone.`)) return;
    try {
      await ManagerService.deleteManager(login);
      fetchManagers();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
    setContextMenu({ visible: false });
  };

  const handleEnableManager = async (login) => {
    try {
      await ManagerService.setManagerEnabled(login, true);
      fetchManagers();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
    setContextMenu({ visible: false });
  };

  const handleDeleteRole = async (roleId, roleName) => {
    if (!window.confirm(`Permanently delete role "${roleName}" and its permissions? This fails if managers are assigned to it.`)) return;
    try {
      await ManagerService.deleteRole(roleId);
      fetchRoles();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
    setContextMenu({ visible: false });
  };

  const tabs = ['Managers', 'Roles', 'Online'];
  const tabIcons = { Managers: Users, Roles: Shield, Online: Wifi };
  const tabRows = { Managers: managers, Roles: roles, Online: online };
  const activeRows = tabRows[activeTab];
  const activeError = loadErrors[activeTab.toLowerCase()];
  const visibleRows = useMemo(() => sortToolbarRows(activeRows.filter(matchesSearch), sortDirection, 'Managers'), [activeRows, matchesSearch, sortDirection]);
  // Toolbar exports follow the current tab and search without including access settings.
  const exportRows = useMemo(() => visibleRows.map((row) => {
    if (activeTab === 'Roles') return { id: row.id, role_name: row.role_name, description: row.description, permissions: row.permissions, created_at: row.created_at };
    if (activeTab === 'Online') return { login: row.login, name: row.name, connected_at: row.connected_at, session_age: row.session_age };
    return { login: row.login, name: row.name, role_name: row.role_name, access: row.is_admin ? 'Administrator' : 'Standard', status: row.enabled ? 'Active' : 'Disabled', last_login: row.last_login, last_ip: row.last_ip };
  }), [activeTab, visibleRows]);
  useEffect(() => { onRowsChange?.(exportRows); }, [exportRows, onRowsChange]);
  const retryActiveTab = () => readManagerDirectory(activeTab.toLowerCase(), { force: true });
  const columns = {
    Managers: ['Login', 'Name', 'Role', 'Access', 'Status', 'Last login', 'Last IP', 'Actions'],
    Roles: ['ID', 'Role name', 'Description', 'Permissions', 'Created', 'Actions'],
    Online: ['Login', 'Name', 'Connected at', 'Session age'],
  }[activeTab];
  const emptyTitles = { Managers: 'No managers yet', Roles: 'No roles yet', Online: 'No managers online' };
  const emptyDescriptions = {
    Managers: 'Create a manager to add an operator to this broker.',
    Roles: 'Create a role to define a manager permission set.',
    Online: 'Connected manager sessions will appear here.',
  };
  const renderLoadError = (state, onRetry) => (
    <ActionableErrorState state={state} onAction={onRetry} />
  );

  return (
    <TooltipProvider>
    <div className="manager-view"
      onClick={() => setContextMenu({ visible: false })}
      onContextMenu={(e) => e.preventDefault()}>

      <header className="managers-heading">
        <h2 title="Operator accounts, roles, and connected sessions">Managers</h2>
        <div className="managers-heading-actions">
          {activeTab === 'Managers' && (
            <button type="button" onClick={() => setIsCreateManagerOpen(true)} className="managers-button managers-button--primary">
              <UserPlus size={15} aria-hidden="true" />Create Manager
            </button>
          )}
          {activeTab === 'Roles' && (
            <button type="button" onClick={() => setIsCreateRoleOpen(true)} className="managers-button managers-button--primary">
              <ShieldPlus size={15} aria-hidden="true" />Create Role
            </button>
          )}
        </div>
      </header>

      <section className="managers-directory" aria-label="Manager directory">
        <div className="managers-directory-toolbar">
          <nav aria-label="Manager views" className="managers-tabs">
            {tabs.map((tab) => {
              const Icon = tabIcons[tab];
              return (
                <button type="button" key={tab}
                  onClick={() => { setActiveTab(tab); setDirectorySearch(''); }}
                  aria-current={activeTab === tab ? 'page' : undefined}
                  className="managers-tab">
                  <Icon size={14} aria-hidden="true" />
                  {tab}
                  <span className="managers-tab-count">{directory[tab.toLowerCase()].hasData ? tabRows[tab].length : '—'}</span>
                </button>
              );
            })}
          </nav>
          <div className="managers-search">
            <Search size={14} aria-hidden="true" />
            <input type="search" aria-label={'Search ' + activeTab.toLowerCase()}
              placeholder={activeTab === 'Managers' ? 'Search login, name, or role…' : 'Search ' + activeTab.toLowerCase() + '…'}
              value={directorySearch} onChange={(event) => setDirectorySearch(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Escape') setDirectorySearch(''); }} />
            {directorySearch && (
              <button type="button" onClick={() => setDirectorySearch('')} aria-label="Clear directory search">
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="managers-table-scroll" tabIndex={0} aria-label={activeTab + ' table'} aria-busy={loading}>
          <table className={'managers-table managers-table--' + activeTab.toLowerCase()} aria-label={activeTab}>
            <thead>
              <tr data-export-header="true">
                {columns.map((column) => <th key={column} scope="col">{column}</th>)}
              </tr>
            </thead>
            <tbody>
              {!loading && visibleRows.map((row) => (
                <tr data-export-row="true" key={activeTab === 'Roles' ? row.id : row.login}
                  onContextMenu={activeTab === 'Online' ? undefined : (event) => handleContextMenu(event, row, activeTab === 'Roles' ? 'role' : 'manager')}>
                  {activeTab === 'Managers' && (
                    <>
                      <td className="managers-mono">{row.login}</td>
                      <td>
                        <span className="managers-name" title={row.name}>{row.name || '—'}</span>
                      </td>
                      <td><span className={row.role_name ? 'managers-cell-text' : 'managers-muted'} title={row.role_name}>{row.role_name || '—'}</span></td>
                      <td><span className="managers-access" data-admin={Boolean(row.is_admin)}>{row.is_admin ? 'Administrator' : 'Standard'}</span></td>
                      <td><span className="managers-status" data-active={Boolean(row.enabled)}>{row.enabled ? 'Active' : 'Disabled'}</span></td>
                      <td><span className={row.last_login ? 'managers-cell-text' : 'managers-muted'} title={fmtTime(row.last_login)}>{fmtTime(row.last_login)}</span></td>
                      <td className="managers-mono"><span className={row.last_ip ? 'managers-cell-text' : 'managers-muted'} title={row.last_ip}>{row.last_ip || '—'}</span></td>
                      <td>
                        <div className="managers-row-actions">
                          <div className="managers-action-group">
                            {canAdminister(row) ? (
                              <ManagerEditButton label={'Edit manager ' + row.login} onClick={() => setEditingManager(row)} />
                            ) : (
                              <Tooltip content="Protected administrator or your own account">
                                <span className="managers-protected-control" tabIndex={0} aria-label={'Protected manager ' + row.login}>
                                  <LockKeyhole size={13} strokeWidth={1.65} aria-hidden="true" />
                                </span>
                              </Tooltip>
                            )}
                            <ManagerActionsMenu label={'More actions for manager ' + row.login} heading={'Manager ' + row.login} protectedAccount={!canAdminister(row)} actions={[
                              ...(canAdminister(row) ? [
                                { text: 'Reset password', label: 'Reset password for manager ' + row.login, icon: KeyRound, onSelect: () => setPasswordTarget(row) },
                              ] : []),
                              { text: 'View activity', label: 'View activity for manager ' + row.login, icon: Activity, onSelect: () => setActivityTarget(row) },
                              ...(canAdminister(row) ? [
                                { text: row.enabled ? 'Disable manager' : 'Enable manager', label: (row.enabled ? 'Disable' : 'Enable') + ' manager ' + row.login,
                                  icon: Power, onSelect: () => row.enabled ? handleDisableManager(row.login) : handleEnableManager(row.login) },
                                { text: 'Delete manager', label: 'Delete manager ' + row.login + ' permanently', icon: Trash2, destructive: true, onSelect: () => handleDeleteManager(row.login, row.name) },
                              ] : []),
                            ]} />
                          </div>
                        </div>
                      </td>
                    </>
                  )}
                  {activeTab === 'Roles' && (
                    <>
                      <td className="managers-mono">{row.id}</td>
                      <td><span className="managers-name" title={row.role_name}>{row.role_name}</span></td>
                      <td><span className="managers-cell-text" title={row.description}>{row.description || <span className="managers-muted">—</span>}</span></td>
                      <td><PermBadges permissions={row.permissions} /></td>
                      <td><span className="managers-cell-text" title={fmtTime(row.created_at)}>{fmtTime(row.created_at)}</span></td>
                      <td><div className="managers-row-actions">
                        <div className="managers-action-group">
                          <ManagerEditButton label={'Edit role ' + row.role_name} onClick={() => setEditingRole(row)} />
                          <ManagerActionsMenu label={'More actions for role ' + row.role_name} heading={row.role_name} actions={[
                            { text: 'Delete role', label: 'Delete role ' + row.role_name, icon: Trash2, destructive: true, onSelect: () => handleDeleteRole(row.id, row.role_name) },
                          ]} />
                        </div>
                      </div></td>
                    </>
                  )}
                  {activeTab === 'Online' && (
                    <>
                      <td className="managers-mono">{row.login}</td>
                      <td><span className="managers-name" title={row.name}>{row.name || '—'}</span></td>
                      <td>{fmtTime(row.connected_at)}</td>
                      <td className="managers-mono">{fmtAge(row.session_age)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div role="status" className="managers-loading"><RefreshCw size={18} className="animate-spin" aria-hidden="true" />Loading manager data…</div>}
          {!loading && activeError && <div className="managers-error">{renderLoadError(activeError, retryActiveTab)}</div>}
          {!loading && !activeError && activeRows.length === 0 && <EmptyManagerView title={emptyTitles[activeTab]} description={emptyDescriptions[activeTab]} />}
          {!loading && !activeError && activeRows.length > 0 && visibleRows.length === 0 && (
            <EmptyManagerView title={'No matching ' + activeTab.toLowerCase()} description="Try another search, or clear the directory and toolbar searches to show all records." />
          )}
        </div>

        <footer className="managers-footer">
          <span aria-live="polite">{loading ? 'Updating records…' : activeError && !activeResource.hasData ? 'Records unavailable' : 'Showing ' + visibleRows.length + ' of ' + activeRows.length + ' ' + (activeTab === 'Online' ? 'sessions' : activeTab.toLowerCase())}</span>
          {activeResource.refreshing && activeResource.hasData && <span className="managers-refresh-state" role="status">Refreshing…</span>}
          <span className="managers-session-summary"><Wifi size={12} aria-hidden="true" />{loadErrors.online ? 'Session data unavailable' : !directory.online.hasData ? 'Checking sessions…' : online.length + ' connected ' + (online.length === 1 ? 'session' : 'sessions')}</span>
        </footer>
      </section>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div className="fixed z-[9999] bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] shadow-2xl py-1 min-w-[200px] text-[12px] text-white rounded-[2px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}>
          {contextMenu.type === 'manager' && (
            <>
              {canAdminister(contextMenu.record) && (
                <>
                  <div className="px-5 py-1.5 hover:bg-[color:var(--accent-500)] hover:text-white cursor-pointer select-none"
                    onClick={() => { setEditingManager(contextMenu.record); setContextMenu({ visible: false }); }}>
                    <span className="flex items-center gap-2"><Edit2 size={12}/>Edit Manager</span>
                  </div>
                  <div className="px-5 py-1.5 hover:bg-[color:var(--accent-500)] hover:text-white cursor-pointer select-none"
                    onClick={() => { setPasswordTarget(contextMenu.record); setContextMenu({ visible: false }); }}>
                    <span className="flex items-center gap-2"><KeyRound size={12}/>Reset Password</span>
                  </div>
                </>
              )}
              <div className="px-5 py-1.5 hover:bg-[color:var(--accent-500)] hover:text-white cursor-pointer select-none"
                onClick={() => { setActivityTarget(contextMenu.record); setContextMenu({ visible: false }); }}>
                <span className="flex items-center gap-2"><Activity size={12}/>View Activity Log</span>
              </div>
              {canAdminister(contextMenu.record) && (
                <>
                  <div className="h-[1px] bg-[color:var(--border-default)] my-1 mx-2"></div>
                  {contextMenu.record.enabled ? (
                    <div className="px-5 py-1.5 hover:bg-orange-700 hover:text-white cursor-pointer select-none text-orange-400"
                      onClick={() => handleDisableManager(contextMenu.record.login)}>
                      <span className="flex items-center gap-2"><Power size={12}/>Disable Manager</span>
                    </div>
                  ) : (
                    <div className="px-5 py-1.5 hover:bg-green-700 hover:text-white cursor-pointer select-none text-white"
                      onClick={() => handleEnableManager(contextMenu.record.login)}>
                      <span className="flex items-center gap-2"><Power size={12}/>Enable Manager</span>
                    </div>
                  )}
                  <div className="px-5 py-1.5 hover:bg-red-700 hover:text-white cursor-pointer select-none text-red-400"
                    onClick={() => handleDeleteManager(contextMenu.record.login, contextMenu.record.name)}>
                    <span className="flex items-center gap-2"><Trash2 size={12}/>Delete Manager</span>
                  </div>
                </>
              )}
            </>
          )}
          {contextMenu.type === 'role' && (
            <>
              <div className="px-5 py-1.5 hover:bg-[color:var(--accent-500)] hover:text-white cursor-pointer select-none"
                onClick={() => { setEditingRole(contextMenu.record); setContextMenu({ visible: false }); }}>
                <span className="flex items-center gap-2"><Edit2 size={12}/>Edit Role</span>
              </div>
              <div className="h-[1px] bg-[color:var(--border-default)] my-1 mx-2"></div>
              <div className="px-5 py-1.5 hover:bg-red-700 hover:text-white cursor-pointer select-none text-red-400"
                onClick={() => handleDeleteRole(contextMenu.record.id, contextMenu.record.role_name)}>
                <span className="flex items-center gap-2"><Trash2 size={12}/>Delete Role</span>
              </div>
            </>
          )}
        </div>
      )}

      {isCreateManagerOpen && <CreateManagerModal roles={roles} rolesLoading={directory.roles.loading} onClose={() => setIsCreateManagerOpen(false)} onCreated={fetchManagers}
        onCreateRole={(select) => { setSelectCreatedRole(() => select); setIsCreateRoleOpen(true); }} />}
      {isCreateRoleOpen    && <CreateRoleModal
        onClose={() => { setIsCreateRoleOpen(false); setSelectCreatedRole(null); }}
        onCreated={(created) => { fetchRoles(); if (selectCreatedRole && created?.id) selectCreatedRole(created.id); }} />}
      {editingRole         && <EditRoleModal      role={editingRole} onClose={() => setEditingRole(null)} onSaved={fetchRoles} />}
      {activityTarget      && <ActivityLogModal   manager={activityTarget} onClose={() => setActivityTarget(null)} />}
      {editingManager      && <EditManagerModal   manager={editingManager} roles={roles} rolesLoading={directory.roles.loading} onClose={() => setEditingManager(null)} onSaved={fetchManagers} />}
      {passwordTarget      && <ResetPasswordModal manager={passwordTarget} onClose={() => setPasswordTarget(null)} />}
    </div>
    </TooltipProvider>
  );
};

export default ManagersView;
