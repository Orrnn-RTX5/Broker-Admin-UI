import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { ExternalLink, Pencil, Settings, Search, Plus, SlidersHorizontal, ChevronsUpDown, ChevronLeft, ChevronRight, MoreHorizontal, X, CircleCheck } from 'lucide-react';
import './AllocationsView.css';
import AccountAllocationPopup from '../RIGHTCLICKJPOPUPS/AccountAllocationPopup';

const initialUrls = [
  { label: 'Demo account allocation URL', value: 'https://broker.com/open_account' },
  { label: 'Deposit URL', value: 'https://broker.com/deposit' },
  { label: 'Withdrawal URL', value: 'https://broker.com/withdrawal' },
];
const initialGroups = [
  { id: 'preliminary', group: 'preliminary', desc: 'Preliminary Account', currency: 'USD', type: 'Hedged', server: 'Main Trade Server', countries: 'All countries', leverages: '', kyc: 'Documents, Auto check' },
  { id: 'demo-hedge', group: 'demo\\forex-hedge-usd-01', desc: 'Flexy Markets', currency: 'USD', type: 'Hedged', server: 'Main Trade Server', countries: 'All countries', leverages: '1000', kyc: '' },
  { id: 'demo-std', group: 'demo\\STD', desc: 'Preliminary Account', currency: 'USD', type: 'Hedged', server: 'Main Trade Server', countries: 'All countries', leverages: '', kyc: '' },
];
const fields = [['group', 'Group'], ['desc', 'Description'], ['currency', 'Currency'], ['type', 'Type'], ['server', 'Server'], ['countries', 'Countries'], ['leverages', 'Leverages'], ['kyc', 'KYC Options']];
const blankGroup = { group: '', desc: '', currency: 'USD', type: 'Hedged', server: 'Main Trade Server', countries: 'All countries', leverages: '', kyc: '' };

