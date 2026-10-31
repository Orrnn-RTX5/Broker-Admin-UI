import {useEffect, useRef, useState} from 'react';
import {InstrumentsService} from '../../../services/instruments.service';
import {getApiErrorMessage} from '../../../utils/apiShapes';
import {calcModes, cryptoSessions, dayNames, instrumentCategories} from '../../../utils/instrumentForm';
import {OVERRIDE_FIELDS, buildBulkConfigureRequest, bulkTemplateForm, chunkSymbols, mergeBulkResponses, replaceBulkResults, summarizeBulkResults, symbolsToCreate, timedOutSymbols, weekdaySessions} from './bulkConfigure';

const STATUS_LABELS = {
  would_create: 'Ready',
  created: 'Created',
  enabled: 'Enabled',
  exists_unchanged: 'Already configured',
  refused: 'Refused',
};
const STATUS_TONES = {would_create: 'enabled', created: 'enabled', enabled: 'enabled', exists_unchanged: 'pending', refused: 'disabled'};
const APPROVAL_LABELS = {approved: 'Approved', refused: 'Refused', not_requested: 'Not requested'};
const OVERRIDE_LABELS = {digits: 'Digits', tick_size: 'Tick size', margin_currency: 'Margin ccy', profit_currency: 'Profit ccy', calc_mode: 'Calc mode', contract_size: 'Contract size'};

const describe = summary => {
  const parts = Object.entries(summary.byStatus).filter(([, count]) => count > 0).map(([status, count]) => `${count} ${STATUS_LABELS[status].toLowerCase()}`);
  return parts.length ? parts.join(' · ') : 'No results';
};

