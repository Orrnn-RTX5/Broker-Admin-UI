import React, { useEffect, useId, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertCircle, ChevronDown, LoaderCircle, ShieldCheck, X } from 'lucide-react';
import './CreateGroupPopup.css';
import { subgroupCreatePayload } from '../../utils/groupAuthority.js';
import { ManagerService } from '../../services/manager.service';
import { buildGroupRiskPayload, parseCsvList } from '../../utils/adminValidation';
import { getApiErrorMessage } from '../../utils/apiShapes';
import { validateGroupForm, validateGroupSection } from '../../utils/groupFormSteps';
import GroupSymbolPicker from './GroupSymbolPicker';
import GroupSymbolCategories from './GroupSymbolCategories';
import { useLpSymbols } from '../../hooks/useLpSymbols';
import { buildGroupSymbolCategories } from '../../utils/groupSymbolCategories';

const GroupField = ({ label, children, hint, className = '' }) => {
  const labelId = useId();
  const hintId = useId();
  const associateControl = child => {
    if (!React.isValidElement(child)) return child;
    if (child.type === 'input' || child.type === 'select') return React.cloneElement(child, {
      'aria-labelledby': labelId,
      'aria-describedby': [child.props['aria-describedby'], hint ? hintId : null].filter(Boolean).join(' ') || undefined,
    });
    return child.props.children ? React.cloneElement(child, {}, React.Children.map(child.props.children, associateControl)) : child;
  };
  return <label className={`group-create-field ${className}`}><span id={labelId}>{label}</span>{React.Children.map(children, associateControl)}{hint && <small id={hintId}>{hint}</small>}</label>;
};
const AccountPermission = ({ name, label, hint, checked, onChange, disabled }) => (
  <label className="group-create-permission">
    <span className="group-create-permission-copy">{label}<small>{hint}</small></span>
    <input type="checkbox" name={name} checked={checked} onChange={onChange} disabled={disabled} />
    <span className="group-create-switch" aria-hidden="true" />
  </label>
);
const FORM_SECTIONS = [
  ['details', 'General', 'Group & account'],
  ['trading', 'Trading', 'Execution & fees'],
  ['risk', 'Risk & access', 'Margin & permissions'],
  ['symbols', 'Symbols', 'Allowed instruments'],
];

