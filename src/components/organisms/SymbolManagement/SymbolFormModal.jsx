import {useEffect, useRef, useState} from 'react';
import {InstrumentsService} from '../../../services/instruments.service';
import {getApiErrorMessage} from '../../../utils/apiShapes';
import {instrumentForm, instrumentPayload, numericInstrumentFields, calcModes, cryptoSessions, dayNames, instrumentCategories, defaultCategory, categoryTemplate, applyCategoryTemplate} from '../../../utils/instrumentForm';

// `initialSymbol` preselects a feed symbol in the Add form ("Configure" on an
// unconfigured LP symbol) once the catalogue has loaded.
export default function SymbolFormModal({symbol: existing, categories, instruments = [], initialSymbol = '', onClose, onSuccess}) {
  const [form, setForm] = useState(() => instrumentForm(existing));
  const [catalogue, setCatalogue] = useState([]);
  const [symbolSearch, setSymbolSearch] = useState('');
  const searchText = symbolSearch.trim().toLowerCase();
  const matchingSymbols = catalogue.filter(row => !searchText || `${row.symbol} ${row.description || ''}`.toLowerCase().includes(searchText));
  const selectedOutsideSearch = form.symbol && !matchingSymbols.some(row => row.symbol === form.symbol);
  const [loading, setLoading] = useState(!existing);
  const [catalogueError, setCatalogueError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [customCategory, setCustomCategory] = useState(false);
  const [templateSource, setTemplateSource] = useState('');
  const template = categoryTemplate(form.category, instruments, form.symbol);
  const categoryOptions = [...new Set([...instrumentCategories, ...categories.map(row => row.name), ...(!customCategory && form.category ? [form.category] : [])])];
  const isCrypto = /crypto/i.test(form.category);
  const modeLabels = {
    forex: 'Forex',
    cfd_leverage: isCrypto ? 'Crypto CFD (with leverage)' : 'CFD (with leverage)',
    cfd_no_leverage: isCrypto ? 'Crypto CFD (without leverage)' : 'CFD (without leverage)',
    futures: 'Futures',
  };
  useEffect(() => {
    if (existing) return;
    let active = true;
    InstrumentsService.getInstrumentCatalogue().then(rows => {
      if (active) {setCatalogue(rows.map(row => typeof row === 'string' ? {symbol: row} : {...row, ...row.specifications, symbol: row.symbol})); setCatalogueError('');}
    }).catch(err => {if (active) setCatalogueError(getApiErrorMessage(err, 'Feed catalogue unavailable.'));})
      .finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, [existing, attempt]);
  const set = (key, value) => {
    setForm(previous => ({...previous, [key]: value}));
    setReviewed(false);
  };
  const applyDefaults = (category, base = form, source = catalogue.find(row => row.symbol === base.symbol) || {}) => {
    const selected = categoryTemplate(category, instruments, base.symbol);
    setForm(applyCategoryTemplate(base, category, selected, source));
    setTemplateSource(selected?.label || '');
    setReviewed(false);
  };
  const selectSymbol = value => {
    setCustomCategory(false);
    setTemplateSource('');
    const source = catalogue.find(row => row.symbol === value);
    const next = instrumentForm(source || {symbol: value});
    applyDefaults(defaultCategory(next, instruments), next, source || {});
  };
  const initialApplied = useRef(false);
  useEffect(() => {
    if (existing || !initialSymbol || initialApplied.current || catalogue.length === 0) return;
    initialApplied.current = true;
    const wanted = String(initialSymbol).trim().toUpperCase();
    const match = catalogue.find(row => String(row.symbol || '').trim().toUpperCase() === wanted);
    selectSymbol(match ? match.symbol : wanted);
    // selectSymbol reads the loaded catalogue; run once when it arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogue, existing, initialSymbol]);
  const setSession = (index, key, value) => set('sessions', form.sessions.map((session, i) => i === index ? {...session, [key]: value} : session));
  const submit = async event => {
    event.preventDefault(); setError('');
    try {
      if (!existing && !catalogue.some(row => row.symbol === form.symbol)) throw new Error('Select a symbol from the permitted feed catalogue.');
      if (!reviewed) throw new Error('Review the specifications and schedule before saving.');
      const payload = instrumentPayload(form);
      setSaving(true);
      if (existing) await InstrumentsService.updateInstrument(form.symbol, payload);
      else await InstrumentsService.createInstrument(payload);
      onSuccess(payload);
    } catch (err) {setError(getApiErrorMessage(err, 'Symbol could not be saved.'));}
    finally {setSaving(false);}
  };
  const input = (key, label, type = 'text') => <label key={key} className="flex flex-col gap-1 text-xs">{label}
    <input name={key} className="ui-input ui-input-sm" type={type} step={type === 'number' ? 'any' : undefined} value={form[key]} required={key !== 'description'} onChange={event => set(key, event.target.value)} />
  </label>;
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background: 'rgba(0,0,0,0.6)'}}>
    <section role="dialog" aria-modal="true" aria-label={existing ? 'Edit Symbol' : 'Add Symbol'} className="ui-card w-full max-w-3xl p-6 overflow-auto" style={{background: 'var(--surface)', maxHeight: '92vh'}}>
      <h2 className="text-base font-semibold mb-3">{existing ? 'Edit Symbol' : 'Add Symbol'}</h2>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {!existing && <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs flex-1">Search symbols
            <input type="search" name="symbol_search" className="ui-input ui-input-sm" placeholder="Search by symbol or description, e.g. ETH or SOL" autoComplete="off" value={symbolSearch} disabled={loading} onChange={event => setSymbolSearch(event.target.value)} onKeyDown={event => {
              if (event.key === 'Enter') {event.preventDefault(); event.currentTarget.form.elements.namedItem('symbol')?.focus();}
              if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); setSymbolSearch('');}
            }} />
          </label>
          {symbolSearch && <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => setSymbolSearch('')}>Clear search</button>}
        </div>}
        <label className="flex flex-col gap-1 text-xs">Feed symbol
          {existing ? <input className="ui-input ui-input-sm" value={form.symbol} disabled /> : <select name="symbol" className="ui-input ui-input-sm" required disabled={loading} value={form.symbol} onChange={event => selectSymbol(event.target.value)}>
            <option value="">{loading ? 'Loading permitted feed symbols…' : 'Select feed symbol'}</option>
            {selectedOutsideSearch && <option value={form.symbol}>{form.symbol} (selected)</option>}
            {matchingSymbols.map(row => <option key={row.symbol} value={row.symbol}>{row.symbol}</option>)}
          </select>}
        </label>
        {!existing && !loading && <p role="status" className="text-xs">{matchingSymbols.length ? `${matchingSymbols.length} of ${catalogue.length} symbols` : 'No matching symbols. Try another search.'}</p>}
        {catalogueError && <p role="alert" className="text-xs" style={{color: 'var(--danger)'}}>{catalogueError} <button type="button" onClick={() => {setLoading(true); setAttempt(value => value + 1);}}>Retry catalogue</button></p>}
        <p className="text-xs">Feed prices do not supply contract specifications. Complete blank fields from your broker or LP, and review any prefilled values.</p>
        {template && <div className="flex flex-col gap-1">
          <button type="button" disabled={!form.symbol || loading} className="ui-btn ui-btn-secondary ui-btn-sm self-start" onClick={() => {
            applyDefaults(form.category);
          }}>Reset to {template.label}</button>
          <p className="text-xs">Selecting a category replaces the contract settings and schedule with its defaults. Feed-supplied specifications take priority. Every value is editable.</p>
        </div>}
        {templateSource && <p role="status" className="text-xs">Applied {templateSource}. Starter values and schedules are examples, not verified specifications for {form.symbol}. Review with your broker or LP before enabling trading.</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {input('description', 'Description')}
          <div className="flex flex-col gap-1">
            <label className="flex flex-col gap-1 text-xs">Category
              <select name={customCategory ? undefined : 'category'} className="ui-input ui-input-sm" required value={customCategory ? '__custom__' : form.category} onChange={event => {
                const custom = event.target.value === '__custom__';
                setCustomCategory(custom);
                applyDefaults(custom ? '' : event.target.value);
              }}>
                <option value="">Select category</option>
                {categoryOptions.map(name => <option key={name} value={name}>{name}</option>)}
                <option value="__custom__">Custom category…</option>
              </select>
            </label>
            {customCategory && input('category', 'Custom category')}
            <p className="text-xs">Known symbols select their category and defaults automatically, e.g. XAUUSD → Metals and GBPUSD → Forex. You can change the category manually.</p>
          </div>
          {input('symbol_timezone', 'Session timezone')}
          {numericInstrumentFields.map(key => input(key, key.replaceAll('_', ' '), 'number'))}
          <label className="flex flex-col gap-1 text-xs">Calculation mode<select name="calc_mode" className="ui-input ui-input-sm" required value={form.calc_mode} onChange={event => set('calc_mode', event.target.value)}><option value="">Select mode</option>{calcModes.map(mode => <option key={mode} value={mode}>{modeLabels[mode]}</option>)}</select><span>Use the calculation mode specified by your broker or LP.</span></label>
          {input('margin_currency', 'Margin currency')}{input('profit_currency', 'Profit currency')}
        </div>
        <fieldset className="flex flex-col gap-2"><legend className="text-sm font-semibold">Quote and trading sessions ({form.symbol_timezone})</legend>
          <p className="text-xs">Use HH:MM and 24:00 for end of day. An end at or before the start continues into the next day. Days without a session are closed unless an overnight session continues into them.</p>
          {/crypto/i.test(form.category) && <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm self-start" onClick={() => set('sessions', cryptoSessions())}>Use seven-day crypto schedule (00:00–24:00)</button>}
          {form.sessions.map((session, index) => <div key={index} className="flex gap-2 items-end flex-wrap">
            <label className="text-xs">Day<select aria-label={`Session ${index + 1} day`} className="ui-input ui-input-sm" value={session.day_of_week} onChange={event => setSession(index, 'day_of_week', Number(event.target.value))}>{dayNames.map((day, value) => <option key={day} value={value}>{day}</option>)}</select></label>
            {['quote_from', 'quote_to', 'trade_from', 'trade_to'].map(key => <label key={key} className="text-xs">{key.replace('_', ' ')}<input aria-label={`Session ${index + 1} ${key}`} className="ui-input ui-input-sm" style={{width: 85}} required placeholder="HH:MM" value={session[key]} onChange={event => setSession(index, key, event.target.value)} /></label>)}
            <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => set('sessions', form.sessions.filter((_, i) => i !== index))}>Remove</button>
          </div>)}
          <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm self-start" onClick={() => set('sessions', [...form.sessions, {day_of_week: 1, quote_from: '', quote_to: '', trade_from: '', trade_to: ''}])}>Add session</button>
        </fieldset>
        <label className="text-xs"><input name="enabled" type="checkbox" checked={form.enabled} onChange={event => set('enabled', event.target.checked)} /> Enable trading after saving</label>
        <p className="text-xs">Enabling preserves group restrictions. The terminal updates automatically; readiness also requires an open session and a fresh executable quote.</p>
        <label className="text-xs"><input name="reviewed" type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} /> I reviewed the broker/LP specifications and the displayed schedule.</label>
        {error && <p role="alert" className="text-xs" style={{color: 'var(--danger)'}}>{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={onClose} className="ui-btn ui-btn-secondary ui-btn-sm">Cancel</button><button data-testid="symbol-save" type="submit" disabled={saving || loading || !reviewed} className="ui-btn ui-btn-primary ui-btn-sm">{saving ? 'Saving…' : existing ? 'Save' : 'Add Symbol'}</button></div>
      </form>
    </section>
  </div>;
}
