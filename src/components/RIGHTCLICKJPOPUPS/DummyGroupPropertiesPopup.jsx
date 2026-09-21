import { useEffect, useId, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CircleHelp, Coins, Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import './DummyGroupPropertiesPopup.css';
import DummySymbolList from './DummySymbolList';

const TABS = ['Common', 'Statistics', 'Company', 'News & Mail', 'Permissions', 'Margin', 'Symbols', 'Commissions', 'Reports'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SWAP_SOURCES = { EURUSD: { long: -6.5, short: 1.2, tripleDay: 'Wednesday' }, GBPUSD: { long: -3.8, short: -0.6, tripleDay: 'Wednesday' }, XAUUSD: { long: -22.4, short: 14.1, tripleDay: 'Friday' }, USDJPY: { long: 12.7, short: -24.8, tripleDay: 'Wednesday' } };
const id = () => globalThis.crypto?.randomUUID?.() || `dummy-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const copy = value => JSON.parse(JSON.stringify(value));
const marker = <span className="dgp-dummy">(Dummy)</span>;
const COMMON = {
  tradeServer: 'RTX5 Main Server', authentication: 'Normal', oneTimePassword: 'Disabled',
  pushNotifications: 'Enabled', currency: 'USD', digits: 2, minimumPasswordLength: 8,
  forceOneTimePassword: false, enableConnections: true, certificateConfirmation: false,
  changePassword: false, riskWarning: true, regulatoryRestrictions: false,
};
const PERMISSIONS = {
  maximumSymbols: 'Unlimited', maximumPositions: 'Unlimited', maximumOrders: 'Unlimited',
  deposit: 10000, annualInterest: 0, history: 'All', leverage: '100',
  tradingSignals: 'All brokers', transferFunds: 'Disabled', expertAdvisors: true,
  trailingStops: true, chargeSwaps: true, fifo: false, prohibitHedge: false,
  dealCost: false, inactivityDays: 360,
};
const MARGIN = {
  riskManagement: 'Retail Forex, CFD, Futures with hedged positions', marginCallLevel: 100,
  stopOutLevel: 50, stopOutMode: 'Percent', compensateNegativeBalance: true,
  withdrawCredit: false, stopOutHedged: false, floatingLeverage: 'None',
  unrealizedProfit: 'Use profit and loss', dailyFixedProfit: 'Use profit and loss',
  releaseFixedProfit: false, virtualCredit: 0,
};
const COMPANY = {
  name: 'RTX5 Example Brokerage', description: 'Practice trading group',
  website: 'https://broker.example', email: 'service@broker.example',
  depositUrl: 'https://broker.example/deposit', withdrawalUrl: 'https://broker.example/withdraw',
  supportSite: 'https://broker.example/support', supportEmail: 'support@broker.example', templatesFolder: 'default',
};
const STATISTICS = { accountCount: 24, activePositions: 18, totalVolume: 12.5, netExposure: 32000, totalBalance: 240000, totalEquity: 243450, totalMargin: 12500, freeMargin: 230950 };
const NEWS = { news: 'Full package', categories: 'Finance, Markets, Company', languages: 'English', internalMail: true };
const REPORTS = { generateData: 'End of Day and End of Month', generateStatements: true, sendEmail: false, statementMode: 'Daily and monthly', archiveReports: true };

function initialDraft(group) {
  const settings = group?.settings || {};
  return {
    ...copy(group || {}), name: group?.path || group?.name || 'Admin\\demo\\New Group',
    path: group?.path || group?.name || 'Admin\\demo\\New Group', isDummy: true,
    settings: {
      ...settings, common: { ...COMMON, ...settings.common, currency: group?.currency || settings.common?.currency || COMMON.currency },
      company: { ...COMPANY, ...settings.company, description: group?.description || settings.company?.description || COMPANY.description },
      statistics: { ...STATISTICS, ...settings.statistics }, news: { ...NEWS, ...settings.news },
      permissions: { ...PERMISSIONS, ...settings.permissions }, reports: { ...REPORTS, ...settings.reports },
      margin: { ...MARGIN, ...settings.margin,
        riskManagement: group?.riskManagement || settings.margin?.riskManagement || MARGIN.riskManagement,
        marginCallLevel: group?.marginCallLevel ?? settings.margin?.marginCallLevel ?? 100,
        stopOutLevel: group?.stopOutLevel ?? settings.margin?.stopOutLevel ?? 50 },
    },
    symbols: copy(group?.symbols || []), commissions: copy(group?.commissions || []),
  };
}

function Modal({ title, children, onClose, onSave, saveLabel = 'OK', error, className = '', help }) {
  const ref = useRef(null);
  const titleId = useId();
  const [showHelp, setShowHelp] = useState(false);
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);
  return <dialog ref={ref} className={`dgp-modal ${className}`} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="dgp-titlebar"><Users size={16} /><h2 id={titleId}>{title}</h2><button type="button" className="dgp-icon-button" onClick={onClose} aria-label="Close dialog"><X size={16} /></button></header>
    <div className="dgp-local-notice">Dummy data · Changes are saved on this device only.</div>
    {children}
    {showHelp && <aside className="dgp-help" role="status">{help || 'Edit the sample values, then choose OK to keep them. Cancel discards this dialog’s changes. Every value marked (Dummy) is sample data.'}</aside>}
    {error && <p className="dgp-error" role="alert">{error}</p>}
    <footer className="dgp-footer"><button type="button" className="dgp-button dgp-primary" onClick={onSave}>{saveLabel}</button><button type="button" className="dgp-button" onClick={onClose}>Cancel</button><button type="button" className="dgp-button" onClick={() => setShowHelp(value => !value)} aria-expanded={showHelp}><CircleHelp size={12} /> Help</button></footer>
  </dialog>;
}

function Tabs({ tabs, value, onChange, prefix }) {
  return <div className="dgp-tabs" role="tablist" aria-label={`${prefix} settings`}>
    {tabs.map((tab, index) => <button type="button" role="tab" key={tab} id={`${prefix}-tab-${index}`} aria-selected={value === tab} aria-controls={`${prefix}-panel`} tabIndex={value === tab ? 0 : -1} onClick={() => onChange(tab)} onKeyDown={event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); onChange(tabs[next]); event.currentTarget.parentElement.children[next].focus(); }
    }}>{tab}</button>)}
  </div>;
}

function Field({ label, value, onChange, options, type = 'text', min, max, disabled, step = 'any' }) {
  const inputId = useId();
  return <div className={`dgp-field${disabled ? ' dgp-disabled' : ''}`}><label htmlFor={inputId}>{label}:</label>
    {options ? <select id={inputId} value={value ?? ''} disabled={disabled} onChange={event => onChange(event.target.value)}>
      {[...new Set([...(value !== undefined && value !== '' ? [String(value)] : []), ...options.map(String)])].map(option => <option key={option}>{option}</option>)}
    </select> : <input id={inputId} type={type} value={value ?? ''} disabled={disabled} min={min} max={max} step={type === 'number' ? step : undefined} onChange={event => onChange(type === 'number' && event.target.value !== '' ? Number(event.target.value) : event.target.value)} />}
    {marker}
  </div>;
}
function Check({ label, value, onChange, disabled }) {
  return <label className={`dgp-check${disabled ? ' dgp-disabled' : ''}`}><input type="checkbox" checked={Boolean(value)} disabled={disabled} onChange={event => onChange(event.target.checked)} /><span>{label}</span>{marker}</label>;
}
function Intro({ children, symbol = false }) {
  const Icon = symbol ? Coins : Users;
  return <div className="dgp-intro"><Icon size={32} aria-hidden="true" /><p>{children}</p></div>;
}

function EditableList({ kind, items, columns, onChange, onEdit, selected, onSelect }) {
  const selectedIndex = items.findIndex(item => item.id === selected);
  const move = direction => {
    const next = selectedIndex + direction;
    if (selectedIndex < 0 || next < 0 || next >= items.length) return;
    const updated = [...items];
    [updated[selectedIndex], updated[next]] = [updated[next], updated[selectedIndex]];
    onChange(updated);
  };
  const remove = () => {
    onChange(items.filter(item => item.id !== selected));
    onSelect(items[selectedIndex + 1]?.id || items[selectedIndex - 1]?.id || null);
  };
  return <div className="dgp-list-layout"><div className="dgp-list-actions">
    <button type="button" className="dgp-button" disabled={selectedIndex <= 0} onClick={() => move(-1)}><ArrowUp size={12} /> Up</button>
    <button type="button" className="dgp-button" disabled={selectedIndex < 0 || selectedIndex >= items.length - 1} onClick={() => move(1)}><ArrowDown size={12} /> Down</button>
    <div className="dgp-action-spacer" />
    <button type="button" className="dgp-button" onClick={() => onEdit(null)}><Plus size={12} /> Add</button>
    <button type="button" className="dgp-button" disabled={selectedIndex < 0} onClick={() => onEdit(items[selectedIndex])}><Pencil size={12} /> Edit</button>
    <button type="button" className="dgp-button" disabled={selectedIndex < 0} onClick={remove}><Trash2 size={12} /> Delete</button>
  </div><div className="dgp-table-scroll"><table className="dgp-table" aria-label={kind}><thead><tr>{columns.map(column => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>
    {items.map(item => <tr key={item.id} tabIndex={0} aria-selected={selected === item.id} className={selected === item.id ? 'dgp-selected' : ''} onClick={() => onSelect(item.id)} onFocus={() => onSelect(item.id)} onDoubleClick={() => onEdit(item)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); onEdit(item); } if (event.key === 'Delete') { event.preventDefault(); onChange(items.filter(row => row.id !== item.id)); onSelect(null); } }}>{columns.map(column => <td key={column.key}>{column.render ? column.render(item) : String(item[column.key] ?? 'Default')} {marker}</td>)}</tr>)}
    <tr><td colSpan={columns.length}><button type="button" className="dgp-add-row" onClick={() => onEdit(null)}><Plus size={13} /> click to add...</button></td></tr>
  </tbody></table>{items.length === 0 && <p className="dgp-empty">No {kind.toLowerCase()} configured. Add a sample entry.</p>}</div></div>;
}

function normalizeSymbol(symbol) {
  const defaultRate = { market: 'Default', limit: 'Default', stop: 'Default', stopLimit: 'Default' };
  return { id: id(), path: 'ECN\\FX-Major\\EURUSD', spreadDifference: 6, spreadBalance: 50, useDefaultSpread: true,
    ...copy(symbol || {}),
    margin: { useDefault: true, initial: 0, hedged: 100000, maintenance: 0, useDefaultFlags: true, largerLeg: false, excludeLongPnl: false, recalculateExchange: false, additionalChecks: 'None', ...symbol?.margin },
    rates: { liquidity: 'Default', currency: 'Default', ...symbol?.rates,
      ...Object.fromEntries(['initialBuy', 'initialSell', 'maintenanceBuy', 'maintenanceSell'].map(key => [key, { ...defaultRate, ...symbol?.rates?.[key] }])) },
    swaps: { type: 'Default', long: 'Default', short: 'Default', daysInYear: 'Default', holidays: 'Default', ...symbol?.swaps,
      multipliers: { ...Object.fromEntries(DAYS.map(day => [day, 'Default'])), ...symbol?.swaps?.multipliers } },
  };
}

function SymbolEditor({ symbol, onSave, onClose }) {
  const [draft, setDraft] = useState(() => normalizeSymbol(symbol));
  const [tab, setTab] = useState('Common');
  const [error, setError] = useState('');
  const prefix = useId();
  const [swapSource, setSwapSource] = useState('EURUSD');
  const tabs = ['Common', 'Margin', 'Margin Rates', 'Swaps'];
  const update = (section, key, value) => setDraft(current => section ? { ...current, [section]: { ...current[section], [key]: value } } : { ...current, [key]: value });
  const field = (section, key, label, options, extra) => <Field key={key} label={label} value={section ? draft[section][key] : draft[key]} onChange={value => update(section, key, value)} options={options} {...extra} />;
  const check = (section, key, label, disabled) => <Check key={key} label={label} value={section ? draft[section][key] : draft[key]} onChange={value => update(section, key, value)} disabled={disabled} />;
  const setSwapPreset = preset => update('swaps', 'multipliers', Object.fromEntries(DAYS.map((day, index) => [day, preset === 'default' ? 'Default' : preset === 'forex' ? (index === 0 || index === 6 ? 0 : index === 3 ? 3 : 1) : 1])));
  return <Modal title={`${symbol ? 'Symbol' : 'Add symbol'}: ${draft.path} (Dummy)`} onClose={onClose} onSave={() => {
    if (!draft.path.trim()) { setError('Enter a symbol path or mask.'); return; }
    if (!Number.isFinite(Number(draft.spreadDifference)) || Number(draft.spreadDifference) < 0) { setError('Spread difference must be a non-negative number.'); return; }
    if (!draft.margin.useDefault && !['initial', 'hedged', 'maintenance'].every(key => draft.margin[key] !== '' && Number.isFinite(Number(draft.margin[key])) && Number(draft.margin[key]) >= 0)) { setError('Margin values must be non-negative numbers.'); return; }
    const validRate = value => value === 'Default' || (String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0);
    if (![draft.rates.liquidity, draft.rates.currency, ...['initialBuy', 'initialSell', 'maintenanceBuy', 'maintenanceSell'].flatMap(key => Object.values(draft.rates[key]))].every(validRate)) { setError('Margin rates must be Default or non-negative numbers.'); return; }
    if (!Object.values(draft.swaps.multipliers).every(validRate)) { setError('Swap multipliers must be Default or non-negative numbers.'); return; }
    if (![draft.swaps.long, draft.swaps.short].every(value => value === 'Default' || (String(value).trim() !== '' && Number.isFinite(Number(value))))) { setError('Long and short swap values must be Default or valid numbers. Negative swaps are allowed.'); return; }
    try { onSave({ ...draft, path: draft.path.trim() }); } catch (saveError) { setError(saveError.message); }
  }} error={error} className="dgp-symbol-modal" help="Symbol paths may contain a wildcard, for example ECN\FX-Major\*. Rows apply in their displayed order. Default inherits the symbol setting. All settings are local dummy values until the parent group is saved.">
    <Tabs tabs={tabs} value={tab} onChange={setTab} prefix={prefix} />
    <div className="dgp-content" role="tabpanel" id={`${prefix}-panel`} aria-labelledby={`${prefix}-tab-${tabs.indexOf(tab)}`}>
      <Intro symbol>{({ Common: 'Please set up main parameters of symbols for the group.', Margin: 'Please specify margin requirements for the symbols group.', 'Margin Rates': 'Please specify margin rates for different types of trade operations.', Swaps: 'Please set up parameters of charging swaps by symbols for the group.' })[tab]}</Intro>
      {tab === 'Common' && <div className="dgp-fields">
        {field(null, 'path', 'Symbol')}{check(null, 'useDefaultSpread', 'Use default spread')}
        {field(null, 'spreadDifference', 'Spread difference (points)', null, { type: 'number', min: 0, disabled: draft.useDefaultSpread })}
        <div className="dgp-field"><label htmlFor={`${prefix}-balance`}>Difference balance:</label><input id={`${prefix}-balance`} type="range" min="0" max="100" value={draft.spreadBalance} disabled={draft.useDefaultSpread} onChange={event => update(null, 'spreadBalance', Number(event.target.value))} />{marker}</div>
        <p className="dgp-inline-note">{(Number(draft.spreadDifference) * Number(draft.spreadBalance) / 100).toFixed(1)} bid / {(Number(draft.spreadDifference) * (100 - Number(draft.spreadBalance)) / 100).toFixed(1)} ask {marker}</p>
      </div>}
      {tab === 'Margin' && <div className="dgp-fields">
        {check('margin', 'useDefault', 'Use default margin settings')}
        {['initial', 'hedged', 'maintenance'].map(key => field('margin', key, `${key[0].toUpperCase()}${key.slice(1)} margin`, null, { type: 'number', min: 0, disabled: draft.margin.useDefault }))}
        {check('margin', 'useDefaultFlags', 'Use default margin flags')}
        {check('margin', 'largerLeg', 'Calculate hedged margin using larger leg', draft.margin.useDefaultFlags)}
        {check('margin', 'excludeLongPnl', 'Exclude long position PnL from free margin and margin level', draft.margin.useDefaultFlags)}
        {check('margin', 'recalculateExchange', 'Recalculate margin exchange rate at the End of Day', draft.margin.useDefaultFlags)}
        {field('margin', 'additionalChecks', 'Additional margin checks', ['None', 'Check pending orders', 'Check all orders'], { disabled: draft.margin.useDefaultFlags })}
      </div>}
      {tab === 'Margin Rates' && <>
        <div className="dgp-fields">{field('rates', 'liquidity', 'Liquidity margin rate', ['Default', '0.5', '1', '2'])}{field('rates', 'currency', 'Currency margin rate', ['Default', '0.5', '1', '2'])}</div>
        <div className="dgp-table-scroll"><table className="dgp-table dgp-rate-table"><thead><tr><th>Operation</th>{['Market Order', 'Limit Order', 'Stop Order', 'Stop Limit Order'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>
          {['initial', 'maintenance'].map(section => <MarginRateRows key={section} section={section} rates={draft.rates} onChange={(key, values) => update('rates', key, values)} />)}
        </tbody></table></div><button type="button" className="dgp-button dgp-reset" onClick={() => {
          setDraft(current => ({ ...current, rates: normalizeSymbol(null).rates }));
        }}>Use default rates settings</button>
      </>}
      {tab === 'Swaps' && <>
        <div className="dgp-fields">{field('swaps', 'type', 'Type', ['Default', 'Disabled', 'Points', 'Deposit currency', 'Margin currency', 'Interest current', 'Interest open'])}
          <div className="dgp-two-columns">{field('swaps', 'long', 'Long positions')}{field('swaps', 'short', 'Short positions')}{field('swaps', 'daysInYear', 'Days in year', ['Default', '360', '365'])}{field('swaps', 'holidays', 'Consider holidays', ['Default', 'Yes', 'No'])}</div>
        </div><div className="dgp-swap-layout"><table className="dgp-table"><thead><tr><th>Day of week</th><th>Multiplier</th></tr></thead><tbody>{DAYS.map(day => <tr key={day}><td>{day}</td><td><input aria-label={`${day} swap multiplier`} value={draft.swaps.multipliers[day]} onChange={event => update('swaps', 'multipliers', { ...draft.swaps.multipliers, [day]: event.target.value })} /> {marker}</td></tr>)}</tbody></table>
          <div className="dgp-list-actions"><button type="button" className="dgp-button" onClick={() => setSwapPreset('default')}>Default</button><button type="button" className="dgp-button" onClick={() => setSwapPreset('forex')}>Forex</button><button type="button" className="dgp-button" onClick={() => setSwapPreset('all')}>All week</button><button type="button" className="dgp-button" onClick={() => {
            const source = SWAP_SOURCES[swapSource];
            setDraft(current => ({ ...current, swaps: { ...current.swaps, type: 'Points', long: source.long, short: source.short, daysInYear: '365', holidays: 'No', multipliers: Object.fromEntries(DAYS.map((day, index) => [day, index === 0 || index === 6 ? 0 : day === source.tripleDay ? 3 : 1])) } }));
          }}>From symbol</button></div>
        </div><div className="dgp-swap-source"><Field label="Swap source" value={swapSource} options={Object.keys(SWAP_SOURCES)} onChange={setSwapSource} /><p className="dgp-inline-note">From symbol copies the selected sample symbol’s rates and weekly schedule.</p></div><button type="button" className="dgp-button dgp-reset" onClick={() => setDraft(current => ({ ...current, swaps: normalizeSymbol(null).swaps }))}>Use default swap settings</button>
      </>}
    </div>
  </Modal>;
}

function MarginRateRows({ section, rates, onChange }) {
  return <><tr className="dgp-table-section"><th colSpan={5}>{section === 'initial' ? 'Initial Margin' : 'Maintenance Margin'}</th></tr>{['Buy', 'Sell'].map(side => {
    const key = `${section}${side}`;
    return <tr key={key}><td>{side}</td>{['market', 'limit', 'stop', 'stopLimit'].map(order => <td key={order}><input aria-label={`${section} ${side} ${order} rate`} value={rates[key][order]} onChange={event => onChange(key, { ...rates[key], [order]: event.target.value })} />{marker}</td>)}</tr>;
  })}</>;
}

function CommissionTiers({ tiers, onChange }) {
  const [selected, setSelected] = useState(tiers[0]?.id || null);
  const tableRef = useRef(null);
  const columns = [{ key: 'from', label: 'From' }, { key: 'to', label: 'To' }, { key: 'commission', label: 'Commission' }, { key: 'minimum', label: 'Minimal' }, { key: 'maximum', label: 'Maximal' }, { key: 'mode', label: 'Mode', options: ['Deposit currency', 'Base currency', 'Profit currency', 'Margin currency', 'Specified currency', 'Points', 'Percent'] }, { key: 'currency', label: 'Currency', options: ['USD', 'EUR', 'GBP', 'JPY'] }, { key: 'per', label: 'Type', options: ['Volume', 'Trade'] }];
  const focusTier = tierId => requestAnimationFrame(() => tableRef.current?.querySelector(`[data-tier-id="${tierId}"] input`)?.focus());
  const add = () => {
    const from = tiers.length ? Math.max(...tiers.map(tier => Number(tier.to) || 0)) : 0;
    const tier = { id: id(), from, to: from + 1000, commission: 1, mode: 'Deposit currency', currency: 'USD', per: 'Volume', minimum: 0, maximum: 0 };
    onChange([...tiers, tier]); setSelected(tier.id); focusTier(tier.id);
  };
  const update = (tierId, key, value) => onChange(tiers.map(tier => tier.id === tierId ? { ...tier, [key]: value } : tier));
  return <div className="dgp-list-layout"><div className="dgp-list-actions"><div className="dgp-action-spacer" />
    <button type="button" className="dgp-button" onClick={add}><Plus size={12} /> Add</button>
    <button type="button" className="dgp-button" disabled={!selected} onClick={() => focusTier(selected)}><Pencil size={12} /> Edit</button>
    <button type="button" className="dgp-button" disabled={!selected} onClick={() => { onChange(tiers.filter(tier => tier.id !== selected)); setSelected(null); }}><Trash2 size={12} /> Delete</button>
  </div><div className="dgp-table-scroll"><table ref={tableRef} className="dgp-table dgp-tier-table" aria-label="Commission tiers"><thead><tr>{columns.map(column => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{tiers.map((tier, index) => <tr key={tier.id} data-tier-id={tier.id} aria-selected={tier.id === selected} onClick={() => setSelected(tier.id)} onFocus={() => setSelected(tier.id)} className={tier.id === selected ? 'dgp-selected' : ''}>{columns.map(column => <td key={column.key}>
    {column.options ? <select aria-label={`Tier ${index + 1} ${column.label}`} value={tier[column.key] ?? column.options[0]} onChange={event => update(tier.id, column.key, event.target.value)}>{[...new Set([...(tier[column.key] ? [tier[column.key]] : []), ...column.options])].map(option => <option key={option}>{option}</option>)}</select> : <input aria-label={`Tier ${index + 1} ${column.label}`} type="number" min={0} step="any" value={tier[column.key] ?? 0} onChange={event => update(tier.id, column.key, event.target.value === '' ? '' : Number(event.target.value))} />}{marker}
  </td>)}</tr>)}</tbody></table>{!tiers.length && <button type="button" className="dgp-add-row" onClick={add}><Plus size={13} /> click to add a commission tier...</button>}</div></div>;
}

function CommissionEditor({ commission, onSave, onClose }) {
  const [draft, setDraft] = useState(() => ({ id: id(), name: '', description: '', symbol: '*', type: 'Standard', range: 'Volume', charge: 'Daily', turnoverCurrency: 'USD', entry: 'All', action: 'All', profit: 'All', reason: 'All', ...copy(commission || {}), tiers: copy(commission?.tiers || []) }));
  const [error, setError] = useState('');
  const radioName = useId();
  const update = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  return <Modal title={`${commission ? 'Commission' : 'Add commission'}: ${draft.name} (Dummy)`} className="dgp-commission-modal" onClose={onClose} error={error} onSave={() => {
    if (!draft.name.trim() || !draft.symbol.trim()) { setError('Enter a commission name and symbol path or mask.'); return; }
    if (!draft.tiers.length) { setError('Add at least one commission tier.'); return; }
    for (const [index, tier] of draft.tiers.entries()) {
      if (![tier.from, tier.to, tier.commission, tier.minimum, tier.maximum].every(value => value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0)) { setError(`Tier ${index + 1}: enter non-negative numbers for the range, commission, minimum and maximum.`); return; }
      if (Number(tier.to) <= Number(tier.from)) { setError(`Tier ${index + 1}: range end must exceed range start.`); return; }
      if (Number(tier.maximum) > 0 && Number(tier.maximum) < Number(tier.minimum)) { setError(`Tier ${index + 1}: maximum must be zero (unlimited) or at least the minimum.`); return; }
    }
    onSave({ ...draft, name: draft.name.trim(), symbol: draft.symbol.trim() });
  }} help="Commission rules are checked in their displayed order. Add one or more tiers for volume or turnover ranges. All changes are dummy settings; choose OK here and then OK in the group dialog to save them.">
    <div className="dgp-content"><Intro symbol>Please specify commission settings for accounts in the group.</Intro>
      <div className="dgp-two-columns"><Field label="Name" value={draft.name} onChange={value => update('name', value)} /><Field label="Description" value={draft.description} onChange={value => update('description', value)} /></div><Field label="Symbol" value={draft.symbol} onChange={value => update('symbol', value)} />
      <div className="dgp-commission-types" role="radiogroup" aria-label="Commission type">{['Standard', 'Agent', 'Fee'].map(type => <label key={type}><input type="radio" name={radioName} checked={draft.type === type} onChange={() => update('type', type)} />{type === 'Fee' ? type : `${type} commission`} {marker}</label>)}</div>
      <div className="dgp-two-columns"><Field label="Range" value={draft.range} options={['Volume', 'Turnover']} onChange={value => update('range', value)} />
        <Field label="Charge" value={draft.charge} options={['Instant', 'Daily', 'Monthly']} onChange={value => update('charge', value)} />
      </div><Field label="Turnover currency" value={draft.turnoverCurrency} options={['USD', 'EUR', 'GBP', 'JPY']} disabled={draft.range !== 'Turnover'} onChange={value => update('turnoverCurrency', value)} />
      {draft.charge === 'Instant' && <div className="dgp-two-columns"><Field label="Deal entry" value={draft.entry} options={['All', 'In', 'Out', 'In / Out', 'Out by']} onChange={value => update('entry', value)} /><Field label="Deal action" value={draft.action} options={['All', 'Buy', 'Sell']} onChange={value => update('action', value)} /><Field label="Deal profit" value={draft.profit} options={['All', 'Profit', 'Loss']} onChange={value => update('profit', value)} /><Field label="Deal reason" value={draft.reason} options={['All', 'Client', 'Expert', 'Dealer', 'Stop loss', 'Take profit', 'Stop out', 'Rollover']} onChange={value => update('reason', value)} /></div>}
      <h3 className="dgp-section-title">Commission tiers</h3>
      <CommissionTiers tiers={draft.tiers} onChange={value => update('tiers', value)} />
    </div>
  </Modal>;
}

const TAB_DESCRIPTIONS = {
  Common: 'A group combines accounts with the same permissions and service conditions. Backslashes in the full name create the Navigator folder branches.',
  Statistics: 'Sample account totals explain the information available for a group.',
  Company: 'Specify the servicing company, contact details and report template folder.',
  'News & Mail': 'Choose news delivery, languages and internal mail permissions.',
  Permissions: 'Set trading permissions, account limits and default account values.',
  Margin: 'Please set up margin requirements for this group.',
  Symbols: 'Please set up individual parameters of symbols traded by the group. Double-click an entry to edit.',
  Commissions: 'Please set up commissions for accounts in the group. Double-click a rule to open its tiers.',
  Reports: 'Configure end-of-day data, account statements and email delivery.',
};

export default function DummyGroupPropertiesPopup({ group, onSave, onClose, isNew = false }) {
  const [draft, setDraft] = useState(() => initialDraft(group));
  const [tab, setTab] = useState(isNew ? 'Common' : 'Margin');
  const [error, setError] = useState('');
  const [symbolEditor, setSymbolEditor] = useState(null);
  const [commissionEditor, setCommissionEditor] = useState(null);
  const [selectedSymbol, setSelectedSymbol] = useState(draft.symbols[0]?.id || null);
  const [selectedCommission, setSelectedCommission] = useState(draft.commissions[0]?.id || null);
  const prefix = useId();
  const update = (section, key, value) => setDraft(current => ({ ...current, settings: { ...current.settings, [section]: { ...current.settings[section], [key]: value } } }));
  const field = (section, key, label, options, extra) => <Field key={key} label={label} value={draft.settings[section][key]} options={options} onChange={value => update(section, key, value)} {...extra} />;
  const check = (section, key, label, disabled) => <Check key={key} label={label} value={draft.settings[section][key]} onChange={value => update(section, key, value)} disabled={disabled} />;
  const setList = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  const save = async () => {
    setError('');
    if (!draft.name.trim()) { setError('Enter a full group name.'); setTab('Common'); return; }
    if (Number(draft.settings.margin.stopOutLevel) > Number(draft.settings.margin.marginCallLevel)) { setError('Stop out level cannot exceed the margin call level.'); setTab('Margin'); return; }
    try {
      await onSave({ ...draft, name: draft.name.trim(), path: draft.name.trim(), currency: draft.settings.common.currency,
        riskManagement: draft.settings.margin.riskManagement, marginCallLevel: Number(draft.settings.margin.marginCallLevel),
        stopOutLevel: Number(draft.settings.margin.stopOutLevel), description: draft.settings.company.description });
      onClose();
    } catch (saveError) { setError(saveError.message || 'Unable to save this dummy group.'); }
  };
  return <><Modal title={`${isNew ? 'New group' : 'Group'}: ${draft.name} (Dummy)`} onClose={onClose} onSave={save} error={error} help="Use a full group name such as Admin\demo\4540\Grp01. Each backslash creates a folder branch. Symbols and Commissions open their own settings windows. OK saves the group locally; Cancel discards all unsaved changes, including nested edits.">
    <Tabs tabs={TABS} value={tab} onChange={setTab} prefix={prefix} />
    <div className="dgp-content dgp-group-content" role="tabpanel" id={`${prefix}-panel`} aria-labelledby={`${prefix}-tab-${TABS.indexOf(tab)}`}>
      <Intro>{TAB_DESCRIPTIONS[tab]}</Intro>
      {tab === 'Common' && <div className="dgp-fields">
        <Field label="Full group name" value={draft.name} onChange={value => setDraft(current => ({ ...current, name: value, path: value }))} />
        <p className="dgp-inline-note">Example: Admin\demo\4540\Grp01 {marker}</p>
        {field('common', 'tradeServer', 'Trade server', ['RTX5 Main Server', 'RTX5 Backup Server'])}
        {field('common', 'authentication', 'Authentication', ['Normal', 'LDAP', 'OAuth'])}
        {field('common', 'oneTimePassword', 'One-time password', ['Disabled', 'Email', 'SMS'])}
        {field('common', 'pushNotifications', 'Push notifications', ['Enabled', 'Disabled'])}
        <div className="dgp-two-columns">{field('common', 'currency', 'Currency', ['USD', 'EUR', 'GBP', 'JPY', 'CHF'])}{field('common', 'digits', 'Digits', ['2', '3', '5'])}</div>
        {field('common', 'minimumPasswordLength', 'Minimum password length', null, { type: 'number', min: 6, max: 64, step: 1 })}
        {check('common', 'forceOneTimePassword', 'Force one-time password usage')}{check('common', 'enableConnections', 'Enable connections')}
        {check('common', 'certificateConfirmation', 'Enable certificate confirmation')}{check('common', 'changePassword', 'Change password at first login')}
        {check('common', 'riskWarning', 'Show risk warning after connection')}{check('common', 'regulatoryRestrictions', 'Enforce country-specific retail restrictions')}
      </div>}
      {tab === 'Statistics' && <><div className="dgp-statistics">{Object.entries({ accountCount: 'Total accounts', activePositions: 'Active positions', totalVolume: 'Total volume (lots)', netExposure: 'Net exposure', totalBalance: 'Total balance', totalEquity: 'Total equity', totalMargin: 'Used margin', freeMargin: 'Free margin' }).map(([key, label]) => <div className="dgp-statistic" key={key}><span>{label}</span><strong>{Number(draft.settings.statistics[key]).toLocaleString(undefined, { maximumFractionDigits: 2 })} {marker}</strong></div>)}</div><p className="dgp-muted">Illustrative totals only; these figures are not calculated from trading accounts.</p></>}
      {tab === 'Company' && <div className="dgp-fields">{Object.entries({ name: 'Company', description: 'Description', website: 'Company site', email: 'Company email', depositUrl: 'Deposit URL', withdrawalUrl: 'Withdrawal URL', supportSite: 'Support site', supportEmail: 'Support email', templatesFolder: 'Templates folder' }).map(([key, label]) => field('company', key, label))}</div>}
      {tab === 'News & Mail' && <div className="dgp-fields">{field('news', 'news', 'News', ['Full package', 'Headlines only', 'Disabled'])}{field('news', 'categories', 'News categories')}{field('news', 'languages', 'News languages', ['English', 'Auto select', 'English, Hindi', 'All'])}{check('news', 'internalMail', 'Enable internal mail system')}</div>}
      {tab === 'Permissions' && <div className="dgp-fields"><div className="dgp-two-columns">
        {field('permissions', 'maximumSymbols', 'Maximum symbols', ['Unlimited', '100', '500'])}{field('permissions', 'history', 'Available history', ['All', 'Last month', 'Last 3 months', 'Last year'])}
        {field('permissions', 'maximumPositions', 'Maximum positions', ['Unlimited', '100', '500'])}{field('permissions', 'maximumOrders', 'Maximum orders', ['Unlimited', '100', '500'])}
        {field('permissions', 'deposit', 'Deposit by default', null, { type: 'number', min: 0 })}{field('permissions', 'leverage', 'Leverage by default', ['50', '100', '200', '500', '1000'])}
        {field('permissions', 'annualInterest', 'Annual interest rate (%)', null, { type: 'number' })}
      </div>{field('permissions', 'tradingSignals', 'Trading Signals', ['All brokers', 'My servers only', 'Disabled'])}{field('permissions', 'transferFunds', 'Transfer of funds', ['Disabled', 'Same name and group', 'Same name and subgroup', 'Same name'])}
        {check('permissions', 'expertAdvisors', 'Enable trading by Expert Advisors')}{check('permissions', 'trailingStops', 'Enable trailing stops')}{check('permissions', 'chargeSwaps', 'Enable charge of swaps')}{check('permissions', 'fifo', 'Enable position closing according to FIFO rule')}{check('permissions', 'prohibitHedge', 'Prohibit hedge positions')}{check('permissions', 'dealCost', 'Enable deal cost calculation')}
        {field('permissions', 'inactivityDays', 'Inactivity period (days)', null, { type: 'number', min: 0, step: 1 })}
      </div>}
      {tab === 'Margin' && <div className="dgp-fields">
        {field('margin', 'riskManagement', 'Risk management', ['Retail Forex, CFD, Futures with hedged positions', 'Retail Forex, CFD, Futures with netted positions', 'Exchange with netted positions'])}
        <div className="dgp-two-columns">{field('margin', 'marginCallLevel', 'Margin call level', null, { type: 'number', min: 0 })}{field('margin', 'stopOutLevel', 'Stop out level', null, { type: 'number', min: 0 })}</div>
        {field('margin', 'stopOutMode', 'Stop out units', ['Percent', 'Deposit currency'])}
        {check('margin', 'stopOutHedged', 'Stop out fully hedged accounts')}{check('margin', 'compensateNegativeBalance', 'Compensate negative balance after stop out')}{check('margin', 'withdrawCredit', 'Withdraw credit after negative balance compensation', !draft.settings.margin.compensateNegativeBalance)}
        {field('margin', 'floatingLeverage', 'Floating leverage profile', ['None', 'Forex', 'Crypto', 'Stock'])}
        <fieldset className="dgp-fieldset"><legend>Profit/loss in free margin</legend>{field('margin', 'unrealizedProfit', 'Unrealized profit', ['Use profit and loss', 'Use profit only', 'Use loss only', 'Exclude'])}{field('margin', 'dailyFixedProfit', 'Daily fixed profit', ['Use profit and loss', 'Use profit only', 'Use loss only', 'Exclude'])}{check('margin', 'releaseFixedProfit', 'Release fixed profit at end of day')}</fieldset>
        {field('margin', 'virtualCredit', 'Virtual credit', null, { type: 'number', min: 0 })}
      </div>}
      {tab === 'Symbols' && <DummySymbolList items={draft.symbols} selected={selectedSymbol} onSelect={setSelectedSymbol} onChange={value => setList('symbols', value)} onEdit={symbol => setSymbolEditor({ symbol })} />}
      {tab === 'Commissions' && <EditableList kind="Commissions" items={draft.commissions} selected={selectedCommission} onSelect={setSelectedCommission} onChange={value => setList('commissions', value)} onEdit={commission => setCommissionEditor({ commission })} columns={[{ key: 'name', label: 'Name' }, { key: 'symbol', label: 'Symbol' }, { key: 'type', label: 'Type' }, { key: 'range', label: 'Range' }, { key: 'charge', label: 'Charge' }, { key: 'tiers', label: 'Tiers', render: commission => (commission.tiers || []).map(tier => `${tier.from}–${tier.to}: ${tier.commission} ${tier.mode}`).join('; ') }]} />}
      {tab === 'Reports' && <div className="dgp-fields">{field('reports', 'generateData', 'Generate report data', ['Disabled', 'End of Day and End of Month', 'End of Day only', 'End of Month only'])}{check('reports', 'generateStatements', 'Generate daily and monthly statements')}{check('reports', 'sendEmail', 'Send statements by email')}{field('reports', 'statementMode', 'Statements', ['Daily and monthly', 'Daily only', 'Monthly only'])}{check('reports', 'archiveReports', 'Archive reports on server')}</div>}
    </div>
  </Modal>{symbolEditor && <SymbolEditor symbol={symbolEditor.symbol} onClose={() => setSymbolEditor(null)} onSave={symbol => {
    if (draft.symbols.some(item => item.id !== symbol.id && item.path.toLowerCase() === symbol.path.toLowerCase())) throw new Error('This symbol path already exists in the group.');
    setList('symbols', symbolEditor.symbol ? draft.symbols.map(item => item.id === symbol.id ? symbol : item) : [...draft.symbols, symbol]); setSelectedSymbol(symbol.id); setSymbolEditor(null);
  }} />}{commissionEditor && <CommissionEditor commission={commissionEditor.commission} onClose={() => setCommissionEditor(null)} onSave={commission => { setList('commissions', commissionEditor.commission ? draft.commissions.map(item => item.id === commission.id ? commission : item) : [...draft.commissions, commission]); setSelectedCommission(commission.id); setCommissionEditor(null); }} />}</>;
}
