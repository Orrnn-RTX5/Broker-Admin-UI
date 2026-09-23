import {categoryDisplayName} from '../../../utils/categoryDisplayName.js';
import {useMemo, useState} from 'react';
import {InstrumentsService} from '../../../services/instruments.service';
import {categoryCandidates, rootCategory, assignCategorySymbols} from '../../../utils/categoryAssignment.js';

export default function CategorySymbolsModal({category, folders, instruments, onClose, onSaved}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState([]);
  const [failures, setFailures] = useState([]);
  const [error, setError] = useState('');
  const candidates = useMemo(() => categoryCandidates(category,folders,instruments),[category,folders,instruments]);
  const rows = candidates.filter(row => `${row.symbol} ${row.category}`.toLowerCase().includes(search.toLowerCase()));
  const available = row => !row.alreadyAssigned && !row.needsSetup && !saved.includes(row.symbol);
  const selectable = rows.filter(available);
  const allSelected = selectable.length > 0 && selectable.every(row => selected.includes(row.symbol));
  const toggleAll = () => setSelected(prev => allSelected ? prev.filter(symbol => !selectable.some(row => row.symbol === symbol)) : [...new Set([...prev,...selectable.map(row => row.symbol)])]);
  const submit = async e => {
    e.preventDefault(); setSaving(true); setError(''); setFailures([]);
    try {
      const result = await assignCategorySymbols(category,candidates,selected,InstrumentsService.updateInstrument);
      setSaved(prev => [...prev,...result.saved]); setFailures(result.failed);
      setSelected(result.failed.map(row => row.symbol));
      if (result.failed.length === 0) {await onSaved(); onClose();}
    } catch (err) {setError(err.message);}
    finally {setSaving(false);}
  };
  const close = async () => {if(saved.length) await onSaved(); onClose();};
  return <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:'rgba(0,0,0,0.6)'}}>
    <form onSubmit={submit} className="ui-card w-full max-w-2xl p-6 flex flex-col gap-4 max-h-[85vh]" style={{background:'var(--surface)'}}>
      <h2 className="text-lg font-semibold">Add Symbols to {categoryDisplayName(category, folders)}</h2>
      <p className="text-sm">Category: {rootCategory(category,folders)?.name}. Selected symbols move from their current category to {categoryDisplayName(category, folders)}.</p>
      <input className="ui-input" aria-label="Search symbols" placeholder="Search symbols" value={search} onChange={e=>setSearch(e.target.value)} disabled={saving} />
      <label className="text-sm"><input type="checkbox" checked={allSelected} disabled={saving || !selectable.length} onChange={toggleAll} /> Select all available results ({selectable.length})</label>
      <div className="overflow-auto flex-1">
        <table className="ui-grid w-full"><thead><tr><th>Select</th><th>Symbol</th><th>Current category</th><th>Status</th></tr></thead>
          <tbody>{rows.map(row=><tr key={row.symbol}>
            <td><input type="checkbox" aria-label={`Select ${row.symbol}`} checked={selected.includes(row.symbol)} disabled={saving || !available(row)} onChange={e=>setSelected(prev=>e.target.checked?[...prev,row.symbol]:prev.filter(symbol=>symbol!==row.symbol))} /></td>
            <td>{row.symbol}</td><td>{categoryDisplayName(row, folders)}</td>
            <td>{saved.includes(row.symbol)?'Added':row.alreadyAssigned?'Already in category':row.needsSetup?'Setup required':row.enabled===false?'Disabled':'Configured'}</td>
          </tr>)}</tbody>
        </table>
        {!rows.length && <p className="p-3 text-sm">No matching symbols in this category.</p>}
      </div>
      {candidates.some(row=>row.needsSetup) && <p className="text-xs">Symbols marked Setup required must be configured in Symbols before they can be assigned.</p>}
      {saved.length>0 && <p role="status">Added: {saved.join(', ')}</p>}
      {failures.map(row=><p role="alert" key={row.symbol}>{row.symbol}: {row.message}</p>)}
      {error && <p role="alert">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" className="ui-btn ui-btn-secondary" disabled={saving} onClick={close}>Close</button><button className="ui-btn ui-btn-primary" disabled={saving || !selected.length}>{saving?'Adding…':`Add ${selected.length} Symbols`}</button></div>
    </form>
  </div>;
}