const CreateGroupPopup = ({ onClose, onCreated, initialData, draftData }) => {
  const errorId = useId();
  const sectionId = useId();
  const dialogRef = useRef(null);
  const symbolSource = useLpSymbols();
  const [activeSection, setActiveSection] = useState('details');
  const [furthestStep, setFurthestStep] = useState(0);
  const [formData, setFormData] = useState(() => {
    if (initialData) {
      return {
        ...initialData,
        symbolsAllowed: Array.isArray(initialData.symbolsAllowed) ? initialData.symbolsAllowed.join(', ') : (initialData.symbolsAllowed || ''),
        symbolsBlocked: Array.isArray(initialData.symbolsBlocked) ? initialData.symbolsBlocked.join(', ') : (initialData.symbolsBlocked || ''),
      };
    }
    return {
      name: '',
      groupPurpose: 'customer',
      description: '',
      accountType: 'standard',
      bookType: 'b',
      commissionRate: 0,
      commissionType: 'per_lot',
      currency: 'USD',
      demo: false,
      executionMode: 'market',
      leverage: 100,
      lotDivisor: 1,
      marginCallLevel: 100,
      maxLotPerTrade: 100,
      maxTotalLots: 500,
      negativeBalanceProtection: true,
      spreadMarkup: 0,
      stopOutLevel: 50,
      swapMultiplier: 1,
      symbolsAllowed: '',
      symbolsBlocked: '',
      tradeAllowed: true,
      ...(draftData || {})
    };
  });
  
  const [parentGroup, setParentGroup] = useState(draftData?.parentGroup || initialData?.parentGroup || '');
  const [parentLoading, setParentLoading] = useState(false);
  const changedFields = useRef(new Set());
  useEffect(() => {
    if (initialData || !parentGroup.trim()) return;
    let disposed = false; setParentLoading(true);
    ManagerService.getGroup(parentGroup.trim()).then(fresh => { if (!disposed) setFormData(current => ({ ...current, ...Object.fromEntries(Object.entries(fresh).filter(([key]) => key !== 'name' && key !== 'parentGroup' && key !== 'overriddenFields' && !changedFields.current.has(key))), ...(changedFields.current.has('symbolsAllowed') ? {} : { symbolsAllowed: Array.isArray(fresh.symbolsAllowed) ? fresh.symbolsAllowed.join(', ') : fresh.symbolsAllowed || '' }), ...(changedFields.current.has('symbolsBlocked') ? {} : { symbolsBlocked: Array.isArray(fresh.symbolsBlocked) ? fresh.symbolsBlocked.join(', ') : fresh.symbolsBlocked || '' }) })); }).catch(e => { if (!disposed) setError(e.message); }).finally(() => { if (!disposed) setParentLoading(false); });
    return () => { disposed = true; };
  }, [parentGroup, initialData]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorField, setErrorField] = useState(null);
  const activeStep = FORM_SECTIONS.findIndex(([key]) => key === activeSection);
  const isLastStep = activeStep === FORM_SECTIONS.length - 1;
  const allowedSymbols = parseCsvList(formData.symbolsAllowed);
  const symbolCategories = new Map(buildGroupSymbolCategories(symbolSource.symbols).flatMap(category => category.symbols.map(entry => [entry.symbol.toUpperCase(), category.label])));
  const accountTypeLabel = { standard: 'Standard', cent: 'Cent', micro: 'Micro', pro: 'Pro' }[formData.accountType] || formData.accountType || '—';

  const focusSection = (section, field) => window.requestAnimationFrame(() => {
    const pane = dialogRef.current?.querySelector(`[data-section="${section}"]`);
    const control = pane?.querySelector(field ? `[name="${field}"]` : '.group-create-category-trigger:not(:disabled), input:not(:disabled), select:not(:disabled)');
    control?.focus({ preventScroll: true });
    control?.scrollIntoView({ block: 'nearest' });
  });
  const showValidation = (validation) => {
    setActiveSection(validation.section);
    setError(validation.message);
    setErrorField(validation.field);
    focusSection(validation.section, validation.field);
  };
  const selectSection = (section) => {
    if (isLoading) return;
    setActiveSection(section);
    setError(null);
    setErrorField(null);
    window.requestAnimationFrame(() => { dialogRef.current?.querySelector('.group-create-body')?.scrollTo({ top: 0 }); });
  };
  const handleNext = () => {
    const validation = validateGroupSection(formData, activeSection);
    if (validation) { showValidation(validation); return; }
    const next = activeStep + 1;
    setFurthestStep(step => Math.max(step, next));
    selectSection(FORM_SECTIONS[next][0]);
    focusSection(FORM_SECTIONS[next][0]);
  };

  const handleSubmit = async () => {
    if (isLoading || parentLoading || !isLastStep || furthestStep < FORM_SECTIONS.length - 1) return;
    const validation = validateGroupForm(formData);
    if (validation) { showValidation(validation); return; }

    setIsLoading(true);
    setError(null);
    try {
      const validated = buildGroupRiskPayload({ ...formData, name: formData.name.trim(), currency: formData.currency.trim() });
      const payload = initialData ? validated : subgroupCreatePayload(validated, parentGroup.trim(), [...changedFields.current]);

      if (initialData) {
        await ManagerService.updateGroup(payload);
      } else {
        await ManagerService.createGroup(payload);
      }
      if (onCreated) onCreated();
      onClose();
    } catch (err) {
      // Axios puts the backend's reason in response.data; err.message is only "Request failed with status code 400".
      const message = getApiErrorMessage(err, 'Error creating group');
      if (/commission|leverage|spread markup/i.test(message)) setActiveSection('trading');
      else if (/margin call|stop out/i.test(message)) setActiveSection('risk');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    changedFields.current.add(name);
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError(null);
    setErrorField(null);
  };

  const removeSymbol = index => {
    changedFields.current.add('symbolsAllowed');
    setFormData(prev => ({ ...prev, symbolsAllowed: parseCsvList(prev.symbolsAllowed).filter((_, itemIndex) => itemIndex !== index).join(', ') }));
    window.requestAnimationFrame(() => {
      const buttons = dialogRef.current?.querySelectorAll('.group-create-selected-symbols button');
      const target = buttons?.[Math.min(index, buttons.length - 1)] || dialogRef.current?.querySelector('.group-create-category-trigger');
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'nearest' });
    });
  };

  const input = (name, type = 'text', extra = {}) => <input type={type} name={name} value={formData[name] ?? ''} onChange={handleChange} aria-invalid={errorField === name || undefined} aria-describedby={errorField === name ? errorId : undefined} disabled={isLoading || (name === 'name' && !!initialData)} {...extra} />;
  const select = (name, options) => <span className="group-create-select"><select name={name} value={formData[name]} onChange={handleChange} disabled={isLoading}>{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></span>;
  const numericInput = (name, extra = {}, prefix, suffix) => <span className="group-create-input-wrap">{prefix && <span className="group-create-input-prefix" aria-hidden="true">{prefix}</span>}{input(name, 'number', extra)}{suffix && <span className="group-create-input-suffix" aria-hidden="true">{suffix}</span>}</span>;
  return (
    <Dialog.Root open onOpenChange={open => { if (!open && !isLoading) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="group-create-overlay" />
        <Dialog.Content ref={dialogRef} className="group-create-dialog" onOpenAutoFocus={event => { event.preventDefault(); dialogRef.current?.querySelector(initialData ? '[name="description"]' : '[name="name"]')?.focus(); }} onEscapeKeyDown={event => { if (isLoading || dialogRef.current?.querySelector('[data-group-picker-open="true"]')) event.preventDefault(); }} onInteractOutside={event => event.preventDefault()}>
          <header className="group-create-heading">
            <div className="group-create-heading-copy"><Dialog.Title>{initialData ? 'Edit group' : 'Create group'}</Dialog.Title><Dialog.Description>Configure trading conditions and access for a group of accounts.</Dialog.Description></div>
            <Dialog.Close className="group-create-close" aria-label="Close group form" disabled={isLoading}><X size={20} /></Dialog.Close>
          </header>
          <form className="group-create-form" noValidate onSubmit={event => { event.preventDefault(); if (!isLoading) { if (isLastStep) handleSubmit(); else handleNext(); } }} aria-describedby={error ? errorId : undefined}>
            <div className="group-create-layout">
            <nav className="group-create-section-tabs" aria-label="Group form sections" role="tablist">
              {FORM_SECTIONS.map(([key, label, description], index) => <button key={key} id={`${sectionId}-${key}`} type="button" role="tab" aria-selected={activeSection === key} aria-controls={`${sectionId}-panel`} disabled={isLoading || index > furthestStep} tabIndex={activeSection === key ? 0 : -1} onClick={() => selectSection(key)} onKeyDown={event => {
                let next;
                if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % (furthestStep + 1);
                if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index + furthestStep) % (furthestStep + 1);
                if (event.key === 'Home') next = 0;
                if (event.key === 'End') next = furthestStep;
                if (next !== undefined) { event.preventDefault(); selectSection(FORM_SECTIONS[next][0]); event.currentTarget.parentElement.children[next]?.focus(); }
              }}><span className="group-create-step-copy"><span>{label}</span><small>{description}</small></span></button>)}
            </nav>
            <div className="group-create-body">
            <div className="group-create-panel" id={`${sectionId}-panel`} role="tabpanel" aria-labelledby={`${sectionId}-${activeSection}`}>
              <div className="group-create-main">
              <section className="group-create-section" data-section="details" data-active={activeSection === 'details'} aria-labelledby="group-details-title">
                <header><h2 id="group-details-title">General settings</h2><p>Define the group identity and base account currency.</p></header>
                <div className="group-create-grid">
                  {!initialData && <>
                    <GroupField label="Parent group" hint="Parent settings stay current until overridden."><input aria-label="New group parent" value={parentGroup} disabled={isLoading} onChange={event => { setParentGroup(event.target.value); setParentLoading(Boolean(event.target.value.trim())); }} placeholder="No parent" /></GroupField>
                    <GroupField label="Purpose for new accounts">{select('groupPurpose', [['customer', 'Customer'], ['coverage', 'Coverage']])}</GroupField>
                  </>}
                  <GroupField label="Group name *" hint="Use a clear name, such as Broker/real-standard." className="group-create-field-wide">{input('name', 'text', { required: true, autoComplete: 'off', placeholder: 'Broker/real-standard' })}</GroupField>
                  <GroupField label="Description (optional)" className="group-create-field-wide">{input('description', 'text', { placeholder: 'Add a short description' })}</GroupField>
                  <GroupField label="Currency *">{input('currency', 'text', { required: true, placeholder: 'USD', className: 'group-create-mono' })}</GroupField>
                  <GroupField label="Account type">{select('accountType', [['standard', 'Standard'], ['cent', 'Cent'], ['micro', 'Micro'], ['pro', 'Pro']])}</GroupField>
                </div>
              </section>
                <section className="group-create-section" data-section="trading" data-active={activeSection === 'trading'} aria-labelledby="group-trading-title">
                  <header><h2 id="group-trading-title">Execution & pricing</h2><p>Set order execution, leverage, and transaction costs.</p></header>
                  <div className="group-create-grid">
                    <GroupField label="Book type">{select('bookType', [['b', 'B-Book'], ['a', 'A-Book']])}</GroupField>
                    <GroupField label="Execution">{select('executionMode', [['market', 'Market'], ['instant', 'Instant']])}</GroupField>
                    <GroupField label="Leverage (1:x)">{numericInput('leverage', { min: 1, step: 1 }, '1:')}</GroupField>
                    <GroupField label="Spread markup">{numericInput('spreadMarkup', { min: 0, step: 'any' })}</GroupField>
                  </div>
                  <div className="group-create-subheading">Commission</div>
                  <div className="group-create-grid">
                    <GroupField label="Commission rate">{numericInput('commissionRate', { min: 0, step: 'any' })}</GroupField>
                    <GroupField label="Commission type">{select('commissionType', [['per_lot', 'Per Lot'], ['standard', 'Standard']])}</GroupField>
                  </div>
                </section>
                <section className="group-create-section" data-section="risk" data-active={activeSection === 'risk'} aria-labelledby="group-risk-title">
                  <header><h2 id="group-risk-title">Risk & access</h2><p>Define margin thresholds and trading permissions.</p></header>
                  <div className="group-create-grid group-create-risk">
                    <GroupField label="Margin call (%)">{numericInput('marginCallLevel', { min: 0, step: 'any' }, null, '%')}</GroupField>
                    <GroupField label="Stop out (%)">{numericInput('stopOutLevel', { min: 0, step: 'any' }, null, '%')}</GroupField>
                  </div>
                  <div className="group-create-permissions">{[['demo', 'Demo accounts', 'Use this group for demo trading.'], ['tradeAllowed', 'Trading enabled', 'Allow accounts in this group to trade.'], ['negativeBalanceProtection', 'Negative balance protection', 'Protect accounts from negative balances.']].map(([name, label, hint]) => <AccountPermission key={name} name={name} label={label} hint={hint} checked={!!formData[name]} onChange={handleChange} disabled={isLoading} />)}</div>
                </section>
              </div>
              <section className="group-create-section group-create-symbols" data-section="symbols" data-active={activeSection === 'symbols'} aria-labelledby="group-symbols-title">
                <header><h2 id="group-symbols-title">Allowed instruments</h2><p>Choose the symbols available to accounts in this group.</p></header>
                <div className="group-create-symbol-fields">
                <GroupSymbolCategories value={formData.symbolsAllowed} symbolSource={symbolSource} disabled={isLoading} onChange={symbolsAllowed => { changedFields.current.add('symbolsAllowed'); setFormData(prev => ({ ...prev, symbolsAllowed })); }} />
                <GroupSymbolPicker value={formData.symbolsAllowed} symbolSource={symbolSource} disabled={isLoading} onChange={symbolsAllowed => { changedFields.current.add('symbolsAllowed'); setFormData(prev => ({ ...prev, symbolsAllowed })); }} />
                </div>
                <div className="group-create-instrument-preview"><span aria-live="polite">Added symbols ({allowedSymbols.length})</span>{allowedSymbols.length > 0 ? <div className="group-create-selected-symbols"><table aria-label="Added symbols"><thead><tr><th scope="col">Symbol or pattern</th><th scope="col">Category</th><th scope="col">Action</th></tr></thead><tbody>{allowedSymbols.map((symbol, index) => <tr key={`${symbol}-${index}`}><td>{symbol}</td><td className="group-create-selected-category">{symbolCategories.get(symbol.toUpperCase()) || 'Manual entry'}</td><td><button type="button" disabled={isLoading} aria-label={`Remove ${symbol}`} onClick={() => removeSymbol(index)}>Remove</button></td></tr>)}</tbody></table></div> : <p>Select a category above or add symbols individually.</p>}</div>
              </section>
              {error && <div className="group-create-feedback"><div id={errorId} className="group-create-error" role="alert"><AlertCircle size={15} aria-hidden="true" /><span>{error}</span></div></div>}
            </div>
            <aside className="group-create-summary" aria-label="Group overview">
              <div className="group-create-summary-heading"><h2>Group overview</h2><span className="group-create-draft">{initialData ? 'Editing' : 'Draft'}</span></div>
              <div className="group-create-summary-identity"><span className="group-create-summary-name">{String(formData.name ?? '').trim() || 'Your trading group'}</span><span className={`group-create-environment ${formData.demo ? 'is-demo' : ''}`}><span />{formData.demo ? 'Demo accounts' : 'Live accounts'}</span></div>
              <dl className="group-create-summary-values">
                <div><dt>Base currency</dt><dd className="group-create-mono">{String(formData.currency ?? '').trim() || '—'}</dd></div>
                <div><dt>Account type</dt><dd>{accountTypeLabel}</dd></div>
                <div><dt>Book type</dt><dd>{formData.bookType === 'a' ? 'A-Book' : 'B-Book'}</dd></div>
                <div><dt>Execution</dt><dd>{formData.executionMode === 'instant' ? 'Instant' : 'Market'}</dd></div>
                <div><dt>Leverage</dt><dd className="group-create-mono">{formData.leverage !== '' && formData.leverage != null ? `1:${formData.leverage}` : '—'}</dd></div>
              </dl>
              <div className="group-create-summary-risk"><div><span>Margin call</span><strong>{formData.marginCallLevel !== '' && formData.marginCallLevel != null ? `${formData.marginCallLevel}%` : '—'}</strong></div><div><span>Stop out</span><strong>{formData.stopOutLevel !== '' && formData.stopOutLevel != null ? `${formData.stopOutLevel}%` : '—'}</strong></div></div>
              <div className="group-create-summary-status"><span>Trading access</span><strong data-enabled={!!formData.tradeAllowed}>{formData.tradeAllowed ? 'Enabled' : 'Disabled'}</strong></div>
              <div className="group-create-summary-protection"><ShieldCheck size={15} aria-hidden="true" /><span>Balance protection {formData.negativeBalanceProtection ? 'on' : 'off'}</span></div>
            </aside>
            </div>
            </div>
            <footer className="group-create-footer"><div className="group-create-progress"><span>Step <strong>{activeStep + 1}</strong> of {FORM_SECTIONS.length}</span></div><div className="group-create-actions"><button type="button" className="group-create-cancel" onClick={onClose} disabled={isLoading}>Cancel</button>{activeStep > 0 && <button type="button" onClick={() => { const previous = FORM_SECTIONS[activeStep - 1][0]; selectSection(previous); focusSection(previous); }} disabled={isLoading}>Back</button>}<button type="submit" className="group-create-submit" disabled={isLoading}>{isLoading ? <><LoaderCircle size={16} className="group-create-spinner" aria-hidden="true" />Saving…</> : isLastStep ? (initialData ? 'Save changes' : 'Create group') : 'Next'}</button></div></footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default CreateGroupPopup;
