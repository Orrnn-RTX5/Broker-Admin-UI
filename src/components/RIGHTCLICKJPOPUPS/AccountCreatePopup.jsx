import React, { useState } from 'react';
import { X } from 'lucide-react';
import { AdminConfigApi } from '../../services/adminConfigApi';
import { ACCOUNT_MODE_OPTIONS, buildAccountCreatePayload, emptyAccountCreateForm, readCreatedLogin } from '../../utils/legacyConfig';
import { getApiErrorMessage } from '../../utils/apiShapes';
import { useToast } from '../ui/useToast';
import FundingPopup from './FundingPopup';

// Customer account creation under a group (G23) through the canonical
// POST /api/v1/manager/accounts. The account starts with no balance or
// credit; it is funded through the ledger request workflow (FundingPopup).
const inputClassName = 'min-w-0 w-full flex-1 bg-[color:var(--bg-surface-1)] border border-[color:var(--border-strong)] px-2 py-1 text-[12px] text-[color:var(--text-primary)] focus:outline-none focus:border-blue-500 rounded-sm disabled:opacity-60';

const Row = ({ label, htmlFor, children, error }) => (
  <div className="flex flex-col gap-0.5">
    <div className="flex min-w-0 items-center gap-3">
      <label htmlFor={htmlFor} className="text-[12px] w-28 shrink-0 text-right text-[color:var(--text-secondary)]">{label}</label>
      {children}
    </div>
    {error && <div className="ml-[124px] text-[10px] text-[color:var(--danger-500)]">{error}</div>}
  </div>
);

const AccountCreatePopup = ({ group, defaultLeverage, onClose, onCreated }) => {
  const [form, setForm] = useState(() => emptyAccountCreateForm(group, defaultLeverage));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState(null);
  const [funding, setFunding] = useState(false);
  const { notify } = useToast();

  const setField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (isSubmitting || created) return;
    const { payload, errors: nextErrors } = buildAccountCreatePayload(form);
    if (!payload) {
      setErrors(nextErrors);
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const result = await AdminConfigApi.createCustomerAccount(payload);
      // Only a reply naming the new login confirms the creation.
      const login = readCreatedLogin(result);
      if (!login) {
        setError('The server did not confirm the new account login. Check the group\'s account list before creating it again.');
        return;
      }
      setCreated({ login, currency: payload.Currency || 'USD' });
      notify({ title: 'Account created', description: `Login ${login} in ${payload.Group}`, tone: 'success' });
      onCreated?.(result);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to create the account.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/50 font-sans">
      <form
        role="dialog"
        aria-modal="true"
        aria-label="New customer account"
        onSubmit={submit}
        noValidate
        className="w-[500px] max-w-[calc(100vw-32px)] bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-[6px] shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
      >
        <div className="flex justify-between items-center h-8 bg-[color:var(--bg-app)] px-3 border-b border-white/5 select-none shrink-0">
          <div className="text-[12px] text-[color:var(--text-primary)]">New customer account · {group}</div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-[28px] h-[20px] flex items-center justify-center hover:bg-red-500 hover:text-white text-[color:var(--text-muted)] rounded-tr-[4px]">
            <X size={12} />
          </button>
        </div>

        {created ? (
          <div className="p-5 flex flex-col gap-3 text-[12px] text-[color:var(--text-secondary)]">
            <div>Account <span className="font-mono text-[color:var(--text-primary)]">#{created.login}</span> was created in <span className="text-[color:var(--text-primary)]">{group}</span> with a zero balance.</div>
            <div className="text-[11px] text-[color:var(--text-muted)]">To fund it, create a deposit request; it is posted to the ledger when approved in Deposits.</div>
          </div>
        ) : (
          <div className="p-4 flex flex-col gap-3 overflow-y-auto no-scrollbar">
            <Row label="Group:" htmlFor="create-group" error={errors.group}>
              <input id="create-group" value={form.group} disabled className={inputClassName} />
            </Row>
            <Row label="First name:" htmlFor="create-first" error={errors.firstName}>
              <input id="create-first" value={form.firstName} onChange={setField('firstName')} className={inputClassName} autoFocus />
            </Row>
            <Row label="Last name:" htmlFor="create-last" error={errors.lastName}>
              <input id="create-last" value={form.lastName} onChange={setField('lastName')} className={inputClassName} />
            </Row>
            <Row label="Email:" htmlFor="create-email" error={errors.email}>
              <input id="create-email" type="email" value={form.email} onChange={setField('email')} className={inputClassName} />
            </Row>
            <Row label="Phone:" htmlFor="create-phone">
              <input id="create-phone" value={form.phone} onChange={setField('phone')} className={inputClassName} />
            </Row>
            <Row label="Currency:" htmlFor="create-currency" error={errors.currency}>
              <input id="create-currency" value={form.currency} onChange={setField('currency')} maxLength={3} className={`${inputClassName} uppercase`} />
            </Row>
            <Row label="Leverage 1:" htmlFor="create-leverage" error={errors.leverage}>
              <input id="create-leverage" type="number" min="1" max="10000" step="1" value={form.leverage} onChange={setField('leverage')} className={inputClassName} />
            </Row>
            <Row label="Account mode:" htmlFor="create-mode" error={errors.accountMode}>
              <select id="create-mode" value={form.accountMode} onChange={setField('accountMode')} className={inputClassName}>
                {ACCOUNT_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Row>
            <Row label="Master password:" htmlFor="create-master" error={errors.masterPassword}>
              <input id="create-master" type="password" autoComplete="new-password" value={form.masterPassword} onChange={setField('masterPassword')} className={inputClassName} />
            </Row>
            <Row label="Investor password:" htmlFor="create-investor" error={errors.investorPassword}>
              <input id="create-investor" type="password" autoComplete="new-password" value={form.investorPassword} onChange={setField('investorPassword')} placeholder="optional" className={inputClassName} />
            </Row>
            {error && <div role="alert" className="text-red-400 text-[11px] text-center">{error}</div>}
          </div>
        )}

        <div className="px-4 py-3 bg-[color:var(--bg-app)] flex justify-end gap-2 border-t border-white/5 shrink-0">
          {created ? (
            <>
              <button type="button" onClick={() => setFunding(true)} disabled={!created.login} className="px-4 h-[24px] bg-[color:var(--accent-500)] text-white rounded text-[12px] disabled:opacity-50">Request deposit...</button>
              <button type="button" onClick={onClose} className="px-6 h-[24px] bg-transparent border border-[color:var(--border-strong)] rounded text-[12px] text-white hover:bg-white/10">Close</button>
            </>
          ) : (
            <>
              <button type="submit" disabled={isSubmitting} className="px-6 h-[24px] bg-[color:var(--accent-500)] text-white rounded text-[12px] disabled:opacity-50">
                {isSubmitting ? 'Creating...' : 'Create'}
              </button>
              <button type="button" onClick={onClose} disabled={isSubmitting} className="px-6 h-[24px] bg-transparent border border-[color:var(--border-strong)] rounded text-[12px] text-white hover:bg-white/10 disabled:opacity-50">Cancel</button>
            </>
          )}
        </div>
      </form>
      {funding && created && (
        <FundingPopup login={created.login} currency={created.currency} onClose={() => setFunding(false)} />
      )}
    </div>
  );
};

export default AccountCreatePopup;
