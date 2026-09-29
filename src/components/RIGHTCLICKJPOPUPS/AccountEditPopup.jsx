import {useAuthStore} from '../../store/authStore.js';
import {hasPermission,PERMISSION_KEYS} from '../../utils/permissions.js';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Wallet } from 'lucide-react';
import AccountTradeControls from './AccountTradeControls.jsx';
import PendingTradeControls from './PendingTradeControls.jsx';
import CustomerNativePending from './CustomerNativePending.jsx';
import { AccountsService } from '../../services/accounts.service';
import { AdminConfigApi } from '../../services/adminConfigApi';
import FundingPopup from './FundingPopup';
import {
  ACCOUNT_MODE_OPTIONS,
  buildAccountTradingChanges,
  describeConfigError,
  readConfigError,
} from '../../utils/legacyConfig';
import { useToast } from '../ui/useToast';

const MotionDiv = motion.div;

// name/email/phone stay on the account profile update. Group and currency,
// like leverage and account mode, are trading configuration: they go through
// the G8-guarded manager PATCH (expected revision + active-trade lock).
const PROFILE_FIELDS = ['name', 'email', 'phone'];
const GUARDED_PROFILE_FIELDS = ['group', 'currency'];

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
    leverage: normalizeText(pickDefined(source, ['leverage', 'Leverage'], '')),
    accountMode: normalizeText(pickDefined(source, ['account_mode', 'accountMode', 'AccountMode'], 'hedging')).toLowerCase() || 'hedging',
    balance: pickDefined(source, ['balance', 'Balance'], row?.balance ?? 0),
    equity: pickDefined(source, ['equity', 'Equity'], row?.equity ?? 0),
    reason: 'Account updated from admin UI',
  };
};

const buildChangedProfilePayload = (form, original, fields = PROFILE_FIELDS) => (
  fields.reduce((payload, field) => {
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
	const nativeCancelUser=useAuthStore(state=>state.user);
  const original = useMemo(() => buildFormState(account), [account]);
  const login = useMemo(() => getAccountLogin(account), [account]);
  const [form, setForm] = useState(original);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lockDetails, setLockDetails] = useState([]);
  const [fundingOpen, setFundingOpen] = useState(false);
  // G8: the trading configuration (group, currency, leverage, account mode)
  // and its revision come from UserDetails; '' revision (older backend)
  // keeps the legacy write.
  const [config, setConfig] = useState(() => ({
    group: original.group, currency: original.currency, leverage: original.leverage,
    accountMode: original.accountMode, revision: '',
  }));
  const touchedRef = useRef({});
  const { notify } = useToast();

  useEffect(() => {
    if (!login) return undefined;
    let active = true;
    AdminConfigApi.getAccountConfig(login).then((fresh) => {
      if (!active) return;
      setConfig(fresh);
      setForm((current) => ({
        ...current,
        ...(touchedRef.current.group ? {} : { group: fresh.group || current.group }),
        ...(touchedRef.current.currency ? {} : { currency: fresh.currency || current.currency }),
        ...(touchedRef.current.leverage ? {} : { leverage: fresh.leverage || current.leverage }),
        ...(touchedRef.current.accountMode ? {} : { accountMode: fresh.accountMode || current.accountMode }),
      }));
    }).catch(() => {});
    return () => { active = false; };
    // Load once per account; later edits are tracked in touchedRef.
  }, [login]);

  const setField = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    touchedRef.current = { ...touchedRef.current, [field]: true };
  };

  const reloadConfig = async () => {
    const fresh = await AdminConfigApi.getAccountConfig(login);
    setConfig(fresh);
    setForm((current) => ({ ...current, group: fresh.group, currency: fresh.currency, leverage: fresh.leverage, accountMode: fresh.accountMode }));
    touchedRef.current = {};
  };

  const handleSave = async () => {
    if (!login) {
      setError('Cannot edit this account because it has no login.');
      return;
    }

    const trading = buildAccountTradingChanges(config, form);
    const firstTradingError = Object.values(trading.errors)[0];
    if (firstTradingError) {
      setError(firstTradingError);
      return;
    }
    const guardedPayload = { ...buildChangedProfilePayload(form, config, GUARDED_PROFILE_FIELDS), ...trading.changes };

    setIsSaving(true);
    setError(null);
    setLockDetails([]);

    let changed = false;
    try {
      // Trading configuration first: a stale revision or an active-trade
      // lock stops the save before any other change is written.
      if (Object.keys(guardedPayload).length > 0) {
        const saved = await AdminConfigApi.updateAccountTrading(login, guardedPayload, config.revision, form.reason);
        setConfig(saved);
        changed = true;
      }

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
      const parsed = readConfigError(err, 'Failed to update account.');
      setError(describeConfigError(err, 'Failed to update account.'));
      setLockDetails(parsed.lockDetails);
      if (parsed.kind === 'conflict') reloadConfig().catch(() => {});
      if (changed) onSaved?.();
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Leverage 1:">
              <input type="number" min="1" max="10000" step="1" value={form.leverage} onChange={setField('leverage')} aria-label="Leverage" className={inputClassName} />
            </Field>
            <Field label="Account mode:">
              <select value={form.accountMode} onChange={setField('accountMode')} aria-label="Account mode" className={selectClassName}>
                {ACCOUNT_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="text-[10px] text-[color:var(--text-muted)] pl-[108px] -mt-1">
            Group, currency, leverage and account mode cannot change while the account has open positions, pending orders or unfinished orders.
          </div>

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

          {error && <div role="alert" className="text-red-400 text-[11px] text-center mt-1">{error}</div>}
          {lockDetails.length > 0 && (
            <ul aria-label="Why the change is locked" className="text-red-300 text-[11px] list-disc pl-8 -mt-1">
              {lockDetails.map((detail) => <li key={detail}>{detail}</li>)}
            </ul>
          )}
          <AccountTradeControls key={login} login={login} />
          <PendingTradeControls key={'pending-'+login} login={login} />
          <CustomerNativePending key={'native:'+login} login={login} canPlace={hasPermission(nativeCancelUser,PERMISSION_KEYS.MANAGE_TRADES)} canCancel={hasPermission(nativeCancelUser,PERMISSION_KEYS.MANAGE_TRADES)||hasPermission(nativeCancelUser,PERMISSION_KEYS.CLOSE_POSITIONS)} />
        </div>

        <div className="px-4 py-3 bg-[color:var(--bg-app)] flex justify-end gap-2 border-t border-white/5 select-none shrink-0">
          <button
            type="button"
            onClick={() => setFundingOpen(true)}
            disabled={isSaving || !login}
            title="Create a deposit or withdrawal request (posted to the ledger when approved)"
            className="mr-auto px-3 h-[24px] flex items-center gap-1.5 bg-transparent border border-[color:var(--border-strong)] rounded text-[12px] text-white hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <Wallet size={12} /> Funding...
          </button>
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
      {fundingOpen && (
        <FundingPopup login={login} currency={config.currency || form.currency} onClose={() => setFundingOpen(false)} />
      )}
    </div>
  );
};

export default AccountEditPopup;