export default function AllocationsView() {
  const [urls, setUrls] = useState(initialUrls);
  const [groups, setGroups] = useState(initialGroups);
  const [selected, setSelected] = useState('preliminary');
  const [query, setQuery] = useState('');
  const [server, setServer] = useState('');
  const [country, setCountry] = useState('');
  const [kycOnly, setKycOnly] = useState(false);
  const [sort, setSort] = useState(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [editor, setEditor] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [advancedGroup, setAdvancedGroup] = useState(null);
  const filtered = groups.filter(row => fields.some(([key]) => row[key].toLowerCase().includes(query.trim().toLowerCase())) && (!server || row.server === server) && (!country || row.countries === country) && (!kycOnly || row.kyc));
  if (sort) filtered.sort((a, b) => sort === 'asc' ? a.group.localeCompare(b.group) : b.group.localeCompare(a.group));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
  const start = currentPage * pageSize;
  const visible = filtered.slice(start, start + pageSize);
  const openEditor = value => { setError(''); setEditor(value); };
  const editGroup = row => openEditor({ kind: 'group', value: { ...row } });
  const editUrls = index => openEditor({ kind: 'urls', index, value: urls.map(row => ({ ...row })) });
  const updateGroup = (key, value) => setEditor(previous => ({ ...previous, value: { ...previous.value, [key]: value } }));
  const save = event => {
    event.preventDefault();
    if (editor.kind === 'urls') {
      const next = editor.value.map(row => ({ ...row, value: row.value.trim() }));
      if (next.some(row => { try { return !['https:', 'http:'].includes(new URL(row.value).protocol); } catch { return true; } })) {
        setError('Enter a valid HTTP or HTTPS URL for each endpoint.'); return;
      }
      setUrls(next);
      setNotice('Allocation URLs updated for this session.');
    } else {
      const next = Object.fromEntries(Object.entries(editor.value).map(([key, value]) => [key, value.trim()]));
      if (!next.group || !next.desc || !next.currency || !next.server || !next.countries) { setError('Complete all required fields.'); return; }
      if (groups.some(row => row.id !== next.id && row.group.toLowerCase() === next.group.toLowerCase())) { setError('A group with this name already exists.'); return; }
      next.id ||= crypto.randomUUID();
      setGroups(previous => editor.value.id ? previous.map(row => row.id === next.id ? next : row) : [...previous, next]);
      setSelected(next.id);
      setNotice(`Group ${next.group} saved for this session.`);
    }
    setEditor(null);
  };
  return (
    <div className="allocations-view allocation-typography">
      <header className="allocation-panel allocation-page-heading">
        <div className="allocation-heading"><div><h1>Allocations</h1><p>Manage account allocation endpoints and group configuration</p></div></div>
        <div className="allocation-tools"><span className="allocation-status"><CircleCheck size={13} />{urls.filter(row => row.value).length} allocation URLs configured</span><button onClick={() => editUrls()}><Settings size={16} />Manage URLs</button></div>
      </header>
      <section className="allocation-panel allocation-urls" aria-labelledby="allocation-urls-title">
        <div className="allocation-section-heading"><h2 id="allocation-urls-title">Account Allocation URLs</h2><p>These endpoints are used for account operations and client access.</p></div>
        <div className="allocation-url-list">{urls.map((row, index) => <div className="allocation-url-row" key={row.label}>
          <label htmlFor={`allocation-url-${index}`}>{row.label}</label><input id={`allocation-url-${index}`} readOnly value={row.value} />
          <a href={row.value} target="_blank" rel="noopener noreferrer" aria-label={`Open ${row.label}`} title={`Open ${row.label}`}><ExternalLink size={17} /></a>
          <button className="allocation-icon-button" onClick={() => editUrls(index)} aria-label={`Edit ${row.label}`} title={`Edit ${row.label}`}><Pencil size={17} /></button>
        </div>)}</div>
      </section>
      <section className="allocation-panel allocation-groups" aria-labelledby="allocation-groups-title">
        <div className="allocation-groups-heading">
          <div className="allocation-heading"><div><h2 id="allocation-groups-title">Account Groups</h2><p>Manage trading account groups and allocation settings</p></div></div>
          <div className="allocation-tools">
            <label className="allocation-search"><Search size={17} /><input aria-label="Search groups" placeholder="Search groups..." value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} /></label>
            <select aria-label="Filter by server" value={server} onChange={e => { setServer(e.target.value); setPage(0); }}><option value="">All servers</option>{[...new Set(groups.map(row => row.server))].map(value => <option key={value}>{value}</option>)}</select>
            <select aria-label="Filter by country" value={country} onChange={e => { setCountry(e.target.value); setPage(0); }}><option value="">All countries</option>{[...new Set(groups.map(row => row.countries))].map(value => <option key={value}>{value}</option>)}</select>
            <Menu.Root><Menu.Trigger asChild><button className="allocation-icon-button" aria-label="Additional filters" title="Additional filters" data-active={kycOnly}><SlidersHorizontal size={17} /></button></Menu.Trigger><Menu.Portal><Menu.Content className="allocation-menu allocation-typography" sideOffset={6} align="end"><Menu.CheckboxItem checked={kycOnly} onCheckedChange={value => { setKycOnly(value); setPage(0); }}>{kycOnly ? 'Show all groups' : 'Only groups with KYC'}</Menu.CheckboxItem><Menu.Item onSelect={() => { setQuery(''); setServer(''); setCountry(''); setKycOnly(false); setPage(0); }}>Reset filters</Menu.Item></Menu.Content></Menu.Portal></Menu.Root>
            <button className="allocation-primary" onClick={() => openEditor({ kind: 'group', value: { ...blankGroup } })}><Plus size={19} />Add Group</button>
          </div>
        </div>
        <div className="allocation-table-scroll"><table className="allocation-table"><thead><tr>{fields.map(([key, title]) => <th key={key} aria-sort={key === 'group' ? sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : 'none' : undefined}>{key === 'group' ? <button className="allocation-sort" onClick={() => setSort(sort === 'asc' ? 'desc' : 'asc')}>Group<ChevronsUpDown size={14} /></button> : title}</th>)}<th>Actions</th></tr></thead>
          <tbody>{visible.map(row => <tr key={row.id} className={selected === row.id ? 'is-selected' : ''} onClick={() => setSelected(row.id)} onDoubleClick={() => setAdvancedGroup(row)}>
            {fields.map(([key]) => <td key={key}>{key === 'group' ? <span className="allocation-group-name">{row.group}</span> : row[key] || '—'}</td>)}
            <td><div className="allocation-row-actions"><button className="allocation-icon-button" onClick={() => editGroup(row)} aria-label={`Edit ${row.group}`} title={`Edit ${row.group}`}><Pencil size={16} /></button>
              <Menu.Root><Menu.Trigger asChild><button className="allocation-icon-button" aria-label={`More actions for ${row.group}`}><MoreHorizontal size={18} /></button></Menu.Trigger><Menu.Portal><Menu.Content className="allocation-menu allocation-typography" align="end" sideOffset={5}><Menu.Item onSelect={() => editGroup(row)}>Edit group</Menu.Item><Menu.Item onSelect={() => setAdvancedGroup(row)}>Advanced settings</Menu.Item><Menu.Item onSelect={() => { const copy = { ...row, group: `${row.group} copy` }; delete copy.id; openEditor({ kind: 'group', value: copy }); }}>Duplicate group</Menu.Item></Menu.Content></Menu.Portal></Menu.Root>
            </div></td>
          </tr>)}{!visible.length && <tr><td colSpan={9} className="allocation-empty">No groups match your filters.</td></tr>}
          {Array.from({ length: Math.max(0, 9 - visible.length) }, (_, index) => <tr className="allocation-filler" aria-hidden="true" key={`empty-${index}`}>{Array.from({ length: 9 }, (_, cell) => <td key={cell} />)}</tr>)}
          </tbody></table></div>
        <footer className="allocation-pagination"><span>{groups.length} groups total</span><div className="allocation-tools"><label>Rows per page: <select aria-label="Rows per page" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}>{[10, 25, 50, 100].map(size => <option key={size}>{size}</option>)}</select></label><span>{filtered.length ? start + 1 : 0} – {Math.min(start + pageSize, filtered.length)} of {filtered.length}</span><button className="allocation-icon-button" aria-label="Previous page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={18} /></button><button className="allocation-icon-button" aria-label="Next page" disabled={start + pageSize >= filtered.length} onClick={() => setPage(currentPage + 1)}><ChevronRight size={18} /></button></div></footer>
      </section>
      {notice && <div className="allocation-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={14} /></button></div>}
      {advancedGroup && <AccountAllocationPopup group={advancedGroup} onClose={() => setAdvancedGroup(null)} />}
      <Dialog.Root open={Boolean(editor)} onOpenChange={open => { if (!open) setEditor(null); }}><Dialog.Portal><Dialog.Overlay className="allocation-dialog-overlay" /><Dialog.Content className="allocation-dialog allocation-typography">
        <div className="allocation-dialog-heading"><Dialog.Title>{editor?.kind === 'urls' ? 'Manage allocation URLs' : editor?.value.id ? 'Edit account group' : 'Add account group'}</Dialog.Title><Dialog.Close asChild><button aria-label="Close"><X size={18} /></button></Dialog.Close></div>
        <Dialog.Description>Changes apply to this session. Configure the allocation details below.</Dialog.Description>
        {editor && <form onSubmit={save}><div className={editor.kind === 'group' ? 'allocation-form-grid' : 'allocation-form-urls'}>
          {editor.kind === 'urls' ? editor.value.map((row, index) => <label key={row.label}>{row.label}<input type="url" required autoFocus={index === (editor.index ?? 0)} value={row.value} onChange={e => { const value = e.target.value; setEditor(previous => ({ ...previous, value: previous.value.map((item, i) => i === index ? { ...item, value } : item) })); }} /></label>) : fields.map(([key, title]) => <label key={key}>{title}{!['leverages', 'kyc'].includes(key) ? ' *' : ''}{key === 'type' ? <select value={editor.value.type} onChange={e => updateGroup(key, e.target.value)}><option>Hedged</option><option>Netted</option></select> : <input autoFocus={key === 'group'} required={!['leverages', 'kyc'].includes(key)} value={editor.value[key]} onChange={e => updateGroup(key, e.target.value)} />}</label>)}
        </div>{error && <p className="allocation-error" role="alert">{error}</p>}<div className="allocation-dialog-footer"><Dialog.Close asChild><button type="button">Cancel</button></Dialog.Close><button type="submit" className="allocation-primary">Save changes</button></div></form>}
      </Dialog.Content></Dialog.Portal></Dialog.Root>
    </div>
  );
}