// Bulk "Configure selected": one shared template, optional per-symbol values,
// a dry run first, then the real run for the symbols the dry run accepted.
export default function BulkConfigureModal({symbols, instruments = [], categories = [], onClose, onDone}) {
  const [form, setForm] = useState(() => bulkTemplateForm('', instruments));
  const [perSymbol, setPerSymbol] = useState({});
  const [check, setCheck] = useState(null); // dry-run response for the CURRENT inputs
  const [result, setResult] = useState(null); // real-run response
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(''); // '' | 'check' | 'configure'
  const [progress, setProgress] = useState(null); // {done, total} while batches run
  const [error, setError] = useState('');
  const toCreate = check ? symbolsToCreate(check) : [];
  const dialogRef = useRef(null);
  useEffect(() => { dialogRef.current?.focus(); }, []);

  useEffect(() => {
    const onKey = event => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  // Any edit invalidates the dry run: the real run must match what was checked.
  const touched = () => { setCheck(null); setReviewed(false); setError(''); };
  const set = (key, value) => { setForm(previous => ({...previous, [key]: value})); touched(); };
  const setOverride = (symbol, key, value) => {
    setPerSymbol(previous => ({...previous, [symbol]: {...previous[symbol], [key]: value}}));
    touched();
  };
  // Choosing a category never resets the other fields; starter values are a separate, explicit action.
  const applyStarterValues = () => { setForm(bulkTemplateForm(form.category, instruments)); touched(); };
  const categoryOptions = [...new Set([...instrumentCategories, ...categories.map(row => (typeof row === 'string' ? row : row?.name)).filter(Boolean)])];
  const timedOut = result ? timedOutSymbols(result) : [];
  const setSession = (index, key, value) => set('sessions', form.sessions.map((session, i) => (i === index ? {...session, [key]: value} : session)));

  // Sent in batches (each symbol has its own server time limit). Validation runs
  // once on the whole list first, so a template error never sends a batch.
  const send = async (dryRun, retryList = null) => {
    setError('');
    const list = retryList || (dryRun ? symbols : toCreate);
    try {
      buildBulkConfigureRequest({symbols: list, form, perSymbol, dryRun});
    } catch (err) {
      setError(err.message);
      return;
    }
    setBusy(dryRun ? 'check' : 'configure');
    if (dryRun) setReviewed(false); // a new check needs a new confirmation
    const responses = [];
    setProgress({done: 0, total: list.length});
    try {
      for (const batch of chunkSymbols(list)) {
        responses.push(await InstrumentsService.bulkConfigureInstruments(buildBulkConfigureRequest({symbols: batch, form, perSymbol, dryRun})));
        setProgress(previous => ({...previous, done: previous.done + batch.length}));
      }
      if (dryRun) setCheck(mergeBulkResponses(responses));
      else if (retryList) setResult(previous => replaceBulkResults(previous, mergeBulkResponses(responses)));
      else setResult(mergeBulkResponses(responses));
    } catch (err) {
      const done = responses.reduce((sum, response) => sum + (Array.isArray(response?.results) ? response.results.length : 0), 0);
      if (dryRun) {
        setError(getApiErrorMessage(err, 'The check could not be completed.'));
      } else {
        // Earlier batches may have created symbols: show what was done, and the
        // old check is no longer true, so it must be run again before a retry.
        if (responses.length) setResult(previous => (retryList && previous ? replaceBulkResults(previous, mergeBulkResponses(responses)) : mergeBulkResponses(responses)));
        setCheck(null);
        setReviewed(false);
        setError(`${getApiErrorMessage(err, 'The symbols could not be configured.')} ${done} of ${list.length} symbols were processed before the failure; the rest were not sent. Check again before retrying.`);
      }
    } finally {
      setBusy('');
      setProgress(null);
    }
  };

  const input = (key, label, props = {}) => (
    <label key={key} className="flex flex-col gap-1 text-xs">{label}
      <input name={key} className="ui-input ui-input-sm" value={form[key]} disabled={Boolean(busy) || Boolean(result)} onChange={event => set(key, event.target.value)} {...props} />
    </label>
  );

  const resultTable = (response, showApproval) => {
    const summary = summarizeBulkResults(response);
    return (
      <div className="flex flex-col gap-2">
        <p role="status" className="text-xs">{describe(summary)}{showApproval && ` · approvals: ${summary.byApproval.approved} approved, ${summary.byApproval.refused} refused`}</p>
        <div className="overflow-auto" style={{maxHeight: 260}}>
          <table className="ui-grid symbols-management-table" aria-label={showApproval ? 'Configuration results' : 'Check results'}>
            <thead><tr><th>Symbol</th><th>Result</th><th>Digits</th><th>Tick size</th><th>Tick value</th><th>Margin / profit</th>{showApproval && <th>Approval</th>}<th>Message</th></tr></thead>
            <tbody>
              {summary.rows.map(row => (
                <tr key={row.symbol}>
                  <td className="symbols-management-code">{row.symbol}</td>
                  <td><span className="symbols-management-status" data-tone={STATUS_TONES[row.status] || 'pending'}>{STATUS_LABELS[row.status] || row.status}</span></td>
                  <td>{row.instrument?.digits ?? '—'}</td>
                  <td>{row.instrument?.tick_size ?? '—'}</td>
                  <td>{row.instrument?.tick_value ?? '—'}</td>
                  <td>{row.instrument ? `${row.instrument.margin_currency || '—'} / ${row.instrument.profit_currency || '—'}` : '—'}</td>
                  {showApproval && <td title={row.approval?.message || ''}>{APPROVAL_LABELS[row.approval?.status] || '—'}{row.approval?.status === 'refused' && row.approval?.message ? `: ${row.approval.message}` : ''}</td>}
                  <td>{[row.message, row.code && `(${row.code})`].filter(Boolean).join(' ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background: 'rgba(0,0,0,0.6)'}}>
    <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Configure selected symbols" className="ui-card w-full max-w-5xl p-6 overflow-auto" style={{background: 'var(--surface)', maxHeight: '92vh'}}>
      <h2 className="text-base font-semibold mb-1">Configure {symbols.length} selected {symbols.length === 1 ? 'symbol' : 'symbols'}</h2>
      <p className="text-xs mb-3">Creates each symbol from one shared template, enables it and runs its calculation approval. Existing instruments are not changed.</p>

      {!result && <>
        <fieldset className="flex flex-col gap-3" disabled={Boolean(busy)}>
          <legend className="text-sm font-semibold">Shared template</legend>
          <div className="flex items-end gap-2 flex-wrap">
            <label className="flex flex-col gap-1 text-xs" style={{minWidth: 220}}>Category (required)
              <select name="category" className="ui-input ui-input-sm" required value={form.category} onChange={event => set('category', event.target.value)}>
                <option value="">Select category</option>
                {categoryOptions.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" disabled={!form.category} onClick={applyStarterValues}
              title="Replaces the template values below with editable starter values for this category">Use {form.category || 'category'} starter values</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="flex flex-col gap-1 text-xs">Calculation mode
              <select name="calc_mode" className="ui-input ui-input-sm" required value={form.calc_mode} onChange={event => set('calc_mode', event.target.value)}>
                <option value="">Select mode</option>
                {calcModes.map(mode => <option key={mode} value={mode}>{mode}</option>)}
              </select>
            </label>
            {input('contract_size', 'Contract size', {inputMode: 'decimal'})}
            {input('volume_step', 'Volume step', {inputMode: 'decimal'})}
            {input('min_volume', 'Minimum volume', {inputMode: 'decimal'})}
            {input('max_volume', 'Maximum volume', {inputMode: 'decimal'})}
            {input('timezone', 'Session timezone')}
            {input('margin_rate', 'Margin rate', {inputMode: 'decimal', required: true})}
            {input('swap_long', 'Swap long', {inputMode: 'decimal', required: true, placeholder: 'e.g. -1.25'})}
            {input('swap_short', 'Swap short', {inputMode: 'decimal', required: true, placeholder: 'e.g. 0.4'})}
            <label className="flex flex-col gap-1 text-xs">Triple-swap day
              <select name="swap_rollover_3days" className="ui-input ui-input-sm" required value={form.swap_rollover_3days} onChange={event => set('swap_rollover_3days', event.target.value)}>
                <option value="">Select day</option>
                {dayNames.map((name, day) => <option key={name} value={String(day)}>{name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">Trade mode<input className="ui-input ui-input-sm" value="Full" disabled readOnly /></label>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold">Quote and trading sessions ({form.timezone || 'timezone'})</p>
            <div className="flex gap-2 flex-wrap">
              <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => set('sessions', weekdaySessions())}>Mon–Fri 00:00–24:00</button>
              <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => set('sessions', cryptoSessions())}>7 days 00:00–24:00</button>
            </div>
            {form.sessions.map((session, index) => <div key={index} className="flex gap-2 items-end flex-wrap">
              <label className="text-xs">Day<select aria-label={`Session ${index + 1} day`} className="ui-input ui-input-sm" value={session.day_of_week} onChange={event => setSession(index, 'day_of_week', Number(event.target.value))}>
                {dayNames.map((name, day) => <option key={name} value={day}>{name}</option>)}
              </select></label>
              {['quote_from', 'quote_to', 'trade_from', 'trade_to'].map(key => <label key={key} className="text-xs">{key.replace('_', ' ')}<input aria-label={`Session ${index + 1} ${key.replace('_', ' ')}`} className="ui-input ui-input-sm" style={{width: 80}} value={session[key]} placeholder="HH:MM" onChange={event => setSession(index, key, event.target.value)} /></label>)}
              <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => set('sessions', form.sessions.filter((_, i) => i !== index))}>Remove</button>
            </div>)}
            <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm self-start" onClick={() => set('sessions', [...form.sessions, {day_of_week: 1, quote_from: '', quote_to: '', trade_from: '', trade_to: ''}])}>Add session</button>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2 mt-3" disabled={Boolean(busy)}>
          <legend className="text-sm font-semibold">Per-symbol values (optional)</legend>
          <p className="text-xs">Leave blank to use the template or let the server derive it: forex margin/profit currencies come from the 6-letter name, tick value from tick size × contract size, digits and tick size from the feed when it supplies them. Symbols that need values the server cannot derive (for example index currencies) are refused in the check.</p>
          <div className="overflow-auto" style={{maxHeight: 220}}>
            <table className="ui-grid symbols-management-table" aria-label="Per-symbol values">
              <thead><tr><th>Symbol</th>{OVERRIDE_FIELDS.map(key => <th key={key}>{OVERRIDE_LABELS[key]}</th>)}</tr></thead>
              <tbody>
                {symbols.map(symbol => <tr key={symbol}>
                  <td className="symbols-management-code">{symbol}</td>
                  {OVERRIDE_FIELDS.map(key => <td key={key}>
                    {key === 'calc_mode'
                      ? <select aria-label={`${symbol} ${OVERRIDE_LABELS[key]}`} className="ui-input ui-input-sm" value={perSymbol[symbol]?.[key] || ''} onChange={event => setOverride(symbol, key, event.target.value)}>
                          <option value="">Template</option>
                          {calcModes.map(mode => <option key={mode} value={mode}>{mode}</option>)}
                        </select>
                      : <input aria-label={`${symbol} ${OVERRIDE_LABELS[key]}`} className="ui-input ui-input-sm" style={{width: key.endsWith('currency') ? 64 : 90}} value={perSymbol[symbol]?.[key] || ''} onChange={event => setOverride(symbol, key, event.target.value)} />}
                  </td>)}
                </tr>)}
              </tbody>
            </table>
          </div>
        </fieldset>

        {check && <div className="mt-3 flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Check result (nothing saved yet)</h3>
          {resultTable(check, false)}
          {toCreate.length > 0 && <label className="text-xs"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} /> I reviewed the specifications and the schedule for these {toCreate.length} symbols.</label>}
          {toCreate.length === 0 && <p className="text-xs">No symbol passed the check. Fix the refused values above and check again.</p>}
        </div>}
      </>}

      {result && check === null && error && <div className="mt-1">
        <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" disabled={Boolean(busy)} onClick={() => { setResult(null); setError(''); }}>Back to the template to check again</button>
      </div>}
      {result && <div className="mt-1 flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Configuration result</h3>
        {resultTable(result, true)}
        <p className="text-xs">A symbol whose approval was refused is created but not tradable until the approval passes; open it in Symbol Management to see why.</p>
        {timedOut.length > 0 && <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs" role="status">{timedOut.length} {timedOut.length === 1 ? 'symbol was' : 'symbols were'} not reached within the server time limit; nothing was written for {timedOut.length === 1 ? 'it' : 'them'}.</p>
          <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" disabled={Boolean(busy)} onClick={() => send(false, timedOut)}>Retry the {timedOut.length} not reached</button>
        </div>}
      </div>}

      {error && <p role="alert" className="text-xs mt-2" style={{color: 'var(--danger)'}}>{error}</p>}
      {busy && <p role="status" className="text-xs mt-2">{busy === 'configure' ? 'Configuring' : 'Checking'}{progress ? ` ${progress.done} of ${progress.total} symbols…` : '…'}</p>}

      <div className="flex justify-end gap-2 mt-4">
        {result
          ? <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={onDone}>Done</button>
          : <>
              <button type="button" disabled={busy} onClick={onClose} className="ui-btn ui-btn-secondary ui-btn-sm">Cancel</button>
              <button type="button" disabled={busy} onClick={() => send(true)} className="ui-btn ui-btn-secondary ui-btn-sm">{check ? 'Check again' : 'Check (dry run)'}</button>
              <button type="button" disabled={busy || !check || !toCreate.length || !reviewed} onClick={() => send(false)} className="ui-btn ui-btn-primary ui-btn-sm">Configure {toCreate.length || ''} {toCreate.length === 1 ? 'symbol' : 'symbols'}</button>
            </>}
      </div>
    </section>
  </div>;
}
