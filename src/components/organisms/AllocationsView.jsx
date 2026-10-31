import { lazy, Suspense, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { Pencil, Search, Plus, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import './AllocationsView.css';
import { useAuthStore } from '../../store/authStore';
import { hasPermission, PERMISSION_KEYS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiShapes';
import { filterAllocationGroups } from '../../utils/allocations';
import { createCacheIdentity } from '../../utils/cacheIdentity';
import { getAllocationGroupRecord, peekAllocations, primeAllocations, subscribeAllocations } from '../../services/allocation.service';
import { ManagerService } from '../../services/manager.service';

const CreateGroupPopup = lazy(() => import('../RIGHTCLICKJPOPUPS/CreateGroupPopup'));
const GroupPropertiesPopup = lazy(() => import('../RIGHTCLICKJPOPUPS/GroupPropertiesPopup'));

// Short columns get fixed widths and center their values under the heading;
// Group and Description stay left-aligned and share the rest of the width.
const COLUMNS = [
  { key: 'name', label: 'Group' },
  { key: 'description', label: 'Description' },
  { key: 'type', label: 'Type', width: 120, center: true },
  { key: 'currency', label: 'Currency', width: 136, center: true },
  { key: 'leverage', label: 'Leverage', width: 148, center: true, numeric: true },
  { key: 'marginCall', label: 'Margin call', width: 176, center: true, numeric: true },
  { key: 'stopOut', label: 'Stop out', width: 148, center: true, numeric: true },
  { key: 'accounts', label: 'Accounts', width: 148, center: true, numeric: true },
  { key: 'tradeAllowed', label: 'Trading', width: 164, center: true },
];
const PAGE_SIZES = [25, 50, 100];
const SKELETON_ROWS = 8;

const formatCount = (value) => (value === null || value === undefined ? '—' : Number(value).toLocaleString());
const Empty = () => <span className="alloc-empty-value">—</span>;
const percent = (value) => (value === null ? <Empty /> : `${value}%`);

const columnClass = (column) => [column.center && 'is-center', column.numeric && 'is-numeric'].filter(Boolean).join(' ') || undefined;

const renderCell = (group, key) => {
  switch (key) {
    case 'name': return <span className="alloc-group-name">{group.name}</span>;
    case 'type': return <span className="alloc-type" data-type={group.type.toLowerCase()}>{group.type}</span>;
    case 'leverage': return group.leverage ? `1:${group.leverage.toLocaleString()}` : <Empty />;
    case 'marginCall': return percent(group.marginCall);
    case 'stopOut': return percent(group.stopOut);
    case 'accounts': return formatCount(group.accounts);
    case 'tradeAllowed':
      if (group.tradeAllowed === null) return <Empty />;
      return <span className="alloc-state" data-tone={group.tradeAllowed ? 'on' : 'off'}>{group.tradeAllowed ? 'Enabled' : 'Disabled'}</span>;
    default: return group[key] || <Empty />;
  }
};

export default function AllocationsView() {
  const currentUser = useAuthStore((state) => state.user);
  const identity = useAuthStore(createCacheIdentity);
  return <AllocationTable key={identity} identity={identity} currentUser={currentUser} />;
}

function AllocationTable({ identity, currentUser }) {
  const canEditGroups = hasPermission(currentUser, PERMISSION_KEYS.MANAGE_GROUPS);

  const state = useSyncExternalStore(subscribeAllocations, () => peekAllocations(identity));
  const [actionError, setActionError] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [sort, setSort] = useState({ key: 'name', direction: 'asc' });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [selectedId, setSelectedId] = useState(null);
  const [groupEditor, setGroupEditor] = useState(null);
  const [propertiesGroup, setPropertiesGroup] = useState(null);
  useEffect(() => { void primeAllocations(); }, [identity]);

  const refresh = () => { setActionError(''); void primeAllocations({ force: true }); };

  const allGroups = state.rows;
  const currencies = useMemo(() => [...new Set(allGroups.map((group) => group.currency).filter(Boolean))].sort(), [allGroups]);
  const filtered = useMemo(() => filterAllocationGroups(allGroups, {
    query, type: typeFilter, currency: currencyFilter, sortKey: sort.key, sortDirection: sort.direction,
  }), [allGroups, query, typeFilter, currencyFilter, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const start = currentPage * pageSize;
  const visible = filtered.slice(start, start + pageSize);
  const hasFilters = Boolean(query || typeFilter || currencyFilter);
  const firstLoad = state.loading && !allGroups.length;

  const metrics = useMemo(() => [
    ['Groups', allGroups.length],
    ['Real', allGroups.filter((group) => group.type === 'Real').length],
    ['Demo', allGroups.filter((group) => group.type === 'Demo').length],
    ['Accounts', state.accountsKnown ? allGroups.reduce((sum, group) => sum + (group.accounts || 0), 0) : null],
    ['Disabled', allGroups.filter((group) => group.tradeAllowed === false).length, 'Trading disabled'],
  ], [allGroups, state.accountsKnown]);

  const toggleSort = (key) => {
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
    setPage(0);
  };
  const resetFilters = () => { setQuery(''); setTypeFilter(''); setCurrencyFilter(''); setPage(0); };
  const openProperties = (group) => {
    setPropertiesGroup({ ...group.record, group: group.name, name: group.name });
  };
  const fullRecord = async group => {
    setActionError('');
    try { return group.record && !group.record._allocationSummary ? group.record : await getAllocationGroupRecord(group.name); }
    catch (error) { setActionError(getApiErrorMessage(error, 'The group editor could not be opened.')); return null; }
  };
  const editGroup = async (group) => {
    const record = await fullRecord(group);
    if (record) setGroupEditor({ initialData: { ...record, name: group.name } });
  };
  const duplicateGroup = async (group) => {
    const record = await fullRecord(group);
    if (!record) return;
    const { id: _id, ...copy } = record;
    // Per-symbol terms come from GroupSymbolsGet (it carries trade_allowed; the record's symbolSettings does not).
    // If they cannot be read, the duplicate is not opened, so it cannot silently lack the source's terms.
    let copySymbolTermsFrom;
    try { copySymbolTermsFrom = await ManagerService.getGroupAllowedSymbols(group.name); }
    catch (error) { setActionError(getApiErrorMessage(error, 'The group could not be duplicated.')); return; }
    setGroupEditor({ draftData: { ...copy, name: `${group.name}-copy` }, copySymbolTermsFrom });
  };
  // A warning means the group was created but its per-symbol terms were not copied; the list still refreshes.
  const afterGroupSaved = (warning) => { setGroupEditor(null); refresh(); if (warning) setActionError(warning); };

  return (
    <div className="alloc-view">
      <section className="alloc-card" aria-labelledby="alloc-groups-title">
        <header className="alloc-heading">
          <h2 id="alloc-groups-title">Allocations</h2>
        </header>
        <div className="alloc-nav" role="toolbar" aria-label="Account groups">
          <div className="alloc-nav-main">
          <span className="alloc-nav-label" title="Groups new accounts are allocated to, with their trading conditions. Double-click a group to open its properties.">Account groups</span>
          <div className="alloc-nav-filters">
          <label className="alloc-search">
            <Search size={13} strokeWidth={1.75} aria-hidden="true" />
            <input type="search" aria-label="Search by group, description or currency" placeholder="Search groups" value={query} spellCheck={false} autoComplete="off" onChange={(event) => { setQuery(event.target.value); setPage(0); }} />
          </label>
          <select className="alloc-select" aria-label="Filter by type" value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(0); }}>
            <option value="">All types</option><option value="Real">Real</option><option value="Demo">Demo</option>
          </select>
          <select className="alloc-select" aria-label="Filter by currency" value={currencyFilter} onChange={(event) => { setCurrencyFilter(event.target.value); setPage(0); }}>
            <option value="">All currencies</option>{currencies.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          {hasFilters && <button type="button" className="alloc-link-btn" onClick={resetFilters}>Clear</button>}
          </div>
          <dl className="alloc-nav-metrics" aria-label="Group summary">
            {metrics.map(([label, value, title]) => (
              <div key={label} title={title || label}>
                <dt>{label}</dt>
                <dd data-alert={label === 'Disabled' && value > 0 ? true : undefined}>{firstLoad ? '…' : formatCount(value)}</dd>
              </div>
            ))}
          </dl>
          </div>
          {canEditGroups && (
            <div className="alloc-nav-tools">
              <button type="button" className="alloc-btn alloc-btn--primary" onClick={() => setGroupEditor({})}><Plus size={14} aria-hidden="true" />Add group</button>
            </div>
          )}
        </div>

        {(state.error || state.countsError || actionError) && (
          <div className="alloc-alert" role="alert">{state.error || state.countsError || actionError}<button type="button" className="alloc-link-btn" onClick={refresh}>Retry</button></div>
        )}

        <div className="alloc-table-wrap">
          <table className="alloc-table">
            <colgroup>
              {COLUMNS.map((column) => <col key={column.key} style={column.width ? { width: column.width } : undefined} />)}
              <col className="alloc-actions-col" />
            </colgroup>
            <thead>
              <tr>
                {COLUMNS.map((column) => {
                  const active = sort.key === column.key;
                  return (
                    <th key={column.key} className={columnClass(column)} aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" className="alloc-sort" onClick={() => toggleSort(column.key)}>
                        {column.label}
                        <span className="alloc-sort-icon" data-active={active || undefined} aria-hidden="true" style={{ display: 'none' }}>

                        </span>
                      </button>
                    </th>
                  );
                })}
                <th className="alloc-actions-head">Actions</th>
              </tr>
            </thead>
            <tbody>
              {firstLoad && Array.from({ length: SKELETON_ROWS }, (_, index) => (
                <tr key={`skeleton-${index}`} aria-hidden="true">
                  {COLUMNS.map((column) => <td key={column.key}><span className="alloc-skeleton" /></td>)}<td />
                </tr>
              ))}
              {visible.map((group) => (
                <tr
                  key={group.id}
                  className={selectedId === group.id ? 'is-selected' : undefined}
                  onClick={() => setSelectedId(group.id)}
                  onDoubleClick={() => openProperties(group)}
                >
                  {COLUMNS.map((column) => (
                    <td key={column.key} className={columnClass(column)} title={typeof group[column.key] === 'string' ? group[column.key] : undefined}>
                      {renderCell(group, column.key)}
                    </td>
                  ))}
                  <td>
                    <div className="alloc-row-actions" role="group" aria-label={`Actions for ${group.name}`}>
                      {canEditGroups && (
                        <button type="button" className="alloc-icon-btn" onClick={(event) => { event.stopPropagation(); editGroup(group); }} aria-label={`Edit ${group.name}`} title="Edit group"><Pencil size={13} /></button>
                      )}
                      <Menu.Root>
                        <Menu.Trigger asChild>
                          <button type="button" className="alloc-icon-btn" onClick={(event) => event.stopPropagation()} aria-label={`More actions for ${group.name}`} title="More actions"><MoreHorizontal size={15} /></button>
                        </Menu.Trigger>
                        <Menu.Portal>
                          <Menu.Content className="alloc-menu" align="end" sideOffset={4}>
                            <Menu.Item onSelect={() => openProperties(group)}>Open properties</Menu.Item>
                            {canEditGroups && <Menu.Item onSelect={() => editGroup(group)}>Edit group</Menu.Item>}
                            {canEditGroups && <Menu.Item onSelect={() => duplicateGroup(group)}>Duplicate group</Menu.Item>}
                          </Menu.Content>
                        </Menu.Portal>
                      </Menu.Root>
                    </div>
                  </td>
                </tr>
              ))}
              {!state.loading && !state.error && !visible.length && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="alloc-table-empty">
                    {hasFilters
                      ? <>No groups match these filters. <button type="button" className="alloc-link-btn" onClick={resetFilters}>Clear filters</button></>
                      : 'No account groups exist on this server yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="alloc-pagination">
          <span>
            {filtered.length
              ? `Showing ${start + 1}–${Math.min(start + pageSize, filtered.length)} of ${filtered.length}${hasFilters ? ` (filtered from ${allGroups.length})` : ''} groups`
              : `0 of ${allGroups.length} groups`}
          </span>
          <div className="alloc-pager">
            <label>Rows per page
              <select className="alloc-select" aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }}>
                {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <span className="alloc-page-label">Page {currentPage + 1} of {pageCount}</span>
            <button type="button" className="alloc-icon-btn" aria-label="Previous page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={15} /></button>
            <button type="button" className="alloc-icon-btn" aria-label="Next page" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight size={15} /></button>
          </div>
        </footer>
      </section>

      <Suspense fallback={null}>
      {groupEditor && (
        <CreateGroupPopup
          initialData={groupEditor.initialData}
          draftData={groupEditor.draftData}
          copySymbolTermsFrom={groupEditor.copySymbolTermsFrom}
          onClose={() => setGroupEditor(null)}
          onCreated={afterGroupSaved}
        />
      )}
      {propertiesGroup && (
        <GroupPropertiesPopup
          group={propertiesGroup}
          onClose={() => setPropertiesGroup(null)}
          onSaved={() => { setPropertiesGroup(null); refresh(); }}
        />
      )}
      </Suspense>
    </div>
  );
}
