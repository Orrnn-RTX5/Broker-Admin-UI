import React, { useState } from 'react';
import { X } from 'lucide-react';
import { AdminConfigApi } from '../../services/adminConfigApi';
import { buildFundingRequest, fundingErrorsToMessage } from '../../utils/legacyConfig';
import { getApiErrorMessage } from '../../utils/apiShapes';
import { useToast } from '../ui/useToast';

// Account funding through the existing ledger request workflow (G23). It
// creates a deposit or withdrawal REQUEST (the same PaymentService calls the
// Deposits and Withdrawals views use). The balance changes only when that
// request is approved there, which posts the ledger transaction.
const inputClassName = 'min-w-0 w-full flex-1 bg-[color:var(--bg-surface-1)] border border-[color:var(--border-strong)] px-2 py-1 text-[12px] text-[color:var(--text-primary)] focus:outline-none focus:border-blue-500 rounded-sm disabled:opacity-60';

const Row = ({ label, htmlFor, children, error }) => (
  <div className="flex flex-col gap-0.5">
    <div className="flex min-w-0 items-center gap-3">
      <label htmlFor={htmlFor} className="text-[12px] w-24 shrink-0 text-right text-[color:var(--text-secondary)]">{label}</label>
      {children}
    </div>
    {error && <div className="ml-[108px] text-[10px] text-[color:var(--danger-500)]">{error}</div>}
  </div>
);

const FundingPopup = ({ login, currency = 'USD', onClose, onSubmitted }) => {
  const [kind, setKind] = useState('deposit');
  const [form, setForm] = useState({ amount: '', currency: currency || 'USD', note: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { notify } = useToast();

  const setField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    const { payload, errors: nextErrors } = buildFundingRequest(kind, login, form);
    if (!payload) {
      setErrors(nextErrors);
      setError(fundingErrorsToMessage(nextErrors));
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await AdminConfigApi.requestFunding(kind, payload);
      notify({
        title: kind === 'deposit' ? 'Deposit request created' : 'Withdrawal request created',
        description: `Login ${payload.login} · ${payload.amount} ${payload.currency} — approve it in ${kind === 'deposit' ? 'Deposits' : 'Withdrawals'} to post it to the ledger.`,
        tone: 'success',
      });
      onSubmitted?.();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, `Failed to create the ${kind} request.`));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 font-sans" onClick={onClose} data-nested-popup="true">
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Account funding"
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        noValidate
        className="w-[440px] max-w-[calc(100vw-32px)] bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-[6px] shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="flex justify-between items-center h-8 bg-[color:var(--bg-app)] px-3 border-b border-white/5 select-none">
          <div className="text-[12px] text-[color:var(--text-primary)]">Funding request · Login #{login}</div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-[28px] h-[20px] flex items-center justify-center hover:bg-red-500 hover:text-white text-[color:var(--text-muted)] rounded-tr-[4px]">
            <X size={12} />
          </button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <p className="text-[11px] text-[color:var(--text-muted)] leading-snug">
            This creates a request in the ledger workflow. The balance changes only after the request is approved in
            {' '}{kind === 'deposit' ? 'Deposits' : 'Withdrawals'}; nothing is posted from this dialog.
          </p>
          <Row label="Type:" htmlFor="funding-kind" error={errors.kind}>
            <select id="funding-kind" value={kind} onChange={(event) => setKind(event.target.value)} className={inputClassName}>
              <option value="deposit">Deposit request</option>
              <option value="withdrawal">Withdrawal request</option>
            </select>
          </Row>
          <Row label="Amount:" htmlFor="funding-amount" error={errors.amount}>
            <input id="funding-amount" type="number" min="0" step="0.01" value={form.amount} onChange={setField('amount')} className={inputClassName} autoFocus />
          </Row>
          <Row label="Currency:" htmlFor="funding-currency" error={errors.currency}>
            <input id="funding-currency" value={form.currency} onChange={setField('currency')} maxLength={3} className={`${inputClassName} uppercase`} />
          </Row>
          <Row label={kind === 'deposit' ? 'Reference:' : 'Bank details:'} htmlFor="funding-note">
            <input id="funding-note" value={form.note} onChange={setField('note')} className={inputClassName} />
          </Row>
          {error && <div role="alert" className="text-red-400 text-[11px] text-center">{error}</div>}
        </div>
        <div className="px-4 py-3 bg-[color:var(--bg-app)] flex justify-end gap-2 border-t border-white/5">
          <button type="submit" disabled={isSubmitting} className="px-6 h-[24px] bg-[color:var(--accent-500)] text-white rounded text-[12px] disabled:opacity-50">
            {isSubmitting ? 'Submitting...' : 'Create request'}
          </button>
          <button type="button" onClick={onClose} disabled={isSubmitting} className="px-6 h-[24px] bg-transparent border border-[color:var(--border-strong)] rounded text-[12px] text-white hover:bg-white/10 disabled:opacity-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default FundingPopup;
