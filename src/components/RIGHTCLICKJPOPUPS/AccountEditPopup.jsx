import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { AccountsService } from '../../services/accounts.service';
import { useToast } from '../ui/useToast';

const MotionDiv = motion.div;

const PROFILE_FIELDS = ['name', 'email', 'phone', 'group', 'currency'];

const pickDefined = (source, keys, fallback = '') => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null) return value;
  }
  return fallback;
};

const normalizeText = (value) => String(value ?? '').trim();

const normalizeStatus = (value, enabled) => {
  const status = normalizeText(value).toLowerCase();
  if (status === 'active' || status === 'enabled') return 'active';
  if (enabled === true) return 'active';
  return 'suspended';
};

const normalizeBoolean = (value) => (
  value === true ||
  value === 1 ||
  value === '1' ||
  String(value).toLowerCase() === 'true' ||
  String(value).toLowerCase() === 'yes'
);

const getAccountSource = (row) => row?.raw || row || {};

const getAccountLogin = (row) => pickDefined(getAccountSource(row), [
  'login',
  'Login',
  'account_login',
  'accountLogin',
], row?.login || row?.id || '');

const buildFormState = (row) => {
  const source = getAccountSource(row);
  const statusValue = pickDefined(source, ['status', 'Status'], row?.status || '');
  const enabled = pickDefined(source, ['enabled', 'Enabled'], undefined);

  return {
    name: normalizeText(pickDefined(source, ['name', 'Name', 'client_name', 'clientName', 'full_name', 'fullName', 'user_name', 'userName'], row?.name || '')),
    email: normalizeText(pickDefined(source, ['email', 'Email'], '')),
    phone: normalizeText(pickDefined(source, ['phone', 'Phone'], '')),
    group: normalizeText(pickDefined(source, ['group', 'Group', 'group_name', 'groupName', 'account_group', 'accountGroup', 'accountGroupName'], row?.group || '')),
    currency: normalizeText(pickDefined(source, ['currency', 'Currency'], row?.currency || '')),
    status: normalizeStatus(statusValue, enabled),
    readOnly: normalizeBoolean(pickDefined(source, ['readonly', 'readOnly', 'ReadOnly', 'read_only', 'is_readonly', 'IsReadOnly'], false)),
    balance: pickDefined(source, ['balance', 'Balance'], row?.balance ?? 0),
    equity: pickDefined(source, ['equity', 'Equity'], row?.equity ?? 0),
    reason: 'Account updated from admin UI',
  };
};

const buildChangedProfilePayload = (form, original) => (
  PROFILE_FIELDS.reduce((payload, field) => {
    const next = normalizeText(form[field]);
    const previous = normalizeText(original[field]);
    if (next !== previous) payload[field] = next;
    return payload;
  }, {})
);

const Field = ({ label, children }) => (
  <div className="flex min-w-0 items-center gap-3">
    <label className="text-[12px] w-24 shrink-0 text-right text-[color:var(--text-secondary)]">{label}</label>
    {children}
  </div>
);

const inputClassName = 'min-w-0 w-full flex-1 bg-[color:var(--bg-surface-1)] border border-[color:var(--border-strong)] px-2 py-1 text-[12px] text-[color:var(--text-primary)] focus:outline-none focus:border-blue-500 rounded-sm disabled:opacity-60';
const selectClassName = 'min-w-0 w-full flex-1 bg-[color:var(--bg-surface-1)] border border-[color:var(--border-strong)] px-2 py-1 text-[12px] text-[color:var(--text-primary)] focus:outline-none focus:border-blue-500 rounded-sm cursor-pointer disabled:opacity-60';

const AccountEditPopup = ({ account, onClose, onSaved }) => {
  const original = useMemo(() => buildFormState(account), [account]);
  const login = useMemo(() => getAccountLogin(account), [account]);
  const [form, setForm] = useState(original);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const { notify } = useToast();

  const setField = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    if (!login) {
      setError('Cannot edit this account because it has no login.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      let changed = false;
      const profilePayload = buildChangedProfilePayload(form, original);

      if (Object.keys(profilePayload).length > 0) {
        await AccountsService.updateAccount(login, profilePayload);
        changed = true;
      }

      if (form.status !== original.status) {
        if (form.status === 'active') {
          await AccountsService.activate(login, form.reason);
        } else {
          await AccountsService.suspend(login, form.reason);
        }
        changed = true;
      }

      if (form.readOnly !== original.readOnly) {
        await AccountsService.setReadonly(login, form.readOnly, form.reason);
        changed = true;
      }

      if (changed) {
        notify({ title: 'Account updated', description: `Login ${login}`, tone: 'success' });
        onSaved?.();
      }
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update account.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 font-sans">
      <MotionDiv
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        role="dialog"
        aria-modal="true"
        aria-label="Edit account"
        className="w-[520px] max-w-[calc(100vw-32px)] bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-[6px] shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
      >
        <div className="flex justify-between items-center h-8 bg-[color:var(--bg-app)] px-3 border-b border-white/5 select-none shrink-0">
          <div className="text-[12px] text-[color:var(--text-primary)]">Edit Account {login ? `#${login}` : ''}</div>
          <button onClick={onClose} className="w-[28px] h-[20px] flex items-center justify-center hover:bg-red-500 hover:text-white text-[color:var(--text-muted)] transition-colors rounded-tr-[4px]">
            <X size={12} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3 text-[color:var(--text-secondary)] overflow-y-auto no-scrollbar">
          <Field label="Login:">
            <input value={login} disabled className={inputClassName} />
          </Field>
          <Field label="Name:">
            <input value={form.name} onChange={setField('name')} className={inputClassName} autoFocus />
          </Field>
          <Field label="Email:">
            <input type="email" value={form.email} onChange={setField('email')} className={inputClassName} />
          </Field>
          <Field label="Phone:">
            <input value={form.phone} onChange={setField('phone')} className={inputClassName} />
          </Field>
          <Field label="Group:">
            <input value={form.group} onChange={setField('group')} className={inputClassName} />
          </Field>
          <Field label="Currency:">
            <input value={form.currency} onChange={setField('currency')} className={inputClassName} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <Field label="Balance:">
              <input value={form.balance} disabled className={inputClassName} />
            </Field>
            <Field label="Equity:">
              <input value={form.equity} disabled className={inputClassName} />
            </Field>
          </div>

          <Field label="Status:">
            <select value={form.status} onChange={setField('status')} className={selectClassName}>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </Field>
          <Field label="Read only:">
            <label className="flex flex-1 items-center gap-2 text-[12px] text-[color:var(--text-secondary)]">
              <input type="checkbox" checked={form.readOnly} onChange={setField('readOnly')} className="accent-blue-500 w-3 h-3" />
              Prevent trading from this account
            </label>
          </Field>
          <Field label="Reason:">
            <input value={form.reason} onChange={setField('reason')} className={inputClassName} />
          </Field>

          {error && <div className="text-red-400 text-[11px] text-center mt-1">{error}</div>}
        </div>

        <div className="px-4 py-3 bg-[color:var(--bg-app)] flex justify-end gap-2 border-t border-white/5 select-none shrink-0">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 h-[24px] bg-[color:var(--accent-500)] text-white border border-transparent rounded text-[12px] hover:bg-[color:var(--accent-500)] transition-all disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-6 h-[24px] bg-transparent border border-[color:var(--border-strong)] rounded text-[12px] text-white hover:bg-white/10 hover:border-[#777777] transition-all disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </MotionDiv>
    </div>
  );
};

export default AccountEditPopup;
